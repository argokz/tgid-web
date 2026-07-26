<template>
  <Teleport to="body">
    <v-dialog v-model="visible" :fullscreen="isMobile" max-width="1320" scrollable>
      <v-card class="pressure-journal" :rounded="isMobile ? 0 : 'lg'">
        <v-card-title class="d-flex align-center ga-3 px-4 py-3">
          <v-avatar color="blue-lighten-5" size="40"><v-icon color="blue-darken-2">mdi-gauge</v-icon></v-avatar>
          <div class="flex-grow-1" style="min-width: 0">
            <div class="text-subtitle-1 font-weight-bold">Журнал опрессовок</div>
            <div class="text-caption text-medium-emphasis text-truncate">{{ scopeTitle }} · найдено {{ total }}</div>
          </div>
          <v-btn v-if="mutationsEnabled" color="blue-darken-2" variant="flat" prepend-icon="mdi-plus" class="mr-2" @click="createPressureTest" :loading="creating">
            Создать
          </v-btn>
          <v-btn icon variant="text" aria-label="Закрыть журнал" @click="visible = false"><v-icon>mdi-close</v-icon></v-btn>
        </v-card-title>
        <v-divider />

        <div class="pa-3 pa-md-4 pressure-filters">
          <v-row dense>
            <v-col cols="12" md="4">
              <v-text-field v-model="search" label="Поиск по ID, контуру, источнику или решению"
                prepend-inner-icon="mdi-magnify" density="compact" variant="outlined" clearable hide-details />
            </v-col>
            <v-col cols="12" sm="6" md="2">
              <v-select v-model="stateId" :items="lookups.states" item-title="name" item-value="id"
                label="Состояние" density="compact" variant="outlined" clearable hide-details />
            </v-col>
            <v-col cols="12" sm="6" md="3">
              <v-select v-model="testTypeId" :items="lookups.test_types" item-title="name" item-value="id"
                label="Вид испытания" density="compact" variant="outlined" clearable hide-details />
            </v-col>
            <v-col cols="12" sm="6" md="3">
              <v-select v-model="heatSourceId" :items="lookups.heat_sources" item-title="name" item-value="id"
                label="Источник тепла" density="compact" variant="outlined" clearable hide-details />
            </v-col>
            <v-col cols="12" sm="6" md="4">
              <v-select v-model="responsibleId" :items="lookups.responsible_people" item-title="name" item-value="id"
                label="Ответственный" density="compact" variant="outlined" clearable hide-details />
            </v-col>
            <v-col cols="12" sm="6" md="2">
              <v-select v-model="approved" :items="approvalOptions" item-title="title" item-value="value"
                label="Утверждение" density="compact" variant="outlined" clearable hide-details />
            </v-col>
            <v-col cols="12" sm="6" md="2">
              <v-text-field v-model="dateFrom" type="date" label="С даты" density="compact" variant="outlined" hide-details />
            </v-col>
            <v-col cols="12" sm="6" md="2">
              <v-text-field v-model="dateTo" type="date" label="По дату" density="compact" variant="outlined" hide-details />
            </v-col>
          </v-row>
          <div class="d-flex align-center flex-wrap ga-2 mt-3">
            <v-chip v-if="scope.lineId" size="small" color="blue-darken-2" closable @click:close="clearScope">Трубопровод {{ scope.lineId }}</v-chip>
            <v-chip v-if="scope.nodeId" size="small" color="blue-darken-2" closable @click:close="clearScope">Узел {{ scope.nodeId }}</v-chip>
            <v-spacer />
            <v-btn variant="text" prepend-icon="mdi-filter-remove-outline" @click="resetFilters">Сбросить</v-btn>
            <v-btn color="blue-darken-2" prepend-icon="mdi-refresh" :loading="loading" @click="loadTests">Обновить</v-btn>
          </div>
        </div>
        <v-divider />

        <v-card-text class="pa-0 pressure-table-wrap">
          <v-progress-linear v-if="loading" indeterminate color="blue-darken-2" />
          <v-alert v-if="error" type="error" variant="tonal" class="ma-4">{{ error }}</v-alert>
          <div v-else-if="!loading && items.length === 0" class="pressure-empty">
            <v-icon size="56" color="grey-lighten-1">mdi-gauge-empty</v-icon>
            <div class="text-subtitle-1 mt-3">Опрессовки не найдены</div>
            <div class="text-body-2 text-medium-emphasis mt-1">Измените фильтры или загрузите исторические контуры TGID в таблицу opres.</div>
          </div>
          <v-table v-else fixed-header hover density="compact" class="pressure-table">
            <thead><tr>
              <th>ID</th><th>Период</th><th>Контур</th><th>Источник / вид</th><th>Состояние</th>
              <th>Давление I / II</th><th>Ответственный</th><th>Линии</th><th>Нарушения</th><th>Решение</th><th class="text-right">Действия</th>
            </tr></thead>
            <tbody>
              <tr v-for="item in items" :key="item.id" class="pressure-row" @click="openDetails(item.id)">
                <td class="font-weight-medium">{{ item.id }}</td>
                <td class="text-no-wrap">{{ formatRange(item.effective_start, item.effective_finish) }}</td>
                <td><div>{{ item.name || `Опрессовка ${item.id}` }}</div><div class="text-caption text-medium-emphasis">{{ item.contour_description || item.boundary_description || '—' }}</div></td>
                <td>{{ [item.heat_source_name, item.test_type_name].filter(Boolean).join(' · ') || '—' }}</td>
                <td><v-chip size="x-small" :color="stateColor(item.state_id)" variant="tonal">{{ item.state_name || 'Не указано' }}</v-chip></td>
                <td class="text-no-wrap">{{ pressure(item.stage_one_pressure) }} / {{ pressure(item.stage_two_pressure) }}</td>
                <td>{{ item.responsible_name || '—' }}</td><td>{{ item.line_count }}</td>
                <td><v-chip size="x-small" :color="item.defect_count ? 'error' : 'success'" variant="tonal">{{ item.defect_count }}</v-chip></td>
                <td class="result-cell">{{ item.commission_decision || item.report || item.note || '—' }}</td>
                <td class="text-right text-no-wrap">
                  <v-btn v-if="hasCoordinates(item)" icon="mdi-crosshairs-gps" size="x-small" variant="text" color="blue-darken-2"
                    aria-label="Показать контур на карте" @click.stop="locate(item, item.name || `Опрессовка ${item.id}`)" />
                  <v-btn icon="mdi-chevron-right" size="x-small" variant="text" @click.stop="openDetails(item.id)" />
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
        <v-divider />
        <v-card-actions class="px-4 py-2">
          <span class="text-caption text-medium-emphasis">Страница {{ page }}{{ pages ? ` из ${pages}` : '' }}</span><v-spacer />
          <v-pagination v-if="pages > 1" v-model="page" :length="pages" :total-visible="isMobile ? 3 : 7" density="compact" />
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="detailsVisible" :fullscreen="isMobile" max-width="1040" scrollable>
      <v-card :rounded="isMobile ? 0 : 'lg'">
        <v-card-title class="d-flex align-center ga-3 px-4 py-3">
          <v-icon color="blue-darken-2">mdi-gauge</v-icon>
          <div class="flex-grow-1" style="min-width: 0">
            <div class="text-subtitle-1 font-weight-bold text-truncate">{{ isNew ? 'Новая опрессовка' : (selected?.name || `Опрессовка ${selected?.id || ''}`) }}</div>
            <div class="text-caption text-medium-emphasis" v-if="!isNew">{{ selected?.state_name || 'Состояние не указано' }} · линий {{ selected?.line_count || 0 }} · документов {{ selected?.document_count || 0 }}</div>
          </div>
          <v-btn icon variant="text" aria-label="Закрыть" @click="detailsVisible = false"><v-icon>mdi-close</v-icon></v-btn>
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-4">
          <div v-if="detailsLoading" class="d-flex justify-center pa-10"><v-progress-circular indeterminate color="blue-darken-2" /></div>
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
                      <v-text-field v-else-if="field.type === 'time'" v-model="editFields[field.key]" type="time" density="compact" hide-details variant="outlined" clearable />
                      <v-textarea v-else-if="field.type === 'textarea'" v-model="editFields[field.key]" density="compact" hide-details variant="outlined" rows="3" auto-grow clearable />
                      <v-text-field v-else-if="field.type === 'number'" v-model.number="editFields[field.key]" type="number" density="compact" hide-details variant="outlined" clearable />
                      <v-text-field v-else v-model="editFields[field.key]" density="compact" hide-details variant="outlined" clearable />
                    </template>
                    <div v-else class="detail-value">{{ field.value }}</div>
                  </v-col>
                </v-row></v-expansion-panel-text>
              </v-expansion-panel>

              <template v-if="!isEditing">
                <v-expansion-panel v-if="testLines.length" :value="detailGroups.length">
                <v-expansion-panel-title>Линии контура ({{ testLines.length }})</v-expansion-panel-title>
                <v-expansion-panel-text><v-list density="compact" lines="two">
                  <v-list-item v-for="line in testLines" :key="Number(line.id)" prepend-icon="mdi-pipe"
                    :title="`Линия ${line.line_id} · ${nodeRange(line)}`" :subtitle="lineSummary(line)">
                    <template v-if="hasCoordinates(line)" #append><v-btn icon="mdi-crosshairs-gps" size="x-small" variant="text" @click.stop="locateRelation(line, `Линия ${line.line_id}`)" /></template>
                  </v-list-item>
                </v-list></v-expansion-panel-text>
              </v-expansion-panel>

              <v-expansion-panel v-if="boundaryNodes.length" :value="detailGroups.length + 1">
                <v-expansion-panel-title>Границы раздела ({{ boundaryNodes.length }})</v-expansion-panel-title>
                <v-expansion-panel-text><v-list density="compact">
                  <v-list-item v-for="(node, index) in boundaryNodes" :key="`${node.kind}-${node.node_id}-${index}`" prepend-icon="mdi-map-marker-radius-outline"
                    :title="`${node.kind}: ${node.node_name || `узел ${node.node_id}`}`">
                    <template v-if="hasCoordinates(node)" #append><v-btn icon="mdi-crosshairs-gps" size="x-small" variant="text" @click.stop="locateRelation(node, String(node.node_name || `Узел ${node.node_id}`))" /></template>
                  </v-list-item>
                </v-list></v-expansion-panel-text>
              </v-expansion-panel>

              <v-expansion-panel v-if="measures.length" :value="detailGroups.length + 2">
                <v-expansion-panel-title>Мероприятия ({{ measures.length }})</v-expansion-panel-title>
                <v-expansion-panel-text><v-chip v-for="measure in measures" :key="Number(measure.id)" class="ma-1" size="small" variant="tonal">{{ measure.measure_name || `Мероприятие ${measure.measure_id}` }}</v-chip></v-expansion-panel-text>
              </v-expansion-panel>

              <v-expansion-panel v-if="relatedDefects.length" :value="detailGroups.length + 3">
                <v-expansion-panel-title>Нарушения испытаний ({{ relatedDefects.length }})</v-expansion-panel-title>
                <v-expansion-panel-text><v-list density="compact" lines="two">
                  <v-list-item v-for="defect in relatedDefects" :key="Number(defect.id)" prepend-icon="mdi-alert-circle-outline"
                    :title="`Нарушение ${defect.id} · ${defect.state_name || 'без состояния'}`"
                    :subtitle="String(defect.description || defect.source_name || 'Описание не заполнено')" @click="openRelatedDefect(Number(defect.id))" />
                </v-list></v-expansion-panel-text>
              </v-expansion-panel>

              <v-expansion-panel v-if="documents.length" :value="detailGroups.length + 4">
                <v-expansion-panel-title>Программы и акты ({{ documents.length }})</v-expansion-panel-title>
                <v-expansion-panel-text><v-list density="compact">
                  <v-list-item v-for="document in documents" :key="`${document.kind}-${document.id}`" prepend-icon="mdi-file-document-outline"
                    :title="String(document.document_type_name || document.kind || 'Документ')" :subtitle="`${formatDate(document.date_doc)} · ${fileName(document.path)}`" />
                </v-list></v-expansion-panel-text>
              </v-expansion-panel>
              </template>
            </v-expansion-panels>
          </template>
        </v-card-text>
        <v-divider />
        <v-card-actions class="px-4 py-3">
          <v-btn v-if="!isEditing && selected && hasCoordinates(selected)" prepend-icon="mdi-crosshairs-gps" variant="tonal" color="blue-darken-2"
            @click="locate(selected, selected.name || `Опрессовка ${selected.id}`)">На карте</v-btn>
          <v-btn v-if="mutationsEnabled && (!isEditing)" variant="text" prepend-icon="mdi-pencil" @click="startEdit">Редактировать</v-btn>
          <v-btn
            v-if="!isEditing && selected && !isNew"
            variant="text"
            prepend-icon="mdi-file-word-outline"
            :loading="exportingWord"
            @click="exportWord"
          >Word</v-btn>
          <v-btn v-if="mutationsEnabled && !isEditing && selected && !isNew" color="error" variant="text" prepend-icon="mdi-delete" :loading="deleting" @click="deletePressureTest(selected.id)">Удалить</v-btn>
          <v-spacer />
          <template v-if="isEditing">
            <v-btn v-if="mutationsEnabled" variant="text" @click="cancelEdit">Отмена</v-btn>
            <v-btn v-if="mutationsEnabled" color="blue-darken-2" variant="flat" :loading="saving" @click="saveChanges">Сохранить</v-btn>
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
import { fastApiService, type PressureTestDetails, type PressureTestLookups, type PressureTestSummary } from '~/services/fastApiService'

export interface PressureTestJournalScope { lineId?: number; nodeId?: number; testId?: number }
const emit = defineEmits<{
  'locate-pressure-test': [coordinates: { longitude: number; latitude: number; id: number; label: string }]
  'open-defect': [defectId: number]
}>()
const { isMobile } = useMobile()
const mutationsEnabled = useMutationsEnabled()
const visible = ref(false), loading = ref(false), error = ref('')
const items = ref<PressureTestSummary[]>([])
const total = ref(0), pages = ref(0), page = ref(1)
const pageSize = 50
const search = ref('')
const stateId = ref<number | undefined>(), testTypeId = ref<number | undefined>()
const heatSourceId = ref<number | undefined>(), responsibleId = ref<number | undefined>()
const approved = ref<boolean | undefined>(), dateFrom = ref(''), dateTo = ref('')
const scope = reactive<PressureTestJournalScope>({})
const lookups = reactive<PressureTestLookups>({ states: [], test_types: [], heat_sources: [], pump_objects: [], subdivisions: [], document_types: [], responsible_people: [] })
const approvalOptions = [{ title: 'Утверждено', value: true }, { title: 'Не утверждено', value: false }]
let searchTimer: ReturnType<typeof setTimeout> | undefined
const detailsVisible = ref(false), detailsLoading = ref(false), detailsError = ref('')
const selected = ref<PressureTestDetails | null>(null)

const isEditing = ref(false)
const isNew = ref(false)
const saving = ref(false)
const creating = ref(false)
const deleting = ref(false)
const exportingWord = ref(false)
const editFields = ref<Record<string, any>>({})

const scopeTitle = computed(() => scope.lineId ? `опрессовки трубопровода ${scope.lineId}` : scope.nodeId ? `опрессовки у узла ${scope.nodeId}` : 'вся тепловая сеть')
const formatDate = (value: unknown) => {
  if (!value) return '—'
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[3]}.${match[2]}.${match[1]}` : String(value)
}
const formatRange = (start: unknown, finish: unknown) => [formatDate(start), formatDate(finish)].filter((v, i, a) => v !== '—' && a.indexOf(v) === i).join(' — ') || '—'
const formatValue = (value: unknown) => value === null || value === undefined || value === '' ? '—' : typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? formatDate(value) : String(value)
const pressure = (value: unknown) => value === null || value === undefined || value === '' ? '—' : `${value} кгс/см²`
const stateColor = (state: number | null) => state === 3 ? 'success' : state === 2 ? 'warning' : state === 1 ? 'info' : 'grey'
const hasCoordinates = (item: { longitude?: unknown; latitude?: unknown }) => Number.isFinite(Number(item.longitude)) && Number.isFinite(Number(item.latitude))
const fileName = (path: unknown) => String(path || 'Файл не указан').split(/[\\/]/).pop() || 'Файл'
const nodeRange = (line: Record<string, unknown>) => [line.start_node_name, line.end_node_name].filter(Boolean).join(' — ') || 'узлы не указаны'
const lineSummary = (line: Record<string, unknown>) => [line.diameter && `DN ${line.diameter}`, line.length && `длина ${line.length} м`, line.tubing_type_name].filter(Boolean).join(' · ') || 'Параметры участка не заполнены'

const loadLookups = async () => { if (!lookups.states.length) Object.assign(lookups, await fastApiService.getPressureTestLookups()) }
const loadTests = async () => {
  loading.value = true; error.value = ''
  try {
    const response = await fastApiService.getPressureTests({ page: page.value, page_size: pageSize, state_id: stateId.value,
      test_type_id: testTypeId.value, heat_source_id: heatSourceId.value, responsible_id: responsibleId.value,
      approved: approved.value, date_from: dateFrom.value || undefined, date_to: dateTo.value || undefined,
      line_id: scope.lineId, node_id: scope.nodeId, search: search.value.trim() || undefined })
    items.value = response.items; total.value = response.total; pages.value = response.pages
  } catch (loadError: any) { error.value = loadError?.data?.detail || loadError?.message || 'Не удалось загрузить журнал опрессовок' }
  finally { loading.value = false }
}
const openDetails = async (id: number) => {
  detailsVisible.value = true; detailsLoading.value = true; detailsError.value = ''; selected.value = null
  try { selected.value = await fastApiService.getPressureTest(id) }
  catch (loadError: any) { detailsError.value = loadError?.data?.detail || loadError?.message || 'Не удалось открыть карточку опрессовки' }
  finally { detailsLoading.value = false }
}
const openDialog = async (nextScope: PressureTestJournalScope = {}) => {
  Object.assign(scope, { lineId: undefined, nodeId: undefined, testId: undefined }, nextScope)
  page.value = 1; visible.value = true
  try { await Promise.all([loadLookups(), loadTests()]); if (nextScope.testId) await openDetails(nextScope.testId) }
  catch (loadError: any) { error.value = loadError?.message || 'Не удалось открыть журнал опрессовок' }
}
const clearScope = () => { scope.lineId = undefined; scope.nodeId = undefined; page.value = 1; void loadTests() }
const resetFilters = () => {
  search.value = ''; stateId.value = undefined; testTypeId.value = undefined; heatSourceId.value = undefined
  responsibleId.value = undefined; approved.value = undefined; dateFrom.value = ''; dateTo.value = ''; page.value = 1; void loadTests()
}
const locate = (item: PressureTestSummary, label: string) => {
  if (!hasCoordinates(item)) return
  emit('locate-pressure-test', { longitude: Number(item.longitude), latitude: Number(item.latitude), id: item.id, label })
  detailsVisible.value = false; visible.value = false
}
const locateRelation = (relation: Record<string, unknown>, label: string) => {
  if (!selected.value || !hasCoordinates(relation)) return
  emit('locate-pressure-test', { longitude: Number(relation.longitude), latitude: Number(relation.latitude), id: selected.value.id, label })
  detailsVisible.value = false; visible.value = false
}
const openRelatedDefect = (id: number) => { detailsVisible.value = false; visible.value = false; emit('open-defect', id) }

const buildFields = (entries: Array<[string, unknown, string?, string?, any[]?]>) => {
  return entries
    .filter(([, value]) => isEditing.value || (value !== null && value !== undefined && value !== ''))
    .map(([label, value, key, type, items]) => ({
      label, value: formatValue(value), rawValue: value, key, type: type || 'text', items
    }))
}

const detailGroups = computed(() => {
  const item = isEditing.value ? editFields.value : selected.value
  if (!item && !isNew.value) return []

  return [
    { title: 'Контур испытаний', fields: buildFields([
      ['Наименование', item?.name, 'name', 'text'], ['Описание контура', item?.contour_description, 'contour_description', 'textarea'], ['Граница раздела', item?.boundary_description, 'boundary_description', 'textarea'],
      ['Источник тепла', item?.heat_source_name, 'heat_source_id', 'select', lookups.heat_sources], ['Вид испытания', item?.test_type_name, 'test_type_id', 'select', lookups.test_types], ['Состояние', item?.state_name, 'state_id', 'select', lookups.states],
      ['Утверждение', item?.approval_name, 'approval_id', 'select', approvalOptions], ['Ответственный', item?.responsible_name, 'responsible_id', 'select', lookups.responsible_people], ['Подразделение', item?.subdivision_name, 'subdivision_id', 'select', lookups.subdivisions],
      ['Узел опрессовочного насоса', item?.pump_node_name || item?.pump_node_id, 'pump_node_id', 'number'], ['Объект насоса', item?.pump_object_name, 'pump_object_id', 'select', lookups.pump_objects]
    ]) },
    { title: 'План опрессовки', fields: buildFields([
      ['Начало по плану', item?.planned_start, 'planned_start', 'date'], ['Окончание по плану', item?.planned_finish, 'planned_finish', 'date'], ['Утверждение плана', item?.plan_approved_on, 'plan_approved_on', 'date'],
      ['Давление I этапа, кгс/см²', item?.stage_one_pressure, 'stage_one_pressure', 'number'], ['Давление II этапа, кгс/см²', item?.stage_two_pressure, 'stage_two_pressure', 'number'],
      ['Температура расхолаживания, °C', item?.cooling_temperature, 'cooling_temperature', 'number'], ['Количество звеньев обходчиков', item?.inspection_team_count, 'inspection_team_count', 'number']
    ]) },
    { title: 'Проведение и результат', fields: buildFields([
      ['Дата проведения', item?.tested_at, 'tested_at', 'date'], ['Время проведения', item?.tested_time, 'tested_time', 'time'], ['Продолжительность, мин', item?.duration_minutes, 'duration_minutes', 'number'],
      ['Решение комиссии', item?.commission_decision, 'commission_decision', 'text'], ['Отчёт', item?.report, 'report', 'textarea'], ['Текст нарушений', item?.defects_text, 'defects_text', 'textarea'],
      ['Неучаствующие трубопроводы', item?.excluded_pipelines, 'excluded_pipelines', 'textarea'], ['Непредупреждённые потребители', item?.unnotified_consumers, 'unnotified_consumers', 'number'],
      ['Список непредупреждённых потребителей', item?.unnotified_consumer_list, 'unnotified_consumer_list', 'textarea'], ['Дата утверждения акта', item?.act_approved_on, 'act_approved_on', 'date'],
      ['Файл акта', item?.act_file, 'act_file', 'text'], ['Примечание', item?.note, 'note', 'textarea']
    ]) },
    { title: 'Ответственные и руководители', fields: buildFields([
      ['Утверждающий', item?.approver_name, 'approver_id', 'select', lookups.responsible_people], ['Руководитель испытаний', item?.test_manager_name, 'test_manager_id', 'select', lookups.responsible_people], ['Обеспечение режимов', item?.mode_manager_name, 'mode_manager_id', 'select', lookups.responsible_people],
      ['Бланк переключений', item?.switching_manager_name, 'switching_manager_id', 'select', lookups.responsible_people], ['Манометры и расходомеры', item?.meter_manager_name, 'meter_manager_id', 'select', lookups.responsible_people],
      ['Автотранспорт', item?.transport_manager_name, 'transport_manager_id', 'select', lookups.responsible_people], ['Электрооборудование', item?.electrical_manager_name, 'electrical_manager_id', 'select', lookups.responsible_people],
      ['Безопасность контура источника', item?.source_safety_manager_name, 'source_safety_manager_id', 'select', lookups.responsible_people], ['Оповещение населения', item?.public_notification_manager_name, 'public_notification_manager_id', 'select', lookups.responsible_people]
    ]) }
  ].filter(group => group.fields.length)
})
const testLines = computed(() => selected.value?.relations?.lines || [])
const boundaryNodes = computed(() => selected.value?.relations?.boundary_nodes || [])
const measures = computed(() => selected.value?.relations?.measures || [])
const relatedDefects = computed(() => selected.value?.relations?.defects || [])
const documents = computed(() => selected.value?.relations?.documents || [])

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

const createPressureTest = async () => {
  creating.value = true
  await loadLookups()
  creating.value = false
  selected.value = null
  isEditing.value = true
  isNew.value = true
  editFields.value = {}
  detailsVisible.value = true
}

const saveChanges = async () => {
  saving.value = true
  try {
    if (isNew.value) {
      const result = await fastApiService.createObject('opres', editFields.value)
      if (result && result.id) {
        isEditing.value = false
        await loadTests()
        await openDetails(result.id)
      }
    } else if (selected.value) {
      const changes: Record<string, any> = {}
      for (const [k, v] of Object.entries(editFields.value)) {
        if (v !== selected.value[k as keyof PressureTestDetails]) {
          changes[k] = v
        }
      }
      if (Object.keys(changes).length > 0) {
        await fastApiService.updateObjectAttributes('opres', selected.value.id.toString(), changes)
      }
      isEditing.value = false
      await loadTests()
      await openDetails(selected.value.id)
    }
  } catch (e: any) {
    detailsError.value = 'Ошибка при сохранении: ' + (e?.message || '')
  } finally {
    saving.value = false
  }
}

const deletePressureTest = async (id: number) => {
  if (!confirm(`Вы действительно хотите удалить опрессовку #${id}?`)) return
  try {
    deleting.value = true
    await fastApiService.deleteObject('opres', id)
    detailsVisible.value = false
    await loadTests()
  } catch (e: any) {
    detailsError.value = 'Ошибка при удалении: ' + (e?.message || '')
  } finally {
    deleting.value = false
  }
}

const exportWord = async () => {
  if (!selected.value) return
  exportingWord.value = true
  try {
    const { blob, filename } = await fastApiService.downloadOpsWordReport('opres', selected.value.id)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch (e: any) {
    detailsError.value = e?.message || 'Не удалось сформировать Word'
  } finally {
    exportingWord.value = false
  }
}

watch(page, () => { if (visible.value) void loadTests() })
watch([stateId, testTypeId, heatSourceId, responsibleId, approved, dateFrom, dateTo], () => { if (visible.value) { page.value = 1; void loadTests() } })
watch(search, () => { if (!visible.value) return; if (searchTimer) clearTimeout(searchTimer); searchTimer = setTimeout(() => { page.value = 1; void loadTests() }, 350) })
defineExpose({ openDialog })
</script>

<style scoped>
.pressure-journal { height: min(90vh, 900px); display: flex; flex-direction: column; }
.pressure-filters { flex-shrink: 0; background: #fafafa; }
.pressure-table-wrap { min-height: 280px; overflow: auto; flex: 1; }
.pressure-table { min-width: 1340px; }
.pressure-row { cursor: pointer; }
.result-cell { max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pressure-empty { min-height: 320px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 32px; }
.detail-label { color: #78909c; font-size: .72rem; font-weight: 600; letter-spacing: .03em; text-transform: uppercase; }
.detail-value { color: #263238; font-size: .9rem; margin-top: 3px; overflow-wrap: anywhere; }
@media (max-width: 600px) { .pressure-journal { height: 100dvh; } }
</style>
