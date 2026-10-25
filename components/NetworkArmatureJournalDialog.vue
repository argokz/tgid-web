<template>
  <Teleport to="body">
    <v-dialog
      v-model="visible"
      :fullscreen="isMobile"
      max-width="1440"
      scrollable
    >
      <v-card
        class="armature-journal"
        :rounded="isMobile ? 0 : 'lg'"
      >
        <v-card-title class="d-flex align-center ga-3 px-4 py-3">
          <v-avatar
            color="deep-purple-lighten-5"
            size="40"
          >
            <v-icon color="deep-purple-darken-2">mdi-valve</v-icon>
          </v-avatar>
          <div
            class="flex-grow-1"
            style="min-width: 0"
          >
            <div class="text-subtitle-1 font-weight-bold">Запорная и регулирующая арматура</div>
            <div class="text-caption text-medium-emphasis text-truncate">
              {{ scopeTitle }} · найдено {{ total }} · на активных линиях {{ lookups.counts.ready || 0 }} из {{ lookups.counts.total || 0 }}
            </div>
          </div>
          <SegmentedToggle
            v-model="activeTab"
            :items="tabItems"
            aria-label="Раздел журнала арматуры"
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

        <div class="px-3 px-md-4 pt-3 armature-alerts">
          <v-alert
            v-if="lookupsLoaded && lookups.damper_result_count === 0 && lookups.regulating_result_count === 0"
            type="info"
            variant="tonal"
            density="compact"
          >
            Расчётные таблицы <code>ZD_OUT</code> и <code>ZD2_OUT</code> пусты: паспортные параметры доступны, расход,
            потеря напора и сопротивление появятся после сохранения расчёта сети.
          </v-alert>
          <v-alert
            v-if="lookupsLoaded"
            type="warning"
            variant="tonal"
            density="compact"
          >
            Геометрия доступна для {{ lookups.counts.locatable || 0 }} из {{ lookups.counts.total || 0 }} записей: остальные
            задвижки принадлежат расчётным линиям без геометрии или потеряли связь с линией.
          </v-alert>
        </div>

        <template v-if="activeTab === 'inventory'">
          <div
            class="armature-kpi px-3 px-md-4 pt-3"
            role="group"
            aria-label="Качество привязки: фильтр по состоянию"
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

          <div class="pa-3 pa-md-4 armature-filters">
            <v-row dense>
              <v-col
                cols="12"
                md="4"
              >
                <SearchField
                  :model-value="search"
                  label="Назначение, узел, линия или ID"
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
                  v-model="equipmentType"
                  :items="equipmentTypeOptions"
                  item-title="title"
                  item-value="value"
                  label="Тип оборудования"
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
                  label="Качество привязки"
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
                  v-model="purpose"
                  :items="purposeOptions"
                  item-title="name"
                  item-value="name"
                  label="Назначение"
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
                color="primary"
                prepend-icon="mdi-refresh"
                :loading="loading"
                @click="loadInventory"
              >
                Обновить
              </v-btn>
            </div>
          </div>

          <v-divider />

          <v-card-text class="pa-0 armature-table-wrap">
            <StateView
              variant="table"
              :rows="10"
              :loading="loading && !inventory.length"
              :error="error"
              :empty="!loading && !inventory.length"
              empty-title="Оборудование не найдено"
              :empty-text="filtersActive ? 'Измените фильтры: по выбранным условиям записей нет' : 'В базе нет арматуры'"
              empty-icon="mdi-valve"
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
                :selected-key="flashKey"
                density="compact"
                class="armature-table"
                @select="openItemDetails($event.equipment_type as NetworkArmatureType, Number($event.id))"
              >
                <template #[`item.equipment_type`]="{ item }">
                  {{ equipmentTypeLabel(item.equipment_type as NetworkArmatureType) }}
                </template>
                <template #[`item.line_id`]="{ item }">
                  <span class="num">{{ item.line_id ?? '—' }}</span>
                  <div class="text-caption text-medium-emphasis text-truncate">
                    {{ nodeLabel(item.node_code_1, item.node_name_1, item.node_id_1) }} → {{ nodeLabel(item.node_code_2, item.node_name_2, item.node_id_2) }}
                  </div>
                </template>
                <template #[`item.purpose_name`]="{ item }">
                  <div class="text-truncate">
                    {{ item.purpose_name || 'не указано' }}
                  </div>
                </template>
                <template #[`item.nominal_diameter`]="{ item }">
                  {{ formatNumber(item.nominal_diameter, 3) }}
                </template>
                <template #[`item.opening_percent`]="{ item }">
                  {{ formatNumber(item.opening_percent, 3) }}
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
                <template #[`item.fragment_name`]="{ item }">
                  {{ item.fragment_name || `№${item.fragment_id || '—'}` }}
                </template>
                <template #[`item.quality_status`]="{ item }">
                  <v-chip
                    size="x-small"
                    variant="tonal"
                    :color="qualityColor(item.quality_status as NetworkArmatureQualityStatus)"
                  >
                    {{ qualityLabel(item.quality_status as NetworkArmatureQualityStatus) }}
                  </v-chip>
                </template>
                <template #[`item.actions`]="{ item }">
                  <HintTip
                    v-if="hasCoordinates(item)"
                    text="Показать арматуру на карте"
                    hint="Журнал закроется, маркер останется"
                  >
                    <template #default="{ props: tip }">
                      <v-btn
                        v-bind="tip"
                        icon="mdi-crosshairs-gps"
                        size="x-small"
                        variant="text"
                        color="primary"
                        aria-label="Показать арматуру на карте"
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
                        aria-label="Открыть карточку арматуры"
                        @click.stop="openItemDetails(item.equipment_type as NetworkArmatureType, Number(item.id))"
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
          <div class="pa-3 pa-md-4 armature-filters">
            <v-row dense>
              <v-col
                cols="12"
                md="6"
              >
                <SearchField
                  :model-value="catalogSearch"
                  label="Марка, материал, изготовитель или ID"
                  :debounce="350"
                  :loading="loading"
                  @update:model-value="catalogSearch = $event"
                  @search="onCatalogSearch"
                />
              </v-col>
              <v-col
                cols="12"
                md="6"
                class="d-flex justify-end align-center ga-2"
              >
                <v-btn
                  color="primary"
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

          <v-card-text class="pa-0 armature-table-wrap">
            <StateView
              variant="table"
              :rows="6"
              :loading="loading && !catalog.length"
              :error="error"
              :empty="!loading && !catalog.length"
              empty-title="Модели не найдены"
              empty-icon="mdi-valve"
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
                :items="(catalog as Record<string, unknown>[])"
                item-key="id"
                selectable
                density="compact"
                class="armature-table armature-table--catalog"
                @select="openCatalogDetails(Number($event.id))"
              >
                <template #[`item.name_zc`]="{ item }">
                  <div class="text-truncate">
                    {{ item.name_zc || item.name || '—' }}
                  </div>
                </template>
                <template #[`item.d`]="{ item }">
                  {{ formatNumber(item.d, 3) }}
                </template>
                <template #[`item.p`]="{ item }">
                  {{ formatNumber(item.p) }}
                </template>
                <template #[`item.t`]="{ item }">
                  {{ formatNumber(item.t, 3) }}
                </template>
                <template #[`item.tris`]="{ item }">
                  {{ item.tris || '—' }}
                </template>
                <template #[`item.tip_privod`]="{ item }">
                  {{ item.tip_privod || '—' }}
                </template>
                <template #[`item.material`]="{ item }">
                  {{ item.material || '—' }}
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
          <v-icon color="deep-purple-darken-2">mdi-valve</v-icon>
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
          <v-btn
            icon
            variant="text"
            aria-label="Закрыть карточку"
            @click="detailVisible = false"
          >
            <v-icon>mdi-close</v-icon>
          </v-btn>
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
                {{ qualityDescription(itemDetails.quality_status as NetworkArmatureQualityStatus) }}
              </v-alert>
              <v-alert
                v-if="itemDetails.catalog_status === 'unassigned'"
                class="mb-3"
                type="info"
                variant="tonal"
                density="compact"
              >
                Паспортная модель не выбрана: установленные задвижки текущей базы не связаны с моделями каталога.
              </v-alert>
              <JournalDetailFields
                :groups="itemGroups"
                :model="editFields"
                :editable="editable"
                :is-field-dirty="isFieldDirty"
                :open-panels="[0, 1]"
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
                class="mb-3"
                type="info"
                variant="tonal"
                density="compact"
              >
                Справочник содержит модели 30ч47бр, но установленные задвижки текущей базы с ними не связаны.
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
              color="primary"
              variant="tonal"
              prepend-icon="mdi-crosshairs-gps"
              @click="locate(itemDetails)"
            >
              На карте
            </v-btn>
            <v-btn
              v-if="mutationsEnabled && itemDetails"
              color="primary"
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
import { beginEquipmentEdit, saveEquipmentEdit } from '~/services/equipmentEditService'
import { useNotificationStore } from '~/stores/notificationStore'
import { formatApiError } from '~/utils/apiError'
import { hasLonLat } from '~/utils/journalFields'
import {
  fastApiService,
  type NetworkArmatureDetails,
  type NetworkArmatureLookups,
  type NetworkArmatureQualityStatus,
  type NetworkArmatureSummary,
  type NetworkArmatureType,
  type StandardDamperDetails,
  type StandardDamperSummary
} from '~/services/fastApiService'

/**
 * Арматура — журнал оборудования с двумя разделами (docs/ui-modernization-progress.md, этап 5): установленная
 * арматура (задвижки и регулирующая) и каталог моделей задвижек, оба на `DataTable` с серверной пагинацией;
 * плитки качества привязки из справочника — фильтры; карточка на `JournalDetailFields`, правка колонок
 * `dampers` / `regularmatures` через `equipmentEditService` на общем `useJournalEdit` (ключи формы — колонки
 * таблицы, набор зависит от типа, `toForm`).
 */
export interface NetworkArmatureJournalScope {
  equipmentType?: NetworkArmatureType
  armatureId?: number
  standardId?: number
  lineId?: number
}

type ArmatureTab = 'inventory' | 'catalog'

const emit = defineEmits<{
  'locate-armature': [payload: { longitude: number; latitude: number; id: number; lineId: number | null; label: string }]
}>()
const { isMobile } = useMobile()
const mutationsEnabled = useMutationsEnabled('network')
const notifications = useNotificationStore()
const { saveError, clearSaveError, reportSaveError } = useEquipmentSaveError()
const visible = ref(false)
const activeTab = ref<ArmatureTab>('inventory')
const tabItems = computed(() => [
  { value: 'inventory', label: `Оборудование (${lookups.counts.total || 0})`, icon: 'mdi-valve' },
  { value: 'catalog', label: `Каталог задвижек (${lookups.catalog_count || 0})`, icon: 'mdi-book-open-variant' }
])
const loading = ref(false)
const error = ref('')
const inventory = ref<NetworkArmatureSummary[]>([])
const catalog = ref<StandardDamperSummary[]>([])
const total = ref(0)
const inventoryPage = ref(1)
const inventoryPages = ref(0)
const catalogPage = ref(1)
const catalogPages = ref(0)
const pageSize = 50
const search = ref('')
const catalogSearch = ref('')
const equipmentType = ref<NetworkArmatureType | undefined>()
const qualityStatus = ref<NetworkArmatureQualityStatus | undefined>()
const stateId = ref<number | undefined>()
const fragmentId = ref<number | undefined>()
const purpose = ref<string | undefined>()
const scope = reactive<NetworkArmatureJournalScope>({})
const lookups = reactive<NetworkArmatureLookups>({
  states: [], purposes: [], fragments: [], counts: {}, catalog_count: 0, calculation_count: 0,
  damper_result_count: 0, regulating_result_count: 0, passport_asset_count: 0
})
const lookupsLoaded = ref(false)

const detailVisible = ref(false)
const detailLoading = ref(false)
const detailError = ref('')
const itemDetails = ref<NetworkArmatureDetails | null>(null)
const catalogDetails = ref<StandardDamperDetails | null>(null)
const notEditable = () => false

const equipmentTypeOptions = [
  { title: 'Задвижка', value: 'damper' },
  { title: 'Регулирующая арматура', value: 'regulating' }
]
const qualityMetrics: Array<{ value: NetworkArmatureQualityStatus; label: string; status: KpiStatus }> = [
  { value: 'ready', label: 'Готовы', status: 'good' },
  { value: 'line_missing', label: 'Нет линии', status: 'critical' },
  { value: 'line_removed', label: 'Удалённая линия', status: 'serious' },
  { value: 'purpose_unknown', label: 'Неизвестное назначение', status: 'warning' },
  { value: 'diameter_suspicious', label: 'Диаметр под вопросом', status: 'warning' }
]
const qualityOptions = qualityMetrics.map(metric => ({ title: metric.label, value: metric.value }))
const purposeOptions = computed(() => (lookups.purposes as Array<{ name: string; equipment_type?: string }>)
  .filter(item => !equipmentType.value || item.equipment_type === equipmentType.value))

const scopeTitle = computed(() => (scope.lineId ? `арматура линии ${scope.lineId}` : 'вся тепловая сеть'))
const filtersActive = computed(() => Boolean(
  search.value.trim() || equipmentType.value || qualityStatus.value || stateId.value || fragmentId.value || purpose.value
))

/** Ключ строки — тип и id вместе: задвижки и регулирующая арматура нумеруются независимо */
const rowKey = (type: unknown, id: unknown) => `${type}-${id}`
const inventoryRows = computed(() => inventory.value.map(item => ({ ...item, row_key: rowKey(item.equipment_type, item.id) })))

const inventoryColumns: DataTableColumn[] = [
  { key: 'id', title: 'ID', type: 'number', width: 80, sortable: false },
  { key: 'equipment_type', title: 'Тип', width: 150, sortable: false },
  { key: 'line_id', title: 'Линия / узлы', sortable: false },
  { key: 'purpose_name', title: 'Назначение', width: 170, sortable: false },
  { key: 'nominal_diameter', title: 'DN, мм', type: 'number', width: 90, sortable: false },
  { key: 'opening_percent', title: 'Открытие, %', type: 'number', width: 110, sortable: false },
  { key: 'state_name', title: 'Состояние', width: 110, sortable: false },
  { key: 'fragment_name', title: 'Фрагмент', width: 130, sortable: false },
  { key: 'quality_status', title: 'Качество', width: 160, sortable: false },
  { key: 'actions', title: '', type: 'actions', width: 88, sortable: false },
]
const catalogColumns: DataTableColumn[] = [
  { key: 'id', title: 'ID', type: 'number', width: 80, sortable: false },
  { key: 'name_zc', title: 'Марка', sortable: false },
  { key: 'd', title: 'DN, мм', type: 'number', width: 90, sortable: false },
  { key: 'p', title: 'Давление', type: 'number', width: 100, sortable: false },
  { key: 't', title: 'Температура, °C', type: 'number', width: 130, sortable: false },
  { key: 'tris', title: 'Присоединение', width: 140, sortable: false },
  { key: 'tip_privod', title: 'Привод', width: 120, sortable: false },
  { key: 'material', title: 'Материал', width: 130, sortable: false },
  { key: 'installed_count', title: 'Используется', type: 'number', width: 120, sortable: false },
]

const QUALITY_LABEL: Record<NetworkArmatureQualityStatus, string> = {
  ready: 'готово', line_missing: 'нет линии', line_removed: 'линия удалена', purpose_unknown: 'неизвестное назначение', diameter_suspicious: 'проверить диаметр'
}
const QUALITY_COLOR: Record<NetworkArmatureQualityStatus, string> = {
  ready: 'success', line_missing: 'error', line_removed: 'grey', purpose_unknown: 'warning', diameter_suspicious: 'warning'
}
const QUALITY_DESCRIPTION: Record<NetworkArmatureQualityStatus, string> = {
  ready: '',
  line_missing: 'Связанная линия отсутствует: сетевой контекст и позиционирование недоступны.',
  line_removed: 'Связанная линия помечена удалённой и исключена из активной расчётной схемы.',
  purpose_unknown: 'Назначение не задано (в исходных данных «?») и требует уточнения.',
  diameter_suspicious: 'Условный диаметр равен нулю или выходит за ожидаемый диапазон.'
}
const qualityLabel = (status: NetworkArmatureQualityStatus) => QUALITY_LABEL[status] || String(status || '—')
const qualityColor = (status: NetworkArmatureQualityStatus) => QUALITY_COLOR[status] || 'grey'
const qualityDescription = (status: NetworkArmatureQualityStatus) => QUALITY_DESCRIPTION[status] || ''
const equipmentTypeLabel = (type: NetworkArmatureType) => (type === 'damper' ? 'Задвижка' : 'Регулирующая арматура')
const tableForType = (type: NetworkArmatureType | undefined) => (type === 'damper' ? 'dampers' : 'regularmatures')
const stateColor = (state: unknown) => {
  const text = String(state || '').toLowerCase()
  return text === 'открыта' ? 'success' : text === 'закрыта' ? 'grey' : 'blue-grey'
}
const hasCoordinates = (item: Record<string, unknown>) => hasLonLat(item)
const nodeLabel = (code: unknown, name: unknown, id: unknown) =>
  [code, name].filter(Boolean).join(' ') || (id ? `№${id}` : '—')
const formatNumber = (value: unknown, digits = 2) =>
  value === null || value === undefined || value === '' || !Number.isFinite(Number(value))
    ? '—'
    : Number(value).toLocaleString('ru-RU', { maximumFractionDigits: digits })
const formatUnit = (value: unknown, unit: string) => (formatNumber(value, 3) === '—' ? '—' : `${formatNumber(value, 3)} ${unit}`)

/** Правятся колонки dampers / regularmatures (allow-list equipment_edit); набор зависит от типа */
interface EditColumn { label: string; from: string; type: string; items?: unknown[] }
const editColumns = computed((): Record<string, EditColumn> => {
  const isDamper = itemDetails.value?.equipment_type === 'damper'
  const columns: Record<string, EditColumn> = {
    [isDamper ? 'dispatcherswitch' : 'regarmtype']: { label: 'Назначение', from: 'purpose_name', type: 'text' },
    damperarmaturestateid: { label: 'Состояние', from: 'state_id', type: 'select', items: lookups.states },
    diametercondit: { label: 'Условный диаметр', from: 'nominal_diameter', type: 'number' },
    [isDamper ? 'partdempopen' : 'damperopendeg']: { label: 'Степень открытия', from: 'opening_percent', type: 'number' },
    [isDamper ? 'relatleakage' : 'relleakage']: { label: 'Относительная утечка', from: 'relative_leakage', type: 'number' },
    [isDamper ? 'turncount' : 'rotationcount']: { label: 'Число оборотов', from: 'turn_count', type: 'number' },
    gatecontrol: { label: 'Управление затвором', from: 'gate_control', type: 'number' }
  }
  if (!isDamper) {
    columns.regpdmean = { label: 'Заданный перепад', from: 'set_pressure_drop', type: 'number' }
    columns.q = { label: 'Заданный расход', from: 'set_flow', type: 'number' }
  }
  return columns
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
} = useJournalEdit(() => tableForType(itemDetails.value?.equipment_type), editSource, itemDetails, {
  toForm: record => Object.fromEntries(Object.entries(editColumns.value).map(([column, def]) => [column, record[def.from] ?? null]))
})
/** Подсветка сохранённой строки — по составному ключу строки */
const flashKey = computed(() => (flashId.value == null || !itemDetails.value ? null : rowKey(itemDetails.value.equipment_type, flashId.value)))

/** Поля карточки: только заполненные (в правке — все записываемые), значение — строка */
const buildFields = (entries: Array<[string, unknown, string?, string?, unknown[]?]>): JournalDetailField[] => entries
  .filter(([, value, key]) => (isEditing.value && key) || (value !== null && value !== undefined && value !== '' && value !== '—'))
  .map(([label, value, key, type, items]) => ({ label, value: String(value ?? '—'), rawValue: value, key, type: type || 'text', items }))

/** Ключ колонки по полю карточки — чтобы группа не зависела от типа оборудования */
const columnFor = (from: string) => Object.entries(editColumns.value).find(([, def]) => def.from === from)?.[0]
const itemGroups = computed((): JournalDetailGroup[] => {
  const item = itemDetails.value
  if (!item) return []
  const output = item.latest_output as Record<string, unknown> | null | undefined
  const outputValue = (key: string) => output?.[key]
  const isRegulating = item.equipment_type === 'regulating'
  const standard = item.standard as Record<string, unknown> | null | undefined
  return [
    { title: 'Сетевая привязка', fields: buildFields([
      ['Тип / ID', `${equipmentTypeLabel(item.equipment_type)} / ${item.id}`], ['Линия', item.line_id],
      ['Начальный узел', nodeLabel(item.node_code_1, item.node_name_1, item.node_id_1)],
      ['Конечный узел', nodeLabel(item.node_code_2, item.node_name_2, item.node_id_2)],
      ['Фрагмент', item.fragment_name], ['Статус линии', qualityLabel(item.quality_status)]
    ]) },
    { title: 'Исходные параметры', fields: buildFields([
      ['Назначение', item.purpose_name, columnFor('purpose_name'), 'text'],
      ['Состояние', item.state_name, 'damperarmaturestateid', 'select', lookups.states],
      ['Условный диаметр', formatUnit(item.nominal_diameter, 'мм'), 'diametercondit', 'number'],
      ['Степень открытия', formatUnit(item.opening_percent, '%'), columnFor('opening_percent'), 'number'],
      ['Относительная утечка', formatNumber(item.relative_leakage, 6), columnFor('relative_leakage'), 'number'],
      ['Сопротивление линии', formatNumber(item.line_hydraulic_resistance, 6)],
      ['Число оборотов', item.turn_count, columnFor('turn_count'), 'number'],
      ['Управление затвором', item.gate_control, 'gatecontrol', 'number'],
      ...(isRegulating ? [
        ['Заданный перепад', formatNumber(item.set_pressure_drop, 6), 'regpdmean', 'number'],
        ['Заданный расход', formatNumber(item.set_flow, 6), 'q', 'number']
      ] as Array<[string, unknown, string?, string?]> : [])
    ]) },
    { title: 'Паспорт модели', fields: standard ? buildFields([
      ['Марка', standard.name_zc], ['DN', formatUnit(standard.d, 'мм')], ['Давление', formatNumber(standard.p)],
      ['Температура', formatUnit(standard.t, '°C')], ['Присоединение', standard.tris], ['Привод', standard.tip_privod],
      ['Материал', standard.material], ['Изготовитель', standard.producer]
    ]) : [] },
    { title: 'Последний расчётный режим', fields: output ? buildFields([
      ['Состояние', outputValue('state_text')], ['Расход', formatNumber(outputValue('flow'), 6)],
      ['Потеря напора', formatNumber(outputValue('head_loss'), 6)], ['Гидравлическое сопротивление', formatNumber(outputValue('hydraulic_resistance'), 6)],
      ['Располагаемый напор в конце', formatNumber(outputValue('available_head_end'), 6)],
      ['Пьезометрический напор в конце', formatNumber(outputValue('piezometric_head_end'), 6)],
      ['Геодезическая отметка', formatNumber(outputValue('geodetic_mark_end'), 6)], ['Полный напор в конце', formatNumber(outputValue('total_head_end'), 6)]
    ]) : buildFields([['Результат', 'гидравлический режим для этой арматуры пока не рассчитан']]) }
  ].filter(group => group.fields.length)
})
const catalogGroups = computed((): JournalDetailGroup[] => {
  const item = catalogDetails.value
  if (!item) return []
  return [{ title: 'Паспорт задвижки', fields: buildFields([
    ['ID / марка', `${item.id} / ${item.name_zc || '—'}`], ['Наименование', item.name], ['Условный диаметр', formatUnit(item.d, 'мм')],
    ['Давление', formatNumber(item.p)], ['Макс. температура', formatUnit(item.t, '°C')], ['Присоединение', item.tris],
    ['Число болтов', item.kol_bolt], ['Тип привода', item.tip_privod], ['Исполнение привода', item.isp_privod],
    ['Обороты маховика', item.obor_maxovik], ['Материал', item.material], ['Масса', formatUnit(item.macca, 'кг')],
    ['Изготовитель', item.producer], ['Установлено', item.installed_count]
  ]) }]
})
const detailTitle = computed(() => itemDetails.value?.display_name || catalogDetails.value?.name_zc || 'Паспорт арматуры')
const detailSubtitle = computed(() => {
  if (itemDetails.value) return `линия ${itemDetails.value.line_id ?? '—'} · ${itemDetails.value.state_name || 'состояние не указано'}`
  if (catalogDetails.value) return `модель каталога · установлено ${catalogDetails.value.installed_count ?? 0}`
  return ''
})

const loadLookups = async () => {
  if (lookupsLoaded.value) return
  Object.assign(lookups, await fastApiService.getNetworkArmatureLookups())
  lookupsLoaded.value = true
}

/** Номера последних запросов: ответ более раннего запроса не перекрывает поздний */
let inventoryRequest = 0
const loadInventory = async () => {
  const request = ++inventoryRequest
  loading.value = true
  error.value = ''
  try {
    const response = await fastApiService.getNetworkArmatures({
      page: inventoryPage.value, page_size: pageSize, search: search.value.trim() || undefined,
      equipment_type: equipmentType.value, quality_status: qualityStatus.value, state_id: stateId.value,
      fragment_id: fragmentId.value, purpose: purpose.value, line_id: scope.lineId
    })
    if (request !== inventoryRequest) return
    inventory.value = response.items
    total.value = response.total
    inventoryPages.value = response.pages
  } catch (loadError: any) {
    if (request !== inventoryRequest) return
    error.value = formatApiError(loadError, 'Не удалось загрузить арматуру')
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
    const response = await fastApiService.getStandardDampers({ page: catalogPage.value, page_size: pageSize, search: catalogSearch.value.trim() || undefined })
    if (request !== catalogRequest) return
    catalog.value = response.items
    catalogPages.value = response.pages
  } catch (loadError: any) {
    if (request !== catalogRequest) return
    error.value = formatApiError(loadError, 'Не удалось загрузить каталог задвижек')
  } finally {
    if (request === catalogRequest) loading.value = false
  }
}

watch([equipmentType, qualityStatus, stateId, fragmentId, purpose], () => {
  if (!visible.value) return
  inventoryPage.value = 1
  void loadInventory()
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
const toggleQuality = (status: NetworkArmatureQualityStatus) => {
  qualityStatus.value = qualityStatus.value === status ? undefined : status
}
const resetFilters = () => {
  search.value = ''
  equipmentType.value = undefined
  qualityStatus.value = undefined
  stateId.value = undefined
  fragmentId.value = undefined
  purpose.value = undefined
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
const openItemDetails = async (type: NetworkArmatureType, armatureId: number) => {
  const request = openCard()
  try {
    const record = await fastApiService.getNetworkArmature(type, armatureId)
    if (request !== detailRequest) return
    itemDetails.value = record
  } catch (loadError: any) {
    if (request !== detailRequest) return
    detailError.value = formatApiError(loadError, 'Не удалось открыть карточку арматуры')
  } finally {
    if (request === detailRequest) detailLoading.value = false
  }
}
const openCatalogDetails = async (standardId: number) => {
  const request = openCard()
  try {
    const record = await fastApiService.getStandardDamper(standardId)
    if (request !== detailRequest) return
    catalogDetails.value = record
  } catch (loadError: any) {
    if (request !== detailRequest) return
    detailError.value = formatApiError(loadError, 'Не удалось открыть паспорт задвижки')
  } finally {
    if (request === detailRequest) detailLoading.value = false
  }
}

const openDialog = async (nextScope: NetworkArmatureJournalScope = {}) => {
  Object.assign(scope, { equipmentType: undefined, armatureId: undefined, standardId: undefined, lineId: undefined }, nextScope)
  equipmentType.value = nextScope.equipmentType
  inventoryPage.value = 1
  catalogPage.value = 1
  visible.value = true
  const tab: ArmatureTab = nextScope.standardId ? 'catalog' : 'inventory'
  // watch(activeTab) грузит раздел при смене; при том же разделе грузим сами
  const tabChanged = activeTab.value !== tab
  activeTab.value = tab
  const loadSection = tabChanged ? Promise.resolve() : (tab === 'catalog' ? loadCatalog() : loadInventory())
  // раздел сам показывает свою ошибку; сбой справочника не должен прятать список
  const [lookupsResult] = await Promise.allSettled([loadLookups(), loadSection])
  if (lookupsResult.status === 'rejected') notifications.showWarning(formatApiError(lookupsResult.reason, 'Справочники не загрузились — плитки и фильтры могут быть неполными'))
  if (nextScope.standardId) await openCatalogDetails(nextScope.standardId)
  else if (nextScope.armatureId && nextScope.equipmentType) await openItemDetails(nextScope.equipmentType, nextScope.armatureId)
}

const startEdit = async () => {
  clearSaveError()
  if (!(await beginEdit())) return
  // версия строки для 409 и отправки только изменений
  beginEquipmentEdit(tableForType(itemDetails.value?.equipment_type), itemDetails.value?.id)
}
const cancelEdit = async () => {
  const { closed } = await cancel()
  if (closed) clearSaveError()
}
// Карточка закрыта крестиком или Esc во время правки — черновик остаётся до следующего открытия
watch(detailVisible, (open) => {
  if (!open) closeKeepingDraft()
})
const saveChanges = async () => {
  const current = itemDetails.value
  if (!current) return
  saving.value = true
  clearSaveError()
  try {
    await saveEquipmentEdit(tableForType(current.equipment_type), current.id, editFields.value)
    markSaved(current.id)
    await Promise.all([loadInventory(), openItemDetails(current.equipment_type, current.id)])
  } catch (cause) {
    // текст — в карточке; конфликт версий (409) ещё и уведомлением с перезагрузкой
    reportSaveError(cause, () => openItemDetails(current.equipment_type, current.id))
  } finally {
    saving.value = false
  }
}

const locate = (item: Record<string, unknown>) => {
  emit('locate-armature', {
    longitude: Number(item.longitude), latitude: Number(item.latitude), id: Number(item.id),
    lineId: item.line_id == null ? null : Number(item.line_id), label: String(item.display_name || `Арматура №${item.id}`)
  })
  detailVisible.value = false
  visible.value = false
}

defineExpose({ openDialog })
</script>

<style scoped>
.armature-journal { height: min(90vh, 920px); display: flex; flex-direction: column; }
.armature-alerts { display: grid; gap: var(--space-2); }
.armature-kpi { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.armature-filters { flex-shrink: 0; background: rgba(var(--v-theme-on-surface), 0.02); }
.armature-table-wrap { min-height: 280px; overflow: auto; flex: 1; }
.armature-table { min-width: 1240px; }
.armature-table--catalog { min-width: 1000px; }
@media (max-width: 600px) { .armature-journal { height: 100dvh; } }
</style>
