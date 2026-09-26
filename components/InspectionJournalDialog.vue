<template>

  <Teleport to="body">

    <v-dialog v-model="visible" :fullscreen="isMobile" max-width="1240" scrollable>

      <v-card class="inspection-journal" :rounded="isMobile ? 0 : 'lg'">

        <v-card-title class="d-flex align-center ga-3 px-4 py-3">

          <v-avatar color="teal-lighten-5" size="40">

            <v-icon color="teal-darken-2">mdi-clipboard-search-outline</v-icon>

          </v-avatar>

          <div class="flex-grow-1" style="min-width: 0">

            <div class="text-subtitle-1 font-weight-bold">Журнал осмотров</div>

            <div class="text-caption text-medium-emphasis text-truncate">

              {{ scopeTitle }} · найдено {{ total }}

            </div>

          </div>

          <v-btn v-if="mutationsEnabled" color="primary" variant="flat" prepend-icon="mdi-plus" class="mr-2" @click="createInspection" :loading="creating">

            Создать

          </v-btn>

          <v-btn icon variant="text" aria-label="Закрыть журнал" @click="visible = false">

            <v-icon>mdi-close</v-icon>

          </v-btn>

        </v-card-title>



        <v-divider />



        <div class="pa-3 pa-md-4 inspection-filters">

          <v-row dense>

            <v-col cols="12" md="4">

              <v-text-field

                v-model="search"

                label="Поиск по ID, названию, акту или результату"

                prepend-inner-icon="mdi-magnify"

                density="compact"

                variant="outlined"

                clearable

                hide-details

              />

            </v-col>

            <v-col cols="12" sm="6" md="3">

              <v-select

                v-model="responsibleId"

                :items="lookups.responsible_people"

                item-title="name"

                item-value="id"

                label="Ответственный"

                density="compact"

                variant="outlined"

                clearable

                hide-details

              />

            </v-col>

            <v-col cols="12" sm="6" md="2">

              <v-select

                v-model="coverageFilter"

                :items="coverageOptions"

                item-title="title"

                item-value="value"

                label="Участки"

                density="compact"

                variant="outlined"

                clearable

                hide-details

              />

            </v-col>

            <v-col cols="12" sm="6" md="3">

              <v-select

                v-model="defectFilter"

                :items="defectOptions"

                item-title="title"

                item-value="value"

                label="Нарушения"

                density="compact"

                variant="outlined"

                clearable

                hide-details

              />

            </v-col>

            <v-col cols="12" sm="6" md="3">

              <v-text-field v-model="dateFrom" type="date" label="С даты" density="compact" variant="outlined" hide-details />

            </v-col>

            <v-col cols="12" sm="6" md="3">

              <v-text-field v-model="dateTo" type="date" label="По дату" density="compact" variant="outlined" hide-details />

            </v-col>

          </v-row>



          <div class="d-flex align-center flex-wrap ga-2 mt-3">

            <v-chip v-if="scope.lineId" size="small" color="primary" closable @click:close="clearScope">

              Трубопровод {{ scope.lineId }}

            </v-chip>

            <v-chip v-if="scope.nodeId" size="small" color="primary" closable @click:close="clearScope">

              Узел {{ scope.nodeId }}

            </v-chip>

            <v-spacer />

            <v-btn variant="text" prepend-icon="mdi-filter-remove-outline" @click="resetFilters">Сбросить</v-btn>

            <v-btn color="primary" prepend-icon="mdi-refresh" :loading="loading" @click="loadInspections">Обновить</v-btn>

          </div>

        </div>



        <v-divider />



        <v-card-text class="pa-0 inspection-table-wrap">

          <v-progress-linear v-if="loading" indeterminate color="primary" />

          <v-alert v-if="error" type="error" variant="tonal" class="ma-4">{{ error }}</v-alert>



          <div v-else-if="!loading && items.length === 0" class="inspection-empty">

            <v-icon size="56" color="grey-lighten-1">mdi-clipboard-search-outline</v-icon>

            <div class="text-subtitle-1 mt-3">Осмотры не найдены</div>

            <div class="text-body-2 text-medium-emphasis mt-1">

              Измените фильтры или проверьте загрузку исторических данных TGID.

            </div>

          </div>



          <v-table v-else fixed-header hover density="compact" class="inspection-table">

            <thead>

              <tr>

                <th>ID</th>

                <th>Дата</th>

                <th>Контур осмотра</th>

                <th>Ответственный</th>

                <th>Линии</th>

                <th>Осмотрено</th>

                <th>Нарушения</th>

                <th>Результат</th>

                <th class="text-right">Действия</th>

              </tr>

            </thead>

            <tbody>

              <tr v-for="item in items" :key="item.id" class="inspection-row" @click="openDetails(item.id)">

                <td class="font-weight-medium">{{ item.id }}</td>

                <td>{{ formatDate(item.inspected_on) }}</td>

                <td>

                  <div>{{ item.name || `Осмотр ${item.id}` }}</div>

                  <div v-if="item.act_number" class="text-caption text-medium-emphasis">Акт {{ item.act_number }}</div>

                </td>

                <td>{{ item.responsible_name || '—' }}</td>

                <td>{{ item.line_count }}</td>

                <td>

                  <v-chip size="x-small" :color="item.inspected_section_count ? 'success' : 'grey'" variant="tonal">

                    {{ item.inspected_section_count }}

                  </v-chip>

                </td>

                <td>

                  <v-chip size="x-small" :color="item.defect_count ? 'error' : 'success'" variant="tonal">

                    {{ item.defect_count }}

                  </v-chip>

                </td>

                <td class="result-cell">{{ item.results || item.planned_measures || item.note || '—' }}</td>

                <td class="text-right text-no-wrap">

                  <v-btn

                    v-if="hasCoordinates(item)"

                    icon="mdi-crosshairs-gps"

                    size="x-small"

                    variant="text"

                    color="primary"

                    aria-label="Показать контур осмотра на карте"

                    @click.stop="locate(item, item.name || `Осмотр ${item.id}`)"

                  />

                  <v-btn icon="mdi-chevron-right" size="x-small" variant="text" @click.stop="openDetails(item.id)" />

                </td>

              </tr>

            </tbody>

          </v-table>

        </v-card-text>



        <v-divider />

        <v-card-actions class="px-4 py-2">

          <span class="text-caption text-medium-emphasis">Страница {{ page }}{{ pages ? ` из ${pages}` : '' }}</span>

          <v-spacer />

          <v-pagination v-if="pages > 1" v-model="page" :length="pages" :total-visible="isMobile ? 3 : 7" density="compact" />

        </v-card-actions>

      </v-card>

    </v-dialog>



    <v-dialog v-model="detailsVisible" :fullscreen="isMobile" max-width="980" scrollable>

      <v-card :rounded="isMobile ? 0 : 'lg'">

        <v-card-title class="d-flex align-center ga-3 px-4 py-3">

          <v-icon color="teal-darken-2">mdi-clipboard-search-outline</v-icon>

          <div class="flex-grow-1">

            <div class="text-subtitle-1 font-weight-bold">{{ selected?.name || `Осмотр ${selected?.id || ''}` }}</div>

            <div class="text-caption text-medium-emphasis">

              {{ formatDate(selected?.inspected_on) }} · линий {{ selected?.line_count || 0 }} · нарушений {{ selected?.defect_count || 0 }}

            </div>

          </div>

          <v-btn v-if="mutationsEnabled && selected" icon variant="text" aria-label="Удалить" color="error" class="mr-1" @click="deleteInspection(selected.id)" :loading="deleting" title="Удалить осмотр">

            <v-icon>mdi-delete</v-icon>

          </v-btn>

          <v-btn icon variant="text" @click="detailsVisible = false"><v-icon>mdi-close</v-icon></v-btn>

        </v-card-title>

        <v-divider />



        <v-card-text class="pa-4">

          <div v-if="detailsLoading" class="d-flex justify-center pa-10">

            <v-progress-circular indeterminate color="primary" />

          </div>

          <v-alert v-else-if="detailsError" type="error" variant="tonal">{{ detailsError }}</v-alert>

          <template v-else-if="selected">

            <v-expansion-panels multiple variant="accordion" :model-value="[0, 1]">

              <v-expansion-panel v-for="(group, index) in detailGroups" :key="group.title" :value="index">

                <v-expansion-panel-title>{{ group.title }}</v-expansion-panel-title>

                <v-expansion-panel-text>

                  <v-row dense>

                    <v-col v-for="field in group.fields" :key="field.label" cols="12" sm="6">

                      <div class="detail-label mb-1">{{ field.label }}</div>

                      <template v-if="isEditing && field.key">

                        <v-select

                          v-if="field.type === 'select'"

                          v-model="editFields[field.key]"

                          :items="field.items"

                          item-title="name"

                          item-value="id"

                          density="compact"

                          hide-details

                          variant="outlined"

                          clearable

                        />

                        <v-text-field

                          v-else-if="field.type === 'date'"

                          v-model="editFields[field.key]"

                          type="date"

                          density="compact"

                          hide-details

                          variant="outlined"

                        />

                        <v-textarea

                          v-else-if="field.type === 'textarea'"

                          v-model="editFields[field.key]"

                          rows="2"

                          density="compact"

                          hide-details

                          variant="outlined"

                        />

                        <v-text-field

                          v-else

                          v-model="editFields[field.key]"

                          density="compact"

                          hide-details

                          variant="outlined"

                        />

                      </template>

                      <div v-else class="detail-value">{{ field.value }}</div>

                    </v-col>

                  </v-row>

                </v-expansion-panel-text>

              </v-expansion-panel>



              <v-expansion-panel v-if="inspectionLines.length && !isEditing" :value="detailGroups.length">

                <v-expansion-panel-title>Линии контура ({{ inspectionLines.length }})</v-expansion-panel-title>

                <v-expansion-panel-text>

                  <v-list density="compact" lines="two">

                    <v-list-item

                      v-for="line in inspectionLines"

                      :key="Number(line.id)"

                      prepend-icon="mdi-pipe"

                      :title="`Линия ${line.line_id} · ${nodeRange(line)}`"

                      :subtitle="lineSummary(line)"

                    >

                      <template v-if="hasCoordinates(line)" #append>

                        <v-btn

                          icon="mdi-crosshairs-gps"

                          size="x-small"

                          variant="text"

                          @click.stop="locateRelation(line, `Линия ${line.line_id}`)"

                        />

                      </template>

                    </v-list-item>

                  </v-list>

                </v-expansion-panel-text>

              </v-expansion-panel>



              <v-expansion-panel v-if="riskFactors.length" :value="detailGroups.length + 1">

                <v-expansion-panel-title>Результаты по участкам ({{ riskFactors.length }})</v-expansion-panel-title>

                <v-expansion-panel-text>

                  <v-list density="compact" lines="two">

                    <v-list-item

                      v-for="risk in riskFactors"

                      :key="Number(risk.id)"

                      prepend-icon="mdi-shield-search"

                      :title="`Участок ${risk.legacy_pipe_section_id || 'не указан'}`"

                      :subtitle="riskSummary(risk)"

                    />

                  </v-list>

                </v-expansion-panel-text>

              </v-expansion-panel>



              <v-expansion-panel v-if="relatedDefects.length && !isEditing" :value="detailGroups.length + 2">

                <v-expansion-panel-title>Выявленные нарушения ({{ relatedDefects.length }})</v-expansion-panel-title>

                <v-expansion-panel-text>

                  <v-list density="compact" lines="two">

                    <v-list-item

                      v-for="defect in relatedDefects"

                      :key="Number(defect.id)"

                      prepend-icon="mdi-alert-circle-outline"

                      :title="`Нарушение ${defect.id} · ${defect.state_name || 'без состояния'}`"

                      :subtitle="String(defect.description || defect.source_name || 'Описание не заполнено')"

                      @click="openRelatedDefect(Number(defect.id))"

                    />

                  </v-list>

                </v-expansion-panel-text>

              </v-expansion-panel>



              <v-expansion-panel v-if="documents.length && !isEditing" :value="detailGroups.length + 3">

                <v-expansion-panel-title>Документы</v-expansion-panel-title>

                <v-expansion-panel-text>

                  <v-list density="compact">

                    <v-list-item

                      v-for="document in documents"

                      :key="Number(document.id)"

                      prepend-icon="mdi-file-document-outline"

                      :title="String(document.document_type_name || 'Документ')"

                      :subtitle="`${formatDate(document.date_doc)} · ${fileName(document.path)}`"

                    />

                  </v-list>

                </v-expansion-panel-text>

              </v-expansion-panel>

            </v-expansion-panels>

          </template>

        </v-card-text>



        <v-divider />

        <v-card-actions class="px-4 py-3">

          <v-btn

            v-if="selected && hasCoordinates(selected) && !isEditing"

            prepend-icon="mdi-crosshairs-gps"

            variant="tonal"

            color="primary"

            @click="locate(selected, selected.name || `Осмотр ${selected.id}`)"

          >На карте</v-btn>

          <v-spacer />

          <template v-if="isEditing">

            <v-btn v-if="mutationsEnabled" variant="text" @click="cancelEdit">Отмена</v-btn>

            <v-btn v-if="mutationsEnabled"

              color="primary"

              variant="elevated"

              :loading="saving"

              @click="saveChanges"

            >

              Сохранить

            </v-btn>

          </template>

          <template v-else>

            <v-btn v-if="mutationsEnabled" color="primary" variant="tonal" @click="startEdit">Редактировать</v-btn>

            <v-btn
              v-if="selected"
              variant="tonal"
              prepend-icon="mdi-file-word-outline"
              :loading="exportingWord"
              @click="exportWord"
            >Word</v-btn>

            <v-btn variant="text" @click="detailsVisible = false">Закрыть</v-btn>

          </template>

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

  type InspectionDetails,

  type InspectionLookups,

  type InspectionSummary

} from '~/services/fastApiService'



export interface InspectionJournalScope {

  lineId?: number

  nodeId?: number

  inspectionId?: number

}



const emit = defineEmits<{

  'locate-inspection': [coordinates: { longitude: number; latitude: number; id: number; label: string }]

  'open-defect': [defectId: number]

}>()

const { isMobile } = useMobile()
const mutationsEnabled = useMutationsEnabled()

const visible = ref(false)

const loading = ref(false)

const error = ref('')

const items = ref<InspectionSummary[]>([])

const total = ref(0)

const pages = ref(0)

const page = ref(1)

const pageSize = 50

const search = ref('')

const responsibleId = ref<number | undefined>()

const coverageFilter = ref<boolean | undefined>()

const defectFilter = ref<boolean | undefined>()

const dateFrom = ref('')

const dateTo = ref('')

const scope = reactive<InspectionJournalScope>({})

const lookups = reactive<InspectionLookups>({

  responsible_people: [], subdivisions: [], legacy_states: [], document_types: []

})

const coverageOptions = [

  { title: 'Есть результаты', value: true },

  { title: 'Нет результатов', value: false }

]

const defectOptions = [

  { title: 'Есть нарушения', value: true },

  { title: 'Без нарушений', value: false }

]

let searchTimer: ReturnType<typeof setTimeout> | undefined



const detailsVisible = ref(false)

const detailsLoading = ref(false)

const detailsError = ref('')

const selected = ref<InspectionDetails | null>(null)

const creating = ref(false)

const deleting = ref(false)
const exportingWord = ref(false)



const isEditing = ref(false)

const isNew = ref(false)

const saving = ref(false)

const editFields = ref<Record<string, any>>({})



const scopeTitle = computed(() => {

  if (scope.lineId) return `осмотры трубопровода ${scope.lineId}`

  if (scope.nodeId) return `осмотры прилегающих трубопроводов узла ${scope.nodeId}`

  return 'вся тепловая сеть'

})

const formatDate = (value: unknown) => {

  if (!value) return '—'

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)

  return match ? `${match[3]}.${match[2]}.${match[1]}` : String(value)

}

const formatValue = (value: unknown) => {

  if (value === null || value === undefined || value === '') return '—'

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return formatDate(value)

  if (typeof value === 'boolean') return value ? 'Да' : 'Нет'

  return String(value)

}

const hasCoordinates = (item: { longitude?: unknown; latitude?: unknown }) =>

  Number.isFinite(Number(item.longitude)) && Number.isFinite(Number(item.latitude))

const fileName = (path: unknown) => String(path || 'Файл не указан').split(/[\\/]/).pop() || 'Файл'

const nodeRange = (line: Record<string, unknown>) =>

  [line.start_node_name, line.end_node_name].filter(Boolean).join(' — ') || 'узлы не указаны'

const lineSummary = (line: Record<string, unknown>) => [

  line.diameter && `DN ${line.diameter}`,

  line.length && `длина ${line.length} м`,

  line.tubing_type_name

].filter(Boolean).join(' · ') || 'Параметры участка не заполнены'

const riskSummary = (risk: Record<string, unknown>) => [

  risk.outer_view_name && `внешний вид: ${risk.outer_view_name}`,

  risk.equipment_state_name && `оборудование: ${risk.equipment_state_name}`,

  risk.pipe_metal_state_name && `металл: ${risk.pipe_metal_state_name}`,

  risk.corrosion_flow_name && `коррозия подачи: ${risk.corrosion_flow_name}`,

  risk.corrosion_return_name && `коррозия обратки: ${risk.corrosion_return_name}`,

  risk.ground_name && `грунт: ${risk.ground_name}`

].filter(Boolean).join(' · ') || 'Параметры осмотра не заполнены'



const loadLookups = async () => {

  if (lookups.responsible_people.length) return

  Object.assign(lookups, await fastApiService.getInspectionLookups())

}

const loadInspections = async () => {

  loading.value = true

  error.value = ''

  try {

    const response = await fastApiService.getInspections({

      page: page.value,

      page_size: pageSize,

      responsible_id: responsibleId.value,

      has_defects: defectFilter.value,

      has_inspected_sections: coverageFilter.value,

      date_from: dateFrom.value || undefined,

      date_to: dateTo.value || undefined,

      line_id: scope.lineId,

      node_id: scope.nodeId,

      search: (search.value || '').trim() || undefined

    })

    items.value = response.items

    total.value = response.total

    pages.value = response.pages

  } catch (loadError: any) {

    error.value = loadError?.data?.detail || loadError?.message || 'Не удалось загрузить журнал осмотров'

  } finally {

    loading.value = false

  }

}

const openDetails = async (id: number) => {

  detailsVisible.value = true

  detailsLoading.value = true

  detailsError.value = ''

  selected.value = null

  try {

    selected.value = await fastApiService.getInspection(id)

  } catch (loadError: any) {

    detailsError.value = loadError?.data?.detail || loadError?.message || 'Не удалось открыть карточку осмотра'

  } finally {

    detailsLoading.value = false

  }

}

const openDialog = async (nextScope: InspectionJournalScope = {}) => {

  Object.assign(scope, { lineId: undefined, nodeId: undefined, inspectionId: undefined }, nextScope)

  page.value = 1

  visible.value = true

  try {

    await Promise.all([loadLookups(), loadInspections()])

    if (nextScope.inspectionId) await openDetails(nextScope.inspectionId)

  } catch (loadError: any) {

    error.value = loadError?.message || 'Не удалось открыть журнал осмотров'

  }

}

const clearScope = () => {

  scope.lineId = undefined

  scope.nodeId = undefined

  page.value = 1

  void loadInspections()

}



const createInspection = () => {

  isNew.value = true

  isEditing.value = true

  editFields.value = {

    name: 'Новый осмотр'

  }

  selected.value = null

  detailsVisible.value = true

  detailsError.value = ''

}



const startEdit = () => {

  if (!selected.value) return

  isNew.value = false

  isEditing.value = true

  editFields.value = { ...selected.value }

}



const cancelEdit = () => {

  isEditing.value = false

  if (isNew.value) {

    detailsVisible.value = false

  }

}



const saveChanges = async () => {

  saving.value = true

  try {

    if (isNew.value) {

      const result = await fastApiService.createObject('osmotr', editFields.value)

      if (result && result.id) {

        isEditing.value = false

        await loadInspections()

        await openDetails(result.id)

      }

    } else if (selected.value) {

      const changes: Record<string, any> = {}

      for (const [k, v] of Object.entries(editFields.value)) {

        if (v !== selected.value[k as keyof InspectionDetails]) {

          changes[k] = v

        }

      }

      if (Object.keys(changes).length > 0) {

        await fastApiService.updateObjectAttributes('osmotr', selected.value.id.toString(), changes)

      }

      isEditing.value = false

      await loadInspections()

      await openDetails(selected.value.id)

    }

  } catch (e: any) {

    detailsError.value = 'Ошибка при сохранении: ' + (e?.message || '')

  } finally {

    saving.value = false

  }

}



const deleteInspection = async (id: number) => {

  if (!confirm(`Вы действительно хотите удалить осмотр #${id}?`)) return

  try {

    deleting.value = true

    await fastApiService.deleteObject('osmotr', id)

    detailsVisible.value = false

    await loadInspections()

  } catch (e: any) {

    detailsError.value = 'Ошибка при удалении осмотра: ' + (e?.message || '')

  } finally {

    deleting.value = false

  }

}

const resetFilters = () => {

  search.value = ''

  responsibleId.value = undefined

  coverageFilter.value = undefined

  defectFilter.value = undefined

  dateFrom.value = ''

  dateTo.value = ''

  page.value = 1

  void loadInspections()

}

const locate = (item: InspectionSummary, label: string) => {

  if (!hasCoordinates(item)) return

  emit('locate-inspection', {

    longitude: Number(item.longitude), latitude: Number(item.latitude), id: item.id, label

  })

  detailsVisible.value = false

  visible.value = false

}

const locateRelation = (relation: Record<string, unknown>, label: string) => {

  if (!selected.value || !hasCoordinates(relation)) return

  emit('locate-inspection', {

    longitude: Number(relation.longitude), latitude: Number(relation.latitude), id: selected.value.id, label

  })

  detailsVisible.value = false

  visible.value = false

}

const openRelatedDefect = (id: number) => {

  detailsVisible.value = false

  visible.value = false

  emit('open-defect', id)

}

const buildFields = (entries: Array<[string, unknown, string?, string?, any?] | null>) => {

  return entries

    .filter(e => e != null)

    .map(e => e!)

    .filter(([, value]) => isEditing.value || (value !== null && value !== undefined && value !== ''))

    .map(([label, value, key, type, items]) => ({

      label,

      value: formatValue(value),

      rawValue: value,

      key,

      type: type || 'text',

      items

    }))

}



const detailGroups = computed(() => {

  const item = isEditing.value ? editFields.value : selected.value

  if (!item && !isNew.value) return []



  return [

    { title: 'Осмотр', fields: buildFields([

      ['Наименование контура', item?.name, 'name', 'text'], ['Дата осмотра', item?.inspected_on, 'inspected_on', 'date'],

      ['Номер акта', item?.act_number, 'act_number', 'text'], ['Ответственный', item?.responsible_name, 'responsible_id', 'select', lookups.responsible_people],

      ['Подразделение', item?.subdivision_name], ['Количество линий', item?.line_count],

      ['Осмотрено участков', item?.inspected_section_count], ['Выявлено нарушений', item?.defect_count],

      ['Предполагаемые причины разрушения изоляции/коррозии', item?.suspected_causes, 'suspected_causes', 'textarea'],

      ['Результаты осмотра', item?.results, 'results', 'textarea'], ['Намеченные мероприятия', item?.planned_measures, 'planned_measures', 'textarea'],

      ['Восстановление прокладки', item?.restoration_measures, 'restoration_measures', 'textarea'], ['Примечание', item?.note, 'note', 'textarea']

    ]) },

    { title: 'Утверждение и комиссия', fields: buildFields([

      ['ФИО утверждающего', item?.approver_name, 'approver_name', 'text'], ['Должность утверждающего', item?.approver_position, 'approver_position', 'text'],

      ['Служба утверждающего', item?.approver_service, 'approver_service', 'text'], ['Член комиссии 1', item?.commission_member_1, 'commission_member_1', 'text'],

      ['Должность члена комиссии 1', item?.commission_position_1, 'commission_position_1', 'text'], ['Член комиссии 2', item?.commission_member_2, 'commission_member_2', 'text'],

      ['Должность члена комиссии 2', item?.commission_position_2, 'commission_position_2', 'text'],

      ['Не участвовавшие трубопроводы', item?.excluded_pipes, 'excluded_pipes', 'textarea'],

      ['Не предупреждённые потребители', item?.unnotified_consumers, 'unnotified_consumers', 'textarea']

    ]) }

  ].filter(group => group.fields.length)

})

const inspectionLines = computed(() => selected.value?.relations?.lines || [])

const relatedDefects = computed(() => selected.value?.relations?.defects || [])

const documents = computed(() => selected.value?.relations?.documents || [])

const riskFactors = computed(() => selected.value?.relations?.risk_factors || [])



watch(page, () => { if (visible.value) void loadInspections() })

watch([responsibleId, coverageFilter, defectFilter, dateFrom, dateTo], () => {

  if (!visible.value) return

  page.value = 1

  void loadInspections()

})

watch(search, () => {

  if (!visible.value) return

  if (searchTimer) clearTimeout(searchTimer)

  searchTimer = setTimeout(() => { page.value = 1; void loadInspections() }, 350)

})



const exportWord = async () => {
  if (!selected.value) return
  exportingWord.value = true
  try {
    const { blob, filename } = await fastApiService.downloadOpsWordReport('osmotr', selected.value.id)
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

defineExpose({ openDialog })

</script>



<style scoped>

.inspection-journal { height: min(88vh, 880px); display: flex; flex-direction: column; }

.inspection-filters { flex-shrink: 0; background: #fafafa; }

.inspection-table-wrap { min-height: 280px; overflow: auto; flex: 1; }

.inspection-table { min-width: 1120px; }

.inspection-row { cursor: pointer; }

.result-cell { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.inspection-empty { min-height: 320px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 32px; }

.detail-label { color: #78909c; font-size: .72rem; font-weight: 600; letter-spacing: .03em; text-transform: uppercase; }

.detail-value { color: #263238; font-size: .9rem; margin-top: 3px; overflow-wrap: anywhere; }

@media (max-width: 600px) { .inspection-journal { height: 100dvh; } }

</style>

