<template>
  <v-dialog
    v-model="visible"
    :max-width="1100"
    :fullscreen="isMobile"
    scrollable
  >
    <v-card>
      <v-card-title class="d-flex align-center py-3 px-4">
        <v-icon
          class="mr-2"
          color="primary"
        >
          mdi-clipboard-list-outline
        </v-icon>
        <span class="text-h6 flex-grow-1">Наряды и заявки</span>
        <v-btn
          v-if="canEdit"
          color="primary"
          variant="tonal"
          prepend-icon="mdi-plus"
          class="mr-2"
          @click="startCreate()"
        >
          Наряд
        </v-btn>
        <HintTip text="Закрыть">
          <template #default="{ props: tip }">
            <v-btn
              v-bind="tip"
              icon="mdi-close"
              variant="text"
              size="small"
              aria-label="Закрыть"
              @click="visible = false"
            />
          </template>
        </HintTip>
      </v-card-title>
      <v-divider />

      <v-card-text class="pa-4">
        <v-alert
          v-if="errorMessage"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-3"
          closable
          @click:close="errorMessage = ''"
        >
          {{ errorMessage }}
        </v-alert>

        <div class="wo-tiles mb-3">
          <KpiTile
            v-for="s in STATUS_ORDER"
            :key="s"
            :label="statusLabel(s)"
            :value="list?.counts[s] ?? 0"
            :compact="false"
            selectable
            :active="statusFilter === s"
            @select="statusFilter = statusFilter === s ? null : s"
          />
          <KpiTile
            label="Просрочено"
            :value="list?.overdue ?? 0"
            :status="(list?.overdue ?? 0) > 0 ? 'serious' : undefined"
            :compact="false"
          />
        </div>

        <div class="d-flex flex-wrap align-center ga-2 mb-3">
          <v-text-field
            v-model="search"
            prepend-inner-icon="mdi-magnify"
            placeholder="Номер, название, описание"
            density="compact"
            variant="outlined"
            hide-details
            clearable
            class="wo-search"
          />
          <v-checkbox
            v-model="onMap"
            label="Открытые на карте"
            density="compact"
            hide-details
          />
        </div>

        <div class="wo-body">
          <div class="wo-list">
            <DataTable
              :columns="columns"
              :items="rows"
              item-key="id"
              :loading="loading"
              selectable
              :height="440"
              no-data-text="Нарядов нет"
              @select="(row) => select(Number(row.id))"
            >
              <template #[`item.priority_label`]="{ item }">
                <v-chip
                  size="x-small"
                  :color="PRIORITY_COLORS[Number(item.priority)]"
                  variant="tonal"
                >
                  {{ item.priority_label }}
                </v-chip>
              </template>
              <template #[`item.status_label`]="{ item }">
                <v-chip
                  size="x-small"
                  :color="STATUS_META[item.status as WorkOrderStatus].color"
                  variant="tonal"
                >
                  {{ item.status_label }}
                </v-chip>
              </template>
              <template #[`item.planned_finish`]="{ item }">
                <span :class="{ 'text-error': item.overdue }">{{ formatDateTime(item.planned_finish as string) }}</span>
              </template>
            </DataTable>
          </div>

          <!-- карточка наряда или форма нового -->
          <div class="wo-card">
            <template v-if="mode === 'create'">
              <div class="text-subtitle-1 mb-2">
                Новый наряд
              </div>
              <v-text-field
                v-model="form.title"
                label="Что сделать"
                density="compact"
                variant="outlined"
                maxlength="300"
                class="mb-2"
              />
              <div class="d-flex ga-2">
                <AppSelect
                  v-model="form.kind"
                  :items="lookups?.kinds ?? []"
                  item-title="label"
                  item-value="value"
                  label="Вид работ"
                  :clearable="false"
                  :searchable="false"
                  class="wo-field"
                />
                <AppSelect
                  v-model="form.priority"
                  :items="lookups?.priorities ?? []"
                  item-title="label"
                  item-value="value"
                  label="Срочность"
                  :clearable="false"
                  :searchable="false"
                  class="wo-field"
                />
              </div>
              <div class="d-flex ga-2">
                <v-text-field
                  v-model.number="form.defect_id"
                  label="Дефект №"
                  type="number"
                  density="compact"
                  variant="outlined"
                  hint="Участок, точка и описание — из дефекта"
                  persistent-hint
                />
                <v-text-field
                  v-model.number="form.line_id"
                  label="Участок (id)"
                  type="number"
                  density="compact"
                  variant="outlined"
                />
              </div>
              <div class="d-flex ga-2 mt-2">
                <AppSelect
                  v-model="form.brigade_id"
                  :items="lookups?.brigades ?? []"
                  item-title="name"
                  item-value="id"
                  label="Бригада"
                  class="wo-field"
                />
                <AppSelect
                  v-model="form.responsible_id"
                  :items="lookups?.responsibles ?? []"
                  item-title="name"
                  item-value="id"
                  label="Ответственный"
                  class="wo-field"
                />
              </div>
              <div class="d-flex ga-2">
                <v-text-field
                  v-model="form.planned_start"
                  label="Начало по плану"
                  type="datetime-local"
                  density="compact"
                  variant="outlined"
                />
                <v-text-field
                  v-model="form.planned_finish"
                  label="Срок"
                  type="datetime-local"
                  density="compact"
                  variant="outlined"
                />
              </div>
              <v-textarea
                v-model="form.description"
                label="Описание"
                rows="3"
                auto-grow
                density="compact"
                variant="outlined"
                maxlength="5000"
              />
              <div class="d-flex ga-2">
                <v-btn
                  color="primary"
                  :loading="saving"
                  :disabled="!form.title.trim()"
                  @click="create"
                >
                  Создать
                </v-btn>
                <v-btn
                  variant="text"
                  @click="mode = 'view'"
                >
                  Отмена
                </v-btn>
              </div>
            </template>

            <template v-else-if="current">
              <div class="d-flex align-center ga-2 mb-1">
                <span class="text-subtitle-1 font-weight-medium">{{ current.number }}</span>
                <v-chip
                  size="small"
                  :color="STATUS_META[current.status].color"
                  :prepend-icon="STATUS_ICONS[current.status]"
                  variant="tonal"
                >
                  {{ current.status_label }}
                </v-chip>
                <v-chip
                  size="small"
                  :color="PRIORITY_COLORS[current.priority]"
                  variant="tonal"
                >
                  {{ current.priority_label }}
                </v-chip>
                <v-spacer />
                <HintTip
                  v-if="current.lon != null && current.lat != null"
                  text="Показать на карте"
                >
                  <template #default="{ props: tip }">
                    <v-btn
                      v-bind="tip"
                      icon="mdi-crosshairs-gps"
                      variant="text"
                      size="small"
                      aria-label="Показать на карте"
                      @click="emit('focus-coords', current.lon!, current.lat!)"
                    />
                  </template>
                </HintTip>
              </div>
              <div class="text-body-1 mb-1">
                {{ current.title }}
              </div>
              <div class="text-caption text-medium-emphasis mb-2">
                {{ current.kind_label }} · {{ placeText(current) }}
              </div>
              <p
                v-if="current.description"
                class="text-body-2 mb-2 wo-pre"
              >
                {{ current.description }}
              </p>

              <div class="d-flex ga-2">
                <AppSelect
                  v-model="edit.brigade_id"
                  :items="lookups?.brigades ?? []"
                  item-title="name"
                  item-value="id"
                  label="Бригада"
                  :disabled="!editable"
                  class="wo-field"
                />
                <AppSelect
                  v-model="edit.responsible_id"
                  :items="lookups?.responsibles ?? []"
                  item-title="name"
                  item-value="id"
                  label="Ответственный"
                  :disabled="!editable"
                  class="wo-field"
                />
              </div>
              <div class="d-flex ga-2 align-center">
                <v-text-field
                  v-model="edit.planned_finish"
                  label="Срок"
                  type="datetime-local"
                  density="compact"
                  variant="outlined"
                  :disabled="!editable"
                  :error="current.overdue"
                  :hint="current.overdue ? 'Срок прошёл' : ''"
                  persistent-hint
                />
                <v-btn
                  v-if="editable && editChanged"
                  variant="tonal"
                  :loading="saving"
                  @click="saveEdit"
                >
                  Сохранить
                </v-btn>
              </div>

              <v-textarea
                v-if="current.next.includes('done') || current.result"
                v-model="resultText"
                label="Что сделано"
                rows="2"
                auto-grow
                density="compact"
                variant="outlined"
                :disabled="!canEdit || !current.next.includes('done')"
                maxlength="5000"
              />

              <div
                v-if="canEdit && current.next.length"
                class="d-flex flex-wrap ga-2 mb-3"
              >
                <v-btn
                  v-for="to in current.next"
                  :key="to"
                  :color="isForward(current.status, to) ? 'primary' : undefined"
                  :variant="isForward(current.status, to) ? 'flat' : 'text'"
                  size="small"
                  :loading="moving === to"
                  :disabled="moving !== null"
                  @click="move(to)"
                >
                  {{ transitionLabel(current.status, to) }}
                </v-btn>
              </div>

              <div
                v-if="canEdit"
                class="d-flex ga-2 align-start mb-2"
              >
                <v-text-field
                  v-model="comment"
                  placeholder="Комментарий"
                  density="compact"
                  variant="outlined"
                  hide-details
                  maxlength="2000"
                  @keydown.enter.prevent="sendComment"
                />
                <v-btn
                  icon="mdi-send"
                  variant="text"
                  size="small"
                  aria-label="Добавить комментарий"
                  :disabled="!comment.trim()"
                  @click="sendComment"
                />
              </div>

              <div class="text-caption text-medium-emphasis mb-1">
                История
              </div>
              <v-timeline
                density="compact"
                side="end"
                truncate-line="both"
                class="wo-history"
              >
                <v-timeline-item
                  v-for="(e, i) in [...(current.events ?? [])].reverse()"
                  :key="i"
                  size="x-small"
                  :dot-color="e.to_status ? STATUS_META[e.to_status].color : 'grey-lighten-1'"
                >
                  <div class="text-body-2">
                    <strong v-if="e.to_label">{{ e.to_label }}</strong>
                    <span v-if="e.to_label && e.note"> — </span>{{ e.note }}
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    {{ formatDateTime(e.at) }} · {{ e.by_user || '—' }}
                  </div>
                </v-timeline-item>
              </v-timeline>
            </template>

            <p
              v-else
              class="text-body-2 text-medium-emphasis"
            >
              Выберите наряд в списке{{ canEdit ? ' или создайте новый' : '' }}.
            </p>
          </div>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AppSelect from '~/components/AppSelect.vue';
import DataTable, { type DataTableColumn } from '~/components/DataTable.vue';
import HintTip from '~/components/HintTip.vue';
import KpiTile from '~/components/KpiTile.vue';
import { useDialogMapOverlay } from '~/composables/useDialogMapOverlay';
import { useMobile } from '~/composables/useMobile';
import { fastApiService } from '~/services/fastApiService';
import { useAuthStore } from '~/stores/authStore';
import { formatApiError } from '~/utils/apiError';
import {
  PRIORITY_COLORS,
  STATUS_META,
  STATUS_ORDER,
  formatDateTime,
  fromInputDateTime,
  isForward,
  mapFeatures,
  placeText,
  toInputDateTime,
  transitionLabel,
  type WorkOrder,
  type WorkOrderKind,
  type WorkOrderList,
  type WorkOrderLookups,
  type WorkOrderStatus,
} from '~/utils/workOrders';

/**
 * Наряды и заявки (фаза 2): заявка или дефект → наряд → бригада → выполнение → закрытие. Список со
 * счётчиками по статусам, карточка с переходами и историей, открытые наряды на карте. Наряд по дефекту
 * при начале работ и выполнении сам ставит дефекту даты ремонта и состояние (itwin-api work_orders.py).
 */
const emit = defineEmits<{
  'show-on-map': [data: GeoJSON.FeatureCollection];
  'clear-highlight': [];
  'focus-coords': [lng: number, lat: number];
}>();

const visible = defineModel<boolean>({ default: false });
const overlay = useDialogMapOverlay(visible, () => emit('clear-highlight'));
const { isMobile } = useMobile();
const authStore = useAuthStore();
const canEdit = computed(() => authStore.canEditData);

const SEARCH_DEBOUNCE_MS = 300;
/** Значки статусов — здесь, а не в utils/workOrders.ts: они из ленивого набора иконок окон */
const STATUS_ICONS: Record<WorkOrderStatus, string> = {
  new: 'mdi-inbox-arrow-down-outline',
  assigned: 'mdi-account-hard-hat-outline',
  in_progress: 'mdi-progress-wrench',
  done: 'mdi-check',
  closed: 'mdi-check-all',
  cancelled: 'mdi-cancel',
};

const lookups = ref<WorkOrderLookups | null>(null);
const list = ref<WorkOrderList | null>(null);
const current = ref<WorkOrder | null>(null);
const loading = ref(false);
const saving = ref(false);
const moving = ref<WorkOrderStatus | null>(null);
const errorMessage = ref('');
const statusFilter = ref<WorkOrderStatus | null>(null);
const search = ref('');
const onMap = ref(false);
const mode = ref<'view' | 'create'>('view');
const comment = ref('');
const resultText = ref('');

interface FormState {
  title: string;
  kind: WorkOrderKind;
  priority: number;
  defect_id: number | null;
  line_id: number | null;
  brigade_id: number | null;
  responsible_id: number | null;
  planned_start: string;
  planned_finish: string;
  description: string;
}
const emptyForm = (): FormState => ({
  title: '', kind: 'repair', priority: 3, defect_id: null, line_id: null, brigade_id: null, responsible_id: null,
  planned_start: '', planned_finish: '', description: '',
});
const form = ref<FormState>(emptyForm());
const edit = ref({ brigade_id: null as number | null, responsible_id: null as number | null, planned_finish: '' });

const columns: DataTableColumn[] = [
  { key: 'number', title: '№', width: 120 },
  { key: 'title', title: 'Что сделать' },
  { key: 'priority_label', title: 'Срочность', width: 110 },
  { key: 'status_label', title: 'Статус', width: 110 },
  { key: 'planned_finish', title: 'Срок', width: 140 },
];
const rows = computed(() => (list.value?.items ?? []) as unknown as Record<string, unknown>[]);
const statusLabel = (s: WorkOrderStatus) => lookups.value?.statuses.find((x) => x.value === s)?.label ?? s;
const editable = computed(() => canEdit.value && !!current.value && !['closed', 'cancelled'].includes(current.value.status));
const editChanged = computed(() => {
  const o = current.value;
  if (!o) return false;
  return edit.value.brigade_id !== o.brigade_id || edit.value.responsible_id !== o.responsible_id
    || edit.value.planned_finish !== toInputDateTime(o.planned_finish);
});

const fail = (err: unknown, what: string) => {
  errorMessage.value = formatApiError(err, what);
};

const loadList = async () => {
  loading.value = true;
  try {
    list.value = await fastApiService.getWorkOrders({ status: statusFilter.value, q: search.value });
  } catch (err: unknown) {
    fail(err, 'Список нарядов не загружен');
  } finally {
    loading.value = false;
  }
};

const show = (order: WorkOrder) => {
  current.value = order;
  edit.value = {
    brigade_id: order.brigade_id, responsible_id: order.responsible_id,
    planned_finish: toInputDateTime(order.planned_finish),
  };
  resultText.value = order.result;
  mode.value = 'view';
};

const select = async (id: number) => {
  try {
    show(await fastApiService.getWorkOrder(id));
  } catch (err: unknown) {
    fail(err, 'Наряд не загружен');
  }
};

/** После записи: карточка из ответа, список и слой карты — заново */
const applied = async (order: WorkOrder) => {
  show(order);
  await loadList();
  if (onMap.value) await drawMap();
};

const startCreate = (prefill: Partial<FormState> = {}) => {
  form.value = { ...emptyForm(), ...prefill };
  mode.value = 'create';
};

const create = async () => {
  saving.value = true;
  errorMessage.value = '';
  try {
    const f = form.value;
    await applied(await fastApiService.createWorkOrder({
      title: f.title.trim(), kind: f.kind, priority: f.priority, description: f.description,
      defect_id: f.defect_id || null, line_id: f.line_id || null,
      brigade_id: f.brigade_id, responsible_id: f.responsible_id,
      planned_start: fromInputDateTime(f.planned_start), planned_finish: fromInputDateTime(f.planned_finish),
    }));
  } catch (err: unknown) {
    fail(err, 'Наряд не создан');
  } finally {
    saving.value = false;
  }
};

const saveEdit = async () => {
  const o = current.value;
  if (!o) return;
  saving.value = true;
  errorMessage.value = '';
  try {
    await applied(await fastApiService.updateWorkOrder(o.id, {
      revision: o.revision,
      brigade_id: edit.value.brigade_id ?? 0,
      responsible_id: edit.value.responsible_id ?? 0,
      planned_finish: fromInputDateTime(edit.value.planned_finish),
    }));
  } catch (err: unknown) {
    fail(err, 'Изменения не сохранены');
  } finally {
    saving.value = false;
  }
};

const move = async (to: WorkOrderStatus) => {
  const o = current.value;
  if (!o) return;
  moving.value = to;
  errorMessage.value = '';
  try {
    const result = to === 'done' ? resultText.value : null;
    await applied(await fastApiService.transitionWorkOrder(o.id, { to, revision: o.revision, result }));
  } catch (err: unknown) {
    fail(err, 'Статус не изменён');
  } finally {
    moving.value = null;
  }
};

const sendComment = async () => {
  const o = current.value;
  const text = comment.value.trim();
  if (!o || !text) return;
  try {
    show(await fastApiService.commentWorkOrder(o.id, text));
    comment.value = '';
  } catch (err: unknown) {
    fail(err, 'Комментарий не добавлен');
  }
};

const drawMap = async () => {
  try {
    emit('show-on-map', mapFeatures(await fastApiService.getWorkOrdersGeoJson()));
    overlay.markShown();
  } catch (err: unknown) {
    fail(err, 'Наряды на карте не показаны');
  }
};

watch(onMap, (on) => {
  if (on) void drawMap();
  else {
    emit('clear-highlight');
    overlay.markCleared();
  }
});

watch(statusFilter, () => void loadList());
let searchTimer: ReturnType<typeof setTimeout> | null = null;
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => void loadList(), SEARCH_DEBOUNCE_MS);
});

watch(visible, async (open) => {
  if (!open) return;
  if (!lookups.value) {
    try {
      lookups.value = await fastApiService.getWorkOrderLookups();
    } catch (err: unknown) {
      fail(err, 'Справочники нарядов не загружены');
    }
  }
  await loadList();
}, { immediate: true });

/** Открыть окно; defectId / lineId — сразу форма нового наряда по дефекту или участку */
const openDialog = (payload?: { defectId?: number; lineId?: number; title?: string }) => {
  visible.value = true;
  if (payload?.defectId || payload?.lineId) {
    startCreate({
      defect_id: payload.defectId ?? null, line_id: payload.lineId ?? null,
      title: payload.title ?? (payload.defectId ? `Устранить дефект №${payload.defectId}` : ''),
    });
  }
};

defineExpose({ openDialog });
</script>

<style scoped>
.wo-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: var(--space-2, 8px); }
.wo-search { flex: 1 1 260px; }
.wo-body { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: var(--space-4, 16px); }
.wo-card { min-width: 0; }
.wo-field { flex: 1 1 0; min-width: 0; }
.wo-pre { white-space: pre-wrap; }
.wo-history { max-height: 260px; overflow-y: auto; }
@media (max-width: 900px) {
  .wo-body { grid-template-columns: 1fr; }
}
</style>
