<template>
  <Teleport to="body">
    <v-dialog v-model="visible" :fullscreen="isMobile" max-width="1320" scrollable>
      <v-card class="repair-journal" :rounded="isMobile ? 0 : 'lg'">
        <v-card-title class="d-flex align-center ga-3 px-4 py-3">
          <v-avatar color="deep-purple-lighten-5" size="40">
            <v-icon color="deep-purple-darken-2">mdi-hammer-wrench</v-icon>
          </v-avatar>
          <div class="flex-grow-1" style="min-width: 0">
            <div class="text-subtitle-1 font-weight-bold">Журнал ремонтов</div>
            <div class="text-caption text-medium-emphasis text-truncate">
              {{ scopeTitle }} · найдено {{ total }}
            </div>
          </div>
          <v-btn color="secondary" variant="tonal" prepend-icon="mdi-printer" class="mr-2" @click="openForm10Report">
            Печать (Форма 10)
          </v-btn>
          <v-btn v-if="mutationsEnabled" color="primary" variant="flat" prepend-icon="mdi-plus" class="mr-2" @click="createRepair" :loading="creating">
            Создать
          </v-btn>
          <v-btn icon variant="text" aria-label="Закрыть журнал" @click="visible = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>

        <v-divider />

        <div class="pa-3 pa-md-4 repair-filters">
          <v-row dense>
            <v-col cols="12" md="4">
              <v-text-field
                v-model="search"
                label="Поиск по ID, названию, работам или приказу"
                prepend-inner-icon="mdi-magnify"
                density="compact"
                variant="outlined"
                clearable
                hide-details
              />
            </v-col>
            <v-col cols="12" sm="6" md="2">
              <v-select v-model="stateId" :items="lookups.states" item-title="name" item-value="id"
                label="Состояние" density="compact" variant="outlined" clearable hide-details />
            </v-col>
            <v-col cols="12" sm="6" md="2">

              <v-select v-model="repairTypeId" :items="lookups.repair_types" item-title="name" item-value="id"

                label="Вид ремонта" density="compact" variant="outlined" clearable hide-details />

            </v-col>

            <v-col cols="12" sm="6" md="2">

              <v-select v-model="categoryId" :items="lookups.categories" item-title="name" item-value="id"

                label="Категория" density="compact" variant="outlined" clearable hide-details />

            </v-col>

            <v-col cols="12" sm="6" md="2">

              <v-select v-model="approved" :items="approvalOptions" item-title="title" item-value="value"

                label="Утверждение" density="compact" variant="outlined" clearable hide-details />

            </v-col>

            <v-col cols="12" sm="6" md="4">

              <v-select v-model="responsibleId" :items="lookups.responsible_people" item-title="name" item-value="id"

                label="Ответственный" density="compact" variant="outlined" clearable hide-details />

            </v-col>

            <v-col cols="12" sm="6" md="2">

              <v-text-field v-model="dateFrom" type="date" label="С даты" density="compact" variant="outlined" hide-details />

            </v-col>

            <v-col cols="12" sm="6" md="2">

              <v-text-field v-model="dateTo" type="date" label="По дату" density="compact" variant="outlined" hide-details />

            </v-col>

          </v-row>



          <div class="d-flex align-center flex-wrap ga-2 mt-3">

            <v-chip v-if="scope.lineId" size="small" color="deep-purple" closable @click:close="clearScope">

              Трубопровод {{ scope.lineId }}

            </v-chip>

            <v-chip v-if="scope.nodeId" size="small" color="deep-purple" closable @click:close="clearScope">

              Узел {{ scope.nodeId }}

            </v-chip>

            <v-spacer />

            <v-btn variant="text" prepend-icon="mdi-filter-remove-outline" @click="resetFilters">Сбросить</v-btn>

            <v-btn color="deep-purple" prepend-icon="mdi-refresh" :loading="loading" @click="loadRepairs">Обновить</v-btn>

          </div>

        </div>



        <v-divider />



        <v-card-text class="pa-0 repair-table-wrap">

          <v-progress-linear v-if="loading" indeterminate color="deep-purple" />

          <v-alert v-if="error" type="error" variant="tonal" class="ma-4">{{ error }}</v-alert>



          <div v-else-if="!loading && items.length === 0" class="repair-empty">

            <v-icon size="56" color="grey-lighten-1">mdi-hammer-wrench</v-icon>

            <div class="text-subtitle-1 mt-3">Ремонты не найдены</div>

            <div class="text-body-2 text-medium-emphasis mt-1">

              РР·РјРµРЅРёС‚Рµ С„РёР»СЊС‚СЂС‹ РёР»Рё Р·Р°РіСЂСѓР·РёС‚Рµ РёСЃС‚РѕСЂРёС‡РµСЃРєРёРµ РґР°РЅРЅС‹Рµ TGID РІ С‚Р°Р±Р»РёС†Сѓ remont2.

            </div>

          </div>



          <v-table v-else fixed-header hover density="compact" class="repair-table">

            <thead>

              <tr>

                <th>ID</th><th>Период</th><th>Ремонт</th><th>Вид / категория</th><th>Состояние</th>

                <th>Ответственный</th><th>Линии</th><th>Бюджет, план / факт</th><th>Результат</th><th class="text-right">Действия</th>

              </tr>

            </thead>

            <tbody>

              <tr v-for="item in items" :key="item.id" class="repair-row" @click="openDetails(item.id)">

                <td class="font-weight-medium">{{ item.id }}</td>

                <td class="text-no-wrap">{{ formatRange(item.effective_start, item.effective_finish) }}</td>

                <td>

                  <div>{{ item.name || `Ремонт ${item.id}` }}</div>

                  <div class="text-caption text-medium-emphasis">{{ item.network_type_name || item.section_characteristics || '—' }}</div>

                </td>

                <td>{{ [item.repair_type_name, item.category_name].filter(Boolean).join(' · ') || '—' }}</td>

                <td><v-chip size="x-small" :color="stateColor(item.state_id)" variant="tonal">{{ item.state_name || 'Не указано' }}</v-chip></td>

                <td>{{ item.responsible_name || '—' }}</td>

                <td>{{ item.line_count }}</td>

                <td class="text-no-wrap">{{ formatMoney(item.planned_budget) }} / {{ formatMoney(item.actual_budget) }}</td>

                <td class="result-cell">{{ item.results || item.work_description || item.note || '—' }}</td>

                <td class="text-right text-no-wrap">

                  <v-btn v-if="hasCoordinates(item)" icon="mdi-crosshairs-gps" size="x-small" variant="text"

                    color="deep-purple" aria-label="Показать ремонт на карте" @click.stop="locate(item, item.name || `Ремонт ${item.id}`)" />

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



    <v-dialog v-model="detailsVisible" :fullscreen="isMobile" max-width="1040" scrollable>

      <v-card :rounded="isMobile ? 0 : 'lg'">

        <v-card-title class="d-flex align-center ga-3 px-4 py-3">

          <v-icon color="deep-purple-darken-2">mdi-hammer-wrench</v-icon>

          <div class="flex-grow-1" style="min-width: 0">

            <div class="text-subtitle-1 font-weight-bold text-truncate">{{ selected?.name || `Ремонт ${selected?.id || ''}` }}</div>

            <div class="text-caption text-medium-emphasis">

              {{ selected?.state_name || 'Состояние не указано' }} · линий {{ selected?.line_count || 0 }} · нарушений {{ selected?.defect_count || 0 }}

            </div>

          </div>

          <v-btn v-if="mutationsEnabled && selected" icon variant="text" aria-label="Удалить" color="error" class="mr-1" @click="deleteRepair(selected.id)" :loading="deleting" title="Удалить ремонт">

            <v-icon>mdi-delete</v-icon>

          </v-btn>

          <v-btn icon variant="text" @click="detailsVisible = false"><v-icon>mdi-close</v-icon></v-btn>

        </v-card-title>

        <v-divider />



        <v-card-text class="pa-4">

          <div v-if="detailsLoading" class="d-flex justify-center pa-10"><v-progress-circular indeterminate color="deep-purple" /></div>

          <v-alert v-else-if="detailsError" type="error" variant="tonal">{{ detailsError }}</v-alert>

          <template v-else-if="selected || isEditing">

            <v-expansion-panels multiple variant="accordion" :model-value="[0, 1]">

              <v-expansion-panel v-for="(group, index) in detailGroups" :key="group.title" :value="index">

                <v-expansion-panel-title>{{ group.title }}</v-expansion-panel-title>

                <v-expansion-panel-text>

                  <v-row dense>

                    <v-col v-for="field in group.fields" :key="field.label" cols="12" sm="6" md="4" lg="3">

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



              <v-expansion-panel v-if="repairLines.length && !isEditing" :value="detailGroups.length">

                <v-expansion-panel-title>Линии контура ({{ repairLines.length }})</v-expansion-panel-title>

                <v-expansion-panel-text>

                  <v-list density="compact" lines="two">

                    <v-list-item v-for="line in repairLines" :key="Number(line.id)" prepend-icon="mdi-pipe"

                      :title="`Линия ${line.line_id} · ${nodeRange(line)}`" :subtitle="lineSummary(line)">

                      <template v-if="hasCoordinates(line)" #append>

                        <v-btn icon="mdi-crosshairs-gps" size="x-small" variant="text" @click.stop="locateRelation(line, `Линия ${line.line_id}`)" />

                      </template>

                    </v-list-item>

                  </v-list>

                </v-expansion-panel-text>

              </v-expansion-panel>



              <v-expansion-panel v-if="workSections.length && !isEditing" :value="detailGroups.length + 1">

                <v-expansion-panel-title>Участки работ ({{ workSections.length }})</v-expansion-panel-title>

                <v-expansion-panel-text>

                  <v-list density="compact" lines="two">

                    <v-list-item v-for="section in workSections" :key="Number(section.id)" prepend-icon="mdi-ruler-square"

                      :title="`Участок ${section.legacy_pipe_section_id || section.id}`" :subtitle="sectionSummary(section)" />

                  </v-list>

                </v-expansion-panel-text>

              </v-expansion-panel>



              <v-expansion-panel v-if="workItems.length && !isEditing" :value="detailGroups.length + 2">

                <v-expansion-panel-title>Состав работ ({{ workItems.length }})</v-expansion-panel-title>

                <v-expansion-panel-text>

                  <v-chip v-for="(item, index) in workItems" :key="`${item.category}-${item.name}-${index}`" class="ma-1" size="small" variant="tonal">

                    {{ item.category }} · {{ item.name }}

                  </v-chip>

                </v-expansion-panel-text>

              </v-expansion-panel>



              <v-expansion-panel v-if="relatedDefects.length && !isEditing" :value="detailGroups.length + 3">

                <v-expansion-panel-title>Связанные нарушения ({{ relatedDefects.length }})</v-expansion-panel-title>

                <v-expansion-panel-text>

                  <v-list density="compact" lines="two">

                    <v-list-item v-for="defect in relatedDefects" :key="Number(defect.id)" prepend-icon="mdi-alert-circle-outline"

                      :title="`Нарушение ${defect.id} · ${defect.state_name || 'без состояния'}`"

                      :subtitle="String(defect.description || defect.source_name || 'Описание не заполнено')"

                      @click="openRelatedDefect(Number(defect.id))" />

                  </v-list>

                </v-expansion-panel-text>

              </v-expansion-panel>



              <v-expansion-panel v-if="documents.length && !isEditing" :value="detailGroups.length + 4">

                <v-expansion-panel-title>Документы ({{ documents.length }})</v-expansion-panel-title>

                <v-expansion-panel-text>

                  <v-list density="compact">

                    <v-list-item v-for="document in documents" :key="Number(document.id)" prepend-icon="mdi-file-document-outline"

                      :title="String(document.document_type_name || 'Документ')"

                      :subtitle="`${formatDate(document.date_doc)} · ${fileName(document.path)}`" />

                  </v-list>

                </v-expansion-panel-text>

              </v-expansion-panel>

            </v-expansion-panels>

          </template>

        </v-card-text>



        <v-divider />

        <v-card-actions class="px-4 py-3">

          <v-btn v-if="selected && hasCoordinates(selected) && !isEditing" prepend-icon="mdi-crosshairs-gps" variant="tonal"

            color="deep-purple" @click="locate(selected, selected.name || `Ремонт ${selected.id}`)">На карте</v-btn>

          <v-spacer />

          <template v-if="isEditing">

            <v-btn v-if="mutationsEnabled" variant="text" @click="cancelEdit">Отмена</v-btn>

            <v-btn v-if="mutationsEnabled" color="primary" variant="elevated" :loading="saving" @click="saveChanges">Сохранить</v-btn>

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

import { fastApiService, type RepairDetails, type RepairLookups, type RepairSummary } from '~/services/fastApiService'



export interface RepairJournalScope { lineId?: number; nodeId?: number; repairId?: number }

const emit = defineEmits<{

  'locate-repair': [coordinates: { longitude: number; latitude: number; id: number; label: string }]

  'open-defect': [defectId: number]

}>()

const { isMobile } = useMobile()
const mutationsEnabled = useMutationsEnabled()

const openForm10Report = () => {
  const url = fastApiService.getFormReportUrl('f10_remont', search.value)
  window.open(url, '_blank')
}


const visible = ref(false)

const loading = ref(false)

const error = ref('')

const items = ref<RepairSummary[]>([])

const total = ref(0)

const pages = ref(0)

const page = ref(1)

const pageSize = 50

const search = ref('')

const stateId = ref<number | undefined>()

const repairTypeId = ref<number | undefined>()

const categoryId = ref<number | undefined>()

const responsibleId = ref<number | undefined>()

const approved = ref<boolean | undefined>()

const dateFrom = ref('')

const dateTo = ref('')

const scope = reactive<RepairJournalScope>({})

const lookups = reactive<RepairLookups>({

  states: [], repair_types: [], categories: [], subdivisions: [], document_types: [], responsible_people: []

})

const approvalOptions = [{ title: 'Утверждено', value: true }, { title: 'Не утверждено', value: false }]

let searchTimer: ReturnType<typeof setTimeout> | undefined

const detailsVisible = ref(false)

const detailsLoading = ref(false)

const detailsError = ref('')

const selected = ref<RepairDetails | null>(null)

const creating = ref(false)

const deleting = ref(false)
const exportingWord = ref(false)



const isEditing = ref(false)

const isNew = ref(false)

const saving = ref(false)

const editFields = ref<Record<string, any>>({})



const scopeTitle = computed(() => scope.lineId ? `ремонты трубопровода ${scope.lineId}`

  : scope.nodeId ? `ремонты прилегающих трубопроводов узла ${scope.nodeId}` : 'вся тепловая сеть')

const formatDate = (value: unknown) => {

  if (!value) return '—'

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)

  return match ? `${match[3]}.${match[2]}.${match[1]}` : String(value)

}

const formatRange = (start: unknown, finish: unknown) => [formatDate(start), formatDate(finish)].filter((v, i, a) => v !== '—' && a.indexOf(v) === i).join(' — ') || '—'

const formatMoney = (value: unknown) => value === null || value === undefined || value === '' ? '—'

  : new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(value))

const formatValue = (value: unknown) => {

  if (value === null || value === undefined || value === '') return '—'

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return formatDate(value)

  if (typeof value === 'boolean') return value ? 'Да' : 'Нет'

  return String(value)

}

const stateColor = (state: number | null) => state === 3 ? 'success' : state === 2 ? 'warning' : state === 1 ? 'info' : 'grey'

const hasCoordinates = (item: { longitude?: unknown; latitude?: unknown }) => Number.isFinite(Number(item.longitude)) && Number.isFinite(Number(item.latitude))

const fileName = (path: unknown) => String(path || 'Файл не указан').split(/[\\/]/).pop() || 'Файл'

const nodeRange = (line: Record<string, unknown>) => [line.start_node_name, line.end_node_name].filter(Boolean).join(' — ') || 'узлы не указаны'

const lineSummary = (line: Record<string, unknown>) => [line.diameter && `DN ${line.diameter}`, line.length && `длина ${line.length} м`, line.tubing_type_name].filter(Boolean).join(' · ') || 'Параметры участка не заполнены'

const sectionSummary = (section: Record<string, unknown>) => [section.tubing_type_name, section.diameter && `DN ${section.diameter}`, section.pipe_length && `труба ${section.pipe_length} м`, section.insulation_area && `изоляция ${section.insulation_area} м²`, section.channel_length && `канал ${section.channel_length} м`].filter(Boolean).join(' · ') || 'Параметры работ не заполнены'



const loadLookups = async () => {

  if (lookups.states.length) return

  Object.assign(lookups, await fastApiService.getRepairLookups())

}

const loadRepairs = async () => {

  loading.value = true; error.value = ''

  try {

    const response = await fastApiService.getRepairs({ page: page.value, page_size: pageSize, state_id: stateId.value,

      repair_type_id: repairTypeId.value, category_id: categoryId.value, responsible_id: responsibleId.value,

      approved: approved.value, date_from: dateFrom.value || undefined, date_to: dateTo.value || undefined,

      line_id: scope.lineId, node_id: scope.nodeId, search: search.value.trim() || undefined })

    items.value = response.items; total.value = response.total; pages.value = response.pages

  } catch (loadError: any) {

    error.value = loadError?.data?.detail || loadError?.message || 'Не удалось загрузить журнал ремонтов'

  } finally { loading.value = false }

}

const openDetails = async (id: number) => {

  detailsVisible.value = true; detailsLoading.value = true; detailsError.value = ''; selected.value = null

  try { selected.value = await fastApiService.getRepair(id) }

  catch (loadError: any) { detailsError.value = loadError?.data?.detail || loadError?.message || 'Не удалось открыть карточку ремонта' }

  finally { detailsLoading.value = false }

}

const openDialog = async (nextScope: RepairJournalScope = {}) => {

  Object.assign(scope, { lineId: undefined, nodeId: undefined, repairId: undefined }, nextScope)

  page.value = 1; visible.value = true

  try {

    await Promise.all([loadLookups(), loadRepairs()])

    if (nextScope.repairId) await openDetails(nextScope.repairId)

  } catch (loadError: any) { error.value = loadError?.message || 'Не удалось открыть журнал ремонтов' }

}

const clearScope = () => { scope.lineId = undefined; scope.nodeId = undefined; page.value = 1; void loadRepairs() }



const createRepair = () => {

  isNew.value = true

  isEditing.value = true

  editFields.value = {

    name: 'Новый ремонт'

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

      const result = await fastApiService.createObject('remont2', editFields.value)

      if (result && result.id) {

        isEditing.value = false

        await loadRepairs()

        await openDetails(result.id)

      }

    } else if (selected.value) {

      const changes: Record<string, any> = {}

      for (const [k, v] of Object.entries(editFields.value)) {

        if (v !== selected.value[k as keyof RepairDetails]) {

          changes[k] = v

        }

      }

      if (Object.keys(changes).length > 0) {

        await fastApiService.updateObjectAttributes('remont2', selected.value.id.toString(), changes)

      }

      isEditing.value = false

      await loadRepairs()

      await openDetails(selected.value.id)

    }

  } catch (e: any) {

    detailsError.value = 'Ошибка при сохранении: ' + (e?.message || '')

  } finally {

    saving.value = false

  }

}



const deleteRepair = async (id: number) => {

  if (!confirm(`Вы действительно хотите удалить ремонт #${id}?`)) return

  try {

    deleting.value = true

    await fastApiService.deleteObject('remont2', id)

    detailsVisible.value = false

    await loadRepairs()

  } catch (e: any) {

    detailsError.value = 'Ошибка при удалении ремонта: ' + (e?.message || '')

  } finally {

    deleting.value = false

  }

}

const resetFilters = () => {

  search.value = ''; stateId.value = undefined; repairTypeId.value = undefined; categoryId.value = undefined

  responsibleId.value = undefined; approved.value = undefined; dateFrom.value = ''; dateTo.value = ''; page.value = 1

  void loadRepairs()

}

const locate = (item: RepairSummary, label: string) => {

  if (!hasCoordinates(item)) return

  emit('locate-repair', { longitude: Number(item.longitude), latitude: Number(item.latitude), id: item.id, label })

  detailsVisible.value = false; visible.value = false

}

const locateRelation = (relation: Record<string, unknown>, label: string) => {

  if (!selected.value || !hasCoordinates(relation)) return

  emit('locate-repair', { longitude: Number(relation.longitude), latitude: Number(relation.latitude), id: selected.value.id, label })

  detailsVisible.value = false; visible.value = false

}

const openRelatedDefect = (id: number) => { detailsVisible.value = false; visible.value = false; emit('open-defect', id) }

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

    { title: 'Общие сведения', fields: buildFields([

      ['Наименование', item?.name, 'name', 'text'], ['Состояние', item?.state_name, 'state_id', 'select', lookups.states], ['Вид ремонта', item?.repair_type_name, 'repair_type_id', 'select', lookups.repair_types], ['Категория', item?.category_name, 'category_id', 'select', lookups.categories],

      ['Тип тепловой сети', item?.network_type_name], ['Утверждение', item?.approval_name], ['Ответственный', item?.responsible_name, 'responsible_id', 'select', lookups.responsible_people],

      ['Подразделение', item?.subdivision_name, 'subdivision_id', 'select', lookups.subdivisions], ['Характеристика участков', item?.section_characteristics, 'section_characteristics', 'textarea'], ['Описание работ', item?.work_description, 'work_description', 'textarea']

    ]) },

    { title: 'План', fields: buildFields([

      ['Начало по плану', item?.planned_start, 'planned_start', 'date'], ['Окончание по плану', item?.planned_finish, 'planned_finish', 'date'], ['Дата утверждения плана', item?.plan_approved_on, 'plan_approved_on', 'date'],

      ['Длина трубы, м', item?.planned_pipe_length, 'planned_pipe_length', 'number'], ['Диаметр трубы', item?.planned_pipe_diameter, 'planned_pipe_diameter', 'text'], ['Площадь изоляции, м²', item?.planned_insulation_area, 'planned_insulation_area', 'number'],

      ['Длина канала, м', item?.planned_channel_length, 'planned_channel_length', 'number'], ['Асфальтирование, м²', item?.planned_asphalt_area, 'planned_asphalt_area', 'number'],

      ['Бюджет', item?.planned_budget, 'planned_budget', 'number'], ['Ремонтный персонал', item?.planned_personnel, 'planned_personnel', 'text']

    ]) },

    { title: 'Фактическое выполнение', fields: buildFields([

      ['Начало ремонта', item?.actual_start, 'actual_start', 'date'], ['Завершение ремонта', item?.actual_finish, 'actual_finish', 'date'], ['Длина трубы, м', item?.actual_pipe_length, 'actual_pipe_length', 'number'],

      ['Площадь изоляции, м²', item?.actual_insulation_area, 'actual_insulation_area', 'number'], ['Длина канала, м', item?.actual_channel_length, 'actual_channel_length', 'number'],

      ['Асфальтирование, м²', item?.actual_asphalt_area, 'actual_asphalt_area', 'number'], ['Фактический бюджет', item?.actual_budget, 'actual_budget', 'number'],

      ['Ремонтный персонал', item?.actual_personnel, 'actual_personnel', 'text'], ['Характеристика работ', item?.work_characteristics, 'work_characteristics', 'textarea'], ['Результаты ремонта', item?.results, 'results', 'textarea']

    ]) },

    { title: 'Последствия и ввод в эксплуатацию', fields: buildFields([

      ['Отключено потребителей', item?.disconnected_consumers, 'disconnected_consumers', 'number'], ['Недоотпуск тепловой энергии', item?.undelivered_heat, 'undelivered_heat', 'number'],

      ['Номер приказа', item?.commissioning_order_number, 'commissioning_order_number', 'text'], ['Дата приказа', item?.commissioning_order_date, 'commissioning_order_date', 'date'],

      ['Файл приказа', item?.commissioning_order_file], ['Примечание', item?.note, 'note', 'textarea']

    ]) }

  ].filter(group => group.fields.length)

})

const repairLines = computed(() => selected.value?.relations?.lines || [])

const workSections = computed(() => selected.value?.relations?.work_sections || [])

const workItems = computed(() => selected.value?.relations?.work_items || [])

const relatedDefects = computed(() => selected.value?.relations?.defects || [])

const documents = computed(() => selected.value?.relations?.documents || [])



watch(page, () => { if (visible.value) void loadRepairs() })

watch([stateId, repairTypeId, categoryId, responsibleId, approved, dateFrom, dateTo], () => {

  if (!visible.value) return; page.value = 1; void loadRepairs()

})

watch(search, () => {

  if (!visible.value) return

  if (searchTimer) clearTimeout(searchTimer)

  searchTimer = setTimeout(() => { page.value = 1; void loadRepairs() }, 350)

})

const exportWord = async () => {
  if (!selected.value) return
  exportingWord.value = true
  try {
    const { blob, filename } = await fastApiService.downloadOpsWordReport('remont', selected.value.id)
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

.repair-journal { height: min(90vh, 900px); display: flex; flex-direction: column; }

.repair-filters { flex-shrink: 0; background: #fafafa; }

.repair-table-wrap { min-height: 280px; overflow: auto; flex: 1; }

.repair-table { min-width: 1260px; }

.repair-row { cursor: pointer; }

.result-cell { max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.repair-empty { min-height: 320px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 32px; }

.detail-label { color: #78909c; font-size: .72rem; font-weight: 600; letter-spacing: .03em; text-transform: uppercase; }

.detail-value { color: #263238; font-size: .9rem; margin-top: 3px; overflow-wrap: anywhere; }

@media (max-width: 600px) { .repair-journal { height: 100dvh; } }

</style>



