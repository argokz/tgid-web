<template>
  <v-dialog v-model="visible" :fullscreen="isMobile" max-width="1580" scrollable>
    <v-card :rounded="isMobile ? 0 : 'lg'">
      <v-toolbar color="deep-purple-darken-3" density="compact">
        <v-icon class="ml-3 mr-2">mdi-valve</v-icon>
        <v-toolbar-title>Запорная и регулирующая арматура</v-toolbar-title>
        <v-chip class="mr-2" size="small" color="white" variant="outlined">
          {{ lookups.counts.ready || 0 }}/{{ lookups.counts.total || 0 }} на активных линиях
        </v-chip>
        <v-btn icon="mdi-close" aria-label="Закрыть" @click="visible = false" />
      </v-toolbar>

      <div class="alerts pa-3 pb-0">
        <v-alert
          v-if="lookups.damper_result_count === 0 && lookups.regulating_result_count === 0"
          type="info"
          variant="tonal"
          density="compact"
          class="mb-2"
        >
          Расчётные таблицы <code>ZD_OUT</code> и <code>ZD2_OUT</code> пусты. Паспортные параметры доступны,
          а расход, потеря напора и гидравлическое сопротивление появятся после сохранения расчёта сети.
        </v-alert>
        <v-alert type="warning" variant="tonal" density="compact" class="mb-2">
          Геометрия доступна только для {{ lookups.counts.locatable || 0 }} из {{ lookups.counts.total || 0 }} записей.
          Остальные задвижки принадлежат расчётным линиям без геометрии или потеряли связь с линией.
        </v-alert>
      </div>

      <v-tabs v-model="activeTab" color="deep-purple-darken-3" class="px-3 mt-2" @update:model-value="onTabChange">
        <v-tab value="inventory">Оборудование ({{ lookups.counts.total || 0 }})</v-tab>
        <v-tab value="catalog">Каталог задвижек ({{ lookups.catalog_count || 0 }})</v-tab>
      </v-tabs>

      <v-window v-model="activeTab">
        <v-window-item value="inventory">
          <div class="metric-row pa-3 pb-0">
            <v-chip
              v-for="metric in qualityMetrics"
              :key="metric.value"
              :color="metric.color"
              :variant="filters.quality_status === metric.value ? 'flat' : 'tonal'"
              @click="setQualityStatus(metric.value)"
            >
              {{ metric.label }}: {{ lookups.counts[metric.value] || 0 }}
            </v-chip>
          </div>

          <div class="filters pa-3">
            <v-text-field
              v-model="filters.search"
              label="Назначение, узел, линия или ID"
              prepend-inner-icon="mdi-magnify"
              density="compact"
              variant="outlined"
              clearable
              hide-details
              @keyup.enter="reloadInventory"
            />
            <v-select
              v-model="filters.equipment_type"
              :items="equipmentTypeOptions"
              label="Тип оборудования"
              density="compact"
              variant="outlined"
              clearable
              hide-details
            />
            <v-select
              v-model="filters.quality_status"
              :items="qualityOptions"
              label="Качество привязки"
              density="compact"
              variant="outlined"
              clearable
              hide-details
            />
            <v-select
              v-model="filters.state_id"
              :items="lookups.states"
              item-title="name"
              item-value="id"
              label="Состояние"
              density="compact"
              variant="outlined"
              clearable
              hide-details
            />
            <v-select
              v-model="filters.fragment_id"
              :items="lookups.fragments"
              item-title="name"
              item-value="id"
              label="Фрагмент"
              density="compact"
              variant="outlined"
              clearable
              hide-details
            />
            <v-select
              v-model="filters.purpose"
              :items="purposeOptions"
              item-title="name"
              item-value="name"
              label="Назначение"
              density="compact"
              variant="outlined"
              clearable
              hide-details
            />
            <v-btn color="deep-purple-darken-3" :loading="loading" @click="reloadInventory">Найти</v-btn>
          </div>

          <JournalError :message="error" />
          <div class="table-wrap">
            <table class="journal-table">
              <thead>
                <tr>
                  <th>ID</th><th>Тип</th><th>Линия / узлы</th><th>Назначение</th><th>DN</th>
                  <th>Открытие</th><th>Состояние</th><th>Фрагмент</th><th>Качество</th><th />
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in inventory" :key="`${item.equipment_type}-${item.id}`" @click="openItemDetails(item.equipment_type, item.id)">
                  <td>{{ item.id }}</td>
                  <td>{{ equipmentTypeLabel(item.equipment_type) }}</td>
                  <td>
                    {{ item.line_id ?? '—' }}
                    <div class="muted">{{ nodeLabel(item.node_code_1, item.node_name_1, item.node_id_1) }} → {{ nodeLabel(item.node_code_2, item.node_name_2, item.node_id_2) }}</div>
                  </td>
                  <td>{{ item.purpose_name || 'не указано' }}</td>
                  <td>{{ formatUnit(item.nominal_diameter, 'мм') }}</td>
                  <td>{{ formatUnit(item.opening_percent, '%') }}</td>
                  <td><v-chip size="x-small" :color="stateColor(item.state_name)">{{ item.state_name || '—' }}</v-chip></td>
                  <td>{{ item.fragment_name || `№${item.fragment_id || '—'}` }}</td>
                  <td><v-chip size="x-small" :color="qualityColor(item.quality_status)">{{ qualityLabel(item.quality_status) }}</v-chip></td>
                  <td>
                    <v-btn
                      v-if="hasCoordinates(item)"
                      icon="mdi-map-marker"
                      size="x-small"
                      variant="text"
                      aria-label="Показать арматуру на карте"
                      @click.stop="locate(item)"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-if="!loading && !inventory.length" class="empty">Оборудование не найдено</div>
            <v-progress-linear v-if="loading" indeterminate color="deep-purple-darken-3" />
          </div>
          <v-pagination v-if="inventoryPages > 1" v-model="inventoryPage" :length="inventoryPages" density="comfortable" @update:model-value="loadInventory" />
        </v-window-item>

        <v-window-item value="catalog">
          <div class="filters pa-3">
            <v-text-field
              v-model="catalogFilters.search"
              label="Марка, материал, изготовитель или ID"
              prepend-inner-icon="mdi-magnify"
              density="compact"
              variant="outlined"
              clearable
              hide-details
              @keyup.enter="reloadCatalog"
            />
            <v-btn color="deep-purple-darken-3" :loading="loading" @click="reloadCatalog">Найти</v-btn>
          </div>
          <JournalError :message="error" />
          <div class="table-wrap catalog-table-wrap">
            <table class="journal-table">
              <thead><tr><th>ID</th><th>Марка</th><th>DN</th><th>Давление</th><th>Температура</th><th>Присоединение</th><th>Привод</th><th>Материал</th><th>Используется</th></tr></thead>
              <tbody>
                <tr v-for="item in catalog" :key="item.id" @click="openCatalogDetails(item.id)">
                  <td>{{ item.id }}</td><td><strong>{{ item.name_zc || item.name || '—' }}</strong></td>
                  <td>{{ formatUnit(item.d, 'мм') }}</td><td>{{ formatNumber(item.p) }}</td><td>{{ formatUnit(item.t, '°C') }}</td>
                  <td>{{ item.tris || '—' }}</td><td>{{ item.tip_privod || '—' }}</td><td>{{ item.material || '—' }}</td><td>{{ item.installed_count }}</td>
                </tr>
              </tbody>
            </table>
            <div v-if="!loading && !catalog.length" class="empty">Модели не найдены</div>
            <v-progress-linear v-if="loading" indeterminate color="deep-purple-darken-3" />
          </div>
          <v-pagination v-if="catalogPages > 1" v-model="catalogPage" :length="catalogPages" density="comfortable" @update:model-value="loadCatalog" />
        </v-window-item>
      </v-window>
    </v-card>
  </v-dialog>

  <v-dialog v-model="detailVisible" :fullscreen="isMobile" max-width="1180" scrollable>
    <v-card :rounded="isMobile ? 0 : 'lg'">
      <v-toolbar color="deep-purple-darken-3" density="compact">
        <v-btn icon="mdi-arrow-left" aria-label="Вернуться к журналу" @click="detailVisible = false" />
        <v-toolbar-title>{{ detailTitle }}</v-toolbar-title>
        <v-btn icon="mdi-close" aria-label="Закрыть карточку" @click="detailVisible = false" />
      </v-toolbar>
      <v-progress-linear v-if="detailLoading" indeterminate color="deep-purple-darken-3" />

      <template v-if="itemDetails && !detailLoading">
        <div class="alerts pa-3 pb-0">
          <v-alert v-if="itemDetails.quality_status !== 'ready'" :type="itemDetails.quality_status === 'line_missing' ? 'error' : 'warning'" variant="tonal" density="compact">
            {{ qualityDescription(itemDetails.quality_status) }}
          </v-alert>
          <v-alert v-if="itemDetails.catalog_status === 'unassigned'" type="info" variant="tonal" density="compact">
            Паспортная модель не выбрана. В текущей базе все установленные задвижки не связаны с шестью моделями каталога.
          </v-alert>
        </div>
        <v-row class="ma-0 pa-3">
          <v-col cols="12" md="6">
            <v-card variant="outlined" class="mb-3">
              <v-card-title class="text-subtitle-1">Сетевая привязка</v-card-title>
              <v-card-text class="detail-grid">
                <DetailValue label="Тип / ID" :value="`${equipmentTypeLabel(itemDetails.equipment_type)} / ${itemDetails.id}`" />
                <DetailValue label="Линия" :value="itemDetails.line_id" />
                <DetailValue label="Начальный узел" :value="nodeLabel(itemDetails.node_code_1, itemDetails.node_name_1, itemDetails.node_id_1)" />
                <DetailValue label="Конечный узел" :value="nodeLabel(itemDetails.node_code_2, itemDetails.node_name_2, itemDetails.node_id_2)" />
                <DetailValue label="Фрагмент" :value="itemDetails.fragment_name" />
                <DetailValue label="Статус линии" :value="qualityLabel(itemDetails.quality_status)" />
              </v-card-text>
            </v-card>
            
            <template v-if="!isEditing">
              <v-card variant="outlined">
                <v-card-title class="text-subtitle-1">Исходные параметры</v-card-title>
                <v-card-text class="detail-grid">
                  <DetailValue label="Назначение" :value="itemDetails.purpose_name" />
                  <DetailValue label="Состояние" :value="itemDetails.state_name" />
                  <DetailValue label="Условный диаметр" :value="formatUnit(itemDetails.nominal_diameter, 'мм')" />
                  <DetailValue label="Степень открытия" :value="formatUnit(itemDetails.opening_percent, '%')" />
                  <DetailValue label="Относительная утечка" :value="formatNumber(itemDetails.relative_leakage, 6)" />
                  <DetailValue label="Сопротивление линии" :value="formatNumber(itemDetails.line_hydraulic_resistance, 6)" />
                  <DetailValue label="Число оборотов" :value="itemDetails.turn_count" />
                  <DetailValue label="Управление затвором" :value="itemDetails.gate_control" />
                  <DetailValue v-if="itemDetails.equipment_type === 'regulating'" label="Заданный перепад" :value="formatNumber(itemDetails.set_pressure_drop, 6)" />
                  <DetailValue v-if="itemDetails.equipment_type === 'regulating'" label="Заданный расход" :value="formatNumber(itemDetails.set_flow, 6)" />
                </v-card-text>
              </v-card>
            </template>
            <template v-else>
              <v-card variant="outlined">
                <v-card-title class="text-subtitle-1">Редактирование параметров</v-card-title>
                <v-card-text>
                  <v-row dense>
                    <v-col v-for="field in buildFields()" :key="field.key" cols="12" sm="6">
                      <div class="detail-label mb-1">{{ field.label }}</div>
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
                        v-else
                        v-model="editFields[field.key]"
                        :type="field.type === 'number' ? 'number' : 'text'"
                        density="compact"
                        hide-details
                        variant="outlined"
                        clearable
                      />
                    </v-col>
                  </v-row>
                </v-card-text>
              </v-card>
            </template>
          </v-col>
          <v-col cols="12" md="6">
            <v-card v-if="itemDetails.standard" variant="outlined" class="mb-3">
              <v-card-title class="text-subtitle-1">Паспорт модели</v-card-title>
              <v-card-text class="detail-grid">
                <DetailValue label="Марка" :value="itemDetails.standard.name_zc" />
                <DetailValue label="DN" :value="formatUnit(itemDetails.standard.d, 'мм')" />
                <DetailValue label="Давление" :value="formatNumber(itemDetails.standard.p)" />
                <DetailValue label="Температура" :value="formatUnit(itemDetails.standard.t, '°C')" />
                <DetailValue label="Присоединение" :value="itemDetails.standard.tris" />
                <DetailValue label="Привод" :value="itemDetails.standard.tip_privod" />
                <DetailValue label="Материал" :value="itemDetails.standard.material" />
                <DetailValue label="Изготовитель" :value="itemDetails.standard.producer" />
              </v-card-text>
            </v-card>
            <v-alert v-if="!itemDetails.latest_output" type="info" variant="tonal" density="compact">
              Гидравлический режим для этой арматуры пока не рассчитан.
            </v-alert>
            <v-card v-else variant="outlined">
              <v-card-title class="text-subtitle-1">Последний расчётный режим</v-card-title>
              <v-card-text class="detail-grid">
                <DetailValue label="Состояние" :value="outputValue('state_text')" />
                <DetailValue label="Расход" :value="formatNumber(outputValue('flow'), 6)" />
                <DetailValue label="Потеря напора" :value="formatNumber(outputValue('head_loss'), 6)" />
                <DetailValue label="Гидравлическое сопротивление" :value="formatNumber(outputValue('hydraulic_resistance'), 6)" />
                <DetailValue label="Располагаемый напор в конце" :value="formatNumber(outputValue('available_head_end'), 6)" />
                <DetailValue label="Пьезометрический напор в конце" :value="formatNumber(outputValue('piezometric_head_end'), 6)" />
                <DetailValue label="Геодезическая отметка" :value="formatNumber(outputValue('geodetic_mark_end'), 6)" />
                <DetailValue label="Полный напор в конце" :value="formatNumber(outputValue('total_head_end'), 6)" />
              </v-card-text>
            </v-card>
            <v-btn
              v-if="hasCoordinates(itemDetails)"
              class="mt-3"
              color="deep-purple-darken-3"
              prepend-icon="mdi-map-marker"
              @click="locate(itemDetails)"
            >Показать на карте</v-btn>
          </v-col>
        </v-row>
        <v-divider />
        <v-card-actions class="px-4 py-3 bg-grey-lighten-4">
          <v-spacer />
          <template v-if="!isEditing">
            <v-btn v-if="mutationsEnabled" color="primary" variant="flat" prepend-icon="mdi-pencil" @click="startEdit">Редактировать</v-btn>
          </template>
          <template v-else>
            <v-btn v-if="mutationsEnabled" color="error" variant="text" @click="cancelEdit" :disabled="saving">Отмена</v-btn>
            <v-btn v-if="mutationsEnabled" color="primary" variant="flat" @click="saveChanges" :loading="saving">Сохранить</v-btn>
          </template>
        </v-card-actions>
      </template>

      <template v-else-if="catalogDetails && !detailLoading">
        <v-row class="ma-0 pa-3">
          <v-col cols="12" md="6">
            <v-card variant="outlined">
              <v-card-title class="text-subtitle-1">Паспорт задвижки</v-card-title>
              <v-card-text class="detail-grid">
                <DetailValue label="ID / марка" :value="`${catalogDetails.id} / ${catalogDetails.name_zc || '—'}`" />
                <DetailValue label="Наименование" :value="catalogDetails.name" />
                <DetailValue label="Условный диаметр" :value="formatUnit(catalogDetails.d, 'мм')" />
                <DetailValue label="Давление" :value="formatNumber(catalogDetails.p)" />
                <DetailValue label="Макс. температура" :value="formatUnit(catalogDetails.t, '°C')" />
                <DetailValue label="Присоединение" :value="catalogDetails.tris" />
                <DetailValue label="Число болтов" :value="catalogDetails.kol_bolt" />
                <DetailValue label="Тип привода" :value="catalogDetails.tip_privod" />
                <DetailValue label="Исполнение привода" :value="catalogDetails.isp_privod" />
                <DetailValue label="Обороты маховика" :value="catalogDetails.obor_maxovik" />
                <DetailValue label="Материал" :value="catalogDetails.material" />
                <DetailValue label="Масса" :value="formatUnit(catalogDetails.macca, 'кг')" />
                <DetailValue label="Изготовитель" :value="catalogDetails.producer" />
                <DetailValue label="Установлено" :value="catalogDetails.installed_count" />
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="6">
            <v-alert type="info" variant="tonal" density="compact">
              Справочник содержит шесть моделей 30ч47бр, но ни одна установленная задвижка текущей базы с ними не связана.
            </v-alert>
          </v-col>
        </v-row>
      </template>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, ref, type PropType } from 'vue'
import { useMobile } from '~/composables/useMobile'
import { useMutationsEnabled } from '~/composables/useMutationsEnabled'
import {
  fastApiService,
  type NetworkArmatureDetails,
  type NetworkArmatureFilters,
  type NetworkArmatureLookups,
  type NetworkArmatureQualityStatus,
  type NetworkArmatureSummary,
  type NetworkArmatureType,
  type StandardDamperDetails,
  type StandardDamperFilters,
  type StandardDamperSummary
} from '~/services/fastApiService'

const DetailValue = defineComponent({
  props: { label: { type: String, required: true }, value: { type: [String, Number] as PropType<string | number | null | undefined>, default: null } },
  setup: props => () => h('div', { class: 'detail-value' }, [h('span', { class: 'detail-label' }, props.label), h('strong', String(props.value ?? '—'))])
})
const JournalError = defineComponent({
  props: { message: { type: String, default: '' } },
  setup: props => () => props.message ? h('div', { class: 'journal-error' }, props.message) : null
})

const emit = defineEmits<{
  'locate-armature': [payload: { longitude: number; latitude: number; id: number; lineId: number | null; label: string }]
}>()
const { isMobile } = useMobile()
const mutationsEnabled = useMutationsEnabled()
const emptyLookups = (): NetworkArmatureLookups => ({ states: [], purposes: [], fragments: [], counts: {}, catalog_count: 0, calculation_count: 0, damper_result_count: 0, regulating_result_count: 0, passport_asset_count: 0 })
const visible = ref(false)
const detailVisible = ref(false)
const loading = ref(false)
const detailLoading = ref(false)
const error = ref('')
const activeTab = ref<'inventory' | 'catalog'>('inventory')
const inventoryPage = ref(1)
const inventoryPages = ref(0)
const catalogPage = ref(1)
const catalogPages = ref(0)
const inventory = ref<NetworkArmatureSummary[]>([])
const catalog = ref<StandardDamperSummary[]>([])
const itemDetails = ref<NetworkArmatureDetails | null>(null)
const catalogDetails = ref<StandardDamperDetails | null>(null)
const lookups = ref<NetworkArmatureLookups>(emptyLookups())
const filters = ref<NetworkArmatureFilters>({})
const catalogFilters = ref<StandardDamperFilters>({})
const isEditing = ref(false)
const saving = ref(false)
const editFields = ref<Record<string, any>>({})

const buildFields = () => {
  const isDamper = itemDetails.value?.equipment_type === 'damper'
  return [
    { label: 'Назначение', key: isDamper ? 'dispatcherswitch' : 'regarmtype', type: 'text', value: itemDetails.value?.purpose_name },
    { label: 'Состояние', key: 'damperarmaturestateid', type: 'select', items: lookups.value.states, value: itemDetails.value?.state_id },
    { label: 'Условный диаметр', key: 'diametercondit', type: 'number', value: itemDetails.value?.nominal_diameter },
    { label: 'Степень открытия', key: isDamper ? 'partdempopen' : 'damperopendeg', type: 'number', value: itemDetails.value?.opening_percent },
    { label: 'Относительная утечка', key: isDamper ? 'relatleakage' : 'relleakage', type: 'number', value: itemDetails.value?.relative_leakage },
    { label: 'Число оборотов', key: isDamper ? 'turncount' : 'rotationcount', type: 'number', value: itemDetails.value?.turn_count },
    { label: 'Управление затвором', key: 'gatecontrol', type: 'number', value: itemDetails.value?.gate_control },
    ...(isDamper ? [] : [
      { label: 'Заданный перепад', key: 'regpdmean', type: 'number', value: itemDetails.value?.set_pressure_drop },
      { label: 'Заданный расход', key: 'g', type: 'number', value: itemDetails.value?.set_flow }
    ])
  ]
}

const startEdit = () => {
  isEditing.value = true
  editFields.value = {}
  for (const field of buildFields()) {
    if (field.key) editFields.value[field.key] = field.value ?? null
  }
}

const cancelEdit = () => {
  isEditing.value = false
  editFields.value = {}
}

const saveChanges = async () => {
  if (!itemDetails.value) return
  saving.value = true
  try {
    const table = itemDetails.value.equipment_type === 'damper' ? 'zadv' : 'zadv2'
    
    // Process number fields to not pass empty strings as numbers
    const processedFields: Record<string, any> = {}
    for (const key in editFields.value) {
      if (editFields.value[key] === '') processedFields[key] = null
      else processedFields[key] = editFields.value[key]
    }
    
    await fastApiService.updateObjectAttributes(table, itemDetails.value.id, processedFields)
    
    // Refresh
    await openItemDetails(itemDetails.value.equipment_type, itemDetails.value.id)
    isEditing.value = false
    await loadInventory()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Ошибка при сохранении'
  } finally {
    saving.value = false
  }
}

const equipmentTypeOptions = [
  { title: 'Задвижка', value: 'damper' },
  { title: 'Регулирующая арматура', value: 'regulating' }
]
const qualityOptions = [
  { title: 'Готово', value: 'ready' },
  { title: 'Нет линии', value: 'line_missing' },
  { title: 'Линия удалена', value: 'line_removed' },
  { title: 'Назначение не распознано', value: 'purpose_unknown' },
  { title: 'Подозрительный диаметр', value: 'diameter_suspicious' }
]
const qualityMetrics: Array<{ value: NetworkArmatureQualityStatus; label: string; color: string }> = [
  { value: 'ready', label: 'Готовы', color: 'green' },
  { value: 'line_missing', label: 'Нет линии', color: 'red' },
  { value: 'line_removed', label: 'Удалённая линия', color: 'grey' },
  { value: 'purpose_unknown', label: 'Неизвестное назначение', color: 'orange' },
  { value: 'diameter_suspicious', label: 'Диаметр', color: 'amber-darken-3' }
]
const purposeOptions = computed(() => lookups.value.purposes.filter(item => !filters.value.equipment_type || item.equipment_type === filters.value.equipment_type))
const detailTitle = computed(() => itemDetails.value?.display_name || catalogDetails.value?.name_zc || 'Паспорт арматуры')

const loadLookups = async () => {
  if (!lookups.value.counts.total) lookups.value = await fastApiService.getNetworkArmatureLookups()
}
const loadInventory = async () => {
  loading.value = true; error.value = ''
  try {
    const response = await fastApiService.getNetworkArmatures({ ...filters.value, page: inventoryPage.value, page_size: 50 })
    inventory.value = response.items; inventoryPages.value = response.pages
  } catch (reason) { error.value = reason instanceof Error ? reason.message : 'Не удалось загрузить арматуру' } finally { loading.value = false }
}
const loadCatalog = async () => {
  loading.value = true; error.value = ''
  try {
    const response = await fastApiService.getStandardDampers({ ...catalogFilters.value, page: catalogPage.value, page_size: 50 })
    catalog.value = response.items; catalogPages.value = response.pages
  } catch (reason) { error.value = reason instanceof Error ? reason.message : 'Не удалось загрузить каталог задвижек' } finally { loading.value = false }
}
const reloadInventory = () => { inventoryPage.value = 1; void loadInventory() }
const reloadCatalog = () => { catalogPage.value = 1; void loadCatalog() }
const onTabChange = (tab: unknown) => {
  if (tab === 'catalog' && !catalog.value.length) void loadCatalog()
  if (tab === 'inventory' && !inventory.value.length) void loadInventory()
}
const setQualityStatus = (status: NetworkArmatureQualityStatus) => {
  filters.value.quality_status = filters.value.quality_status === status ? undefined : status
  reloadInventory()
}
const openItemDetails = async (equipmentType: NetworkArmatureType, armatureId: number) => {
  detailVisible.value = true; detailLoading.value = true; itemDetails.value = null; catalogDetails.value = null; isEditing.value = false
  try { itemDetails.value = await fastApiService.getNetworkArmature(equipmentType, armatureId) } catch (reason) { error.value = reason instanceof Error ? reason.message : 'Не удалось открыть карточку арматуры'; detailVisible.value = false } finally { detailLoading.value = false }
}
const openCatalogDetails = async (standardId: number) => {
  detailVisible.value = true; detailLoading.value = true; itemDetails.value = null; catalogDetails.value = null; isEditing.value = false
  try { catalogDetails.value = await fastApiService.getStandardDamper(standardId) } catch (reason) { error.value = reason instanceof Error ? reason.message : 'Не удалось открыть паспорт задвижки'; detailVisible.value = false } finally { detailLoading.value = false }
}
const openDialog = async (scope: { equipmentType?: NetworkArmatureType; armatureId?: number; standardId?: number; lineId?: number } = {}) => {
  visible.value = true
  await loadLookups()
  if (scope.standardId) {
    activeTab.value = 'catalog'; catalogFilters.value = {}; catalogPage.value = 1; await loadCatalog(); await openCatalogDetails(scope.standardId); return
  }
  activeTab.value = 'inventory'; filters.value = { equipment_type: scope.equipmentType, line_id: scope.lineId }; inventoryPage.value = 1; await loadInventory()
  if (scope.armatureId && scope.equipmentType) await openItemDetails(scope.equipmentType, scope.armatureId)
}

const hasCoordinates = (item: NetworkArmatureSummary) => item.longitude !== null && item.latitude !== null && Number.isFinite(Number(item.longitude)) && Number.isFinite(Number(item.latitude))
const locate = (item: NetworkArmatureSummary) => emit('locate-armature', { longitude: Number(item.longitude), latitude: Number(item.latitude), id: item.id, lineId: item.line_id, label: item.display_name })
const equipmentTypeLabel = (type: NetworkArmatureType) => type === 'damper' ? 'Задвижка' : 'Регулирующая арматура'
const qualityLabel = (status: NetworkArmatureQualityStatus) => ({ ready: 'готово', line_missing: 'нет линии', line_removed: 'линия удалена', purpose_unknown: 'неизвестное назначение', diameter_suspicious: 'проверить диаметр' })[status]
const qualityColor = (status: NetworkArmatureQualityStatus) => ({ ready: 'green', line_missing: 'red', line_removed: 'grey', purpose_unknown: 'orange', diameter_suspicious: 'amber-darken-3' })[status]
const qualityDescription = (status: NetworkArmatureQualityStatus) => ({ ready: '', line_missing: 'Связанная линия отсутствует: сетевой контекст и позиционирование недоступны.', line_removed: 'Связанная линия помечена удалённой и исключена из активной расчётной схемы.', purpose_unknown: 'Назначение содержит legacy-значение «?» и требует уточнения.', diameter_suspicious: 'Условный диаметр равен нулю или выходит за ожидаемый диапазон.' })[status]
const stateColor = (state: string | null) => state?.toLowerCase() === 'открыта' ? 'green' : state?.toLowerCase() === 'закрыта' ? 'grey' : 'blue-grey'
const nodeLabel = (code: string | null, name: string | null, id: number | null) => [code, name].filter(Boolean).join(' ') || (id ? `№${id}` : '—')
const formatNumber = (value: unknown, digits = 2) => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? '—' : Number(value).toLocaleString('ru-RU', { maximumFractionDigits: digits })
const formatUnit = (value: unknown, unit: string) => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? '—' : `${formatNumber(value, 3)} ${unit}`
const outputValue = (key: string) => itemDetails.value?.latest_output?.[key] as string | number | null | undefined

defineExpose({ openDialog })
</script>

<style scoped>
.alerts{display:grid;gap:8px}.metric-row,.filters{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.filters>*{min-width:180px;flex:1}.filters .v-btn{flex:0 0 auto}.table-wrap{overflow:auto;min-height:330px}.catalog-table-wrap{min-height:220px}.journal-table{width:100%;border-collapse:collapse;font-size:13px}.journal-table th,.journal-table td{padding:9px 10px;border-bottom:1px solid #e0e0e0;text-align:left;white-space:nowrap}.journal-table th{position:sticky;top:0;background:#ede7f6;z-index:1}.journal-table tbody tr{cursor:pointer}.journal-table tbody tr:hover{background:#f7f4fa}.muted{font-size:11px;color:#757575}.empty{text-align:center;color:#757575;padding:32px}.journal-error{margin:0 12px 12px;padding:10px 12px;border-radius:4px;background:#ffebee;color:#b71c1c}.detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}:deep(.detail-value){display:flex;flex-direction:column;min-width:0}:deep(.detail-label){font-size:11px;color:#757575}:deep(.detail-value strong){overflow-wrap:anywhere}
@media(max-width:960px){.filters{display:grid;grid-template-columns:1fr}.filters>*{width:100%}.detail-grid{grid-template-columns:1fr}}
</style>
