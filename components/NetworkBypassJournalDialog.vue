<template>
  <Teleport to="body">
    <v-dialog
      v-model="visible"
      :fullscreen="isMobile"
      max-width="1440"
      scrollable
    >
      <v-card
        class="bypass-journal"
        :rounded="isMobile ? 0 : 'lg'"
      >
        <v-card-title class="d-flex align-center ga-3 px-4 py-3">
          <v-avatar
            color="cyan-lighten-5"
            size="40"
          >
            <v-icon color="cyan-darken-3">mdi-pipe-disconnected</v-icon>
          </v-avatar>
          <div
            class="flex-grow-1"
            style="min-width: 0"
          >
            <div class="text-subtitle-1 font-weight-bold">Байпасы наружных теплопроводов</div>
            <div class="text-caption text-medium-emphasis text-truncate">
              {{ scopeTitle }} · найдено {{ total }} · готовы {{ lookups.counts.ready || 0 }} из {{ lookups.counts.total || 0 }}
            </div>
          </div>
          <SegmentedToggle
            v-model="activeTab"
            :items="tabItems"
            aria-label="Раздел журнала байпасов"
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

        <div class="px-3 px-md-4 pt-3 bypass-alerts">
          <v-alert
            v-if="lookupsLoaded && lookups.counts.total === 0"
            type="warning"
            variant="tonal"
            density="compact"
          >
            Таблица <code>bypass</code> текущей БД пуста: журнал и карточка готовы для существующих данных, каталог
            стандартных труб доступен отдельно.
          </v-alert>
          <v-alert
            v-if="lookupsLoaded && lookups.result_count === 0"
            type="info"
            variant="tonal"
            density="compact"
          >
            Расчётная таблица <code>BP_OUT</code> пуста: диаметр диафрагмы, расход и потери напора появятся после
            сохранения расчёта сети.
          </v-alert>
        </div>

        <template v-if="activeTab === 'inventory'">
          <div
            class="bypass-kpi px-3 px-md-4 pt-3"
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

          <div class="pa-3 pa-md-4 bypass-filters">
            <v-row dense>
              <v-col
                cols="12"
                md="4"
              >
                <SearchField
                  :model-value="search"
                  label="Узел, линия, место или ID"
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
                  v-model="pipelineSignId"
                  :items="lookups.pipeline_signs"
                  item-title="name"
                  item-value="id"
                  label="Трубопровод"
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

          <v-card-text class="pa-0 bypass-table-wrap">
            <StateView
              variant="table"
              :rows="10"
              :loading="loading && !inventory.length"
              :error="error"
              :empty="!loading && !inventory.length"
              empty-title="Байпасы не найдены"
              :empty-text="filtersActive ? 'Измените фильтры: по выбранным условиям записей нет' : 'В базе нет байпасов'"
              empty-icon="mdi-pipe-disconnected"
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
                :items="(inventory as Record<string, unknown>[])"
                item-key="id"
                selectable
                :selected-key="flashId"
                density="compact"
                class="bypass-table"
                @select="openItemDetails(Number($event.id))"
              >
                <template #[`item.installation_place`]="{ item }">
                  <div class="text-truncate">
                    {{ item.installation_place || item.display_name || '—' }}
                  </div>
                </template>
                <template #[`item.line_id`]="{ item }">
                  <span class="num">{{ item.line_id ?? '—' }}</span>
                  <div class="text-caption text-medium-emphasis text-truncate">
                    {{ nodeLabel(item.node_code_1, item.node_name_1, item.node_id_1) }} → {{ nodeLabel(item.node_code_2, item.node_name_2, item.node_id_2) }}
                  </div>
                </template>
                <template #[`item.target_flow`]="{ item }">
                  {{ formatNumber(item.target_flow) }}
                  <div class="text-caption text-medium-emphasis">
                    ± {{ formatNumber(item.flow_tolerance) }}
                  </div>
                </template>
                <template #[`item.connection_node`]="{ item }">
                  <div class="text-truncate">
                    {{ nodeLabel(item.connection_node_code, item.connection_node_name, item.connection_node_id) }}
                  </div>
                </template>
                <template #[`item.pipeline_sign_name`]="{ item }">
                  {{ item.pipeline_sign_name || '—' }}
                </template>
                <template #[`item.geometry`]="{ item }">
                  {{ formatUnit(item.length, 'м') }} / {{ formatUnit(item.internal_diameter, 'мм') }}
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
                    :color="qualityColor(item.quality_status as NetworkBypassQualityStatus)"
                  >
                    {{ qualityLabel(item.quality_status as NetworkBypassQualityStatus) }}
                  </v-chip>
                </template>
                <template #[`item.actions`]="{ item }">
                  <HintTip
                    v-if="hasCoordinates(item)"
                    text="Показать байпас на карте"
                    hint="Журнал закроется, маркер останется"
                  >
                    <template #default="{ props: tip }">
                      <v-btn
                        v-bind="tip"
                        icon="mdi-crosshairs-gps"
                        size="x-small"
                        variant="text"
                        color="primary"
                        aria-label="Показать байпас на карте"
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
                        aria-label="Открыть карточку байпаса"
                        @click.stop="openItemDetails(Number(item.id))"
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
          <div class="pa-3 pa-md-4 bypass-filters">
            <v-row dense>
              <v-col
                cols="12"
                md="5"
              >
                <SearchField
                  :model-value="tubeSearch"
                  label="Стандарт, DN, материал или ID"
                  :debounce="350"
                  :loading="loading"
                  @update:model-value="tubeSearch = $event"
                  @search="onTubeSearch"
                />
              </v-col>
              <v-col
                cols="12"
                sm="6"
                md="3"
              >
                <AppSelect
                  v-model="tubeStandard"
                  :items="lookups.tube_standards"
                  item-title="name"
                  item-value="name"
                  label="Стандарт"
                />
              </v-col>
              <v-col
                cols="12"
                sm="6"
                md="2"
              >
                <AppSelect
                  v-model="tubeQuality"
                  :items="tubeQualityOptions"
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
                  color="primary"
                  prepend-icon="mdi-refresh"
                  :loading="loading"
                  @click="loadTubes"
                >
                  Обновить
                </v-btn>
              </v-col>
            </v-row>
          </div>

          <v-divider />

          <v-card-text class="pa-0 bypass-table-wrap">
            <StateView
              variant="table"
              :rows="8"
              :loading="loading && !tubes.length"
              :error="error"
              :empty="!loading && !tubes.length"
              empty-title="Стандартные трубы не найдены"
              empty-icon="mdi-pipe"
              :retrying="loading"
              @retry="loadTubes"
            >
              <v-progress-linear
                v-if="loading"
                indeterminate
                color="primary"
              />
              <DataTable
                :columns="tubeColumns"
                :items="(tubes as Record<string, unknown>[])"
                item-key="id"
                selectable
                density="compact"
                class="bypass-table bypass-table--tubes"
                @select="openTubeDetails(Number($event.id))"
              >
                <template #[`item.standard`]="{ item }">
                  <div class="text-truncate">
                    {{ item.standard || '—' }}
                  </div>
                </template>
                <template #[`item.nominal_diameter`]="{ item }">
                  {{ formatNumber(item.nominal_diameter) }}
                </template>
                <template #[`item.external_diameter`]="{ item }">
                  {{ formatNumber(item.external_diameter) }}
                </template>
                <template #[`item.internal_diameter`]="{ item }">
                  {{ formatNumber(item.internal_diameter) }}
                </template>
                <template #[`item.wall_thickness`]="{ item }">
                  {{ formatNumber(item.wall_thickness) }}
                </template>
                <template #[`item.section_area`]="{ item }">
                  {{ formatNumber(item.section_area, 8) }}
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
            <span class="text-caption text-medium-emphasis">Страница {{ tubePage }}{{ tubePages ? ` из ${tubePages}` : '' }}</span>
            <v-spacer />
            <v-pagination
              v-if="tubePages > 1"
              v-model="tubePage"
              :length="tubePages"
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
          <v-icon color="cyan-darken-3">{{ tubeDetails ? 'mdi-pipe' : 'mdi-pipe-disconnected' }}</v-icon>
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
            :empty="!detailLoading && !detailError && !itemDetails && !tubeDetails"
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
                {{ qualityDescription(itemDetails.quality_status as NetworkBypassQualityStatus) }}
              </v-alert>
              <JournalDetailFields
                :groups="itemGroups"
                :model="editFields"
                :editable="editable"
                :is-field-dirty="isFieldDirty"
                :open-panels="[0, 1, 2]"
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
            <template v-else-if="tubeDetails">
              <JournalDetailFields
                :groups="tubeGroups"
                :model="editFields"
                :editable="notEditable"
                :is-field-dirty="notEditable"
                :open-panels="[0, 1]"
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
import { useAuthStore } from '~/stores/authStore'
import { canDo } from '~/utils/permissions'
import { beginEquipmentEdit, saveEquipmentEdit } from '~/services/equipmentEditService'
import { useNotificationStore } from '~/stores/notificationStore'
import { formatApiError } from '~/utils/apiError'
import { hasLonLat } from '~/utils/journalFields'
import {
  fastApiService,
  type NetworkBypassDetails,
  type NetworkBypassLookups,
  type NetworkBypassQualityStatus,
  type NetworkBypassSummary,
  type StandardTubeDetails,
  type StandardTubeSummary
} from '~/services/fastApiService'

/**
 * Байпасы — журнал оборудования с двумя разделами (docs/ui-modernization-progress.md, этап 5): байпасы и каталог
 * стандартных труб на `DataTable` с серверной пагинацией; плитки качества данных — фильтры; карточка на
 * `JournalDetailFields`, правка колонок `bypass` через `equipmentEditService` на общем `useJournalEdit`
 * (ключи формы — колонки таблицы, `toForm`).
 */
export interface NetworkBypassJournalScope {
  bypassId?: number
  standardTubeId?: number
  lineId?: number
}

type BypassTab = 'inventory' | 'tubes'

const emit = defineEmits<{
  'locate-bypass': [payload: { longitude: number; latitude: number; id: number; lineId: number | null; label: string }]
}>()
const { isMobile } = useMobile()
const canEditNetwork = useMutationsEnabled('network')
const authStore = useAuthStore()
// плюс право «оборудование: правка» из матрицы ролей — как у кнопки «Оборудование» в карточке объекта
const mutationsEnabled = computed(() => canEditNetwork.value && canDo(authStore.permissions, 'equipment', 'edit'))
const notifications = useNotificationStore()
const { saveError, clearSaveError, reportSaveError } = useEquipmentSaveError()
const visible = ref(false)
const activeTab = ref<BypassTab>('inventory')
const tabItems = computed(() => [
  { value: 'inventory', label: `Байпасы (${lookups.counts.total || 0})`, icon: 'mdi-pipe-disconnected' },
  { value: 'tubes', label: `Стандартные трубы (${lookups.tube_counts.total || 0})`, icon: 'mdi-pipe' }
])
const loading = ref(false)
const error = ref('')
const inventory = ref<NetworkBypassSummary[]>([])
const tubes = ref<StandardTubeSummary[]>([])
const total = ref(0)
const inventoryPage = ref(1)
const inventoryPages = ref(0)
const tubePage = ref(1)
const tubePages = ref(0)
const pageSize = 50
const search = ref('')
const qualityStatus = ref<NetworkBypassQualityStatus | undefined>()
const stateId = ref<number | undefined>()
const pipelineSignId = ref<number | undefined>()
const fragmentId = ref<number | undefined>()
const tubeSearch = ref('')
const tubeStandard = ref<string | undefined>()
const tubeQuality = ref<'ready' | 'incomplete' | undefined>()
const scope = reactive<NetworkBypassJournalScope>({})
const lookups = reactive<NetworkBypassLookups>({
  states: [], pipeline_signs: [], standards: [], tube_standards: [], fragments: [], counts: {}, tube_counts: {}, calculation_count: 0, result_count: 0
})
const lookupsLoaded = ref(false)

const detailVisible = ref(false)
const detailLoading = ref(false)
const detailError = ref('')
const itemDetails = ref<NetworkBypassDetails | null>(null)
const tubeDetails = ref<StandardTubeDetails | null>(null)
const notEditable = () => false

const qualityMetrics: Array<{ value: NetworkBypassQualityStatus; label: string; status: KpiStatus }> = [
  { value: 'ready', label: 'Готовы', status: 'good' },
  { value: 'line_missing', label: 'Нет линии', status: 'critical' },
  { value: 'line_removed', label: 'Удалённая линия', status: 'serious' },
  { value: 'connection_node_missing', label: 'Нет узла', status: 'warning' },
  { value: 'setpoint_missing', label: 'Нет расхода', status: 'warning' },
  { value: 'geometry_parameters_invalid', label: 'Параметры трубы', status: 'warning' }
]
const qualityOptions = qualityMetrics.map(metric => ({ title: metric.label, value: metric.value }))
const tubeQualityOptions = [{ title: 'Полный паспорт', value: 'ready' }, { title: 'Неполный паспорт', value: 'incomplete' }]

const scopeTitle = computed(() => (scope.lineId ? `байпасы линии ${scope.lineId}` : 'вся тепловая сеть'))
const filtersActive = computed(() => Boolean(search.value.trim() || qualityStatus.value || stateId.value || pipelineSignId.value || fragmentId.value))

const inventoryColumns: DataTableColumn[] = [
  { key: 'id', title: 'ID', type: 'number', width: 80, sortable: false },
  { key: 'installation_place', title: 'Место установки', width: 170, sortable: false },
  { key: 'line_id', title: 'Линия / узлы', sortable: false },
  { key: 'target_flow', title: 'Задание, т/ч', type: 'number', width: 120, sortable: false },
  { key: 'connection_node', title: 'Узел присоединения', width: 170, sortable: false },
  { key: 'pipeline_sign_name', title: 'Трубопровод', width: 120, sortable: false },
  { key: 'geometry', title: 'L / Dвн', width: 150, sortable: false },
  { key: 'state_name', title: 'Состояние', width: 110, sortable: false },
  { key: 'fragment_name', title: 'Фрагмент', width: 120, sortable: false },
  { key: 'quality_status', title: 'Качество', width: 140, sortable: false },
  { key: 'actions', title: '', type: 'actions', width: 88, sortable: false },
]
const tubeColumns: DataTableColumn[] = [
  { key: 'id', title: 'ID', type: 'number', width: 80, sortable: false },
  { key: 'standard', title: 'Стандарт', sortable: false },
  { key: 'nominal_diameter', title: 'DN, мм', type: 'number', width: 90, sortable: false },
  { key: 'external_diameter', title: 'Dнар, мм', type: 'number', width: 100, sortable: false },
  { key: 'internal_diameter', title: 'Dвн, мм', type: 'number', width: 100, sortable: false },
  { key: 'wall_thickness', title: 'Стенка, мм', type: 'number', width: 110, sortable: false },
  { key: 'section_area', title: 'Площадь сечения', type: 'number', width: 150, sortable: false },
  { key: 'installed_count', title: 'Установлено', type: 'number', width: 120, sortable: false },
  { key: 'quality_status', title: 'Качество', width: 110, sortable: false },
]

const QUALITY_LABEL: Record<NetworkBypassQualityStatus, string> = {
  ready: 'готово', line_missing: 'нет линии', line_removed: 'линия удалена', connection_node_missing: 'нет узла', setpoint_missing: 'нет задания', geometry_parameters_invalid: 'параметры трубы'
}
const QUALITY_COLOR: Record<NetworkBypassQualityStatus, string> = {
  ready: 'success', line_missing: 'error', line_removed: 'grey', connection_node_missing: 'warning', setpoint_missing: 'warning', geometry_parameters_invalid: 'brown'
}
const QUALITY_DESCRIPTION: Record<NetworkBypassQualityStatus, string> = {
  ready: '',
  line_missing: 'Связанная линия отсутствует: сетевой контекст и позиционирование недоступны.',
  line_removed: 'Связанная линия помечена удалённой и исключена из активной расчётной схемы.',
  connection_node_missing: 'Не выбран или потерян узел присоединения байпасного участка.',
  setpoint_missing: 'Регулируемый расход равен нулю или отсутствует.',
  geometry_parameters_invalid: 'Длина, внутренний диаметр, шероховатость или сумма местных сопротивлений имеют недопустимое значение.'
}
const qualityLabel = (status: NetworkBypassQualityStatus) => QUALITY_LABEL[status] || String(status || '—')
const qualityColor = (status: NetworkBypassQualityStatus) => QUALITY_COLOR[status] || 'grey'
const qualityDescription = (status: NetworkBypassQualityStatus) => QUALITY_DESCRIPTION[status] || ''
const stateColor = (state: unknown) => {
  const text = String(state || '').toLowerCase()
  return text === 'открыт' ? 'success' : text === 'закрыт' ? 'grey' : 'blue-grey'
}
const hasCoordinates = (item: Record<string, unknown>) => hasLonLat(item)
const nodeLabel = (code: unknown, name: unknown, id: unknown) =>
  [code, name].filter(Boolean).join(' ') || (id ? `№${id}` : '—')
const formatNumber = (value: unknown, digits = 3) =>
  value === null || value === undefined || value === '' || !Number.isFinite(Number(value))
    ? '—'
    : Number(value).toLocaleString('ru-RU', { maximumFractionDigits: digits })
const formatUnit = (value: unknown, unit: string) => (formatNumber(value) === '—' ? '—' : `${formatNumber(value)} ${unit}`)
const formatAttribute = (value: unknown) => (typeof value === 'number' ? formatNumber(value, 8) : String(value ?? '—'))

/** Правятся колонки таблицы bypass (allow-list equipment_edit); ключи формы — имена колонок */
const EDIT_COLUMNS: Record<string, { label: string; from: string; type: string }> = {
  q: { label: 'Регулируемый расход', from: 'target_flow', type: 'number' },
  deltaq: { label: 'Допуск расхода', from: 'flow_tolerance', type: 'number' },
  h: { label: 'Заданный напор', from: 'target_head', type: 'number' },
  deltah: { label: 'Допуск напора', from: 'head_tolerance', type: 'number' },
  regulatorstateid: { label: 'Состояние', from: 'state_id', type: 'select' },
  pipelinesignid: { label: 'Трубопровод', from: 'pipeline_sign_id', type: 'select' },
  locinstall: { label: 'Место установки', from: 'installation_place', type: 'text' },
  length: { label: 'Длина', from: 'length', type: 'number' },
  diameterinternal: { label: 'Внутренний диаметр', from: 'internal_diameter', type: 'number' },
  tuberoughness: { label: 'Экв. шероховатость', from: 'tube_roughness', type: 'number' },
  rescoeffssum: { label: 'Σ местных сопротивлений', from: 'local_resistance_coefficients', type: 'number' },
  standardid: { label: 'Стандарт', from: 'standard_id', type: 'select' },
  standardtubelink: { label: 'Типовая труба (ID)', from: 'standard_tube_id', type: 'number' }
}
const editSource: JournalEditSource = {
  schema: computed(() => ({ fields: EDIT_COLUMNS as Record<string, unknown> })),
  isWritable: (key?: string | null) => Boolean(key && key in EDIT_COLUMNS),
  // схема известна заранее — загрузки нет, но useJournalEdit ждёт признак «есть»
  loadSchema: async () => true
}
const {
  isEditing, saving, editFields, flashId, isDirty, isFieldDirty, editable, setEditField,
  beginEdit, resetEdit, cancel, closeKeepingDraft, markSaved
} = useJournalEdit('bypass', editSource, itemDetails, {
  toForm: record => Object.fromEntries(Object.entries(EDIT_COLUMNS).map(([column, def]) => [column, record[def.from] ?? null]))
})

/** Поля карточки: только заполненные (в правке — все записываемые), значение — строка */
const buildFields = (entries: Array<[string, unknown, string?, string?, unknown[]?]>): JournalDetailField[] => entries
  .filter(([, value, key]) => (isEditing.value && key) || (value !== null && value !== undefined && value !== '' && value !== '—'))
  .map(([label, value, key, type, items]) => ({ label, value: String(value ?? '—'), rawValue: value, key, type: type || 'text', items }))

const itemGroups = computed((): JournalDetailGroup[] => {
  const item = itemDetails.value
  if (!item) return []
  const output = item.latest_output as Record<string, unknown> | null | undefined
  const outputValue = (key: string) => output?.[key]
  const selectedTube = item.selected_tube as Record<string, unknown> | null | undefined
  return [
    { title: 'Сетевая привязка', fields: buildFields([
      ['Байпас / ID', item.id], ['Линия', item.line_id],
      ['Начальный узел', nodeLabel(item.node_code_1, item.node_name_1, item.node_id_1)],
      ['Конечный узел', nodeLabel(item.node_code_2, item.node_name_2, item.node_id_2)],
      ['Узел присоединения', nodeLabel(item.connection_node_code, item.connection_node_name, item.connection_node_id)],
      ['Фрагмент', item.fragment_name || item.fragment_id]
    ]) },
    { title: 'Задание байпаса', fields: buildFields([
      ['Регулируемый расход', formatUnit(item.target_flow, 'т/ч'), 'q', 'number'],
      ['Допуск расхода', formatUnit(item.flow_tolerance, 'т/ч'), 'deltaq', 'number'],
      ['Заданный напор', formatUnit(item.target_head, 'м'), 'h', 'number'],
      ['Допуск напора', formatUnit(item.head_tolerance, 'м'), 'deltah', 'number'],
      ['Состояние', item.state_name, 'regulatorstateid', 'select', lookups.states],
      ['Трубопровод', item.pipeline_sign_name, 'pipelinesignid', 'select', lookups.pipeline_signs],
      ['Место установки', item.installation_place, 'locinstall', 'text']
    ]) },
    { title: 'Параметры трубопровода', fields: buildFields([
      ['Длина', formatUnit(item.length, 'м'), 'length', 'number'],
      ['Внутренний диаметр', formatUnit(item.internal_diameter, 'мм'), 'diameterinternal', 'number'],
      ['Экв. шероховатость', formatUnit(item.tube_roughness, 'мм'), 'tuberoughness', 'number'],
      ['Σ местных сопротивлений', formatNumber(item.local_resistance_coefficients, 5), 'rescoeffssum', 'number'],
      ['Стандарт', item.standard_name, 'standardid', 'select', lookups.standards],
      ['Типовая труба', selectedTube?.display_name || item.standard_tube_id, 'standardtubelink', 'number'],
      ['Сопротивление линии', formatNumber(item.line_hydraulic_resistance, 8)]
    ]) },
    { title: 'Расчётный режим BP_OUT', fields: output ? buildFields([
      ['Диаметр диафрагмы', formatUnit(outputValue('diaphragm_diameter'), 'мм')], ['Напор на диафрагме', formatUnit(outputValue('diaphragm_head_loss'), 'м')],
      ['Расход', formatUnit(outputValue('flow'), 'т/ч')], ['Потери на байпасе', formatUnit(outputValue('bypass_head_loss'), 'м')],
      ['Суммарный гасимый напор', formatUnit(outputValue('total_head_loss'), 'м')], ['Гидравлическое сопротивление', formatNumber(outputValue('hydraulic_resistance'), 8)]
    ]) : buildFields([['Результат', 'гидравлический режим для этого байпаса пока не рассчитан']]) }
  ].filter(group => group.fields.length)
})
const tubeGroups = computed((): JournalDetailGroup[] => {
  const tube = tubeDetails.value
  if (!tube) return []
  const attributes = Object.entries(tube.attributes || {}).filter(([, value]) => value !== null && value !== '')
  return [
    { title: 'Паспорт стандартной трубы', fields: buildFields([
      ['ID', tube.id], ['Стандарт', tube.standard], ['DN', formatUnit(tube.nominal_diameter, 'мм')],
      ['Наружный диаметр', formatUnit(tube.external_diameter, 'мм')], ['Внутренний диаметр', formatUnit(tube.internal_diameter, 'мм')],
      ['Толщина стенки', formatUnit(tube.wall_thickness, 'мм')], ['Материал', tube.material], ['Изготовитель', tube.manufacturer],
      ['Связано с байпасами', tube.installed_count]
    ]) },
    { title: 'Расчётные свойства', fields: buildFields([
      ['Площадь сечения', formatNumber(tube.section_area, 8)], ['Поверхность на метр', formatNumber(tube.surface_per_meter, 8)],
      ['Масса на метр', formatNumber(tube.mass_per_meter, 5)], ['Масса с изоляцией', formatNumber(tube.insulated_mass_per_meter, 5)]
    ]) },
    { title: 'Исходные поля standardtubes', fields: buildFields(attributes.map(([key, value]) => [key, formatAttribute(value)] as [string, unknown])) }
  ].filter(group => group.fields.length)
})
const detailTitle = computed(() => itemDetails.value?.display_name || tubeDetails.value?.display_name || 'Паспорт байпаса')
const detailSubtitle = computed(() => {
  if (itemDetails.value) return `линия ${itemDetails.value.line_id ?? '—'} · ${itemDetails.value.state_name || 'состояние не указано'}`
  if (tubeDetails.value) return `стандартная труба · связано с байпасами ${tubeDetails.value.installed_count ?? 0}`
  return ''
})

const loadLookups = async () => {
  if (lookupsLoaded.value) return
  Object.assign(lookups, await fastApiService.getNetworkBypassLookups())
  lookupsLoaded.value = true
}

/** Номера последних запросов: ответ более раннего запроса не перекрывает поздний */
let inventoryRequest = 0
const loadInventory = async () => {
  const request = ++inventoryRequest
  loading.value = true
  error.value = ''
  try {
    const response = await fastApiService.getNetworkBypasses({
      page: inventoryPage.value, page_size: pageSize, search: search.value.trim() || undefined,
      quality_status: qualityStatus.value, state_id: stateId.value, pipeline_sign_id: pipelineSignId.value,
      fragment_id: fragmentId.value, line_id: scope.lineId
    })
    if (request !== inventoryRequest) return
    inventory.value = response.items
    total.value = response.total
    inventoryPages.value = response.pages
  } catch (loadError: any) {
    if (request !== inventoryRequest) return
    error.value = formatApiError(loadError, 'Не удалось загрузить байпасы')
  } finally {
    if (request === inventoryRequest) loading.value = false
  }
}
let tubeRequest = 0
const loadTubes = async () => {
  const request = ++tubeRequest
  loading.value = true
  error.value = ''
  try {
    const response = await fastApiService.getStandardTubes({
      page: tubePage.value, page_size: pageSize, search: tubeSearch.value.trim() || undefined,
      standard: tubeStandard.value, quality_status: tubeQuality.value
    })
    if (request !== tubeRequest) return
    tubes.value = response.items
    tubePages.value = response.pages
  } catch (loadError: any) {
    if (request !== tubeRequest) return
    error.value = formatApiError(loadError, 'Не удалось загрузить стандартные трубы')
  } finally {
    if (request === tubeRequest) loading.value = false
  }
}

watch([qualityStatus, stateId, pipelineSignId, fragmentId], () => {
  if (!visible.value) return
  inventoryPage.value = 1
  void loadInventory()
})
watch([tubeStandard, tubeQuality], () => {
  if (!visible.value) return
  tubePage.value = 1
  void loadTubes()
})
watch(inventoryPage, () => { if (visible.value) void loadInventory() })
watch(tubePage, () => { if (visible.value) void loadTubes() })
watch(activeTab, (tab) => {
  if (!visible.value) return
  error.value = ''
  if (tab === 'tubes' && !tubes.value.length) void loadTubes()
  if (tab === 'inventory' && !inventory.value.length) void loadInventory()
})

const onSearch = () => {
  if (!visible.value) return
  inventoryPage.value = 1
  void loadInventory()
}
const onTubeSearch = () => {
  if (!visible.value) return
  tubePage.value = 1
  void loadTubes()
}
const toggleQuality = (status: NetworkBypassQualityStatus) => {
  qualityStatus.value = qualityStatus.value === status ? undefined : status
}
const resetFilters = () => {
  search.value = ''
  qualityStatus.value = undefined
  stateId.value = undefined
  pipelineSignId.value = undefined
  fragmentId.value = undefined
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
  tubeDetails.value = null
  return ++detailRequest
}
const openItemDetails = async (bypassId: number) => {
  const request = openCard()
  try {
    const record = await fastApiService.getNetworkBypass(bypassId)
    if (request !== detailRequest) return
    itemDetails.value = record
  } catch (loadError: any) {
    if (request !== detailRequest) return
    detailError.value = formatApiError(loadError, 'Не удалось открыть карточку байпаса')
  } finally {
    if (request === detailRequest) detailLoading.value = false
  }
}
const openTubeDetails = async (tubeId: number) => {
  const request = openCard()
  try {
    const record = await fastApiService.getStandardTube(tubeId)
    if (request !== detailRequest) return
    tubeDetails.value = record
  } catch (loadError: any) {
    if (request !== detailRequest) return
    detailError.value = formatApiError(loadError, 'Не удалось открыть паспорт трубы')
  } finally {
    if (request === detailRequest) detailLoading.value = false
  }
}

const openDialog = async (nextScope: NetworkBypassJournalScope = {}) => {
  Object.assign(scope, { bypassId: undefined, standardTubeId: undefined, lineId: undefined }, nextScope)
  inventoryPage.value = 1
  tubePage.value = 1
  visible.value = true
  const tab: BypassTab = nextScope.standardTubeId ? 'tubes' : 'inventory'
  // watch(activeTab) грузит раздел при смене; при том же разделе грузим сами
  const tabChanged = activeTab.value !== tab
  activeTab.value = tab
  const loadSection = tabChanged ? Promise.resolve() : (tab === 'tubes' ? loadTubes() : loadInventory())
  // раздел сам показывает свою ошибку; сбой справочника не должен прятать список
  const [lookupsResult] = await Promise.allSettled([loadLookups(), loadSection])
  if (lookupsResult.status === 'rejected') notifications.showWarning(formatApiError(lookupsResult.reason, 'Справочники не загрузились — плитки и фильтры могут быть неполными'))
  if (nextScope.standardTubeId) await openTubeDetails(nextScope.standardTubeId)
  else if (nextScope.bypassId) await openItemDetails(nextScope.bypassId)
}

const startEdit = async () => {
  clearSaveError()
  if (!(await beginEdit())) return
  // версия строки для 409 и отправки только изменений
  beginEquipmentEdit('bypass', itemDetails.value?.id)
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
  const id = itemDetails.value?.id
  if (!id) return
  saving.value = true
  clearSaveError()
  try {
    await saveEquipmentEdit('bypass', id, editFields.value)
    markSaved(id)
    notifications.showSuccess('Изменения сохранены')
    await Promise.all([loadInventory(), openItemDetails(id)])
  } catch (cause) {
    // текст — в карточке; конфликт версий (409) ещё и уведомлением с перезагрузкой
    reportSaveError(cause, () => openItemDetails(id))
  } finally {
    saving.value = false
  }
}

const locate = (item: Record<string, unknown>) => {
  emit('locate-bypass', {
    longitude: Number(item.longitude), latitude: Number(item.latitude), id: Number(item.id),
    lineId: item.line_id == null ? null : Number(item.line_id), label: String(item.display_name || `Байпас №${item.id}`)
  })
  detailVisible.value = false
  visible.value = false
}

defineExpose({ openDialog })
</script>

<style scoped>
.bypass-journal { height: min(90vh, 920px); display: flex; flex-direction: column; }
.bypass-alerts { display: grid; gap: var(--space-2); }
.bypass-kpi { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.bypass-filters { flex-shrink: 0; background: rgba(var(--v-theme-on-surface), 0.02); }
.bypass-table-wrap { min-height: 280px; overflow: auto; flex: 1; }
.bypass-table { min-width: 1320px; }
.bypass-table--tubes { min-width: 1000px; }
@media (max-width: 600px) { .bypass-journal { height: 100dvh; } }
</style>
