<template>
  <Teleport to="body">
    <v-dialog
      v-model="visible"
      :fullscreen="isMobile"
      max-width="1400"
      scrollable
    >
      <v-card
        class="diaphragm-journal"
        :rounded="isMobile ? 0 : 'lg'"
      >
        <v-card-title class="d-flex align-center ga-3 px-4 py-3">
          <v-avatar
            color="teal-lighten-5"
            size="40"
          >
            <v-icon color="teal-darken-2">mdi-circle-slice-8</v-icon>
          </v-avatar>
          <div
            class="flex-grow-1"
            style="min-width: 0"
          >
            <div class="text-subtitle-1 font-weight-bold">Диафрагмы наружных теплопроводов</div>
            <div class="text-caption text-medium-emphasis text-truncate">
              {{ scopeTitle }} · найдено {{ total }} · готовы {{ lookups.counts.ready || 0 }} из {{ lookups.counts.total || 0 }}
            </div>
          </div>
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

        <div class="px-3 px-md-4 pt-3 diaphragm-alerts">
          <v-alert
            type="warning"
            variant="tonal"
            density="compact"
          >
            Старые линии диафрагм без полной топологии и геометрии: паспортные данные доступны, положение на карте —
            только после восстановления связей.
          </v-alert>
          <v-alert
            v-if="lookupsLoaded && lookups.result_count === 0"
            type="info"
            variant="tonal"
            density="compact"
          >
            Таблицы <code>calculation</code> и <code>DRO_OUT</code> пусты: расход, потери напора и сопротивление показаны
            как отсутствующие и не подменяются нулями.
          </v-alert>
        </div>

        <!-- Плитки из справочника (на всю базу): качество и режим диаметра — фильтры, остальные — справка -->
        <div class="diaphragm-kpi px-3 px-md-4 pt-3">
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
        <div class="diaphragm-kpi px-3 px-md-4 pt-2">
          <KpiTile
            v-for="mode in diameterMetrics"
            :key="mode.value"
            :label="mode.label"
            :value="lookups.counts[mode.countKey] || 0"
            :compact="false"
            selectable
            :active="diameterMode === mode.value"
            @select="toggleDiameterMode(mode.value)"
          />
          <KpiTile
            label="Некорректное количество"
            :value="lookups.counts.installed_count_invalid || 0"
            :compact="false"
            :status="(lookups.counts.installed_count_invalid || 0) > 0 ? 'warning' : 'good'"
          />
          <KpiTile
            label="С координатой"
            :value="lookups.counts.locatable || 0"
            :compact="false"
          />
        </div>

        <div class="pa-3 pa-md-4 diaphragm-filters">
          <v-row dense>
            <v-col
              cols="12"
              md="4"
            >
              <SearchField
                :model-value="search"
                label="ID, линия, узел, место или владелец"
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
                v-model="diameterMode"
                :items="diameterOptions"
                item-title="title"
                item-value="value"
                label="Режим диаметра"
              />
            </v-col>
            <v-col
              cols="12"
              sm="6"
              md="2"
            >
              <AppSelect
                v-model="installationPlace"
                :items="lookups.locations"
                item-title="name"
                item-value="name"
                label="Место установки"
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
                v-model="externalSignId"
                :items="lookups.external_signs"
                item-title="name"
                item-value="id"
                label="Признак линии"
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
              @click="loadItems"
            >
              Обновить
            </v-btn>
          </div>
        </div>

        <v-divider />

        <v-card-text class="pa-0 diaphragm-table-wrap">
          <StateView
            variant="table"
            :rows="10"
            :loading="loading && !items.length"
            :error="error"
            :empty="!loading && !items.length"
            empty-title="Диафрагмы не найдены"
            :empty-text="filtersActive ? 'Измените фильтры: по выбранным условиям записей нет' : 'В базе нет диафрагм'"
            empty-icon="mdi-circle-slice-8"
            :action-label="filtersActive ? 'Сбросить фильтры' : undefined"
            error-title="Не удалось загрузить диафрагмы"
            :retrying="loading"
            @retry="loadItems"
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
              :flash-key="flashId"
              density="compact"
              class="diaphragm-table"
              @select="openDetails(Number($event.id))"
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
              <template #[`item.internal_diameter`]="{ item }">
                {{ diameterLabel(item) }}
                <div class="text-caption text-medium-emphasis">
                  {{ diameterModeLabel(item.diameter_mode as NetworkDiaphragmDiameterMode) }}
                </div>
              </template>
              <template #[`item.installed_count`]="{ item }">
                {{ item.installed_count ?? '—' }}
              </template>
              <template #[`item.entry_mark`]="{ item }">
                <v-chip
                  size="x-small"
                  variant="tonal"
                  :color="item.calculation_writeback_allowed ? 'success' : 'grey'"
                >
                  {{ item.entry_mark || 'не разрешена' }}
                </v-chip>
              </template>
              <template #[`item.external_sign_line_name`]="{ item }">
                {{ item.external_sign_line_name || '—' }}
              </template>
              <template #[`item.state_name`]="{ item }">
                {{ item.state_name || '—' }}
              </template>
              <template #[`item.quality_status`]="{ item }">
                <v-chip
                  size="x-small"
                  variant="tonal"
                  :color="qualityColor(item.quality_status as NetworkDiaphragmQualityStatus)"
                >
                  {{ qualityLabel(item.quality_status as NetworkDiaphragmQualityStatus) }}
                </v-chip>
              </template>
              <template #[`item.actions`]="{ item }">
                <HintTip
                  v-if="hasCoordinates(item)"
                  text="Показать диафрагму на карте"
                  hint="Журнал закроется, маркер останется"
                >
                  <template #default="{ props: tip }">
                    <v-btn
                      v-bind="tip"
                      icon="mdi-crosshairs-gps"
                      size="x-small"
                      variant="text"
                      aria-label="Показать диафрагму на карте"
                      @click.stop="locate(item)"
                    />
                  </template>
                </HintTip>
                <HintTip
                  v-else
                  text="Карта недоступна"
                  hint="Нет координат: линия отсутствует или без узлов"
                >
                  <template #default="{ props: tip }">
                    <v-btn
                      v-bind="tip"
                      icon="mdi-map-marker-off"
                      size="x-small"
                      variant="text"
                      aria-disabled="true"
                      aria-label="Нет координат: линия отсутствует или без узлов"
                      @click.stop
                    />
                  </template>
                </HintTip>
                <HintTip text="Открыть паспорт">
                  <template #default="{ props: tip }">
                    <v-btn
                      v-bind="tip"
                      icon="mdi-chevron-right"
                      size="x-small"
                      variant="text"
                      aria-label="Открыть паспорт диафрагмы"
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
          <v-icon color="teal-darken-2">mdi-circle-slice-8</v-icon>
          <div
            class="flex-grow-1"
            style="min-width: 0"
          >
            <div class="text-subtitle-1 font-weight-bold d-flex align-center ga-2">
              <span class="text-truncate">{{ details ? `Диафрагма №${details.id}` : 'Паспорт диафрагмы' }}</span>
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
              {{ details ? `линия ${details.line_id ?? '—'} · ${details.state_name || 'состояние не указано'}` : '' }}
            </div>
          </div>
          <HintTip
            text="Закрыть паспорт"
          >
            <template #default="{ props: tip }">
              <v-btn
                v-bind="tip"
                icon
                variant="text"
                aria-label="Закрыть паспорт"
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
            :empty="!detailLoading && !detailError && !details"
            empty-title="Паспорт не выбран"
            :retry="false"
          >
            <template v-if="details">
              <v-alert
                v-if="details.quality_status !== 'ready'"
                class="mb-3"
                :type="details.quality_status === 'line_missing' ? 'error' : 'warning'"
                variant="tonal"
                density="compact"
              >
                {{ qualityDescription(details.quality_status as NetworkDiaphragmQualityStatus) }}
              </v-alert>
              <v-alert
                v-if="details.diameter_mode === 'pending_calculation'"
                class="mb-3"
                type="info"
                variant="tonal"
                density="compact"
              >
                Нулевой диаметр штатный: расчёту разрешено подобрать и записать диаметр диафрагмы.
              </v-alert>
              <JournalDetailFields
                :groups="detailGroups"
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
              v-if="details && hasCoordinates(details)"
              variant="tonal"
              prepend-icon="mdi-crosshairs-gps"
              @click="locate(details)"
            >
              На карте
            </v-btn>
            <v-btn
              v-if="mutationsEnabled && details"
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
import KpiTile from '~/components/KpiTile.vue'
import SearchField from '~/components/SearchField.vue'
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
  type NetworkDiaphragmDetails,
  type NetworkDiaphragmDiameterMode,
  type NetworkDiaphragmLookups,
  type NetworkDiaphragmQualityStatus,
  type NetworkDiaphragmSummary
} from '~/services/fastApiService'

/**
 * Диафрагмы — журнал оборудования (docs/ui-modernization-progress.md, этап 5): `DataTable` с серверной
 * пагинацией, плитки качества и режима диаметра из справочника (плитка — фильтр), `SearchField` / `AppSelect`,
 * `StateView`. Паспорт — `JournalDetailFields`; правка пяти колонок `diaphragms` через `equipmentEditService`
 * (версия строки → 409, только изменённые поля) на общем `useJournalEdit` (черновик, «изменено», отмена с
 * подтверждением). Ключи формы — колонки таблицы, не ключи карточки (`toForm`).
 */
export interface NetworkDiaphragmJournalScope {
  diaphragmId?: number
  lineId?: number
}

const emit = defineEmits<{
  'locate-diaphragm': [payload: { longitude: number; latitude: number; id: number; lineId: number | null; label: string }]
}>()
const { isMobile } = useMobile()
const canEditNetwork = useMutationsEnabled('network')
const authStore = useAuthStore()
// плюс право «оборудование: правка» из матрицы ролей — как у кнопки «Оборудование» в карточке объекта
const mutationsEnabled = computed(() => canEditNetwork.value && canDo(authStore.permissions, 'equipment', 'edit'))
const notifications = useNotificationStore()
const { saveError, clearSaveError, reportSaveError } = useEquipmentSaveError()
const visible = ref(false)
const loading = ref(false)
const error = ref('')
const items = ref<NetworkDiaphragmSummary[]>([])
const total = ref(0)
const pages = ref(0)
const page = ref(1)
const pageSize = 50
const search = ref('')
const qualityStatus = ref<NetworkDiaphragmQualityStatus | undefined>()
const diameterMode = ref<NetworkDiaphragmDiameterMode | undefined>()
const installationPlace = ref<string | undefined>()
const stateId = ref<number | undefined>()
const externalSignId = ref<number | undefined>()
const scope = reactive<NetworkDiaphragmJournalScope>({})
const lookups = reactive<NetworkDiaphragmLookups>({
  states: [], external_signs: [], locations: [], entry_marks: [], fragments: [], counts: {}, calculation_count: 0, result_count: 0
})
const lookupsLoaded = ref(false)

const detailVisible = ref(false)
const detailLoading = ref(false)
const detailError = ref('')
const details = ref<NetworkDiaphragmDetails | null>(null)

const qualityMetrics: Array<{ value: NetworkDiaphragmQualityStatus; label: string; status?: 'good' | 'warning' | 'serious' | 'critical' }> = [
  { value: 'ready', label: 'Готовы', status: 'good' },
  { value: 'line_missing', label: 'Нет линии', status: 'critical' },
  { value: 'line_removed', label: 'Линия удалена' },
  { value: 'topology_missing', label: 'Нет топологии', status: 'serious' },
  { value: 'state_missing', label: 'Нет состояния', status: 'warning' },
  { value: 'count_invalid', label: 'Количество', status: 'warning' },
  { value: 'diameter_unresolved', label: 'Диаметр', status: 'warning' }
]
const qualityOptions = qualityMetrics.map(metric => ({ title: metric.label, value: metric.value }))
const diameterMetrics: Array<{ value: NetworkDiaphragmDiameterMode; label: string; countKey: string }> = [
  { value: 'available', label: 'Диаметр записан', countKey: 'diameter_available' },
  { value: 'pending_calculation', label: 'Ожидает расчёт', countKey: 'diameter_pending_calculation' },
  { value: 'unresolved', label: 'Диаметр недоступен', countKey: 'diameter_unavailable' }
]
const diameterOptions = diameterMetrics.map(mode => ({ title: mode.label, value: mode.value }))

const scopeTitle = computed(() => (scope.lineId ? `диафрагмы линии ${scope.lineId}` : 'вся тепловая сеть'))
const filtersActive = computed(() => Boolean(
  search.value.trim() || qualityStatus.value || diameterMode.value || installationPlace.value || stateId.value || externalSignId.value
))

const tableColumns: DataTableColumn[] = [
  { key: 'id', title: 'ID', type: 'number', width: 90, sortable: false },
  { key: 'installation_place', title: 'Место установки', width: 180, sortable: false },
  { key: 'line_id', title: 'Линия / узлы', sortable: false },
  { key: 'internal_diameter', title: 'Диаметр', type: 'number', width: 150, sortable: false },
  { key: 'installed_count', title: 'Кол-во', type: 'number', width: 80, sortable: false },
  { key: 'entry_mark', title: 'Запись расчёта', width: 130, sortable: false },
  { key: 'external_sign_line_name', title: 'Признак линии', width: 130, sortable: false },
  { key: 'state_name', title: 'Состояние', width: 110, sortable: false },
  { key: 'quality_status', title: 'Качество', width: 130, sortable: false },
  { key: 'actions', title: '', type: 'actions', width: 88, sortable: false },
]

const QUALITY_LABEL: Record<NetworkDiaphragmQualityStatus, string> = {
  ready: 'готово', line_missing: 'нет линии', line_removed: 'линия удалена', topology_missing: 'нет топологии',
  state_missing: 'нет состояния', count_invalid: 'количество', diameter_unresolved: 'нет диаметра'
}
const QUALITY_COLOR: Record<NetworkDiaphragmQualityStatus, string> = {
  ready: 'success', line_missing: 'error', line_removed: 'grey', topology_missing: 'warning',
  state_missing: 'purple', count_invalid: 'brown', diameter_unresolved: 'warning'
}
const QUALITY_DESCRIPTION: Record<NetworkDiaphragmQualityStatus, string> = {
  ready: '',
  line_missing: 'Связанная линия отсутствует в текущей таблице linesobj.',
  line_removed: 'Связанная линия помечена удалённой.',
  topology_missing: 'Старая линия не содержит начальный и конечный узлы, поэтому сетевой контекст и координата недоступны.',
  state_missing: 'Ссылка stateID не соответствует справочнику states.',
  count_invalid: 'Количество последовательно установленных диафрагм должно быть больше нуля.',
  diameter_unresolved: 'Диаметр не задан, а разрешение записать подобранное расчётом значение отсутствует.'
}
const DIAMETER_MODE_LABEL: Record<NetworkDiaphragmDiameterMode, string> = {
  available: 'диаметр записан', pending_calculation: 'ожидает подбор расчётом', unresolved: 'не определён'
}
const qualityLabel = (status: NetworkDiaphragmQualityStatus) => QUALITY_LABEL[status] || String(status || '—')
const qualityColor = (status: NetworkDiaphragmQualityStatus) => QUALITY_COLOR[status] || 'grey'
const qualityDescription = (status: NetworkDiaphragmQualityStatus) => QUALITY_DESCRIPTION[status] || ''
const diameterModeLabel = (mode: NetworkDiaphragmDiameterMode) => DIAMETER_MODE_LABEL[mode] || '—'

const hasCoordinates = (item: Record<string, unknown>) => hasLonLat(item)
const nodeLabel = (code: unknown, name: unknown, id: unknown) =>
  [code, name].filter(Boolean).join(' ') || (id ? `№${id}` : '—')
const formatNumber = (value: unknown, digits = 3) =>
  value === null || value === undefined || value === '' || !Number.isFinite(Number(value))
    ? '—'
    : Number(value).toLocaleString('ru-RU', { maximumFractionDigits: digits })
const formatUnit = (value: unknown, unit: string) => (formatNumber(value) === '—' ? '—' : `${formatNumber(value)} ${unit}`)
const formatDate = (value: unknown) => (value ? new Date(String(value)).toLocaleDateString('ru-RU') : '—')
const formatAttribute = (value: unknown) => (typeof value === 'number' ? formatNumber(value, 8) : String(value ?? '—'))
const diameterLabel = (item: Record<string, unknown>) =>
  item.internal_diameter !== null && Number(item.internal_diameter) > 0 ? `${formatNumber(item.internal_diameter, 6)} мм` : '—'

/** Правятся пять колонок таблицы diaphragms (allow-list equipment_edit); ключи формы — имена колонок */
const EDIT_COLUMNS: Record<string, { label: string; from: string; type: string }> = {
  throtdiaphloc: { label: 'Место установки', from: 'installation_place', type: 'text' },
  stateid: { label: 'Состояние', from: 'state_id', type: 'select' },
  diameterinternal: { label: 'Внутренний диаметр', from: 'internal_diameter', type: 'number' },
  consinstdiaphcount: { label: 'Количество последовательно', from: 'installed_count', type: 'number' },
  entrymark: { label: 'Разрешение записи расчёта', from: 'entry_mark', type: 'text' }
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
} = useJournalEdit('diaphragms', editSource, details, {
  toForm: record => Object.fromEntries(Object.entries(EDIT_COLUMNS).map(([column, def]) => [column, record[def.from] ?? null]))
})

/** Поля паспорта: только заполненные (в правке — все записываемые), значение — строка */
const buildFields = (entries: Array<[string, unknown, string?, string?, unknown[]?]>): JournalDetailField[] => entries
  .filter(([, value, key]) => (isEditing.value && key) || (value !== null && value !== undefined && value !== '' && value !== '—'))
  .map(([label, value, key, type, items]) => ({ label, value: String(value ?? '—'), rawValue: value, key, type: type || 'text', items }))

const detailGroups = computed((): JournalDetailGroup[] => {
  const item = details.value
  if (!item) return []
  const output = item.latest_output as Record<string, unknown> | null | undefined
  const outputValue = (key: string) => output?.[key]
  const attributes = Object.entries(item.attributes || {}).filter(([, value]) => value !== null && value !== '')
  return [
    { title: 'Сетевая привязка', fields: buildFields([
      ['Диафрагма / ID', item.id], ['Линия', item.line_id],
      ['Начальный узел', nodeLabel(item.node_code_1, item.node_name_1, item.node_id_1)],
      ['Конечный узел', nodeLabel(item.node_code_2, item.node_name_2, item.node_id_2)],
      ['Внутренний потребитель', nodeLabel(item.internal_node_code, item.internal_node_name, item.internal_node_id)],
      ['Фрагмент', item.fragment_name || item.fragment_id], ['Признак линии', item.external_sign_line_name],
      ['Сопротивление линии', formatNumber(item.line_hydraulic_resistance, 8)]
    ]) },
    { title: 'Паспорт диафрагмы', fields: buildFields([
      ['Место установки', item.installation_place, 'throtdiaphloc', 'text'],
      ['Состояние', item.state_name, 'stateid', 'select', lookups.states],
      ['Внутренний диаметр', diameterLabel(item), 'diameterinternal', 'number'],
      ['Режим диаметра', diameterModeLabel(item.diameter_mode)],
      ['Количество последовательно', item.installed_count, 'consinstdiaphcount', 'number'],
      ['Разрешение записи расчёта', item.entry_mark || 'не разрешена', 'entrymark', 'text']
    ]) },
    { title: 'Архивные реквизиты линии', fields: buildFields([
      ['Регистрационный номер', item.registration_number], ['Ввод в эксплуатацию', formatDate(item.commissioned_at)],
      ['Последний ремонт', formatDate(item.last_maintenance_at)], ['Владелец', item.organization_name], ['Оператор', item.operator_name]
    ]) },
    { title: 'Расчётный режим DRO_OUT', fields: output
      ? buildFields([
        ['Расход через диафрагму', formatUnit(outputValue('flow'), 'т/ч')], ['Потери напора', formatUnit(outputValue('head_loss'), 'м')],
        ['Полное гидравлическое сопротивление', formatNumber(outputValue('total_hydraulic_resistance'), 8)],
        ['Располагаемый напор в конечном узле', formatUnit(outputValue('available_head_end'), 'м')],
        ['Пьезометрический напор', formatUnit(outputValue('piezometric_head_end'), 'м')],
        ['Геодезическая отметка', formatUnit(outputValue('geodetic_mark_end'), 'м')],
        ['Полный напор', formatUnit(outputValue('total_head_end'), 'м')],
        ['Источник тепла', outputValue('heat_source_name') || outputValue('heat_source_id')]
      ])
      : buildFields([['Результат', 'расчётный результат для этой диафрагмы отсутствует']]) },
    { title: 'Исходные поля diaphragms', fields: buildFields(
      attributes.map(([key, value]) => [key, formatAttribute(value)] as [string, unknown])
    ) }
  ].filter(group => group.fields.length)
})

const loadLookups = async () => {
  if (lookupsLoaded.value) return
  Object.assign(lookups, await fastApiService.getNetworkDiaphragmLookups())
  lookupsLoaded.value = true
}

/** Номер последнего запроса списка: ответ более раннего запроса не перекрывает поздний */
let listRequest = 0
const loadItems = async () => {
  const request = ++listRequest
  loading.value = true
  error.value = ''
  try {
    const response = await fastApiService.getNetworkDiaphragms({
      page: page.value, page_size: pageSize, search: search.value.trim() || undefined,
      quality_status: qualityStatus.value, diameter_mode: diameterMode.value, installation_place: installationPlace.value,
      state_id: stateId.value, external_sign_line_id: externalSignId.value, line_id: scope.lineId
    })
    if (request !== listRequest) return
    items.value = response.items
    total.value = response.total
    pages.value = response.pages
  } catch (loadError: any) {
    if (request !== listRequest) return
    error.value = formatApiError(loadError, 'Не удалось загрузить диафрагмы')
  } finally {
    if (request === listRequest) loading.value = false
  }
}

watch([qualityStatus, diameterMode, installationPlace, stateId, externalSignId], () => {
  if (!visible.value) return
  page.value = 1
  void loadItems()
})
watch(page, () => { if (visible.value) void loadItems() })

const onSearch = () => {
  if (!visible.value) return
  page.value = 1
  void loadItems()
}
const toggleQuality = (status: NetworkDiaphragmQualityStatus) => {
  qualityStatus.value = qualityStatus.value === status ? undefined : status
}
const toggleDiameterMode = (mode: NetworkDiaphragmDiameterMode) => {
  diameterMode.value = diameterMode.value === mode ? undefined : mode
}
const resetFilters = () => {
  search.value = ''
  qualityStatus.value = undefined
  diameterMode.value = undefined
  installationPlace.value = undefined
  stateId.value = undefined
  externalSignId.value = undefined
  page.value = 1
  void loadItems()
}
const clearScope = () => {
  scope.lineId = undefined
  page.value = 1
  void loadItems()
}

/** Номер последнего запроса паспорта: ответ более раннего запроса не перекрывает поздний */
let detailRequest = 0
const openDetails = async (diaphragmId: number) => {
  // открытие другой записи во время правки — черновик текущей остаётся, паспорт на просмотр
  closeKeepingDraft()
  resetEdit()
  clearSaveError()
  const request = ++detailRequest
  detailVisible.value = true
  detailLoading.value = true
  detailError.value = ''
  details.value = null
  try {
    const record = await fastApiService.getNetworkDiaphragm(diaphragmId)
    if (request !== detailRequest) return
    details.value = record
  } catch (loadError: any) {
    if (request !== detailRequest) return
    detailError.value = formatApiError(loadError, 'Не удалось открыть паспорт диафрагмы')
  } finally {
    if (request === detailRequest) detailLoading.value = false
  }
}

let openDialogSeq = 0
const openDialog = async (nextScope: NetworkDiaphragmJournalScope = {}) => {
  const seq = ++openDialogSeq
  Object.assign(scope, { lineId: undefined, diaphragmId: undefined }, nextScope)
  page.value = 1
  visible.value = true
  // список сам показывает свою ошибку; сбой справочника не должен прятать список
  const [lookupsResult] = await Promise.allSettled([loadLookups(), loadItems()])
  if (lookupsResult.status === 'rejected') notifications.showWarning(formatApiError(lookupsResult.reason, 'Справочники не загрузились — плитки и фильтры могут быть неполными'))
  // журнал открыли снова, пока грузились списки — запись открывает последний вызов
  if (seq !== openDialogSeq) return
  if (nextScope.diaphragmId) await openDetails(nextScope.diaphragmId)
}

const startEdit = async () => {
  clearSaveError()
  if (!(await beginEdit())) return
  // версия строки для 409 и отправки только изменений
  beginEquipmentEdit('diaphragms', details.value?.id)
}

const cancelEdit = async () => {
  const { closed } = await cancel()
  if (closed) clearSaveError()
}

// Паспорт закрыт крестиком или Esc во время правки — черновик остаётся до следующего открытия
watch(detailVisible, (open) => {
  if (!open) closeKeepingDraft()
})

const saveChanges = async () => {
  const id = details.value?.id
  if (!id) return
  saving.value = true
  clearSaveError()
  try {
    await saveEquipmentEdit('diaphragms', id, editFields.value)
    markSaved(id)
    notifications.showSuccess('Изменения сохранены')
    await Promise.all([loadItems(), openDetails(id)])
  } catch (cause) {
    // текст — в паспорте; конфликт версий (409) ещё и уведомлением с перезагрузкой
    reportSaveError(cause, () => openDetails(id))
  } finally {
    saving.value = false
  }
}

const locate = (item: Record<string, unknown>) => {
  if (!hasCoordinates(item)) return
  emit('locate-diaphragm', {
    longitude: Number(item.longitude), latitude: Number(item.latitude), id: Number(item.id),
    lineId: item.line_id == null ? null : Number(item.line_id),
    label: String(item.display_name || `Диафрагма №${item.id}`)
  })
  detailVisible.value = false
  visible.value = false
}

defineExpose({ openDialog })
</script>

<style scoped>
.diaphragm-journal { height: min(90vh, 920px); display: flex; flex-direction: column; }
.diaphragm-alerts { display: grid; gap: var(--space-2); }
.diaphragm-kpi { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.diaphragm-filters { flex-shrink: 0; background: rgba(var(--v-theme-on-surface), 0.02); }
.diaphragm-table-wrap { min-height: 280px; overflow: auto; flex: 1; }
.diaphragm-table { min-width: 1240px; }
@media (max-width: 600px) { .diaphragm-journal { height: 100dvh; } }
</style>
