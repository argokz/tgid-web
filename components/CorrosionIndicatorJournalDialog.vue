<template>
  <Teleport to="body">
    <v-dialog v-model="visible" :fullscreen="isMobile" max-width="1360" scrollable>
      <v-card class="corrosion-journal" :rounded="isMobile ? 0 : 'lg'">
        <v-card-title class="d-flex align-center ga-3 px-4 py-3">
          <v-avatar color="orange-lighten-5" size="40">
            <v-icon color="orange-darken-3">mdi-test-tube</v-icon>
          </v-avatar>
          <div class="flex-grow-1" style="min-width: 0">
            <div class="text-subtitle-1 font-weight-bold">Индикаторы коррозии</div>
            <div class="text-caption text-medium-emphasis text-truncate">
              {{ scopeTitle }} · найдено {{ total }}
            </div>
          </div>
          <v-btn v-if="mutationsEnabled" color="orange-darken-3" variant="flat" prepend-icon="mdi-plus" class="mr-2" @click="createIndicator" :loading="creating">
            Создать
          </v-btn>
          <v-btn icon variant="text" aria-label="Закрыть журнал" @click="visible = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-divider />

        <div class="pa-3 pa-md-4 corrosion-filters">
          <v-row dense>
            <v-col cols="12" md="4">
              <v-text-field
                v-model="search"
                label="Номер, место, адрес, источник или ответственный"
                prepend-inner-icon="mdi-magnify"
                density="compact"
                variant="outlined"
                clearable
                hide-details
              />
            </v-col>
            <v-col cols="12" sm="6" md="2">
              <v-select v-model="phaseId" :items="lookups.phases" item-title="name" item-value="id"
                label="Этап" density="compact" variant="outlined" clearable hide-details />
            </v-col>
            <v-col cols="12" sm="6" md="2">
              <v-select v-model="seasonYear" :items="lookups.years" item-title="value" item-value="value"
                label="Сезон с года" density="compact" variant="outlined" clearable hide-details />
            </v-col>
            <v-col cols="12" sm="6" md="2">
              <v-select v-model="rodStateId" :items="lookups.rod_states" item-title="name" item-value="id"
                label="Стержень" density="compact" variant="outlined" clearable hide-details />
            </v-col>
            <v-col cols="12" sm="6" md="2">
              <v-select v-model="processMarkId" :items="lookups.process_marks" item-title="name" item-value="id"
                label="Оценка" density="compact" variant="outlined" clearable hide-details />
            </v-col>
            <v-col cols="12" sm="6" md="4">
              <v-select v-model="waterAggressivenessId" :items="lookups.water_aggressiveness" item-title="name" item-value="id"
                label="Агрессивность сетевой воды" density="compact" variant="outlined" clearable hide-details />
            </v-col>
            <v-col cols="12" sm="6" md="2">
              <v-text-field v-model="dateFrom" type="date" label="С даты" density="compact" variant="outlined" hide-details />
            </v-col>
            <v-col cols="12" sm="6" md="2">
              <v-text-field v-model="dateTo" type="date" label="По дату" density="compact" variant="outlined" hide-details />
            </v-col>
          </v-row>
          <div class="d-flex align-center flex-wrap ga-2 mt-3">
            <v-chip v-if="scope.lineId" size="small" color="orange-darken-3" closable @click:close="clearScope">Линия {{ scope.lineId }}</v-chip>
            <v-chip v-if="scope.nodeId" size="small" color="orange-darken-3" closable @click:close="clearScope">Узел {{ scope.nodeId }}</v-chip>
            <v-spacer />
            <v-btn variant="text" prepend-icon="mdi-filter-remove-outline" @click="resetFilters">Сбросить</v-btn>
            <v-btn color="orange-darken-3" prepend-icon="mdi-refresh" :loading="loading" @click="loadIndicators">Обновить</v-btn>
          </div>
        </div>
        <v-divider />

        <v-card-text class="pa-0 corrosion-table-wrap">
          <v-progress-linear v-if="loading" indeterminate color="orange-darken-3" />
          <v-alert v-if="error" type="error" variant="tonal" class="ma-4">{{ error }}</v-alert>
          <div v-else-if="!loading && !items.length" class="corrosion-empty">
            <v-icon size="56" color="grey-lighten-1">mdi-test-tube-empty</v-icon>
            <div class="text-subtitle-1 mt-3">Индикаторы коррозии не найдены</div>
            <div class="text-body-2 text-medium-emphasis mt-1">
              В текущей базе журнал пока не заполнен или записи исключены фильтрами.
            </div>
          </div>
          <table v-else class="corrosion-table">
            <thead><tr>
              <th>Индикатор</th><th>Этап</th><th>План / установка / извлечение</th><th>Место</th>
              <th>Участок сети</th><th>Скорость</th><th>Оценка</th><th>История</th><th></th>
            </tr></thead>
            <tbody>
              <tr v-for="item in items" :key="item.id" class="corrosion-row" @click="openDetails(item.id)">
                <td><strong>{{ item.number || `Индикатор ${item.id}` }}</strong><div class="cell-note">{{ item.pipeline_sign_name || 'Трубопровод не указан' }}</div></td>
                <td><v-chip size="small" :color="phaseColor(item.phase_id)" variant="tonal">{{ item.phase_name || 'Не задан' }}</v-chip></td>
                <td>{{ formatDate(item.planned_on) }}<div class="cell-note">{{ formatDate(item.installed_on) }} · {{ formatDate(item.extracted_on) }}</div></td>
                <td class="wide-cell">{{ item.installation_place || item.address || '—' }}</td>
                <td>Линия {{ item.line_id || '—' }}<div class="cell-note">{{ nodeRange(item) }}</div></td>
                <td>{{ corrosionRate(item.corrosion_rate) }}</td>
                <td>{{ item.process_mark_name || '—' }}<div class="cell-note">вода: {{ item.water_aggressiveness_name || '—' }}</div></td>
                <td>{{ item.history_count }}</td>
                <td><v-btn icon="mdi-chevron-right" size="small" variant="text" aria-label="Открыть карточку" /></td>
              </tr>
            </tbody>
          </table>
        </v-card-text>
        <v-divider />
        <v-card-actions class="px-4 py-2">
          <span class="text-caption text-medium-emphasis">Страница {{ page }} из {{ pages || 1 }}</span>
          <v-spacer />
          <v-pagination v-if="pages > 1" v-model="page" :length="pages" :total-visible="isMobile ? 3 : 7" density="compact" />
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="detailsVisible" :fullscreen="isMobile" max-width="980" scrollable>
      <v-card :rounded="isMobile ? 0 : 'lg'">
        <v-card-title class="d-flex align-center ga-3 px-4 py-3">
          <v-avatar color="orange-darken-3" size="40"><v-icon color="white">mdi-test-tube</v-icon></v-avatar>
          <div class="flex-grow-1" style="min-width: 0">
            <div class="text-subtitle-1 font-weight-bold text-truncate">{{ isNew ? 'Новый индикатор' : selectedTitle }}</div>
            <div class="text-caption text-medium-emphasis" v-if="!isNew">{{ selected?.phase_name || 'Этап не указан' }} · сезонов {{ selected?.history_count || 0 }}</div>
          </div>
          <v-btn icon variant="text" @click="detailsVisible = false"><v-icon>mdi-close</v-icon></v-btn>
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-4">
          <div v-if="detailsLoading" class="d-flex justify-center pa-10"><v-progress-circular indeterminate color="orange-darken-3" /></div>
          <v-alert v-else-if="detailsError" type="error" variant="tonal">{{ detailsError }}</v-alert>
          <template v-else-if="selected">
            <v-expansion-panels multiple variant="accordion" :model-value="[0, 1]">
              <v-expansion-panel v-for="(group, index) in detailGroups" :key="group.title" :value="index">
                <v-expansion-panel-title>{{ group.title }}</v-expansion-panel-title>
                <v-expansion-panel-text><v-row dense>
                  <v-col v-for="field in group.fields" :key="field.label" cols="12" sm="6">
                    <div class="detail-label mb-1">{{ field.label }}</div>
                    <template v-if="isEditing && field.key">
                      <v-select v-if="field.type === 'select'" v-model="editFields[field.key]" :items="field.items" item-title="name" item-value="id" density="compact" hide-details variant="outlined" clearable />
                      <v-text-field v-else-if="field.type === 'date'" v-model="editFields[field.key]" type="date" density="compact" hide-details variant="outlined" clearable />
                      <v-textarea v-else-if="field.type === 'textarea'" v-model="editFields[field.key]" density="compact" hide-details variant="outlined" rows="3" auto-grow clearable />
                      <v-text-field v-else-if="field.type === 'number'" v-model.number="editFields[field.key]" type="number" density="compact" hide-details variant="outlined" clearable />
                      <v-text-field v-else v-model="editFields[field.key]" density="compact" hide-details variant="outlined" clearable />
                    </template>
                    <div v-else class="detail-value">{{ field.value }}</div>
                  </v-col>
                </v-row></v-expansion-panel-text>
              </v-expansion-panel>

              <template v-if="!isEditing">
              <v-expansion-panel v-if="history.length" :value="detailGroups.length">
                <v-expansion-panel-title>История по отопительным сезонам ({{ history.length }})</v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-card v-for="entry in history" :key="Number(entry.id)" variant="outlined" class="mb-3 pa-3">
                    <div class="d-flex align-center flex-wrap ga-2">
                      <strong>{{ seasonLabel(entry) }}</strong>
                      <v-chip size="x-small" :color="phaseColor(Number(entry.phase_id))" variant="tonal">{{ entry.phase_name || 'Этап не задан' }}</v-chip>
                    </div>
                    <div class="text-body-2 mt-2">План: {{ formatDate(entry.planned_on) }} · установка: {{ formatDate(entry.installed_on) }} · извлечение: {{ formatDate(entry.extracted_on) }}</div>
                    <div class="text-body-2 mt-1">Скорость: {{ corrosionRate(entry.corrosion_rate) }} · оценка: {{ entry.process_mark_name || '—' }} · вода: {{ entry.water_aggressiveness_name || '—' }}</div>
                    <div v-if="entry.note" class="text-caption text-medium-emphasis mt-2">{{ entry.note }}</div>
                  </v-card>
                </v-expansion-panel-text>
              </v-expansion-panel>
              </template>
            </v-expansion-panels>
          </template>
        </v-card-text>
        <v-divider />
        <v-card-actions class="px-4 py-3">
          <v-btn v-if="!isEditing && selected && hasCoordinates(selected)" prepend-icon="mdi-crosshairs-gps" color="orange-darken-3" variant="tonal" @click="locateSelected">На карте</v-btn>
          <v-btn v-if="mutationsEnabled && (!isEditing)" variant="text" prepend-icon="mdi-pencil" @click="startEdit">Редактировать</v-btn>
          <v-btn v-if="mutationsEnabled && !isEditing && selected && !isNew" color="error" variant="text" prepend-icon="mdi-delete" :loading="deleting" @click="deleteIndicator(selected.id)">Удалить</v-btn>
          <v-spacer />
          <template v-if="isEditing">
            <v-btn v-if="mutationsEnabled" variant="text" @click="cancelEdit">Отмена</v-btn>
            <v-btn v-if="mutationsEnabled" color="orange-darken-3" variant="flat" :loading="saving" @click="saveChanges">Сохранить</v-btn>
          </template>
          <v-btn v-else variant="text" @click="detailsVisible = false">Закрыть</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useMobile } from '~/composables/useMobile'
import { useMutationsEnabled } from '~/composables/useMutationsEnabled'
import {
  fastApiService,
  type CorrosionIndicatorDetails,
  type CorrosionIndicatorLookups,
  type CorrosionIndicatorSummary
} from '~/services/fastApiService'

export interface CorrosionIndicatorJournalScope { lineId?: number; nodeId?: number; indicatorId?: number }
const emit = defineEmits<{
  'locate-corrosion-indicator': [coordinates: { longitude: number; latitude: number; id: number; label: string }]
}>()
const { isMobile } = useMobile()
const mutationsEnabled = useMutationsEnabled()
const visible = ref(false), loading = ref(false), error = ref('')
const items = ref<CorrosionIndicatorSummary[]>([])
const total = ref(0), pages = ref(0), page = ref(1)
const pageSize = 50
const search = ref(''), dateFrom = ref(''), dateTo = ref('')
const phaseId = ref<number | undefined>(), rodStateId = ref<number | undefined>()
const processMarkId = ref<number | undefined>(), waterAggressivenessId = ref<number | undefined>()
const seasonYear = ref<number | undefined>()
const scope = reactive<CorrosionIndicatorJournalScope>({})
const lookups = reactive<CorrosionIndicatorLookups>({
  phases: [], rod_states: [], process_marks: [], water_aggressiveness: [], coolant_types: [],
  pipeline_signs: [], responsible_people: [], years: []
})
const detailsVisible = ref(false), detailsLoading = ref(false), detailsError = ref('')
const selected = ref<CorrosionIndicatorDetails | null>(null)
let searchTimer: ReturnType<typeof setTimeout> | undefined

const isEditing = ref(false)
const isNew = ref(false)
const saving = ref(false)
const creating = ref(false)
const deleting = ref(false)
const editFields = ref<Record<string, any>>({})

const scopeTitle = computed(() => scope.lineId ? `индикаторы линии ${scope.lineId}` : scope.nodeId ? `индикаторы у узла ${scope.nodeId}` : 'вся тепловая сеть')
const selectedTitle = computed(() => selected.value?.number ? `Индикатор № ${selected.value.number}` : `Индикатор ${selected.value?.id || ''}`)
const formatDate = (value: unknown) => {
  if (!value) return '—'
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[3]}.${match[2]}.${match[1]}` : String(value)
}
const formatValue = (value: unknown) => value === null || value === undefined || value === '' ? '—' : typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? formatDate(value) : String(value)
const corrosionRate = (value: unknown) => value === null || value === undefined || value === '' ? '—' : `${Number(value).toLocaleString('ru-RU')} мм/год`
const phaseColor = (phase: number | null) => phase === 1 ? 'info' : phase === 2 ? 'warning' : phase === 3 ? 'success' : phase === 4 ? 'grey' : 'grey'
const hasCoordinates = (item: { longitude?: unknown; latitude?: unknown }) => Number.isFinite(Number(item.longitude)) && Number.isFinite(Number(item.latitude))
const nodeRange = (item: CorrosionIndicatorSummary) => [item.start_node_name, item.end_node_name].filter(Boolean).join(' — ') || item.linked_node_name || 'узлы не указаны'
const seasonLabel = (entry: Record<string, unknown>) => {
  const value = entry.installed_on || entry.planned_on
  const match = String(value || '').match(/^(\d{4})/)
  return match ? `Сезон ${match[1]}–${Number(match[1]) + 1}` : `Запись ${entry.id}`
}
const buildFields = (entries: Array<[string, unknown, string?, string?, any[]?]>) => {
  return entries
    .filter(([, value]) => isEditing.value || (value !== null && value !== undefined && value !== ''))
    .map(([label, value, key, type, items]) => ({
      label, value: formatValue(value), rawValue: value, key, type: type || 'text', items
    }))
}

const loadLookups = async () => { if (!lookups.phases.length) Object.assign(lookups, await fastApiService.getCorrosionIndicatorLookups()) }
const loadIndicators = async () => {
  loading.value = true; error.value = ''
  try {
    const response = await fastApiService.getCorrosionIndicators({
      page: page.value, page_size: pageSize, phase_id: phaseId.value, rod_state_id: rodStateId.value,
      process_mark_id: processMarkId.value, water_aggressiveness_id: waterAggressivenessId.value,
      season_year: seasonYear.value, date_from: dateFrom.value || undefined, date_to: dateTo.value || undefined,
      line_id: scope.lineId, node_id: scope.nodeId, search: search.value.trim() || undefined
    })
    items.value = response.items; total.value = response.total; pages.value = response.pages
  } catch (loadError: any) {
    error.value = loadError?.data?.detail || loadError?.message || 'Не удалось загрузить журнал индикаторов коррозии'
  } finally { loading.value = false }
}
const openDetails = async (id: number) => {
  detailsVisible.value = true; detailsLoading.value = true; detailsError.value = ''; selected.value = null
  try { selected.value = await fastApiService.getCorrosionIndicator(id) }
  catch (loadError: any) { detailsError.value = loadError?.data?.detail || loadError?.message || 'Не удалось открыть карточку индикатора' }
  finally { detailsLoading.value = false }
}
const openDialog = async (nextScope: CorrosionIndicatorJournalScope = {}) => {
  Object.assign(scope, { lineId: undefined, nodeId: undefined, indicatorId: undefined }, nextScope)
  page.value = 1; visible.value = true
  try { await Promise.all([loadLookups(), loadIndicators()]); if (nextScope.indicatorId) await openDetails(nextScope.indicatorId) }
  catch (loadError: any) { error.value = loadError?.message || 'Не удалось открыть журнал индикаторов коррозии' }
}
const clearScope = () => { scope.lineId = undefined; scope.nodeId = undefined; page.value = 1; void loadIndicators() }
const resetFilters = () => {
  search.value = ''; phaseId.value = undefined; rodStateId.value = undefined; processMarkId.value = undefined
  waterAggressivenessId.value = undefined; seasonYear.value = undefined; dateFrom.value = ''; dateTo.value = ''
  page.value = 1; void loadIndicators()
}
const locateSelected = () => {
  const item = selected.value
  if (!item || !hasCoordinates(item)) return
  emit('locate-corrosion-indicator', { longitude: Number(item.longitude), latitude: Number(item.latitude), id: item.id, label: item.number ? `Индикатор № ${item.number}` : `Индикатор ${item.id}` })
  detailsVisible.value = false; visible.value = false
}

const detailGroups = computed(() => {
  const item = isEditing.value ? editFields.value : selected.value
  if (!item && !isNew.value) return []
  return [
    { title: 'Размещение и сеть', fields: buildFields([
      ['Номер индикатора', item?.number, 'number', 'text'], ['Этап', item?.phase_name, 'phase_id', 'select', lookups.phases], ['Место установки', item?.installation_place, 'installation_place', 'textarea'], ['Адрес', item?.address, 'address', 'textarea'],
      ['Линия', item?.line_id, 'line_id', 'number'], ['Узел', item?.node_id, 'node_id', 'number'], ['Узлы линии', !isEditing.value ? nodeRange(item as CorrosionIndicatorSummary) : undefined], ['Диаметр, мм', item?.diameter, 'diameter', 'number'],
      ['Признак трубопровода', item?.pipeline_sign_name, 'pipeline_sign_id', 'select', lookups.pipeline_signs], ['Теплоноситель', item?.coolant_type_name, 'coolant_type_id', 'select', lookups.coolant_types], ['Источник тепла', item?.heat_source_name, 'heat_source_id', 'select'],
      ['Участок эксплуатации', item?.operation_site_name, 'operation_site_id', 'select'], ['Сеть', item?.network_name, 'network_id', 'select'], ['Начальник участка', item?.site_manager_name, 'site_manager_id', 'select']
    ]) },
    { title: 'План и экспозиция', fields: buildFields([
      ['Дата планирования', item?.planned_on, 'planned_on', 'date'], ['Дата установки', item?.installed_on, 'installed_on', 'date'], ['Дата извлечения', item?.extracted_on, 'extracted_on', 'date'],
      ['Состояние стержня', item?.rod_state_name, 'rod_state_id', 'select', lookups.rod_states], ['Ответственный', item?.responsible_name, 'responsible_id', 'select', lookups.responsible_people], ['Должность', item?.position_name, 'position_id', 'select'],
      ['Количество пластин', item?.plate_count, 'plate_count', 'number'], ['Начальный средний вес, г', item?.initial_plate_weight, 'initial_plate_weight', 'number'],
      ['Радиус пластины, мм', item?.plate_radius, 'plate_radius', 'number'], ['Радиус втулки, мм', item?.bush_radius, 'bush_radius', 'number'], ['Толщина пластины, мм', item?.plate_thickness, 'plate_thickness', 'number']
    ]) },
    { title: 'Результаты обработки', fields: buildFields([
      ['Конечный средний вес, г', item?.final_plate_weight, 'final_plate_weight', 'number'], ['Потеря массы при кислотной обработке, г', item?.acid_treatment_mass_loss, 'acid_treatment_mass_loss', 'number'],
      ['Средняя скорость коррозии, мм/год', item?.corrosion_rate, 'corrosion_rate', 'number'], ['Оценка коррозионного процесса', item?.process_mark_name, 'process_mark_id', 'select', lookups.process_marks],
      ['Агрессивность сетевой воды', item?.water_aggressiveness_name, 'water_aggressiveness_id', 'select', lookups.water_aggressiveness], ['Внешний вид пластин', item?.plate_external_view, 'plate_external_view', 'textarea'], ['Примечание', item?.note, 'note', 'textarea']
    ]) },
    { title: 'Камеры и характеристики участка', fields: buildFields([
      ['Начальная камера', item?.start_chamber_name, 'start_chamber_id', 'select'], ['Код начальной камеры', item?.start_chamber_code, 'start_chamber_code', 'text'],
      ['Конечная камера', item?.end_chamber_name, 'end_chamber_id', 'select'], ['Код конечной камеры', item?.end_chamber_code, 'end_chamber_code', 'text'],
      ['Ближайшая камера', item?.nearest_chamber_name, 'nearest_chamber_id', 'select'], ['Код ближайшей камеры', item?.nearest_chamber_code, 'nearest_chamber_code', 'text'],
      ['Расстояние до камеры, м', item?.chamber_distance, 'chamber_distance', 'number'], ['Ввод в эксплуатацию', item?.commissioned_on, 'commissioned_on', 'date'],
      ['Вид прокладки', item?.tubing_type_name, 'tubing_type_id', 'select'], ['Диаметр подачи, мм', item?.flow_diameter, 'flow_diameter', 'number'], ['Диаметр обратки, мм', item?.return_diameter, 'return_diameter', 'number']
    ]) }
  ].filter(group => group.fields.length)
})
const history = computed(() => selected.value?.relations?.history || [])

const startEdit = () => {
  if (!selected.value) return
  isEditing.value = true
  isNew.value = false
  editFields.value = { ...selected.value }
}

const cancelEdit = () => {
  isEditing.value = false
  if (isNew.value) detailsVisible.value = false
}

const createIndicator = async () => {
  creating.value = true
  await loadLookups()
  creating.value = false
  selected.value = null
  isEditing.value = true
  isNew.value = true
  editFields.value = { line_id: scope.lineId, node_id: scope.nodeId }
  detailsVisible.value = true
}

const saveChanges = async () => {
  saving.value = true
  try {
    if (isNew.value) {
      const result = await fastApiService.createObject('indikator_korrozii', editFields.value)
      if (result && result.id) {
        isEditing.value = false
        await loadIndicators()
        await openDetails(result.id)
      }
    } else if (selected.value) {
      const changes: Record<string, any> = {}
      for (const [k, v] of Object.entries(editFields.value)) {
        if (v !== selected.value[k as keyof CorrosionIndicatorDetails]) {
          changes[k] = v
        }
      }
      if (Object.keys(changes).length > 0) {
        await fastApiService.updateObjectAttributes('indikator_korrozii', selected.value.id.toString(), changes)
      }
      isEditing.value = false
      await loadIndicators()
      await openDetails(selected.value.id)
    }
  } catch (e: any) {
    detailsError.value = 'Ошибка при сохранении: ' + (e?.message || '')
  } finally {
    saving.value = false
  }
}

const deleteIndicator = async (id: number) => {
  if (!confirm(`Вы действительно хотите удалить Индикатор #${id}?`)) return
  try {
    deleting.value = true
    await fastApiService.deleteObject('indikator_korrozii', id)
    detailsVisible.value = false
    await loadIndicators()
  } catch (e: any) {
    detailsError.value = 'Ошибка при удалении: ' + (e?.message || '')
  } finally {
    deleting.value = false
  }
}

watch(page, () => { if (visible.value) void loadIndicators() })
watch([phaseId, rodStateId, processMarkId, waterAggressivenessId, seasonYear, dateFrom, dateTo], () => { if (visible.value) { page.value = 1; void loadIndicators() } })
watch(search, () => { if (!visible.value) return; if (searchTimer) clearTimeout(searchTimer); searchTimer = setTimeout(() => { page.value = 1; void loadIndicators() }, 350) })
defineExpose({ openDialog })
</script>

<style scoped>
.corrosion-journal { height: min(90vh, 920px); display: flex; flex-direction: column; }
.corrosion-filters { flex-shrink: 0; background: #fafafa; }
.corrosion-table-wrap { min-height: 280px; overflow: auto; flex: 1; }
.corrosion-table { width: 100%; min-width: 1320px; border-collapse: collapse; font-size: .84rem; }
.corrosion-table th { position: sticky; top: 0; z-index: 1; background: #eceff1; color: #546e7a; text-align: left; padding: 10px 12px; }
.corrosion-table td { padding: 10px 12px; border-bottom: 1px solid #eceff1; vertical-align: top; }
.corrosion-row { cursor: pointer; }.corrosion-row:hover { background: #fff3e0; }
.wide-cell { max-width: 240px; }.cell-note { color: #78909c; font-size: .75rem; margin-top: 3px; }
.corrosion-empty { min-height: 320px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 32px; }
.detail-label { color: #78909c; font-size: .72rem; font-weight: 600; letter-spacing: .03em; text-transform: uppercase; }
.detail-value { color: #263238; font-size: .9rem; margin-top: 3px; overflow-wrap: anywhere; }
@media (max-width: 600px) { .corrosion-journal { height: 100dvh; } }
</style>
