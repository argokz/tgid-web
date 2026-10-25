<template>
  <Teleport to="body">
    <v-dialog
      v-model="visible"
      :fullscreen="isMobile"
      max-width="1500"
      scrollable
    >
      <v-card
        class="heat-loss-journal"
        :rounded="isMobile ? 0 : 'lg'"
      >
        <v-card-title class="d-flex align-center flex-wrap ga-3 px-4 py-3">
          <v-avatar
            color="deep-orange-lighten-5"
            size="40"
          >
            <v-icon color="deep-orange-darken-3">mdi-heat-wave</v-icon>
          </v-avatar>
          <div
            class="flex-grow-1"
            style="min-width: 0"
          >
            <div class="text-subtitle-1 font-weight-bold">Тепловые потери</div>
            <div class="text-caption text-medium-emphasis text-truncate">
              сезонов {{ lookups.season_counts.total || 0 }} · источников готовы {{ lookups.source_counts.ready || 0 }} из {{ lookups.source_counts.total || 0 }}
            </div>
          </div>
          <SegmentedToggle
            v-model="activeTab"
            :items="tabItems"
            wrap
            aria-label="Раздел журнала тепловых потерь"
            class="journal-tabs"
          />
          <HintTip
            text="Excel сезонов"
            hint="Ведомость отопительных сезонов"
            location="bottom"
          >
            <template #default="{ props: tip }">
              <v-btn
                v-bind="tip"
                icon
                variant="text"
                aria-label="Выгрузить сезоны в Excel"
                :loading="exportingSeasons"
                @click="downloadSeasonsExcel"
              >
                <v-icon>mdi-microsoft-excel</v-icon>
              </v-btn>
            </template>
          </HintTip>
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

        <v-alert
          v-if="lookupsLoaded && lookups.result_availability.calculation_count === 0"
          type="info"
          variant="tonal"
          density="compact"
          class="mx-3 mx-md-4 mt-3 flex-shrink-0"
        >
          В БД пока нет сохранённых результатов расчёта UT_OUT. Журнал показывает реальные сезоны и готовность
          исходных данных desktop-калькулятора.
        </v-alert>

        <v-window
          v-model="activeTab"
          class="journal-window"
        >
          <v-window-item
            value="seasons"
            class="journal-pane"
          >
            <div class="pa-3 pa-md-4 journal-filters">
              <v-row dense>
                <v-col
                  cols="12"
                  md="8"
                >
                  <SearchField
                    :model-value="seasonSearch"
                    label="Поиск по городу, датам или ID"
                    :debounce="350"
                    :loading="seasonsLoading"
                    @update:model-value="seasonSearch = $event"
                    @search="reloadSeasons"
                  />
                </v-col>
                <v-col
                  cols="12"
                  md="4"
                >
                  <AppSelect
                    v-model="seasonCity"
                    :items="lookups.cities"
                    item-title="name"
                    item-value="name"
                    label="Город"
                  />
                </v-col>
              </v-row>
            </div>
            <v-divider />
            <div class="table-wrap">
              <StateView
                variant="table"
                :rows="8"
                :loading="seasonsLoading && !seasons.length"
                :error="seasonsError"
                :empty="!seasonsLoading && !seasons.length"
                empty-title="Сезоны не найдены"
                :empty-text="seasonFiltersActive ? 'Измените фильтры: по выбранным условиям сезонов нет' : 'В базе нет отопительных сезонов'"
                empty-icon="mdi-calendar-blank-outline"
                :action-label="seasonFiltersActive ? 'Сбросить фильтры' : undefined"
                error-title="Не удалось загрузить сезоны"
                :retrying="seasonsLoading"
                @retry="loadSeasons"
                @action="resetSeasonFilters"
              >
                <v-progress-linear
                  v-if="seasonsLoading"
                  indeterminate
                  color="primary"
                />
                <DataTable
                  :columns="seasonColumns"
                  :items="(seasons as Record<string, unknown>[])"
                  item-key="id"
                  selectable
                  :selected-key="flashId"
                  density="compact"
                  class="season-table"
                  @select="openSeason(Number($event.id))"
                >
                  <template #[`item.d1`]="{ item }">
                    {{ formatDate(item.d1) }} — {{ formatDate(item.d2) }}
                  </template>
                  <template #[`item.city`]="{ item }">
                    {{ item.city || '—' }}
                  </template>
                  <template #[`item.t_ot`]="{ item }">
                    {{ formatNumber(item.t_ot, ' °C') }}
                  </template>
                  <template #[`item.t_vent`]="{ item }">
                    {{ formatNumber(item.t_vent, ' °C') }}
                  </template>
                  <template #[`item.a`]="{ item }">
                    {{ formatNumber(item.a) }}
                  </template>
                  <template #[`item.volwaterhs`]="{ item }">
                    ОТ {{ formatNumber(item.volwaterhs) }} / В {{ formatNumber(item.volwatervs) }} / ГВС {{ formatNumber(item.volwateropengvs) }}
                  </template>
                  <template #[`item.is_current`]="{ item }">
                    <v-chip
                      size="x-small"
                      variant="tonal"
                      :color="item.is_current ? 'success' : 'grey'"
                    >
                      {{ item.is_current ? 'текущий' : 'архив' }}
                    </v-chip>
                  </template>
                </DataTable>
              </StateView>
            </div>
            <v-divider />
            <div class="d-flex align-center px-4 py-2">
              <span class="text-caption text-medium-emphasis">Страница {{ seasonPage }}{{ seasonPages ? ` из ${seasonPages}` : '' }}</span>
              <v-spacer />
              <v-pagination
                v-if="seasonPages > 1"
                v-model="seasonPage"
                :length="seasonPages"
                :total-visible="isMobile ? 3 : 7"
                density="compact"
              />
            </div>
          </v-window-item>

          <v-window-item
            value="sources"
            class="journal-pane"
          >
            <!-- Плитки готовности на всю базу; плитка — фильтр -->
            <div class="journal-kpi px-3 px-md-4 pt-3">
              <KpiTile
                label="Готовы к расчёту"
                :value="lookups.source_counts.ready || 0"
                :compact="false"
                status="good"
                selectable
                :active="sourceReadiness === 'ready'"
                @select="toggleReadiness('ready')"
              />
              <KpiTile
                label="Неполные данные"
                :value="incompleteCount"
                :compact="false"
                :status="incompleteCount > 0 ? 'warning' : 'good'"
                selectable
                :active="sourceReadiness === 'incomplete'"
                @select="toggleReadiness('incomplete')"
              />
              <KpiTile
                label="Всего источников"
                :value="lookups.source_counts.total || 0"
                :compact="false"
              />
            </div>
            <div class="pa-3 pa-md-4 journal-filters">
              <v-row dense>
                <v-col
                  cols="12"
                  md="6"
                >
                  <SearchField
                    :model-value="sourceSearch"
                    label="Источник, узел, фрагмент или ID"
                    :debounce="350"
                    :loading="sourcesLoading"
                    @update:model-value="sourceSearch = $event"
                    @search="reloadSources"
                  />
                </v-col>
                <v-col
                  cols="12"
                  sm="6"
                  md="3"
                >
                  <AppSelect
                    v-model="sourceFragmentId"
                    :items="lookups.fragments"
                    item-title="name"
                    item-value="id"
                    label="Фрагмент схемы"
                  />
                </v-col>
                <v-col
                  cols="12"
                  sm="6"
                  md="3"
                >
                  <AppSelect
                    v-model="sourceReadiness"
                    :items="readinessOptions"
                    item-title="title"
                    item-value="value"
                    label="Готовность"
                  />
                </v-col>
              </v-row>
            </div>
            <v-divider />
            <div class="table-wrap">
              <StateView
                variant="table"
                :rows="10"
                :loading="sourcesLoading && !sources.length"
                :error="sourcesError"
                :empty="!sourcesLoading && !sources.length"
                empty-title="Источники не найдены"
                :empty-text="sourceFiltersActive ? 'Измените фильтры: по выбранным условиям источников нет' : 'В базе нет источников тепла'"
                empty-icon="mdi-factory"
                :action-label="sourceFiltersActive ? 'Сбросить фильтры' : undefined"
                error-title="Не удалось загрузить источники"
                :retrying="sourcesLoading"
                @retry="loadSources"
                @action="resetSourceFilters"
              >
                <v-progress-linear
                  v-if="sourcesLoading"
                  indeterminate
                  color="primary"
                />
                <DataTable
                  :columns="sourceColumns"
                  :items="(sources as Record<string, unknown>[])"
                  item-key="id"
                  selectable
                  density="compact"
                  class="source-table"
                  @select="openSource(Number($event.id))"
                >
                  <template #[`item.fragment_name`]="{ item }">
                    <div class="text-truncate">
                      {{ item.fragment_name || '—' }}
                    </div>
                  </template>
                  <template #[`item.has_source_parameters`]="{ item }">
                    <v-icon
                      size="20"
                      :color="item.has_source_parameters ? 'success' : 'grey-lighten-1'"
                      :aria-label="item.has_source_parameters ? 'есть' : 'нет'"
                    >
                      {{ item.has_source_parameters ? 'mdi-check-circle' : 'mdi-minus-circle-outline' }}
                    </v-icon>
                  </template>
                  <template #[`item.has_month_parameters`]="{ item }">
                    <v-icon
                      size="20"
                      :color="item.has_month_parameters ? 'success' : 'grey-lighten-1'"
                      :aria-label="item.has_month_parameters ? 'есть' : 'нет'"
                    >
                      {{ item.has_month_parameters ? 'mdi-check-circle' : 'mdi-minus-circle-outline' }}
                    </v-icon>
                  </template>
                  <template #[`item.has_filling_parameters`]="{ item }">
                    <v-icon
                      size="20"
                      :color="(item.has_filling_parameters || item.has_harness) ? 'success' : 'grey-lighten-1'"
                      :aria-label="(item.has_filling_parameters || item.has_harness) ? 'есть' : 'нет'"
                    >
                      {{ (item.has_filling_parameters || item.has_harness) ? 'mdi-check-circle' : 'mdi-minus-circle-outline' }}
                    </v-icon>
                  </template>
                  <template #[`item.ready_to_calculate`]="{ item }">
                    <v-chip
                      size="x-small"
                      variant="tonal"
                      :color="item.ready_to_calculate ? 'success' : 'warning'"
                    >
                      {{ item.ready_to_calculate ? 'готов' : 'неполные данные' }}
                    </v-chip>
                  </template>
                  <template #[`item.actions`]="{ item }">
                    <HintTip
                      v-if="hasCoordinates(item)"
                      text="Показать источник на карте"
                      hint="Журнал закроется, маркер останется"
                    >
                      <template #default="{ props: tip }">
                        <v-btn
                          v-bind="tip"
                          icon="mdi-crosshairs-gps"
                          size="x-small"
                          variant="text"
                          color="primary"
                          aria-label="Показать источник на карте"
                          @click.stop="locateSource(item)"
                        />
                      </template>
                    </HintTip>
                    <HintTip text="Открыть карточку источника">
                      <template #default="{ props: tip }">
                        <v-btn
                          v-bind="tip"
                          icon="mdi-chevron-right"
                          size="x-small"
                          variant="text"
                          aria-label="Открыть карточку источника"
                          @click.stop="openSource(Number(item.id))"
                        />
                      </template>
                    </HintTip>
                  </template>
                </DataTable>
              </StateView>
            </div>
            <v-divider />
            <div class="d-flex align-center px-4 py-2">
              <span class="text-caption text-medium-emphasis">Страница {{ sourcePage }}{{ sourcePages ? ` из ${sourcePages}` : '' }}</span>
              <v-spacer />
              <v-pagination
                v-if="sourcePages > 1"
                v-model="sourcePage"
                :length="sourcePages"
                :total-visible="isMobile ? 3 : 7"
                density="compact"
              />
            </div>
          </v-window-item>

          <v-window-item
            value="norm"
            class="journal-pane"
          >
            <HeatLossNormPanel
              ref="normPanelRef"
              :seasons="allSeasons"
              :fragments="lookups.fragments"
              @locate="locateSection"
            />
          </v-window-item>
        </v-window>
      </v-card>
    </v-dialog>

    <v-dialog
      v-model="detailsVisible"
      :persistent="saving"
      :fullscreen="isMobile"
      max-width="1180"
      scrollable
    >
      <v-card :rounded="isMobile ? 0 : 'lg'">
        <v-card-title class="d-flex align-center ga-3 px-4 py-3">
          <v-icon color="deep-orange-darken-3">
            {{ sourceDetails ? 'mdi-factory' : 'mdi-calendar-range' }}
          </v-icon>
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
            @click="detailsVisible = false"
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
            :empty="!detailLoading && !detailError && !seasonDetails && !sourceDetails"
            empty-title="Карточка не выбрана"
            :retry="false"
          >
            <template v-if="seasonDetails">
              <JournalDetailFields
                :groups="seasonGroups"
                :model="editFields"
                :editable="editable"
                :is-field-dirty="isFieldDirty"
                :open-panels="[0]"
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
              <div class="text-subtitle-2 font-weight-bold mt-4 mb-2">
                Климатические параметры по месяцам
              </div>
              <DataTable
                :columns="climateColumns"
                :items="(seasonDetails.climate || []) as Record<string, unknown>[]"
                item-key="id"
                density="compact"
                class="detail-table"
                no-data-text="Климатических параметров нет"
              >
                <template #[`item.month`]="{ item }">
                  {{ item.month || item.m }}
                </template>
                <template #[`item.tn`]="{ item }">
                  {{ formatNumber(item.tn, ' °C') }}
                </template>
                <template #[`item.tpod`]="{ item }">
                  {{ formatNumber(item.tpod, ' °C') }}
                </template>
                <template #[`item.tgr`]="{ item }">
                  {{ formatNumber(item.tgr, ' °C') }}
                </template>
              </DataTable>
            </template>

            <template v-else-if="sourceDetails">
              <div class="status-row mb-4">
                <v-chip
                  variant="tonal"
                  :color="sourceDetails.ready_to_calculate ? 'success' : 'warning'"
                >
                  {{ sourceDetails.ready_to_calculate ? 'Готов к расчёту' : 'Исходные данные неполные' }}
                </v-chip>
                <v-chip
                  variant="outlined"
                  :color="sourceDetails.has_source_parameters ? 'success' : 'grey'"
                >
                  Общие параметры
                </v-chip>
                <v-chip
                  variant="outlined"
                  :color="sourceDetails.has_month_parameters ? 'success' : 'grey'"
                >
                  Месячные параметры
                </v-chip>
                <v-chip
                  variant="outlined"
                  :color="sourceDetails.has_filling_parameters || sourceDetails.has_harness ? 'success' : 'grey'"
                >
                  Заполнение / обвязка
                </v-chip>
              </div>
              <JournalDetailFields
                :groups="sourceGroups"
                :model="{}"
                :editable="() => false"
                :is-field-dirty="() => false"
                :open-panels="[0]"
              />
              <div class="text-subtitle-2 font-weight-bold mt-4 mb-2">
                Рабочие и температурные параметры
              </div>
              <DataTable
                :columns="monthColumns"
                :items="(sourceDetails.months || []) as Record<string, unknown>[]"
                item-key="id"
                density="compact"
                class="detail-table months-table"
                no-data-text="Месячных параметров нет"
              >
                <template #[`item.month`]="{ item }">
                  {{ item.month || item.m }}
                </template>
                <template #[`item.sezon`]="{ item }">
                  {{ seasonName(item.sezon) }}
                </template>
              </DataTable>
            </template>
          </StateView>
        </v-card-text>

        <v-divider />
        <v-card-actions class="px-4 py-3 flex-wrap ga-2">
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
              @click="saveSeason"
            >
              Сохранить
            </v-btn>
          </template>
          <template v-else>
            <HintTip
              v-if="sourceDetails && authStore.canRunWritingCalc && sourceDetails.fragment_id"
              text="Расчёт sety -tg"
              hint="Гидравлико-тепловой расчёт фрагмента с -tg (не модуль «Теплопотери»); пишет результаты в базу"
            >
              <template #default="{ props: tip }">
                <v-btn
                  v-bind="tip"
                  color="primary"
                  variant="tonal"
                  prepend-icon="mdi-play"
                  :loading="runningHeatLoss"
                  @click="runHeatLossForSource"
                >
                  Расчёт sety -tg
                </v-btn>
              </template>
            </HintTip>
            <v-btn
              v-if="sourceDetails && hasCoordinates(sourceDetails)"
              color="primary"
              variant="tonal"
              prepend-icon="mdi-crosshairs-gps"
              @click="locateSource(sourceDetails)"
            >
              На карте
            </v-btn>
            <v-btn
              v-if="mutationsEnabled && seasonDetails"
              color="primary"
              variant="tonal"
              @click="startEdit"
            >
              Редактировать
            </v-btn>
            <v-btn
              variant="text"
              @click="detailsVisible = false"
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
import HeatLossNormPanel from '~/components/HeatLossNormPanel.vue'
import HintTip from '~/components/HintTip.vue'
import JournalDetailFields, { type JournalDetailField, type JournalDetailGroup } from '~/components/JournalDetailFields.vue'
import KpiTile from '~/components/KpiTile.vue'
import SearchField from '~/components/SearchField.vue'
import SegmentedToggle, { type SegmentedToggleItem } from '~/components/SegmentedToggle.vue'
import StateView from '~/components/StateView.vue'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useEquipmentSaveError } from '~/composables/useEquipmentSaveError'
import { useJournalEdit, type JournalEditSource } from '~/composables/useJournalEdit'
import { useMobile } from '~/composables/useMobile'
import { useMutationsEnabled } from '~/composables/useMutationsEnabled'
import { useAuthStore } from '~/stores/authStore'
import { useNotificationStore } from '~/stores/notificationStore'
import { formatApiError } from '~/utils/apiError'
import { hasLonLat } from '~/utils/journalFields'
import {
  fastApiService,
  type HeatLossLookups,
  type HeatLossSeasonDetails,
  type HeatLossSeasonSummary,
  type HeatLossSourceDetails,
  type HeatLossSourceSummary
} from '~/services/fastApiService'

/**
 * Тепловые потери — журнал (docs/ui-modernization-progress.md, этап 5): отопительные сезоны, источники и их
 * готовность к расчёту (плитки — фильтр), нормативный расчёт (`HeatLossNormPanel`). Списки — `DataTable` с
 * серверной пагинацией, `SearchField` / `AppSelect`, `StateView`. Сезон правится на общем `useJournalEdit`
 * (черновик, «изменено», отмена с подтверждением); в `heatlosesmain` уходят только изменённые поля.
 */
type HeatLossTab = 'seasons' | 'sources' | 'norm'
type Readiness = 'ready' | 'incomplete'
type LocatePayload = { longitude: number; latitude: number; id: number; nodeId: number; label: string }

const emit = defineEmits<{ 'locate-heat-source': [payload: LocatePayload] }>()
const { isMobile } = useMobile()
const mutationsEnabled = useMutationsEnabled()
/** Запуск расчёта пишет в БД: роль calculator+ и MUTATIONS_ENABLED на сервере */
const authStore = useAuthStore()
const notifications = useNotificationStore()
const { saveError, clearSaveError, reportSaveError } = useEquipmentSaveError()

const visible = ref(false)
const activeTab = ref<HeatLossTab>('seasons')
const tabItems: SegmentedToggleItem<HeatLossTab>[] = [
  { value: 'seasons', label: 'Сезоны', icon: 'mdi-calendar-range', hint: 'Отопительные сезоны и климат' },
  { value: 'sources', label: 'Источники', icon: 'mdi-factory', hint: 'Источники и готовность исходных данных' },
  { value: 'norm', label: 'Нормативный расчёт', icon: 'mdi-calculator-variant-outline' }
]
const lookups = ref<HeatLossLookups>({ fragments: [], cities: [], source_counts: {}, season_counts: {}, result_availability: { calculation_count: 0, heat_loss_row_count: 0 } })
const lookupsLoaded = ref(false)
const pageSize = 50

const seasons = ref<HeatLossSeasonSummary[]>([])
const seasonsLoading = ref(false)
const seasonsError = ref('')
const seasonPage = ref(1)
const seasonPages = ref(0)
const seasonSearch = ref('')
const seasonCity = ref<string | undefined>()

const sources = ref<HeatLossSourceSummary[]>([])
const sourcesLoading = ref(false)
const sourcesError = ref('')
const sourcePage = ref(1)
const sourcePages = ref(0)
const sourceSearch = ref('')
const sourceFragmentId = ref<number | undefined>()
const sourceReadiness = ref<Readiness | undefined>()
const readinessOptions = [{ title: 'Готовы к расчёту', value: 'ready' }, { title: 'Неполные данные', value: 'incomplete' }]

const normPanelRef = ref<{ init: () => Promise<void> } | null>(null)
const allSeasons = ref<HeatLossSeasonSummary[]>([])

const detailsVisible = ref(false)
const detailLoading = ref(false)
const detailError = ref('')
const seasonDetails = ref<HeatLossSeasonDetails | null>(null)
const sourceDetails = ref<HeatLossSourceDetails | null>(null)
const runningHeatLoss = ref(false)
const exportingSeasons = ref(false)

const seasonColumns: DataTableColumn[] = [
  { key: 'id', title: 'ID', type: 'number', width: 70, sortable: false },
  { key: 'd1', title: 'Период', width: 210, sortable: false },
  { key: 'city', title: 'Город', width: 140, sortable: false },
  { key: 't_ot', title: 't отопл.', type: 'number', width: 100, sortable: false },
  { key: 't_vent', title: 't вент.', type: 'number', width: 100, sortable: false },
  { key: 'a', title: 'Потери воды, %', type: 'number', width: 130, sortable: false },
  { key: 'volwaterhs', title: 'Объёмы систем', sortable: false },
  { key: 'is_current', title: 'Статус', width: 100, sortable: false }
]
const sourceColumns: DataTableColumn[] = [
  { key: 'id', title: 'ID', type: 'number', width: 70, sortable: false },
  { key: 'name', title: 'Источник', sortable: false },
  { key: 'fragment_name', title: 'Фрагмент', width: 260, sortable: false },
  { key: 'node_id', title: 'Узел', type: 'number', width: 90, sortable: false },
  { key: 'has_source_parameters', title: 'Общие', width: 80, align: 'center', sortable: false },
  { key: 'has_month_parameters', title: 'Месяцы', width: 80, align: 'center', sortable: false },
  { key: 'has_filling_parameters', title: 'Заполнение / обвязка', width: 150, align: 'center', sortable: false },
  { key: 'ready_to_calculate', title: 'Готовность', width: 140, sortable: false },
  { key: 'actions', title: '', type: 'actions', width: 88, sortable: false }
]
const climateColumns: DataTableColumn[] = [
  { key: 'r', title: '№', type: 'number', width: 60, sortable: false },
  { key: 'month', title: 'Месяц', sortable: false },
  { key: 'tn', title: 'Наружный воздух', type: 'number', sortable: false },
  { key: 'tpod', title: 'Подвал', type: 'number', sortable: false },
  { key: 'tgr', title: 'Грунт', type: 'number', sortable: false }
]
const monthColumns: DataTableColumn[] = [
  { key: 'r', title: '№', type: 'number', width: 50, sortable: false },
  { key: 'month', title: 'Месяц', sortable: false },
  { key: 'sezon', title: 'Сезон', sortable: false },
  { key: 'workcount', title: 'Дней', type: 'number', sortable: false },
  { key: 'tn', title: 'tн', type: 'number', sortable: false },
  { key: 'tpod', title: 'tпод', type: 'number', sortable: false },
  { key: 'tgr', title: 'tгр', type: 'number', sortable: false },
  { key: 'tx', title: 'tхв', type: 'number', sortable: false },
  { key: 'tgp', title: 't1', type: 'number', sortable: false },
  { key: 'tgo', title: 't2', type: 'number', sortable: false }
]

const seasonFiltersActive = computed(() => Boolean(seasonSearch.value.trim() || seasonCity.value))
const sourceFiltersActive = computed(() => Boolean(sourceSearch.value.trim() || sourceFragmentId.value || sourceReadiness.value))
const incompleteCount = computed(() => Math.max(0, Number(lookups.value.source_counts.total || 0) - Number(lookups.value.source_counts.ready || 0)))

const formatDate = (value: unknown) => {
  if (!value) return '—'
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('ru-RU').format(date)
}
const formatNumber = (value: unknown, suffix = '') => (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))
  ? '—'
  : `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(value))}${suffix}`)
const valueOf = (record: Record<string, unknown> | null | undefined, key: string): string | number | null => {
  const value = record?.[key]
  return typeof value === 'string' || typeof value === 'number' ? value : null
}
const seasonName = (value: unknown) => (Number(value) === 1 ? 'отопительный' : Number(value) === 2 ? 'летний' : String(value ?? '—'))
const hasCoordinates = (item: object) => hasLonLat(item as Record<string, unknown>)

/** Правятся колонки heatlosesmain (как в прежней карточке); даты — `type="date"` */
const SEASON_COLUMNS: Array<{ key: string; label: string; type: 'date' | 'text' | 'number'; units?: string }> = [
  { key: 'd1', label: 'Начало сезона', type: 'date' },
  { key: 'd2', label: 'Конец сезона', type: 'date' },
  { key: 'city', label: 'Город', type: 'text' },
  { key: 't_ot', label: 'Расчётная t отопления', type: 'number', units: '°C' },
  { key: 't_vent', label: 'Расчётная t вентиляции', type: 'number', units: '°C' },
  { key: 'a', label: 'Норма потерь воды', type: 'number' },
  { key: 'tankbattery_q', label: 'Аккумуляторные баки', type: 'number' },
  { key: 'volwaterhs', label: 'Объём отопления', type: 'number' },
  { key: 'volwatervs', label: 'Объём вентиляции', type: 'number' },
  { key: 'volwateropengvs', label: 'Объём открытого ГВС', type: 'number' }
]
const SEASON_KEYS = SEASON_COLUMNS.map(column => column.key)
const editSource: JournalEditSource = {
  schema: computed(() => ({ fields: Object.fromEntries(SEASON_KEYS.map(key => [key, true])) })),
  isWritable: (key?: string | null) => Boolean(key && SEASON_KEYS.includes(key)),
  // колонки известны заранее — загрузки нет, но useJournalEdit ждёт признак «есть»
  loadSchema: async () => true
}
const {
  isEditing, saving, editFields, flashId, isDirty, isFieldDirty, editable, setEditField,
  beginEdit, resetEdit, cancel, closeKeepingDraft, markSaved
} = useJournalEdit('heat-loss-seasons', editSource, seasonDetails, {
  toForm: record => Object.fromEntries(SEASON_KEYS.map(key => [key, record[key] ?? null])),
  dateKeys: ['d1', 'd2']
})

const seasonGroups = computed((): JournalDetailGroup[] => {
  const item = seasonDetails.value
  if (!item) return []
  const fields: JournalDetailField[] = SEASON_COLUMNS.map(column => {
    const raw = item[column.key]
    const shown = column.type === 'date' ? formatDate(raw) : column.type === 'number' ? formatNumber(raw) : String(raw ?? '—')
    return { label: column.label, value: shown, rawValue: raw, key: column.key, type: column.type, units: column.units }
  })
  return [{ title: 'Параметры сезона', fields }]
})

const sourceGroups = computed((): JournalDetailGroup[] => {
  const item = sourceDetails.value
  if (!item) return []
  const entries: Array<[string, unknown]> = [
    ['Источник', item.name], ['Фрагмент', item.fragment_name], ['Узел схемы', item.node_id],
    ['Год расчёта', valueOf(item.attributes, 'heatloscalcyear')],
    ['Ёмкость сети, %', valueOf(item.source_parameters, 't_percent')],
    ['Весенняя опрессовка, %', valueOf(item.source_parameters, 'spring_pressing')],
    ['Осенняя опрессовка, %', valueOf(item.source_parameters, 'autumn_pressing')]
  ]
  return [{ title: 'Паспорт источника', fields: entries.map(([label, value]) => ({ label, value: String(value ?? '—'), rawValue: value, type: 'text' })) }]
})

const detailTitle = computed(() => (seasonDetails.value
  ? `Сезон №${seasonDetails.value.id}`
  : sourceDetails.value ? `${sourceDetails.value.name} · источник №${sourceDetails.value.id}` : 'Карточка'))
const detailSubtitle = computed(() => {
  if (seasonDetails.value) return `${formatDate(seasonDetails.value.d1)} — ${formatDate(seasonDetails.value.d2)} · ${seasonDetails.value.city || 'город не указан'}`
  if (sourceDetails.value) return `${sourceDetails.value.fragment_name || 'без фрагмента'} · узел ${sourceDetails.value.node_id}`
  return ''
})

const loadLookups = async () => {
  if (lookupsLoaded.value) return
  lookups.value = await fastApiService.getHeatLossLookups()
  lookupsLoaded.value = true
}

/** Номера последних запросов списков: ответ более раннего запроса не перекрывает поздний */
let seasonRequest = 0
const loadSeasons = async () => {
  const request = ++seasonRequest
  seasonsLoading.value = true
  seasonsError.value = ''
  try {
    const response = await fastApiService.getHeatLossSeasons({
      search: seasonSearch.value.trim() || undefined, city: seasonCity.value, page: seasonPage.value, page_size: pageSize
    })
    if (request !== seasonRequest) return
    seasons.value = response.items
    seasonPages.value = response.pages
  } catch (cause) {
    if (request !== seasonRequest) return
    seasonsError.value = formatApiError(cause, 'Не удалось загрузить сезоны')
  } finally {
    if (request === seasonRequest) seasonsLoading.value = false
  }
}
let sourceRequest = 0
const loadSources = async () => {
  const request = ++sourceRequest
  sourcesLoading.value = true
  sourcesError.value = ''
  try {
    const response = await fastApiService.getHeatLossSources({
      search: sourceSearch.value.trim() || undefined, fragment_id: sourceFragmentId.value, readiness: sourceReadiness.value,
      page: sourcePage.value, page_size: pageSize
    })
    if (request !== sourceRequest) return
    sources.value = response.items
    sourcePages.value = response.pages
  } catch (cause) {
    if (request !== sourceRequest) return
    sourcesError.value = formatApiError(cause, 'Не удалось загрузить источники')
  } finally {
    if (request === sourceRequest) sourcesLoading.value = false
  }
}
const loadNorm = async () => {
  try {
    if (!allSeasons.value.length) allSeasons.value = (await fastApiService.getHeatLossSeasons({ page: 1, page_size: 200 })).items
  } catch (cause) {
    notifications.showWarning(formatApiError(cause, 'Сезоны не загрузились — выбор сезона в нормативном расчёте пуст'))
  }
  await nextTick()
  await normPanelRef.value?.init()
}
const loadTab = (tab: HeatLossTab) => (tab === 'seasons' ? loadSeasons() : tab === 'sources' ? loadSources() : loadNorm())

const reloadSeasons = () => {
  if (!visible.value) return
  seasonPage.value = 1
  void loadSeasons()
}
const reloadSources = () => {
  if (!visible.value) return
  sourcePage.value = 1
  void loadSources()
}
const resetSeasonFilters = () => {
  seasonSearch.value = ''
  seasonCity.value = undefined
  reloadSeasons()
}
const resetSourceFilters = () => {
  sourceSearch.value = ''
  sourceFragmentId.value = undefined
  sourceReadiness.value = undefined
  reloadSources()
}
const toggleReadiness = (value: Readiness) => {
  sourceReadiness.value = sourceReadiness.value === value ? undefined : value
}

/** openDialog ставит раздел сам и грузит его один раз — наблюдатели в это время молчат */
let applyingScope = false
watch(activeTab, (tab) => { if (visible.value && !applyingScope) void loadTab(tab) })
watch(seasonCity, () => { if (!applyingScope) reloadSeasons() })
watch([sourceFragmentId, sourceReadiness], () => { if (!applyingScope) reloadSources() })
watch(seasonPage, () => { if (visible.value && !applyingScope) void loadSeasons() })
watch(sourcePage, () => { if (visible.value && !applyingScope) void loadSources() })

/** Номер последнего запроса карточки: ответ более раннего запроса не перекрывает поздний */
let detailRequest = 0
const openCard = async <T>(load: () => Promise<T>, apply: (record: T) => void, failText: string) => {
  // открытие другой карточки во время правки — черновик сезона остаётся, карточка на просмотр
  closeKeepingDraft()
  resetEdit()
  clearSaveError()
  const request = ++detailRequest
  seasonDetails.value = null
  sourceDetails.value = null
  detailsVisible.value = true
  detailLoading.value = true
  detailError.value = ''
  try {
    const record = await load()
    if (request !== detailRequest) return
    apply(record)
  } catch (cause) {
    if (request !== detailRequest) return
    detailError.value = formatApiError(cause, failText)
  } finally {
    if (request === detailRequest) detailLoading.value = false
  }
}
const openSeason = (id: number) => openCard(() => fastApiService.getHeatLossSeason(id), (record) => { seasonDetails.value = record }, 'Не удалось открыть сезон')
const openSource = (id: number) => openCard(() => fastApiService.getHeatLossSource(id), (record) => { sourceDetails.value = record }, 'Не удалось открыть источник')

let openDialogSeq = 0
const openDialog = async (scope: { sourceId?: number; seasonId?: number } = {}) => {
  const seq = ++openDialogSeq
  const tab: HeatLossTab = scope.sourceId ? 'sources' : 'seasons'
  applyingScope = true
  activeTab.value = tab
  visible.value = true
  await nextTick()
  applyingScope = false
  // раздел сам показывает свою ошибку; сбой справочника не должен прятать список
  const [lookupsResult] = await Promise.allSettled([loadLookups(), loadTab(tab)])
  if (lookupsResult.status === 'rejected') notifications.showWarning(formatApiError(lookupsResult.reason, 'Справочники не загрузились — плитки и фильтры могут быть неполными'))
  // журнал открыли снова, пока грузились списки — карточку открывает последний вызов
  if (seq !== openDialogSeq) return
  if (scope.sourceId) await openSource(scope.sourceId)
  else if (scope.seasonId) await openSeason(scope.seasonId)
}

const startEdit = async () => {
  clearSaveError()
  await beginEdit()
}
const cancelEdit = async () => {
  const { closed } = await cancel()
  if (closed) clearSaveError()
}
// Карточка закрыта крестиком или Esc во время правки — черновик остаётся до следующего открытия
watch(detailsVisible, (open) => {
  if (!open) closeKeepingDraft()
})

const saveSeason = async () => {
  const id = seasonDetails.value?.id
  if (!id) return
  // только изменённые поля; пустая строка — NULL, как в десктопе
  const changed = Object.fromEntries(Object.entries(editFields.value)
    .filter(([key]) => isFieldDirty(key))
    .map(([key, value]) => [key, value === '' ? null : value]))
  if (!Object.keys(changed).length) return
  saving.value = true
  clearSaveError()
  try {
    await fastApiService.updateObjectAttributes('heatlosesmain', id, changed)
    markSaved(id)
    notifications.showSuccess('Сезон сохранён')
    // сезоны нормативного расчёта перечитаются при следующем открытии раздела
    allSeasons.value = []
    await Promise.all([loadSeasons(), openSeason(id)])
    if (seasonsError.value || detailError.value) notifications.showWarning('Сохранено, но данные не обновились — откройте сезон заново')
  } catch (cause) {
    reportSaveError(cause, () => openSeason(id))
  } finally {
    saving.value = false
  }
}

const downloadSeasonsExcel = async () => {
  exportingSeasons.value = true
  try {
    const { blob, filename } = await fastApiService.downloadExcelReport('heat-loss-seasons')
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename || 'heat_loss_seasons.xlsx'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    notifications.showSuccess('Ведомость сезонов теплопотерь')
  } catch (cause) {
    notifications.showError(formatApiError(cause, 'Не удалось выгрузить Excel'))
  } finally {
    exportingSeasons.value = false
  }
}

const POLL_MS = 2000
const POLL_LIMIT = 180
/** Сколько сбоев запроса статуса подряд терпим: задача на сервере идёт и без нас */
const POLL_ERRORS_MAX = 5
let unmounted = false
onBeforeUnmount(() => { unmounted = true })
const runHeatLossForSource = async () => {
  const src = sourceDetails.value
  if (!src?.fragment_id) return
  runningHeatLoss.value = true
  try {
    const result = await fastApiService.runHeatLosses(Number(src.fragment_id))
    const taskId = result.task_id
    if (!taskId) {
      notifications.showError('Сервер не вернул task_id')
      return
    }
    notifications.showSuccess(`Теплопотери в очереди: ${taskId}`)
    await pollHeatLossTask(taskId, src.id)
  } catch (cause) {
    notifications.showError(formatApiError(cause, 'Не удалось запустить теплопотери'))
  } finally {
    runningHeatLoss.value = false
  }
}

/** Ожидание задачи расчёта: сбой запроса статуса не прекращает ожидание сразу — задача на сервере идёт */
const pollHeatLossTask = async (taskId: string, sourceId: number) => {
  let lastStatus = ''
  let statusErrors = 0
  for (let i = 0; i < POLL_LIMIT && !unmounted; i++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
    let statusResponse: Awaited<ReturnType<typeof fastApiService.getTaskStatus>>
    try {
      statusResponse = await fastApiService.getTaskStatus(taskId)
      statusErrors = 0
    } catch (cause) {
      statusErrors += 1
      if (statusErrors < POLL_ERRORS_MAX) continue
      notifications.showWarning(formatApiError(cause, `Статус расчёта ${taskId} недоступен — расчёт идёт на сервере, проверьте позже`))
      return
    }
    const status = String(statusResponse.status || '')
    if (status && status !== lastStatus) {
      lastStatus = status
      if (status !== 'SUCCESS' && status !== 'FAILURE') notifications.showInfo(`Теплопотери: ${status}`)
    }
    if (status === 'SUCCESS') {
      notifications.showSuccess(statusResponse.result?.message || 'Теплопотери завершены')
      // карточку того же источника обновить, только если она ещё открыта
      if (detailsVisible.value && sourceDetails.value?.id === sourceId) await openSource(sourceId)
      return
    }
    if (status === 'FAILURE') {
      notifications.showError(statusResponse.error || 'Ошибка расчёта теплопотерь')
      return
    }
  }
  if (!unmounted) notifications.showWarning(`Расчёт ${taskId} идёт дольше 6 минут — проверьте результат позже`)
}

const locateSource = (item: Record<string, unknown>) => {
  if (!hasCoordinates(item)) return
  emit('locate-heat-source', {
    longitude: Number(item.longitude), latitude: Number(item.latitude), id: Number(item.id),
    nodeId: Number(item.node_id), label: String(item.name ?? `Источник ${item.id}`)
  })
  detailsVisible.value = false
  visible.value = false
}
const locateSection = (payload: LocatePayload) => {
  emit('locate-heat-source', payload)
  visible.value = false
}

defineExpose({ openDialog })
</script>

<style scoped>
.heat-loss-journal { height: min(92vh, 940px); display: flex; flex-direction: column; }
.journal-window { flex: 1; min-height: 0; }
.journal-window :deep(.v-window__container) { height: 100%; }
.journal-pane { height: 100%; display: flex; flex-direction: column; min-height: 0; }
.journal-kpi { display: flex; flex-wrap: wrap; flex-shrink: 0; gap: var(--space-2); }
.journal-filters { flex-shrink: 0; background: rgba(var(--v-theme-on-surface), 0.02); }
.table-wrap { min-height: 250px; overflow: auto; flex: 1; }
.season-table { min-width: 1000px; }
.source-table { min-width: 1180px; }
.status-row { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.detail-table { border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: var(--radius-2, 8px); overflow: auto; }
.months-table :deep(table) { min-width: 760px; }
@media (max-width: 600px) {
  .heat-loss-journal { height: 100dvh; }
  /* телефон: Excel и «закрыть» — рядом с названием, разделы — строкой ниже */
  .journal-tabs { order: 10; flex-basis: 100%; }
  .journal-kpi { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }
  .journal-kpi > * { flex-shrink: 0; }
}
</style>
