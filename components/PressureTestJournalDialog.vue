<template>
  <Teleport to="body">
    <v-dialog
      v-model="visible"
      :fullscreen="isMobile"
      max-width="1320"
      scrollable
    >
      <v-card
        class="pressure-journal"
        :rounded="isMobile ? 0 : 'lg'"
      >
        <v-card-title class="d-flex align-center ga-3 px-4 py-3">
          <v-avatar
            color="blue-lighten-5"
            size="40"
          >
            <v-icon color="blue-darken-2">mdi-gauge</v-icon>
          </v-avatar>
          <div
            class="flex-grow-1"
            style="min-width: 0"
          >
            <div class="text-subtitle-1 font-weight-bold">Журнал опрессовок</div>
            <div class="text-caption text-medium-emphasis text-truncate">{{ scopeTitle }} · найдено {{ total }}</div>
          </div>
          <v-btn
            v-if="mutationsEnabled"
            color="teal"
            variant="tonal"
            prepend-icon="mdi-stamper"
            class="mr-2"
            @click="batchApprovalRef?.open()"
          >
            Утвердить план
          </v-btn>
          <v-btn
            v-if="mutationsEnabled"
            color="primary"
            variant="flat"
            prepend-icon="mdi-plus"
            class="mr-2"
            :loading="creating"
            @click="createPressureTest"
          >
            Создать
          </v-btn>
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

        <!-- Плитки из ответа списка: всего и по состояниям при тех же фильтрах; плитка состояния — фильтр -->
        <div
          v-if="stateTiles.length"
          class="pressure-kpi px-3 px-md-4 pt-3"
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

        <div class="pa-3 pa-md-4 pressure-filters">
          <v-row dense>
            <v-col
              cols="12"
              md="4"
            >
              <SearchField
                :model-value="search"
                label="Поиск по ID, контуру, источнику или решению"
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
              md="3"
            >
              <AppSelect
                v-model="testTypeId"
                :items="lookups.test_types"
                item-title="name"
                item-value="id"
                label="Вид испытания"
              />
            </v-col>
            <v-col
              cols="12"
              sm="6"
              md="3"
            >
              <AppSelect
                v-model="heatSourceId"
                :items="lookups.heat_sources"
                item-title="name"
                item-value="id"
                label="Источник тепла"
              />
            </v-col>
            <v-col
              cols="12"
              sm="6"
              md="4"
            >
              <AppSelect
                v-model="responsibleId"
                :items="lookups.responsible_people"
                item-title="name"
                item-value="id"
                label="Ответственный"
              />
            </v-col>
            <v-col
              cols="12"
              sm="6"
              md="2"
            >
              <AppSelect
                v-model="approved"
                :items="approvalOptions"
                item-title="title"
                item-value="value"
                label="Утверждение"
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
                label="С даты"
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
                label="По дату"
                density="compact"
                variant="outlined"
                hide-details
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
              Трубопровод {{ scope.lineId }}
            </v-chip>
            <v-chip
              v-if="scope.nodeId"
              size="small"
              color="primary"
              closable
              @click:close="clearScope"
            >
              Узел {{ scope.nodeId }}
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
              @click="loadTests"
            >
              Обновить
            </v-btn>
          </div>
        </div>
        <v-divider />

        <v-card-text class="pa-0 pressure-table-wrap">
          <StateView
            variant="table"
            :rows="10"
            :loading="loading && !items.length"
            :error="error"
            :empty="!loading && !items.length"
            empty-title="Опрессовки не найдены"
            :empty-text="filtersActive ? 'Измените фильтры: по выбранным условиям записей нет' : 'В журнале пока нет записей — загрузите исторические контуры TGID в таблицу opres'"
            empty-icon="mdi-gauge-empty"
            :action-label="filtersActive ? 'Сбросить фильтры' : undefined"
            :retrying="loading"
            @retry="loadTests"
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
              class="pressure-table"
              @select="openDetails(Number($event.id))"
            >
              <template #[`item.period`]="{ item }">
                <span class="text-no-wrap">{{ formatRange(item.effective_start, item.effective_finish) }}</span>
              </template>
              <template #[`item.name`]="{ item }">
                <div class="text-truncate">
                  {{ item.name || `Опрессовка ${item.id}` }}
                </div>
                <div class="text-caption text-medium-emphasis text-truncate">
                  {{ item.contour_description || item.boundary_description || '—' }}
                </div>
              </template>
              <template #[`item.source`]="{ item }">
                {{ [item.heat_source_name, item.test_type_name].filter(Boolean).join(' · ') || '—' }}
              </template>
              <template #[`item.state_name`]="{ item }">
                <v-chip
                  size="x-small"
                  :color="stateColor(Number(item.state_id))"
                  variant="tonal"
                >
                  {{ item.state_name || 'Не указано' }}
                </v-chip>
              </template>
              <template #[`item.pressure`]="{ item }">
                <span class="text-no-wrap num">{{ pressure(item.stage_one_pressure) }} / {{ pressure(item.stage_two_pressure) }}</span>
              </template>
              <template #[`item.responsible_name`]="{ item }">
                {{ item.responsible_name || '—' }}
              </template>
              <template #[`item.defect_count`]="{ item }">
                <v-chip
                  size="x-small"
                  :color="item.defect_count ? 'error' : 'success'"
                  variant="tonal"
                  class="num"
                >
                  {{ item.defect_count }}
                </v-chip>
              </template>
              <template #[`item.result`]="{ item }">
                <span
                  class="result-cell"
                  :title="String(item.commission_decision || item.report || item.note || '')"
                >{{ item.commission_decision || item.report || item.note || '—' }}</span>
              </template>
              <template #[`item.actions`]="{ item }">
                <HintTip
                  v-if="hasCoordinates(item)"
                  text="Показать контур на карте"
                  hint="Журнал закроется, маркер останется"
                >
                  <template #default="{ props: tip }">
                    <v-btn
                      v-bind="tip"
                      icon="mdi-crosshairs-gps"
                      size="x-small"
                      variant="text"
                      color="primary"
                      aria-label="Показать контур на карте"
                      @click.stop="locate(item as PressureTestSummary, String(item.name || `Опрессовка ${item.id}`))"
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
                      aria-label="Подробнее"
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
      v-model="detailsVisible"
      :fullscreen="isMobile"
      max-width="1040"
      scrollable
      eager
    >
      <v-card :rounded="isMobile ? 0 : 'lg'">
        <v-card-title class="d-flex align-center ga-3 px-4 py-3">
          <v-icon color="blue-darken-2">mdi-gauge</v-icon>
          <div
            class="flex-grow-1"
            style="min-width: 0"
          >
            <div class="text-subtitle-1 font-weight-bold d-flex align-center ga-2">
              <span class="text-truncate">{{ isNew ? 'Новая опрессовка' : (selected?.name || `Опрессовка ${selected?.id || ''}`) }}</span>
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
              {{ selected?.state_name || 'Состояние не указано' }} · линий {{ selected?.line_count || 0 }} · документов {{ selected?.document_count || 0 }}
            </div>
          </div>
          <!-- Удаление — иконкой в заголовке, как в остальных журналах (QA F48) -->
          <HintTip
            v-if="mutationsEnabled && !isEditing && selected && !isNew"
            text="Удалить опрессовку"
            hint="С подтверждением; действие попадёт в журнал"
            location="bottom"
          >
            <template #default="{ props: tip }">
              <v-btn
                v-bind="tip"
                icon
                variant="text"
                color="error"
                class="mr-1"
                aria-label="Удалить опрессовку"
                :loading="deleting"
                @click="deletePressureTest(selected!.id)"
              >
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </template>
          </HintTip>
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
              <JournalDetailFields
                :groups="detailGroups"
                :model="editFields"
                :editable="editable"
                :is-field-dirty="isFieldDirty"
                :required-keys="['name']"
                @update:model="editFields = $event"
              >
                <template v-if="!isEditing">
                  <v-expansion-panel
                    v-if="testLines.length"
                    :value="detailGroups.length"
                  >
                    <v-expansion-panel-title>Линии контура ({{ testLines.length }})</v-expansion-panel-title>
                    <v-expansion-panel-text>
                      <v-list
                        density="compact"
                        lines="two"
                      >
                        <v-list-item
                          v-for="line in testLines"
                          :key="Number(line.id)"
                          prepend-icon="mdi-pipe"
                          :title="`Линия ${line.line_id} · ${nodeRange(line)}`"
                          :subtitle="lineSummary(line)"
                        >
                          <template
                            v-if="hasCoordinates(line)"
                            #append
                          >
                            <v-btn
                              icon="mdi-crosshairs-gps"
                              size="x-small"
                              variant="text"
                              aria-label="Показать на карте"
                              @click.stop="locateRelation(line, `Линия ${line.line_id}`)"
                            />
                          </template>
                        </v-list-item>
                      </v-list>
                    </v-expansion-panel-text>
                  </v-expansion-panel>

                  <v-expansion-panel
                    v-if="boundaryNodes.length"
                    :value="detailGroups.length + 1"
                  >
                    <v-expansion-panel-title>Границы раздела ({{ boundaryNodes.length }})</v-expansion-panel-title>
                    <v-expansion-panel-text>
                      <v-list density="compact">
                        <v-list-item
                          v-for="(node, index) in boundaryNodes"
                          :key="`${node.kind}-${node.node_id}-${index}`"
                          prepend-icon="mdi-map-marker-radius-outline"
                          :title="`${node.kind}: ${node.node_name || `узел ${node.node_id}`}`"
                        >
                          <template
                            v-if="hasCoordinates(node)"
                            #append
                          >
                            <v-btn
                              icon="mdi-crosshairs-gps"
                              size="x-small"
                              variant="text"
                              aria-label="Показать на карте"
                              @click.stop="locateRelation(node, String(node.node_name || `Узел ${node.node_id}`))"
                            />
                          </template>
                        </v-list-item>
                      </v-list>
                    </v-expansion-panel-text>
                  </v-expansion-panel>

                  <v-expansion-panel
                    v-if="measures.length"
                    :value="detailGroups.length + 2"
                  >
                    <v-expansion-panel-title>Мероприятия ({{ measures.length }})</v-expansion-panel-title>
                    <v-expansion-panel-text>
                      <v-chip
                        v-for="measure in measures"
                        :key="Number(measure.id)"
                        class="ma-1"
                        size="small"
                        variant="tonal"
                      >
                        {{ measure.measure_name || `Мероприятие ${measure.measure_id}` }}
                      </v-chip>
                    </v-expansion-panel-text>
                  </v-expansion-panel>

                  <v-expansion-panel
                    v-if="relatedDefects.length"
                    :value="detailGroups.length + 3"
                  >
                    <v-expansion-panel-title>Нарушения испытаний ({{ relatedDefects.length }})</v-expansion-panel-title>
                    <v-expansion-panel-text>
                      <v-list
                        density="compact"
                        lines="two"
                      >
                        <v-list-item
                          v-for="defect in relatedDefects"
                          :key="Number(defect.id)"
                          prepend-icon="mdi-alert-circle-outline"
                          :title="`Нарушение ${defect.id} · ${defect.state_name || 'без состояния'}`"
                          :subtitle="String(defect.description || defect.source_name || 'Описание не заполнено')"
                          @click="openRelatedDefect(Number(defect.id))"
                        />
                      </v-list>
                    </v-expansion-panel-text>
                  </v-expansion-panel>

                  <v-expansion-panel
                    v-if="documents.length"
                    :value="detailGroups.length + 4"
                  >
                    <v-expansion-panel-title>Программы и акты ({{ documents.length }})</v-expansion-panel-title>
                    <v-expansion-panel-text>
                      <v-list density="compact">
                        <v-list-item
                          v-for="document in documents"
                          :key="`${document.kind}-${document.id}`"
                          prepend-icon="mdi-file-document-outline"
                          :title="String(document.document_type_name || document.kind || 'Документ')"
                          :subtitle="`${formatDate(document.date_doc)} · ${fileName(document.path)}`"
                        />
                      </v-list>
                    </v-expansion-panel-text>
                  </v-expansion-panel>
                </template>
              </JournalDetailFields>
              <JournalRecordPanels
                v-if="selected && !isEditing"
                class="mt-4"
                journal="pressure-tests"
                :record-id="selected.id"
                :record-label="selected.name || `Опрессовка ${selected.id}`"
                @changed="refreshSelected"
                @hide="hideForMap"
                @restore="restoreAfterMap"
              />
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
            @click="locate(selected, selected.name || `Опрессовка ${selected.id}`)"
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
            v-if="!isEditing && selected && !isNew"
            variant="text"
            prepend-icon="mdi-file-word-outline"
            :loading="exportingWord"
            @click="exportWord"
          >
            Word
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
    <JournalBatchApprovalDialog
      ref="batchApprovalRef"
      journal="pressure-tests"
      @approved="loadTests"
    />
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
import { formatApiError } from '~/utils/apiError'
import { computed, reactive, ref, watch } from 'vue'
import { useJournalEdit } from '~/composables/useJournalEdit'
import { useMobile } from '~/composables/useMobile'
import { useMutationsEnabled } from '~/composables/useMutationsEnabled'
import { useJournalRecordForm } from '~/composables/useJournalRecordForm'
import { fastApiService, type PressureTestDetails, type PressureTestLookups, type PressureTestSummary } from '~/services/fastApiService'

/**
 * Журнал опрессовок — тип (б) «рабочее место» (docs/ui-modernization-progress.md, этап 5): `DataTable` с серверной
 * пагинацией, плитки состояний из `state_counts`, фильтры `SearchField` / `AppSelect`, массовое утверждение плана,
 * Word; карточка на общих `JournalDetailFields` + `useJournalEdit` (черновик, «изменено», отмена с подтверждением),
 * линии контура и границы раздела с переходом на карту.
 */
export interface PressureTestJournalScope { lineId?: number; nodeId?: number; testId?: number }
const emit = defineEmits<{
  'locate-pressure-test': [coordinates: { longitude: number; latitude: number; id: number; label: string }]
  'open-defect': [defectId: number]
}>()
const { isMobile } = useMobile()
const mutationsEnabled = useMutationsEnabled()
const visible = ref(false), loading = ref(false), error = ref('')
const items = ref<PressureTestSummary[]>([])
const total = ref(0), pages = ref(0), page = ref(1)
const pageSize = 50
const search = ref('')
const stateId = ref<number | undefined>(), testTypeId = ref<number | undefined>()
const heatSourceId = ref<number | undefined>(), responsibleId = ref<number | undefined>()
const approved = ref<boolean | undefined>(), dateFrom = ref(''), dateTo = ref('')
const scope = reactive<PressureTestJournalScope>({})
const lookups = reactive<PressureTestLookups>({ states: [], test_types: [], heat_sources: [], pump_objects: [], subdivisions: [], document_types: [], responsible_people: [] })
const approvalOptions = [{ title: 'Утверждено', value: true }, { title: 'Не утверждено', value: false }]
/** Счётчики по состояниям из ответа списка; null — API их не отдаёт (плитки скрыты) */
const stateCounts = ref<{ state_id: number | null; count: number }[] | null>(null)
const detailsVisible = ref(false), detailsLoading = ref(false), detailsError = ref('')
// Другой журнал начал выбор участков на карте — закрыть это окно (QA F48)
useCloseOnMapPick(() => visible.value || detailsVisible.value, () => { detailsVisible.value = false; visible.value = false })
const selected = ref<PressureTestDetails | null>(null)
const creating = ref(false)
const deleting = ref(false)
const exportingWord = ref(false)

const scopeTitle = computed(() => scope.lineId ? `опрессовки трубопровода ${scope.lineId}` : scope.nodeId ? `опрессовки у узла ${scope.nodeId}` : 'вся тепловая сеть')
const filtersActive = computed(() => Boolean(
  search.value.trim() || stateId.value || testTypeId.value || heatSourceId.value || responsibleId.value
  || approved.value !== undefined || dateFrom.value || dateTo.value,
))

const tableColumns: DataTableColumn[] = [
  { key: 'id', title: 'ID', type: 'number', width: 76, sortable: false },
  { key: 'period', title: 'Период', type: 'date', width: 170, sortable: false },
  { key: 'name', title: 'Контур', sortable: false },
  { key: 'source', title: 'Источник / вид', width: 180, sortable: false },
  { key: 'state_name', title: 'Состояние', width: 120, sortable: false },
  { key: 'pressure', title: 'Давление I / II', type: 'number', width: 170, sortable: false },
  { key: 'responsible_name', title: 'Ответственный', width: 150, sortable: false },
  { key: 'line_count', title: 'Линии', type: 'number', width: 80, sortable: false },
  { key: 'defect_count', title: 'Нарушения', type: 'number', width: 100, sortable: false },
  { key: 'result', title: 'Решение', sortable: false },
  { key: 'actions', title: '', type: 'actions', width: 88, sortable: false },
]

/** Состояние опрессовки → тон плитки: план — нейтрально, в работе — внимание, выполнена — в порядке */
const STATE_STATUS: Record<number, KpiStatus> = { 1: 'none', 2: 'warning', 3: 'good' }
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
const formatRange = (start: unknown, finish: unknown) => [formatDate(start), formatDate(finish)].filter((v, i, a) => v !== '—' && a.indexOf(v) === i).join(' — ') || '—'
const formatValue = (value: unknown) => value === null || value === undefined || value === '' ? '—' : typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? formatDate(value) : String(value)
const pressure = (value: unknown) => value === null || value === undefined || value === '' ? '—' : `${value} кгс/см²`
const stateColor = (state: number | null) => state === 3 ? 'success' : state === 2 ? 'warning' : state === 1 ? 'info' : 'grey'
const hasCoordinates = (item: { longitude?: unknown; latitude?: unknown }) => hasLonLat(item)
const fileName = (path: unknown) => String(path || 'Файл не указан').split(/[\\/]/).pop() || 'Файл'
const nodeRange = (line: Record<string, unknown>) => [line.start_node_name, line.end_node_name].filter(Boolean).join(' — ') || 'узлы не указаны'
const lineSummary = (line: Record<string, unknown>) => [line.diameter && `DN ${line.diameter}`, line.length && `длина ${line.length} м`, line.tubing_type_name].filter(Boolean).join(' · ') || 'Параметры участка не заполнены'

const loadLookups = async () => { if (!lookups.states.length) Object.assign(lookups, await fastApiService.getPressureTestLookups()) }
const loadTests = async () => {
  loading.value = true; error.value = ''
  try {
    const response = await fastApiService.getPressureTests({ page: page.value, page_size: pageSize, state_id: stateId.value,
      test_type_id: testTypeId.value, heat_source_id: heatSourceId.value, responsible_id: responsibleId.value,
      approved: approved.value, date_from: dateFrom.value || undefined, date_to: dateTo.value || undefined,
      line_id: scope.lineId, node_id: scope.nodeId, search: search.value.trim() || undefined })
    items.value = response.items; total.value = response.total; pages.value = response.pages
    stateCounts.value = Array.isArray(response.state_counts) ? response.state_counts : null
  } catch (loadError: any) { error.value = loadError?.data?.detail || loadError?.message || 'Не удалось загрузить журнал опрессовок' }
  finally { loading.value = false }
}
/** Текст после паузы ввода (SearchField) */
const onSearch = () => {
  if (!visible.value) return
  page.value = 1
  void loadTests()
}
const openDetails = async (id: number) => {
  detailsVisible.value = true; detailsLoading.value = true; detailsError.value = ''; selected.value = null
  try { selected.value = await fastApiService.getPressureTest(id) }
  catch (loadError: any) { detailsError.value = loadError?.data?.detail || loadError?.message || 'Не удалось открыть карточку опрессовки' }
  finally { detailsLoading.value = false }
}
const openDialog = async (nextScope: PressureTestJournalScope = {}) => {
  Object.assign(scope, { lineId: undefined, nodeId: undefined, testId: undefined }, nextScope)
  page.value = 1; visible.value = true
  try { await Promise.all([loadLookups(), loadTests(), recordForm.loadSchema()]); if (nextScope.testId) await openDetails(nextScope.testId) }
  catch (loadError: any) { error.value = loadError?.message || 'Не удалось открыть журнал опрессовок' }
}
const clearScope = () => { scope.lineId = undefined; scope.nodeId = undefined; page.value = 1; void loadTests() }
const resetFilters = () => {
  search.value = ''; stateId.value = undefined; testTypeId.value = undefined; heatSourceId.value = undefined
  responsibleId.value = undefined; approved.value = undefined; dateFrom.value = ''; dateTo.value = ''; page.value = 1; void loadTests()
}
const locate = (item: PressureTestSummary, label: string) => {
  if (!hasCoordinates(item)) return
  emit('locate-pressure-test', { longitude: Number(item.longitude), latitude: Number(item.latitude), id: item.id, label })
  detailsVisible.value = false; visible.value = false
}
const locateRelation = (relation: Record<string, unknown>, label: string) => {
  if (!selected.value || !hasCoordinates(relation)) return
  emit('locate-pressure-test', { longitude: Number(relation.longitude), latitude: Number(relation.latitude), id: selected.value.id, label })
  detailsVisible.value = false; visible.value = false
}
const openRelatedDefect = (id: number) => { detailsVisible.value = false; visible.value = false; emit('open-defect', id) }

const buildFields = (entries: Array<[string, unknown, string?, string?, any[]?]>): JournalDetailField[] => {
  return entries
    .filter(([, value]) => isEditing.value || (value !== null && value !== undefined && value !== ''))
    .map(([label, value, key, type, items]) => ({
      label, value: formatValue(value), rawValue: value, key, type: type || 'text', items
    }))
}

const detailGroups = computed((): JournalDetailGroup[] => {
  const item = isEditing.value ? editFields.value : selected.value
  if (!item && !isNew.value) return []

  return [
    { title: 'Контур испытаний', fields: buildFields([
      ['Наименование', item?.name, 'name', 'text'], ['Описание контура', item?.contour_description, 'contour_description', 'textarea'], ['Граница раздела', item?.boundary_description, 'boundary_description', 'textarea'],
      ['Источник тепла', item?.heat_source_name, 'heat_source_id', 'select', lookups.heat_sources], ['Вид испытания', item?.test_type_name, 'test_type_id', 'select', lookups.test_types], ['Состояние', item?.state_name, 'state_id', 'select', lookups.states],
      ['Утверждение', item?.approval_name], ['Ответственный', item?.responsible_name, 'responsible_id', 'select', lookups.responsible_people], ['Подразделение', item?.subdivision_name, 'subdivision_id', 'select', lookups.subdivisions],
      ['Узел опрессовочного насоса', item?.pump_node_name || item?.pump_node_id, 'pump_node_id', 'number'], ['Объект насоса', item?.pump_object_name, 'pump_object_id', 'select', lookups.pump_objects]
    ]) },
    { title: 'План опрессовки', fields: buildFields([
      ['Начало по плану', item?.planned_start, 'planned_start', 'date'], ['Окончание по плану', item?.planned_finish, 'planned_finish', 'date'], ['Утверждение плана', item?.plan_approved_on],
      ['Давление I этапа, кгс/см²', item?.stage_one_pressure, 'stage_one_pressure', 'number'], ['Давление II этапа, кгс/см²', item?.stage_two_pressure, 'stage_two_pressure', 'number'],
      ['Температура расхолаживания, °C', item?.cooling_temperature, 'cooling_temperature', 'number'], ['Количество звеньев обходчиков', item?.inspection_team_count, 'inspection_team_count', 'number']
    ]) },
    { title: 'Проведение и результат', fields: buildFields([
      ['Дата проведения', item?.tested_at, 'tested_at', 'date'], ['Время проведения', item?.tested_time, 'tested_time', 'time'], ['Продолжительность, мин', item?.duration_minutes, 'duration_minutes', 'number'],
      ['Решение комиссии', item?.commission_decision, 'commission_decision', 'text'], ['Отчёт', item?.report, 'report', 'textarea'], ['Текст нарушений', item?.defects_text, 'defects_text', 'textarea'],
      ['Неучаствующие трубопроводы', item?.excluded_pipelines, 'excluded_pipelines', 'textarea'], ['Непредупреждённые потребители', item?.unnotified_consumers, 'unnotified_consumers', 'text'],
      ['Список непредупреждённых потребителей', item?.unnotified_consumer_list, 'unnotified_consumer_list', 'textarea'], ['Дата утверждения акта', item?.act_approved_on, 'act_approved_on', 'date'],
      ['Файл акта', item?.act_file, 'act_file', 'text'], ['Примечание', item?.note, 'note', 'textarea']
    ]) },
    { title: 'Ответственные и руководители', fields: buildFields([
      ['Утверждающий', item?.approver_name], ['Руководитель испытаний', item?.test_manager_name, 'test_manager_name', 'text'], ['Обеспечение режимов', item?.mode_manager_name, 'mode_manager_name', 'text'],
      ['Бланк переключений', item?.switching_manager_name, 'switching_manager_name', 'text'], ['Манометры и расходомеры', item?.meter_manager_name, 'meter_manager_name', 'text'],
      ['Автотранспорт', item?.transport_manager_name, 'transport_manager_name', 'text'], ['Электрооборудование', item?.electrical_manager_name, 'electrical_manager_name', 'text'],
      ['Безопасность контура источника', item?.source_safety_manager_name, 'source_safety_manager_name', 'text'], ['Оповещение населения', item?.public_notification_manager_name, 'public_notification_manager_name', 'text']
    ]) }
  ].filter(group => group.fields.length)
})
const testLines = computed(() => selected.value?.relations?.lines || [])
const boundaryNodes = computed(() => selected.value?.relations?.boundary_nodes || [])
const measures = computed(() => selected.value?.relations?.measures || [])
const relatedDefects = computed(() => selected.value?.relations?.defects || [])
const documents = computed(() => selected.value?.relations?.documents || [])

const recordForm = useJournalRecordForm('pressure-tests')
const batchApprovalRef = ref<{ open: () => Promise<void> } | null>(null)
const {
  isEditing, isNew, saving, editFields, flashId, isDirty, isFieldDirty, editable,
  beginCreate, beginEdit, cancel, closeKeepingDraft, markSaved, forgetDraft,
} = useJournalEdit('pressure-tests', recordForm, selected)

const startEdit = () => beginEdit()

const cancelEdit = async () => {
  if (!(await cancel())) return
  if (isNew.value) detailsVisible.value = false
}

// Карточка закрыта крестиком или Esc во время правки — черновик остаётся до следующего открытия
watch(detailsVisible, (open) => {
  if (!open) closeKeepingDraft()
})

const createPressureTest = async () => {
  creating.value = true
  await loadLookups()
  creating.value = false
  selected.value = null
  detailsError.value = ''
  detailsVisible.value = true
  // gid6 OnOpresAddPlan: вид испытания 1, состояние «План»
  await beginCreate({ name: 'Контур опрессовки', state_id: 1 })
}

const saveChanges = async () => {
  saving.value = true
  detailsError.value = ''
  try {
    const id = await recordForm.save({
      isNew: isNew.value, id: selected.value?.id, original: selected.value as Record<string, unknown> | null,
      edited: editFields.value, mode: isNew.value ? 'plan' : undefined,
    })
    markSaved(id)
    await loadTests()
    if (id) await openDetails(id)
  } catch (e: any) {
    recordForm.showError(formatApiError(e, 'Ошибка при сохранении'))
  } finally {
    saving.value = false
  }
}

const deletePressureTest = async (id: number) => {
  deleting.value = true
  try {
    if (await recordForm.remove(id, selected.value?.name || `Опрессовка ${id}`)) {
      forgetDraft(id)
      detailsVisible.value = false
      await loadTests()
    }
  } finally {
    deleting.value = false
  }
}

const refreshSelected = async () => {
  if (!selected.value) return
  try { selected.value = await fastApiService.getPressureTest(selected.value.id) } catch { /* остаётся прежняя */ }
  void loadTests()
}

let restoreState: { list: boolean; details: boolean } | null = null
const hideForMap = () => {
  restoreState = { list: visible.value, details: detailsVisible.value }
  detailsVisible.value = false
  visible.value = false
}
const restoreAfterMap = () => {
  if (!restoreState) return
  visible.value = restoreState.list
  detailsVisible.value = restoreState.details
  restoreState = null
}

const exportWord = async () => {
  if (!selected.value) return
  exportingWord.value = true
  try {
    const { blob, filename } = await fastApiService.downloadOpsWordReport('opres', selected.value.id)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch (e: any) {
    detailsError.value = formatApiError(e, 'Не удалось сформировать Word')
  } finally {
    exportingWord.value = false
  }
}

watch(page, () => { if (visible.value) void loadTests() })
watch([stateId, testTypeId, heatSourceId, responsibleId, approved, dateFrom, dateTo], () => { if (visible.value) { page.value = 1; void loadTests() } })
defineExpose({ openDialog })
</script>

<style scoped>
.pressure-journal { height: min(90vh, 900px); display: flex; flex-direction: column; }
.pressure-kpi { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.pressure-filters { flex-shrink: 0; background: rgba(var(--v-theme-on-surface), 0.02); }
.pressure-table-wrap { min-height: 280px; overflow: auto; flex: 1; }
.pressure-table { min-width: 1340px; }
.result-cell { display: inline-block; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: bottom; }
@media (max-width: 600px) { .pressure-journal { height: 100dvh; } }
</style>
