<template>
  <v-dialog v-model="visible" :fullscreen="isMobile" max-width="1720" scrollable>
    <v-card class="alseko-journal" :rounded="isMobile ? 0 : 'lg'">
      <v-toolbar color="indigo-darken-2" density="comfortable">
        <v-icon class="ml-3">mdi-office-building-marker</v-icon>
        <v-toolbar-title>АЛСЕКО — договорные нагрузки</v-toolbar-title>
        <v-chip v-if="counts" class="mr-2" size="small">{{ counts.total.toLocaleString('ru-RU') }} объектов</v-chip>
        <v-btn icon="mdi-close" @click="visible = false" />
      </v-toolbar>

      <v-tabs v-model="mode" color="indigo-darken-2" @update:model-value="changeMode">
        <v-tab value="loads">Договорные объекты</v-tab>
        <v-tab value="buildings">Здания без потребителя</v-tab>
      </v-tabs>

      <div class="pa-3 alseko-filters">
        <v-row dense>
          <v-col cols="12" md="3">
            <v-text-field v-model="filters.search" label="Адрес, договор, владелец, объект" density="compact" clearable hide-details prepend-inner-icon="mdi-magnify" @keyup.enter="reload" />
          </v-col>
          <template v-if="mode === 'loads'">
            <v-col cols="6" md="2"><v-select v-model="filters.match_status" :items="matchStatuses" label="Связь со зданием" density="compact" clearable hide-details /></v-col>
            <v-col cols="6" md="2"><v-select v-model="filters.customer_group" :items="customerGroups" label="Группа" density="compact" clearable hide-details /></v-col>
            <v-col cols="6" md="2"><v-select v-model="filters.operation_district" :items="lookups.operation_districts" item-title="name" item-value="name" label="Район эксплуатации" density="compact" clearable hide-details /></v-col>
            <v-col cols="6" md="2"><v-select v-model="filters.administrative_district" :items="lookups.administrative_districts" item-title="name" item-value="name" label="Административный район" density="compact" clearable hide-details /></v-col>
            <v-col cols="6" md="2"><v-select v-model="filters.heat_source" :items="lookups.heat_sources" item-title="name" item-value="name" label="Источник" density="compact" clearable hide-details /></v-col>
            <v-col cols="6" md="2"><v-select v-model="filters.temperature_graph" :items="lookups.temperature_graphs" item-title="name" item-value="name" label="Температурный график" density="compact" clearable hide-details /></v-col>
          </template>
          <v-col cols="12" md="2" class="d-flex ga-2">
            <v-btn color="indigo-darken-2" prepend-icon="mdi-filter" @click="reload">Применить</v-btn>
            <v-btn variant="text" icon="mdi-filter-remove" title="Сбросить" @click="resetFilters" />
          </v-col>
        </v-row>
        <div v-if="counts && mode === 'loads'" class="d-flex flex-wrap ga-2 mt-3">
          <v-chip size="small" color="green">Найдено по адресу: {{ counts.matched.toLocaleString('ru-RU') }}</v-chip>
          <v-chip size="small" color="orange-darken-2">Не найдено: {{ counts.unmatched.toLocaleString('ru-RU') }}</v-chip>
          <v-chip size="small">МЖД: {{ counts.apartment.toLocaleString('ru-RU') }}</v-chip>
          <v-chip size="small">Прочие: {{ counts.other.toLocaleString('ru-RU') }}</v-chip>
        </div>
      </div>

      <v-progress-linear v-if="loading" indeterminate color="indigo" />
      <v-alert v-if="error" type="error" variant="tonal" class="ma-3">{{ error }}</v-alert>

      <v-card-text class="pa-0 alseko-table-wrap">
        <div v-if="!loading && !items.length" class="alseko-empty">
          <v-icon size="58" color="grey-lighten-1">mdi-database-search</v-icon>
          <div class="text-h6 mt-3">Записи не найдены</div>
          <div class="text-body-2 text-medium-emphasis">Измените фильтры или строку поиска.</div>
        </div>

        <table v-else-if="mode === 'loads'" class="alseko-table">
          <thead><tr><th>ID</th><th>Адрес</th><th>Объект</th><th>Договор / реестр</th><th>Район</th><th>Источник</th><th>Отопление</th><th>ГВС</th><th>Вентиляция</th><th>Пар</th><th>Здания</th></tr></thead>
          <tbody>
            <tr v-for="item in loadItems" :key="item.id" @click="openLoad(item.id)">
              <td>{{ item.id }}</td><td>{{ displayAddress(item) }}</td><td>{{ item.customer_type || '—' }}<div class="subtle">{{ item.owner || '' }}</div></td>
              <td>{{ item.contract_number || '—' }}<div class="subtle">{{ item.registry_number || '' }}</div></td><td>{{ item.operation_district || '—' }}</td><td>{{ item.heat_source || '—' }}</td>
              <td>{{ loadValue(item.heating_load) }}</td><td>{{ loadValue(item.hot_water_load) }}</td><td>{{ loadValue(item.ventilation_load) }}</td><td>{{ loadValue(item.steam_load) }}</td>
              <td><v-chip size="x-small" :color="item.building_match_count ? 'green' : 'orange-darken-2'">{{ item.building_match_count }}</v-chip></td>
            </tr>
          </tbody>
        </table>

        <table v-else class="alseko-table building-table">
          <thead><tr><th>ID</th><th>Адрес</th><th>Отопление</th><th>ГВС</th><th>Вентиляция</th><th>Пар</th><th>Схема отопления</th><th>Схема ГВС</th><th>Карта</th></tr></thead>
          <tbody>
            <tr v-for="item in buildingItems" :key="item.id" @click="openBuilding(item.id)">
              <td>{{ item.id }}</td><td>{{ displayAddress(item) }}</td><td>{{ loadValue(item.heating_load) }}</td><td>{{ loadValue(item.hot_water_load) }}</td><td>{{ loadValue(item.ventilation_load) }}</td><td>{{ loadValue(item.steam_load) }}</td><td>{{ item.heating_scheme_id ?? '—' }}</td><td>{{ item.hot_water_scheme_id ?? '—' }}</td>
              <td><v-icon :color="hasCoordinates(item) ? 'indigo' : 'grey'">mdi-map-marker</v-icon></td>
            </tr>
          </tbody>
        </table>
      </v-card-text>

      <v-card-actions class="justify-center border-t-sm">
        <v-pagination v-model="page" :length="pages || 1" :total-visible="isMobile ? 4 : 8" density="comfortable" @update:model-value="loadItemsPage" />
        <span class="text-caption text-medium-emphasis ml-3">Всего: {{ total.toLocaleString('ru-RU') }}</span>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog v-model="detailsVisible" :fullscreen="isMobile" max-width="1050" scrollable>
    <v-card v-if="selected" :rounded="isMobile ? 0 : 'lg'">
      <v-toolbar color="indigo-darken-2" density="comfortable">
        <v-toolbar-title>{{ selectedKind === 'load' ? `Объект АЛСЕКО ${selected.id}` : `Здание АЛСЕКО ${selected.id}` }}</v-toolbar-title>
        <v-btn v-if="hasCoordinates(selected)" icon="mdi-crosshairs-gps" title="Показать на карте" @click="locateSelected" />
        <v-btn icon="mdi-close" @click="detailsVisible = false" />
      </v-toolbar>
      <v-progress-linear v-if="detailsLoading" indeterminate />
      <v-card-text>
        <template v-if="selectedKind === 'load'">
          <v-alert v-if="Number(selected.building_match_count) > 1" type="warning" variant="tonal" class="mb-4">По адресу найдено несколько зданий: {{ selected.building_match_count }}. Связь неоднозначна и требует ручной проверки.</v-alert>
          <DetailGrid title="Договорный объект" :items="loadMainDetails" />
          <DetailGrid title="Нагрузки, ккал/ч" :items="loadBreakdown" />
          <DetailGrid title="Эксплуатационная привязка" :items="loadNetworkDetails" />
          <RelationTable title="Здания по адресу" :rows="loadRelations.matched_buildings" @open="openRelatedBuilding" />
          <RelationTable title="Договоры по этому адресу" :rows="loadRelations.address_loads" @open="openRelatedLoad" />
        </template>
        <template v-else>
          <DetailGrid title="Здание" :items="buildingMainDetails" />
          <DetailGrid title="Нагрузки, ккал/ч" :items="buildingBreakdown" />
          <RelationTable title="Договорные объекты по адресу" :rows="buildingRelations.matched_loads" @open="openRelatedLoad" />
        </template>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, ref } from 'vue'
import { useDisplay } from 'vuetify'
import { fastApiService, type AlsekoBuildingDetails, type AlsekoBuildingSummary, type AlsekoLoadDetails, type AlsekoLoadSummary, type AlsekoLookups } from '~/services/fastApiService'

export interface AlsekoJournalScope { loadId?: number; buildingId?: number }

const DetailGrid = defineComponent({
  props: { title: { type: String, required: true }, items: { type: Array as () => Array<[string, unknown]>, required: true } },
  setup: props => () => h('section', { class: 'mb-5' }, [h('div', { class: 'text-subtitle-1 font-weight-bold mb-2' }, props.title), h('div', { class: 'detail-grid' }, props.items.map(([label, value]) => h('div', { class: 'detail-cell' }, [h('div', { class: 'detail-label' }, label), h('div', {}, formatValue(value))])))])
})

const RelationTable = defineComponent({
  props: { title: { type: String, required: true }, rows: { type: Array as () => object[], required: true } },
  emits: ['open'],
  setup: (props, { emit }) => () => props.rows.length ? h('section', { class: 'mb-5' }, [h('div', { class: 'text-subtitle-1 font-weight-bold mb-2' }, `${props.title} (${props.rows.length})`), h('div', { class: 'relation-list' }, props.rows.map(item => { const row = item as Record<string, unknown>; return h('button', { type: 'button', class: 'relation-row', onClick: () => emit('open', row) }, [h('strong', {}, `ID ${row.id}`), h('span', {}, String(row.customer_type || row.consumer || [row.microdistrict, row.street, row.house].filter(Boolean).join(', ') || 'без наименования')), h('span', { class: 'subtle' }, String(row.contract_number || row.registry_number || ''))]) }))]) : null
})

const emit = defineEmits<{ 'locate-alseko': [payload: { longitude: number; latitude: number; id: number; kind: 'load' | 'building'; label: string }] }>()
const { mobile } = useDisplay()
const isMobile = computed(() => mobile.value)
const visible = ref(false), detailsVisible = ref(false), loading = ref(false), detailsLoading = ref(false)
const error = ref(''), mode = ref<'loads' | 'buildings'>('loads'), page = ref(1), pages = ref(0), total = ref(0)
const loadItems = ref<AlsekoLoadSummary[]>([]), buildingItems = ref<AlsekoBuildingSummary[]>([])
const items = computed(() => mode.value === 'loads' ? loadItems.value : buildingItems.value)
const selected = ref<AlsekoLoadDetails | AlsekoBuildingDetails | null>(null), selectedKind = ref<'load' | 'building'>('load')
const selectedLoad = computed(() => selectedKind.value === 'load' ? selected.value as AlsekoLoadDetails | null : null)
const selectedBuilding = computed(() => selectedKind.value === 'building' ? selected.value as AlsekoBuildingDetails | null : null)
const lookups = ref<AlsekoLookups>({ operation_districts: [], administrative_districts: [], heat_sources: [], temperature_graphs: [], counts: [] })
const counts = computed(() => lookups.value.counts[0] || null)
const filters = ref({ search: '', match_status: undefined as 'matched' | 'unmatched' | undefined, customer_group: undefined as 'apartment' | 'other' | undefined, operation_district: '', administrative_district: '', heat_source: '', temperature_graph: '', building_id: undefined as number | undefined })
const matchStatuses = [{ title: 'Найдено', value: 'matched' }, { title: 'Не найдено', value: 'unmatched' }]
const customerGroups = [{ title: 'МЖД', value: 'apartment' }, { title: 'Прочие', value: 'other' }]

const loadRelations = computed(() => selectedKind.value === 'load' ? (selected.value as AlsekoLoadDetails)?.relations || { matched_buildings: [], address_loads: [] } : { matched_buildings: [], address_loads: [] })
const buildingRelations = computed(() => selectedKind.value === 'building' ? (selected.value as AlsekoBuildingDetails)?.relations || { matched_loads: [] } : { matched_loads: [] })
const loadMainDetails = computed<Array<[string, unknown]>>(() => selectedLoad.value ? [['Адрес', displayAddress(selectedLoad.value)], ['Адрес источника', selectedLoad.value.source_address], ['Вид объекта', selectedLoad.value.customer_type], ['Владелец', selectedLoad.value.owner], ['Договор', selectedLoad.value.contract_number], ['Номер в реестре', selectedLoad.value.registry_number], ['Совпавших зданий', selectedLoad.value.building_match_count], ['Назначенных зданий', selectedLoad.value.assigned_building_count]] : [])
const loadBreakdown = computed<Array<[string, unknown]>>(() => selectedLoad.value ? [['Отопление', loadValue(selectedLoad.value.heating_load)], ['ГВС', loadValue(selectedLoad.value.hot_water_load)], ['Вентиляция', loadValue(selectedLoad.value.ventilation_load)], ['Пар', loadValue(selectedLoad.value.steam_load)], ['Всего', loadValue(selectedLoad.value.total_load)]] : [])
const loadNetworkDetails = computed<Array<[string, unknown]>>(() => selectedLoad.value ? [['Административный район', selectedLoad.value.administrative_district], ['Район эксплуатации', selectedLoad.value.operation_district], ['Участок', selectedLoad.value.operation_site], ['Источник', selectedLoad.value.heat_source], ['Температурный график', selectedLoad.value.temperature_graph]] : [])
const buildingMainDetails = computed<Array<[string, unknown]>>(() => selectedBuilding.value ? [['Адрес', displayAddress(selectedBuilding.value)], ['Потребитель', selectedBuilding.value.consumer], ['Этажность', selectedBuilding.value.floor], ['Год постройки', selectedBuilding.value.construction_year], ['Схема отопления', selectedBuilding.value.heating_scheme_id], ['Схема ГВС', selectedBuilding.value.hot_water_scheme_id]] : [])
const buildingBreakdown = computed<Array<[string, unknown]>>(() => selectedBuilding.value ? [['Отопление', loadValue(selectedBuilding.value.heating_load)], ['ГВС', loadValue(selectedBuilding.value.hot_water_load)], ['Вентиляция', loadValue(selectedBuilding.value.ventilation_load)], ['Пар', loadValue(selectedBuilding.value.steam_load)], ['Всего', loadValue(selectedBuilding.value.total_load)]] : [])

function formatValue(value: unknown) { return value === null || value === undefined || value === '' ? '—' : String(value) }
function loadValue(value: unknown) { return value === null || value === undefined || value === '' ? '—' : Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 2 }) }
function displayAddress(item: object) { const row = item as Record<string, unknown>; return [row.microdistrict, row.street, row.house].filter(Boolean).join(', ') || String(row.source_address || '—') }
function hasCoordinates(item: object) { const row = item as Record<string, unknown>; return Number.isFinite(Number(row.longitude)) && Number.isFinite(Number(row.latitude)) }

async function loadLookups() { if (!lookups.value.counts.length) lookups.value = await fastApiService.getAlsekoLookups() }
async function loadItemsPage() {
  loading.value = true; error.value = ''
  try {
    if (mode.value === 'loads') {
      const response = await fastApiService.getAlsekoLoads({ page: page.value, page_size: 50, ...filters.value })
      loadItems.value = response.items; total.value = response.total; pages.value = response.pages
    } else {
      const response = await fastApiService.getUnassignedAlsekoBuildings({ page: page.value, page_size: 50, search: filters.value.search })
      buildingItems.value = response.items; total.value = response.total; pages.value = response.pages
    }
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Не удалось загрузить АЛСЕКО' } finally { loading.value = false }
}
async function reload() { page.value = 1; await loadItemsPage() }
async function changeMode() { page.value = 1; await loadItemsPage() }
async function resetFilters() { filters.value = { search: '', match_status: undefined, customer_group: undefined, operation_district: '', administrative_district: '', heat_source: '', temperature_graph: '', building_id: undefined }; await reload() }
async function openLoad(id: number) { detailsLoading.value = true; detailsVisible.value = true; selectedKind.value = 'load'; try { selected.value = await fastApiService.getAlsekoLoad(id) } finally { detailsLoading.value = false } }
async function openBuilding(id: number) { detailsLoading.value = true; detailsVisible.value = true; selectedKind.value = 'building'; try { selected.value = await fastApiService.getAlsekoBuilding(id) } finally { detailsLoading.value = false } }
function openRelatedLoad(row: Record<string, unknown>) { if (Number(row.id)) void openLoad(Number(row.id)) }
function openRelatedBuilding(row: Record<string, unknown>) { if (Number(row.id)) void openBuilding(Number(row.id)) }
function locateSelected() { if (!selected.value || !hasCoordinates(selected.value)) return; emit('locate-alseko', { longitude: Number(selected.value.longitude), latitude: Number(selected.value.latitude), id: selected.value.id, kind: selectedKind.value, label: `${selectedKind.value === 'load' ? 'АЛСЕКО' : 'Здание АЛСЕКО'} ${selected.value.id}` }); visible.value = false; detailsVisible.value = false }

async function openDialog(scope: AlsekoJournalScope = {}) {
  visible.value = true; await loadLookups()
  if (scope.buildingId) { mode.value = 'buildings'; await loadItemsPage(); await openBuilding(scope.buildingId); return }
  mode.value = 'loads'; filters.value.building_id = scope.buildingId; await loadItemsPage()
  if (scope.loadId) await openLoad(scope.loadId)
}
defineExpose({ openDialog })
</script>

<style scoped>
.alseko-journal { height: min(92vh, 940px); display: flex; flex-direction: column; }
.alseko-filters { flex-shrink: 0; background: #fafafa; }
.alseko-table-wrap { min-height: 300px; overflow: auto; flex: 1; }
.alseko-table { width: 100%; min-width: 1450px; border-collapse: collapse; font-size: .82rem; }
.building-table { min-width: 1080px; }
.alseko-table th { position: sticky; top: 0; z-index: 1; background: #e8eaf6; color: #3949ab; text-align: left; padding: 10px 12px; }
.alseko-table td { padding: 9px 12px; border-bottom: 1px solid #eceff1; vertical-align: top; }
.alseko-table tbody tr { cursor: pointer; }.alseko-table tbody tr:hover { background: #e8eaf6; }
.subtle { color: #78909c; font-size: .76rem; margin-top: 2px; }
.alseko-empty { min-height: 330px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
:deep(.detail-grid) { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; background: #e0e0e0; border: 1px solid #e0e0e0; }
:deep(.detail-cell) { background: white; padding: 10px 12px; overflow-wrap: anywhere; }
:deep(.detail-label) { color: #607d8b; font-size: .75rem; margin-bottom: 2px; }
:deep(.relation-list) { border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden; }
:deep(.relation-row) { width: 100%; border: 0; border-bottom: 1px solid #eceff1; background: white; display: grid; grid-template-columns: 90px 1fr 220px; gap: 12px; padding: 10px 12px; text-align: left; cursor: pointer; }
:deep(.relation-row:hover) { background: #e8eaf6; }
@media (max-width: 600px) { .alseko-journal { height: 100dvh; } :deep(.detail-grid) { grid-template-columns: 1fr; } :deep(.relation-row) { grid-template-columns: 70px 1fr; } }
</style>
