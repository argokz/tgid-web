<template>
  <Teleport to="body">
    <v-dialog
      v-model="visible"
      :fullscreen="isMobile"
      max-width="1380"
      scrollable
    >
      <v-card
        class="tu-journal"
        :rounded="isMobile ? 0 : 'lg'"
      >
        <v-card-title class="d-flex align-center ga-3 px-4 py-3">
          <v-avatar
            color="cyan-lighten-5"
            size="40"
          >
            <v-icon color="cyan-darken-3">mdi-file-certificate-outline</v-icon>
          </v-avatar>
          <div
            class="flex-grow-1"
            style="min-width: 0"
          >
            <div class="text-subtitle-1 font-weight-bold">Технические условия</div>
            <div class="text-caption text-medium-emphasis text-truncate">
              {{ scopeTitle }} · найдено {{ total }}
            </div>
          </div>
          <HintTip
            text="Подобрать точку подключения"
            hint="Узлы рядом с заявкой, режим по расчёту, рекомендация ИИ"
            location="bottom"
          >
            <template #default="{ props: tip }">
              <v-btn
                v-bind="tip"
                color="secondary"
                variant="tonal"
                prepend-icon="mdi-map-marker-radius"
                class="mr-2"
                @click="connectionVisible = true"
              >
                Точка подключения
              </v-btn>
            </template>
          </HintTip>
          <HintTip
            text="Выгрузить свод ТУ"
            hint="Excel по выбранному году выдачи"
            location="bottom"
          >
            <template #default="{ props: tip }">
              <v-btn
                v-bind="tip"
                color="secondary"
                variant="tonal"
                prepend-icon="mdi-chart-box-outline"
                class="mr-2"
                :loading="loadingBalance"
                @click="downloadBalance"
              >
                Свод
              </v-btn>
            </template>
          </HintTip>
          <v-btn
            v-if="mutationsEnabled"
            color="primary"
            variant="flat"
            prepend-icon="mdi-plus"
            class="mr-2"
            :loading="creating"
            @click="createTechnicalCondition"
          >
            Создать
          </v-btn>
          <HintTip
            text="Закрыть реестр"
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

        <!-- Плитки из ответа списка: всего и по состояниям договора при тех же фильтрах; плитка — фильтр -->
        <div
          v-if="stateTiles.length"
          class="tu-kpi px-3 px-md-4 pt-3"
        >
          <KpiTile
            label="Найдено"
            :value="total"
            :compact="false"
          />
          <KpiTile
            v-for="tile in stateTiles"
            :key="tile.id"
            :label="tile.name"
            :value="tile.count"
            :compact="false"
            :status="tile.status"
            selectable
            :active="stateId === tile.id"
            @select="toggleState(tile.id)"
          />
        </div>

        <div class="pa-3 pa-md-4 tu-filters">
          <v-row dense>
            <v-col
              cols="12"
              md="4"
            >
              <SearchField
                :model-value="search"
                label="Номер, организация, объект, адрес или договор"
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
                v-model="issueYear"
                :items="lookups.years"
                item-title="value"
                item-value="value"
                label="Год выдачи"
              />
            </v-col>
            <v-col
              cols="12"
              sm="6"
              md="4"
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
              md="4"
            >
              <AppSelect
                v-model="district"
                :items="lookups.districts"
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
                v-model="linked"
                :items="linkOptions"
                item-title="title"
                item-value="value"
                label="Привязка"
              />
            </v-col>
            <v-col
              cols="12"
              sm="6"
              md="2"
            >
              <v-text-field
                v-model="dateFrom"
                type="date"
                label="Выдано с"
                density="compact"
                variant="outlined"
                hide-details
              />
            </v-col>
            <v-col
              cols="12"
              sm="6"
              md="2"
            >
              <v-text-field
                v-model="dateTo"
                type="date"
                label="Выдано по"
                density="compact"
                variant="outlined"
                hide-details
              />
            </v-col>
          </v-row>
          <div class="d-flex align-center flex-wrap ga-2 mt-3">
            <v-chip
              v-if="scope.buildingId"
              size="small"
              color="primary"
              closable
              @click:close="clearScope"
            >
              Здание {{ scope.buildingId }}
            </v-chip>
            <v-chip
              v-if="scope.pipeId"
              size="small"
              color="primary"
              closable
              @click:close="clearScope"
            >
              Трубопровод {{ scope.pipeId }}
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
              @click="loadConditions"
            >
              Обновить
            </v-btn>
          </div>
        </div>
        <v-divider />

        <v-card-text class="pa-0 tu-table-wrap">
          <StateView
            variant="table"
            :rows="10"
            :loading="loading && !items.length"
            :error="error"
            :empty="!loading && !items.length"
            empty-title="Технические условия не найдены"
            :empty-text="filtersActive ? 'Измените фильтры: по выбранным условиям записей нет' : 'В реестре пока нет записей'"
            empty-icon="mdi-file-search-outline"
            :action-label="filtersActive ? 'Сбросить фильтры' : undefined"
            :retrying="loading"
            @retry="loadConditions"
            @action="resetFilters"
          >
            <v-progress-linear
              v-if="loading"
              indeterminate
              color="primary"
            />
            <DataTable
              :columns="tableColumns"
              :items="(items as Record<string, unknown>[])"
              item-key="id"
              selectable
              :selected-key="flashId"
              density="compact"
              class="tu-table"
              @select="openDetails(Number($event.id))"
            >
              <template #[`item.number`]="{ item }">
                <strong>{{ item.number || `ТУ ${item.id}` }}</strong>
                <div class="cell-note">
                  {{ formatDate(item.issued_on) }}
                </div>
              </template>
              <template #[`item.state_name`]="{ item }">
                <v-chip
                  size="x-small"
                  :color="stateColor(Number(item.state_id))"
                  variant="tonal"
                >
                  {{ item.state_name || 'Не задано' }}
                </v-chip>
              </template>
              <template #[`item.object_name`]="{ item }">
                <span
                  class="wide-cell"
                  :title="String(item.object_name || '')"
                ><strong>{{ item.object_name || 'Объект не указан' }}</strong></span>
                <div
                  class="cell-note wide-cell"
                  :title="String(item.address || item.building_address || '')"
                >
                  {{ item.address || item.building_address || 'Адрес не указан' }}
                </div>
              </template>
              <template #[`item.organization_name`]="{ item }">
                <span
                  class="wide-cell"
                  :title="String(item.organization_name || '')"
                >{{ item.organization_name || '—' }}</span>
              </template>
              <template #[`item.heat_source_name`]="{ item }">
                {{ item.heat_source_name || '—' }}
                <div class="cell-note">
                  {{ item.district_name || 'Район не указан' }}
                </div>
              </template>
              <template #[`item.total_heat_load`]="{ item }">
                <span class="num">{{ heatLoad(item.total_heat_load) }}</span>
                <div
                  v-if="item.load_increase != null"
                  class="cell-note num"
                >
                  прирост {{ heatLoad(item.load_increase) }}
                </div>
              </template>
              <template #[`item.building_id`]="{ item }">
                <v-icon
                  :color="item.building_link_valid ? 'success' : 'warning'"
                  size="18"
                  :aria-label="item.building_link_valid ? 'Привязка к зданию есть' : 'Ссылка на здание не найдена'"
                >
                  {{ item.building_link_valid ? 'mdi-link-variant' : 'mdi-link-variant-off' }}
                </v-icon>
                <span class="ml-1 num">{{ item.building_id || 'нет' }}</span>
              </template>
              <template #[`item.actions`]="{ item }">
                <HintTip text="Открыть карточку">
                  <template #default="{ props: tip }">
                    <v-btn
                      v-bind="tip"
                      icon="mdi-chevron-right"
                      size="x-small"
                      variant="text"
                      aria-label="Открыть карточку"
                      @click.stop="openDetails(Number(item.id))"
                    />
                  </template>
                </HintTip>
              </template>
            </DataTable>
          </StateView>
        </v-card-text>
        <v-divider />
        <v-card-actions class="px-4 py-2">
          <span class="text-caption text-medium-emphasis">Страница {{ page }} из {{ pages || 1 }}</span>
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

    <v-dialog
      v-model="detailsVisible"
      :fullscreen="isMobile"
      max-width="980"
      scrollable
    >
      <v-card :rounded="isMobile ? 0 : 'lg'">
        <v-card-title class="d-flex align-center ga-3 px-4 py-3">
          <v-avatar
            color="cyan-darken-3"
            size="40"
          >
            <v-icon color="white">mdi-file-certificate-outline</v-icon>
          </v-avatar>
          <div
            class="flex-grow-1"
            style="min-width: 0"
          >
            <div class="text-subtitle-1 font-weight-bold d-flex align-center ga-2">
              <span class="text-truncate">{{ isNew ? 'Новые ТУ' : selectedTitle }}</span>
              <v-chip
                v-if="isEditing && isDirty"
                size="x-small"
                color="accent"
                variant="tonal"
              >
                Не сохранено
              </v-chip>
            </div>
            <div
              v-if="!isNew"
              class="text-caption text-medium-emphasis"
            >
              {{ selected?.state_name || 'Состояние не указано' }}
            </div>
          </div>
          <v-btn
            icon
            variant="text"
            aria-label="Закрыть"
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
            :empty="!detailsLoading && !detailsError && !selected && !isEditing"
            empty-title="Карточка не выбрана"
            :retry="false"
          >
            <template v-if="selected || isEditing">
              <v-alert
                v-if="selected?.building_id && !selected?.building_link_valid"
                type="warning"
                variant="tonal"
                class="mb-4"
              >
                В исходной базе ссылка на здание {{ selected?.building_id }} не найдена. Карточка ТУ доступна, позиционирование на карте — нет.
              </v-alert>
              <JournalDetailFields
                :groups="detailGroups"
                :model="editFields"
                :editable="editable"
                :is-field-dirty="isFieldDirty"
                @update:model="editFields = $event"
              >
                <template v-if="!isEditing">
                  <v-expansion-panel
                    v-if="extensions.length"
                    :value="detailGroups.length"
                  >
                    <v-expansion-panel-title>Изменения и продления ({{ extensions.length }})</v-expansion-panel-title>
                    <v-expansion-panel-text>
                      <v-card
                        v-for="extension in extensions"
                        :key="Number(extension.index)"
                        variant="outlined"
                        class="mb-3 pa-3"
                      >
                        <div class="font-weight-bold">
                          Продление {{ extension.index }} · {{ formatDate(extension.changed_on) }}
                        </div>
                        <div
                          v-if="extension.description"
                          class="text-body-2 mt-2"
                        >
                          {{ extension.description }}
                        </div>
                        <div class="text-caption text-medium-emphasis mt-2 num">
                          Нагрузка: {{ heatLoad(extension.total_heat_load) }} · прирост: {{ heatLoad(extension.load_increase) }}
                        </div>
                        <div
                          v-if="extension.additional_measures"
                          class="text-body-2 mt-2"
                        >
                          {{ extension.additional_measures }}
                        </div>
                      </v-card>
                    </v-expansion-panel-text>
                  </v-expansion-panel>

                  <v-expansion-panel
                    v-if="connections.length"
                    :value="detailGroups.length + 1"
                  >
                    <v-expansion-panel-title>Узлы присоединения ({{ connections.length }})</v-expansion-panel-title>
                    <v-expansion-panel-text>
                      <v-list density="compact">
                        <v-list-item
                          v-for="connection in connections"
                          :key="Number(connection.index)"
                          prepend-icon="mdi-source-branch"
                          :title="String(connection.node || connection.code || `Присоединение ${connection.index}`)"
                          :subtitle="[connection.code && `код ${connection.code}`, connection.load_percent != null && `${connection.load_percent}% нагрузки`].filter(Boolean).join(' · ')"
                        />
                      </v-list>
                    </v-expansion-panel-text>
                  </v-expansion-panel>

                  <v-expansion-panel
                    v-if="documents.length"
                    :value="detailGroups.length + 2"
                  >
                    <v-expansion-panel-title>Документы ({{ documents.length }})</v-expansion-panel-title>
                    <v-expansion-panel-text>
                      <v-list density="compact">
                        <v-list-item
                          v-for="(document, index) in documents"
                          :key="`${document.kind}-${document.index || index}`"
                          prepend-icon="mdi-file-document-outline"
                          :title="documentTitle(document)"
                          :subtitle="fileName(document.path)"
                        />
                      </v-list>
                    </v-expansion-panel-text>
                  </v-expansion-panel>
                </template>
              </JournalDetailFields>
            </template>
          </StateView>
        </v-card-text>
        <v-divider />
        <v-card-actions class="px-4 py-3">
          <v-btn
            v-if="!isEditing && selected && hasCoordinates(selected)"
            prepend-icon="mdi-crosshairs-gps"
            variant="tonal"
            color="primary"
            @click="locateSelected"
          >
            На карте
          </v-btn>
          <v-btn
            v-if="mutationsEnabled && !isEditing && selected"
            variant="text"
            prepend-icon="mdi-pencil"
            @click="startEdit"
          >
            Редактировать
          </v-btn>
          <v-btn
            v-if="mutationsEnabled && !isEditing && selected && !isNew"
            color="error"
            variant="text"
            prepend-icon="mdi-delete"
            :loading="deleting"
            @click="deleteTechnicalCondition(selected.id)"
          >
            Удалить
          </v-btn>
          <v-spacer />
          <template v-if="isEditing">
            <v-btn
              v-if="mutationsEnabled"
              variant="text"
              @click="cancelEdit"
            >
              Отмена
            </v-btn>
            <v-btn
              v-if="mutationsEnabled"
              color="primary"
              variant="flat"
              :loading="saving"
              :disabled="!isNew && !isDirty"
              @click="saveChanges"
            >
              Сохранить
            </v-btn>
          </template>
          <v-btn
            v-else
            variant="text"
            @click="detailsVisible = false"
          >
            Закрыть
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <TuConnectionDialog v-model="connectionVisible" />
  </Teleport>
</template>

<script setup lang="ts">
import AppSelect from '~/components/AppSelect.vue'
import DataTable, { type DataTableColumn } from '~/components/DataTable.vue'
import HintTip from '~/components/HintTip.vue'
import JournalDetailFields, { type JournalDetailField, type JournalDetailGroup } from '~/components/JournalDetailFields.vue'
import KpiTile, { type KpiStatus } from '~/components/KpiTile.vue'
import SearchField from '~/components/SearchField.vue'
import StateView from '~/components/StateView.vue'
import { hasLonLat } from '~/utils/journalFields'
import { useCloseOnMapPick } from '~/composables/useJournalMapBridge'
import { formatApiError, formatApiErrorWith } from '~/utils/apiError'
import { confirmAction } from '~/composables/useConfirm'
import { computed, reactive, ref, watch } from 'vue'
import { useJournalEdit } from '~/composables/useJournalEdit'
import { useMobile } from '~/composables/useMobile'
import TuConnectionDialog from '~/components/ai/TuConnectionDialog.vue'
import { useMutationsEnabled } from '~/composables/useMutationsEnabled'
import { useNotificationStore } from '~/stores/notificationStore'
import { changedColumns, filledColumns, identityColumns } from '~/utils/registryEdit'
import {
  fastApiService,
  type TechnicalConditionDetails,
  type TechnicalConditionLookups,
  type TechnicalConditionSummary
} from '~/services/fastApiService'

/**
 * Реестр технических условий — тип (б) «рабочее место» (docs/ui-modernization-progress.md, этап 5): `DataTable`
 * с серверной пагинацией (тысячи записей), плитки состояний договора из `state_counts`, `SearchField` / `AppSelect`,
 * `StateView`, свод в Excel и подбор точки подключения сохранены; карточка на `JournalDetailFields` +
 * `useJournalEdit`. Запись — через API ТУ по ключам карточки (сервер переводит их в колонки таблицы).
 */
export interface TechnicalConditionJournalScope { buildingId?: number; pipeId?: number; conditionId?: number }
const emit = defineEmits<{
  'locate-technical-condition': [coordinates: { longitude: number; latitude: number; id: number; label: string }]
}>()
const { isMobile } = useMobile()
const mutationsEnabled = useMutationsEnabled()
const visible = ref(false), loading = ref(false), error = ref('')
/** Диалог подбора точки подключения (этап 4 ИИ-плана) */
const connectionVisible = ref(false)
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
/** Счётчики по состояниям из ответа списка; null — API их не отдаёт (плитки скрыты) */
const stateCounts = ref<{ state_id: number | null; count: number }[] | null>(null)
const detailsVisible = ref(false), detailsLoading = ref(false), detailsError = ref('')
// Другой журнал начал выбор участков на карте — закрыть это окно (QA F48)
useCloseOnMapPick(() => visible.value || detailsVisible.value, () => { detailsVisible.value = false; visible.value = false })
const selected = ref<TechnicalConditionDetails | null>(null)
const creating = ref(false)
const deleting = ref(false)
const loadingBalance = ref(false)

const scopeTitle = computed(() => scope.buildingId ? `ТУ здания ${scope.buildingId}` : scope.pipeId ? `ТУ трубопровода ${scope.pipeId}` : 'весь реестр')
const selectedTitle = computed(() => selected.value?.number ? `ТУ № ${selected.value.number}` : `Технические условия ${selected.value?.id || ''}`)
const filtersActive = computed(() => Boolean(
  search.value.trim() || stateId.value || issueYear.value || heatSource.value || district.value
  || linked.value !== undefined || dateFrom.value || dateTo.value,
))

const tableColumns: DataTableColumn[] = [
  { key: 'number', title: '№ ТУ / дата', width: 150, sortable: false },
  { key: 'state_name', title: 'Состояние', width: 130, sortable: false },
  { key: 'object_name', title: 'Объект и адрес', sortable: false },
  { key: 'organization_name', title: 'Организация', width: 220, sortable: false },
  { key: 'heat_source_name', title: 'Источник / район', width: 190, sortable: false },
  { key: 'total_heat_load', title: 'Нагрузка', type: 'number', width: 150, sortable: false },
  { key: 'building_id', title: 'Привязка', width: 110, sortable: false },
  { key: 'actions', title: '', type: 'actions', width: 56, sortable: false },
]

/** Состояние договора → тон плитки: действующие — в порядке, аннулированные — внимание, завершённые — нейтрально */
const STATE_STATUS: Record<number, KpiStatus> = { 1: 'good', 2: 'warning', 3: 'warning', 4: 'none' }
const stateTiles = computed(() => {
  if (!stateCounts.value) return []
  const counts = new Map(stateCounts.value.map((c) => [c.state_id, c.count]))
  return (lookups.states as { id: number; name: string }[]).map((state) => ({
    id: state.id,
    name: state.name,
    count: counts.get(state.id) ?? 0,
    status: STATE_STATUS[state.id] ?? 'none',
  }))
})
const toggleState = (id: number) => {
  stateId.value = stateId.value === id ? undefined : id
}

const formatDate = (value: unknown) => {
  if (!value) return '—'
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[3]}.${match[2]}.${match[1]}` : String(value)
}
const formatValue = (value: unknown) => value === null || value === undefined || value === '' ? '—' : typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? formatDate(value) : String(value)
const heatLoad = (value: unknown) => value === null || value === undefined || value === '' ? '—' : `${Number(value).toLocaleString('ru-RU')} Гкал/ч`
const stateColor = (state: number | null) => state === 1 ? 'success' : state === 4 ? 'info' : state === 2 || state === 3 ? 'warning' : 'grey'
const hasCoordinates = (item: { longitude?: unknown; latitude?: unknown }) => hasLonLat(item)
const fileName = (path: unknown) => String(path || 'Путь не указан').split(/[\\/]/).pop() || 'Файл'
const documentTitle = (document: Record<string, unknown>) => document.kind === 'contract' ? 'Договор' : document.kind === 'admission_act' ? 'Акт допуска' : `Технические условия${document.index ? ` · файл ${document.index}` : ''}`
const buildFields = (entries: Array<[string, unknown, string?, string?, any[]?]>): JournalDetailField[] => {
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
    stateCounts.value = Array.isArray(response.state_counts) ? response.state_counts : null
  } catch (loadError: any) {
    error.value = loadError?.data?.detail || loadError?.message || 'Не удалось загрузить реестр технических условий'
  } finally { loading.value = false }
}
/** Текст после паузы ввода (SearchField) */
const onSearch = () => {
  if (!visible.value) return
  page.value = 1
  void loadConditions()
}
const openDetails = async (id: number) => {
  // карточка существующей записи всегда открывается на просмотр (после неудачного создания
  // флаги isNew/isEditing не должны превращать сохранение в повторный POST)
  isEditing.value = false; isNew.value = false
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

/** Ключи API, которые правит форма (сервер переводит их в колонки tehnicheskie_usloviya) */
const EDITABLE_KEYS = [
  'number', 'issued_on', 'state_id', 'annulled_on', 'organization_name', 'object_name', 'address', 'heat_source_name',
  'district_name', 'connection_chamber', 'validity_period',
  'total_heat_load', 'heating_load', 'ventilation_load', 'hot_water_max_load', 'hot_water_average_load', 'load_increase',
  'heating_load_increase', 'ventilation_load_increase', 'hot_water_max_load_increase', 'hot_water_average_load_increase',
  'network_approval_number', 'network_approval_date', 'heating_approval_number', 'heating_approval_date',
  'project_approval_number', 'project_approval_date', 'additional_measures', 'measures_completion', 'construction_stage',
  'admission_act_number', 'admission_act_date', 'admitted_total_heat_load', 'admitted_heating_load',
  'admitted_ventilation_load', 'admitted_hot_water_max_load', 'admitted_hot_water_average_load', 'contract_number', 'contract_date',
  'building_id', 'pipe_id',
] as const
const EDITABLE_COLUMNS = identityColumns([...EDITABLE_KEYS])
const editSource = {
  schema: computed(() => ({ fields: EDITABLE_COLUMNS as Record<string, unknown> })),
  isWritable: (key?: string | null) => Boolean(key && key in EDITABLE_COLUMNS),
  loadSchema: async () => null,
}
const {
  isEditing, isNew, saving, editFields, flashId, isDirty, isFieldDirty, editable,
  beginCreate, beginEdit, cancel, closeKeepingDraft, markSaved, forgetDraft,
} = useJournalEdit('technical-conditions', editSource, selected)

/** Справочник названий (источник, район) для AppSelect с item-value="id" */
const nameItems = (items: Array<{ name: string }>) => items.map(entry => ({ id: entry.name, name: entry.name }))
const detailGroups = computed((): JournalDetailGroup[] => {
  const item = isEditing.value ? editFields.value : selected.value
  if (!item && !isNew.value) return []
  return [
    { title: 'Основные сведения', fields: buildFields([
      ['Номер ТУ', item?.number, 'number', 'text'], ['Дата выдачи', item?.issued_on, 'issued_on', 'date'], ['Состояние', item?.state_name, 'state_id', 'select', lookups.states], ['Дата аннулирования', item?.annulled_on, 'annulled_on', 'date'],
      ['Организация-заявитель', item?.organization_name, 'organization_name', 'text'], ['Объект', item?.object_name, 'object_name', 'text'], ['Адрес', item?.address, 'address', 'textarea'], ['Источник', item?.heat_source_name, 'heat_source_name', 'select', nameItems(lookups.heat_sources)],
      ['Район эксплуатации', item?.district_name, 'district_name', 'select', nameItems(lookups.districts)], ['Камера', item?.connection_chamber, 'connection_chamber', 'text'], ['Срок действия', item?.validity_period, 'validity_period', 'text']
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
      ['Здание', item?.building_id, 'building_id', 'number'], ['Адрес здания', item?.building_address], ['Город', item?.building_city], ['Микрорайон', item?.building_microdistrict],
      ['Улица', item?.building_street], ['Дом', item?.building_house], ['Код узла присоединения', item?.building_connection_code],
      ['Узел присоединения', item?.building_connection_node], ['Трубопровод', item?.pipe_id, 'pipe_id', 'number'], ['Комментарий', item?.building_note]
    ]) }
  ].filter(group => group.fields.length)
})
const extensions = computed(() => selected.value?.relations?.extensions || [])
const documents = computed(() => selected.value?.relations?.documents || [])
const connections = computed(() => selected.value?.relations?.connections || [])

const startEdit = () => beginEdit()

const cancelEdit = async () => {
  if (!(await cancel())) return
  if (isNew.value) detailsVisible.value = false
}

// Карточка закрыта крестиком или Esc во время правки — черновик остаётся до следующего открытия
watch(detailsVisible, (open) => {
  if (!open) closeKeepingDraft()
})

const createTechnicalCondition = async () => {
  creating.value = true
  await loadLookups()
  creating.value = false
  selected.value = null
  detailsError.value = ''
  detailsVisible.value = true
  await beginCreate({})
}

const notifications = useNotificationStore()

const saveChanges = async () => {
  saving.value = true
  try {
    if (isNew.value) {
      const fields = filledColumns(editFields.value, EDITABLE_COLUMNS)
      if (!Object.keys(fields).length) {
        notifications.showError('Заполните хотя бы одно поле ТУ')
        return
      }
      const result = await fastApiService.createTechnicalCondition(fields)
      if (result?.id) {
        notifications.showSuccess(`ТУ ${result.id} созданы`)
        markSaved(Number(result.id))
        await loadConditions()
        await openDetails(result.id)
      }
    } else if (selected.value) {
      const id = selected.value.id
      const changes = changedColumns(selected.value, editFields.value, EDITABLE_COLUMNS)
      if (!Object.keys(changes).length) {
        notifications.showInfo('Изменений нет')
        markSaved(null)
        return
      }
      await fastApiService.updateTechnicalCondition(id, changes)
      notifications.showSuccess('Изменения ТУ сохранены')
      markSaved(id)
      await loadConditions()
      await openDetails(id)
    }
  } catch (e: any) {
    // форма остаётся открытой с введёнными значениями
    notifications.showError(formatApiErrorWith('Ошибка при сохранении', e))
  } finally {
    saving.value = false
  }
}

const downloadBalance = async () => {
  loadingBalance.value = true
  try {
    const year = issueYear.value ? Number(issueYear.value) : undefined
    const balance = await fastApiService.getTechnicalConditionBalance(year)
    const { blob, filename } = await fastApiService.downloadExcelReport(
      'tu-balance',
      balance.year ? { year: Number(balance.year) } : undefined,
    )
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename || `tu_balance_${balance.year || 'all'}.xlsx`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    const note = balance.notes ? ` (${balance.notes})` : ''
    notifications.showSuccess(
      `Свод ТУ ${balance.year || ''}: ${balance.totals?.tu_count ?? 0} записей${note}`
    )
  } catch (e: any) {
    notifications.showError(formatApiError(e, 'Не удалось выгрузить свод ТУ'))
  } finally {
    loadingBalance.value = false
  }
}

const deleteTechnicalCondition = async (id: number) => {
  if (!(await confirmAction({ text: `Удалить технические условия №${id}? Действие необратимо.`, action: 'Удалить' }))) return
  try {
    deleting.value = true
    await fastApiService.deleteTechnicalCondition(id)
    forgetDraft(id)
    notifications.showSuccess(`ТУ ${id} удалены`)
    detailsVisible.value = false
    await loadConditions()
  } catch (e: any) {
    notifications.showError(formatApiErrorWith('Ошибка при удалении', e))
  } finally {
    deleting.value = false
  }
}

watch(page, () => { if (visible.value) void loadConditions() })
watch([stateId, issueYear, heatSource, district, linked, dateFrom, dateTo], () => { if (visible.value) { page.value = 1; void loadConditions() } })
defineExpose({ openDialog })
</script>

<style scoped>
.tu-journal { height: min(90vh, 920px); display: flex; flex-direction: column; }
.tu-kpi { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.tu-filters { flex-shrink: 0; background: rgba(var(--v-theme-on-surface), 0.02); }
.tu-table-wrap { min-height: 280px; overflow: auto; flex: 1; }
.tu-table { min-width: 1320px; }
.wide-cell { display: inline-block; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: bottom; }
.cell-note { color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity)); font-size: .75rem; margin-top: 2px; }
@media (max-width: 600px) { .tu-journal { height: 100dvh; } }
</style>
