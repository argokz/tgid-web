<template>

  <Teleport to="body">

    <v-dialog v-model="visible" :fullscreen="isMobile" max-width="1380" scrollable>

      <v-card class="tu-journal" :rounded="isMobile ? 0 : 'lg'">

        <v-card-title class="d-flex align-center ga-3 px-4 py-3">

          <v-avatar color="cyan-lighten-5" size="40">

            <v-icon color="cyan-darken-3">mdi-file-certificate-outline</v-icon>

          </v-avatar>

          <div class="flex-grow-1" style="min-width: 0">

            <div class="text-subtitle-1 font-weight-bold">Технические условия</div>

            <div class="text-caption text-medium-emphasis text-truncate">

              {{ scopeTitle }} · найдено {{ total }}

            </div>

          </div>

          <v-btn v-if="mutationsEnabled" color="cyan-darken-3" variant="flat" prepend-icon="mdi-plus" class="mr-2" @click="createTechnicalCondition" :loading="creating">

            Создать

          </v-btn>

          <v-btn icon variant="text" aria-label="Закрыть журнал" @click="visible = false">

            <v-icon>mdi-close</v-icon>

          </v-btn>

        </v-card-title>

        <v-divider />



        <div class="pa-3 pa-md-4 tu-filters">

          <v-row dense>

            <v-col cols="12" md="4">

              <v-text-field

                v-model="search"

                label="Номер, организация, объект, адрес или договор"

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

              <v-select v-model="issueYear" :items="lookups.years" item-title="value" item-value="value"

                label="Год выдачи" density="compact" variant="outlined" clearable hide-details />

            </v-col>

            <v-col cols="12" sm="6" md="4">

              <v-select v-model="heatSource" :items="lookups.heat_sources" item-title="name" item-value="name"

                label="Источник" density="compact" variant="outlined" clearable hide-details />

            </v-col>

            <v-col cols="12" sm="6" md="4">

              <v-select v-model="district" :items="lookups.districts" item-title="name" item-value="name"

                label="Район эксплуатации" density="compact" variant="outlined" clearable hide-details />

            </v-col>

            <v-col cols="12" sm="6" md="2">

              <v-select v-model="linked" :items="linkOptions" item-title="title" item-value="value"

                label="Привязка" density="compact" variant="outlined" clearable hide-details />

            </v-col>

            <v-col cols="12" sm="6" md="2">

              <v-text-field v-model="dateFrom" type="date" label="Выдано с" density="compact" variant="outlined" hide-details />

            </v-col>

            <v-col cols="12" sm="6" md="2">

              <v-text-field v-model="dateTo" type="date" label="Выдано по" density="compact" variant="outlined" hide-details />

            </v-col>

          </v-row>

          <div class="d-flex align-center flex-wrap ga-2 mt-3">

            <v-chip v-if="scope.buildingId" size="small" color="cyan-darken-3" closable @click:close="clearScope">

              Здание {{ scope.buildingId }}

            </v-chip>

            <v-chip v-if="scope.pipeId" size="small" color="cyan-darken-3" closable @click:close="clearScope">

              Трубопровод {{ scope.pipeId }}

            </v-chip>

            <v-spacer />

            <v-btn variant="text" prepend-icon="mdi-filter-remove-outline" @click="resetFilters">Сбросить</v-btn>

            <v-btn color="cyan-darken-3" prepend-icon="mdi-refresh" :loading="loading" @click="loadConditions">Обновить</v-btn>

          </div>

        </div>

        <v-divider />



        <v-card-text class="pa-0 tu-table-wrap">

          <v-progress-linear v-if="loading" indeterminate color="cyan-darken-3" />

          <v-alert v-if="error" type="error" variant="tonal" class="ma-4">{{ error }}</v-alert>

          <div v-else-if="!loading && !items.length" class="tu-empty">

            <v-icon size="56" color="grey-lighten-1">mdi-file-search-outline</v-icon>

            <div class="text-subtitle-1 mt-3">Технические условия не найдены</div>

            <div class="text-body-2 text-medium-emphasis mt-1">Измените фильтры и повторите поиск.</div>

          </div>

          <table v-else class="tu-table">

            <thead>

              <tr>

                <th>№ ТУ / дата</th><th>Состояние</th><th>Объект и адрес</th><th>Организация</th>

                <th>Источник / район</th><th>Нагрузка</th><th>Привязка</th><th></th>

              </tr>

            </thead>

            <tbody>

              <tr v-for="item in items" :key="item.id" class="tu-row" @click="openDetails(item.id)">

                <td><strong>{{ item.number || `ТУ ${item.id}` }}</strong><div class="cell-note">{{ formatDate(item.issued_on) }}</div></td>

                <td><v-chip size="small" :color="stateColor(item.state_id)" variant="tonal">{{ item.state_name || 'Не задано' }}</v-chip></td>

                <td class="wide-cell"><strong>{{ item.object_name || 'Объект не указан' }}</strong><div class="cell-note">{{ item.address || item.building_address || 'Адрес не указан' }}</div></td>

                <td class="wide-cell">{{ item.organization_name || '—' }}</td>

                <td>{{ item.heat_source_name || '—' }}<div class="cell-note">{{ item.district_name || 'Район не указан' }}</div></td>

                <td>{{ heatLoad(item.total_heat_load) }}<div v-if="item.load_increase != null" class="cell-note">прирост {{ heatLoad(item.load_increase) }}</div></td>

                <td>

                  <v-icon :color="item.building_link_valid ? 'success' : 'warning'" size="18">

                    {{ item.building_link_valid ? 'mdi-link-variant' : 'mdi-link-variant-off' }}

                  </v-icon>

                  <span class="ml-1">{{ item.building_id || 'нет' }}</span>

                </td>

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

          <v-avatar color="cyan-darken-3" size="40"><v-icon color="white">mdi-file-certificate-outline</v-icon></v-avatar>

          <div class="flex-grow-1" style="min-width: 0">

            <div class="text-subtitle-1 font-weight-bold text-truncate">{{ isNew ? 'Новые ТУ' : selectedTitle }}</div>

            <div class="text-caption text-medium-emphasis" v-if="!isNew">{{ selected?.state_name || 'Состояние не указано' }}</div>

          </div>

          <v-btn icon variant="text" @click="detailsVisible = false"><v-icon>mdi-close</v-icon></v-btn>

        </v-card-title>

        <v-divider />

        <v-card-text class="pa-4">

          <div v-if="detailsLoading" class="d-flex justify-center pa-10"><v-progress-circular indeterminate color="cyan-darken-3" /></div>

          <v-alert v-else-if="detailsError" type="error" variant="tonal">{{ detailsError }}</v-alert>

          <template v-else-if="selected">

            <v-alert v-if="selected.building_id && !selected.building_link_valid" type="warning" variant="tonal" class="mb-4">

              В исходной базе ссылка на здание {{ selected.building_id }} не найдена. Карточка ТУ доступна, позиционирование на карте — нет.

            </v-alert>

            <v-expansion-panels multiple variant="accordion" :model-value="[0, 1]">

              <v-expansion-panel v-for="(group, index) in detailGroups" :key="group.title" :value="index">

                <v-expansion-panel-title>{{ group.title }}</v-expansion-panel-title>

                <v-expansion-panel-text>

                  <v-row dense>

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

                  </v-row>

                </v-expansion-panel-text>

              </v-expansion-panel>



              <template v-if="!isEditing">

              <v-expansion-panel v-if="extensions.length" :value="detailGroups.length">

                <v-expansion-panel-title>Изменения и продления ({{ extensions.length }})</v-expansion-panel-title>

                <v-expansion-panel-text>

                  <v-card v-for="extension in extensions" :key="Number(extension.index)" variant="outlined" class="mb-3 pa-3">

                    <div class="font-weight-bold">Продление {{ extension.index }} · {{ formatDate(extension.changed_on) }}</div>

                    <div v-if="extension.description" class="text-body-2 mt-2">{{ extension.description }}</div>

                    <div class="text-caption text-medium-emphasis mt-2">Нагрузка: {{ heatLoad(extension.total_heat_load) }} · прирост: {{ heatLoad(extension.load_increase) }}</div>

                    <div v-if="extension.additional_measures" class="text-body-2 mt-2">{{ extension.additional_measures }}</div>

                  </v-card>

                </v-expansion-panel-text>

              </v-expansion-panel>



              <v-expansion-panel v-if="connections.length" :value="detailGroups.length + 1">

                <v-expansion-panel-title>Узлы присоединения ({{ connections.length }})</v-expansion-panel-title>

                <v-expansion-panel-text><v-list density="compact">

                  <v-list-item v-for="connection in connections" :key="Number(connection.index)" prepend-icon="mdi-source-branch"

                    :title="String(connection.node || connection.code || `Присоединение ${connection.index}`)"

                    :subtitle="[connection.code && `код ${connection.code}`, connection.load_percent != null && `${connection.load_percent}% нагрузки`].filter(Boolean).join(' · ')" />

                </v-list></v-expansion-panel-text>

              </v-expansion-panel>



              <v-expansion-panel v-if="documents.length" :value="detailGroups.length + 2">

                <v-expansion-panel-title>Документы ({{ documents.length }})</v-expansion-panel-title>

                <v-expansion-panel-text><v-list density="compact">

                  <v-list-item v-for="(document, index) in documents" :key="`${document.kind}-${document.index || index}`" prepend-icon="mdi-file-document-outline"

                    :title="documentTitle(document)" :subtitle="fileName(document.path)" />

                </v-list></v-expansion-panel-text>

              </v-expansion-panel>

              </template>

            </v-expansion-panels>

          </template>

        </v-card-text>

        <v-divider />

        <v-card-actions class="px-4 py-3">

          <v-btn v-if="!isEditing && selected && hasCoordinates(selected)" prepend-icon="mdi-crosshairs-gps" variant="tonal" color="cyan-darken-3" @click="locateSelected">

            На карте

          </v-btn>

          <v-btn v-if="mutationsEnabled && (!isEditing)" variant="text" prepend-icon="mdi-pencil" @click="startEdit">Редактировать</v-btn>

          <v-btn v-if="mutationsEnabled && !isEditing && selected && !isNew" color="error" variant="text" prepend-icon="mdi-delete" :loading="deleting" @click="deleteTechnicalCondition(selected.id)">Удалить</v-btn>

          <v-spacer />

          <template v-if="isEditing">

            <v-btn v-if="mutationsEnabled" variant="text" @click="cancelEdit">Отмена</v-btn>

            <v-btn v-if="mutationsEnabled" color="cyan-darken-3" variant="flat" :loading="saving" @click="saveChanges">Сохранить</v-btn>

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

  type TechnicalConditionDetails,

  type TechnicalConditionLookups,

  type TechnicalConditionSummary

} from '~/services/fastApiService'



export interface TechnicalConditionJournalScope { buildingId?: number; pipeId?: number; conditionId?: number }

const emit = defineEmits<{

  'locate-technical-condition': [coordinates: { longitude: number; latitude: number; id: number; label: string }]

}>()

const { isMobile } = useMobile()
const mutationsEnabled = useMutationsEnabled()

const visible = ref(false), loading = ref(false), error = ref('')

const items = ref<TechnicalConditionSummary[]>([])

const total = ref(0), pages = ref(0), page = ref(1)

const pageSize = 50

const search = ref(''), dateFrom = ref(''), dateTo = ref('')

const stateId = ref<number | undefined>(), issueYear = ref<number | undefined>()

const heatSource = ref<string | undefined>(), district = ref<string | undefined>()

const linked = ref<boolean | undefined>()

const scope = reactive<TechnicalConditionJournalScope>({})

const lookups = reactive<TechnicalConditionLookups>({ states: [], heat_sources: [], districts: [], years: [] })

const linkOptions = [{ title: 'Привязанные', value: true }, { title: 'Без привязки', value: false }]

const detailsVisible = ref(false), detailsLoading = ref(false), detailsError = ref('')

const selected = ref<TechnicalConditionDetails | null>(null)

let searchTimer: ReturnType<typeof setTimeout> | undefined



const isEditing = ref(false)

const isNew = ref(false)

const saving = ref(false)

const creating = ref(false)

const deleting = ref(false)

const editFields = ref<Record<string, any>>({})



const scopeTitle = computed(() => scope.buildingId ? `ТУ здания ${scope.buildingId}` : scope.pipeId ? `ТУ трубопровода ${scope.pipeId}` : 'весь реестр')

const selectedTitle = computed(() => selected.value?.number ? `ТУ № ${selected.value.number}` : `Технические условия ${selected.value?.id || ''}`)

const formatDate = (value: unknown) => {

  if (!value) return '—'

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)

  return match ? `${match[3]}.${match[2]}.${match[1]}` : String(value)

}

const formatValue = (value: unknown) => value === null || value === undefined || value === '' ? '—' : typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? formatDate(value) : String(value)

const heatLoad = (value: unknown) => value === null || value === undefined || value === '' ? '—' : `${Number(value).toLocaleString('ru-RU')} Гкал/ч`

const stateColor = (state: number | null) => state === 1 ? 'success' : state === 4 ? 'info' : state === 2 || state === 3 ? 'warning' : 'grey'

const hasCoordinates = (item: { longitude?: unknown; latitude?: unknown }) => Number.isFinite(Number(item.longitude)) && Number.isFinite(Number(item.latitude))

const fileName = (path: unknown) => String(path || 'Путь не указан').split(/[\\/]/).pop() || 'Файл'

const documentTitle = (document: Record<string, unknown>) => document.kind === 'contract' ? 'Договор' : document.kind === 'admission_act' ? 'Акт допуска' : `Технические условия${document.index ? ` · файл ${document.index}` : ''}`

const buildFields = (entries: Array<[string, unknown, string?, string?, any[]?]>) => {

  return entries

    .filter(([, value]) => isEditing.value || (value !== null && value !== undefined && value !== ''))

    .map(([label, value, key, type, items]) => ({

      label, value: formatValue(value), rawValue: value, key, type: type || 'text', items

    }))

}



const loadLookups = async () => { if (!lookups.states.length) Object.assign(lookups, await fastApiService.getTechnicalConditionLookups()) }

const loadConditions = async () => {

  loading.value = true; error.value = ''

  try {

    const response = await fastApiService.getTechnicalConditions({

      page: page.value, page_size: pageSize, state_id: stateId.value, issue_year: issueYear.value,

      heat_source: heatSource.value, district: district.value, linked: linked.value,

      date_from: dateFrom.value || undefined, date_to: dateTo.value || undefined,

      building_id: scope.buildingId, pipe_id: scope.pipeId, search: search.value.trim() || undefined

    })

    items.value = response.items; total.value = response.total; pages.value = response.pages

  } catch (loadError: any) {

    error.value = loadError?.data?.detail || loadError?.message || 'Не удалось загрузить реестр технических условий'

  } finally { loading.value = false }

}

const openDetails = async (id: number) => {

  detailsVisible.value = true; detailsLoading.value = true; detailsError.value = ''; selected.value = null

  try { selected.value = await fastApiService.getTechnicalCondition(id) }

  catch (loadError: any) { detailsError.value = loadError?.data?.detail || loadError?.message || 'Не удалось открыть карточку технических условий' }

  finally { detailsLoading.value = false }

}

const openDialog = async (nextScope: TechnicalConditionJournalScope = {}) => {

  Object.assign(scope, { buildingId: undefined, pipeId: undefined, conditionId: undefined }, nextScope)

  page.value = 1; visible.value = true

  try { await Promise.all([loadLookups(), loadConditions()]); if (nextScope.conditionId) await openDetails(nextScope.conditionId) }

  catch (loadError: any) { error.value = loadError?.message || 'Не удалось открыть реестр технических условий' }

}

const clearScope = () => { scope.buildingId = undefined; scope.pipeId = undefined; page.value = 1; void loadConditions() }

const resetFilters = () => {

  search.value = ''; stateId.value = undefined; issueYear.value = undefined; heatSource.value = undefined

  district.value = undefined; linked.value = undefined; dateFrom.value = ''; dateTo.value = ''; page.value = 1; void loadConditions()

}

const locateSelected = () => {

  const item = selected.value

  if (!item || !hasCoordinates(item)) return

  emit('locate-technical-condition', { longitude: Number(item.longitude), latitude: Number(item.latitude), id: item.id, label: item.number ? `ТУ № ${item.number}` : `ТУ ${item.id}` })

  detailsVisible.value = false; visible.value = false

}



const detailGroups = computed(() => {

  const item = isEditing.value ? editFields.value : selected.value

  if (!item && !isNew.value) return []

  return [

    { title: 'Основные сведения', fields: buildFields([

      ['Номер ТУ', item?.number, 'number', 'text'], ['Дата выдачи', item?.issued_on, 'issued_on', 'date'], ['Состояние', item?.state_name, 'state_id', 'select', lookups.states], ['Дата аннулирования', item?.annulled_on, 'annulled_on', 'date'],

      ['Организация-заявитель', item?.organization_name, 'organization_name', 'text'], ['Объект', item?.object_name, 'object_name', 'text'], ['Адрес', item?.address, 'address', 'textarea'], ['Источник', item?.heat_source_name, 'heat_source_id', 'select', lookups.heat_sources],

      ['Район эксплуатации', item?.district_name, 'district_id', 'select', lookups.districts], ['Камера', item?.connection_chamber, 'connection_chamber', 'text'], ['Срок действия', item?.validity_period, 'validity_period', 'text']

    ]) },

    { title: 'Тепловые нагрузки', fields: buildFields([

      ['Общая, Гкал/ч', item?.total_heat_load, 'total_heat_load', 'number'], ['Отопление', item?.heating_load, 'heating_load', 'number'], ['Вентиляция', item?.ventilation_load, 'ventilation_load', 'number'],

      ['ГВС макс.', item?.hot_water_max_load, 'hot_water_max_load', 'number'], ['ГВС средн.', item?.hot_water_average_load, 'hot_water_average_load', 'number'], ['Прирост нагрузки', item?.load_increase, 'load_increase', 'number'],

      ['Прирост отопления', item?.heating_load_increase, 'heating_load_increase', 'number'], ['Прирост вентиляции', item?.ventilation_load_increase, 'ventilation_load_increase', 'number'],

      ['Прирост ГВС макс.', item?.hot_water_max_load_increase, 'hot_water_max_load_increase', 'number'], ['Прирост ГВС средн.', item?.hot_water_average_load_increase, 'hot_water_average_load_increase', 'number']

    ]) },

    { title: 'Согласования и мероприятия', fields: buildFields([

      ['Согласование ТС', item?.network_approval_number, 'network_approval_number', 'text'], ['Дата согласования ТС', item?.network_approval_date, 'network_approval_date', 'date'],

      ['Согласование ОВ', item?.heating_approval_number, 'heating_approval_number', 'text'], ['Дата согласования ОВ', item?.heating_approval_date, 'heating_approval_date', 'date'],

      ['Согласование ТП', item?.project_approval_number, 'project_approval_number', 'text'], ['Дата согласования ТП', item?.project_approval_date, 'project_approval_date', 'date'],

      ['Дополнительные мероприятия', item?.additional_measures, 'additional_measures', 'textarea'], ['Исполнение мероприятий', item?.measures_completion, 'measures_completion', 'textarea'], ['Стадия строительства', item?.construction_stage, 'construction_stage', 'text']

    ]) },

    { title: 'Акт допуска и договор', fields: buildFields([

      ['Акт допуска №', item?.admission_act_number, 'admission_act_number', 'text'], ['Дата акта', item?.admission_act_date, 'admission_act_date', 'date'], ['Нагрузка по акту', item?.admitted_total_heat_load, 'admitted_total_heat_load', 'number'],

      ['Отопление по акту', item?.admitted_heating_load, 'admitted_heating_load', 'number'], ['Вентиляция по акту', item?.admitted_ventilation_load, 'admitted_ventilation_load', 'number'],

      ['ГВС макс. по акту', item?.admitted_hot_water_max_load, 'admitted_hot_water_max_load', 'number'], ['ГВС средн. по акту', item?.admitted_hot_water_average_load, 'admitted_hot_water_average_load', 'number'],

      ['Договор №', item?.contract_number, 'contract_number', 'text'], ['Дата договора', item?.contract_date, 'contract_date', 'date']

    ]) },

    { title: 'Привязка к объекту', fields: buildFields([

      ['Здание', item?.building_id, 'building_id', 'number'], ['Адрес здания', item?.building_address, 'building_address', 'textarea'], ['Город', item?.building_city, 'building_city', 'text'], ['Микрорайон', item?.building_microdistrict, 'building_microdistrict', 'text'],

      ['Улица', item?.building_street, 'building_street', 'text'], ['Дом', item?.building_house, 'building_house', 'text'], ['Код узла присоединения', item?.building_connection_code, 'building_connection_code', 'text'],

      ['Узел присоединения', item?.building_connection_node, 'building_connection_node', 'text'], ['Трубопровод', item?.pipe_id, 'pipe_id', 'number'], ['Комментарий', item?.building_note, 'building_note', 'textarea']

    ]) }

  ].filter(group => group.fields.length)

})

const extensions = computed(() => selected.value?.relations?.extensions || [])

const documents = computed(() => selected.value?.relations?.documents || [])

const connections = computed(() => selected.value?.relations?.connections || [])



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



const createTechnicalCondition = async () => {

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

      const result = await fastApiService.createObject('tehnicheskie_usloviya', editFields.value)

      if (result && result.id) {

        isEditing.value = false

        await loadConditions()

        await openDetails(result.id)

      }

    } else if (selected.value) {

      const changes: Record<string, any> = {}

      for (const [k, v] of Object.entries(editFields.value)) {

        if (v !== selected.value[k as keyof TechnicalConditionDetails]) {

          changes[k] = v

        }

      }

      if (Object.keys(changes).length > 0) {

        await fastApiService.updateObjectAttributes('tehnicheskie_usloviya', selected.value.id.toString(), changes)

      }

      isEditing.value = false

      await loadConditions()

      await openDetails(selected.value.id)

    }

  } catch (e: any) {

    detailsError.value = 'Ошибка при сохранении: ' + (e?.message || '')

  } finally {

    saving.value = false

  }

}



const deleteTechnicalCondition = async (id: number) => {

  if (!confirm(`Вы действительно хотите удалить ТУ #${id}?`)) return

  try {

    deleting.value = true

    await fastApiService.deleteObject('tehnicheskie_usloviya', id)

    detailsVisible.value = false

    await loadConditions()

  } catch (e: any) {

    detailsError.value = 'Ошибка при удалении: ' + (e?.message || '')

  } finally {

    deleting.value = false

  }

}



watch(page, () => { if (visible.value) void loadConditions() })

watch([stateId, issueYear, heatSource, district, linked, dateFrom, dateTo], () => { if (visible.value) { page.value = 1; void loadConditions() } })

watch(search, () => { if (!visible.value) return; if (searchTimer) clearTimeout(searchTimer); searchTimer = setTimeout(() => { page.value = 1; void loadConditions() }, 350) })

defineExpose({ openDialog })

</script>



<style scoped>

.tu-journal { height: min(90vh, 920px); display: flex; flex-direction: column; }

.tu-filters { flex-shrink: 0; background: #fafafa; }

.tu-table-wrap { min-height: 280px; overflow: auto; flex: 1; }

.tu-table { width: 100%; min-width: 1320px; border-collapse: collapse; font-size: .84rem; }

.tu-table th { position: sticky; top: 0; z-index: 1; background: #eceff1; color: #546e7a; text-align: left; padding: 10px 12px; }

.tu-table td { padding: 10px 12px; border-bottom: 1px solid #eceff1; vertical-align: top; }

.tu-row { cursor: pointer; }.tu-row:hover { background: #e0f7fa; }

.wide-cell { max-width: 260px; }.cell-note { color: #78909c; font-size: .75rem; margin-top: 3px; }

.tu-empty { min-height: 320px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 32px; }

.detail-label { color: #78909c; font-size: .72rem; font-weight: 600; letter-spacing: .03em; text-transform: uppercase; }

.detail-value { color: #263238; font-size: .9rem; margin-top: 3px; overflow-wrap: anywhere; }

@media (max-width: 600px) { .tu-journal { height: 100dvh; } }

</style>

