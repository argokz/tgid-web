<template>
  <Teleport to="body">
    <v-dialog
      v-model="visible"
      :fullscreen="isMobile"
      max-width="1240"
      scrollable
    >
      <v-card
        class="shurf-journal"
        :rounded="isMobile ? 0 : 'lg'"
      >
        <v-card-title class="d-flex align-center ga-3 px-4 py-3">
          <v-avatar
            color="brown-lighten-5"
            size="40"
          >
            <v-icon color="brown-darken-2">mdi-shovel</v-icon>
          </v-avatar>
          <div
            class="flex-grow-1"
            style="min-width: 0"
          >
            <div class="text-subtitle-1 font-weight-bold">Журнал шурфовок</div>
            <div class="text-caption text-medium-emphasis text-truncate">
              {{ scopeTitle }} · найдено {{ total }}
            </div>
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
            @click="createShurf"
            :loading="creating"
          >
            Создать
          </v-btn>
          <v-btn
            icon
            variant="text"
            aria-label="Закрыть журнал"
            @click="visible = false"
          >
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>

        <v-divider />

        <div class="pa-3 pa-md-4 shurf-filters">
          <v-row dense>
            <v-col
              cols="12"
              md="4"
            >
              <v-text-field
                v-model="search"
                label="Поиск по ID, адресу, акту или результату"
                prepend-inner-icon="mdi-magnify"
                density="compact"
                variant="outlined"
                clearable
                hide-details
              />
            </v-col>
            <v-col
              cols="12"
              sm="4"
              md="2"
            >
              <v-select
                v-model="purposeId"
                :items="lookups.purposes"
                item-title="name"
                item-value="id"
                label="Назначение"
                density="compact"
                variant="outlined"
                clearable
                hide-details
              />
            </v-col>
            <v-col
              cols="12"
              sm="4"
              md="2"
            >
              <v-select
                v-model="stateId"
                :items="lookups.states"
                item-title="name"
                item-value="id"
                label="Состояние"
                density="compact"
                variant="outlined"
                clearable
                hide-details
              />
            </v-col>
            <v-col
              cols="12"
              sm="4"
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
              sm="4"
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
            <v-select
              v-model="approvalFilter"
              :items="approvalOptions"
              item-title="title"
              item-value="value"
              label="Утверждение"
              density="compact"
              variant="outlined"
              clearable
              hide-details
              class="approval-filter"
            />
            <v-spacer />
            <v-btn
              variant="text"
              prepend-icon="mdi-filter-remove-outline"
              @click="resetFilters"
            >Сбросить</v-btn>
            <v-btn
              color="primary"
              prepend-icon="mdi-refresh"
              :loading="loading"
              @click="loadShurfs"
            >Обновить</v-btn>
          </div>
        </div>

        <v-divider />

        <v-card-text class="pa-0 shurf-table-wrap">
          <v-progress-linear
            v-if="loading"
            indeterminate
            color="primary"
          />
          <v-alert
            v-if="error"
            type="error"
            variant="tonal"
            class="ma-4"
          >{{ error }}</v-alert>

          <div
            v-else-if="!loading && items.length === 0"
            class="shurf-empty"
          >
            <v-icon
              size="56"
              color="grey-lighten-1"
            >mdi-shovel-off</v-icon>
            <div class="text-subtitle-1 mt-3">Шурфовки не найдены</div>
            <div class="text-body-2 text-medium-emphasis mt-1">
              Измените фильтры или проверьте загрузку исторических данных TGID.
            </div>
          </div>

          <v-table
            v-else
            fixed-header
            hover
            density="compact"
            class="shurf-table"
          >
            <thead>
              <tr>
                <th>ID</th>
                <th>Срок</th>
                <th>Назначение</th>
                <th>Состояние</th>
                <th>Адрес / участок</th>
                <th>Результат</th>
                <th>Утверждение</th>
                <th class="text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in items"
                :key="item.id"
                class="shurf-row"
                @click="openDetails(item.id)"
              >
                <td class="font-weight-medium">{{ item.id }}</td>
                <td>{{ dateRange(item.effective_start, item.effective_finish) }}</td>
                <td>{{ item.purpose_name || '—' }}</td>
                <td>
                  <v-chip
                    size="x-small"
                    :color="stateColor(item.state_id)"
                    variant="tonal"
                  >
                    {{ item.state_name || 'Не задано' }}
                  </v-chip>
                </td>
                <td>
                  <div>{{ item.address || nodeRange(item) || '—' }}</div>
                  <div
                    v-if="item.line_id"
                    class="text-caption text-medium-emphasis"
                  >Линия {{ item.line_id }}</div>
                </td>
                <td class="result-cell">{{ item.inspection_results || item.planned_measures || item.note || '—' }}</td>
                <td>
                  <v-chip
                    size="x-small"
                    :color="item.approval_id ? 'success' : 'grey'"
                    variant="tonal"
                  >
                    {{ item.approval_name }}
                  </v-chip>
                </td>
                <td class="text-right text-no-wrap">
                  <v-btn
                    v-if="hasCoordinates(item)"
                    icon="mdi-crosshairs-gps"
                    size="x-small"
                    variant="text"
                    color="primary"
                    aria-label="Показать шурф на карте"
                    @click.stop="locate(item)"
                  />
                  <v-btn
                    icon="mdi-chevron-right"
                    size="x-small"
                    variant="text"
                    @click.stop="openDetails(item.id)"
                  />
                </td>
              </tr>
            </tbody>
          </v-table>
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
      max-width="940"
      scrollable
      eager
    >
      <v-card :rounded="isMobile ? 0 : 'lg'">
        <v-card-title class="d-flex align-center ga-3 px-4 py-3">
          <v-icon color="brown-darken-2">mdi-shovel</v-icon>
          <div class="flex-grow-1">
            <div class="text-subtitle-1 font-weight-bold">Шурфовка {{ selected?.id || '' }}</div>
            <div class="text-caption text-medium-emphasis">
              {{ selected?.purpose_name || 'Назначение не указано' }} · {{ selected?.state_name || 'Состояние не указано' }}
            </div>
          </div>
          <v-btn
            v-if="mutationsEnabled && selected"
            icon
            variant="text"
            aria-label="Удалить"
            color="error"
            class="mr-1"
            @click="deleteShurf(selected.id)"
            :loading="deleting"
            title="Удалить шурфовку"
          >
            <v-icon>mdi-delete</v-icon>
          </v-btn>
          <v-btn
            icon
            variant="text"
            @click="detailsVisible = false"
          ><v-icon>mdi-close</v-icon></v-btn>
        </v-card-title>
        <v-divider />

        <v-card-text class="pa-4">
          <div
            v-if="detailsLoading"
            class="d-flex justify-center pa-10"
          ><v-progress-circular
            indeterminate
            color="primary"
          /></div>
          <v-alert
            v-else-if="detailsError"
            type="error"
            variant="tonal"
          >{{ detailsError }}</v-alert>
          <template v-else-if="selected || isEditing">
            <v-btn-toggle
              v-if="isNew"
              v-model="createMode"
              mandatory
              density="compact"
              color="brown"
              class="mb-3"
            >
              <v-btn value="plan">Плановый шурф</v-btn>
              <v-btn value="unplanned">Внеплановый</v-btn>
            </v-btn-toggle>
            <v-expansion-panels
              multiple
              variant="accordion"
              :model-value="[0, 1]"
            >
              <v-expansion-panel
                v-for="(group, index) in detailGroups"
                :key="group.title"
                :value="index"
              >
                <v-expansion-panel-title>{{ group.title }}</v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-row dense>
                    <v-col
                      v-for="field in group.fields"
                      :key="field.label"
                      cols="12"
                      sm="6"
                    >
                      <div class="detail-label mb-1">{{ field.label }}</div>
                      <template v-if="isEditing && field.key && isWritable(field.key)">
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
                          v-else-if="field.type === 'date'"
                          v-model="editFields[field.key]"
                          type="date"
                          density="compact"
                          hide-details
                          variant="outlined"
                        />
                        <v-textarea
                          v-else-if="field.type === 'textarea'"
                          v-model="editFields[field.key]"
                          rows="2"
                          density="compact"
                          hide-details
                          variant="outlined"
                        />
                        <v-text-field
                          v-else
                          v-model="editFields[field.key]"
                          density="compact"
                          hide-details
                          variant="outlined"
                        />
                      </template>
                      <div
                        v-else
                        class="detail-value"
                      >{{ field.value }}</div>
                    </v-col>
                  </v-row>
                </v-expansion-panel-text>
              </v-expansion-panel>

              <v-expansion-panel
                v-if="inspectedElements.length && !isEditing"
                :value="detailGroups.length"
              >
                <v-expansion-panel-title>Осмотренные элементы</v-expansion-panel-title>
                <v-expansion-panel-text>
                  <div class="d-flex flex-wrap ga-1">
                    <v-chip
                      v-for="element in inspectedElements"
                      :key="Number(element.id)"
                      size="small"
                      variant="tonal"
                    >
                      {{ element.name }}
                    </v-chip>
                  </div>
                </v-expansion-panel-text>
              </v-expansion-panel>

              <v-expansion-panel
                v-if="relatedDefects.length && !isEditing"
                :value="detailGroups.length + 1"
              >
                <v-expansion-panel-title>Нарушения, выявленные в шурфе</v-expansion-panel-title>
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
                v-if="documents.length && !isEditing"
                :value="detailGroups.length + 2"
              >
                <v-expansion-panel-title>Документы</v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-list density="compact">
                    <v-list-item
                      v-for="document in documents"
                      :key="Number(document.id)"
                      prepend-icon="mdi-file-document-outline"
                      :title="String(document.document_type_name || 'Документ')"
                      :subtitle="`${formatDate(document.date_doc)} · ${fileName(document.path)}`"
                    />
                  </v-list>
                </v-expansion-panel-text>
              </v-expansion-panel>

              <v-expansion-panel
                v-if="nearbyCommunications.length && !isEditing"
                :value="detailGroups.length + 3"
              >
                <v-expansion-panel-title>Коммуникации вблизи шурфа</v-expansion-panel-title>
                <v-expansion-panel-text>
                  <div class="d-flex flex-wrap ga-1">
                    <v-chip
                      v-for="communication in nearbyCommunications"
                      :key="Number(communication.id)"
                      size="small"
                      variant="tonal"
                    >
                      {{ communication.name }}
                    </v-chip>
                  </div>
                </v-expansion-panel-text>
              </v-expansion-panel>

              <v-expansion-panel
                v-if="riskFactors.length && !isEditing"
                :value="detailGroups.length + 4"
              >
                <v-expansion-panel-title>Факторы риска трубопровода</v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-list
                    density="compact"
                    lines="two"
                  >
                    <v-list-item
                      v-for="risk in riskFactors"
                      :key="Number(risk.id)"
                      prepend-icon="mdi-shield-alert-outline"
                      :title="`Фактор риска ${risk.id}${risk.pipe_section_id ? ` · участок ${risk.pipe_section_id}` : ''}`"
                      :subtitle="riskSummary(risk)"
                    />
                  </v-list>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
            <JournalRecordPanels
              v-if="selected && !isEditing"
              class="mt-4"
              journal="shurfs"
              :record-id="selected.id"
              :record-label="selected.address || `Шурф ${selected.id}`"
              @changed="refreshSelected"
              @hide="hideForMap"
              @restore="restoreAfterMap"
            />
          </template>
        </v-card-text>

        <v-divider />
        <v-card-actions class="px-4 py-3">
          <v-btn
            v-if="selected && hasCoordinates(selected) && !isEditing"
            prepend-icon="mdi-crosshairs-gps"
            variant="tonal"
            color="primary"
            @click="locate(selected)"
          >На карте</v-btn>
          <v-spacer />
          <template v-if="isEditing">
            <v-btn
              v-if="mutationsEnabled"
              variant="text"
              @click="cancelEdit"
            >Отмена</v-btn>
            <v-btn
              v-if="mutationsEnabled"
              color="primary"
              variant="elevated"
              :loading="saving"
              @click="saveChanges"
            >
              Сохранить
            </v-btn>
          </template>
          <template v-else>
            <v-btn
              v-if="mutationsEnabled"
              color="primary"
              variant="tonal"
              @click="startEdit"
            >Редактировать</v-btn>
            <v-btn
              v-if="selected"
              variant="tonal"
              prepend-icon="mdi-file-word-outline"
              :loading="exportingWord"
              @click="exportWord"
            >Word</v-btn>
            <v-btn
              variant="text"
              @click="detailsVisible = false"
            >Закрыть</v-btn>
          </template>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <JournalBatchApprovalDialog
      ref="batchApprovalRef"
      journal="shurfs"
      @approved="loadShurfs"
    />
  </Teleport>
</template>

<script setup lang="ts">
import { formatApiError } from '~/utils/apiError'
import { computed, reactive, ref, watch } from 'vue'
import { useMobile } from '~/composables/useMobile'
import { useMutationsEnabled } from '~/composables/useMutationsEnabled'
import { useJournalRecordForm } from '~/composables/useJournalRecordForm'
import {
  fastApiService,
  type ShurfDetails,
  type ShurfLookups,
  type ShurfSummary
} from '~/services/fastApiService'

export interface ShurfJournalScope {
  lineId?: number
  nodeId?: number
  shurfId?: number
}

const emit = defineEmits<{
  'locate-shurf': [coordinates: { longitude: number; latitude: number; id: number }]
  'open-defect': [defectId: number]
}>()
const { isMobile } = useMobile()
const mutationsEnabled = useMutationsEnabled()
const visible = ref(false)
const loading = ref(false)
const error = ref('')
const items = ref<ShurfSummary[]>([])
const total = ref(0)
const pages = ref(0)
const page = ref(1)
const pageSize = 50
const search = ref('')
const purposeId = ref<number | undefined>()
const stateId = ref<number | undefined>()
const approvalFilter = ref<boolean | undefined>()
const dateFrom = ref('')
const dateTo = ref('')
const scope = reactive<ShurfJournalScope>({})
const lookups = reactive<ShurfLookups>({ purposes: [], states: [], materials: [] })
const approvalOptions = [
  { title: 'Утверждено', value: true },
  { title: 'Не утверждено', value: false }
]
let searchTimer: ReturnType<typeof setTimeout> | undefined

const detailsVisible = ref(false)
const detailsLoading = ref(false)
const detailsError = ref('')
const selected = ref<ShurfDetails | null>(null)
const creating = ref(false)
const deleting = ref(false)
const exportingWord = ref(false)

const isEditing = ref(false)
const isNew = ref(false)
const saving = ref(false)
const editFields = ref<Record<string, any>>({})

const scopeTitle = computed(() => {
  if (scope.lineId) return `шурфовки трубопровода ${scope.lineId}`
  if (scope.nodeId) return `шурфовки прилегающих трубопроводов узла ${scope.nodeId}`
  return 'вся тепловая сеть'
})

const formatDate = (value: unknown) => {
  if (!value) return '—'
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[3]}.${match[2]}.${match[1]}` : String(value)
}
const formatValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return formatDate(value)
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет'
  return String(value)
}
const dateRange = (start: unknown, finish: unknown) => {
  if (!start && !finish) return '—'
  return [formatDate(start), formatDate(finish)].filter(value => value !== '—').join(' — ')
}
const nodeRange = (item: ShurfSummary) => [item.line_start_node, item.line_end_node].filter(Boolean).join(' — ')
const stateColor = (id: number | null) => id === 3 ? 'success' : id === 2 ? 'warning' : 'info'
const hasCoordinates = (item: Pick<ShurfSummary, 'longitude' | 'latitude'>) =>
  Number.isFinite(Number(item.longitude)) && Number.isFinite(Number(item.latitude))
const fileName = (path: unknown) => String(path || 'Файл не указан').split(/[\\/]/).pop() || 'Файл'
const riskSummary = (risk: Record<string, unknown>) => [
  risk.ground_name && `грунт: ${risk.ground_name}`,
  risk.surface_name && `поверхность: ${risk.surface_name}`,
  risk.nearby_communications_name && `коммуникации: ${risk.nearby_communications_name}`,
  risk.glubina_kor && `глубина коррозии: ${risk.glubina_kor}`,
  risk.razmery_kor && `размер коррозии: ${risk.razmery_kor}`
].filter(Boolean).join(' · ') || 'Параметры не заполнены'

const loadLookups = async () => {
  if (lookups.purposes.length) return
  Object.assign(lookups, await fastApiService.getShurfLookups())
}
const loadShurfs = async () => {
  loading.value = true
  error.value = ''
  try {
    const response = await fastApiService.getShurfs({
      page: page.value,
      page_size: pageSize,
      purpose_id: purposeId.value,
      state_id: stateId.value,
      approved: approvalFilter.value,
      date_from: dateFrom.value || undefined,
      date_to: dateTo.value || undefined,
      line_id: scope.lineId,
      node_id: scope.nodeId,
      search: (search.value || '').trim() || undefined
    })
    items.value = response.items
    total.value = response.total
    pages.value = response.pages
  } catch (loadError: any) {
    error.value = loadError?.data?.detail || loadError?.message || 'Не удалось загрузить журнал шурфовок'
  } finally {
    loading.value = false
  }
}
const openDetails = async (id: number) => {
  detailsVisible.value = true
  detailsLoading.value = true
  detailsError.value = ''
  selected.value = null
  try {
    selected.value = await fastApiService.getShurf(id)
  } catch (loadError: any) {
    detailsError.value = loadError?.data?.detail || loadError?.message || 'Не удалось открыть карточку шурфа'
  } finally {
    detailsLoading.value = false
  }
}
const openDialog = async (nextScope: ShurfJournalScope = {}) => {
  Object.assign(scope, { lineId: undefined, nodeId: undefined, shurfId: undefined }, nextScope)
  page.value = 1
  visible.value = true
  try {
    await Promise.all([loadLookups(), loadShurfs(), recordForm.loadSchema()])
    if (nextScope.shurfId) await openDetails(nextScope.shurfId)
  } catch (loadError: any) {
    error.value = loadError?.message || 'Не удалось открыть журнал шурфовок'
  }
}
const clearScope = () => {
  scope.lineId = undefined
  scope.nodeId = undefined
  page.value = 1
  void loadShurfs()
}

const recordForm = useJournalRecordForm('shurfs')
const batchApprovalRef = ref<{ open: () => Promise<void> } | null>(null)
const isWritable = recordForm.isWritable
const createMode = ref<'plan' | 'unplanned'>('plan')

const createShurf = async () => {
  await recordForm.loadSchema()
  isNew.value = true
  isEditing.value = true
  createMode.value = 'plan'
  editFields.value = { line_id: scope.lineId ?? null }
  selected.value = null
  detailsVisible.value = true
  detailsError.value = ''
}

const startEdit = () => {
  if (!selected.value) return
  isNew.value = false
  isEditing.value = true
  editFields.value = { ...selected.value }
}

const cancelEdit = () => {
  isEditing.value = false
  if (isNew.value) detailsVisible.value = false
}

const saveChanges = async () => {
  saving.value = true
  detailsError.value = ''
  try {
    const id = await recordForm.save({
      isNew: isNew.value, id: selected.value?.id, original: selected.value as Record<string, unknown> | null,
      edited: editFields.value, mode: createMode.value,
    })
    isEditing.value = false
    isNew.value = false
    await loadShurfs()
    if (id) await openDetails(id)
  } catch (e: any) {
    recordForm.showError(formatApiError(e, 'Ошибка при сохранении'))
  } finally {
    saving.value = false
  }
}

const deleteShurf = async (id: number) => {
  deleting.value = true
  try {
    if (await recordForm.remove(id, selected.value?.address || `Шурф ${id}`)) {
      detailsVisible.value = false
      await loadShurfs()
    }
  } finally {
    deleting.value = false
  }
}

const refreshSelected = async () => {
  if (!selected.value) return
  try { selected.value = await fastApiService.getShurf(selected.value.id) } catch { /* остаётся прежняя */ }
  void loadShurfs()
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
const resetFilters = () => {
  search.value = ''
  purposeId.value = undefined
  stateId.value = undefined
  approvalFilter.value = undefined
  dateFrom.value = ''
  dateTo.value = ''
  page.value = 1
  void loadShurfs()
}
const locate = (item: ShurfSummary) => {
  if (!hasCoordinates(item)) return
  emit('locate-shurf', { longitude: Number(item.longitude), latitude: Number(item.latitude), id: item.id })
  detailsVisible.value = false
  visible.value = false
}
const openRelatedDefect = (id: number) => {
  detailsVisible.value = false
  visible.value = false
  emit('open-defect', id)
}
const buildFields = (entries: Array<[string, unknown, string?, string?, any?] | null>) => {
  return entries
    .filter(e => e != null)
    .map(e => e!)
    .filter(([, value]) => isEditing.value || (value !== null && value !== undefined && value !== ''))
    .map(([label, value, key, type, items]) => ({
      label,
      value: formatValue(value),
      rawValue: value,
      key,
      type: type || 'text',
      items
    }))
}

const detailGroups = computed(() => {
  const item = isEditing.value ? editFields.value : selected.value
  if (!item && !isNew.value) return []

  return [
    { title: 'План и местоположение', fields: buildFields([
      ['Название', item?.name, 'name', 'text'],
      ['Назначение вскрытия', item?.purpose_name, 'purpose_id', 'select', lookups.purposes], 
      ['Состояние', item?.state_name, 'state_id', 'select', lookups.states],
      ['Материалы', item?.material_name, 'material_id', 'select', lookups.materials],
      ['Плановое начало', item?.planned_start, 'planned_start', 'date'], 
      ['Плановое окончание', item?.planned_finish, 'planned_finish', 'date'],
      ['Фактическое начало', item?.actual_start, 'actual_start', 'date'], 
      ['Фактическое окончание', item?.actual_finish, 'actual_finish', 'date'],
      ['Адрес', item?.address], ['Номер дома', item?.house_number, 'house_number', 'text'],
      ['Трубопровод', item?.line_id, 'line_id', 'number'], 
      ['Начальный узел', item?.line_start_node],
      ['Конечный узел', item?.line_end_node], 
      ['Ближайшая камера', item?.nearest_chamber_name],
      ['Расстояние до камеры, м', item?.distance_to_nearest_chamber, 'distance_to_nearest_chamber', 'number'],
      ['Длина осмотра, м', item?.inspection_length, 'inspection_length', 'number'],
      ['Глубина заложения, м', item?.laying_depth, 'laying_depth', 'number']
    ]) },
    { title: 'Условия вскрытия и канал', fields: buildFields([
      ['Характер грунта', item?.ground_name], ['Поверхность над трассой', item?.surface_name],
      ['Подтопление до трубы', item?.podtoplenie_do_truby], ['Устройство водоотведения', item?.drainage_name],
      ['Коммуникации вблизи', item?.nearby_communication_name], ['Электрифицированный транспорт', item?.nearby_electric_transport],
      ['Расстояние до рельсов, м', item?.distance_to_rails], ['Электрозащитные установки', item?.nearby_electroprotection],
      ['Строительная конструкция канала', item?.channel_structure_name], ['Состояние конструкции канала', item?.channel_structure_state_name],
      ['Внутреннее состояние канала', item?.channel_inside_name], ['Дренажная конструкция', item?.drain_structure_name],
      ['Занос канала грунтом', item?.ground_fill_name]
    ]) },
    { title: 'Осмотр трубопроводов', fields: buildFields([
      ['Гидроизоляция подачи', item?.waterproof_flow_name], ['Гидроизоляция обратки', item?.waterproof_return_name],
      ['Теплоизоляция подачи', item?.insulation_flow_name], ['Теплоизоляция обратки', item?.insulation_return_name],
      ['Наружное покрытие подачи', item?.outer_cover_flow_name], ['Наружное покрытие обратки', item?.outer_cover_return_name],
      ['Противокоррозионное покрытие подачи', item?.anticorrosion_flow_name], ['Противокоррозионное покрытие обратки', item?.anticorrosion_return_name],
      ['Коррозия подачи', item?.corrosion_flow_name], ['Коррозия обратки', item?.corrosion_return_name],
      ['Место контрольной вырезки', item?.control_cut_location, 'control_cut_location', 'text'], ['Результаты вырезки', item?.cut_results, 'cut_results', 'textarea'],
      ['Результаты осмотра', item?.inspection_results, 'inspection_results', 'textarea'], ['Назначенные мероприятия', item?.planned_measures, 'planned_measures', 'textarea'],
      ['Восстановление прокладки', item?.restoration_measures, 'restoration_measures', 'textarea'], ['Примечание', item?.note, 'note', 'textarea']
    ]) },
    { title: 'Акт и утверждение', fields: buildFields([
      ['Номер акта', item?.act_number, 'act_number', 'text'], ['Дата утверждения акта', item?.act_approved_on, 'act_approved_on', 'date'],
      ['Состояние утверждения', item?.approval_name], ['Дата утверждения плана', item?.approved_on],
      ['Назначение', item?.approval_purpose], ['ФИО утверждающего', item?.approver_name],
      ['Должность утверждающего', item?.approver_position], ['Служба утверждающего', item?.approver_service],
      ['ФИО визирующего', item?.reviewer_name], ['Должность визирующего', item?.reviewer_position],
      ['Член комиссии 1', item?.commission_member_1, 'commission_member_1', 'text'], ['Член комиссии 2', item?.commission_member_2, 'commission_member_2', 'text']
    ]) }
  ].filter(group => group.fields.length)
})

const inspectedElements = computed(() => selected.value?.relations?.inspected_elements || [])
const relatedDefects = computed(() => selected.value?.relations?.defects || [])
const documents = computed(() => selected.value?.relations?.documents || [])
const nearbyCommunications = computed(() => selected.value?.relations?.nearby_communications || [])
const riskFactors = computed(() => selected.value?.relations?.risk_factors || [])

watch(page, () => { if (visible.value) void loadShurfs() })
watch([purposeId, stateId, approvalFilter, dateFrom, dateTo], () => {
  if (!visible.value) return
  page.value = 1
  void loadShurfs()
})
watch(search, () => {
  if (!visible.value) return
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { page.value = 1; void loadShurfs() }, 350)
})

const exportWord = async () => {
  if (!selected.value) return
  exportingWord.value = true
  try {
    const { blob, filename } = await fastApiService.downloadOpsWordReport('shurf', selected.value.id)
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
defineExpose({ openDialog })
</script>

<style scoped>
.shurf-journal { height: min(88vh, 880px); display: flex; flex-direction: column; }
.shurf-filters { flex-shrink: 0; background: #fafafa; }
.approval-filter { min-width: 220px; max-width: 300px; }
.shurf-table-wrap { min-height: 280px; overflow: auto; flex: 1; }
.shurf-table { min-width: 1080px; }
.shurf-row { cursor: pointer; }
.result-cell { max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.shurf-empty { min-height: 320px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 32px; }
.detail-label { color: #78909c; font-size: .72rem; font-weight: 600; letter-spacing: .03em; text-transform: uppercase; }
.detail-value { color: #263238; font-size: .9rem; margin-top: 3px; overflow-wrap: anywhere; }
@media (max-width: 600px) { .shurf-journal { height: 100dvh; } }
</style>

