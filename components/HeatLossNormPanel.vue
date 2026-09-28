<template>
  <div class="norm-panel">
    <div class="norm-filters pa-3">
      <v-select
        v-model="seasonId"
        :items="seasonItems"
        item-title="title"
        item-value="value"
        label="Отопительный сезон"
        density="compact"
        variant="outlined"
        hide-details
      />
      <v-select
        v-model="fragmentId"
        :items="fragments"
        item-title="name"
        item-value="id"
        label="Фрагмент («по фрагменту» десктопа)"
        density="compact"
        variant="outlined"
        clearable
        hide-details
      />
      <v-btn
        color="deep-orange-darken-3"
        variant="tonal"
        :loading="scopeLoading"
        :disabled="!seasonId"
        prepend-icon="mdi-format-list-checks"
        @click="loadScope"
      >
        Источники
      </v-btn>
      <v-btn
        v-if="authStore.canRunWritingCalc"
        color="deep-orange-darken-3"
        :loading="running"
        :disabled="!seasonId || !readyCount"
        prepend-icon="mdi-play"
        @click="runCalculation"
      >
        Рассчитать
      </v-btn>
    </div>

    <div class="norm-body">
      <section v-if="scope" class="mb-4">
        <h4 class="section-title">
          Источники расчёта
          <span class="text-medium-emphasis">· готовы {{ readyCount }} из {{ scope.sources.length }}</span>
        </h4>
        <table class="norm-table">
          <thead>
            <tr>
              <th>ID</th><th>Источник</th><th>Участков</th><th>Длина труб, м</th><th>Темп. график</th>
              <th>Условия работы</th><th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="src in scope.sources" :key="src.id">
              <td>{{ src.id }}</td>
              <td>{{ src.name || src.sourcename || '—' }}</td>
              <td>{{ src.sections }}</td>
              <td>{{ fmt(src.pipe_length, 0) }}</td>
              <td>
                <v-icon :color="src.has_temp_graph ? 'green' : 'grey'">
                  {{ src.has_temp_graph ? 'mdi-check-circle' : 'mdi-minus-circle-outline' }}
                </v-icon>
              </td>
              <td>
                <v-chip size="x-small" :color="src.has_months ? 'green' : 'orange'">
                  {{ src.has_months ? 'заданы' : 'нет — источник не считается' }}
                </v-chip>
              </td>
              <td class="text-right">
                <v-btn
                  v-if="authStore.canEditData"
                  size="x-small"
                  variant="text"
                  color="deep-orange-darken-3"
                  :loading="preparing === src.id"
                  :disabled="!src.has_temp_graph"
                  @click="prepareConditions(src.id)"
                >
                  {{ src.has_months ? 'Пересчитать условия' : 'Задать условия работы' }}
                </v-btn>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="hint mt-1">
          «Условия работы» (как у десктопа): месяцы сезона с температурами воздуха, подвала и грунта из
          климата сезона и температурами сетевой воды по развёрнутому графику источника. Температура
          подпитки сохраняется прежняя, у нового источника — 0.
        </div>
      </section>

      <section class="mb-4">
        <h4 class="section-title">
          Расчёты
          <v-btn size="x-small" variant="text" icon="mdi-refresh" aria-label="Обновить" @click="loadRuns" />
        </h4>
        <table class="norm-table">
          <thead>
            <tr>
              <th>№</th><th>Расчёт</th><th>Дата</th><th>Автор</th><th>Через изоляцию за год, Гкал</th>
              <th>Всего с утечкой, Гкал</th><th />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in runs"
              :key="item.id"
              :class="{ active: run?.id === item.id }"
              @click="openRun(item.id)"
            >
              <td>{{ item.id }}</td>
              <td>{{ item.name }}</td>
              <td>{{ fmtDate(item.calculated_at) }}</td>
              <td>{{ item.user_gid || '—' }}</td>
              <td>{{ fmt(item.params.totals?.year?.potall, 1) }}</td>
              <td>{{ fmt(item.params.totals?.year?.vall, 1) }}</td>
              <td class="text-right" @click.stop>
                <v-btn
                  size="x-small"
                  variant="text"
                  icon="mdi-microsoft-excel"
                  aria-label="Excel"
                  :loading="exporting === item.id"
                  @click="downloadExcel(item.id)"
                />
                <v-btn
                  v-if="authStore.canRunWritingCalc"
                  size="x-small"
                  variant="text"
                  color="error"
                  icon="mdi-delete-outline"
                  aria-label="Удалить расчёт"
                  @click="removeRun(item.id)"
                />
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="!runs.length" class="hint">Расчётов нормативных теплопотерь нет</div>
      </section>

      <section v-if="run">
        <h4 class="section-title">{{ run.name }}</h4>
        <v-tabs v-model="view" density="compact" color="deep-orange-darken-3" class="mb-2">
          <v-tab value="totals">Итоги</v-tab>
          <v-tab value="avg_month_loses">МесПотери</v-tab>
          <v-tab value="avg_year_loses">ГодПотери</v-tab>
          <v-tab value="winter_norms">НормыЗима</v-tab>
          <v-tab value="summer_norms">НормыЛето</v-tab>
          <v-tab value="material_characteristics">МатХар</v-tab>
          <v-tab value="month_temperatures">МесТемп</v-tab>
          <v-tab value="sections">Участки</v-tab>
        </v-tabs>

        <div v-if="view === 'totals'" class="table-scroll">
          <table class="norm-table">
            <thead>
              <tr>
                <th>Источник / период</th><th>Надз. подающий</th><th>Надз. обратный</th><th>Подземная</th>
                <th>Через изоляцию</th><th>С утечкой</th><th>Всего</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="(tot, hs) in run.source_totals" :key="hs">
                <tr v-for="period in periods" :key="`${hs}-${period.key}`">
                  <td>{{ sourceName(Number(hs)) }}: {{ period.label }}</td>
                  <td v-for="k in lossKeys" :key="k">{{ fmt(tot[period.key][k], 2) }}</td>
                </tr>
              </template>
              <tr v-for="period in periods" :key="`all-${period.key}`" class="total-row">
                <td>ВСЕГО: {{ period.label }}</td>
                <td v-for="k in lossKeys" :key="k">{{ fmt(run.totals?.[period.key]?.[k], 2) }}</td>
              </tr>
            </tbody>
          </table>
          <div class="hint mt-1">
            Гкал за период: среднемесячные часовые потери × сутки работы × 24 (лист «ГодПотери» десктопа).
            Участков: {{ run.section_counts.lines || 0 }}, длина труб {{ fmt(run.section_counts.length, 0) }} м.
          </div>
        </div>

        <div v-else-if="view === 'sections'">
          <div class="d-flex ga-2 align-center mb-2">
            <v-select
              v-model="sectionSource"
              :items="run.sources"
              :item-title="(s: any) => `${s.name || s.sourcename} (№${s.id})`"
              item-value="id"
              label="Источник"
              density="compact"
              variant="outlined"
              clearable
              hide-details
              style="max-width: 320px"
              @update:model-value="loadSections(1)"
            />
            <span class="text-medium-emphasis">строк {{ sectionTotal }}</span>
          </div>
          <div class="table-scroll">
            <table class="norm-table">
              <thead>
                <tr>
                  <th>Участок</th><th>Труба</th><th>Прокл.</th><th>Dвн</th><th>Ду</th><th>Длина, м</th>
                  <th>Класс</th><th>K</th><th>β</th><th>q ср.год, ккал/(м·ч)</th><th>Гкал/ч</th><th>Гкал/год</th><th />
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in sections" :key="s.id">
                  <td>{{ s.lineid }}</td>
                  <td>{{ s.truba === 1 ? 'под.' : 'обр.' }}</td>
                  <td>{{ s.name_typ }}</td>
                  <td>{{ fmt(s.diametr, 0) }}</td>
                  <td>{{ fmt(s.diametr_usl, 0) }}</td>
                  <td>{{ fmt(s.dlina, 1) }}</td>
                  <td>{{ s.year }}</td>
                  <td>{{ fmt(s.kti, 2) }}</td>
                  <td>{{ fmt(s.beta, 2) }}</td>
                  <td>{{ fmt(s.q, 2) }}</td>
                  <td>{{ fmt(s.loss_gcal_h, 4) }}</td>
                  <td>{{ fmt(s.loss_gcal_year, 2) }}</td>
                  <td>
                    <v-btn
                      v-if="s.longitude != null && s.latitude != null"
                      size="x-small"
                      variant="text"
                      icon="mdi-crosshairs-gps"
                      aria-label="На карте"
                      @click="emit('locate', { longitude: Number(s.longitude), latitude: Number(s.latitude), id: s.lineid, nodeId: Number(s.nodeid1 || 0), label: `Участок ${s.lineid}: ${fmt(s.loss_gcal_year, 1)} Гкал/год` })"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <v-pagination
            v-if="sectionPages > 1"
            v-model="sectionPage"
            :length="sectionPages"
            density="compact"
            :total-visible="7"
            @update:model-value="loadSections"
          />
        </div>

        <div v-else class="table-scroll">
          <table class="norm-table">
            <thead>
              <tr>
                <th>Источник</th>
                <th v-for="col in sheetColumns" :key="col.key">{{ col.label }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in sheetRows" :key="i">
                <td>{{ sourceName(Number(row.heatsourceid)) }}</td>
                <td v-for="col in sheetColumns" :key="col.key">
                  {{ typeof row[col.key] === 'number' ? fmt(row[col.key], col.digits ?? 3) : row[col.key] ?? '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/authStore'
import {
  fastApiService,
  type HeatLossNormRun,
  type HeatLossNormRunSummary,
  type HeatLossNormScope,
  type HeatLossNormSection,
} from '~/services/fastApiService'

const props = defineProps<{
  seasons: { id: number; d1?: string | null; d2?: string | null; city?: string | null; [key: string]: any }[]
  fragments: { id: number; name: string }[]
}>()
const emit = defineEmits<{
  locate: [payload: { longitude: number; latitude: number; id: number; nodeId: number; label: string }]
}>()

const authStore = useAuthStore()
const seasonId = ref<number | null>(null)
const fragmentId = ref<number | null>(null)
const scope = ref<HeatLossNormScope | null>(null)
const scopeLoading = ref(false)
const running = ref(false)
const preparing = ref<number | null>(null)
const exporting = ref<number | null>(null)
const runs = ref<HeatLossNormRunSummary[]>([])
const run = ref<HeatLossNormRun | null>(null)
const view = ref('totals')
const sections = ref<HeatLossNormSection[]>([])
const sectionPage = ref(1)
const sectionTotal = ref(0)
const sectionSource = ref<number | null>(null)
const SECTION_PAGE_SIZE = 50

const seasonItems = computed(() => props.seasons.map((s) => ({
  value: s.id,
  title: `${fmtDate(s.d1)} — ${fmtDate(s.d2)}${s.city ? ` · ${s.city}` : ''} (№${s.id})`,
})))
const readyCount = computed(() => scope.value?.sources.filter((s) => s.has_months).length ?? 0)
const sectionPages = computed(() => Math.ceil(sectionTotal.value / SECTION_PAGE_SIZE))
const periods = [
  { key: 'heating', label: 'отопительный' },
  { key: 'summer', label: 'летний' },
  { key: 'year', label: 'год' },
] as const
const lossKeys = ['potnp', 'potno', 'potpodz', 'potall', 'v1', 'vall'] as const

type Col = { key: string; label: string; digits?: number }
const SHEETS: Record<string, Col[]> = {
  avg_month_loses: [
    { key: 'monthname', label: 'Месяц' }, { key: 'potnp', label: 'Надз. под., Гкал/ч' },
    { key: 'potno', label: 'Надз. обр., Гкал/ч' }, { key: 'potpodz', label: 'Подземная' },
    { key: 'potall', label: 'Через изоляцию' }, { key: 'v1', label: 'С утечкой' }, { key: 'vall', label: 'Суммарные' },
  ],
  avg_year_loses: [
    { key: 'monthname', label: 'Месяц' }, { key: 'potnp', label: 'Надз. под., Гкал', digits: 2 },
    { key: 'potno', label: 'Надз. обр., Гкал', digits: 2 }, { key: 'potpodz', label: 'Подземная', digits: 2 },
    { key: 'potall', label: 'Через изоляцию', digits: 2 }, { key: 'v1', label: 'С утечкой', digits: 2 },
    { key: 'vall', label: 'Всего', digits: 2 },
  ],
  winter_norms: [
    { key: 'typnet1', label: 'Сеть' }, { key: 'a5000', label: 'Класс' }, { key: 'diametercondit', label: 'Ду', digits: 0 },
    { key: 'lennp', label: 'Надз. L под.', digits: 1 }, { key: 'lenno', label: 'Надз. L обр.', digits: 1 },
    { key: 'qnp', label: 'q под.', digits: 2 }, { key: 'qno', label: 'q обр.', digits: 2 },
    { key: 'potnp', label: 'ТП под., ккал/ч', digits: 1 }, { key: 'potno', label: 'ТП обр., ккал/ч', digits: 1 },
    { key: 'lenkp', label: 'Канал. L', digits: 1 }, { key: 'qk', label: 'q канал.', digits: 2 },
    { key: 'lenbp', label: 'Бесканал. L', digits: 1 }, { key: 'qb', label: 'q бесканал.', digits: 2 },
    { key: 'potp', label: 'ТП подз., ккал/ч', digits: 1 },
  ],
  material_characteristics: [
    { key: 'typnet1', label: 'Сеть' }, { key: 'diameterexternal', label: 'Dн', digits: 0 },
    { key: 'lenp_n', label: 'Надз. под., м', digits: 1 }, { key: 'leno_n', label: 'Надз. обр., м', digits: 1 },
    { key: 'lenpodzp', label: 'Подз. под., м', digits: 1 }, { key: 'lenpodzo', label: 'Подз. обр., м', digits: 1 },
    { key: 'lenall', label: 'Всего, м', digits: 1 }, { key: 'len_tr', label: 'По трассе, м', digits: 1 },
    { key: 'm', label: 'М, м²', digits: 1 }, { key: 'vv', label: 'Ёмкость, м³', digits: 2 },
  ],
  month_temperatures: [
    { key: 'm1', label: 'Месяц' }, { key: 'sezon1', label: 'Период' }, { key: 'tn', label: 'tн', digits: 1 },
    { key: 'tpod', label: 'tподв', digits: 1 }, { key: 'tgr', label: 'tгр', digits: 1 },
    { key: 'tgp', label: 't1', digits: 1 }, { key: 'tgo', label: 't2', digits: 1 }, { key: 'tx', label: 'tподп', digits: 1 },
    { key: 'workcount', label: 'Суток', digits: 0 },
  ],
}
SHEETS.summer_norms = SHEETS.winter_norms
const sheetColumns = computed(() => SHEETS[view.value] || [])
const sheetRows = computed(() => (run.value?.sheets?.[view.value] || []) as Record<string, any>[])

function fmt(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—'
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits }).format(Number(value))
}
function fmtDate(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('ru-RU').format(new Date(value)) : '—'
}
function sourceName(id: number) {
  const s = run.value?.sources.find((x) => x.id === id)
  return s ? `${s.name || s.sourcename} (№${id})` : `№${id}`
}
const notify = () => useNotificationStore()

async function loadScope() {
  if (!seasonId.value) return
  scopeLoading.value = true
  try {
    scope.value = await fastApiService.getHeatLossNormScope(seasonId.value, fragmentId.value)
  } catch (err: any) {
    notify().showError(err?.message || 'Не удалось получить источники')
  } finally {
    scopeLoading.value = false
  }
}

async function prepareConditions(sourceId: number) {
  if (!seasonId.value) return
  preparing.value = sourceId
  try {
    const res = await fastApiService.prepareHeatLossWorkConditions(sourceId, { season_id: seasonId.value })
    notify().showSuccess(`Условия работы источника №${sourceId}: ${res.months.length} строк`)
    await loadScope()
  } catch (err: any) {
    notify().showError(err?.message || 'Не удалось задать условия работы')
  } finally {
    preparing.value = null
  }
}

async function loadRuns() {
  try {
    runs.value = (await fastApiService.getHeatLossNormResults({ fragment_id: fragmentId.value, limit: 50 })).items
  } catch (err: any) {
    notify().showError(err?.message || 'Не удалось получить список расчётов')
  }
}

async function openRun(id: number) {
  try {
    run.value = await fastApiService.getHeatLossNormResult(id)
    view.value = 'totals'
    sectionSource.value = null
    sections.value = []
    sectionTotal.value = 0
  } catch (err: any) {
    notify().showError(err?.message || 'Не удалось открыть расчёт')
  }
}

async function loadSections(page = 1) {
  if (!run.value) return
  sectionPage.value = page
  const res = await fastApiService.getHeatLossNormSections(run.value.id, {
    heat_source_id: sectionSource.value, page, page_size: SECTION_PAGE_SIZE,
  })
  sections.value = res.items
  sectionTotal.value = res.total
}

watch(view, (value) => { if (value === 'sections' && !sections.value.length) loadSections(1) })
watch(fragmentId, () => { scope.value = null; loadRuns() })

async function runCalculation() {
  if (!seasonId.value) return
  running.value = true
  try {
    const { task_id: taskId } = await fastApiService.runHeatLossNorm({
      season_id: seasonId.value, fragment_id: fragmentId.value,
    })
    for (let i = 0; i < 300; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      const st = await fastApiService.getTaskStatus(taskId)
      if (st.status === 'SUCCESS') {
        const result = st.result || {}
        if (result.status !== 'success') {
          notify().showError(result.error || 'Ошибка расчёта теплопотерь')
          return
        }
        notify().showSuccess(`Теплопотери рассчитаны: расчёт №${result.calculation_id}`)
        await loadRuns()
        if (result.calculation_id) await openRun(result.calculation_id)
        return
      }
      if (st.status === 'FAILURE') {
        notify().showError(st.error || 'Ошибка расчёта теплопотерь')
        return
      }
    }
    notify().showError('Таймаут ожидания расчёта теплопотерь')
  } catch (err: any) {
    notify().showError(err?.message || 'Не удалось запустить расчёт')
  } finally {
    running.value = false
  }
}

async function downloadExcel(id: number) {
  exporting.value = id
  try {
    const { blob, filename } = await fastApiService.downloadHeatLossNormExcel(id)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  } catch (err: any) {
    notify().showError(err?.message || 'Не удалось выгрузить Excel')
  } finally {
    exporting.value = null
  }
}

async function removeRun(id: number) {
  if (!window.confirm(`Удалить расчёт теплопотерь №${id}?`)) return
  try {
    await fastApiService.deleteCalculation(id)
    if (run.value?.id === id) run.value = null
    await loadRuns()
  } catch (err: any) {
    notify().showError(err?.message || 'Не удалось удалить расчёт')
  }
}

async function init() {
  if (!seasonId.value && props.seasons.length) seasonId.value = props.seasons[0].id
  await loadRuns()
}
defineExpose({ init })
</script>

<style scoped>
.norm-panel { display: flex; flex-direction: column; min-height: 0; height: 100%; }
.norm-filters { display: grid; grid-template-columns: minmax(260px, 1.4fr) minmax(220px, 1fr) auto auto; gap: 12px; align-items: center; background: #fff3e0; }
.norm-body { overflow: auto; padding: 12px; flex: 1; min-height: 0; }
.section-title { color: #bf360c; margin-bottom: 6px; }
.norm-table { width: 100%; border-collapse: collapse; font-size: .82rem; }
.norm-table th { position: sticky; top: 0; background: #fff3e0; color: #bf360c; padding: 6px 8px; text-align: left; white-space: nowrap; }
.norm-table td { padding: 6px 8px; border-bottom: 1px solid #eceff1; }
.norm-table tbody tr { cursor: pointer; }
.norm-table tbody tr:hover, .norm-table tr.active { background: #fff8e1; }
.total-row td { font-weight: 600; }
.table-scroll { overflow: auto; max-height: 520px; }
.hint { color: #78909c; font-size: .78rem; }
@media (max-width: 900px) { .norm-filters { grid-template-columns: 1fr; } }
</style>
