<template>
  <v-dialog v-model="visible" :fullscreen="isMobile" max-width="1100" scrollable>
    <v-card rounded="lg">
      <v-card-title class="d-flex align-center ga-2">
        <v-icon>mdi-gauge</v-icon>
        Анализ режима
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" @click="visible = false" />
      </v-card-title>
      <v-card-text>
        <p class="text-body-2 text-medium-emphasis mb-3">
          Аналог desktop «Анализ»: по результатам последнего расчёта фрагмента. Щелчок по строке — объект на карте.
        </p>

        <div class="d-flex flex-wrap ga-3 mb-3">
          <v-autocomplete
            v-model="fragmentId"
            :items="fragmentItems"
            item-title="title"
            item-value="value"
            label="Фрагмент"
            density="compact"
            variant="outlined"
            hide-details
            style="min-width: 260px; max-width: 360px"
          />
          <v-select
            v-model="queryKey"
            :items="queryItems"
            item-title="title"
            item-value="value"
            label="Запрос"
            density="compact"
            variant="outlined"
            hide-details
            style="min-width: 320px; flex: 1"
          />
          <v-btn color="primary" :loading="loading" :disabled="!fragmentId || !queryKey" @click="run">
            Выполнить
          </v-btn>
        </div>

        <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-3">
          {{ error }}
        </v-alert>

        <template v-if="result">
          <div class="d-flex flex-wrap align-center ga-2 mb-2">
            <span class="text-subtitle-1">{{ result.title }}</span>
            <v-chip size="small" variant="tonal">{{ result.count }}</v-chip>
            <v-chip v-if="result.calculation_id" size="small" variant="tonal" color="primary">
              Расчёт №{{ result.calculation_id }}<template v-if="result.tn != null">, Tн {{ result.tn }} °C</template>
            </v-chip>
          </div>
          <p v-if="result.note" class="text-caption text-medium-emphasis mb-2">{{ result.note }}</p>

          <v-alert
            v-if="result.query === 'hydrostatic_zones' && result.full_static_head_m != null"
            type="info"
            variant="tonal"
            density="compact"
            class="mb-3"
          >
            Полный статический напор <strong>{{ formatNum(result.full_static_head_m) }} м</strong>,
            пьезометрический статический напор <strong>{{ formatNum(result.piezometric_static_head_m) }} м</strong>.
            Минимальная отметка верха трубы {{ formatNum(result.min_geo_mark_m) }} м
            (узел {{ result.min_geo_node?.code }} {{ result.min_geo_node?.name }}).
            Ниже — узлы нижней зоны.
          </v-alert>

          <div v-if="summaryChips.length" class="d-flex flex-wrap ga-1 mb-2">
            <v-chip
              v-for="chip in summaryChips"
              :key="chip.mode"
              size="small"
              :color="modeFilter === chip.mode ? 'primary' : undefined"
              :variant="modeFilter === chip.mode ? 'flat' : 'tonal'"
              @click="modeFilter = modeFilter === chip.mode ? null : chip.mode"
            >
              {{ chip.mode }}: {{ chip.count }}
            </v-chip>
          </div>

          <div class="ra-scroll">
            <table class="ra-table">
              <thead>
                <tr>
                  <th />
                  <th v-for="col in columns" :key="col.key">{{ col.title }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, idx) in pagedRows"
                  :key="idx"
                  :class="{ 'ra-row--clickable': hasCoords(row) }"
                  @click="locate(row)"
                >
                  <td>
                    <v-icon v-if="hasCoords(row)" size="16" color="primary">mdi-crosshairs-gps</v-icon>
                  </td>
                  <td v-for="col in columns" :key="col.key">{{ formatCell(row[col.key]) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="filteredRows.length > pageSize" class="d-flex justify-center mt-2">
            <v-pagination v-model="page" :length="Math.ceil(filteredRows.length / pageSize)" density="compact" total-visible="7" />
          </div>
          <div v-if="!filteredRows.length" class="text-body-2 text-medium-emphasis mt-2">Записей нет.</div>
        </template>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMobile } from '~/composables/useMobile'
import { fastApiService, type RegimeAnalysisKind, type RegimeAnalysisResult } from '~/services/fastApiService'
import { useFragmentStore } from '~/stores/fragmentStore'

const emit = defineEmits<{ (e: 'locate', point: { lat: number; lng: number }): void }>()

const { isMobile } = useMobile()
const fragmentStore = useFragmentStore()
const visible = ref(false)
const loading = ref(false)
const error = ref('')
const result = ref<RegimeAnalysisResult | null>(null)
const fragmentId = ref<number | null>(null)
const queryKey = ref<string>('negative-dp')
const modeFilter = ref<string | null>(null)
const page = ref(1)
const pageSize = 100
const admissibility = ref<{ id: number; title: string }[]>([])

interface Column { key: string; title: string }

// Запросы gid6 «Анализ» и колонки их результатов
const REGIME: Record<string, { title: string; kind: RegimeAnalysisKind; uncalculated?: boolean; columns: Column[] }> = {
  'negative-dp': {
    title: 'Отрицательные перепады',
    kind: 'negative-dp',
    columns: [
      { key: 'code', title: 'Код' }, { key: 'name', title: 'Узел' },
      { key: 'pih_supply', title: 'Напор подача, м' }, { key: 'pih_return', title: 'Напор обратка, м' },
      { key: 'dp', title: 'Перепад, м' },
    ],
  },
  airlock: {
    title: 'Завоздушивание',
    kind: 'airlock',
    columns: [
      { key: 'code', title: 'Код' }, { key: 'name', title: 'Узел' }, { key: 'consumer', title: 'Потребитель' },
      { key: 'scheme', title: 'Схема' }, { key: 'building_height', title: 'Высота здания, м' },
      { key: 'pih_supply', title: 'Напор подача, м' }, { key: 'shortfall', title: 'Недостаток, м' },
    ],
  },
  'low-temperature': {
    title: 'Низкие температуры',
    kind: 'low-temperature',
    columns: [
      { key: 'code', title: 'Код' }, { key: 'name', title: 'Узел' }, { key: 'consumer', title: 'Потребитель' },
      { key: 't_supply', title: 't подачи, °C' }, { key: 't2_graph', title: 't2 графика, °C' },
      { key: 'no_flow', title: 'Нет расхода' },
    ],
  },
  'closed-sections': {
    title: 'Закрытые участки',
    kind: 'closed-sections',
    columns: SECTION_COLUMNS(),
  },
  'disconnected-sections': {
    title: 'Отключенные участки',
    kind: 'closed-sections',
    uncalculated: true,
    columns: SECTION_COLUMNS(),
  },
  'hydrostatic-zones': {
    title: 'Гидростатические зоны',
    kind: 'hydrostatic-zones',
    columns: [
      { key: 'code', title: 'Код' }, { key: 'name', title: 'Узел' },
      { key: 'geo_mark', title: 'Отметка верха трубы, м' }, { key: 'building_height', title: 'Высота здания, м' },
    ],
  },
}

function SECTION_COLUMNS(): Column[] {
  return [
    { key: 'state', title: 'Состояние' },
    { key: 'code1', title: 'Код нач.' }, { key: 'name1', title: 'Начальный узел' },
    { key: 'code2', title: 'Код кон.' }, { key: 'name2', title: 'Конечный узел' },
    { key: 'sign', title: 'П/О' }, { key: 'length_m', title: 'Длина, м' },
    { key: 'diameter_mm', title: 'Dвн, мм' }, { key: 'heat_source', title: 'Источник' },
    { key: 'owner', title: 'Владелец' },
  ]
}

const queryItems = computed(() => [
  ...Object.entries(REGIME).map(([value, q]) => ({ value, title: q.title })),
  ...admissibility.value.map((a) => ({ value: `adm-${a.id}`, title: `Анализ режима: ${a.title}` })),
])

const fragmentItems = computed(() =>
  fragmentStore.fragments.map((f: { id: number; name?: string }) => ({
    value: f.id,
    title: f.name ? `${f.name} (#${f.id})` : `Фрагмент #${f.id}`,
  })),
)

const columns = computed<Column[]>(() => {
  const r = result.value
  if (!r) return []
  if (r.columns) {
    return r.columns.filter((c) => !c.startsWith('_')).map((c) => ({ key: c, title: c }))
  }
  return REGIME[queryKey.value]?.columns ?? []
})

const summaryChips = computed(() =>
  Object.entries(result.value?.summary || {}).map(([mode, count]) => ({ mode, count })),
)

const filteredRows = computed(() => {
  const items = result.value?.items || []
  const col = result.value?.mode_column
  if (!modeFilter.value || !col) return items
  return items.filter((i) => String(i[col]) === modeFilter.value)
})

const pagedRows = computed(() => filteredRows.value.slice((page.value - 1) * pageSize, page.value * pageSize))

watch([modeFilter, result], () => { page.value = 1 })

const formatNum = (v: number | null | undefined) =>
  v == null || Number.isNaN(Number(v))
    ? '—'
    : new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(v))

const formatCell = (v: unknown) => {
  if (v == null || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'да' : ''
  if (typeof v === 'number') return formatNum(v)
  return String(v)
}

const hasCoords = (row: Record<string, any>) => row.latitude != null && row.longitude != null

const locate = (row: Record<string, any>) => {
  if (hasCoords(row)) emit('locate', { lat: row.latitude, lng: row.longitude })
}

const run = async () => {
  if (!fragmentId.value || !queryKey.value) return
  loading.value = true
  error.value = ''
  result.value = null
  modeFilter.value = null
  try {
    if (queryKey.value.startsWith('adm-')) {
      result.value = await fastApiService.getAdmissibility(Number(queryKey.value.slice(4)), fragmentId.value)
    } else {
      const q = REGIME[queryKey.value]
      result.value = await fastApiService.getRegimeAnalysis(q.kind, fragmentId.value, {
        includeUncalculated: q.uncalculated,
      })
    }
  } catch (e: any) {
    error.value = e?.data?.detail || e?.message || String(e)
  } finally {
    loading.value = false
  }
}

const openDialog = async () => {
  visible.value = true
  error.value = ''
  if (fragmentId.value == null) {
    fragmentId.value = fragmentStore.selectedFragmentId
      ?? (fragmentStore.visibleFragments.length === 1 ? [...fragmentStore.visibleFragments][0] : null)
  }
  if (!admissibility.value.length) {
    try {
      admissibility.value = await fastApiService.getAdmissibilityCatalog()
    } catch {
      // каталог — только для списка запросов; основные запросы работают и без него
    }
  }
}

defineExpose({ openDialog })
</script>

<style scoped>
.ra-scroll { overflow-x: auto; max-height: 60vh; }
.ra-table { width: 100%; border-collapse: collapse; font-size: .82rem; }
.ra-table th, .ra-table td { text-align: left; padding: 5px 8px; border-bottom: 1px solid #eceff1; white-space: nowrap; }
.ra-table th { background: #eceff1; color: #546e7a; position: sticky; top: 0; z-index: 1; }
.ra-row--clickable { cursor: pointer; }
.ra-row--clickable:hover { background: rgba(33, 150, 243, .08); }
</style>
