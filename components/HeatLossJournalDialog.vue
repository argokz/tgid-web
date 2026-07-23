<template>
  <v-dialog
    v-model="visible"
    :fullscreen="isMobile"
    max-width="1500"
    scrollable
  >
    <v-card
      class="heat-loss-journal"
      :rounded="isMobile ? 0 : 'lg'"
    >
      <v-toolbar
        color="deep-orange-darken-3"
        density="compact"
      >
        <v-icon class="ml-3 mr-2">
          mdi-heat-wave
        </v-icon>
        <v-toolbar-title>Тепловые потери</v-toolbar-title>
        <v-chip
          class="mr-2"
          size="small"
          color="white"
          variant="outlined"
        >
          {{ lookups.season_counts.total || 0 }} сезона
        </v-chip>
        <v-chip
          class="mr-2"
          size="small"
          color="white"
          variant="outlined"
        >
          {{ lookups.source_counts.ready || 0 }}/{{ lookups.source_counts.total || 0 }} источников готовы
        </v-chip>
        <v-btn
          icon="mdi-close"
          aria-label="Закрыть"
          @click="visible = false"
        />
      </v-toolbar>

      <v-alert
        v-if="lookups.result_availability.calculation_count === 0"
        type="info"
        variant="tonal"
        density="compact"
        class="ma-3 mb-0"
        icon="mdi-information-outline"
      >
        В БД пока нет сохранённых результатов расчёта UT_OUT. Журнал показывает реальные сезоны и готовность исходных данных desktop-калькулятора.
      </v-alert>

      <v-tabs
        v-model="activeTab"
        color="deep-orange-darken-3"
        @update:model-value="loadActiveTab"
      >
        <v-tab value="seasons">
          Отопительные сезоны
        </v-tab>
        <v-tab value="sources">
          Источники и готовность
        </v-tab>
      </v-tabs>

      <v-window
        v-model="activeTab"
        class="journal-window"
      >
        <v-window-item
          value="seasons"
          class="journal-pane"
        >
          <div class="filters pa-3">
            <v-text-field
              v-model="seasonFilters.search"
              label="Поиск по городу, датам или ID"
              prepend-inner-icon="mdi-magnify"
              density="compact"
              variant="outlined"
              clearable
              hide-details
              @keyup.enter="reloadSeasons"
            />
            <v-select
              v-model="seasonFilters.city"
              :items="lookups.cities"
              item-title="name"
              item-value="name"
              label="Город"
              density="compact"
              variant="outlined"
              clearable
              hide-details
            />
            <v-btn
              color="deep-orange-darken-3"
              :loading="loading"
              @click="reloadSeasons"
            >
              Найти
            </v-btn>
          </div>
          <div class="table-wrap">
            <table class="journal-table">
              <thead><tr><th>ID</th><th>Период</th><th>Город</th><th>t отопл.</th><th>t вент.</th><th>Потери воды, %</th><th>Объёмы систем</th><th>Статус</th></tr></thead>
              <tbody>
                <tr
                  v-for="item in seasons"
                  :key="item.id"
                  @click="openSeason(item.id)"
                >
                  <td>{{ item.id }}</td>
                  <td>{{ formatDate(item.d1) }} — {{ formatDate(item.d2) }}</td>
                  <td>{{ item.city || '—' }}</td>
                  <td>{{ formatNumber(item.t_ot) }} °C</td>
                  <td>{{ formatNumber(item.t_vent) }} °C</td>
                  <td>{{ formatNumber(item.a) }}</td>
                  <td>ОТ {{ formatNumber(item.volwaterhs) }} / В {{ formatNumber(item.volwatervs) }} / ГВС {{ formatNumber(item.volwateropengvs) }}</td>
                  <td>
                    <v-chip
                      size="x-small"
                      :color="item.is_current ? 'green' : 'blue-grey'"
                    >
                      {{ item.is_current ? 'текущий' : 'архив' }}
                    </v-chip>
                  </td>
                </tr>
              </tbody>
            </table>
            <div
              v-if="!loading && !seasons.length"
              class="empty"
            >
              Сезоны не найдены
            </div>
          </div>
          <v-pagination
            v-if="seasonPages > 1"
            v-model="seasonPage"
            :length="seasonPages"
            density="comfortable"
            @update:model-value="loadSeasons"
          />
        </v-window-item>

        <v-window-item
          value="sources"
          class="journal-pane"
        >
          <div class="filters source-filters pa-3">
            <v-text-field
              v-model="sourceFilters.search"
              label="Источник, узел, фрагмент или ID"
              prepend-inner-icon="mdi-magnify"
              density="compact"
              variant="outlined"
              clearable
              hide-details
              @keyup.enter="reloadSources"
            />
            <v-select
              v-model="sourceFilters.fragment_id"
              :items="lookups.fragments"
              item-title="name"
              item-value="id"
              label="Фрагмент схемы"
              density="compact"
              variant="outlined"
              clearable
              hide-details
            />
            <v-select
              v-model="sourceFilters.readiness"
              :items="readinessOptions"
              label="Готовность"
              density="compact"
              variant="outlined"
              clearable
              hide-details
            />
            <v-btn
              color="deep-orange-darken-3"
              :loading="loading"
              @click="reloadSources"
            >
              Найти
            </v-btn>
          </div>
          <div class="table-wrap">
            <table class="journal-table source-table">
              <thead><tr><th>ID</th><th>Источник</th><th>Фрагмент</th><th>Узел</th><th>Общие параметры</th><th>Месяцы</th><th>Заполнение / обвязка</th><th>Готовность</th></tr></thead>
              <tbody>
                <tr
                  v-for="item in sources"
                  :key="item.id"
                  @click="openSource(item.id)"
                >
                  <td>{{ item.id }}</td><td>{{ item.name }}</td><td>{{ item.fragment_name || '—' }}</td><td>{{ item.node_id }}</td>
                  <td>
                    <v-icon :color="item.has_source_parameters ? 'green' : 'grey-lighten-1'">
                      {{ item.has_source_parameters ? 'mdi-check-circle' : 'mdi-minus-circle-outline' }}
                    </v-icon>
                  </td>
                  <td>
                    <v-icon :color="item.has_month_parameters ? 'green' : 'grey-lighten-1'">
                      {{ item.has_month_parameters ? 'mdi-check-circle' : 'mdi-minus-circle-outline' }}
                    </v-icon>
                  </td>
                  <td>
                    <v-icon :color="item.has_filling_parameters || item.has_harness ? 'green' : 'grey-lighten-1'">
                      {{ item.has_filling_parameters || item.has_harness ? 'mdi-check-circle' : 'mdi-minus-circle-outline' }}
                    </v-icon>
                  </td>
                  <td>
                    <v-chip
                      size="x-small"
                      :color="item.ready_to_calculate ? 'green' : 'orange'"
                    >
                      {{ item.ready_to_calculate ? 'готов' : 'неполные данные' }}
                    </v-chip>
                  </td>
                </tr>
              </tbody>
            </table>
            <div
              v-if="!loading && !sources.length"
              class="empty"
            >
              Источники не найдены
            </div>
          </div>
          <v-pagination
            v-if="sourcePages > 1"
            v-model="sourcePage"
            :length="sourcePages"
            density="comfortable"
            @update:model-value="loadSources"
          />
        </v-window-item>
      </v-window>
    </v-card>
  </v-dialog>

  <v-dialog
    v-model="detailsVisible"
    :fullscreen="isMobile"
    max-width="1180"
    scrollable
  >
    <v-card :rounded="isMobile ? 0 : 'lg'">
      <v-toolbar
        color="deep-orange-darken-3"
        density="compact"
      >
        <v-toolbar-title>{{ detailTitle }}</v-toolbar-title>
        <v-btn
          v-if="sourceDetails && hasCoordinates(sourceDetails)"
          prepend-icon="mdi-crosshairs-gps"
          variant="text"
          @click="locateSource"
        >
          На карте
        </v-btn>
        <v-btn
          icon="mdi-close"
          aria-label="Закрыть карточку"
          @click="detailsVisible = false"
        />
      </v-toolbar>
      <v-card-text
        v-if="detailLoading"
        class="d-flex justify-center pa-10"
      >
        <v-progress-circular
          indeterminate
          color="deep-orange"
        />
      </v-card-text>

      <v-card-text
        v-else-if="seasonDetails"
        class="pa-4"
      >
        <div class="d-flex justify-end mb-2">
          <v-btn v-if="mutationsEnabled && (!isEditingSeason)" color="primary" variant="text" prepend-icon="mdi-pencil" @click="startEditSeason">Редактировать</v-btn>
          <div v-else class="d-flex ga-2">
            <v-btn v-if="mutationsEnabled" color="error" variant="text" @click="cancelEditSeason" :disabled="saving">Отмена</v-btn>
            <v-btn v-if="mutationsEnabled" color="primary" variant="flat" @click="saveSeason" :loading="saving">Сохранить</v-btn>
          </div>
        </div>
        <div class="detail-grid mb-5" v-if="!isEditingSeason">
          <DetailValue label="Период" :value="`${formatDate(seasonDetails.d1)} — ${formatDate(seasonDetails.d2)}`" />
          <DetailValue label="Город" :value="seasonDetails.city" />
          <DetailValue label="Расчётная t отопления" :value="formatNumber(seasonDetails.t_ot, ' °C')" />
          <DetailValue label="Расчётная t вентиляции" :value="formatNumber(seasonDetails.t_vent, ' °C')" />
          <DetailValue label="Норма потерь воды" :value="formatNumber(seasonDetails.a)" />
          <DetailValue label="Аккумуляторные баки" :value="formatNumber(seasonDetails.tankbattery_q)" />
          <DetailValue label="Объём отопления" :value="formatNumber(seasonDetails.volwaterhs)" />
          <DetailValue label="Объём вентиляции" :value="formatNumber(seasonDetails.volwatervs)" />
          <DetailValue label="Объём открытого ГВС" :value="formatNumber(seasonDetails.volwateropengvs)" />
        </div>
        <v-card variant="outlined" class="pa-3 mb-5" v-else>
          <v-row dense>
            <v-col v-for="field in buildSeasonFields()" :key="field.key" cols="12" sm="6" md="4">
              <div class="detail-label mb-1">{{ field.label }}</div>
              <v-text-field v-model="editFields[field.key]" :type="field.type === 'number' ? 'number' : 'text'" density="compact" hide-details variant="outlined" clearable />
            </v-col>
          </v-row>
        </v-card>
        <h3 class="mb-2">
          Климатические параметры по месяцам
        </h3>
        <div class="table-wrap detail-table-wrap">
          <table class="journal-table compact-table">
            <thead><tr><th>№</th><th>Месяц</th><th>Наружный воздух</th><th>Подвал</th><th>Грунт</th></tr></thead>
            <tbody>
              <tr
                v-for="month in seasonDetails.climate"
                :key="month.id"
              >
                <td>{{ month.r }}</td><td>{{ month.month || month.m }}</td><td>{{ formatNumber(month.tn, ' °C') }}</td><td>{{ formatNumber(month.tpod, ' °C') }}</td><td>{{ formatNumber(month.tgr, ' °C') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </v-card-text>

      <v-card-text
        v-else-if="sourceDetails"
        class="pa-4"
      >
        <div class="status-row mb-4">
          <v-chip :color="sourceDetails.ready_to_calculate ? 'green' : 'orange'">
            {{ sourceDetails.ready_to_calculate ? 'Готов к расчёту' : 'Исходные данные неполные' }}
          </v-chip>
          <v-chip
            variant="outlined"
            :color="sourceDetails.has_source_parameters ? 'green' : 'grey'"
          >
            Общие параметры
          </v-chip>
          <v-chip
            variant="outlined"
            :color="sourceDetails.has_month_parameters ? 'green' : 'grey'"
          >
            Месячные параметры
          </v-chip>
          <v-chip
            variant="outlined"
            :color="sourceDetails.has_filling_parameters || sourceDetails.has_harness ? 'green' : 'grey'"
          >
            Заполнение / обвязка
          </v-chip>
        </div>
        <div class="detail-grid mb-5">
          <DetailValue
            label="Источник"
            :value="sourceDetails.name"
          />
          <DetailValue
            label="Фрагмент"
            :value="sourceDetails.fragment_name"
          />
          <DetailValue
            label="Узел схемы"
            :value="sourceDetails.node_id"
          />
          <DetailValue
            label="Год расчёта"
            :value="valueOf(sourceDetails.attributes, 'heatloscalcyear')"
          />
          <DetailValue
            label="Ёмкость сети, %"
            :value="valueOf(sourceDetails.source_parameters, 't_percent')"
          />
          <DetailValue
            label="Весенняя опрессовка, %"
            :value="valueOf(sourceDetails.source_parameters, 'spring_pressing')"
          />
          <DetailValue
            label="Осенняя опрессовка, %"
            :value="valueOf(sourceDetails.source_parameters, 'autumn_pressing')"
          />
        </div>
        <h3 class="mb-2">
          Рабочие и температурные параметры
        </h3>
        <div class="table-wrap detail-table-wrap">
          <table class="journal-table compact-table months-table">
            <thead><tr><th>№</th><th>Месяц</th><th>Сезон</th><th>Дней</th><th>tн</th><th>tпод</th><th>tгр</th><th>tхв</th><th>t1</th><th>t2</th></tr></thead>
            <tbody>
              <tr
                v-for="month in sourceDetails.months"
                :key="String(valueOf(month, 'id'))"
              >
                <td>{{ valueOf(month, 'r') }}</td><td>{{ valueOf(month, 'month') || valueOf(month, 'm') }}</td><td>{{ seasonName(valueOf(month, 'sezon')) }}</td><td>{{ valueOf(month, 'workcount') }}</td><td>{{ valueOf(month, 'tn') }}</td><td>{{ valueOf(month, 'tpod') }}</td><td>{{ valueOf(month, 'tgr') }}</td><td>{{ valueOf(month, 'tx') }}</td><td>{{ valueOf(month, 'tgp') }}</td><td>{{ valueOf(month, 'tgo') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useMutationsEnabled } from '~/composables/useMutationsEnabled'

const mutationsEnabled = useMutationsEnabled()
import { defineComponent, h, type PropType } from 'vue'
import { useDisplay } from 'vuetify'
import { fastApiService, type HeatLossLookups, type HeatLossSeasonDetails, type HeatLossSeasonSummary, type HeatLossSourceDetails, type HeatLossSourceSummary } from '~/services/fastApiService'

const DetailValue = defineComponent({
  props: {
    label: { type: String, required: true },
    value: { type: [String, Number] as PropType<string | number | null>, default: null },
  },
  setup(props) {
    return () => h('div', { class: 'detail-value' }, [
      h('div', { class: 'detail-label' }, props.label),
      h('div', String(props.value ?? '—')),
    ])
  },
})

const emit = defineEmits<{ 'locate-heat-source': [payload: { longitude: number; latitude: number; id: number; nodeId: number; label: string }] }>()
const { smAndDown: isMobile } = useDisplay()
const visible = ref(false)
const detailsVisible = ref(false)
const loading = ref(false)
const detailLoading = ref(false)
const activeTab = ref<'seasons' | 'sources'>('seasons')
const lookups = ref<HeatLossLookups>({ fragments: [], cities: [], source_counts: {}, season_counts: {}, result_availability: { calculation_count: 0, heat_loss_row_count: 0 } })
const seasons = ref<HeatLossSeasonSummary[]>([])
const sources = ref<HeatLossSourceSummary[]>([])
const seasonPage = ref(1)
const sourcePage = ref(1)
const seasonPages = ref(0)
const sourcePages = ref(0)
const seasonDetails = ref<HeatLossSeasonDetails | null>(null)
const sourceDetails = ref<HeatLossSourceDetails | null>(null)
const seasonFilters = reactive<{ search?: string; city?: string }>({})
const sourceFilters = reactive<{ search?: string; fragment_id?: number; readiness?: 'ready' | 'incomplete' }>({})
const readinessOptions = [{ title: 'Готовы к расчёту', value: 'ready' }, { title: 'Неполные данные', value: 'incomplete' }]
const detailTitle = computed(() => seasonDetails.value ? `Сезон №${seasonDetails.value.id}` : sourceDetails.value ? `${sourceDetails.value.name} · источник №${sourceDetails.value.id}` : 'Карточка')

const isEditingSeason = ref(false)
const saving = ref(false)
const editFields = ref<Record<string, any>>({})

const buildSeasonFields = () => {
  return [
    { label: 'Дата начала (d1)', key: 'd1', type: 'text', value: seasonDetails.value?.d1 },
    { label: 'Дата конца (d2)', key: 'd2', type: 'text', value: seasonDetails.value?.d2 },
    { label: 'Город', key: 'city', type: 'text', value: seasonDetails.value?.city },
    { label: 'Расчётная t отопления', key: 't_ot', type: 'number', value: seasonDetails.value?.t_ot },
    { label: 'Расчётная t вентиляции', key: 't_vent', type: 'number', value: seasonDetails.value?.t_vent },
    { label: 'Норма потерь воды', key: 'a', type: 'number', value: seasonDetails.value?.a },
    { label: 'Аккумуляторные баки', key: 'tankbattery_q', type: 'number', value: seasonDetails.value?.tankbattery_q },
    { label: 'Объём отопления', key: 'volwaterhs', type: 'number', value: seasonDetails.value?.volwaterhs },
    { label: 'Объём вентиляции', key: 'volwatervs', type: 'number', value: seasonDetails.value?.volwatervs },
    { label: 'Объём открытого ГВС', key: 'volwateropengvs', type: 'number', value: seasonDetails.value?.volwateropengvs }
  ]
}

const startEditSeason = () => {
  isEditingSeason.value = true
  editFields.value = {}
  for (const field of buildSeasonFields()) {
    if (field.key) editFields.value[field.key] = field.value ?? null
  }
}

const cancelEditSeason = () => {
  isEditingSeason.value = false
  editFields.value = {}
}

const saveSeason = async () => {
  if (!seasonDetails.value) return
  saving.value = true
  try {
    const processedFields: Record<string, any> = {}
    for (const key in editFields.value) {
      if (editFields.value[key] === '') processedFields[key] = null
      else processedFields[key] = editFields.value[key]
    }
    
    await fastApiService.updateObjectAttributes('heatlosesmain', seasonDetails.value.id, processedFields)
    
    await openSeason(seasonDetails.value.id)
    isEditingSeason.value = false
    await loadSeasons()
  } catch (cause) {
    // We could handle errors globally or locally
  } finally {
    saving.value = false
  }
}

function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat('ru-RU').format(new Date(value)) : '—' }
function formatNumber(value: number | null | undefined, suffix = '') { return value === null || value === undefined ? '—' : `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value)}${suffix}` }
function valueOf(record: Record<string, unknown> | null | undefined, key: string): string | number | null { const value = record?.[key]; return typeof value === 'string' || typeof value === 'number' ? value : null }
function seasonName(value: string | number | null) { return Number(value) === 1 ? 'отопительный' : Number(value) === 2 ? 'летний' : value || '—' }
function hasCoordinates(item: HeatLossSourceSummary) { return Number.isFinite(Number(item.longitude)) && Number.isFinite(Number(item.latitude)) }

async function loadLookups() { if (!lookups.value.fragments.length && !lookups.value.season_counts.total) lookups.value = await fastApiService.getHeatLossLookups() }
async function loadSeasons() { loading.value = true; try { const response = await fastApiService.getHeatLossSeasons({ ...seasonFilters, page: seasonPage.value, page_size: 50 }); seasons.value = response.items; seasonPages.value = response.pages } finally { loading.value = false } }
async function loadSources() { loading.value = true; try { const response = await fastApiService.getHeatLossSources({ ...sourceFilters, page: sourcePage.value, page_size: 50 }); sources.value = response.items; sourcePages.value = response.pages } finally { loading.value = false } }
async function reloadSeasons() { seasonPage.value = 1; await loadSeasons() }
async function reloadSources() { sourcePage.value = 1; await loadSources() }
async function loadActiveTab() { if (activeTab.value === 'seasons') await loadSeasons(); else await loadSources() }
async function openSeason(id: number) { seasonDetails.value = null; sourceDetails.value = null; detailsVisible.value = true; detailLoading.value = true; isEditingSeason.value = false; try { seasonDetails.value = await fastApiService.getHeatLossSeason(id) } finally { detailLoading.value = false } }
async function openSource(id: number) { seasonDetails.value = null; sourceDetails.value = null; detailsVisible.value = true; detailLoading.value = true; try { sourceDetails.value = await fastApiService.getHeatLossSource(id) } finally { detailLoading.value = false } }
function locateSource() { const item = sourceDetails.value; if (!item || !hasCoordinates(item)) return; emit('locate-heat-source', { longitude: Number(item.longitude), latitude: Number(item.latitude), id: item.id, nodeId: item.node_id, label: item.name }); visible.value = false; detailsVisible.value = false }
async function openDialog(scope: { sourceId?: number; seasonId?: number } = {}) { visible.value = true; await loadLookups(); if (scope.sourceId) { activeTab.value = 'sources'; await loadSources(); await openSource(scope.sourceId) } else { activeTab.value = 'seasons'; await loadSeasons(); if (scope.seasonId) await openSeason(scope.seasonId) } }
defineExpose({ openDialog })
</script>

<style scoped>
.heat-loss-journal { height: min(92vh, 940px); display: flex; flex-direction: column; }
.journal-window, .journal-pane { min-height: 0; flex: 1; }
.journal-pane { height: 100%; display: flex; flex-direction: column; }
.filters { display: grid; grid-template-columns: minmax(280px, 2fr) minmax(190px, 1fr) auto; gap: 12px; background: #fff3e0; align-items: center; }
.source-filters { grid-template-columns: minmax(260px, 2fr) minmax(240px, 1.3fr) minmax(190px, 1fr) auto; }
.table-wrap { min-height: 250px; overflow: auto; flex: 1; }
.journal-table { width: 100%; min-width: 1180px; border-collapse: collapse; font-size: .84rem; }
.journal-table th { position: sticky; top: 0; z-index: 1; padding: 10px 12px; text-align: left; color: #bf360c; background: #fff3e0; white-space: nowrap; }
.journal-table td { padding: 10px 12px; border-bottom: 1px solid #eceff1; vertical-align: middle; }
.journal-table tbody tr { cursor: pointer; }.journal-table tbody tr:hover { background: #fff8e1; }
.empty { display: grid; place-items: center; min-height: 300px; color: #78909c; }
.detail-grid { display: grid; grid-template-columns: repeat(3, minmax(170px, 1fr)); gap: 12px; }
:deep(.detail-value) { padding: 12px; border: 1px solid #ffe0b2; border-radius: 8px; background: #fffaf5; }
:deep(.detail-label) { margin-bottom: 4px; color: #6d4c41; font-size: .75rem; }
.status-row { display: flex; flex-wrap: wrap; gap: 8px; }
.detail-table-wrap { max-height: 430px; border: 1px solid #eceff1; border-radius: 8px; }
.compact-table { min-width: 760px; }.months-table { min-width: 950px; }
@media (max-width: 900px) { .filters, .source-filters { grid-template-columns: 1fr; }.detail-grid { grid-template-columns: 1fr 1fr; } }
@media (max-width: 600px) { .heat-loss-journal { height: 100dvh; }.detail-grid { grid-template-columns: 1fr; } }
</style>
