<template>
  <Teleport to="body">
    <JournalShell
      v-model="visible"
      :page="activeTab === 'installed' ? installedPage : catalogPage"
      @update:page="(p) => { if (activeTab === 'installed') installedPage = p; else catalogPage = p }"
      title="Насосное оборудование"
      :subtitle="`${scopeTitle} · найдено ${total} · настроено ${lookups.counts.configured || 0} из ${lookups.counts.total || 0}`"
      icon="mdi-pump"
      avatar-color="blue-grey-lighten-5"
      icon-color="blue-grey-darken-2"
      :pages="activeTab === 'installed' ? installedPages : catalogPages"
      :loading="loading"
      :error="error"
      :empty="activeTab === 'installed' ? !installed.length : !catalog.length"
      :empty-title="activeTab === 'installed' ? 'Насосы не найдены' : 'Модели не найдены'"
      :empty-text="activeTab === 'installed' ? (filtersActive ? 'Измените фильтры: по выбранным условиям записей нет' : 'В базе нет установленных насосов') : ''"
      :empty-icon="'mdi-pump'"
      :empty-action-label="activeTab === 'installed' ? (filtersActive ? 'Сбросить фильтры' : undefined) : undefined"
      :skeleton-rows="activeTab === 'installed' ? (10) : (8)"
      @retry="activeTab === 'installed' ? loadInstalled() : loadCatalog()"
      @empty-action="activeTab === 'installed' ? resetFilters() : undefined"
    >
      <template #actions>
        <SegmentedToggle
          v-model="activeTab"
          :items="tabItems"
          aria-label="Раздел журнала насосов"
          class="mr-2"
        />
      </template>
      <template #top>

        <div
          v-if="lookupsLoaded && lookups.result_count === 0"
          class="px-3 px-md-4 pt-3"
        >
          <v-alert
            type="info"
            variant="tonal"
            density="compact"
          >
            Результатов гидравлического расчёта <code>NS_OUT</code> нет: рабочая точка появится после выполнения и
            сохранения расчёта сети, паспортные характеристики доступны уже сейчас.
          </v-alert>
        </div>

        <template v-if="activeTab === 'installed'">
          <div
            class="pump-kpi px-3 px-md-4 pt-3"
            role="group"
            aria-label="Готовность характеристики: фильтр по состоянию"
          >
            <KpiTile
              v-for="metric in configurationMetrics"
              :key="metric.value"
              :label="metric.label"
              :value="lookups.counts[metric.value] || 0"
              :compact="false"
              :status="metric.status"
              selectable
              :active="configurationStatus === metric.value"
              @select="toggleConfiguration(metric.value)"
            />
          </div>

        </template>
        <template v-else>
          <div
            class="pump-kpi px-3 px-md-4 pt-3"
            role="group"
            aria-label="Качество характеристики: фильтр по состоянию"
          >
            <KpiTile
              v-for="metric in catalogMetrics"
              :key="metric.value"
              :label="metric.label"
              :value="lookups.catalog_counts[metric.value] || 0"
              :compact="false"
              :status="metric.status"
              selectable
              :active="catalogQuality === metric.value"
              @select="toggleCatalogQuality(metric.value)"
            />
          </div>

        </template>
      </template>
      <template #filters>
        <template v-if="activeTab === 'installed'">
          <v-row dense>
            <v-col
              cols="12"
              md="5"
            >
              <SearchField
                :model-value="search"
                label="Насос, модель, станция, линия или ID"
                :debounce="350"
                :loading="loading"
                @update:model-value="search = $event"
                @search="onSearch"
              />
            </v-col>
            <v-col
              cols="12"
              sm="4"
              md="3"
            >
              <AppSelect
                v-model="configurationStatus"
                :items="configurationOptions"
                item-title="title"
                item-value="value"
                label="Готовность характеристики"
              />
            </v-col>
            <v-col
              cols="12"
              sm="4"
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
              sm="4"
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
              variant="tonal"
              prepend-icon="mdi-refresh"
              :loading="loading"
              @click="loadInstalled"
            >
              Обновить
            </v-btn>
          </div>
        </template>
        <template v-else>
          <v-row dense>
            <v-col
              cols="12"
              md="5"
            >
              <SearchField
                :model-value="catalogSearch"
                label="Модель, тип, изготовитель или ID"
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
                v-model="catalogQuality"
                :items="catalogStatusOptions"
                item-title="title"
                item-value="value"
                label="Качество характеристики"
              />
            </v-col>
            <v-col
              cols="12"
              sm="6"
              md="2"
            >
              <AppSelect
                v-model="pumpType"
                :items="lookups.pump_types"
                item-title="name"
                item-value="name"
                label="Тип насоса"
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
        </template>
      </template>
      <template v-if="activeTab === 'installed'">
        <DataTable
          :columns="installedColumns"
          :items="(installed as Record<string, unknown>[])"
          item-key="id"
          selectable
          :flash-key="flashId"
          density="compact"
          class="pump-table"
          @select="openInstalledDetails(Number($event.id))"
        >
          <template #[`item.line_id`]="{ item }">
            <span class="num">{{ item.line_id ?? '—' }}</span>
            <div class="text-caption text-medium-emphasis">
              узлы {{ item.node_id_1 ?? '—' }} → {{ item.node_id_2 ?? '—' }}
            </div>
          </template>
          <template #[`item.number`]="{ item }">
            <div class="text-truncate">
              {{ item.number || `Насос №${item.id}` }}
            </div>
            <div class="text-caption text-medium-emphasis text-truncate">
              {{ item.station_name || 'станция не указана' }}
            </div>
          </template>
          <template #[`item.model_name`]="{ item }">
            <div class="text-truncate">
              {{ item.model_name || item.model_type || 'не выбрана' }}
            </div>
          </template>
          <template #[`item.parallel_count`]="{ item }">
            {{ item.parallel_count ? `${item.parallel_count} шт.` : '—' }}
            <div class="text-caption text-medium-emphasis">
              {{ item.drive_type_name || 'привод не задан' }}
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
          <template #[`item.fragment_name`]="{ item }">
            {{ item.fragment_name || `№${item.fragment_id || '—'}` }}
          </template>
          <template #[`item.configuration_status`]="{ item }">
            <v-chip
              size="x-small"
              variant="tonal"
              :color="configurationColor(item.configuration_status as PumpConfigurationStatus)"
            >
              {{ configurationLabel(item.configuration_status as PumpConfigurationStatus) }}
            </v-chip>
          </template>
          <template #[`item.actions`]="{ item }">
            <HintTip
              v-if="hasCoordinates(item)"
              text="Показать насос на карте"
              hint="Журнал закроется, маркер останется"
            >
              <template #default="{ props: tip }">
                <v-btn
                  v-bind="tip"
                  icon="mdi-crosshairs-gps"
                  size="x-small"
                  variant="text"
                  aria-label="Показать насос на карте"
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
                  aria-label="Открыть карточку насоса"
                  @click.stop="openInstalledDetails(Number(item.id))"
                />
              </template>
            </HintTip>
          </template>
        </DataTable>
      </template>
      <template v-else>
        <DataTable
          :columns="catalogColumns"
          :items="(catalog as Record<string, unknown>[])"
          item-key="id"
          selectable
          density="compact"
          class="pump-table pump-table--catalog"
          @select="openCatalogDetails(Number($event.id))"
        >
          <template #[`item.name`]="{ item }">
            <div class="text-truncate">
              {{ item.name || '—' }}
            </div>
            <div class="text-caption text-medium-emphasis text-truncate">
              {{ item.producer || 'изготовитель не указан' }}
            </div>
          </template>
          <template #[`item.pump_type`]="{ item }">
            {{ item.pump_type || '—' }}
          </template>
          <template #[`item.working_zone`]="{ item }">
            {{ formatNumber(item.min_flow) }} … {{ formatNumber(item.max_flow) }} т/ч
          </template>
          <template #[`item.nominal`]="{ item }">
            {{ formatNumber(item.nominal_flow) }} т/ч / {{ formatNumber(item.nominal_head) }} м
          </template>
          <template #[`item.rotor`]="{ item }">
            {{ formatNumber(item.nominal_rotor_diameter) }} мм / {{ formatNumber(item.nominal_rotation_speed) }} об/мин
          </template>
          <template #[`item.point_count`]="{ item }">
            {{ item.point_count }}/10
          </template>
          <template #[`item.quality_status`]="{ item }">
            <v-chip
              size="x-small"
              variant="tonal"
              :color="catalogStatusColor(item.quality_status as PumpCatalogStatus)"
            >
              {{ catalogStatusLabel(item.quality_status as PumpCatalogStatus) }}
            </v-chip>
          </template>
        </DataTable>
      </template>
    </JournalShell>

    <v-dialog
      v-model="detailVisible"
      :persistent="saving"
      :fullscreen="isMobile"
      max-width="1480"
      scrollable
    >
      <v-card :rounded="isMobile ? 0 : 'lg'">
        <v-card-title class="d-flex align-center ga-3 px-4 py-3">
          <v-icon color="blue-grey-darken-2">mdi-pump</v-icon>
          <div
            class="flex-grow-1"
            style="min-width: 0"
          >
            <div class="text-subtitle-1 font-weight-bold d-flex align-center ga-2">
              <span class="text-truncate">{{ detailTitle }}</span>
              <v-chip
                v-if="modelDetails"
                size="x-small"
                variant="tonal"
              >
                {{ modelDetails.pump_type || 'тип не задан' }}
              </v-chip>
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
            :empty="!detailLoading && !detailError && !installedDetails && !catalogDetails"
            empty-title="Карточка не выбрана"
            :retry="false"
          >
            <template v-if="installedDetails || catalogDetails">
              <div class="pump-detail-alerts mb-3">
                <v-alert
                  v-if="installedDetails && !modelDetails"
                  type="warning"
                  variant="tonal"
                  density="compact"
                >
                  Для агрегата не выбрана паспортная модель — график H(Q) не строится. Модель назначается через
                  «Редактировать» → «Модель (тип насоса)», как в десктопе «Тип насоса → Характеристики».
                </v-alert>
                <v-alert
                  v-if="modelDetails?.quality_status === 'non_monotonic'"
                  type="warning"
                  variant="tonal"
                  density="compact"
                >
                  Расход в паспортных точках расположен не по возрастанию: точки показаны в исходном порядке и требуют
                  проверки справочника.
                </v-alert>
                <v-alert
                  v-if="modelDetails?.quality_status === 'incomplete'"
                  type="error"
                  variant="tonal"
                  density="compact"
                >
                  Паспортная характеристика или рабочая зона заполнена не полностью.
                </v-alert>
              </div>
              <v-row dense>
                <v-col
                  cols="12"
                  md="5"
                >
                  <JournalDetailFields
                    :groups="detailGroups"
                    :model="editFields"
                    :editable="editable"
                    :is-field-dirty="isFieldDirty"
                    :open-panels="[0, 1]"
                    @update:field="setEditField"
                  >
                    <v-expansion-panel
                      v-if="installedDetails"
                      :value="detailGroups.length"
                    >
                      <v-expansion-panel-title>Коэффициенты y = a₀ + a₁Q + a₂Q²</v-expansion-panel-title>
                      <v-expansion-panel-text class="pump-panel-table">
                        <DataTable
                          :columns="coefficientColumns"
                          :items="coefficientRows"
                          item-key="label"
                          density="compact"
                        />
                      </v-expansion-panel-text>
                    </v-expansion-panel>
                  </JournalDetailFields>
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
                </v-col>
                <v-col
                  cols="12"
                  md="7"
                >
                  <template v-if="modelDetails">
                    <div class="text-subtitle-2 mb-2">Характеристики H(Q), N(Q), КПД(Q)</div>
                    <ChartFrame
                      class="mb-4"
                      :option="chartOptions"
                      :height="isMobile ? 360 : 500"
                      label="Характеристики насоса H(Q), N(Q), КПД(Q)"
                      :export-name="`Насос — ${modelDetails.name || modelDetails.pump_type || modelDetails.id}`"
                    />
                    <div class="text-subtitle-2 mb-2">Паспортные точки</div>
                    <DataTable
                      :columns="pointColumns"
                      :items="pointRows"
                      item-key="index"
                      density="compact"
                      class="mb-4"
                    />
                  </template>
                  <template v-if="!installedDetails && installedPumpsOfModel.length">
                    <div class="text-subtitle-2 mb-2">Установленные агрегаты ({{ installedPumpsOfModel.length }})</div>
                    <div class="d-flex flex-wrap ga-2">
                      <v-chip
                        v-for="pump in installedPumpsOfModel"
                        :key="Number(pump.id)"
                        variant="tonal"
                        @click="openInstalledDetails(Number(pump.id))"
                      >
                        Насос {{ pump.id }} · линия {{ pump.line_id ?? '—' }}
                      </v-chip>
                    </div>
                  </template>
                </v-col>
              </v-row>
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
              v-if="installedDetails && hasCoordinates(installedDetails)"
              variant="tonal"
              prepend-icon="mdi-crosshairs-gps"
              @click="locate(installedDetails)"
            >
              На карте
            </v-btn>
            <v-btn
              v-if="mutationsEnabled && installedDetails"
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
import JournalShell from '~/components/JournalShell.vue'
import SearchField from '~/components/SearchField.vue'
import SegmentedToggle from '~/components/SegmentedToggle.vue'
import StateView from '~/components/StateView.vue'
import { computed, reactive, ref, watch } from 'vue'
import { use } from 'echarts/core'
import { LineChart, ScatterChart } from 'echarts/charts'
import { MarkAreaComponent } from 'echarts/components'
import ChartFrame from '~/components/ChartFrame.vue'
import { axisTooltip, formatChartNumber, zoomControls } from '~/utils/chartOptions'
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
import { pumpModelOptions, withCurrentOption } from '~/utils/pumpModels'
import {
  fastApiService,
  type InstalledPumpDetails,
  type InstalledPumpSummary,
  type PumpCatalogStatus,
  type PumpConfigurationStatus,
  type PumpCurvePoint,
  type PumpEquipmentLookups,
  type StandardPumpDetails,
  type StandardPumpSummary
} from '~/services/fastApiService'

use([LineChart, ScatterChart, MarkAreaComponent])
/** Единицы серий по первой букве имени: H — напор, N — мощность, КПД; рабочая точка — напор */
const pumpSeriesUnit = (name: string) => (name.startsWith('N') ? 'кВт' : name.startsWith('КПД') ? '%' : 'м')

/**
 * Насосы — журнал оборудования с двумя разделами (docs/ui-modernization-progress.md, этап 5): установленные
 * агрегаты и каталог моделей на `DataTable` с серверной пагинацией; плитки готовности и качества характеристики —
 * фильтры; карточка на `JournalDetailFields` (слева) с графиком H(Q)/N(Q)/КПД(Q) и паспортными точками (справа);
 * правка колонок `pumps` через `equipmentEditService` на общем `useJournalEdit` (`toForm`), модель каталога
 * выбирается из подгружаемого списка.
 */
export interface PumpJournalScope {
  pumpId?: number
  standardPumpId?: number
  lineId?: number
}

type PumpTab = 'installed' | 'catalog'

const emit = defineEmits<{
  'locate-pump': [payload: { longitude: number; latitude: number; id: number; lineId: number | null; label: string }]
}>()
const { isMobile } = useMobile()
const canEditNetwork = useMutationsEnabled('network')
const authStore = useAuthStore()
// плюс право «оборудование: правка» из матрицы ролей — как у кнопки «Оборудование» в карточке объекта
const mutationsEnabled = computed(() => canEditNetwork.value && canDo(authStore.permissions, 'equipment', 'edit'))
const notifications = useNotificationStore()
const { saveError, clearSaveError, reportSaveError } = useEquipmentSaveError()
const visible = ref(false)
const activeTab = ref<PumpTab>('installed')
const tabItems = computed(() => [
  { value: 'installed', label: `Установленные агрегаты (${lookups.counts.total || 0})`, icon: 'mdi-pump' },
  { value: 'catalog', label: `Каталог моделей (${lookups.catalog_counts.total || 0})`, icon: 'mdi-book-open-variant' }
])
const loading = ref(false)
const error = ref('')
const installed = ref<InstalledPumpSummary[]>([])
const catalog = ref<StandardPumpSummary[]>([])
const total = ref(0)
const installedPage = ref(1)
const installedPages = ref(0)
const catalogPage = ref(1)
const catalogPages = ref(0)
const pageSize = 50
const search = ref('')
const configurationStatus = ref<PumpConfigurationStatus | undefined>()
const stateId = ref<number | undefined>()
const fragmentId = ref<number | undefined>()
const catalogSearch = ref('')
const catalogQuality = ref<PumpCatalogStatus | undefined>()
const pumpType = ref<string | undefined>()
const scope = reactive<PumpJournalScope>({})
const lookups = reactive<PumpEquipmentLookups>({
  states: [], drive_types: [], rotor_diameter_types: [], fragments: [], pump_types: [], counts: {}, catalog_counts: {}, calculation_count: 0, result_count: 0
})
const lookupsLoaded = ref(false)

const detailVisible = ref(false)
const detailLoading = ref(false)
const detailError = ref('')
const installedDetails = ref<InstalledPumpDetails | null>(null)
const catalogDetails = ref<StandardPumpDetails | null>(null)

const configurationMetrics: Array<{ value: PumpConfigurationStatus; label: string; status: KpiStatus }> = [
  { value: 'configured', label: 'Настроены', status: 'good' },
  { value: 'missing_model', label: 'Без модели', status: 'warning' },
  { value: 'coefficients_missing', label: 'Без коэффициентов', status: 'warning' },
  { value: 'line_missing', label: 'Нет линии', status: 'critical' }
]
const configurationOptions = configurationMetrics.map(metric => ({ title: metric.label, value: metric.value }))
const catalogMetrics: Array<{ value: PumpCatalogStatus; label: string; status: KpiStatus }> = [
  { value: 'ready', label: 'Готовы', status: 'good' },
  { value: 'non_monotonic', label: 'Порядок Q', status: 'warning' },
  { value: 'incomplete', label: 'Неполные', status: 'critical' }
]
const catalogStatusOptions = catalogMetrics.map(metric => ({ title: metric.label, value: metric.value }))

const scopeTitle = computed(() => (scope.lineId ? `насосы линии ${scope.lineId}` : 'вся тепловая сеть'))
const filtersActive = computed(() => Boolean(search.value.trim() || configurationStatus.value || stateId.value || fragmentId.value))

const installedColumns: DataTableColumn[] = [
  { key: 'id', title: 'ID', type: 'number', width: 80, sortable: false },
  { key: 'line_id', title: 'Линия', width: 140, sortable: false },
  { key: 'number', title: '№ / станция', sortable: false },
  { key: 'model_name', title: 'Модель', width: 180, sortable: false },
  { key: 'parallel_count', title: 'Режим', width: 150, sortable: false },
  { key: 'state_name', title: 'Состояние', width: 110, sortable: false },
  { key: 'fragment_name', title: 'Фрагмент', width: 120, sortable: false },
  { key: 'configuration_status', title: 'Готовность', width: 150, sortable: false },
  { key: 'actions', title: '', type: 'actions', width: 88, sortable: false },
]
const catalogColumns: DataTableColumn[] = [
  { key: 'id', title: 'ID', type: 'number', width: 80, sortable: false },
  { key: 'name', title: 'Модель', sortable: false },
  { key: 'pump_type', title: 'Тип', width: 120, sortable: false },
  { key: 'working_zone', title: 'Рабочая зона Q', width: 160, sortable: false },
  { key: 'nominal', title: 'Номинал Q / H', width: 160, sortable: false },
  { key: 'rotor', title: 'Колесо / частота', width: 180, sortable: false },
  { key: 'point_count', title: 'Точки', width: 80, sortable: false },
  { key: 'installed_count', title: 'Используется', type: 'number', width: 120, sortable: false },
  { key: 'quality_status', title: 'Качество', width: 110, sortable: false },
]
const coefficientColumns: DataTableColumn[] = [
  { key: 'label', title: 'Кривая', sortable: false },
  { key: 'a0', title: 'a₀', type: 'number', width: 110, sortable: false },
  { key: 'a1', title: 'a₁', type: 'number', width: 110, sortable: false },
  { key: 'a2', title: 'a₂', type: 'number', width: 110, sortable: false },
]
const pointColumns: DataTableColumn[] = [
  { key: 'index', title: '№', type: 'number', width: 60, sortable: false },
  { key: 'flow', title: 'Q, т/ч', type: 'number', sortable: false },
  { key: 'head', title: 'H, м', type: 'number', sortable: false },
  { key: 'power', title: 'N, кВт', type: 'number', sortable: false },
  { key: 'efficiency', title: 'КПД, %', type: 'number', sortable: false },
  { key: 'zone', title: 'Рабочая зона', width: 120, sortable: false },
]

const CONFIGURATION_LABEL: Record<PumpConfigurationStatus, string> = { configured: 'настроен', missing_model: 'нет модели', coefficients_missing: 'нет коэффициентов', line_missing: 'нет линии' }
const CONFIGURATION_COLOR: Record<PumpConfigurationStatus, string> = { configured: 'success', missing_model: 'warning', coefficients_missing: 'warning', line_missing: 'error' }
const CATALOG_LABEL: Record<PumpCatalogStatus, string> = { ready: 'готов', non_monotonic: 'порядок Q', incomplete: 'неполный' }
const CATALOG_COLOR: Record<PumpCatalogStatus, string> = { ready: 'success', non_monotonic: 'warning', incomplete: 'error' }
const configurationLabel = (status: PumpConfigurationStatus) => CONFIGURATION_LABEL[status] || String(status || '—')
const configurationColor = (status: PumpConfigurationStatus) => CONFIGURATION_COLOR[status] || 'grey'
const catalogStatusLabel = (status: PumpCatalogStatus) => CATALOG_LABEL[status] || String(status || '—')
const catalogStatusColor = (status: PumpCatalogStatus) => CATALOG_COLOR[status] || 'grey'
const stateColor = (state: unknown) => {
  const text = String(state || '').toLowerCase()
  return text === 'открыт' ? 'success' : text === 'закрыт' ? 'grey' : 'blue-grey'
}
const hasCoordinates = (item: Record<string, unknown>) => hasLonLat(item)
const formatNumber = (value: unknown, digits = 2) =>
  value === null || value === undefined || value === '' || !Number.isFinite(Number(value))
    ? '—'
    : Number(value).toLocaleString('ru-RU', { maximumFractionDigits: digits })
const formatUnit = (value: unknown, unit: string) => (formatNumber(value, 3) === '—' ? '—' : `${formatNumber(value, 3)} ${unit}`)

// Модели каталога для назначения насосу (standardpumpid; в каталоге ~80 записей) — грузятся при входе в правку
const modelOptions = ref<Array<{ id: number; name: string }>>([])
const loadModelOptions = async () => {
  if (modelOptions.value.length) return
  const items: StandardPumpSummary[] = []
  for (let page = 1; ; page += 1) {
    const response = await fastApiService.getPumpCatalog({ page, page_size: 200 })
    items.push(...response.items)
    if (page >= response.pages) break
  }
  modelOptions.value = pumpModelOptions(items)
}

/** Правятся колонки таблицы pumps (allow-list equipment_edit); ключи формы — имена колонок */
interface EditColumn { label: string; from: string; type: string; items?: unknown[] }
const editColumns = computed((): Record<string, EditColumn> => {
  const current = installedDetails.value
  return {
    standardpumpid: { label: 'Модель (тип насоса)', from: 'standard_pump_id', type: 'select', items: withCurrentOption(modelOptions.value, current?.standard_pump_id, current?.model_type || current?.model_name) },
    thrust: { label: 'Заданный напор, м', from: 'thrust', type: 'number' },
    number: { label: 'Номер', from: 'number', type: 'text' },
    pumpstationid: { label: 'Станция', from: 'station_name', type: 'text' },
    stateid: { label: 'Состояние', from: 'state_id', type: 'select', items: lookups.states },
    parallagregcount: { label: 'Параллельно (шт.)', from: 'parallel_count', type: 'number' },
    drivetypeid: { label: 'Привод', from: 'drive_type_id', type: 'select', items: lookups.drive_types },
    rotordiametertypeid: { label: 'Рабочее колесо', from: 'rotor_diameter_type_id', type: 'select', items: lookups.rotor_diameter_types },
    rotorrotspeedset: { label: 'Заданная частота', from: 'configured_rotation_speed', type: 'number' },
    rotordiameterset: { label: 'Заданный диаметр', from: 'configured_rotor_diameter', type: 'number' }
  }
})
const editSource: JournalEditSource = {
  schema: computed(() => ({ fields: editColumns.value as Record<string, unknown> })),
  isWritable: (key?: string | null) => Boolean(key && key in editColumns.value),
  // список моделей нужен форме; без него правка не открывается (ошибку показывает startEdit)
  loadSchema: async () => {
    await loadModelOptions()
    return true
  }
}
const {
  isEditing, saving, editFields, flashId, isDirty, isFieldDirty, editable, setEditField,
  beginEdit, resetEdit, cancel, closeKeepingDraft, markSaved
} = useJournalEdit('pumps', editSource, installedDetails, {
  toForm: record => Object.fromEntries(Object.entries(editColumns.value).map(([column, def]) => [column, record[def.from] ?? null]))
})

/** Поля карточки: только заполненные (в правке — все записываемые), значение — строка */
const buildFields = (entries: Array<[string, unknown, string?, string?, unknown[]?]>): JournalDetailField[] => entries
  .filter(([, value, key]) => (isEditing.value && key) || (value !== null && value !== undefined && value !== '' && value !== '—'))
  .map(([label, value, key, type, items]) => ({ label, value: String(value ?? '—'), rawValue: value, key, type: type || 'text', items }))

const modelDetails = computed(() => installedDetails.value?.standard_pump || catalogDetails.value)
const installedPumpsOfModel = computed(() => ((modelDetails.value as Record<string, unknown> | null)?.installed_pumps as Array<Record<string, unknown>> | undefined) || [])
const detailGroups = computed((): JournalDetailGroup[] => {
  const pump = installedDetails.value
  const model = modelDetails.value
  const output = pump?.latest_output
  const outputValue = (key: string) => output?.[key]
  const columns = editColumns.value
  return [
    { title: 'Установленный агрегат', fields: pump ? buildFields([
      ['ID / линия', `${pump.id} / ${pump.line_id ?? '—'}`],
      ['Модель (тип насоса)', model?.name || model?.pump_type || pump.model_name || pump.model_type, 'standardpumpid', 'select', columns.standardpumpid?.items],
      ['Заданный напор', formatUnit(pump.thrust, 'м'), 'thrust', 'number'],
      ['Номер', pump.number, 'number', 'text'], ['Станция', pump.station_name, 'pumpstationid', 'text'],
      ['Состояние', pump.state_name, 'stateid', 'select', lookups.states],
      ['Параллельно', pump.parallel_count ? `${pump.parallel_count} шт.` : null, 'parallagregcount', 'number'],
      ['Привод', pump.drive_type_name, 'drivetypeid', 'select', lookups.drive_types],
      ['Рабочее колесо', pump.rotor_diameter_type_name, 'rotordiametertypeid', 'select', lookups.rotor_diameter_types],
      ['Заданная частота', formatUnit(pump.configured_rotation_speed, 'об/мин'), 'rotorrotspeedset', 'number'],
      ['Заданный диаметр', formatUnit(pump.configured_rotor_diameter, 'мм'), 'rotordiameterset', 'number'],
      ['Электродвигатель', pump.motor_name], ['Фрагмент', pump.fragment_name]
    ]) : [] },
    { title: 'Паспорт модели', fields: model ? buildFields([
      ['ID / наименование', `${model.id} / ${model.name || '—'}`], ['Изготовитель', model.producer],
      ['Рабочая зона Q', `${formatNumber(model.min_flow)} … ${formatNumber(model.max_flow)} т/ч`],
      ['Номинальный Q / H', `${formatNumber(model.nominal_flow)} т/ч / ${formatNumber(model.nominal_head)} м`],
      ['Номинальный КПД', formatUnit(model.nominal_efficiency, '%')], ['Колесо', formatUnit(model.nominal_rotor_diameter, 'мм')],
      ['Частота', formatUnit(model.nominal_rotation_speed, 'об/мин')], ['Макс. температура', formatUnit(model.max_temperature, '°C')]
    ]) : [] },
    { title: 'Последняя рабочая точка', fields: !pump ? [] : output ? buildFields([
      ['Расход', formatUnit(outputValue('working_flow'), 'т/ч')], ['Напор', formatUnit(outputValue('working_head'), 'м')],
      ['Пьезометрический напор вход', formatUnit(outputValue('inlet_piezometric_head'), 'м')],
      ['Пьезометрический напор выход', formatUnit(outputValue('outlet_piezometric_head'), 'м')],
      ['Работающих насосов', outputValue('working_pump_count')], ['Режим', outputValue('operation_status')]
    ]) : buildFields([['Результат', 'рабочая точка пока не рассчитана']]) }
  ].filter(group => group.fields.length)
})
const coefficientRows = computed(() => {
  const attrs = (installedDetails.value?.attributes || {}) as Record<string, unknown>
  const row = (label: string, prefix: string) => ({
    label, a0: formatNumber(attrs[`${prefix}0`], 6), a1: formatNumber(attrs[`${prefix}1`], 6), a2: formatNumber(attrs[`${prefix}2`], 6)
  })
  return [
    row('H(Q), ном.', 'r'), { ...row('H(Q), привед.', 'r'), a0: formatNumber(attrs.r0_z, 6), a1: formatNumber(attrs.r1_z, 6), a2: formatNumber(attrs.r2_z, 6) },
    row('N(Q), ном.', 'e'), { ...row('N(Q), привед.', 'e'), a0: formatNumber(attrs.e0_z, 6), a1: formatNumber(attrs.e1_z, 6), a2: formatNumber(attrs.e2_z, 6) },
    row('КПД(Q), ном.', 'k'), { ...row('КПД(Q), привед.', 'k'), a0: formatNumber(attrs.k0_z, 6), a1: formatNumber(attrs.k1_z, 6), a2: formatNumber(attrs.k2_z, 6) }
  ]
})
const pointInWorkingZone = (point: PumpCurvePoint) => {
  const model = modelDetails.value
  return point.flow !== null && model?.min_flow !== null && model?.max_flow !== null
    && Number(point.flow) >= Number(model?.min_flow) && Number(point.flow) <= Number(model?.max_flow)
}
const pointRows = computed(() => (modelDetails.value?.points || []).map(point => ({
  index: point.index, flow: formatNumber(point.flow, 3), head: formatNumber(point.head, 3), power: formatNumber(point.power, 3),
  efficiency: formatNumber(point.efficiency, 3), zone: pointInWorkingZone(point) ? 'да' : 'нет'
})))

const adjustedCurve = (prefix: 'r' | 'e' | 'k') => {
  const attrs = (installedDetails.value?.attributes || {}) as Record<string, unknown>
  const a0 = Number(attrs[`${prefix}0_z`])
  const a1 = Number(attrs[`${prefix}1_z`])
  const a2 = Number(attrs[`${prefix}2_z`])
  if (![a0, a1, a2].some(value => Number.isFinite(value) && value !== 0)) return []
  const points = modelDetails.value?.points.filter(point => Number.isFinite(Number(point.flow))) || []
  const pointFlows = points.map(point => Number(point.flow))
  const min = Number(modelDetails.value?.min_flow ?? Math.min(...pointFlows))
  const max = Number(modelDetails.value?.max_flow ?? Math.max(...pointFlows))
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return []
  return Array.from({ length: 41 }, (_, index) => {
    const flow = min + (max - min) * index / 40
    return [flow, a0 + a1 * flow + a2 * flow * flow]
  })
}
const chartOptions = computed(() => {
  const model = modelDetails.value
  const points = model?.points.filter(point => point.flow !== null) || []
  const workingFlow = Number(installedDetails.value?.latest_output?.working_flow)
  const workingHead = Number(installedDetails.value?.latest_output?.working_head)
  const series: Array<Record<string, unknown>> = [
    { name: 'H паспорт', type: 'line', yAxisIndex: 0, data: points.map(point => [point.flow, point.head]), symbolSize: 6, lineStyle: { width: 2 }, itemStyle: { color: '#1565c0' }, markArea: model?.has_valid_working_zone ? { silent: true, itemStyle: { color: 'rgba(255, 152, 0, .12)' }, data: [[{ xAxis: model.min_flow, name: 'рабочая зона' }, { xAxis: model.max_flow }]] } : undefined },
    { name: 'N паспорт', type: 'line', yAxisIndex: 1, data: points.map(point => [point.flow, point.power]), symbolSize: 5, lineStyle: { width: 2 }, itemStyle: { color: '#ef6c00' } },
    { name: 'КПД паспорт', type: 'line', yAxisIndex: 2, data: points.map(point => [point.flow, point.efficiency]), symbolSize: 5, lineStyle: { width: 2 }, itemStyle: { color: '#2e7d32' } }
  ]
  const adjusted = [
    { name: 'H приведённая', axis: 0, data: adjustedCurve('r'), color: '#42a5f5' },
    { name: 'N приведённая', axis: 1, data: adjustedCurve('e'), color: '#ffb74d' },
    { name: 'КПД приведённый', axis: 2, data: adjustedCurve('k'), color: '#66bb6a' }
  ]
  adjusted.filter(item => item.data.length).forEach(item => series.push({ name: item.name, type: 'line', yAxisIndex: item.axis, data: item.data, showSymbol: false, lineStyle: { width: 2, type: 'dashed', color: item.color } }))
  if (Number.isFinite(workingFlow) && Number.isFinite(workingHead)) series.push({ name: 'Рабочая точка', type: 'scatter', yAxisIndex: 0, data: [[workingFlow, workingHead]], symbolSize: 13, itemStyle: { color: '#d32f2f' } })
  return {
    tooltip: axisTooltip({ units: pumpSeriesUnit, title: params => `Q ${formatChartNumber(params[0]?.axisValue, 1)} т/ч` }),
    legend: { type: 'scroll', top: 0, left: 0, right: 120 },
    grid: { left: 65, right: 145, top: 55, bottom: 80 },
    xAxis: { type: 'value', name: 'Q, т/ч', nameLocation: 'middle', nameGap: 32, min: 0 },
    yAxis: [
      { type: 'value', name: 'H, м', position: 'left', axisLine: { show: true, lineStyle: { color: '#1565c0' } } },
      { type: 'value', name: 'N, кВт', position: 'right', axisLine: { show: true, lineStyle: { color: '#ef6c00' } } },
      { type: 'value', name: 'КПД, %', position: 'right', offset: 70, axisLine: { show: true, lineStyle: { color: '#2e7d32' } }, min: 0 }
    ],
    dataZoom: zoomControls({ sliderBottom: 18 }), series
  }
})
const detailTitle = computed(() => installedDetails.value
  ? `${installedDetails.value.number || `Насос №${installedDetails.value.id}`} · ${modelDetails.value?.name || modelDetails.value?.pump_type || 'модель не выбрана'}`
  : modelDetails.value?.name || modelDetails.value?.pump_type || 'Паспорт насоса')
const detailSubtitle = computed(() => {
  if (installedDetails.value) return `линия ${installedDetails.value.line_id ?? '—'} · ${installedDetails.value.station_name || 'станция не указана'} · ${installedDetails.value.state_name || 'состояние не указано'}`
  if (catalogDetails.value) return `модель каталога · ${catalogDetails.value.producer || 'изготовитель не указан'}`
  return ''
})

const loadLookups = async () => {
  if (lookupsLoaded.value) return
  Object.assign(lookups, await fastApiService.getPumpEquipmentLookups())
  lookupsLoaded.value = true
}

/** Номера последних запросов: ответ более раннего запроса не перекрывает поздний */
let installedRequest = 0
const loadInstalled = async () => {
  const request = ++installedRequest
  loading.value = true
  error.value = ''
  try {
    const response = await fastApiService.getInstalledPumps({
      page: installedPage.value, page_size: pageSize, search: search.value.trim() || undefined,
      configuration_status: configurationStatus.value, state_id: stateId.value, fragment_id: fragmentId.value, line_id: scope.lineId
    })
    if (request !== installedRequest) return
    installed.value = response.items
    total.value = response.total
    installedPages.value = response.pages
  } catch (loadError: any) {
    if (request !== installedRequest) return
    error.value = formatApiError(loadError, 'Не удалось загрузить насосы')
  } finally {
    if (request === installedRequest) loading.value = false
  }
}
let catalogRequest = 0
const loadCatalog = async () => {
  const request = ++catalogRequest
  loading.value = true
  error.value = ''
  try {
    const response = await fastApiService.getPumpCatalog({
      page: catalogPage.value, page_size: pageSize, search: catalogSearch.value.trim() || undefined,
      quality_status: catalogQuality.value, pump_type: pumpType.value
    })
    if (request !== catalogRequest) return
    catalog.value = response.items
    catalogPages.value = response.pages
  } catch (loadError: any) {
    if (request !== catalogRequest) return
    error.value = formatApiError(loadError, 'Не удалось загрузить каталог насосов')
  } finally {
    if (request === catalogRequest) loading.value = false
  }
}

watch([configurationStatus, stateId, fragmentId], () => {
  if (!visible.value) return
  installedPage.value = 1
  void loadInstalled()
})
watch([catalogQuality, pumpType], () => {
  if (!visible.value) return
  catalogPage.value = 1
  void loadCatalog()
})
watch(installedPage, () => { if (visible.value) void loadInstalled() })
watch(catalogPage, () => { if (visible.value) void loadCatalog() })
watch(activeTab, (tab) => {
  if (!visible.value) return
  error.value = ''
  if (tab === 'catalog' && !catalog.value.length) void loadCatalog()
  if (tab === 'installed' && !installed.value.length) void loadInstalled()
})

const onSearch = () => {
  if (!visible.value) return
  installedPage.value = 1
  void loadInstalled()
}
const onCatalogSearch = () => {
  if (!visible.value) return
  catalogPage.value = 1
  void loadCatalog()
}
const toggleConfiguration = (status: PumpConfigurationStatus) => {
  configurationStatus.value = configurationStatus.value === status ? undefined : status
}
const toggleCatalogQuality = (status: PumpCatalogStatus) => {
  catalogQuality.value = catalogQuality.value === status ? undefined : status
}
const resetFilters = () => {
  search.value = ''
  configurationStatus.value = undefined
  stateId.value = undefined
  fragmentId.value = undefined
  installedPage.value = 1
  void loadInstalled()
}
const clearScope = () => {
  scope.lineId = undefined
  installedPage.value = 1
  void loadInstalled()
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
  installedDetails.value = null
  catalogDetails.value = null
  return ++detailRequest
}
const openInstalledDetails = async (pumpId: number) => {
  const request = openCard()
  try {
    const record = await fastApiService.getInstalledPump(pumpId)
    if (request !== detailRequest) return
    installedDetails.value = record
  } catch (loadError: any) {
    if (request !== detailRequest) return
    detailError.value = formatApiError(loadError, 'Не удалось открыть насос')
  } finally {
    if (request === detailRequest) detailLoading.value = false
  }
}
const openCatalogDetails = async (standardPumpId: number) => {
  const request = openCard()
  try {
    const record = await fastApiService.getStandardPump(standardPumpId)
    if (request !== detailRequest) return
    catalogDetails.value = record
  } catch (loadError: any) {
    if (request !== detailRequest) return
    detailError.value = formatApiError(loadError, 'Не удалось открыть модель')
  } finally {
    if (request === detailRequest) detailLoading.value = false
  }
}

let openDialogSeq = 0
const openDialog = async (nextScope: PumpJournalScope = {}) => {
  const seq = ++openDialogSeq
  Object.assign(scope, { pumpId: undefined, standardPumpId: undefined, lineId: undefined }, nextScope)
  installedPage.value = 1
  catalogPage.value = 1
  visible.value = true
  const tab: PumpTab = nextScope.standardPumpId ? 'catalog' : 'installed'
  // watch(activeTab) грузит раздел при смене; при том же разделе грузим сами
  const tabChanged = activeTab.value !== tab
  activeTab.value = tab
  const loadSection = tabChanged ? Promise.resolve() : (tab === 'catalog' ? loadCatalog() : loadInstalled())
  // раздел сам показывает свою ошибку; сбой справочника не должен прятать список
  const [lookupsResult] = await Promise.allSettled([loadLookups(), loadSection])
  if (lookupsResult.status === 'rejected') notifications.showWarning(formatApiError(lookupsResult.reason, 'Справочники не загрузились — плитки и фильтры могут быть неполными'))
  // журнал открыли снова, пока грузились списки — запись открывает последний вызов
  if (seq !== openDialogSeq) return
  if (nextScope.standardPumpId) await openCatalogDetails(nextScope.standardPumpId)
  else if (nextScope.pumpId) await openInstalledDetails(nextScope.pumpId)
}

const startEdit = async () => {
  clearSaveError()
  try {
    if (!(await beginEdit())) return
  } catch (cause) {
    // список моделей не загрузился — без него форма бессмысленна
    notifications.showError(formatApiError(cause, 'Не удалось загрузить каталог моделей насосов'))
    return
  }
  // версия строки для 409 и отправки только изменений
  beginEquipmentEdit('pumps', installedDetails.value?.id)
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
  const id = installedDetails.value?.id
  if (!id) return
  saving.value = true
  clearSaveError()
  try {
    await saveEquipmentEdit('pumps', id, editFields.value)
    markSaved(id)
    notifications.showSuccess('Изменения сохранены')
    await Promise.all([loadInstalled(), openInstalledDetails(id)])
  } catch (cause) {
    // текст — в карточке; конфликт версий (409) ещё и уведомлением с перезагрузкой
    reportSaveError(cause, () => openInstalledDetails(id))
  } finally {
    saving.value = false
  }
}

const locate = (item: Record<string, unknown>) => {
  if (!hasCoordinates(item)) return
  emit('locate-pump', {
    longitude: Number(item.longitude), latitude: Number(item.latitude), id: Number(item.id),
    lineId: item.line_id == null ? null : Number(item.line_id),
    label: String(item.number || item.model_name || `Насос №${item.id}`)
  })
  detailVisible.value = false
  visible.value = false
}

defineExpose({ openDialog })
</script>

<style scoped>
.pump-kpi { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.pump-table { min-width: 1180px; }
.pump-table--catalog { min-width: 1180px; }
.pump-detail-alerts { display: grid; gap: var(--space-2); }
.pump-detail-alerts:empty { display: none; }
.pump-panel-table :deep(.v-expansion-panel-text__wrapper) { padding: 0; }
</style>
