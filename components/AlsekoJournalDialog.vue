<template>
  <Teleport to="body">
    <v-dialog
      v-model="visible"
      :fullscreen="isMobile"
      max-width="1600"
      scrollable
    >
      <v-card
        class="alseko-journal"
        :rounded="isMobile ? 0 : 'lg'"
      >
        <v-card-title class="d-flex align-center ga-3 px-4 py-3">
          <v-avatar
            color="indigo-lighten-5"
            size="40"
          >
            <v-icon color="indigo-darken-2">mdi-office-building-marker</v-icon>
          </v-avatar>
          <div
            class="flex-grow-1"
            style="min-width: 0"
          >
            <div class="text-subtitle-1 font-weight-bold">АЛСЕКО — договорные нагрузки</div>
            <div class="text-caption text-medium-emphasis text-truncate">
              {{ modeTitle }}{{ mode === 'reconciliation' ? '' : ` · найдено ${total.toLocaleString('ru-RU')}` }}
            </div>
          </div>
          <SegmentedToggle
            v-model="mode"
            :items="modeItems"
            aria-label="Режим журнала АЛСЕКО"
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

        <v-card-text
          v-if="mode === 'reconciliation'"
          class="pa-0 alseko-table-wrap"
        >
          <AlsekoReconciliationPanel
            :building-id="bindBuildingId"
            @open-building="openBuilding"
            @open-load="openLoad"
          />
        </v-card-text>

        <template v-else>
          <!-- Плитки из справочника (вся база): связь со зданием и группа — фильтры договорных объектов -->
          <div
            v-if="counts && mode === 'loads'"
            class="alseko-kpi px-3 px-md-4 pt-3"
          >
            <KpiTile
              label="Объектов"
              :value="counts.total"
              :compact="false"
            />
            <KpiTile
              label="Найдено по адресу"
              :value="counts.matched"
              :compact="false"
              status="good"
              selectable
              :active="matchStatus === 'matched'"
              @select="toggleFilter('matchStatus', 'matched')"
            />
            <KpiTile
              label="Не найдено"
              :value="counts.unmatched"
              :compact="false"
              :status="counts.unmatched > 0 ? 'warning' : 'good'"
              selectable
              :active="matchStatus === 'unmatched'"
              @select="toggleFilter('matchStatus', 'unmatched')"
            />
            <KpiTile
              label="МЖД"
              :value="counts.apartment"
              :compact="false"
              selectable
              :active="customerGroup === 'apartment'"
              @select="toggleFilter('customerGroup', 'apartment')"
            />
            <KpiTile
              label="Прочие"
              :value="counts.other"
              :compact="false"
              selectable
              :active="customerGroup === 'other'"
              @select="toggleFilter('customerGroup', 'other')"
            />
          </div>

          <div class="pa-3 pa-md-4 alseko-filters">
            <v-row dense>
              <v-col
                cols="12"
                md="4"
              >
                <SearchField
                  :model-value="search"
                  label="Адрес, договор, владелец, объект"
                  :debounce="350"
                  :loading="loading"
                  @update:model-value="search = $event"
                  @search="onSearch"
                />
              </v-col>
              <template v-if="mode === 'loads'">
                <v-col
                  cols="12"
                  sm="6"
                  md="2"
                >
                  <AppSelect
                    v-model="matchStatus"
                    :items="matchStatuses"
                    item-title="title"
                    item-value="value"
                    label="Связь со зданием"
                  />
                </v-col>
                <v-col
                  cols="12"
                  sm="6"
                  md="2"
                >
                  <AppSelect
                    v-model="customerGroup"
                    :items="customerGroups"
                    item-title="title"
                    item-value="value"
                    label="Группа"
                  />
                </v-col>
                <v-col
                  cols="12"
                  sm="6"
                  md="2"
                >
                  <AppSelect
                    v-model="operationDistrict"
                    :items="lookups.operation_districts"
                    item-title="name"
                    item-value="name"
                    label="Район эксплуатации"
                  />
                </v-col>
                <v-col
                  cols="12"
                  sm="6"
                  md="2"
                >
                  <AppSelect
                    v-model="administrativeDistrict"
                    :items="lookups.administrative_districts"
                    item-title="name"
                    item-value="name"
                    label="Административный район"
                  />
                </v-col>
                <v-col
                  cols="12"
                  sm="6"
                  md="2"
                >
                  <AppSelect
                    v-model="heatSource"
                    :items="lookups.heat_sources"
                    item-title="name"
                    item-value="name"
                    label="Источник"
                  />
                </v-col>
                <v-col
                  cols="12"
                  sm="6"
                  md="2"
                >
                  <AppSelect
                    v-model="temperatureGraph"
                    :items="lookups.temperature_graphs"
                    item-title="name"
                    item-value="name"
                    label="Температурный график"
                  />
                </v-col>
              </template>
            </v-row>

            <div class="d-flex align-center flex-wrap ga-2 mt-3">
              <v-chip
                v-if="scope.buildingId && mode === 'loads'"
                size="small"
                color="primary"
                closable
                @click:close="clearScope"
              >
                Здание {{ scope.buildingId }}
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
                @click="loadItemsPage"
              >
                Обновить
              </v-btn>
            </div>
          </div>

          <v-divider />

          <v-card-text class="pa-0 alseko-table-wrap">
            <StateView
              variant="table"
              :rows="10"
              :loading="loading && !items.length"
              :error="error"
              :empty="!loading && !items.length"
              empty-title="Записи не найдены"
              :empty-text="filtersActive ? 'Измените фильтры или строку поиска' : 'В базе нет записей АЛСЕКО'"
              empty-icon="mdi-database-search"
              :action-label="filtersActive ? 'Сбросить фильтры' : undefined"
              :retrying="loading"
              @retry="loadItemsPage"
              @action="resetFilters"
            >
              <v-progress-linear
                v-if="loading"
                indeterminate
                color="primary"
              />
              <DataTable
                v-if="mode === 'loads'"
                :columns="loadColumns"
                :items="(loadItems as Record<string, unknown>[])"
                item-key="id"
                selectable
                density="compact"
                class="alseko-table"
                @select="openLoad(Number($event.id))"
              >
                <template #[`item.address`]="{ item }">
                  <div class="text-truncate">
                    {{ displayAddress(item) }}
                  </div>
                </template>
                <template #[`item.customer_type`]="{ item }">
                  <div class="text-truncate">
                    {{ item.customer_type || '—' }}
                  </div>
                  <div
                    v-if="item.owner"
                    class="text-caption text-medium-emphasis text-truncate"
                  >
                    {{ item.owner }}
                  </div>
                </template>
                <template #[`item.contract_number`]="{ item }">
                  {{ item.contract_number || '—' }}
                  <div
                    v-if="item.registry_number"
                    class="text-caption text-medium-emphasis"
                  >
                    {{ item.registry_number }}
                  </div>
                </template>
                <template #[`item.operation_district`]="{ item }">
                  {{ item.operation_district || '—' }}
                </template>
                <template #[`item.heat_source`]="{ item }">
                  {{ item.heat_source || '—' }}
                </template>
                <template #[`item.heating_load`]="{ item }">
                  {{ loadValue(item.heating_load) }}
                </template>
                <template #[`item.hot_water_load`]="{ item }">
                  {{ loadValue(item.hot_water_load) }}
                </template>
                <template #[`item.ventilation_load`]="{ item }">
                  {{ loadValue(item.ventilation_load) }}
                </template>
                <template #[`item.steam_load`]="{ item }">
                  {{ loadValue(item.steam_load) }}
                </template>
                <template #[`item.building_match_count`]="{ item }">
                  <v-chip
                    size="x-small"
                    variant="tonal"
                    class="num"
                    :color="item.building_match_count ? 'success' : 'warning'"
                  >
                    {{ item.building_match_count }}
                  </v-chip>
                </template>
              </DataTable>
              <DataTable
                v-else
                :columns="buildingColumns"
                :items="(buildingItems as Record<string, unknown>[])"
                item-key="id"
                selectable
                density="compact"
                class="alseko-table alseko-table--buildings"
                @select="openBuilding(Number($event.id))"
              >
                <template #[`item.address`]="{ item }">
                  <div class="text-truncate">
                    {{ displayAddress(item) }}
                  </div>
                </template>
                <template #[`item.heating_load`]="{ item }">
                  {{ gcalValue(item.heating_load) }}
                </template>
                <template #[`item.hot_water_load`]="{ item }">
                  {{ gcalValue(item.hot_water_load) }}
                </template>
                <template #[`item.ventilation_load`]="{ item }">
                  {{ gcalValue(item.ventilation_load) }}
                </template>
                <template #[`item.steam_load`]="{ item }">
                  {{ gcalValue(item.steam_load) }}
                </template>
                <template #[`item.heating_scheme_id`]="{ item }">
                  {{ item.heating_scheme_id ?? '—' }}
                </template>
                <template #[`item.hot_water_scheme_id`]="{ item }">
                  {{ item.hot_water_scheme_id ?? '—' }}
                </template>
                <template #[`item.actions`]="{ item }">
                  <HintTip
                    v-if="hasCoordinates(item)"
                    text="Показать здание на карте"
                    hint="Журнал закроется, маркер останется"
                  >
                    <template #default="{ props: tip }">
                      <v-btn
                        v-bind="tip"
                        icon="mdi-crosshairs-gps"
                        size="x-small"
                        variant="text"
                        color="primary"
                        aria-label="Показать здание на карте"
                        @click.stop="locate(item, 'building')"
                      />
                    </template>
                  </HintTip>
                  <HintTip
                    v-else
                    text="Карта недоступна"
                    hint="У здания нет координат"
                  >
                    <template #default="{ props: tip }">
                      <v-btn
                        v-bind="tip"
                        icon="mdi-map-marker-off"
                        size="x-small"
                        variant="text"
                        aria-disabled="true"
                        aria-label="У здания нет координат"
                        @click.stop
                      />
                    </template>
                  </HintTip>
                </template>
              </DataTable>
            </StateView>
          </v-card-text>

          <v-divider />
          <v-card-actions class="px-4 py-2">
            <span class="text-caption text-medium-emphasis">Страница {{ page }}{{ pages ? ` из ${pages}` : '' }}</span>
            <v-spacer />
            <v-pagination
              v-if="pages > 1"
              v-model="page"
              :length="pages"
              :total-visible="isMobile ? 3 : 7"
              density="compact"
            />
          </v-card-actions>
        </template>
      </v-card>
    </v-dialog>

    <v-dialog
      v-model="detailsVisible"
      :fullscreen="isMobile"
      max-width="980"
      scrollable
    >
      <v-card :rounded="isMobile ? 0 : 'lg'">
        <v-card-title class="d-flex align-center ga-3 px-4 py-3">
          <v-icon color="indigo-darken-2">{{ selectedKind === 'load' ? 'mdi-file-document-outline' : 'mdi-office-building-outline' }}</v-icon>
          <div
            class="flex-grow-1"
            style="min-width: 0"
          >
            <div class="text-subtitle-1 font-weight-bold text-truncate">
              {{ selected ? (selectedKind === 'load' ? `Объект АЛСЕКО ${selected.id}` : `Здание АЛСЕКО ${selected.id}`) : 'Карточка' }}
            </div>
            <div class="text-caption text-medium-emphasis text-truncate">
              {{ selected ? displayAddress(selected) : '' }}
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
            :loading="detailsLoading"
            :error="detailsError"
            :empty="!detailsLoading && !detailsError && !selected"
            empty-title="Карточка не выбрана"
            :retry="false"
          >
            <template v-if="selected">
              <v-alert
                v-if="selectedKind === 'load' && Number(selected.building_match_count) > 1"
                type="warning"
                variant="tonal"
                density="compact"
                class="mb-3"
              >
                По адресу найдено несколько зданий: {{ selected.building_match_count }}. Связь неоднозначна и требует ручной проверки.
              </v-alert>
              <JournalDetailFields
                :groups="detailGroups"
                :model="EMPTY_MODEL"
                :editable="notEditable"
                :is-field-dirty="notEditable"
                :open-panels="[0, 1, 2]"
              >
                <v-expansion-panel
                  v-for="relation in relationPanels"
                  :key="relation.title"
                  :value="relation.panelIndex"
                >
                  <v-expansion-panel-title>{{ relation.title }} ({{ relation.rows.length }})</v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <v-list
                      density="compact"
                      lines="two"
                    >
                      <v-list-item
                        v-for="row in relation.rows"
                        :key="Number(row.id)"
                        :prepend-icon="relation.kind === 'load' ? 'mdi-file-document-outline' : 'mdi-office-building-outline'"
                        :title="`ID ${row.id} · ${relationTitle(row)}`"
                        :subtitle="String(row.contract_number || row.registry_number || '')"
                        @click="relation.kind === 'load' ? openLoad(Number(row.id)) : openBuilding(Number(row.id))"
                      />
                    </v-list>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </JournalDetailFields>
            </template>
          </StateView>
        </v-card-text>

        <v-divider />
        <v-card-actions class="px-4 py-3">
          <v-spacer />
          <v-btn
            v-if="selected && selectedKind === 'building'"
            variant="tonal"
            prepend-icon="mdi-link-variant"
            @click="bindSelectedBuilding"
          >
            Привязка к адресу
          </v-btn>
          <v-btn
            v-if="selected && hasCoordinates(selected)"
            color="primary"
            variant="tonal"
            prepend-icon="mdi-crosshairs-gps"
            @click="locate(selected, selectedKind)"
          >
            На карте
          </v-btn>
          <v-btn
            variant="text"
            @click="detailsVisible = false"
          >
            Закрыть
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </Teleport>
</template>

<script setup lang="ts">
import AlsekoReconciliationPanel from '~/components/AlsekoReconciliationPanel.vue'
import AppSelect from '~/components/AppSelect.vue'
import DataTable, { type DataTableColumn } from '~/components/DataTable.vue'
import HintTip from '~/components/HintTip.vue'
import JournalDetailFields, { type JournalDetailField, type JournalDetailGroup } from '~/components/JournalDetailFields.vue'
import KpiTile from '~/components/KpiTile.vue'
import SearchField from '~/components/SearchField.vue'
import SegmentedToggle from '~/components/SegmentedToggle.vue'
import StateView from '~/components/StateView.vue'
import { computed, reactive, ref, watch } from 'vue'
import { useMobile } from '~/composables/useMobile'
import { useNotificationStore } from '~/stores/notificationStore'
import { formatApiError } from '~/utils/apiError'
import { hasLonLat } from '~/utils/journalFields'
import {
  fastApiService,
  type AlsekoBuildingDetails,
  type AlsekoBuildingSummary,
  type AlsekoLoadDetails,
  type AlsekoLoadSummary,
  type AlsekoLookups
} from '~/services/fastApiService'

/**
 * АЛСЕКО — договорные нагрузки (docs/ui-modernization-progress.md, этап 5): три режима на `SegmentedToggle`
 * (договорные объекты, здания без потребителя, сверка и привязка), `DataTable` с серверной пагинацией, плитки
 * из справочника (плитка — фильтр), `SearchField` / `AppSelect`, `StateView`. Карточка объекта или здания —
 * `JournalDetailFields` только для чтения с перекрёстными ссылками «здания по адресу» / «договоры по адресу».
 * Правки здесь нет: привязка живёт в панели сверки (предпросмотр → применить).
 */
export interface AlsekoJournalScope { loadId?: number; buildingId?: number }

type AlsekoMode = 'loads' | 'buildings' | 'reconciliation'
type AlsekoKind = 'load' | 'building'

const emit = defineEmits<{
  'locate-alseko': [payload: { longitude: number; latitude: number; id: number; kind: AlsekoKind; label: string }]
}>()
const { isMobile } = useMobile()
const notifications = useNotificationStore()
const visible = ref(false)
const mode = ref<AlsekoMode>('loads')
const modeItems = [
  { value: 'loads', label: 'Договорные объекты', icon: 'mdi-file-document-outline' },
  { value: 'buildings', label: 'Здания без потребителя', icon: 'mdi-office-building-outline' },
  { value: 'reconciliation', label: 'Сверка и привязка', icon: 'mdi-compare-horizontal' }
]
const modeTitle = computed(() => modeItems.find(item => item.value === mode.value)?.label || '')

const loading = ref(false)
const error = ref('')
const loadItems = ref<AlsekoLoadSummary[]>([])
const buildingItems = ref<AlsekoBuildingSummary[]>([])
const items = computed(() => (mode.value === 'loads' ? loadItems.value : buildingItems.value))
const total = ref(0)
const pages = ref(0)
const page = ref(1)
const pageSize = 50
const search = ref('')
const matchStatus = ref<'matched' | 'unmatched' | undefined>()
const customerGroup = ref<'apartment' | 'other' | undefined>()
const operationDistrict = ref<string | undefined>()
const administrativeDistrict = ref<string | undefined>()
const heatSource = ref<string | undefined>()
const temperatureGraph = ref<string | undefined>()
const scope = reactive<AlsekoJournalScope>({})
const lookups = reactive<AlsekoLookups>({ operation_districts: [], administrative_districts: [], heat_sources: [], temperature_graphs: [], counts: [] })
let lookupsLoaded = false
const counts = computed(() => (lookups.counts[0] as Record<string, number> | undefined) || null)
const matchStatuses = [{ title: 'Найдено', value: 'matched' }, { title: 'Не найдено', value: 'unmatched' }]
const customerGroups = [{ title: 'МЖД', value: 'apartment' }, { title: 'Прочие', value: 'other' }]

const detailsVisible = ref(false)
const detailsLoading = ref(false)
const detailsError = ref('')
const selected = ref<AlsekoLoadDetails | AlsekoBuildingDetails | null>(null)
const selectedKind = ref<AlsekoKind>('load')
const bindBuildingId = ref<number | null>(null)

/** Карточка только для чтения: `JournalDetailFields` без правки */
const EMPTY_MODEL: Record<string, never> = {}
const notEditable = () => false

const filtersActive = computed(() => Boolean(
  search.value.trim() || (mode.value === 'loads' && (
    matchStatus.value || customerGroup.value || operationDistrict.value || administrativeDistrict.value || heatSource.value || temperatureGraph.value
  ))
))

const loadColumns: DataTableColumn[] = [
  { key: 'id', title: 'ID', type: 'number', width: 90, sortable: false },
  { key: 'address', title: 'Адрес', sortable: false },
  { key: 'customer_type', title: 'Объект', width: 200, sortable: false },
  { key: 'contract_number', title: 'Договор / реестр', width: 150, sortable: false },
  { key: 'operation_district', title: 'Район', width: 130, sortable: false },
  { key: 'heat_source', title: 'Источник', width: 130, sortable: false },
  { key: 'heating_load', title: 'Отопление, ккал/ч', type: 'number', width: 140, sortable: false },
  { key: 'hot_water_load', title: 'ГВС, ккал/ч', type: 'number', width: 120, sortable: false },
  { key: 'ventilation_load', title: 'Вентиляция, ккал/ч', type: 'number', width: 150, sortable: false },
  { key: 'steam_load', title: 'Пар, ккал/ч', type: 'number', width: 120, sortable: false },
  { key: 'building_match_count', title: 'Здания', type: 'number', width: 90, sortable: false },
]
const buildingColumns: DataTableColumn[] = [
  { key: 'id', title: 'ID', type: 'number', width: 90, sortable: false },
  { key: 'address', title: 'Адрес', sortable: false },
  { key: 'heating_load', title: 'Отопление, Гкал/ч', type: 'number', width: 150, sortable: false },
  { key: 'hot_water_load', title: 'ГВС, Гкал/ч', type: 'number', width: 130, sortable: false },
  { key: 'ventilation_load', title: 'Вентиляция, Гкал/ч', type: 'number', width: 160, sortable: false },
  { key: 'steam_load', title: 'Пар, Гкал/ч', type: 'number', width: 130, sortable: false },
  { key: 'heating_scheme_id', title: 'Схема отопления', type: 'number', width: 140, sortable: false },
  { key: 'hot_water_scheme_id', title: 'Схема ГВС', type: 'number', width: 110, sortable: false },
  { key: 'actions', title: '', type: 'actions', width: 56, sortable: false },
]

// nagruzki (договоры АЛСЕКО) — ккал/ч, zdaniya_2 (здания) — Гкал/ч (сверка делит nagruzki на 1e6)
const gcalValue = (value: unknown) =>
  value === null || value === undefined || value === '' ? '—' : Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 4 })
const loadValue = (value: unknown) =>
  value === null || value === undefined || value === '' ? '—' : Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 2 })
const displayAddress = (row: Record<string, unknown>) =>
  [row.microdistrict, row.street, row.house].filter(Boolean).join(', ') || String(row.source_address || '—')
const hasCoordinates = (row: Record<string, unknown>) => hasLonLat(row)
const relationTitle = (row: Record<string, unknown>) =>
  String(row.customer_type || row.consumer || [row.microdistrict, row.street, row.house].filter(Boolean).join(', ') || 'без наименования')

/** Поля карточки: только заполненные, тип всегда text (правки нет) */
const buildFields = (entries: Array<[string, unknown]>): JournalDetailField[] => entries
  .filter(([, value]) => value !== null && value !== undefined && value !== '' && value !== '—')
  .map(([label, value]) => ({ label, value: String(value), rawValue: value, type: 'text' }))

const detailGroups = computed((): JournalDetailGroup[] => {
  const item = selected.value as Record<string, unknown> | null
  if (!item) return []
  if (selectedKind.value === 'load') {
    return [
      { title: 'Договорный объект', fields: buildFields([
        ['Адрес', displayAddress(item)], ['Адрес источника', item.source_address], ['Вид объекта', item.customer_type],
        ['Владелец', item.owner], ['Договор', item.contract_number], ['Номер в реестре', item.registry_number],
        ['Совпавших зданий', item.building_match_count], ['Назначенных зданий', item.assigned_building_count]
      ]) },
      { title: 'Нагрузки, ккал/ч', fields: buildFields([
        ['Отопление', loadValue(item.heating_load)], ['ГВС', loadValue(item.hot_water_load)], ['Вентиляция', loadValue(item.ventilation_load)],
        ['Пар', loadValue(item.steam_load)], ['Всего', loadValue(item.total_load)]
      ]) },
      { title: 'Эксплуатационная привязка', fields: buildFields([
        ['Административный район', item.administrative_district], ['Район эксплуатации', item.operation_district],
        ['Участок', item.operation_site], ['Источник', item.heat_source], ['Температурный график', item.temperature_graph]
      ]) }
    ].filter(group => group.fields.length)
  }
  return [
    { title: 'Здание', fields: buildFields([
      ['Адрес', displayAddress(item)], ['Потребитель', item.consumer], ['Этажность', item.floor], ['Год постройки', item.construction_year],
      ['Схема отопления', item.heating_scheme_id], ['Схема ГВС', item.hot_water_scheme_id]
    ]) },
    { title: 'Нагрузки, Гкал/ч', fields: buildFields([
      ['Отопление', gcalValue(item.heating_load)], ['ГВС', gcalValue(item.hot_water_load)], ['Вентиляция', gcalValue(item.ventilation_load)],
      ['Пар', gcalValue(item.steam_load)], ['Всего', gcalValue(item.total_load)]
    ]) }
  ].filter(group => group.fields.length)
})

/** Перекрёстные ссылки карточки: здания по адресу договора, договоры по адресу здания */
const relationPanels = computed(() => {
  const relations = (selected.value?.relations || {}) as Record<string, Array<Record<string, unknown>>>
  const base = detailGroups.value.length
  const panels = selectedKind.value === 'load'
    ? [
      { title: 'Здания по адресу', kind: 'building' as AlsekoKind, rows: relations.matched_buildings || [] },
      { title: 'Договоры по этому адресу', kind: 'load' as AlsekoKind, rows: relations.address_loads || [] }
    ]
    : [{ title: 'Договорные объекты по адресу', kind: 'load' as AlsekoKind, rows: relations.matched_loads || [] }]
  return panels.filter(panel => panel.rows.length).map((panel, index) => ({ ...panel, panelIndex: base + index }))
})

const loadLookups = async () => {
  if (lookupsLoaded) return
  Object.assign(lookups, await fastApiService.getAlsekoLookups())
  lookupsLoaded = true
}

/** Номер последнего запроса списка: ответ более раннего запроса не перекрывает поздний */
let listRequest = 0
const loadItemsPage = async () => {
  if (mode.value === 'reconciliation') return
  const request = ++listRequest
  loading.value = true
  error.value = ''
  try {
    if (mode.value === 'loads') {
      const response = await fastApiService.getAlsekoLoads({
        page: page.value, page_size: pageSize, search: search.value.trim() || undefined,
        match_status: matchStatus.value, customer_group: customerGroup.value, operation_district: operationDistrict.value,
        administrative_district: administrativeDistrict.value, heat_source: heatSource.value, temperature_graph: temperatureGraph.value,
        building_id: scope.buildingId
      })
      if (request !== listRequest) return
      loadItems.value = response.items
      total.value = response.total
      pages.value = response.pages
    } else {
      const response = await fastApiService.getUnassignedAlsekoBuildings({ page: page.value, page_size: pageSize, search: search.value.trim() || undefined })
      if (request !== listRequest) return
      buildingItems.value = response.items
      total.value = response.total
      pages.value = response.pages
    }
  } catch (loadError: any) {
    if (request !== listRequest) return
    error.value = formatApiError(loadError, 'Не удалось загрузить АЛСЕКО')
  } finally {
    if (request === listRequest) loading.value = false
  }
}

watch([matchStatus, customerGroup, operationDistrict, administrativeDistrict, heatSource, temperatureGraph], () => {
  if (!visible.value || mode.value !== 'loads') return
  page.value = 1
  void loadItemsPage()
})
watch(page, () => { if (visible.value) void loadItemsPage() })
watch(mode, () => {
  if (!visible.value) return
  page.value = 1
  void loadItemsPage()
})

const onSearch = () => {
  if (!visible.value) return
  page.value = 1
  void loadItemsPage()
}
const toggleFilter = (key: 'matchStatus' | 'customerGroup', value: string) => {
  if (key === 'matchStatus') matchStatus.value = matchStatus.value === value ? undefined : value as 'matched' | 'unmatched'
  else customerGroup.value = customerGroup.value === value ? undefined : value as 'apartment' | 'other'
}
const resetFilters = () => {
  search.value = ''
  matchStatus.value = undefined
  customerGroup.value = undefined
  operationDistrict.value = undefined
  administrativeDistrict.value = undefined
  heatSource.value = undefined
  temperatureGraph.value = undefined
  page.value = 1
  void loadItemsPage()
}
const clearScope = () => {
  scope.buildingId = undefined
  page.value = 1
  void loadItemsPage()
}

/** Номер последнего запроса карточки: ответ более раннего запроса не перекрывает поздний */
let detailsRequest = 0
const openRecord = async (kind: AlsekoKind, id: number) => {
  const request = ++detailsRequest
  selectedKind.value = kind
  detailsVisible.value = true
  detailsLoading.value = true
  detailsError.value = ''
  selected.value = null
  try {
    const record = kind === 'load' ? await fastApiService.getAlsekoLoad(id) : await fastApiService.getAlsekoBuilding(id)
    if (request !== detailsRequest) return
    selected.value = record
  } catch (loadError: any) {
    if (request !== detailsRequest) return
    detailsError.value = formatApiError(loadError, kind === 'load' ? 'Не удалось открыть объект АЛСЕКО' : 'Не удалось открыть здание АЛСЕКО')
  } finally {
    if (request === detailsRequest) detailsLoading.value = false
  }
}
const openLoad = (id: number) => openRecord('load', id)
const openBuilding = (id: number) => openRecord('building', id)

const bindSelectedBuilding = () => {
  if (!selected.value) return
  bindBuildingId.value = Number(selected.value.id)
  detailsVisible.value = false
  mode.value = 'reconciliation'
}

const locate = (row: Record<string, unknown>, kind: AlsekoKind) => {
  if (!hasCoordinates(row)) return
  emit('locate-alseko', {
    longitude: Number(row.longitude), latitude: Number(row.latitude), id: Number(row.id), kind,
    label: `${kind === 'load' ? 'АЛСЕКО' : 'Здание АЛСЕКО'} ${row.id}`
  })
  detailsVisible.value = false
  visible.value = false
}

let openDialogSeq = 0
const openDialog = async (nextScope: AlsekoJournalScope = {}) => {
  const seq = ++openDialogSeq
  Object.assign(scope, { loadId: undefined, buildingId: undefined }, nextScope)
  page.value = 1
  visible.value = true
  // mode через watch перезагрузил бы список — ставим режим до загрузки и грузим один раз сами
  const nextMode: AlsekoMode = nextScope.buildingId ? 'buildings' : 'loads'
  const modeChanged = mode.value !== nextMode
  mode.value = nextMode
  // список сам показывает свою ошибку; сбой справочника не должен прятать список
  const [lookupsResult] = await Promise.allSettled([loadLookups(), modeChanged ? Promise.resolve() : loadItemsPage()])
  if (lookupsResult.status === 'rejected') notifications.showWarning(formatApiError(lookupsResult.reason, 'Справочники не загрузились — плитки и фильтры могут быть неполными'))
  // журнал открыли снова, пока грузились списки — запись открывает последний вызов
  if (seq !== openDialogSeq) return
  if (nextScope.buildingId) await openBuilding(nextScope.buildingId)
  else if (nextScope.loadId) await openLoad(nextScope.loadId)
}
defineExpose({ openDialog })
</script>

<style scoped>
.alseko-journal { height: min(92vh, 940px); display: flex; flex-direction: column; }
.alseko-kpi { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.alseko-filters { flex-shrink: 0; background: rgba(var(--v-theme-on-surface), 0.02); }
.alseko-table-wrap { min-height: 300px; overflow: auto; flex: 1; }
.alseko-table { min-width: 1500px; }
.alseko-table--buildings { min-width: 1100px; }
@media (max-width: 600px) { .alseko-journal { height: 100dvh; } }
</style>
