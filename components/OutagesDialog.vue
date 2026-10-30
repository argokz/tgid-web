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
          mdi-calendar-alert
        </v-icon>
        <span class="text-h6 flex-grow-1">Отключения</span>
        <v-btn
          v-if="canEdit"
          color="primary"
          variant="tonal"
          prepend-icon="mdi-plus"
          class="mr-2"
          @click="startCreate()"
        >
          Отключение
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

        <div class="out-tiles mb-3">
          <KpiTile
            v-for="s in OUTAGE_STATUS_ORDER"
            :key="s"
            :label="OUTAGE_STATUS_LABELS[s]"
            :value="list?.counts[s] ?? 0"
            :compact="false"
            :status="s === 'active' && (list?.counts.active ?? 0) > 0 ? 'serious' : undefined"
            selectable
            :active="statusFilter === s"
            @select="statusFilter = statusFilter === s ? null : s"
          />
        </div>

        <div class="d-flex flex-wrap align-center ga-2 mb-3">
          <v-text-field
            v-model="search"
            prepend-inner-icon="mdi-magnify"
            placeholder="Номер или название"
            density="compact"
            variant="outlined"
            hide-details
            clearable
            class="out-search"
          />
          <v-checkbox
            v-model="zonesOnMap"
            label="Зоны открытых на карте"
            density="compact"
            hide-details
          />
          <v-btn
            v-if="overlayShown"
            variant="tonal"
            size="small"
            @click="keepOnMap"
          >
            Оставить на карте
          </v-btn>
        </div>

        <div class="out-body">
          <DataTable
            :columns="columns"
            :items="rows"
            item-key="id"
            :loading="loading"
            selectable
            :height="440"
            no-data-text="Отключений нет"
            @select="(row) => select(Number(row.id))"
          >
            <template #[`item.status_label`]="{ item }">
              <v-chip
                size="x-small"
                :color="OUTAGE_STATUS_COLORS[item.status as OutageStatus]"
                variant="tonal"
              >
                {{ item.status_label }}
              </v-chip>
            </template>
            <template #[`item.planned_start`]="{ item }">
              {{ formatDateTime(item.planned_start as string) }}
            </template>
          </DataTable>

          <div class="out-card">
            <template v-if="mode === 'create'">
              <div class="text-subtitle-1 mb-2">
                Новое отключение
              </div>
              <v-text-field
                v-model="form.title"
                label="Название"
                density="compact"
                variant="outlined"
                maxlength="300"
              />
              <SegmentedToggle
                v-model="form.kind"
                :items="kindItems"
                aria-label="Вид отключения"
                class="mb-3"
              />
              <div class="d-flex ga-2">
                <v-text-field
                  v-model.number="form.line_id"
                  label="Участок (id)"
                  type="number"
                  density="compact"
                  variant="outlined"
                  class="out-field"
                />
                <v-text-field
                  v-model.number="form.node_id"
                  label="или узел (id)"
                  type="number"
                  density="compact"
                  variant="outlined"
                  class="out-field"
                />
              </div>
              <p
                v-if="form.work_order_id"
                class="text-caption text-medium-emphasis mt-n2 mb-2"
              >
                По наряду №{{ form.work_order_id }}{{ form.line_id || form.node_id ? '' : ' — место работ из наряда' }}
              </p>
              <div class="d-flex ga-2">
                <v-text-field
                  v-model="form.planned_start"
                  label="Отключить"
                  type="datetime-local"
                  density="compact"
                  variant="outlined"
                  class="out-field"
                />
                <v-text-field
                  v-model="form.planned_end"
                  label="Включить"
                  type="datetime-local"
                  density="compact"
                  variant="outlined"
                  class="out-field"
                />
              </div>
              <v-textarea
                v-model="form.reason"
                label="Причина"
                rows="2"
                auto-grow
                density="compact"
                variant="outlined"
                maxlength="2000"
              />
              <v-checkbox
                v-model="form.public"
                label="Показывать на публичной карте (зона и сроки, без потребителей)"
                density="compact"
                hide-details
              />
              <v-text-field
                v-if="form.public"
                v-model="form.public_note"
                label="Текст для жителей"
                density="compact"
                variant="outlined"
                maxlength="1000"
                class="mt-2"
              />
              <div class="d-flex ga-2 mt-2">
                <v-btn
                  color="primary"
                  :loading="saving"
                  :disabled="!createReady"
                  @click="create"
                >
                  Рассчитать и запланировать
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
                  :color="OUTAGE_STATUS_COLORS[current.status]"
                  variant="tonal"
                >
                  {{ current.status_label }}
                </v-chip>
                <v-chip
                  size="small"
                  :color="current.kind === 'emergency' ? 'error' : undefined"
                  variant="tonal"
                >
                  {{ current.kind_label }}
                </v-chip>
                <v-spacer />
                <HintTip text="Показать на карте">
                  <template #default="{ props: tip }">
                    <v-btn
                      v-bind="tip"
                      icon="mdi-crosshairs-gps"
                      variant="text"
                      size="small"
                      aria-label="Показать на карте"
                      @click="showCurrent"
                    />
                  </template>
                </HintTip>
              </div>
              <div class="text-body-1">
                {{ current.title }}
              </div>
              <div class="text-caption text-medium-emphasis mb-2">
                {{ formatDateTime(current.planned_start) }} — {{ formatDateTime(current.planned_end) }}
                ({{ durationText(current.planned_start, current.planned_end) }})
                <span v-if="current.actual_start"> · факт с {{ formatDateTime(current.actual_start) }}</span>
                <span v-if="current.actual_end"> по {{ formatDateTime(current.actual_end) }}</span>
              </div>
              <p
                v-if="current.reason"
                class="text-body-2 mb-2"
              >
                Причина: {{ current.reason }}
              </p>

              <div class="out-kpis mb-2">
                <KpiTile
                  label="Потребителей"
                  :value="current.consumers_count"
                  :compact="false"
                />
                <KpiTile
                  label="Нагрузка"
                  :value="current.load_gcal_h"
                  units="Гкал/ч"
                  :digits="2"
                />
                <KpiTile
                  label="Задвижек закрыть"
                  :value="current.valves?.length ?? 0"
                  :compact="false"
                />
              </div>

              <v-alert
                v-for="c in current.conflicts ?? []"
                :key="c.id"
                type="warning"
                variant="tonal"
                density="compact"
                class="mb-2"
              >
                Пересекается с {{ c.number }} «{{ c.title }}» ({{ formatDateTime(c.planned_start) }} —
                {{ formatDateTime(c.planned_end) }}): общих потребителей {{ c.shared_consumers }}
              </v-alert>
              <v-alert
                v-if="current.social?.length"
                type="info"
                variant="tonal"
                density="compact"
                icon="mdi-school-outline"
                class="mb-2"
              >
                <strong>Социальные объекты в зоне ({{ current.social.length }})</strong> — предупредить в первую очередь:
                <div
                  v-for="s in current.social"
                  :key="s.id"
                  class="text-body-2"
                >
                  {{ s.category_label }} — {{ s.name || 'без названия' }}<span v-if="s.address">, {{ s.address }}</span>
                </div>
              </v-alert>

              <div
                v-if="canEdit"
                class="d-flex flex-wrap ga-2 mb-2"
              >
                <v-btn
                  v-for="to in current.next"
                  :key="to"
                  :color="isOutageForward(current.status, to) ? 'primary' : undefined"
                  :variant="isOutageForward(current.status, to) ? 'flat' : 'text'"
                  size="small"
                  :loading="moving === to"
                  :disabled="moving !== null"
                  @click="move(to)"
                >
                  {{ outageTransitionLabel(current.status, to) }}
                </v-btn>
                <v-btn
                  v-if="current.recomputable"
                  variant="text"
                  size="small"
                  prepend-icon="mdi-refresh"
                  :loading="recomputing"
                  @click="recompute"
                >
                  Пересчитать
                </v-btn>
              </div>
              <div class="d-flex flex-wrap ga-2 mb-3">
                <v-btn
                  variant="tonal"
                  size="small"
                  prepend-icon="mdi-microsoft-excel"
                  :loading="exporting"
                  @click="downloadNotification"
                >
                  Список для уведомления
                </v-btn>
                <v-btn
                  variant="tonal"
                  size="small"
                  prepend-icon="mdi-content-copy"
                  @click="copyAnnouncement"
                >
                  Текст объявления
                </v-btn>
              </div>

              <v-expansion-panels
                variant="accordion"
                class="mb-2"
              >
                <v-expansion-panel :title="`Задвижки (${current.valves?.length ?? 0})`">
                  <v-expansion-panel-text>
                    <div
                      v-for="v in current.valves ?? []"
                      :key="v.id"
                      class="text-body-2"
                    >
                      <v-icon
                        size="14"
                        :color="v.required ? 'error' : 'grey'"
                      >
                        mdi-valve-closed
                      </v-icon>
                      {{ v.name || `Задвижка ${v.id}` }}{{ v.diameter ? `, Ду ${v.diameter}` : '' }}
                      <span class="text-medium-emphasis">— участок {{ v.line_id }}{{ v.required ? ', обязательная' : '' }}</span>
                    </div>
                  </v-expansion-panel-text>
                </v-expansion-panel>
                <v-expansion-panel :title="`Потребители (${current.consumers?.length ?? 0})`">
                  <v-expansion-panel-text>
                    <div
                      v-for="c in shownConsumers"
                      :key="`${c.type}:${c.id}`"
                      class="text-body-2"
                    >
                      {{ c.name || `№${c.id}` }}
                      <span class="text-medium-emphasis">— {{ c.load.toLocaleString('ru-RU', { maximumFractionDigits: 3 }) }} Гкал/ч{{ c.downstream ? ', ниже по сети' : '' }}</span>
                    </div>
                    <div
                      v-if="(current.consumers?.length ?? 0) > CONSUMERS_SHOWN"
                      class="text-caption text-medium-emphasis mt-1"
                    >
                      В списке — первые {{ CONSUMERS_SHOWN }}; все — в «Списке для уведомления».
                    </div>
                  </v-expansion-panel-text>
                </v-expansion-panel>
                <v-expansion-panel :title="`История (${current.events?.length ?? 0})`">
                  <v-expansion-panel-text>
                    <div
                      v-for="(e, i) in [...(current.events ?? [])].reverse()"
                      :key="i"
                      class="text-body-2 mb-1"
                    >
                      <strong v-if="e.to_label">{{ e.to_label }}</strong><span v-if="e.to_label && e.note"> — </span>{{ e.note }}
                      <div class="text-caption text-medium-emphasis">
                        {{ formatDateTime(e.at) }} · {{ e.by_user || '—' }}
                      </div>
                    </div>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>
            </template>

            <p
              v-else
              class="text-body-2 text-medium-emphasis"
            >
              Выберите отключение в списке{{ canEdit ? ' или запланируйте новое' : '' }}: участок или узел → расчёт
              изоляции → задвижки и потребители → объявление.
            </p>
          </div>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import DataTable, { type DataTableColumn } from '~/components/DataTable.vue';
import HintTip from '~/components/HintTip.vue';
import KpiTile from '~/components/KpiTile.vue';
import SegmentedToggle from '~/components/SegmentedToggle.vue';
import { useDialogMapOverlay } from '~/composables/useDialogMapOverlay';
import { useMobile } from '~/composables/useMobile';
import { fastApiService } from '~/services/fastApiService';
import { useAuthStore } from '~/stores/authStore';
import { useNotificationStore } from '~/stores/notificationStore';
import { formatApiError } from '~/utils/apiError';
import {
  OUTAGE_STATUS_COLORS,
  OUTAGE_STATUS_LABELS,
  OUTAGE_STATUS_ORDER,
  durationText,
  isOutageForward,
  outageMapData,
  outageTransitionLabel,
  zonesMapData,
  type Outage,
  type OutageKind,
  type OutageList,
  type OutageStatus,
} from '~/utils/outages';
import { downloadBlob } from '~/utils/printRender';
import { formatDateTime, fromInputDateTime } from '~/utils/workOrders';

/**
 * Плановые и аварийные отключения (фаза 2): участок, узел или наряд → расчёт изоляции (задвижки, потребители
 * зоны и ниже по сети) → объявление и список для уведомления → отключили → включили. Пересечения с другими
 * отключениями по потребителям и времени; зоны на карте; публикация для жителей — по флажку.
 */
const emit = defineEmits<{
  'show-on-map': [data: GeoJSON.FeatureCollection];
  'clear-highlight': [];
  'focus-coords': [lng: number, lat: number];
}>();

const visible = defineModel<boolean>({ default: false });
const overlay = useDialogMapOverlay(visible, () => emit('clear-highlight'));
const { shown: overlayShown, keepOnMap } = overlay;
const { isMobile } = useMobile();
const authStore = useAuthStore();
const notify = useNotificationStore();
const canEdit = computed(() => authStore.canEditData);

const CONSUMERS_SHOWN = 200;
const SEARCH_DEBOUNCE_MS = 300;

const list = ref<OutageList | null>(null);
const current = ref<Outage | null>(null);
const loading = ref(false);
const saving = ref(false);
const recomputing = ref(false);
const exporting = ref(false);
const moving = ref<OutageStatus | null>(null);
const errorMessage = ref('');
const statusFilter = ref<OutageStatus | null>(null);
const search = ref('');
const zonesOnMap = ref(false);
const mode = ref<'view' | 'create'>('view');

interface FormState {
  title: string;
  kind: OutageKind;
  line_id: number | null;
  node_id: number | null;
  work_order_id: number | null;
  planned_start: string;
  planned_end: string;
  reason: string;
  public: boolean;
  public_note: string;
}
const emptyForm = (): FormState => ({
  title: '', kind: 'planned', line_id: null, node_id: null, work_order_id: null, planned_start: '', planned_end: '',
  reason: '', public: false, public_note: '',
});
const form = ref<FormState>(emptyForm());
const kindItems = [
  { value: 'planned', label: 'Плановое' },
  { value: 'emergency', label: 'Аварийное' },
];
const createReady = computed(() => {
  const f = form.value;
  return f.title.trim() && (f.line_id || f.node_id || f.work_order_id) && f.planned_start && f.planned_end;
});

const columns: DataTableColumn[] = [
  { key: 'number', title: '№', width: 120 },
  { key: 'title', title: 'Название' },
  { key: 'status_label', title: 'Статус', width: 120 },
  { key: 'planned_start', title: 'Отключение', width: 140 },
  { key: 'consumers_count', title: 'Потребителей', type: 'number', width: 110 },
];
const rows = computed(() => (list.value?.items ?? []) as unknown as Record<string, unknown>[]);
const shownConsumers = computed(() => (current.value?.consumers ?? []).slice(0, CONSUMERS_SHOWN));

const fail = (err: unknown, what: string) => {
  errorMessage.value = formatApiError(err, what);
};

const loadList = async () => {
  loading.value = true;
  try {
    list.value = await fastApiService.getOutages({ status: statusFilter.value, q: search.value });
  } catch (err: unknown) {
    fail(err, 'Список отключений не загружен');
  } finally {
    loading.value = false;
  }
};

const showCurrent = () => {
  const o = current.value;
  if (!o) return;
  zonesOnMap.value = false;
  emit('show-on-map', outageMapData(o));
  overlay.markShown();
  if (o.lon != null && o.lat != null) emit('focus-coords', o.lon, o.lat);
};

const show = (o: Outage) => {
  current.value = o;
  mode.value = 'view';
};

const select = async (id: number) => {
  try {
    show(await fastApiService.getOutage(id));
    showCurrent();
  } catch (err: unknown) {
    fail(err, 'Отключение не загружено');
  }
};

const applied = async (o: Outage) => {
  show(o);
  await loadList();
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
    const start = fromInputDateTime(f.planned_start);
    const end = fromInputDateTime(f.planned_end);
    if (!start || !end) throw new Error('Укажите сроки отключения');
    const o = await fastApiService.createOutage({
      title: f.title.trim(), kind: f.kind, line_id: f.line_id || null, node_id: f.line_id ? null : f.node_id || null,
      work_order_id: f.work_order_id, planned_start: start, planned_end: end, reason: f.reason, public: f.public,
      public_note: f.public_note,
    });
    await applied(o);
    showCurrent();
  } catch (err: unknown) {
    fail(err, 'Отключение не запланировано');
  } finally {
    saving.value = false;
  }
};

const move = async (to: OutageStatus) => {
  const o = current.value;
  if (!o) return;
  moving.value = to;
  errorMessage.value = '';
  try {
    await applied(await fastApiService.transitionOutage(o.id, { to, revision: o.revision }));
  } catch (err: unknown) {
    fail(err, 'Статус не изменён');
  } finally {
    moving.value = null;
  }
};

const recompute = async () => {
  const o = current.value;
  if (!o) return;
  recomputing.value = true;
  errorMessage.value = '';
  try {
    await applied(await fastApiService.recomputeOutage(o.id, o.revision));
    showCurrent();
  } catch (err: unknown) {
    fail(err, 'Изоляция не пересчитана');
  } finally {
    recomputing.value = false;
  }
};

const downloadNotification = async () => {
  const o = current.value;
  if (!o) return;
  exporting.value = true;
  try {
    const { blob, filename } = await fastApiService.downloadOutageNotification(o.id);
    downloadBlob(blob, filename);
  } catch (err: unknown) {
    fail(err, 'Список не сформирован');
  } finally {
    exporting.value = false;
  }
};

const copyAnnouncement = async () => {
  const o = current.value;
  if (!o) return;
  try {
    const text = await fastApiService.getOutageAnnouncement(o.id);
    await navigator.clipboard.writeText(text);
    notify.showSuccess('Текст объявления скопирован');
  } catch (err: unknown) {
    fail(err, 'Текст объявления не скопирован');
  }
};

watch(zonesOnMap, async (on) => {
  if (!on) {
    emit('clear-highlight');
    overlay.markCleared();
    return;
  }
  try {
    emit('show-on-map', zonesMapData(await fastApiService.getOutageZones()));
    overlay.markShown();
  } catch (err: unknown) {
    fail(err, 'Зоны отключений не показаны');
  }
});

watch(statusFilter, () => void loadList());
let searchTimer: ReturnType<typeof setTimeout> | null = null;
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => void loadList(), SEARCH_DEBOUNCE_MS);
});

watch(visible, (open) => {
  if (open) void loadList();
}, { immediate: true });

/** Открыть; lineId / nodeId / workOrderId — сразу форма нового отключения (из наряда, карточки участка) */
const openDialog = (payload?: { lineId?: number | null; nodeId?: number | null; workOrderId?: number | null; title?: string }) => {
  visible.value = true;
  if (payload && (payload.lineId || payload.nodeId || payload.workOrderId)) {
    startCreate({
      line_id: payload.lineId ?? null, node_id: payload.nodeId ?? null, work_order_id: payload.workOrderId ?? null,
      title: payload.title ?? '',
    });
  }
};

defineExpose({ openDialog });
</script>

<style scoped>
.out-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: var(--space-2, 8px); }
.out-kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-2, 8px); }
.out-search { flex: 1 1 260px; }
.out-body { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: var(--space-4, 16px); }
.out-card { min-width: 0; }
.out-field { flex: 1 1 0; min-width: 0; }
@media (max-width: 900px) {
  .out-body { grid-template-columns: 1fr; }
}
</style>
