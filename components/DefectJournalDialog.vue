<template>
  <Teleport to="body">
    <v-dialog
      v-model="visible"
      :fullscreen="isMobile"
      max-width="1240"
      scrollable
    >
      <v-card class="defect-journal" :rounded="isMobile ? 0 : 'lg'">
        <v-card-title class="d-flex align-center ga-3 px-4 py-3">
          <v-avatar color="deep-orange-lighten-5" size="40">
            <v-icon color="deep-orange-darken-2">mdi-alert-decagram-outline</v-icon>
          </v-avatar>
          <div class="flex-grow-1" style="min-width: 0">
            <div class="text-subtitle-1 font-weight-bold">Журнал нарушений</div>
            <div class="text-caption text-medium-emphasis text-truncate">
              {{ scopeTitle }} · найдено {{ total }}
            </div>
          </div>
          <v-btn color="secondary" variant="tonal" prepend-icon="mdi-printer" class="mr-2" @click="openForm11Report">
            Печать (Форма 11)
          </v-btn>
          <v-btn v-if="mutationsEnabled" color="primary" variant="flat" prepend-icon="mdi-plus" class="mr-2" @click="createDefect" :loading="creating">
            Создать
          </v-btn>
          <v-btn icon variant="text" aria-label="Закрыть журнал" @click="visible = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>

        <v-divider />

        <div class="pa-3 pa-md-4 defect-filters">
          <v-row dense>
            <v-col cols="12" md="4">

              <v-text-field

                v-model="search"

                label="Поиск по ID, адресу, описанию или акту"

                prepend-inner-icon="mdi-magnify"

                density="compact"

                variant="outlined"

                clearable

                hide-details

              />

            </v-col>

            <v-col cols="12" sm="4" md="2">

              <v-select

                v-model="sourceId"

                :items="lookups.sources"

                item-title="name"

                item-value="id"

                label="РСЃС‚РѕС‡РЅРёРє"

                density="compact"

                variant="outlined"

                clearable

                hide-details

              />

            </v-col>

            <v-col cols="12" sm="4" md="2">

              <v-select

                v-model="stateId"

                :items="lookups.states"

                item-title="name"

                item-value="id"

                label="Состояние"

                density="compact"

                variant="outlined"

                clearable

                hide-details

              />

            </v-col>

            <v-col cols="12" sm="4" md="2">

              <v-text-field

                v-model="dateFrom"

                type="date"

                label="С даты"

                density="compact"

                variant="outlined"

                hide-details

              />

            </v-col>

            <v-col cols="12" sm="4" md="2">

              <v-text-field

                v-model="dateTo"

                type="date"

                label="По дату"

                density="compact"

                variant="outlined"

                hide-details

              />

            </v-col>

          </v-row>

          <div class="d-flex align-center flex-wrap ga-2 mt-3">

            <v-chip v-if="scope.lineId" size="small" color="primary" closable @click:close="clearScope">

              Трубопровод {{ scope.lineId }}

            </v-chip>

            <v-chip v-if="scope.nodeId" size="small" color="primary" closable @click:close="clearScope">

              Узел {{ scope.nodeId }}

            </v-chip>

            <v-select

              v-model="categoryId"

              :items="lookups.categories"

              item-title="name"

              item-value="id"

              label="Категория"

              density="compact"

              variant="outlined"

              clearable

              hide-details

              class="category-filter"

            />

            <v-spacer />

            <v-btn variant="text" prepend-icon="mdi-filter-remove-outline" @click="resetFilters">

              Сбросить

            </v-btn>

            <v-btn color="primary" prepend-icon="mdi-refresh" :loading="loading" @click="loadDefects">

              Обновить

            </v-btn>

          </div>

        </div>



        <v-divider />



        <v-card-text class="pa-0 defect-table-wrap">

          <v-progress-linear v-if="loading" indeterminate color="primary" />

          <v-alert v-if="error" type="error" variant="tonal" class="ma-4">

            {{ error }}

          </v-alert>



          <div v-else-if="!loading && items.length === 0" class="defect-empty">

            <v-icon size="56" color="grey-lighten-1">mdi-clipboard-alert-outline</v-icon>

            <div class="text-subtitle-1 mt-3">Нарушения не найдены</div>

            <div class="text-body-2 text-medium-emphasis mt-1">

              РР·РјРµРЅРёС‚Рµ С„РёР»СЊС‚СЂС‹ РёР»Рё РїСЂРѕРІРµСЂСЊС‚Рµ Р·Р°РіСЂСѓР·РєСѓ РёСЃС‚РѕСЂРёС‡РµСЃРєРёС… РґР°РЅРЅС‹С… TGID.

            </div>

          </div>



          <v-table v-else fixed-header hover density="compact" class="defect-table">

            <thead>

              <tr>

                <th>ID</th>

                <th>Дата</th>

                <th>РСЃС‚РѕС‡РЅРёРє</th>

                <th>Состояние</th>

                <th>Адрес / участок</th>

                <th>Описание</th>

                <th class="text-right">Действия</th>

              </tr>

            </thead>

            <tbody>

              <tr v-for="item in items" :key="item.id" class="defect-row" @click="openDetails(item.id)">

                <td class="font-weight-medium">{{ item.id }}</td>

                <td>{{ formatDate(item.detected_at) }}</td>

                <td>{{ item.source_name || '—' }}</td>

                <td>

                  <v-chip size="x-small" :color="stateColor(item.state_id)" variant="tonal">

                    {{ item.state_name || 'Не задано' }}

                  </v-chip>

                </td>

                <td>

                  <div>{{ item.address || nodeRange(item) || '—' }}</div>

                  <div v-if="item.line_id" class="text-caption text-medium-emphasis">Линия {{ item.line_id }}</div>

                </td>

                <td class="description-cell">{{ item.description || item.report_note || '—' }}</td>

                <td class="text-right text-no-wrap">

                  <v-btn

                    v-if="hasCoordinates(item)"

                    icon="mdi-crosshairs-gps"

                    size="x-small"

                    variant="text"

                    color="primary"

                    aria-label="Показать нарушение на карте"

                    @click.stop="locate(item)"

                  />

                  <v-btn

                    icon="mdi-chevron-right"

                    size="x-small"

                    variant="text"

                    aria-label="Открыть карточку нарушения"

                    @click.stop="openDetails(item.id)"

                  />

                </td>

              </tr>

            </tbody>

          </v-table>

        </v-card-text>



        <v-divider />

        <v-card-actions class="px-4 py-2">

          <span class="text-caption text-medium-emphasis">

            Страница {{ page }}{{ pages ? ` из ${pages}` : '' }}

          </span>

          <v-spacer />

          <v-pagination

            v-if="pages > 1"

            v-model="page"

            :length="pages"

            :total-visible="isMobile ? 3 : 7"

            density="compact"

          />

        </v-card-actions>

      </v-card>

    </v-dialog>



    <v-dialog v-model="detailsVisible" :fullscreen="isMobile" max-width="920" scrollable>

      <v-card :rounded="isMobile ? 0 : 'lg'">

        <v-card-title class="d-flex align-center ga-3 px-4 py-3">

          <v-icon color="deep-orange-darken-2">mdi-alert-circle-outline</v-icon>

          <div class="flex-grow-1">

            <div class="text-subtitle-1 font-weight-bold">Нарушение {{ selected?.id || '' }}</div>

            <div class="text-caption text-medium-emphasis">

              {{ selected?.source_name || 'РСЃС‚РѕС‡РЅРёРє РЅРµ СѓРєР°Р·Р°РЅ' }} В· {{ selected?.state_name || 'РЎРѕСЃС‚РѕСЏРЅРёРµ РЅРµ СѓРєР°Р·Р°РЅРѕ' }}

            </div>

          </div>

          <v-btn v-if="mutationsEnabled && selected" icon variant="text" aria-label="Удалить" color="error" class="mr-1" @click="deleteDefect(selected.id)" :loading="deleting" title="Удалить нарушение">

            <v-icon>mdi-delete</v-icon>

          </v-btn>

          <v-btn icon variant="text" aria-label="Закрыть карточку" @click="detailsVisible = false">

            <v-icon>mdi-close</v-icon>

          </v-btn>

        </v-card-title>

        <v-divider />



        <v-card-text class="pa-4">

          <div v-if="detailsLoading" class="d-flex justify-center pa-10">

            <v-progress-circular indeterminate color="primary" />

          </div>

          <v-alert v-else-if="detailsError" type="error" variant="tonal">{{ detailsError }}</v-alert>

          <template v-else-if="selected">

            <v-expansion-panels multiple variant="accordion" :model-value="[0, 1]">

              <v-expansion-panel

                v-for="(group, groupIndex) in detailGroups"

                :key="group.title"

                :value="groupIndex"

              >

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



              <v-expansion-panel v-if="relationGroups.length && !isEditing" :value="detailGroups.length">

                <v-expansion-panel-title>Причины, элементы и ремонтные работы</v-expansion-panel-title>

                <v-expansion-panel-text>

                  <div v-for="relation in relationGroups" :key="relation.label" class="mb-4">

                    <div class="detail-label mb-1">{{ relation.label }}</div>

                    <div class="d-flex flex-wrap ga-1">

                      <v-chip v-for="(value, index) in relation.values" :key="index" size="small" variant="tonal">

                        {{ value }}

                      </v-chip>

                    </div>

                  </div>

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

            @click="locate(selected)"

          >

            На карте

          </v-btn>

          <v-spacer />

          <v-btn

            v-if="selected && !isEditing"

            prepend-icon="mdi-file-word-box"

            variant="tonal"

            color="primary"

            :loading="reportLoading"

            @click="downloadReport"

          >

            Карта нарушения

          </v-btn>

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

            <v-btn variant="text" @click="detailsVisible = false">Закрыть</v-btn>

          </template>

        </v-card-actions>

      </v-card>

    </v-dialog>



    <v-snackbar v-model="notificationVisible" :color="notificationColor" timeout="3500">

      {{ notificationMessage }}

    </v-snackbar>

  </Teleport>

</template>



<script setup lang="ts">

import { computed, reactive, ref, watch } from 'vue'

import { useMobile } from '~/composables/useMobile'
import { useMutationsEnabled } from '~/composables/useMutationsEnabled'

import {

  fastApiService,

  type DefectDetails,

  type DefectLookups,

  type DefectSummary

} from '~/services/fastApiService'



export interface DefectJournalScope {

  lineId?: number

  nodeId?: number

  defectId?: number

}



const emit = defineEmits<{

  'locate-defect': [coordinates: { longitude: number; latitude: number; id: number }]

}>()



const { isMobile } = useMobile()
const mutationsEnabled = useMutationsEnabled()

const openForm11Report = () => {
  const url = fastApiService.getFormReportUrl('f11_defect', search.value)
  window.open(url, '_blank')
}


const visible = ref(false)

const loading = ref(false)

const error = ref('')

const items = ref<DefectSummary[]>([])

const total = ref(0)

const pages = ref(0)

const page = ref(1)

const pageSize = 50

const search = ref('')

const sourceId = ref<number | undefined>()

const stateId = ref<number | undefined>()

const categoryId = ref<number | undefined>()

const dateFrom = ref('')

const dateTo = ref('')

const scope = reactive<DefectJournalScope>({})

const lookups = reactive<DefectLookups>({ sources: [], states: [], categories: [] })

let searchTimer: ReturnType<typeof setTimeout> | undefined



const detailsVisible = ref(false)

const detailsLoading = ref(false)

const detailsError = ref('')

const selected = ref<DefectDetails | null>(null)

const reportLoading = ref(false)

const notificationVisible = ref(false)

const notificationMessage = ref('')

const notificationColor = ref<'success' | 'error'>('success')

const creating = ref(false)

const deleting = ref(false)



const isEditing = ref(false)

const isNew = ref(false)

const saving = ref(false)

const editFields = ref<Record<string, any>>({})



const scopeTitle = computed(() => {

  if (scope.lineId) return `нарушения трубопровода ${scope.lineId}`

  if (scope.nodeId) return `нарушения узла и прилегающих трубопроводов ${scope.nodeId}`

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

  return String(value)

}



const nodeRange = (item: DefectSummary) =>

  [item.line_start_node, item.line_end_node].filter(Boolean).join(' — ')



const stateColor = (value: number | null) => {

  if (value === 1) return 'error'

  if (value === 2) return 'warning'

  if (value === 3) return 'success'

  return 'grey'

}



const hasCoordinates = (item: Pick<DefectSummary, 'longitude' | 'latitude'>) =>

  Number.isFinite(Number(item.longitude)) && Number.isFinite(Number(item.latitude))



const loadLookups = async () => {

  if (lookups.sources.length) return

  const result = await fastApiService.getDefectLookups()

  Object.assign(lookups, result)

}



const loadDefects = async () => {

  loading.value = true

  error.value = ''

  try {

    const result = await fastApiService.getDefects({

      page: page.value,

      page_size: pageSize,

      source_id: sourceId.value,

      state_id: stateId.value,

      category_id: categoryId.value,

      date_from: dateFrom.value || undefined,

      date_to: dateTo.value || undefined,

      line_id: scope.lineId,

      node_id: scope.nodeId,

      search: (search.value || '').trim() || undefined

    })

    items.value = result.items

    total.value = result.total

    pages.value = result.pages

  } catch (loadError: any) {

    error.value = loadError?.data?.detail || loadError?.message || 'Не удалось загрузить журнал нарушений'

  } finally {

    loading.value = false

  }

}



const openDetails = async (defectId: number) => {

  detailsVisible.value = true

  detailsLoading.value = true

  detailsError.value = ''

  selected.value = null

  try {

    selected.value = await fastApiService.getDefect(defectId)

  } catch (loadError: any) {

    detailsError.value = loadError?.data?.detail || loadError?.message || 'Не удалось открыть карточку нарушения'

  } finally {

    detailsLoading.value = false

  }

}



const openDialog = async (nextScope: DefectJournalScope = {}) => {

  Object.assign(scope, { lineId: undefined, nodeId: undefined, defectId: undefined }, nextScope)

  page.value = 1

  visible.value = true

  try {

    await Promise.all([loadLookups(), loadDefects()])

    if (nextScope.defectId) await openDetails(nextScope.defectId)

  } catch (loadError: any) {

    error.value = loadError?.message || 'Не удалось открыть журнал нарушений'

  }

}



const clearScope = () => {

  scope.lineId = undefined

  scope.nodeId = undefined

  page.value = 1

  void loadDefects()

}



const createDefect = () => {

  isNew.value = true

  isEditing.value = true

  editFields.value = {

    name: 'Новое нарушение',

    detected_at: new Date().toISOString().split('T')[0]

  }

  selected.value = null

  detailsVisible.value = true

  detailsError.value = ''

}



const startEdit = () => {

  if (!selected.value) return

  isNew.value = false

  isEditing.value = true

  // Copy all keys to editFields

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

      const result = await fastApiService.createObject('defect', editFields.value)

      if (result && result.id) {

        isEditing.value = false

        await loadDefects()

        await openDetails(result.id)

      }

    } else if (selected.value) {

      const changes: Record<string, any> = {}

      for (const [k, v] of Object.entries(editFields.value)) {

        if (v !== selected.value[k as keyof DefectDetails]) {

          changes[k] = v

        }

      }

      if (Object.keys(changes).length > 0) {

        await fastApiService.updateObjectAttributes('defect', selected.value.id.toString(), changes)

      }

      isEditing.value = false

      await loadDefects()

      await openDetails(selected.value.id)

    }

  } catch (e: any) {

    detailsError.value = 'Ошибка при сохранении: ' + (e?.message || '')

  } finally {

    saving.value = false

  }

}



const deleteDefect = async (id: number) => {

  if (!confirm(`Вы действительно хотите удалить нарушение #${id}?`)) return

  try {

    deleting.value = true

    await fastApiService.deleteObject('defect', id)

    detailsVisible.value = false

    await loadDefects()

  } catch (e: any) {

    detailsError.value = 'Ошибка при удалении нарушения: ' + (e?.message || '')

  } finally {

    deleting.value = false

  }

}



const resetFilters = () => {

  search.value = ''

  sourceId.value = undefined

  stateId.value = undefined

  categoryId.value = undefined

  dateFrom.value = ''

  dateTo.value = ''

  page.value = 1

  void loadDefects()

}



const locate = (item: DefectSummary) => {

  if (!hasCoordinates(item)) return

  emit('locate-defect', {

    longitude: Number(item.longitude),

    latitude: Number(item.latitude),

    id: item.id

  })

  detailsVisible.value = false

  visible.value = false

}



const downloadReport = async () => {

  if (!selected.value) return

  reportLoading.value = true

  try {

    const { blob, filename } = await fastApiService.downloadWordReport(selected.value.id)

    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')

    link.href = url

    link.download = filename

    document.body.appendChild(link)

    link.click()

    link.remove()

    URL.revokeObjectURL(url)

    notificationMessage.value = `Сформирован отчёт «${filename}»`

    notificationColor.value = 'success'

  } catch (reportError: any) {

    notificationMessage.value = reportError?.message || 'Не удалось сформировать Word-отчёт'

    notificationColor.value = 'error'

  } finally {

    notificationVisible.value = true

    reportLoading.value = false

  }

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

    {

      title: 'Обнаружение и привязка',

      fields: buildFields([

        ['Название', item?.name, 'name', 'text'],

        ['Дата обнаружения', item?.detected_at, 'detected_at', 'date'],

        ['Время обнаружения', item?.detected_time, 'detected_time', 'time'],

        ['Источник', item?.source_name, 'source_id', 'select', lookups.sources],

        ['Состояние', item?.state_name, 'state_id', 'select', lookups.states],

        ['Категория', item?.category_name, 'category_id', 'select', lookups.categories],

        ['Адрес', item?.address, 'address', 'text'],

        ['Трубопровод', item?.line_id, 'line_id', 'number'],

        ['Описание повреждения', item?.description, 'description', 'textarea']

      ])

    },

    {

      title: 'Повреждение и состояние конструкций',

      fields: buildFields([

        ['Характер повреждения', item?.damage_type_name],

        ['Поверхность в месте раскопки', item?.surface_name],

        ['Центр повреждения, часов', item?.damage_clock_position],

        ['Высота повреждения', item?.damage_height],

        ['Ширина повреждения', item?.damage_width],

        ['Площадь повреждения', item?.damage_area],

        ['Состояние теплоизоляции', item?.thermal_insulation_state],

        ['Состояние наружной поверхности', item?.outer_surface_state],

        ['Состояние внутренней поверхности', item?.inner_surface_state]

      ])

    },

    {

      title: 'Ликвидация и ремонт',

      fields: buildFields([

        ['Способ ликвидации', item?.liquidation_method],

        ['Вид работ', item?.work_type_name],

        ['Дата начала ремонта', item?.repair_started_on, 'repair_started_on', 'date'],

        ['Дата завершения ремонта', item?.repair_finished_on, 'repair_finished_on', 'date'],

        ['Длина заменённой трубы, м', item?.replaced_pipe_length],

        ['Длина заменённой изоляции, м', item?.replaced_insulation_length],

        ['Длина ремонта канала, м', item?.repaired_channel_length],

        ['Ширина заплатки', item?.patch_width],

        ['Высота заплатки', item?.patch_height],

        ['Трудозатраты', item?.repair_labor],

        ['Стоимость ремонта', item?.repair_cost],

        ['Подразделение', item?.subdivision_name],

        ['Ответственный', item?.responsible_name],

        ['Бригада', item?.brigade_name],

        ['Результат / примечание', item?.report_note || item?.note, 'report_note', 'textarea']

      ])

    },

    {

      title: 'Последствия и связанные процессы',

      fields: buildFields([

        ['Отключено потребителей', item?.disconnected_consumers],

        ['Недоотпущено тепла, Гкал', item?.undelivered_heat],

        ['Затраты на восстановление', item?.recovery_cost],

        ['Социальные последствия', item?.social_consequences],

        ['Контур опрессовки', item?.pressure_test_name || item?.pressure_test_id],

        ['Осмотр', item?.inspection_name || item?.inspection_id],

        ['Ремонт', item?.repair_name || item?.repair_id],

        ['Дата шурфовки', item?.excavation_date],

        ['Акт', item?.act_number],

        ['Дата акта', item?.act_date],

        ['Приказ', item?.order_number],

        ['Дата приказа ввода', item?.commissioning_order_date]

      ])

    }

  ].filter(group => group.fields.length)

})



const relationLabels: Record<string, string> = {

  damage_elements: 'Повреждённые элементы',

  technical_causes: 'Технические причины',

  organizational_causes: 'Организационные причины',

  contributing_causes: 'Сопутствующие причины',

  channel_states: 'Состояние конструкции канала',

  chamber_states: 'Состояние конструкции камеры',

  pipe_repairs: 'Ремонт трубопровода и элементов'

}



const relationGroups = computed(() => {

  const relations = selected.value?.relations || {}

  return Object.entries(relations).map(([key, rows]) => ({

    label: relationLabels[key] || key,

    values: rows.map(row => {

      if (key === 'pipe_repairs') {

        return [row.work_name, row.element_name].filter(Boolean).join(': ')

      }

      return String(row.name || row.id || '—')

    }).filter(Boolean)

  })).filter(group => group.values.length)

})



watch(page, () => {

  if (visible.value) void loadDefects()

})



watch([sourceId, stateId, categoryId, dateFrom, dateTo], () => {

  if (!visible.value) return

  page.value = 1

  void loadDefects()

})



watch(search, () => {

  if (!visible.value) return

  if (searchTimer) clearTimeout(searchTimer)

  searchTimer = setTimeout(() => {

    page.value = 1

    void loadDefects()

  }, 350)

})



defineExpose({ openDialog })

</script>



<style scoped>

.defect-journal {

  height: min(88vh, 880px);

  display: flex;

  flex-direction: column;

}



.defect-filters {

  flex-shrink: 0;

  background: #fafafa;

}



.category-filter {

  min-width: min(100%, 300px);

  max-width: 360px;

}



.defect-table-wrap {

  min-height: 280px;

  overflow: auto;

  flex: 1;

}



.defect-table {

  min-width: 980px;

}



.defect-row {

  cursor: pointer;

}



.description-cell {

  max-width: 320px;

  overflow: hidden;

  text-overflow: ellipsis;

  white-space: nowrap;

}



.defect-empty {

  min-height: 320px;

  display: flex;

  flex-direction: column;

  align-items: center;

  justify-content: center;

  text-align: center;

  padding: 32px;

}



.detail-label {

  color: #78909c;

  font-size: 0.72rem;

  font-weight: 600;

  letter-spacing: 0.03em;

  text-transform: uppercase;

}



.detail-value {

  color: #263238;

  font-size: 0.9rem;

  margin-top: 3px;

  overflow-wrap: anywhere;

}



@media (max-width: 600px) {

  .defect-journal {

    height: 100dvh;

  }

}

</style>



