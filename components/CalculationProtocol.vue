<template>
  <div
    v-show="show"
    class="protocol-container"
    :style="containerStyle"
  >
    <div
      class="protocol-resize-handle"
      @mousedown="startResize"
    />
    <v-card
      class="protocol-card"
      variant="outlined"
    >
      <!-- Комбинированный заголовок -->
      <div class="protocol-header">
        <div class="protocol-tabs-container">
          <v-tabs
            v-model="activeTab"
            color="primary"
            density="compact"
            class="protocol-tabs"
          >
            <v-tab value="analysis">
              <v-icon class="mr-2">
                mdiFormatListChecks
              </v-icon>
              Анализ
              <v-chip
                v-if="summary && summary.errors"
                size="x-small"
                color="error"
                variant="flat"
                class="ml-2"
              >
                {{ summary.errors }}
              </v-chip>
              <v-chip
                v-if="summary && summary.warnings"
                size="x-small"
                color="warning"
                variant="flat"
                class="ml-1"
              >
                {{ summary.warnings }}
              </v-chip>
            </v-tab>
            <v-tab value="calculation">
              <v-icon class="mr-2">
                mdiCalculator
              </v-icon>
              Текст расчёта
            </v-tab>
            <v-tab value="system">
              <v-icon class="mr-2">
                mdiCog
              </v-icon>
              Система
            </v-tab>
          </v-tabs>
        </div>
        <div class="protocol-actions">
          <HintTip
            :text="'Очистить протокол'"
            location="top"
          >
            <template #default="{ props: tip }">
              <v-btn
                v-bind="tip"
                icon
                density="compact"
                class="mr-2"
                variant="text"
                aria-label="Очистить протокол"
                @click="clear"
              >
                <v-icon>mdiDelete</v-icon>
              </v-btn>
            </template>
          </HintTip>
          <HintTip
            :text="fullscreenLabel"
            location="top"
          >
            <template #default="{ props: tip }">
              <v-btn
                v-bind="tip"
                icon
                density="compact"
                class="mr-2"
                variant="text"
                :aria-label="fullscreenLabel"
                @click="toggleFullscreen"
              >
                <v-icon>{{ isFullscreen ? 'mdiFullscreenExit' : 'mdiFullscreen' }}</v-icon>
              </v-btn>
            </template>
          </HintTip>
          <HintTip
            :text="minimizeLabel"
            location="top"
          >
            <template #default="{ props: tip }">
              <v-btn
                v-bind="tip"
                icon
                density="compact"
                class="mr-2"
                variant="text"
                :aria-label="minimizeLabel"
                @click="minimize"
              >
                <v-icon>{{ protocolHeight <= 45 ? 'mdiChevronUp' : 'mdiChevronDown' }}</v-icon>
              </v-btn>
            </template>
          </HintTip>
          <HintTip
            :text="'Закрыть протокол'"
            location="top"
          >
            <template #default="{ props: tip }">
              <v-btn
                v-bind="tip"
                icon
                density="compact"
                variant="text"
                aria-label="Закрыть протокол"
                @click="close"
              >
                <v-icon>mdiClose</v-icon>
              </v-btn>
            </template>
          </HintTip>
        </div>
      </div>

      <!-- Контент -->
      <div v-if="!isMinimized">
        <v-window v-model="activeTab">
          <v-window-item value="analysis">
            <div class="protocol-window analysis-window">
              <div
                v-if="loading"
                class="analysis-empty"
              >
                <v-progress-circular
                  indeterminate
                  size="20"
                  class="mr-2"
                />
                Загрузка протокола…
              </div>
              <div
                v-else-if="!records.length"
                class="analysis-empty"
              >
                {{ loadError || 'Протокол появится после расчёта. Сохранённые протоколы — кнопка «История».' }}
                <v-btn
                  size="small"
                  variant="text"
                  color="primary"
                  class="ml-2"
                  @click="openHistory"
                >
                  <v-icon
                    size="small"
                    class="mr-1"
                  >
                    mdiHistory
                  </v-icon>
                  История
                </v-btn>
              </div>
              <template v-else>
                <!-- Сводка и фильтры -->
                <div class="analysis-toolbar">
                  <span
                    class="analysis-title"
                    :title="recordsTitle"
                  >{{ recordsLabel }}</span>
                  <!-- Итог расчёта: плитки — фильтр по важности; после пересчёта — изменение к прошлому -->
                  <KpiTile
                    label="Ошибки"
                    :value="summary?.errors ?? 0"
                    :status="summary?.errors ? 'serious' : 'good'"
                    :delta="deltas?.errors ?? null"
                    delta-label="к прошлому"
                    :up-is-good="false"
                    selectable
                    :active="severity === 'error'"
                    class="analysis-kpi mr-1"
                    @select="toggleSeverity('error')"
                  />
                  <KpiTile
                    label="Предупреждения"
                    :value="summary?.warnings ?? 0"
                    :status="summary?.warnings ? 'warning' : 'good'"
                    :delta="deltas?.warnings ?? null"
                    delta-label="к прошлому"
                    :up-is-good="false"
                    selectable
                    :active="severity === 'warning'"
                    class="analysis-kpi mr-2"
                    @select="toggleSeverity('warning')"
                  />
                  <v-chip
                    v-for="c in chips"
                    :key="c.code"
                    size="small"
                    :variant="category === c.code ? 'flat' : 'outlined'"
                    :color="c.error ? 'error' : 'warning'"
                    class="mr-1"
                    @click="category = category === c.code ? null : c.code"
                  >
                    {{ c.label }} {{ c.error + c.warning }}
                  </v-chip>
                  <v-spacer />
                  <span
                    v-if="comparison"
                    class="d-sr-only"
                  >{{ comparison }}</span>
                  <SearchField
                    v-model="query"
                    density="compact"
                    placeholder="Поиск по сообщениям"
                    aria-label="Поиск по сообщениям протокола"
                    :result-count="query ? filtered.length : null"
                    class="analysis-search mr-1"
                  />
                  <HintTip
                    :text="'Предыдущая проблема'"
                    location="top"
                  >
                    <template #default="{ props: tip }">
                      <v-btn
                        v-bind="tip"
                        icon
                        density="compact"
                        variant="text"
                        aria-label="Предыдущая проблема"
                        :disabled="!filtered.length"
                        @click="step(-1)"
                      >
                        <v-icon>mdiChevronUp</v-icon>
                      </v-btn>
                    </template>
                  </HintTip>
                  <HintTip
                    :text="'Следующая проблема'"
                    location="top"
                  >
                    <template #default="{ props: tip }">
                      <v-btn
                        v-bind="tip"
                        icon
                        density="compact"
                        variant="text"
                        aria-label="Следующая проблема"
                        :disabled="!filtered.length"
                        @click="step(1)"
                      >
                        <v-icon>mdiChevronDown</v-icon>
                      </v-btn>
                    </template>
                  </HintTip>
                  <v-btn
                    size="small"
                    variant="text"
                    :color="markersShown ? 'primary' : undefined"
                    title="Отметить объекты отфильтрованных сообщений на карте"
                    @click="toggleMarkers"
                  >
                    <v-icon
                      size="small"
                      class="mr-1"
                    >
                      mdiMapMarkerMultiple
                    </v-icon>
                    {{ markersShown ? 'Скрыть на карте' : 'Все на карте' }}
                  </v-btn>
                  <HintTip
                    :text="'Сохранённые протоколы'"
                    location="top"
                  >
                    <template #default="{ props: tip }">
                      <v-btn
                        v-bind="tip"
                        size="small"
                        variant="text"
                        aria-label="Сохранённые протоколы"
                        @click="openHistory"
                      >
                        <v-icon size="small">
                          mdiHistory
                        </v-icon>
                      </v-btn>
                    </template>
                  </HintTip>
                  <v-btn
                    v-if="canRecalculate"
                    size="small"
                    variant="tonal"
                    color="primary"
                    title="Повторить расчёт с теми же установками"
                    @click="emit('recalculate')"
                  >
                    <v-icon
                      size="small"
                      class="mr-1"
                    >
                      mdiRefresh
                    </v-icon>
                    Пересчитать
                  </v-btn>
                  <v-btn
                    v-if="authStore.canUseAi && records.length"
                    size="small"
                    variant="text"
                    color="primary"
                    :loading="aiLoading"
                    title="Объяснить протокол помощником ИИ: причины, что открыть, регуляторы с дефицитом"
                    @click="explainWithAi(false)"
                  >
                    <v-icon
                      size="small"
                      class="mr-1"
                    >
                      mdiCreation
                    </v-icon>
                    Объяснить
                  </v-btn>
                </div>

                <AiAnswerPanel
                  v-if="aiShown"
                  :answer="aiResult?.explanation ?? null"
                  :regulators="aiResult?.regulators ?? []"
                  :loading="aiLoading"
                  :error="aiError"
                  :cached="aiResult?.cached ?? false"
                  :category-labels="summary?.category_labels ?? {}"
                  @object="aiGoTo"
                  @fix="aiFix"
                  @refresh="explainWithAi(true)"
                  @close="aiShown = false"
                />

                <!-- Записи -->
                <div
                  v-if="!filtered.length"
                  class="analysis-empty"
                >
                  {{ entries.length ? 'Нет сообщений по фильтру' : 'Ошибок и предупреждений нет' }}
                </div>
                <div
                  v-for="(e, i) in filtered"
                  :key="entryKey(e)"
                  :ref="(el) => setRowRef(entryKey(e), el)"
                  class="entry"
                  :class="[`entry--${e.severity}`, { 'entry--active': activeKey === entryKey(e) }]"
                  @click="activate(i)"
                >
                  <v-icon
                    size="16"
                    class="entry-icon"
                    :color="e.severity === 'error' ? 'error' : 'warning'"
                  >
                    {{ e.severity === 'error' ? 'mdiAlertCircle' : 'mdiAlert' }}
                  </v-icon>
                  <div class="entry-body">
                    <div class="entry-meta">
                      <span>{{ categoryLabel(e.category) }}</span>
                      <span v-if="fragmentLabel(e)"> · {{ fragmentLabel(e) }}</span>
                      <span v-if="e.component && e.component.total > 1"> · подсеть {{ e.component.index }}/{{ e.component.total }}</span>
                      <span v-if="e.count > 1"> · повторов {{ e.count }}</span>
                    </div>
                    <div class="entry-text">
                      {{ e.text }}
                    </div>
                    <div
                      v-if="e.objects.length || e.fix"
                      class="entry-actions"
                    >
                      <v-chip
                        v-for="o in e.objects.slice(0, 6)"
                        :key="objectKey(o)"
                        size="x-small"
                        variant="outlined"
                        class="mr-1 mb-1"
                        :title="o.context ? 'Узел подсети, где возникло сообщение' : 'Показать на карте и открыть карточку'"
                        @click.stop="goTo(o, e)"
                      >
                        <v-icon
                          size="12"
                          class="mr-1"
                        >
                          mdiCrosshairsGps
                        </v-icon>
                        {{ o.label || objectKey(o) }}
                      </v-chip>
                      <span
                        v-if="e.objects.length > 6"
                        class="entry-more mr-2"
                      >… ещё {{ e.objects.length - 6 }}</span>
                      <v-btn
                        v-if="e.fix"
                        size="x-small"
                        variant="tonal"
                        color="primary"
                        :title="fixInfo(e).hint"
                        @click.stop="runFix(e)"
                      >
                        <v-icon
                          size="12"
                          class="mr-1"
                        >
                          mdiHammerWrench
                        </v-icon>
                        Исправить: {{ fixInfo(e).label }}
                      </v-btn>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </v-window-item>
          <v-window-item value="calculation">
            <v-card-text
              class="protocol-window"
              @click="onRawClick"
            >
              <div
                v-for="log in logs"
                :key="log.id"
                class="protocol-line"
              >
                <span class="protocol-timestamp">{{ log.timestamp }}</span>
                <!-- Вывод расчёта с бэкенда — HTML (цвета, ссылки на объекты — переход на карте) -->
                <div
                  v-if="log.html"
                  class="protocol-message protocol-html"
                  v-html="log.message"
                />
                <span
                  v-else
                  :class="['protocol-message', log.type]"
                >{{ log.message }}</span>
                <v-btn
                  v-if="!log.html && /Начало расч[её]та/.test(log.message)"
                  size="small"
                  variant="text"
                  color="primary"
                  class="ml-2"
                  @click="emit('open-calculation')"
                >
                  <v-icon
                    size="small"
                    class="mr-1"
                  >
                    mdiCalculator
                  </v-icon>
                  Открыть настройки
                </v-btn>
              </div>
            </v-card-text>
          </v-window-item>
          <v-window-item value="system">
            <v-card-text class="protocol-window">
              <div class="protocol-line">
                <span class="protocol-timestamp">{{ systemTime }}</span>
                <span class="protocol-message info">Системный протокол</span>
              </div>
            </v-card-text>
          </v-window-item>
        </v-window>
      </div>
    </v-card>

    <!-- Сохранённые протоколы -->
    <v-dialog
      v-model="historyOpen"
      max-width="860"
      scrollable
    >
      <v-card rounded="lg">
        <v-card-title class="d-flex align-center ga-3 px-4 py-3">
          <v-avatar
            color="primary"
            variant="tonal"
            size="40"
          >
            <v-icon>mdi-history</v-icon>
          </v-avatar>
          <div
            class="flex-grow-1"
            style="min-width: 0"
          >
            <div class="text-subtitle-1 font-weight-bold">
              Протоколы расчётов
            </div>
            <div class="text-caption text-medium-emphasis text-truncate">
              Последние 100 сохранённых; щелчок по строке — открыть протокол
            </div>
          </div>
          <HintTip
            text="Закрыть"
            hotkey="Esc"
            location="bottom"
          >
            <template #default="{ props: tip }">
              <v-btn
                v-bind="tip"
                icon="mdi-close"
                variant="text"
                aria-label="Закрыть"
                @click="historyOpen = false"
              />
            </template>
          </HintTip>
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-4">
          <StateView
            variant="table"
            :rows="8"
            :loading="historyLoading"
            :error="historyError"
            :empty="!historyLoading && !historyError && !historyItems.length"
            empty-title="Сохранённых протоколов нет"
            empty-text="Протокол сохраняется после каждого расчёта"
            empty-icon="mdi-history"
            error-title="Список протоколов не загружен"
            :retrying="historyLoading"
            @retry="openHistory"
          >
            <DataTable
              :columns="historyColumns"
              :items="historyRows"
              selectable
              :height="420"
              @select="(row) => openFromHistory(row as unknown as CalcProtocolRecord)"
            >
              <template #[`item.created_at`]="{ item }">
                {{ formatDate(item.created_at as string | null) }}
              </template>
              <template #[`item.errors`]="{ item }">
                <span :class="{ 'text-error font-weight-medium': item.errors }">{{ item.errors }}</span>
              </template>
            </DataTable>
          </StateView>
        </v-card-text>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { fastApiService } from '~/services/fastApiService';
import { isStyleMutable } from '~/services/mapService';
import { useMapStore } from '~/stores/mapStore';
import { useNotificationStore } from '~/stores/notificationStore';
import { useUiStore } from '~/stores/uiStore';
import { useAuthStore } from '~/stores/authStore';
import AiAnswerPanel from '~/components/ai/AiAnswerPanel.vue';
import DataTable, { type DataTableColumn } from '~/components/DataTable.vue';
import HintTip from '~/components/HintTip.vue';
import KpiTile from '~/components/KpiTile.vue';
import SearchField from '~/components/SearchField.vue';
import StateView from '~/components/StateView.vue';
import { aiService, type AiObjectRef, type ExplainProtocolResult, type RootCause } from '~/services/aiService';
import { useFragmentStore } from '~/stores/fragmentStore';
import { formatApiErrorWith } from '~/utils/apiError';
import {
  FIX_HINTS,
  FIX_LABELS,
  categoryChips,
  compareSummaries,
  deviceJournal,
  filterEntries,
  geometryView,
  mergeEntries,
  mergeSummaries,
  objectFromAnchor,
  objectKey,
  primaryObject,
  protocolTarget,
  type CalcProtocolRecord,
  type ProtocolEntry,
  type ProtocolLocateResult,
  type ProtocolObject,
  type ProtocolSeverity,
  type ProtocolTarget,
} from '~/utils/calcProtocol';

const props = defineProps<{
  show: boolean
  /** Можно повторить расчёт (есть права и известны установки последнего запуска) */
  canRecalculate?: boolean
}>();

const emit = defineEmits<{
  'update:show': [value: boolean]
  'open-calculation': []
  'recalculate': []
}>();

const mapStore = useMapStore();
const uiStore = useUiStore();
const authStore = useAuthStore();
const fragmentStore = useFragmentStore();
const notify = useNotificationStore();

const logs = ref<Array<{ id: string; timestamp: string; message: string; type: string; html: boolean }>>([]);
const protocolHeight = ref(300);
const activeTab = ref('analysis');
const isMinimized = ref(false);
const isFullscreen = ref(false);
const systemTime = ref('');

/** Протокол встаёт между панелью слоёв и карточкой объекта — не закрывает их кнопки */
const containerStyle = computed(() => ({ left: `${uiStore.leftInset}px`, right: `${uiStore.rightInset}px` }));
const fullscreenLabel = computed(() => (isFullscreen.value ? 'Выйти из полноэкранного режима' : 'Во весь экран'));
const minimizeLabel = computed(() => (protocolHeight.value <= 45 ? 'Развернуть протокол' : 'Свернуть протокол'));

onMounted(() => {
  systemTime.value = new Date().toLocaleTimeString('ru-RU');
});

// Сбрасываем состояние при скрытии
watch(() => props.show, (newValue) => {
  if (!newValue) {
    isMinimized.value = false;
    protocolHeight.value = 300;
    isFullscreen.value = false;
    hideMarkers();
  }
});

const startResize = (e: MouseEvent) => {
  e.preventDefault();
  const startY = e.clientY;
  const startHeight = protocolHeight.value;

  const handleMouseMove = (e: MouseEvent) => {
    const deltaY = startY - e.clientY;
    protocolHeight.value = Math.max(40, Math.min(window.innerHeight - 64, startHeight + deltaY));
    if (protocolHeight.value > 40) {
      isMinimized.value = false;
    }
  };

  const handleMouseUp = () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
};

const addLog = (log: { timestamp: string; message: string; type: string; html: boolean }) => {
  logs.value.push({
    ...log,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  });
};

const clear = () => {
  logs.value = [];
  records.value = [];
  located.value = null;
  previousTotals.value = null;
  activeKey.value = null;
  hideMarkers();
};

const minimize = () => {
  if (protocolHeight.value <= 45) { // Если близко к минимальной высоте
    protocolHeight.value = 300; // Разворачиваем на максимум
    isMinimized.value = false;
  } else {
    protocolHeight.value = 40; // Сворачиваем до минимума
    isMinimized.value = true;
  }
};

const close = () => {
  emit('update:show', false);
};

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value;
  if (isFullscreen.value) {
    protocolHeight.value = window.innerHeight - 64; // 40px для заголовка
  } else {
    protocolHeight.value = 300;
  }
};

// === Анализ: разобранный протокол (API calculation_protocol) ===

const records = ref<CalcProtocolRecord[]>([]);
const loading = ref(false);
const loadError = ref('');
const located = ref<ProtocolLocateResult | null>(null);
/** Итоги предыдущего протокола тех же фрагментов — для «было → стало» после пересчёта */
const previousTotals = ref<{ errors: number; warnings: number; files: string } | null>(null);

const severity = ref<ProtocolSeverity | null>(null);
const category = ref<string | null>(null);
const query = ref('');
const activeKey = ref<string | null>(null);

const entries = computed(() => mergeEntries(records.value));
const summary = computed(() => (records.value.length ? mergeSummaries(records.value) : null));
const chips = computed(() => categoryChips(summary.value));
const filtered = computed(() => filterEntries(entries.value, {
  severity: severity.value, category: category.value, query: query.value || '',
}));

const filesKey = (rs: CalcProtocolRecord[]) => rs.map((r) => r.fileid ?? '').sort().join(',');

const comparison = computed(() => {
  const prev = previousTotals.value;
  const s = summary.value;
  if (!prev || !s || prev.files !== filesKey(records.value)) return null;
  return compareSummaries(prev, s);
});
/** Изменение к прошлому протоколу тех же фрагментов — для плиток (null — сравнивать не с чем) */
const deltas = computed(() => {
  const prev = previousTotals.value;
  const s = summary.value;
  if (!comparison.value || !prev || !s) return null;
  return { errors: s.errors - prev.errors, warnings: s.warnings - prev.warnings };
});

const fragmentName = (id: number | null | undefined) => {
  if (id == null) return '';
  const rec = records.value.find((r) => r.fileid === id);
  return rec?.fragment_name || fragmentStore.fragments.find((f: any) => f.id === id)?.name || `фрагмент ${id}`;
};
const fragmentLabel = (e: ProtocolEntry) => (records.value.length > 1 ? fragmentName(e.fragment_id) : '');
const categoryLabel = (code: string) => summary.value?.category_labels?.[code] || 'Прочее';

const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString('ru-RU') : '—');

const recordsLabel = computed(() => {
  const rs = records.value;
  if (!rs.length) return '';
  const first = rs[0];
  const what = rs.length > 1 ? `${rs.length} фрагментов` : fragmentName(first.fileid) || 'расчёт';
  return `${what} · ${formatDate(first.created_at)}`;
});
const recordsTitle = computed(() => [
  ...(summary.value?.header || []),
  records.value[0]?.params ? `Параметры: ${records.value[0].params}` : '',
].filter(Boolean).join('\n'));

const toggleSeverity = (s: ProtocolSeverity) => {
  severity.value = severity.value === s ? null : s;
};

// фильтр сменился — подсветка остаётся только у видимой записи
watch(filtered, (list) => {
  if (activeKey.value && !list.some((e) => entryKey(e) === activeKey.value)) activeKey.value = null;
  if (markersShown.value) void showMarkers();
});

const entryKey = (e: ProtocolEntry) => `${e.fragment_id ?? ''}:${e.seq}`;

// --- Помощник ИИ: объяснение протокола (сервер ai/calc_protocol.py) ---
const aiShown = ref(false);
const aiLoading = ref(false);
const aiError = ref('');
const aiResult = ref<ExplainProtocolResult | null>(null);

/** Объяснить загруженный протокол; refresh — спросить модель заново вместо кеша */
const explainWithAi = async (refresh: boolean) => {
  const first = records.value[0];
  if (!first || aiLoading.value) return;
  aiShown.value = true;
  aiLoading.value = true;
  aiError.value = '';
  try {
    const body = first.request_id ? { request_id: first.request_id, refresh } : { protocol_id: first.id, refresh };
    aiResult.value = await aiService.explainProtocol(body);
  } catch (err) {
    aiResult.value = null;
    aiError.value = formatApiErrorWith('Помощник ИИ не ответил', err);
  } finally {
    aiLoading.value = false;
  }
};

const aiObjectToProtocol = (o: AiObjectRef): ProtocolObject | null => {
  if (o.kind === 'line2' && o.id1 != null && o.id2 != null) return { kind: 'line2', id1: o.id1, id2: o.id2, label: o.label };
  if ((o.kind === 'node' || o.kind === 'line') && o.id != null) return { kind: o.kind, id: o.id, label: o.label };
  return null;
};

/** Запись протокола, к которой относится объект ответа — чтобы переход и fix работали как у записи */
const aiEntryFor = (o: ProtocolObject): ProtocolEntry | undefined =>
  entries.value.find((e) => e.objects.some((x) => objectKey(x) === objectKey(o)));

const aiGoTo = async (o: AiObjectRef) => {
  const po = aiObjectToProtocol(o);
  if (!po) return;
  const e = aiEntryFor(po);
  if (e) activeKey.value = entryKey(e);
  await goTo(po, e);
};

const aiFix = async (cause: RootCause) => {
  const po = cause.objects.map(aiObjectToProtocol).find((x): x is ProtocolObject => x !== null) ?? null;
  const e = po ? aiEntryFor(po) : entries.value.find((x) => x.fix === cause.fix && x.category === cause.category);
  if (e) {
    await runFix(e);
    return;
  }
  if (cause.fix === 'calc_params') emit('open-calculation');
  else if (cause.fix === 'temp_graph') uiStore.requestToolDialog('temperatureGraph');
  else if (po) await goTo(po);
};

watch(records, () => {
  aiResult.value = null;
  aiError.value = '';
  aiShown.value = false;
});
const rowRefs = new Map<string, Element>();
const setRowRef = (key: string, el: any) => {
  if (el) rowRefs.set(key, el as Element);
  else rowRefs.delete(key);
};

/** Номер последней загрузки протокола: ответ, который пришёл позже следующего запроса, отбрасывается */
let loadSeq = 0;

/** Загрузить протоколы (id из результата задачи); keepPrevious — сравнить с текущими */
const loadProtocols = async (ids: number[], opts: { keepPrevious?: boolean } = {}) => {
  if (!ids.length) return;
  const seq = ++loadSeq;
  loading.value = true;
  loadError.value = '';
  try {
    const items = await Promise.all(ids.map((id) => fastApiService.getCalcProtocol(id)));
    if (seq === loadSeq) setRecords(items, opts.keepPrevious);
  } catch (err) {
    if (seq === loadSeq) loadError.value = formatApiErrorWith('Протокол не загружен', err);
  } finally {
    if (seq === loadSeq) loading.value = false;
  }
};

const loadByRequest = async (requestId: string) => {
  const seq = ++loadSeq;
  loading.value = true;
  loadError.value = '';
  try {
    const items = (await fastApiService.getCalcProtocolsByRequest(requestId, true)).items;
    if (seq !== loadSeq) return;
    showSavedOutput(items);
    setRecords(items, true);
  } catch (err) {
    if (seq === loadSeq) loadError.value = formatApiErrorWith('Протокол не загружен', err);
  } finally {
    if (seq === loadSeq) loading.value = false;
  }
};

const loadByCalculation = async (calculationId: number) => {
  const seq = ++loadSeq;
  emit('update:show', true);
  activeTab.value = 'analysis';
  loading.value = true;
  loadError.value = '';
  try {
    const rec = await fastApiService.getCalculationProtocol(calculationId, true);
    // расчёт по списку: весь запрос
    const all = rec.request_id ? (await fastApiService.getCalcProtocolsByRequest(rec.request_id, true)).items : [];
    if (seq !== loadSeq) return;
    const items = all.length ? all : [rec];
    showSavedOutput(items);
    setRecords(items, false);
  } catch (err) {
    if (seq !== loadSeq) return;
    loadError.value = formatApiErrorWith('Протокол этого расчёта не найден', err);
    records.value = [];
  } finally {
    if (seq === loadSeq) loading.value = false;
  }
};

/** Сохранённый протокол: его исходный текст — во вкладку «Текст расчёта» (ссылки кликабельны) */
const showSavedOutput = (items: CalcProtocolRecord[]) => {
  logs.value = [];
  for (const r of items) {
    const timestamp = r.created_at ? new Date(r.created_at).toLocaleTimeString('ru-RU') : '';
    addLog({ timestamp, message: `Протокол №${r.id}: ${r.fragment_name || fragmentName(r.fileid) || 'расчёт'}`, type: 'info', html: false });
    if (r.output) addLog({ timestamp, message: r.output, type: r.status === 'success' ? 'success' : 'info', html: true });
  }
};

const setRecords = (items: CalcProtocolRecord[], keepPrevious = false) => {
  const prev = summary.value;
  previousTotals.value = keepPrevious && prev
    ? { errors: prev.errors, warnings: prev.warnings, files: filesKey(records.value) }
    : null;
  records.value = items;
  located.value = null;
  activeKey.value = null;
  severity.value = null;
  category.value = null;
  query.value = '';
  activeTab.value = 'analysis';
  void locateAll();
};

/** Геометрия всех объектов протокола одним-двумя запросами (не более 500 в запросе) */
const locateAll = async (): Promise<ProtocolLocateResult | null> => {
  if (located.value) return located.value;
  // протокол сменился, пока искали, — результат относится к старым записям и не кешируется
  const forRecords = records.value;
  const seen = new Set<string>();
  const objects: ProtocolObject[] = [];
  for (const e of entries.value) {
    for (const o of e.objects) {
      const k = objectKey(o);
      if (!seen.has(k)) {
        seen.add(k);
        objects.push(o);
      }
    }
  }
  const result: ProtocolLocateResult = { nodes: {}, lines: {}, pairs: {} };
  try {
    for (let i = 0; i < objects.length; i += 500) {
      const part = await fastApiService.locateProtocolObjects(objects.slice(i, i + 500));
      Object.assign(result.nodes, part.nodes);
      Object.assign(result.lines, part.lines);
      Object.assign(result.pairs, part.pairs);
    }
  } catch (err) {
    // без этого переход молча сообщал бы «нет координат» у существующих объектов
    if (records.value === forRecords) notify.showError(formatApiErrorWith('Не удалось найти объекты протокола на карте', err));
    return null;
  }
  if (records.value !== forRecords) return located.value ?? locateAll();
  located.value = result;
  return result;
};

/**
 * Отступ от краёв, px: карта лежит под панелью слоёв, карточкой и протоколом — объект показывается в видимой части.
 * Каждый отступ не больше доли размера карты, иначе fitBounds не найдёт масштаб и не сработает.
 */
const VIEW_MARGIN_PX = 80;
const MAX_BOTTOM_SHARE = 0.6;
const MAX_SIDE_SHARE = 0.4;
const visiblePadding = (map: { getContainer: () => HTMLElement }) => {
  const { clientWidth, clientHeight } = map.getContainer();
  const width = clientWidth || window.innerWidth;
  const height = clientHeight || window.innerHeight;
  return {
    top: VIEW_MARGIN_PX,
    bottom: Math.min(protocolHeight.value + VIEW_MARGIN_PX / 2, height * MAX_BOTTOM_SHARE),
    left: Math.min(uiStore.leftInset + VIEW_MARGIN_PX, width * MAX_SIDE_SHARE),
    right: Math.min(uiStore.rightInset + VIEW_MARGIN_PX, width * MAX_SIDE_SHARE),
  };
};
/**
 * Сдвиг центра при переходе: объект — посередине видимой над протоколом части (offset карта не запоминает).
 * Переход — easeTo: flyTo при «уменьшении движения» в системе прыгает через jumpTo и offset теряет.
 */
const visibleOffset = (map: { getContainer: () => HTMLElement }): [number, number] => {
  const padding = visiblePadding(map);
  return [(padding.left - padding.right) / 2, (padding.top - padding.bottom) / 2];
};

const flyTo = (target: ProtocolTarget) => {
  const map = mapStore.map;
  const view = geometryView(target.geometry);
  if (!map || !view) return;
  if (view.bounds) {
    map.fitBounds(view.bounds, { padding: visiblePadding(map), maxZoom: 18, duration: 800 });
  } else {
    map.easeTo({ center: view.center, zoom: Math.max(map.getZoom(), 17), duration: 800, offset: visibleOffset(map) });
  }
};

/** Устройство (регулятор, насос) на участке: исправляется в журнале, карточки участка у него нет */
const deviceOnLine = (e: ProtocolEntry, target: ProtocolTarget | null) =>
  (target?.table === 'heatpipesections' ? deviceJournal(e) : null);

const entryTarget = (e: ProtocolEntry) => {
  const o = primaryObject(e);
  return o ? protocolTarget(o, located.value) : null;
};

const fixInfo = (e: ProtocolEntry) => {
  const journal = e.fix === 'object' ? deviceOnLine(e, entryTarget(e)) : null;
  if (journal) return { label: journal.label, hint: `Открыть ${journal.label.toLowerCase()} по этому участку` };
  return { label: e.fix ? FIX_LABELS[e.fix] : '', hint: e.fix ? FIX_HINTS[e.fix] : '' };
};

/** Перелёт к объекту, подсветка и карточка (устройство на участке — только подсветка) */
const goTo = async (o: ProtocolObject, e?: ProtocolEntry) => {
  const loc = await locateAll();
  if (!loc) return null; // ошибку поиска уже показали
  const target = protocolTarget(o, loc);
  if (!target) {
    notify.showWarning(`Нет координат объекта «${o.label || objectKey(o)}» (удалён или без геометрии)`);
    return null;
  }
  flyTo(target);
  if (e && deviceOnLine(e, target)) {
    mapStore.selectionTarget = { geometry: target.geometry };
    return target;
  }
  const sourceId = `${target.table}.${target.id}`;
  await mapStore.selectFeature({
    type: 'Feature',
    id: sourceId,
    _sourceId: sourceId,
    geometry: target.geometry,
    properties: { id: target.id, tab: target.table },
    sourceType: 'protocol',
  });
  return target;
};

const activate = (index: number) => {
  const e = filtered.value[index];
  if (!e) return;
  activeKey.value = entryKey(e);
  void nextTick(() => rowRefs.get(entryKey(e))?.scrollIntoView({ block: 'nearest' }));
  const o = primaryObject(e);
  if (o) void goTo(o, e);
};

const step = (delta: number) => {
  const list = filtered.value;
  if (!list.length) return;
  const cur = list.findIndex((e) => entryKey(e) === activeKey.value);
  const next = cur < 0 ? (delta > 0 ? 0 : list.length - 1) : (cur + delta + list.length) % list.length;
  activate(next);
};

/** «Исправить»: открыть то, где задаются исходные данные сообщения */
const runFix = async (e: ProtocolEntry) => {
  activeKey.value = entryKey(e);
  const o = primaryObject(e);
  switch (e.fix) {
    case 'calc_params':
      emit('open-calculation');
      return;
    case 'temp_graph': {
      const target = o ? protocolTarget(o, await locateAll()) : null;
      if (target?.table === 'nodes') uiStore.requestToolDialog('temperatureGraph', { nodeId: target.id });
      else uiStore.requestToolDialog('temperatureGraph');
      return;
    }
    default:
      if (o) {
        const target = await goTo(o, e);
        const journal = deviceOnLine(e, target);
        if (journal && target) {
          uiStore.requestToolDialog(journal.key, { lineId: target.id });
          return;
        }
        if (e.fix === 'fixed_head') {
          notify.showInfo('Задайте в подсети узел с заданным напором (карточка узла → гидравлика) и пересчитайте');
        }
      } else {
        emit('open-calculation');
      }
  }
};

// Ссылки в тексте расчёта: переход на карте вместо перехода браузера
const onRawClick = (event: MouseEvent) => {
  const a = (event.target as Element | null)?.closest?.('a[name]');
  if (!a) return;
  event.preventDefault();
  const o = objectFromAnchor(a);
  if (!o) return;
  if (!records.value.length) {
    void goToDirect(o);
    return;
  }
  void goTo(o);
};

/** Переход без загруженного протокола (старый текст): locate только этого объекта */
const goToDirect = async (o: ProtocolObject) => {
  try {
    const loc = await fastApiService.locateProtocolObjects([o]);
    const target = protocolTarget(o, loc);
    if (!target) {
      notify.showWarning(`Нет координат объекта «${o.label}»`);
      return;
    }
    flyTo(target);
    const sourceId = `${target.table}.${target.id}`;
    await mapStore.selectFeature({
      type: 'Feature', id: sourceId, _sourceId: sourceId, geometry: target.geometry,
      properties: { id: target.id, tab: target.table }, sourceType: 'protocol',
    });
  } catch (err) {
    notify.showError(formatApiErrorWith('Не удалось найти объект', err));
  }
};

// === «Все на карте»: точки объектов отфильтрованных сообщений ===
const MARKER_SOURCE = 'calc-protocol-markers';
const MARKER_LAYER = 'calc-protocol-markers-circle';
const markersShown = ref(false);
/** Растёт при каждом «скрыть»: показ, который дождался поиска объектов после скрытия, ничего не рисует */
let markersSeq = 0;

const onMarkerClick = (ev: any) => {
  const key = ev?.features?.[0]?.properties?.key;
  const index = filtered.value.findIndex((e) => entryKey(e) === key);
  if (index >= 0) {
    activeKey.value = key;
    void nextTick(() => rowRefs.get(key)?.scrollIntoView({ block: 'nearest' }));
  }
};

const showMarkers = async () => {
  const map = mapStore.map;
  const seq = markersSeq;
  const loc = await locateAll();
  if (!map || !loc || seq !== markersSeq || !props.show) return;
  const features: any[] = [];
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const e of filtered.value) {
    const o = primaryObject(e);
    const target = o ? protocolTarget(o, loc) : null;
    const view = target ? geometryView(target.geometry) : null;
    if (!view) continue;
    const [x, y] = view.center;
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: view.center },
      properties: { key: entryKey(e), severity: e.severity },
    });
  }
  const data = { type: 'FeatureCollection', features };
  const source = map.getSource(MARKER_SOURCE);
  if (source) {
    source.setData(data);
  } else {
    if (!isStyleMutable(map)) {
      notify.showWarning('Карта ещё загружает стиль — повторите «Все на карте» через секунду');
      return;
    }
    map.addSource(MARKER_SOURCE, { type: 'geojson', data });
    map.addLayer({
      id: MARKER_LAYER,
      type: 'circle',
      source: MARKER_SOURCE,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 16, 8],
        'circle-color': ['match', ['get', 'severity'], 'error', '#d32f2f', '#f9a825'],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      },
    });
    map.on('click', MARKER_LAYER, onMarkerClick);
  }
  if (!markersShown.value && features.length) {
    markersShown.value = true;
    if (features.length === 1) map.easeTo({ center: features[0].geometry.coordinates, zoom: 16, duration: 800, offset: visibleOffset(map) });
    else map.fitBounds([[minX, minY], [maxX, maxY]], { padding: visiblePadding(map), maxZoom: 17, duration: 800 });
  }
  markersShown.value = true;
  if (!features.length) notify.showInfo('У отфильтрованных сообщений нет объектов с координатами');
};

function hideMarkers() {
  markersSeq += 1;
  markersShown.value = false;
  const map = mapStore.map;
  if (!map) return;
  try {
    if (map.getLayer(MARKER_LAYER)) {
      map.off('click', MARKER_LAYER, onMarkerClick);
      map.removeLayer(MARKER_LAYER);
    }
    if (map.getSource(MARKER_SOURCE)) map.removeSource(MARKER_SOURCE);
  } catch {
    // карта уже уничтожена
  }
}

const toggleMarkers = () => {
  if (markersShown.value) hideMarkers();
  else void showMarkers();
};

onBeforeUnmount(hideMarkers);

// === История ===
const historyOpen = ref(false);
const historyLoading = ref(false);
const historyItems = ref<CalcProtocolRecord[]>([]);
const historyError = ref('');

const historyColumns: DataTableColumn[] = [
  { key: 'created_at', title: 'Дата', width: 170 },
  { key: 'fragment', title: 'Фрагмент' },
  { key: 'mode_name', title: 'Режим', width: 110 },
  { key: 'author', title: 'Автор', width: 150 },
  { key: 'errors', title: 'Ошибки', type: 'number', width: 90 },
  { key: 'warnings', title: 'Предупр.', type: 'number', width: 100 },
];
const historyRows = computed(() => historyItems.value.map((h) => ({
  ...h,
  fragment: h.fragment_name || h.fileid || '—',
  mode_name: h.mode === 'emergency' ? 'аварийный' : 'плановый',
  author: h.author || '—',
})));

const openHistory = async () => {
  historyOpen.value = true;
  historyLoading.value = true;
  historyError.value = '';
  try {
    historyItems.value = (await fastApiService.listCalcProtocols(null, 100)).items;
  } catch (err) {
    historyItems.value = [];
    historyError.value = formatApiErrorWith('Список протоколов не загружен', err);
  } finally {
    historyLoading.value = false;
  }
};

const openFromHistory = (h: CalcProtocolRecord) => {
  historyOpen.value = false;
  void loadByRequest(h.request_id);
};

defineExpose({
  addLog,
  clear,
  loadProtocols,
  loadByRequest,
  loadByCalculation,
});
</script>

<style scoped>
.protocol-container {
  position: fixed;
  bottom: 0;
  z-index: 1000;
  background-color: transparent;
  height: v-bind('protocolHeight + "px"');
  transition: height 0.2s ease;
}

.protocol-resize-handle {
  height: 4px;
  background-color: rgba(var(--v-theme-on-surface), 0.12);
  cursor: ns-resize;
  transition: background-color 0.2s;
  position: relative;
  z-index: 1001;
}

.protocol-resize-handle:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.28);
}

.protocol-card {
  margin: 0;
  border-radius: 0;
  box-shadow: none;
  background-color: rgb(var(--v-theme-surface-light));
  height: 100%;
  transition: all 0.2s ease;
}

.protocol-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0;
  background-color: rgb(var(--v-theme-surface-light));
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  height: 40px;
}

.protocol-tabs-container {
  flex: 1;
  min-width: 0;
}

.protocol-tabs {
  background-color: transparent;
  height: 40px;
}

:deep(.v-tabs__bar) {
  background-color: transparent;
}

:deep(.v-tab) {
  height: 40px;
  text-transform: none;
  letter-spacing: normal;
  font-size: 0.9em;
}

.protocol-actions {
  display: flex;
  align-items: center;
  padding-right: 4px;
}

.protocol-window {
  background-color: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  font-family: 'Consolas', monospace;
  padding: 12px;
  margin: 0;
  height: v-bind('isMinimized ? "0px" : (protocolHeight - 40) + "px"');
  overflow-y: auto;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  transition: height 0.2s ease;
}

.analysis-window {
  font-family: inherit;
  padding: 0 0 8px;
}

.analysis-toolbar {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 0;
  padding: 6px 8px;
  background: rgb(var(--v-theme-surface));
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.analysis-title {
  font-weight: 600;
  font-size: 0.85rem;
  margin-right: 10px;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.analysis-search {
  max-width: 220px;
  min-width: 160px;
}

.analysis-kpi {
  min-width: 112px;
}

.analysis-empty {
  display: flex;
  align-items: center;
  padding: 16px;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.entry {
  display: flex;
  gap: 8px;
  padding: 6px 12px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.06);
  border-left: 3px solid transparent;
  cursor: pointer;
}

.entry:hover {
  background: rgba(var(--v-theme-primary), 0.04);
}

.entry--error {
  border-left-color: rgb(var(--v-theme-error));
}

.entry--warning {
  border-left-color: rgb(var(--v-theme-warning));
}

.entry--active {
  background: rgba(var(--v-theme-primary), 0.12);
}

.entry-icon {
  margin-top: 2px;
}

.entry-body {
  flex: 1;
  min-width: 0;
}

.entry-meta {
  font-size: 0.72rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.entry-text {
  font-family: 'Consolas', monospace;
  font-size: 0.82rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.entry-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin-top: 4px;
}

.entry-more {
  font-size: 0.72rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.protocol-line {
  margin-bottom: 4px;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.4;
}

.protocol-timestamp {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  margin-right: 8px;
  font-size: 0.9em;
}

.protocol-message {
  color: rgb(var(--v-theme-on-surface));
}

.protocol-message.success {
  color: rgb(var(--v-theme-success));
}

.protocol-message.error {
  color: rgb(var(--v-theme-error));
}

.protocol-message.info {
  color: rgb(var(--v-theme-info));
}

/* HTML-протокол расчёта: переносы \\n и таблица с &nbsp; */
.protocol-html {
  display: block;
  margin-top: 2px;
  white-space: pre-line;
  word-break: break-word;
}

.protocol-html :deep(a) {
  color: rgb(var(--v-theme-primary));
  text-decoration: underline;
  cursor: pointer;
}

.protocol-html :deep(a:hover) {
  text-decoration-thickness: 2px;
}
</style>
