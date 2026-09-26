<template>
  <v-dialog v-model="visible" :fullscreen="isMobile" max-width="720" scrollable>
    <v-card rounded="lg">
      <v-card-title class="d-flex align-center ga-2">
        <v-icon>mdi-sigma</v-icon>
        Запросы по сети
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" @click="visible = false" />
      </v-card-title>
      <v-card-text>
        <p class="text-body-2 text-medium-emphasis mb-3">
          Аналог desktop «Запросы» (Zap1–Zap7). По умолчанию — видимые фрагменты карты.
        </p>
        <v-chip
          v-if="scopeLabel"
          size="small"
          class="mb-3"
          color="primary"
          variant="tonal"
        >
          {{ scopeLabel }}
        </v-chip>
        <v-chip
          v-else
          size="small"
          class="mb-3"
          color="warning"
          variant="tonal"
        >
          Фрагмент не выбран — вся сеть (может быть медленно)
        </v-chip>

        <div class="d-flex flex-wrap ga-2 mb-4">
          <v-btn
            color="primary"
            variant="tonal"
            :loading="loading === 'volume'"
            @click="run('volume')"
          >
            Объём (Zap1)
          </v-btn>
          <v-btn
            color="primary"
            variant="tonal"
            :loading="loading === 'length'"
            @click="run('length')"
          >
            Длина (Zap2)
          </v-btn>
          <v-btn
            color="primary"
            variant="tonal"
            :loading="loading === 'diameter'"
            @click="run('diameter')"
          >
            По диаметрам (Zap7)
          </v-btn>
          <v-btn
            color="primary"
            variant="tonal"
            :loading="loading === 'laying'"
            @click="run('laying')"
          >
            Диаметры и прокладка (Zap7_1)
          </v-btn>
          <v-btn
            color="primary"
            variant="tonal"
            :loading="loading === 'heat'"
            @click="run('heat')"
          >
            Теплопотребление (Zap3)
          </v-btn>
          <v-btn
            color="primary"
            variant="tonal"
            :loading="loading === 'heat-closed'"
            @click="run('heat-closed')"
          >
            Закрытые системы (Zap4)
          </v-btn>
          <v-btn
            color="primary"
            variant="tonal"
            :loading="loading === 'heat-open'"
            @click="run('heat-open')"
          >
            Открытые системы (Zap5)
          </v-btn>
        </div>

        <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-3">
          {{ error }}
        </v-alert>

        <template v-if="result">
          <div class="text-subtitle-1 mb-2">{{ result.title }}</div>
          <div v-if="result.query === 'volume'" class="text-h6">
            {{ formatNum(result.volume_m3) }} м³
          </div>
          <div v-else-if="result.query === 'length'" class="text-body-1">
            Всего: <strong>{{ formatNum(result.length_total_m) }}</strong> м<br>
            Подача: {{ formatNum(result.length_supply_m) }} м ·
            Обратка: {{ formatNum(result.length_return_m) }} м
          </div>
          <div v-else-if="result.query === 'length_by_diameter'">
            <div class="mb-2">Итого: <strong>{{ formatNum(result.total_length_m) }}</strong> м</div>
            <table class="nq-table">
              <thead>
                <tr><th>Øусл</th><th>Длина, м</th></tr>
              </thead>
              <tbody>
                <tr v-for="row in result.items || []" :key="String(row.diameter_condit)">
                  <td>{{ row.diameter_condit ?? '—' }}</td>
                  <td>{{ formatNum(row.length_m) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else-if="result.query === 'length_by_diameter_and_laying'">
            <div class="mb-2">Итого: <strong>{{ formatNum(result.total_length_m) }}</strong> м</div>
            <div class="nq-scroll">
              <table class="nq-table">
                <thead>
                  <tr>
                    <th>Øусл</th>
                    <th v-for="col in result.columns || []" :key="col.key">{{ col.title }}</th>
                    <th>Всего, м</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in result.items || []" :key="String(row.diameter_condit)">
                    <td>{{ row.diameter_condit ?? '—' }}</td>
                    <td v-for="col in result.columns || []" :key="col.key">{{ formatNum(row.lengths?.[col.key] ?? 0) }}</td>
                    <td><strong>{{ formatNum(row.total_m) }}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div v-else-if="String(result.query).startsWith('heat_consumption')">
            <p class="text-caption text-medium-emphasis mb-2">
              {{ result.note }}<template v-if="result.consumers != null"> · потребителей: {{ result.consumers }}</template>
            </p>
            <table class="nq-table">
              <thead>
                <tr><th>Показатель, Гкал/ч</th><th>Задано</th><th>Получено</th></tr>
              </thead>
              <tbody>
                <tr v-for="row in heatRows" :key="row.key">
                  <td>{{ row.label }}</td>
                  <td>{{ formatNum(row.given) }}</td>
                  <td>{{ formatNum(row.received) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMobile } from '~/composables/useMobile'
import { fastApiService } from '~/services/fastApiService'
import { useFragmentStore } from '~/stores/fragmentStore'

const { isMobile } = useMobile()
const fragmentStore = useFragmentStore()
const visible = ref(false)
const loading = ref<string | null>(null)
const error = ref('')
const result = ref<any>(null)

const fragmentIds = computed(() => {
  if (fragmentStore.selectedFragmentId != null) return [fragmentStore.selectedFragmentId]
  return [...fragmentStore.visibleFragments]
})

const scopeLabel = computed(() => {
  const ids = fragmentIds.value
  if (!ids.length) return ''
  if (ids.length === 1) {
    const name = fragmentStore.fragments.find((f) => f.id === ids[0])?.name
    return name ? `Фрагмент: ${name}` : `Фрагмент #${ids[0]}`
  }
  return `Фрагменты: ${ids.join(', ')}`
})

const formatNum = (v: number | null | undefined) =>
  v == null || Number.isNaN(Number(v))
    ? '—'
    : new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 }).format(Number(v))

// Итоги теплопотребления: n_* — заданная нагрузка, q_* — полученная по расчёту (desktop ITOG)
const HEAT_ROWS = [
  { key: 'otz', label: 'Отопление, зависимые системы' },
  { key: 'otn', label: 'Отопление, независимые системы' },
  { key: 'vn', label: 'Вентиляция' },
  { key: 'gvop', label: 'ГВС открытое из подачи' },
  { key: 'gvoo', label: 'ГВС открытое из обратки' },
  { key: 'rez', label: 'Рециркуляция открытого ГВС' },
  { key: 'gvz', label: 'ГВС закрытое' },
]
const heatRows = computed(() => {
  const totals = result.value?.totals || {}
  return HEAT_ROWS.map((r) => ({ ...r, given: totals[`n_${r.key}`], received: totals[`q_${r.key}`] }))
})

type QueryKind = 'volume' | 'length' | 'diameter' | 'laying' | 'heat' | 'heat-closed' | 'heat-open'

const run = async (kind: QueryKind) => {
  loading.value = kind
  error.value = ''
  result.value = null
  try {
    const ids = fragmentIds.value
    if (kind === 'volume') result.value = await fastApiService.getNetworkQueryVolume(ids)
    else if (kind === 'length') result.value = await fastApiService.getNetworkQueryLength(ids)
    else if (kind === 'diameter') result.value = await fastApiService.getNetworkQueryLengthByDiameter(ids)
    else if (kind === 'laying') result.value = await fastApiService.getNetworkQueryLengthByDiameterLaying(ids)
    else if (kind === 'heat-closed') result.value = await fastApiService.getNetworkQueryHeatConsumption(ids, 'closed')
    else if (kind === 'heat-open') result.value = await fastApiService.getNetworkQueryHeatConsumption(ids, 'open')
    else result.value = await fastApiService.getNetworkQueryHeatConsumption(ids)
  } catch (e: any) {
    error.value = e?.message || String(e)
  } finally {
    loading.value = null
  }
}

const openDialog = () => {
  visible.value = true
  error.value = ''
  result.value = null
}

defineExpose({ openDialog })
</script>

<style scoped>
.nq-table { width: 100%; border-collapse: collapse; font-size: .85rem; }
.nq-table th, .nq-table td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eceff1; }
.nq-table th { background: #eceff1; color: #546e7a; }
.nq-scroll { overflow-x: auto; }
</style>
