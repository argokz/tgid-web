<template>
  <Teleport to="body">
    <v-dialog
      v-model="visible"
      :fullscreen="isMobile"
      max-width="1440"
      scrollable
    >
      <v-card
        class="regulator-journal"
        :rounded="isMobile ? 0 : 'lg'"
      >
        <v-card-title class="d-flex align-center ga-3 px-4 py-3">
          <v-avatar
            color="indigo-lighten-5"
            size="40"
          >
            <v-icon color="indigo-darken-2">mdi-gauge</v-icon>
          </v-avatar>
          <div
            class="flex-grow-1"
            style="min-width: 0"
          >
            <div class="text-subtitle-1 font-weight-bold">Сетевые регуляторы</div>
            <div class="text-caption text-medium-emphasis text-truncate">
              {{ scopeTitle }} · найдено {{ total }} · готовы {{ lookups.counts.ready || 0 }} из {{ lookups.counts.total || 0 }}
            </div>
          </div>
          <SegmentedToggle
            v-model="activeTab"
            :items="tabItems"
            aria-label="Раздел журнала регуляторов"
            class="mr-2"
          />
          <HintTip
            text="Закрыть журнал"
            hotkey="Esc"
            location="bottom"
          >
            <template #default="{ props: tip }">
              <v-btn
                v-bind="tip"
                icon
                variant="text"
                aria-label="Закрыть журнал"
                @click="visible = false"
              >
                <v-icon>mdi-close</v-icon>
              </v-btn>
            </template>
          </HintTip>
        </v-card-title>

        <v-divider />

        <div class="px-3 px-md-4 pt-3 regulator-alerts">
          <v-alert
            v-if="lookupsLoaded && lookups.result_count === 0"
            type="info"
            variant="tonal"
            density="compact"
          >
            Расчётная таблица <code>RS_OUT</code> пуста: исходные задания доступны, полученные расход, напоры,
            сопротивление и положение клапана появятся после сохранения расчёта сети.
          </v-alert>
          <v-alert
            v-if="lookupsLoaded"
            type="warning"
            variant="tonal"
            density="compact"
          >
            Геометрия доступна для {{ lookups.counts.locatable || 0 }} из {{ lookups.counts.total || 0 }} регуляторов;
            у {{ lookups.counts.control_node_missing || 0 }} записей давления/перепада нет регулируемого узла.
          </v-alert>
        </div>

        <template v-if="activeTab === 'inventory'">
          <div
            class="regulator-kpi px-3 px-md-4 pt-3"
            role="group"
            aria-label="Качество данных: фильтр по состоянию"
          >
            <KpiTile
              v-for="metric in qualityMetrics"
              :key="metric.value"
              :label="metric.label"
              :value="lookups.counts[metric.value] || 0"
              :compact="false"
              :status="metric.status"
              selectable
              :active="qualityStatus === metric.value"
              @select="toggleQuality(metric.value)"
            />
          </div>

          <div class="pa-3 pa-md-4 regulator-filters">
            <v-row dense>
              <v-col
                cols="12"
                md="4"
              >
                <SearchField
                  :model-value="search"
                  label="Узел, линия или ID"
                  :debounce="350"
                  :loading="loading"
                  @update:model-value="search = $event"
                  @search="onSearch"
                />
              </v-col>
              <v-col
                cols="12"
                sm="6"
                md="2"
              >
                <AppSelect
                  v-model="regulatorType"
                  :items="typeOptions"
                  item-title="title"
                  item-value="value"
                  label="Тип регулятора"
                />
              </v-col>
              <v-col
                cols="12"
                sm="6"
                md="2"
              >
                <AppSelect
                  v-model="qualityStatus"
                  :items="qualityOptions"
                  item-title="title"
                  item-value="value"
                  label="Качество данных"
                />
              </v-col>
              <v-col
                cols="12"
                sm="6"
                md="2"
              >
                <AppSelect
                  v-model="stateId"
                  :items="lookups.states"
                  item-title="name"
                  item-value="id"
                  label="Состояние"
                />
              </v-col>
              <v-col
                cols="12"
                sm="6"
                md="2"
              >
                <AppSelect
                  v-model="fragmentId"
                  :items="lookups.fragments"
                  item-title="name"
                  item-value="id"
                  label="Фрагмент"
                />
              </v-col>
              <v-col
                cols="12"
                sm="6"
                md="2"
              >
                <AppSelect
                  v-model="workAttributeId"
                  :items="lookups.work_attributes"
                  item-title="name"
                  item-value="id"
                  label="Режим работы"
                />
              </v-col>
            </v-row>

            <div class="d-flex align-center flex-wrap ga-2 mt-3">
              <v-chip
                v-if="scope.lineId"
                size="small"
                color="primary"
                closable
                @click:close="clearScope"
              >
                Линия {{ scope.lineId }}
              </v-chip>
              <v-spacer />
              <v-btn
                variant="text"
                prepend-icon="mdi-filter-remove-outline"
                :disabled="!filtersActive"
                @click="resetFilters"
              >
                Сбросить
              </v-btn>
              <v-btn
                variant="tonal"
                prepend-icon="mdi-refresh"
                :loading="loading"
                @click="loadInventory"
              >
                Обновить
              </v-btn>
            </div>
          </div>

          <v-divider />

          <v-card-text class="pa-0 regulator-table-wrap">
            <StateView
              variant="table"
              :rows="10"
              :loading="loading && !inventory.length"
              :error="error"
              :empty="!loading && !inventory.length"
              empty-title="Регуляторы не найдены"
              :empty-text="filtersActive ? 'Измените фильтры: по выбранным условиям записей нет' : 'В базе нет регуляторов'"
              empty-icon="mdi-gauge"
              :action-label="filtersActive ? 'Сбросить фильтры' : undefined"
              :retrying="loading"
              @retry="loadInventory"
              @action="resetFilters"
            >
              <v-progress-linear
                v-if="loading"
                indeterminate
                color="primary"
              />
              <DataTable
                :columns="inventoryColumns"
                :items="inventoryRows"
                item-key="row_key"
                selectable
                :flash-key="flashKey"
                density="compact"
                class="regulator-table"
                @select="openItemDetails($event.regulator_type as NetworkRegulatorType, Number($event.id))"
              >
                <template #[`item.regulator_type`]="{ item }">
                  {{ typeLabel(item.regulator_type as NetworkRegulatorType) }}
                </template>
                <template #[`item.line_id`]="{ item }">
                  <span class="num">{{ item.line_id ?? '—' }}</span>
                  <div class="text-caption text-medium-emphasis text-truncate">
                    {{ nodeLabel(item.node_code_1, item.node_name_1, item.node_id_1) }} → {{ nodeLabel(item.node_code_2, item.node_name_2, item.node_id_2) }}
                  </div>
                </template>
                <template #[`item.set_value`]="{ item }">
                  {{ formatTarget(item.regulator_type as NetworkRegulatorType, item.set_value) }}
                </template>
                <template #[`item.control_node`]="{ item }">
                  <div class="text-truncate">
                    {{ requiresControlNode(item.regulator_type as NetworkRegulatorType) ? nodeLabel(item.control_node_code, item.control_node_name, item.control_node_id) : 'не требуется' }}
                  </div>
                </template>
                <template #[`item.state_name`]="{ item }">
                  <v-chip
                    size="x-small"
                    variant="tonal"
                    :color="stateColor(item.state_name)"
                  >
                    {{ item.state_name || '—' }}
                  </v-chip>
                </template>
                <template #[`item.work_attribute_name`]="{ item }">
                  {{ item.work_attribute_name || '—' }}
                </template>
                <template #[`item.fragment_name`]="{ item }">
                  {{ item.fragment_name || `№${item.fragment_id || '—'}` }}
                </template>
                <template #[`item.quality_status`]="{ item }">
                  <v-chip
                    size="x-small"
                    variant="tonal"
                    :color="qualityColor(item.quality_status as NetworkRegulatorQualityStatus)"
                  >
                    {{ qualityLabel(item.quality_status as NetworkRegulatorQualityStatus) }}
                  </v-chip>
                </template>
                <template #[`item.actions`]="{ item }">
                  <HintTip
                    v-if="hasCoordinates(item)"
                    text="Показать регулятор на карте"
                    hint="Журнал закроется, маркер останется"
                  >
                    <template #default="{ props: tip }">
                      <v-btn
                        v-bind="tip"
                        icon="mdi-crosshairs-gps"
                        size="x-small"
                        variant="text"
                        aria-label="Показать регулятор на карте"
                        @click.stop="locate(item)"
                      />
                    </template>
                  </HintTip>
                  <HintTip text="Открыть карточку">
                    <template #default="{ props: tip }">
                      <v-btn
                        v-bind="tip"
                        icon="mdi-chevron-right"
                        size="x-small"
                        variant="text"
                        aria-label="Открыть карточку регулятора"
                        @click.stop="openItemDetails(item.regulator_type as NetworkRegulatorType, Number(item.id))"
                      />
                    </template>
                  </HintTip>
                </template>
              </DataTable>
            </StateView>
          </v-card-text>

          <v-divider />
          <v-card-actions class="px-4 py-2">
            <span class="text-caption text-medium-emphasis">Страница {{ inventoryPage }}{{ inventoryPages ? ` из ${inventoryPages}` : '' }}</span>
            <v-spacer />
            <v-pagination
              v-if="inventoryPages > 1"
              v-model="inventoryPage"
              :length="inventoryPages"
              :total-visible="isMobile ? 3 : 7"
              density="compact"
            />
          </v-card-actions>
        </template>

        <template v-else>
          <div class="pa-3 pa-md-4 regulator-filters">
            <v-row dense>
              <v-col
                cols="12"
                md="5"
              >
                <SearchField
                  :model-value="catalogSearch"
                  label="Модель, серия, изготовитель или ID"
                  :debounce="350"
                  :loading="loading"
                  @update:model-value="catalogSearch = $event"
                  @search="onCatalogSearch"
                />
              </v-col>
              <v-col
                cols="12"
                sm="6"
                md="3"
              >
                <AppSelect
                  v-model="catalogType"
                  :items="typeOptions"
                  item-title="title"
                  item-value="value"
                  label="Тип каталога"
                />
              </v-col>
              <v-col
                cols="12"
                sm="6"
                md="2"
              >
                <AppSelect
                  v-model="catalogQuality"
                  :items="catalogQualityOptions"
                  item-title="title"
                  item-value="value"
                  label="Полнота паспорта"
                />
              </v-col>
              <v-col
                cols="12"
                md="2"
                class="d-flex justify-end align-center"
              >
                <v-btn
                  variant="tonal"
                  prepend-icon="mdi-refresh"
                  :loading="loading"
                  @click="loadCatalog"
                >
                  Обновить
                </v-btn>
              </v-col>
            </v-row>
          </div>

          <v-divider />

          <v-card-text class="pa-0 regulator-table-wrap">
            <StateView
              variant="table"
              :rows="8"
              :loading="loading && !catalog.length"
              :error="error"
              :empty="!loading && !catalog.length"
              empty-title="Модели не найдены"
              empty-icon="mdi-gauge"
              :retrying="loading"
              @retry="loadCatalog"
            >
              <v-progress-linear
                v-if="loading"
                indeterminate
                color="primary"
              />
              <DataTable
                :columns="catalogColumns"
                :items="catalogRows"
                item-key="row_key"
                selectable
                density="compact"
                class="regulator-table regulator-table--catalog"
                @select="openCatalogDetails($event.catalog_type as NetworkRegulatorType, Number($event.id))"
              >
                <template #[`item.catalog_type`]="{ item }">
                  {{ typeLabel(item.catalog_type as NetworkRegulatorType) }}
                </template>
                <template #[`item.display_name`]="{ item }">
                  <div class="text-truncate">
                    {{ item.display_name || item.model || '—' }}
                  </div>
                  <div class="text-caption text-medium-emphasis text-truncate">
                    {{ [item.series, item.model].filter(Boolean).join(' · ') || '—' }}
                  </div>
                </template>
                <template #[`item.nominal_diameter`]="{ item }">
                  {{ formatNumber(item.nominal_diameter, 3) }}
                </template>
                <template #[`item.capacity`]="{ item }">
                  {{ formatNumber(item.capacity) }}
                </template>
                <template #[`item.range`]="{ item }">
                  {{ pressureRange(item) }}
                </template>
                <template #[`item.medium`]="{ item }">
                  {{ item.medium || item.drive_type || '—' }}
                </template>
                <template #[`item.producer`]="{ item }">
                  {{ item.producer || '—' }}
                </template>
                <template #[`item.quality_status`]="{ item }">
                  <v-chip
                    size="x-small"
                    variant="tonal"
                    :color="item.quality_status === 'ready' ? 'success' : 'warning'"
                  >
                    {{ item.quality_status === 'ready' ? 'готово' : 'неполный' }}
                  </v-chip>
                </template>
              </DataTable>
            </StateView>
          </v-card-text>

          <v-divider />
          <v-card-actions class="px-4 py-2">
            <span class="text-caption text-medium-emphasis">Страница {{ catalogPage }}{{ catalogPages ? ` из ${catalogPages}` : '' }}</span>
            <v-spacer />
            <v-pagination
              v-if="catalogPages > 1"
              v-model="catalogPage"
              :length="catalogPages"
              :total-visible="isMobile ? 3 : 7"
              density="compact"
            />
          </v-card-actions>
        </template>
      </v-card>
    </v-dialog>

    <v-dialog
      v-model="detailVisible"
      :persistent="saving"
      :fullscreen="isMobile"
      max-width="980"
      scrollable
    >
      <v-card :rounded="isMobile ? 0 : 'lg'">
        <v-card-title class="d-flex align-center ga-3 px-4 py-3">
          <v-icon color="indigo-darken-2">mdi-gauge</v-icon>
          <div
            class="flex-grow-1"
            style="min-width: 0"
          >
            <div class="text-subtitle-1 font-weight-bold d-flex align-center ga-2">
              <span class="text-truncate">{{ detailTitle }}</span>
              <v-chip
                v-if="isEditing && isDirty"
                size="x-small"
                color="accent"
                variant="tonal"
              >
                Не сохранено
              </v-chip>
            </div>
            <div class="text-caption text-medium-emphasis text-truncate">
              {{ detailSubtitle }}
            </div>
          </div>
          <HintTip
            text="Закрыть карточку"
          >
            <template #default="{ props: tip }">
              <v-btn
                v-bind="tip"
                icon
                variant="text"
                aria-label="Закрыть карточку"
                @click="detailVisible = false"
              >
                <v-icon>mdi-close</v-icon>
              </v-btn>
            </template>
          </HintTip>
        </v-card-title>
        <v-divider />

        <v-card-text class="pa-4">
          <StateView
            variant="form"
            :rows="8"
            :loading="detailLoading"
            :error="detailError"
            :empty="!detailLoading && !detailError && !itemDetails && !catalogDetails"
            empty-title="Карточка не выбрана"
            :retry="false"
          >
            <template v-if="itemDetails">
              <v-alert
                v-if="itemDetails.quality_status !== 'ready'"
                class="mb-3"
                :type="itemDetails.quality_status === 'line_missing' ? 'error' : 'warning'"
                variant="tonal"
                density="compact"
              >
                {{ qualityDescription(itemDetails.quality_status as NetworkRegulatorQualityStatus) }}
              </v-alert>
              <JournalDetailFields
                :groups="itemGroups"
                :model="editFields"
                :editable="editable"
                :is-field-dirty="isFieldDirty"
                :open-panels="[0, 1, 2]"
                :focus-label="focusLabel"
                @update:field="setEditField"
              />
              <v-alert
                v-if="isEditing && saveError"
                type="error"
                variant="tonal"
                density="compact"
                class="mt-3"
                data-testid="equipment-save-error"
              >
                {{ saveError }}
              </v-alert>
            </template>
            <template v-else-if="catalogDetails">
              <v-alert
                v-if="catalogDetails.link_note"
                class="mb-3"
                type="info"
                variant="tonal"
                density="compact"
              >
                {{ catalogDetails.link_note }}
              </v-alert>
              <JournalDetailFields
                :groups="catalogGroups"
                :model="editFields"
                :editable="notEditable"
                :is-field-dirty="notEditable"
                :open-panels="[0]"
              />
            </template>
          </StateView>
        </v-card-text>

        <v-divider />
        <v-card-actions class="px-4 py-3">
          <v-spacer />
          <template v-if="isEditing">
            <v-btn
              variant="text"
              :disabled="saving"
              @click="cancelEdit"
            >
              Отмена
            </v-btn>
            <v-btn
              color="primary"
              variant="flat"
              :loading="saving"
              :disabled="!isDirty"
              @click="saveChanges"
            >
              Сохранить
            </v-btn>
          </template>
          <template v-else>
            <v-btn
              v-if="itemDetails && hasCoordinates(itemDetails)"
              variant="tonal"
              prepend-icon="mdi-crosshairs-gps"
              @click="locate(itemDetails)"
            >
              На карте
            </v-btn>
            <v-btn
              v-if="mutationsEnabled && itemDetails"
              variant="tonal"
              @click="startEdit"
            >
              Редактировать
            </v-btn>
            <v-btn
              variant="text"
              @click="detailVisible = false"
            >
              Закрыть
            </v-btn>
          </template>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </Teleport>
</template>

<script setup lang="ts">
import AppSelect from '~/components/AppSelect.vue'
import DataTable, { type DataTableColumn } from '~/components/DataTable.vue'
import HintTip from '~/components/HintTip.vue'
import JournalDetailFields, { type JournalDetailField, type JournalDetailGroup } from '~/components/JournalDetailFields.vue'
import KpiTile, { type KpiStatus } from '~/components/KpiTile.vue'
import SearchField from '~/components/SearchField.vue'
import SegmentedToggle from '~/components/SegmentedToggle.vue'
import StateView from '~/components/StateView.vue'
import { computed, reactive, ref, watch } from 'vue'
import { useEquipmentSaveError } from '~/composables/useEquipmentSaveError'
import { useJournalEdit, type JournalEditSource } from '~/composables/useJournalEdit'
import { useMobile } from '~/composables/useMobile'
import { useMutationsEnabled } from '~/composables/useMutationsEnabled'
import { useAuthStore } from '~/stores/authStore'
import { canDo } from '~/utils/permissions'
import { beginEquipmentEdit, saveEquipmentEdit } from '~/services/equipmentEditService'
import { useNotificationStore } from '~/stores/notificationStore'
import { formatApiError } from '~/utils/apiError'
import { hasLonLat } from '~/utils/journalFields'
import {
  fastApiService,
  type NetworkRegulatorDetails,
  type NetworkRegulatorLookups,
  type NetworkRegulatorQualityStatus,
  type NetworkRegulatorSummary,
  type NetworkRegulatorType,
  type StandardRegulatorDetails,
  type StandardRegulatorSummary
} from '~/services/fastApiService'

/**
 * Регуляторы — журнал оборудования с двумя разделами (docs/ui-modernization-progress.md, этап 5): установленные
 * регуляторы давления / расхода / перепада и каталог моделей, оба на `DataTable` с серверной пагинацией; плитки
 * качества данных — фильтры; карточка на `JournalDetailFields`, правка колонок `pressregulators` /
 * `consumptregulators` / `pressdropregulators` через `equipmentEditService` на общем `useJournalEdit`
 * (ключи формы — колонки таблицы, набор зависит от типа, `toForm`).
 */
export interface NetworkRegulatorJournalScope {
  regulatorType?: NetworkRegulatorType
  regulatorId?: number
  catalogType?: NetworkRegulatorType
  catalogId?: number
  lineId?: number
  /**
   * Подпись поля карточки, которое надо исправить (переход из протокола расчёта): «Заданная величина»,
   * «Относительная утечка», «Регулируемый узел», «Начальный узел». Единственный регулятор линии
   * открывается сразу, поле подсвечено; правится — сразу правка с курсором в нём
   */
  focusLabel?: string
}

type RegulatorTab = 'inventory' | 'catalog'

const emit = defineEmits<{
  'locate-regulator': [payload: { longitude: number; latitude: number; id: number; lineId: number | null; label: string }]
}>()
const { isMobile } = useMobile()
const canEditNetwork = useMutationsEnabled('network')
const authStore = useAuthStore()
// плюс право «оборудование: правка» из матрицы ролей — как у кнопки «Оборудование» в карточке объекта
const mutationsEnabled = computed(() => canEditNetwork.value && canDo(authStore.permissions, 'equipment', 'edit'))
const notifications = useNotificationStore()
const { saveError, clearSaveError, reportSaveError } = useEquipmentSaveError()
const visible = ref(false)
const activeTab = ref<RegulatorTab>('inventory')
const tabItems = computed(() => [
  { value: 'inventory', label: `Установленные (${lookups.counts.total || 0})`, icon: 'mdi-gauge' },
  { value: 'catalog', label: `Каталог (${lookups.catalog_counts.total || 0})`, icon: 'mdi-book-open-variant' }
])
const loading = ref(false)
const error = ref('')
const inventory = ref<NetworkRegulatorSummary[]>([])
const catalog = ref<StandardRegulatorSummary[]>([])
const total = ref(0)
const inventoryPage = ref(1)
const inventoryPages = ref(0)
const catalogPage = ref(1)
const catalogPages = ref(0)
const pageSize = 50
const search = ref('')
const regulatorType = ref<NetworkRegulatorType | undefined>()
const qualityStatus = ref<NetworkRegulatorQualityStatus | undefined>()
const stateId = ref<number | undefined>()
const fragmentId = ref<number | undefined>()
const workAttributeId = ref<number | undefined>()
const catalogSearch = ref('')
const catalogType = ref<NetworkRegulatorType | undefined>()
const catalogQuality = ref<'ready' | 'incomplete' | undefined>()
const scope = reactive<NetworkRegulatorJournalScope>({})
const lookups = reactive<NetworkRegulatorLookups>({
  states: [], work_attributes: [], pipeline_signs: [], fragments: [], counts: {}, catalog_counts: {}, calculation_count: 0, result_count: 0
})
const lookupsLoaded = ref(false)

const detailVisible = ref(false)
const detailLoading = ref(false)
const detailError = ref('')
const itemDetails = ref<NetworkRegulatorDetails | null>(null)
const catalogDetails = ref<StandardRegulatorDetails | null>(null)
const notEditable = () => false

const typeOptions = [
  { title: 'Регулятор давления', value: 'pressure' },
  { title: 'Регулятор расхода', value: 'flow' },
  { title: 'Регулятор перепада', value: 'differential' }
]
const catalogQualityOptions = [{ title: 'Полный паспорт', value: 'ready' }, { title: 'Неполный паспорт', value: 'incomplete' }]
const qualityMetrics: Array<{ value: NetworkRegulatorQualityStatus; label: string; status: KpiStatus }> = [
  { value: 'ready', label: 'Готовы', status: 'good' },
  { value: 'line_missing', label: 'Нет линии', status: 'critical' },
  { value: 'line_removed', label: 'Удалённая линия', status: 'serious' },
  { value: 'control_node_missing', label: 'Нет узла', status: 'warning' },
  { value: 'setpoint_missing', label: 'Нет задания', status: 'warning' },
  { value: 'capacity_missing', label: 'Нет Kv', status: 'warning' }
]
const qualityOptions = qualityMetrics.map(metric => ({ title: metric.label, value: metric.value }))

const scopeTitle = computed(() => (scope.lineId ? `регуляторы линии ${scope.lineId}` : 'вся тепловая сеть'))
const filtersActive = computed(() => Boolean(
  search.value.trim() || regulatorType.value || qualityStatus.value || stateId.value || fragmentId.value || workAttributeId.value
))

/** Ключ строки — тип и id вместе: регуляторы трёх типов нумеруются независимо */
const rowKey = (type: unknown, id: unknown) => `${type}-${id}`
const inventoryRows = computed(() => inventory.value.map(item => ({ ...item, row_key: rowKey(item.regulator_type, item.id) })))
const catalogRows = computed(() => catalog.value.map(item => ({ ...item, row_key: rowKey(item.catalog_type, item.id) })))

const inventoryColumns: DataTableColumn[] = [
  { key: 'id', title: 'ID', type: 'number', width: 80, sortable: false },
  { key: 'regulator_type', title: 'Тип', width: 160, sortable: false },
  { key: 'line_id', title: 'Линия / узлы', sortable: false },
  { key: 'set_value', title: 'Задание', type: 'number', width: 110, sortable: false },
  { key: 'control_node', title: 'Регулируемый узел', width: 170, sortable: false },
  { key: 'state_name', title: 'Состояние', width: 110, sortable: false },
  { key: 'work_attribute_name', title: 'Режим', width: 120, sortable: false },
  { key: 'fragment_name', title: 'Фрагмент', width: 120, sortable: false },
  { key: 'quality_status', title: 'Качество', width: 150, sortable: false },
  { key: 'actions', title: '', type: 'actions', width: 88, sortable: false },
]
const catalogColumns: DataTableColumn[] = [
  { key: 'id', title: 'ID', type: 'number', width: 80, sortable: false },
  { key: 'catalog_type', title: 'Тип', width: 160, sortable: false },
  { key: 'display_name', title: 'Наименование / модель', sortable: false },
  { key: 'nominal_diameter', title: 'DN, мм', type: 'number', width: 90, sortable: false },
  { key: 'capacity', title: 'Kv', type: 'number', width: 90, sortable: false },
  { key: 'range', title: 'Диапазон', width: 130, sortable: false },
  { key: 'medium', title: 'Среда / привод', width: 140, sortable: false },
  { key: 'producer', title: 'Изготовитель', width: 150, sortable: false },
  { key: 'quality_status', title: 'Качество', width: 110, sortable: false },
]

const TYPE_LABEL: Record<NetworkRegulatorType, string> = { pressure: 'Регулятор давления', flow: 'Регулятор расхода', differential: 'Регулятор перепада' }
const TABLE_FOR_TYPE: Record<NetworkRegulatorType, string> = { pressure: 'pressregulators', flow: 'consumptregulators', differential: 'pressdropregulators' }
const QUALITY_LABEL: Record<NetworkRegulatorQualityStatus, string> = {
  ready: 'готово', line_missing: 'нет линии', line_removed: 'линия удалена', control_node_missing: 'нет регулируемого узла', setpoint_missing: 'нет задания', capacity_missing: 'нет Kv'
}
const QUALITY_COLOR: Record<NetworkRegulatorQualityStatus, string> = {
  ready: 'success', line_missing: 'error', line_removed: 'grey', control_node_missing: 'warning', setpoint_missing: 'warning', capacity_missing: 'brown'
}
const QUALITY_DESCRIPTION: Record<NetworkRegulatorQualityStatus, string> = {
  ready: '',
  line_missing: 'Связанная линия отсутствует: сетевой контекст и позиционирование недоступны.',
  line_removed: 'Связанная линия помечена удалённой и исключена из активной расчётной схемы.',
  control_node_missing: 'Для регулятора давления или перепада не выбран узел, в котором поддерживается заданная величина.',
  setpoint_missing: 'Заданная величина равна нулю или отсутствует.',
  capacity_missing: 'Пропускная способность клапана Kv равна нулю или отсутствует.'
}
const typeLabel = (type: NetworkRegulatorType) => TYPE_LABEL[type] || String(type || '—')
const tableForType = (type: NetworkRegulatorType | undefined) => (type ? TABLE_FOR_TYPE[type] : '') || ''
const requiresControlNode = (type: NetworkRegulatorType) => type !== 'flow'
const qualityLabel = (status: NetworkRegulatorQualityStatus) => QUALITY_LABEL[status] || String(status || '—')
const qualityColor = (status: NetworkRegulatorQualityStatus) => QUALITY_COLOR[status] || 'grey'
const qualityDescription = (status: NetworkRegulatorQualityStatus) => QUALITY_DESCRIPTION[status] || ''
const stateColor = (state: unknown) => {
  const text = String(state || '').toLowerCase()
  return text === 'открыт' ? 'success' : text === 'закрыт' ? 'grey' : 'blue-grey'
}
const hasCoordinates = (item: Record<string, unknown>) => hasLonLat(item)
const nodeLabel = (code: unknown, name: unknown, id: unknown) =>
  [code, name].filter(Boolean).join(' ') || (id ? `№${id}` : '—')
const formatNumber = (value: unknown, digits = 2) =>
  value === null || value === undefined || value === '' || !Number.isFinite(Number(value))
    ? '—'
    : Number(value).toLocaleString('ru-RU', { maximumFractionDigits: digits })
const formatUnit = (value: unknown, unit: string) => (formatNumber(value, 3) === '—' ? '—' : `${formatNumber(value, 3)} ${unit}`)
const formatTarget = (type: NetworkRegulatorType, value: unknown) => formatUnit(value, type === 'flow' ? 'т/ч' : 'м')
const pressureRange = (item: Record<string, unknown>) =>
  item.pressure_min === null && item.pressure_max === null ? '—' : `${formatNumber(item.pressure_min)} – ${formatNumber(item.pressure_max)}`
const formatAttribute = (value: unknown) => (typeof value === 'number' ? formatNumber(value, 4) : String(value ?? '—'))

/** Правятся колонки таблицы регулятора своего типа (allow-list equipment_edit) */
interface EditColumn { label: string; from: string; type: string; group: 'assignment' | 'valve'; items?: unknown[] }
const editColumns = computed((): Record<string, EditColumn> => {
  const type = itemDetails.value?.regulator_type as NetworkRegulatorType | undefined
  const states = lookups.states
  if (type === 'pressure') {
    return {
      h: { label: 'Заданная величина', from: 'set_value', type: 'number', group: 'assignment' },
      deltah: { label: 'Допустимое отклонение', from: 'tolerance', type: 'number', group: 'assignment' },
      regvalverelcap: { label: 'Пропускная способность Kv', from: 'capacity', type: 'number', group: 'assignment' },
      regulatorstateid: { label: 'Состояние', from: 'state_id', type: 'select', group: 'assignment', items: states },
      workattrid: { label: 'Режим работы', from: 'work_attribute_id', type: 'select', group: 'assignment', items: lookups.work_attributes },
      pipelinesignid: { label: 'Трубопровод', from: 'pipeline_sign_id', type: 'select', group: 'assignment', items: lookups.pipeline_signs },
      valvehydroresopen: { label: 'Сопротивление, открыт', from: 'hydraulic_resistance_open', type: 'number', group: 'valve' },
      valvehydroresclose: { label: 'Сопротивление, закрыт', from: 'hydraulic_resistance_closed', type: 'number', group: 'valve' },
      relleakage: { label: 'Относительная утечка', from: 'relative_leakage', type: 'number', group: 'valve' },
      consdrip: { label: 'Расход утечки', from: 'leakage_flow', type: 'number', group: 'valve' }
    }
  }
  if (type === 'flow') {
    return {
      regconsmean: { label: 'Заданная величина', from: 'set_value', type: 'number', group: 'assignment' },
      deltah: { label: 'Допустимое отклонение', from: 'tolerance', type: 'number', group: 'assignment' },
      regvalvecap: { label: 'Пропускная способность Kv', from: 'capacity', type: 'number', group: 'assignment' },
      regulatorstateid: { label: 'Состояние', from: 'state_id', type: 'select', group: 'assignment', items: states },
      workattrid: { label: 'Режим работы', from: 'work_attribute_id', type: 'select', group: 'assignment', items: lookups.work_attributes },
      hydroresopen: { label: 'Сопротивление, открыт', from: 'hydraulic_resistance_open', type: 'number', group: 'valve' },
      hydroresclose: { label: 'Сопротивление, закрыт', from: 'hydraulic_resistance_closed', type: 'number', group: 'valve' },
      relatleakage: { label: 'Относительная утечка', from: 'relative_leakage', type: 'number', group: 'valve' },
      plumsconsumption: { label: 'Расход утечки', from: 'leakage_flow', type: 'number', group: 'valve' }
    }
  }
  if (type === 'differential') {
    return {
      pressdropmean: { label: 'Заданная величина', from: 'set_value', type: 'number', group: 'assignment' },
      deltah: { label: 'Допустимое отклонение', from: 'tolerance', type: 'number', group: 'assignment' },
      regvalverelcap: { label: 'Пропускная способность Kv', from: 'capacity', type: 'number', group: 'assignment' },
      regulatorstateid: { label: 'Состояние', from: 'state_id', type: 'select', group: 'assignment', items: states },
      workattrid: { label: 'Режим работы', from: 'work_attribute_id', type: 'select', group: 'assignment', items: lookups.work_attributes },
      regvalvehydrores: { label: 'Сопротивление, открыт', from: 'hydraulic_resistance_open', type: 'number', group: 'valve' },
      maxleakageclosevalve: { label: 'Относительная утечка', from: 'relative_leakage', type: 'number', group: 'valve' },
      consdrip: { label: 'Расход утечки', from: 'leakage_flow', type: 'number', group: 'valve' },
      consthroughregvalve: { label: 'Фактический расход (исходное поле)', from: 'actual_flow', type: 'number', group: 'valve' },
      thrustdropmean: { label: 'Фактический перепад (исходное поле)', from: 'actual_value', type: 'number', group: 'valve' }
    }
  }
  return {}
})
const editSource: JournalEditSource = {
  schema: computed(() => ({ fields: editColumns.value as Record<string, unknown> })),
  isWritable: (key?: string | null) => Boolean(key && key in editColumns.value),
  // схема известна заранее — загрузки нет, но useJournalEdit ждёт признак «есть»
  loadSchema: async () => true
}
const {
  isEditing, saving, editFields, flashId, isDirty, isFieldDirty, editable, setEditField,
  beginEdit, resetEdit, cancel, closeKeepingDraft, markSaved
} = useJournalEdit(() => tableForType(itemDetails.value?.regulator_type) || 'regulators', editSource, itemDetails, {
  toForm: record => Object.fromEntries(Object.entries(editColumns.value).map(([column, def]) => [column, record[def.from] ?? null]))
})
/** Подсветка сохранённой строки — по составному ключу строки */
const flashKey = computed(() => (flashId.value == null || !itemDetails.value ? null : rowKey(itemDetails.value.regulator_type, flashId.value)))

/** Поля карточки: только заполненные (в правке — все записываемые), значение — строка */
const buildFields = (entries: Array<[string, unknown, string?, string?, unknown[]?]>): JournalDetailField[] => entries
  .filter(([, value, key]) => (isEditing.value && key) || (value !== null && value !== undefined && value !== '' && value !== '—'))
  .map(([label, value, key, type, items]) => ({ label, value: String(value ?? '—'), rawValue: value, key, type: type || 'text', items }))

/** Ключ колонки по полю карточки — чтобы группа не зависела от типа регулятора */
const columnFor = (from: string) => Object.entries(editColumns.value).find(([, def]) => def.from === from)?.[0]
const itemGroups = computed((): JournalDetailGroup[] => {
  const item = itemDetails.value
  if (!item) return []
  const type = item.regulator_type as NetworkRegulatorType
  const output = item.latest_output as Record<string, unknown> | null | undefined
  const outputValue = (key: string) => output?.[key]
  return [
    { title: 'Сетевая привязка', fields: buildFields([
      ['Тип / ID', `${typeLabel(type)} / ${item.id}`], ['Линия', item.line_id],
      ['Начальный узел', nodeLabel(item.node_code_1, item.node_name_1, item.node_id_1)],
      ['Конечный узел', nodeLabel(item.node_code_2, item.node_name_2, item.node_id_2)],
      ['Регулируемый узел', requiresControlNode(type) ? nodeLabel(item.control_node_code, item.control_node_name, item.control_node_id) : 'не требуется'],
      ['Фрагмент', item.fragment_name || item.fragment_id]
    ]) },
    { title: 'Задание регулятора', fields: buildFields([
      ['Заданная величина', formatTarget(type, item.set_value), columnFor('set_value'), 'number'],
      ['Допустимое отклонение', formatTarget(type, item.tolerance), 'deltah', 'number'],
      ['Пропускная способность Kv', formatNumber(item.capacity), columnFor('capacity'), 'number'],
      ['Состояние', item.state_name, 'regulatorstateid', 'select', lookups.states],
      ['Режим работы', item.work_attribute_name, 'workattrid', 'select', lookups.work_attributes],
      ['Трубопровод', item.pipeline_sign_name, columnFor('pipeline_sign_id'), 'select', lookups.pipeline_signs]
    ]) },
    { title: 'Параметры клапана', fields: buildFields([
      ['Сопротивление, открыт', formatNumber(item.hydraulic_resistance_open, 6), columnFor('hydraulic_resistance_open'), 'number'],
      ['Сопротивление, закрыт', formatNumber(item.hydraulic_resistance_closed, 6), columnFor('hydraulic_resistance_closed'), 'number'],
      ['Относительная утечка', formatNumber(item.relative_leakage), columnFor('relative_leakage'), 'number'],
      ['Расход утечки', formatNumber(item.leakage_flow), columnFor('leakage_flow'), 'number'],
      ['Фактический расход (исходное поле)', formatNumber(item.actual_flow), columnFor('actual_flow'), 'number'],
      ['Фактический перепад (исходное поле)', formatNumber(item.actual_value), columnFor('actual_value'), 'number']
    ]) },
    { title: 'Расчётный режим RS_OUT', fields: output ? buildFields([
      ['Расход через клапан', formatNumber(outputValue('flow'))], ['Гидравлическое сопротивление', formatNumber(outputValue('hydraulic_resistance'), 6)],
      ['Пьезометрический напор, вход', formatNumber(outputValue('piezometric_head_in'))], ['Пьезометрический напор, выход', formatNumber(outputValue('piezometric_head_out'))],
      ['Задано / получено', `${formatNumber(outputValue('target_value'))} / ${formatNumber(outputValue('actual_value'))}`], ['Положение клапана', outputValue('valve_position')]
    ]) : buildFields([['Результат', 'гидравлический режим для этого регулятора пока не рассчитан']]) }
  ].filter(group => group.fields.length)
})
const catalogGroups = computed((): JournalDetailGroup[] => {
  const item = catalogDetails.value
  if (!item) return []
  const attributes = Object.entries(item.attributes || {}).filter(([, value]) => value !== null && value !== '')
  return [
    { title: 'Паспорт модели', fields: buildFields([
      ['Тип / ID', `${typeLabel(item.catalog_type as NetworkRegulatorType)} / ${item.id}`], ['Наименование', item.display_name],
      ['Серия / модель', [item.series, item.model].filter(Boolean).join(' / ')], ['DN', formatUnit(item.nominal_diameter, 'мм')],
      ['Kv', formatNumber(item.capacity)], ['Изготовитель', item.producer], ['Рабочая среда', item.medium],
      ['Макс. температура', formatUnit(item.max_temperature, '°C')], ['Диапазон задания', pressureRange(item)],
      ['Привод / установка', item.drive_type || item.installation_place]
    ]) },
    { title: 'Исходные поля каталога', fields: buildFields(attributes.map(([key, value]) => [key, formatAttribute(value)] as [string, unknown])) }
  ].filter(group => group.fields.length)
})
const detailTitle = computed(() => itemDetails.value?.display_name || catalogDetails.value?.display_name || 'Паспорт регулятора')
const detailSubtitle = computed(() => {
  if (itemDetails.value) return `${typeLabel(itemDetails.value.regulator_type as NetworkRegulatorType)} · линия ${itemDetails.value.line_id ?? '—'} · ${itemDetails.value.state_name || 'состояние не указано'}`
  if (catalogDetails.value) return `${typeLabel(catalogDetails.value.catalog_type as NetworkRegulatorType)} · модель каталога`
  return ''
})

const loadLookups = async () => {
  if (lookupsLoaded.value) return
  Object.assign(lookups, await fastApiService.getNetworkRegulatorLookups())
  lookupsLoaded.value = true
}

/** Номера последних запросов: ответ более раннего запроса не перекрывает поздний */
let inventoryRequest = 0
const loadInventory = async () => {
  const request = ++inventoryRequest
  loading.value = true
  error.value = ''
  try {
    const response = await fastApiService.getNetworkRegulators({
      page: inventoryPage.value, page_size: pageSize, search: search.value.trim() || undefined,
      regulator_type: regulatorType.value, quality_status: qualityStatus.value, state_id: stateId.value,
      fragment_id: fragmentId.value, work_attribute_id: workAttributeId.value, line_id: scope.lineId
    })
    if (request !== inventoryRequest) return
    inventory.value = response.items
    total.value = response.total
    inventoryPages.value = response.pages
  } catch (loadError: any) {
    if (request !== inventoryRequest) return
    error.value = formatApiError(loadError, 'Не удалось загрузить регуляторы')
  } finally {
    if (request === inventoryRequest) loading.value = false
  }
}
let catalogRequest = 0
const loadCatalog = async () => {
  const request = ++catalogRequest
  loading.value = true
  error.value = ''
  try {
    const response = await fastApiService.getRegulatorCatalog({
      page: catalogPage.value, page_size: pageSize, search: catalogSearch.value.trim() || undefined,
      catalog_type: catalogType.value, quality_status: catalogQuality.value
    })
    if (request !== catalogRequest) return
    catalog.value = response.items
    catalogPages.value = response.pages
  } catch (loadError: any) {
    if (request !== catalogRequest) return
    error.value = formatApiError(loadError, 'Не удалось загрузить каталог регуляторов')
  } finally {
    if (request === catalogRequest) loading.value = false
  }
}

watch([regulatorType, qualityStatus, stateId, fragmentId, workAttributeId], () => {
  if (!visible.value) return
  inventoryPage.value = 1
  void loadInventory()
})
watch([catalogType, catalogQuality], () => {
  if (!visible.value) return
  catalogPage.value = 1
  void loadCatalog()
})
watch(inventoryPage, () => { if (visible.value) void loadInventory() })
watch(catalogPage, () => { if (visible.value) void loadCatalog() })
watch(activeTab, (tab) => {
  if (!visible.value) return
  error.value = ''
  if (tab === 'catalog' && !catalog.value.length) void loadCatalog()
  if (tab === 'inventory' && !inventory.value.length) void loadInventory()
})

const onSearch = () => {
  if (!visible.value) return
  inventoryPage.value = 1
  void loadInventory()
}
const onCatalogSearch = () => {
  if (!visible.value) return
  catalogPage.value = 1
  void loadCatalog()
}
const toggleQuality = (status: NetworkRegulatorQualityStatus) => {
  qualityStatus.value = qualityStatus.value === status ? undefined : status
}
const resetFilters = () => {
  search.value = ''
  regulatorType.value = undefined
  qualityStatus.value = undefined
  stateId.value = undefined
  fragmentId.value = undefined
  workAttributeId.value = undefined
  inventoryPage.value = 1
  void loadInventory()
}
const clearScope = () => {
  scope.lineId = undefined
  inventoryPage.value = 1
  void loadInventory()
}

let detailRequest = 0
const openCard = () => {
  // открытие другой записи во время правки — черновик текущей остаётся, карточка на просмотр
  closeKeepingDraft()
  resetEdit()
  clearSaveError()
  detailVisible.value = true
  detailLoading.value = true
  detailError.value = ''
  itemDetails.value = null
  catalogDetails.value = null
  return ++detailRequest
}
const openItemDetails = async (type: NetworkRegulatorType, regulatorId: number) => {
  const request = openCard()
  try {
    const record = await fastApiService.getNetworkRegulator(type, regulatorId)
    if (request !== detailRequest) return
    itemDetails.value = record
  } catch (loadError: any) {
    if (request !== detailRequest) return
    detailError.value = formatApiError(loadError, 'Не удалось открыть карточку регулятора')
  } finally {
    if (request === detailRequest) detailLoading.value = false
  }
}
const openCatalogDetails = async (type: NetworkRegulatorType, catalogId: number) => {
  const request = openCard()
  try {
    const record = await fastApiService.getRegulatorCatalogItem(type, catalogId)
    if (request !== detailRequest) return
    catalogDetails.value = record
  } catch (loadError: any) {
    if (request !== detailRequest) return
    detailError.value = formatApiError(loadError, 'Не удалось открыть паспорт регулятора')
  } finally {
    if (request === detailRequest) detailLoading.value = false
  }
}

/** Поле, к которому привели из протокола расчёта (сбрасывается, когда карточку закрыли) */
const focusLabel = ref<string | null>(null)

let openDialogSeq = 0
const openDialog = async (nextScope: NetworkRegulatorJournalScope = {}) => {
  const seq = ++openDialogSeq
  focusLabel.value = nextScope.focusLabel ?? null
  Object.assign(scope, { regulatorType: undefined, regulatorId: undefined, catalogType: undefined, catalogId: undefined, lineId: undefined, focusLabel: undefined }, nextScope)
  regulatorType.value = nextScope.regulatorType
  catalogType.value = nextScope.catalogType
  inventoryPage.value = 1
  catalogPage.value = 1
  visible.value = true
  const tab: RegulatorTab = nextScope.catalogType && nextScope.catalogId ? 'catalog' : 'inventory'
  // watch(activeTab) грузит раздел при смене; при том же разделе грузим сами
  const tabChanged = activeTab.value !== tab
  activeTab.value = tab
  const loadSection = tabChanged ? Promise.resolve() : (tab === 'catalog' ? loadCatalog() : loadInventory())
  // раздел сам показывает свою ошибку; сбой справочника не должен прятать список
  const [lookupsResult] = await Promise.allSettled([loadLookups(), loadSection])
  if (lookupsResult.status === 'rejected') notifications.showWarning(formatApiError(lookupsResult.reason, 'Справочники не загрузились — плитки и фильтры могут быть неполными'))
  // журнал открыли снова, пока грузились списки — запись открывает последний вызов
  if (seq !== openDialogSeq) return
  if (nextScope.catalogType && nextScope.catalogId) await openCatalogDetails(nextScope.catalogType, nextScope.catalogId)
  else if (nextScope.regulatorType && nextScope.regulatorId) await openItemDetails(nextScope.regulatorType, nextScope.regulatorId)
  else if (nextScope.focusLabel && nextScope.lineId) {
    // Из протокола: на линии один регулятор — сразу его карточка (список при смене раздела грузит watch — ждём сами)
    if (tabChanged) await loadInventory()
    if (seq !== openDialogSeq) return
    const only = inventory.value.length === 1 ? inventory.value[0] : null
    if (!only) return
    await openItemDetails(only.regulator_type as NetworkRegulatorType, Number(only.id))
  } else return
  if (seq !== openDialogSeq || !focusLabel.value || !itemDetails.value || !mutationsEnabled.value) return
  // Поле, которое надо исправить, правится в этой карточке — сразу в правку
  const field = itemGroups.value.flatMap(g => g.fields).find(f => f.label === focusLabel.value)
  if (field?.key && field.key in editColumns.value) await startEdit()
}

const startEdit = async () => {
  clearSaveError()
  const table = tableForType(itemDetails.value?.regulator_type as NetworkRegulatorType | undefined)
  if (!table) {
    notifications.showError('Неизвестный тип регулятора — правка недоступна')
    return
  }
  if (!(await beginEdit())) return
  // версия строки для 409 и отправки только изменений
  beginEquipmentEdit(table, itemDetails.value?.id)
}
const cancelEdit = async () => {
  const { closed } = await cancel()
  if (closed) clearSaveError()
}
// Карточка закрыта крестиком или Esc во время правки — черновик остаётся до следующего открытия
watch(detailVisible, (open) => {
  if (!open) focusLabel.value = null
  if (!open) closeKeepingDraft()
})
const saveChanges = async () => {
  const current = itemDetails.value
  const type = current?.regulator_type as NetworkRegulatorType | undefined
  const table = tableForType(type)
  if (!current || !type || !table) return
  saving.value = true
  clearSaveError()
  try {
    await saveEquipmentEdit(table, current.id, editFields.value)
    markSaved(current.id)
    notifications.showSuccess('Изменения сохранены')
    await Promise.all([loadInventory(), openItemDetails(type, current.id)])
  } catch (cause) {
    // текст — в карточке; конфликт версий (409) ещё и уведомлением с перезагрузкой
    reportSaveError(cause, () => openItemDetails(type, current.id))
  } finally {
    saving.value = false
  }
}

const locate = (item: Record<string, unknown>) => {
  if (!hasCoordinates(item)) return
  emit('locate-regulator', {
    longitude: Number(item.longitude), latitude: Number(item.latitude), id: Number(item.id),
    lineId: item.line_id == null ? null : Number(item.line_id), label: String(item.display_name || `Регулятор №${item.id}`)
  })
  detailVisible.value = false
  visible.value = false
}

defineExpose({ openDialog })
</script>

<style scoped>
.regulator-journal { height: min(90vh, 920px); display: flex; flex-direction: column; }
.regulator-alerts { display: grid; gap: var(--space-2); }
.regulator-kpi { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.regulator-filters { flex-shrink: 0; background: rgba(var(--v-theme-on-surface), 0.02); }
.regulator-table-wrap { min-height: 280px; overflow: auto; flex: 1; }
.regulator-table { min-width: 1280px; }
.regulator-table--catalog { min-width: 1100px; }
@media (max-width: 600px) { .regulator-journal { height: 100dvh; } }
</style>
