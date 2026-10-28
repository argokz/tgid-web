<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import SegmentedToggle from '~/components/SegmentedToggle.vue';
import HintTip from '~/components/HintTip.vue';
import { formatApiError } from '~/utils/apiError';
import { useMobile } from '~/composables/useMobile';
import { useDialogMapOverlay } from '~/composables/useDialogMapOverlay';
import {
  fastApiService,
  type NetworkTraceResponse,
  type NetworkTraceType,
  type NetworkZonesResponse,
} from '~/services/fastApiService';
import { FEED_POINT_LABELS, TRACE_TYPES, parseIdList, traceTypeMeta } from '~/utils/networkTrace';

const props = defineProps<{
  initialLineId?: number | null;
  initialNodeId?: number | null;
}>();

const emit = defineEmits<{
  'show-on-map': [data: NetworkTraceResponse];
  'clear-highlight': [];
  'focus-coords': [lng: number, lat: number];
}>();

const visible = defineModel<boolean>({ default: false });
const overlay = useDialogMapOverlay(visible, () => emit('clear-highlight'));
const { shown: overlayShown, keepOnMap } = overlay;
const { isMobile } = useMobile();

/** Сколько строк потребителей показывать в таблице (полный список — в CSV) */
const CONSUMERS_SHOWN = 200;
/** Сколько зон без питания показывать — остальные видны в счётчике */
const ISLANDS_SHOWN = 100;

const mode = ref<'trace' | 'zones'>('trace');
const modeItems = [
  { value: 'trace', label: 'Трассировка', icon: 'mdi-transit-connection-variant' },
  { value: 'zones', label: 'Зоны сети', icon: 'mdi-source-branch' },
];

const traceType = ref<NetworkTraceType>('upstream');
/** Иконки типов — здесь, а не в utils/networkTrace.ts: они из ленивого набора иконок окон */
const TRACE_ICONS: Record<NetworkTraceType, string> = {
  upstream: 'mdi-arrow-up-thin',
  downstream: 'mdi-arrow-down-thin',
  connected: 'mdi-vector-polyline',
  subnetwork: 'mdi-source-branch',
};
const traceTypeItems = TRACE_TYPES.map(({ value, label }) => ({ value, label, icon: TRACE_ICONS[value] }));
const currentMeta = computed(() => traceTypeMeta(traceType.value));

const startLines = ref('');
const startNodes = ref('');
const barrierLines = ref('');
const barrierNodes = ref('');
const stopAtValves = ref(false);
const showBarriers = ref(false);

const loading = ref(false);
const errorMessage = ref('');
const result = ref<NetworkTraceResponse | null>(null);
const resultTab = ref<'consumers' | 'valves' | 'sources'>('consumers');

const zonesLoading = ref(false);
const zones = ref<NetworkZonesResponse | null>(null);
const islands = computed(() => (zones.value?.zones ?? []).filter((z) => !z.has_source));
const fedZones = computed(() => (zones.value?.zones ?? []).filter((z) => z.has_source));

const applyScope = (lineId?: number | null, nodeId?: number | null) => {
  if (lineId) {
    startLines.value = String(lineId);
    startNodes.value = '';
  } else if (nodeId) {
    startNodes.value = String(nodeId);
    startLines.value = '';
  }
};

watch(() => [props.initialLineId, props.initialNodeId] as const, ([l, n]) => applyScope(l, n), { immediate: true });

const runTrace = async () => {
  const lines = parseIdList(startLines.value);
  const nodes = parseIdList(startNodes.value);
  const bLines = parseIdList(barrierLines.value);
  const bNodes = parseIdList(barrierNodes.value);
  const firstError = [lines, nodes, bLines, bNodes].find((p) => p.error)?.error;
  if (firstError) {
    errorMessage.value = firstError;
    return;
  }
  if (!lines.ids.length && !nodes.ids.length) {
    errorMessage.value = 'Укажите участок или узел — начальную точку трассировки';
    return;
  }
  loading.value = true;
  errorMessage.value = '';
  try {
    const res = await fastApiService.traceNetwork({
      trace_type: traceType.value,
      start_line_ids: lines.ids,
      start_node_ids: nodes.ids,
      barrier_line_ids: bLines.ids,
      barrier_node_ids: bNodes.ids,
      stop_at_valves: traceType.value === 'connected' && stopAtValves.value,
    });
    result.value = res;
    resultTab.value = res.trace_type === 'upstream' ? 'sources' : 'consumers';
    emit('show-on-map', res);
    overlay.markShown();
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Не удалось выполнить трассировку');
    result.value = null;
  } finally {
    loading.value = false;
  }
};

const loadZones = async () => {
  zonesLoading.value = true;
  errorMessage.value = '';
  try {
    zones.value = await fastApiService.getNetworkZones();
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Не удалось построить зоны сети');
  } finally {
    zonesLoading.value = false;
  }
};

watch(mode, (m) => {
  if (m === 'zones' && !zones.value && !zonesLoading.value) loadZones();
});

/** Показать зону: трассировка «Зона» от любого её узла */
const traceZone = (nodeId: number) => {
  mode.value = 'trace';
  traceType.value = 'subnetwork';
  startNodes.value = String(nodeId);
  startLines.value = '';
  runTrace();
};

const emitShowOnMap = () => {
  if (!result.value) return;
  emit('show-on-map', result.value);
  overlay.markShown();
};

const emitClearHighlight = () => {
  emit('clear-highlight');
  overlay.markCleared();
};

const numberFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const formatNumber = (value: number) => numberFormat.format(value);

const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const exportCsv = () => {
  const res = result.value;
  if (!res) return;
  const rows: unknown[][] = [['Вид', 'ID', 'Наименование', 'Узел / участок', 'Q сум, Гкал/ч']];
  for (const s of res.sources) rows.push([FEED_POINT_LABELS[s.kind], s.node_id, '', s.node_id, '']);
  for (const v of res.valves) rows.push(['Задвижка', v.id, v.display_name, v.owner_node_id ?? v.lineid, '']);
  for (const c of res.consumers) rows.push(['Потребитель', c.id, c.name, c.node_id, c.total_load]);
  for (const id of res.line_ids) rows.push(['Участок', id, '', '', '']);
  const csv = '﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `Трассировка_${res.trace_type}_${Date.now()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const openDialog = (scope?: { lineId?: number; nodeId?: number }) => {
  applyScope(scope?.lineId, scope?.nodeId);
  mode.value = 'trace';
  visible.value = true;
};

defineExpose({ openDialog });
</script>

<template>
  <v-dialog
    v-model="visible"
    :fullscreen="isMobile"
    max-width="1000"
    scrollable
  >
    <v-card
      rounded="lg"
      class="trace-dialog"
    >
      <v-card-title class="d-flex align-center ga-2 bg-surface-variant py-3 px-4">
        <v-icon size="24">mdi-transit-connection-variant</v-icon>
        <span class="text-h6 font-weight-bold">Трассировка сети</span>
        <v-spacer />
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

      <v-card-text class="pa-4">
        <SegmentedToggle
          v-model="mode"
          :items="modeItems"
          aria-label="Режим"
          class="mb-3"
        />

        <v-alert
          v-if="errorMessage"
          type="error"
          density="compact"
          variant="tonal"
          class="mb-3"
          closable
          @click:close="errorMessage = ''"
        >
          {{ errorMessage }}
        </v-alert>

        <template v-if="mode === 'trace'">
          <v-card
            variant="outlined"
            class="mb-3 pa-3 rounded-lg"
          >
            <SegmentedToggle
              v-model="traceType"
              :items="traceTypeItems"
              aria-label="Тип трассировки"
            />
            <div class="text-caption text-medium-emphasis mt-2">{{ currentMeta.hint }}</div>

            <div class="d-flex flex-wrap ga-3 mt-3">
              <v-text-field
                v-model="startLines"
                label="Участки (id через запятую)"
                density="compact"
                variant="outlined"
                hide-details
                clearable
                class="trace-field"
              />
              <v-text-field
                v-model="startNodes"
                label="Узлы (id через запятую)"
                density="compact"
                variant="outlined"
                hide-details
                clearable
                class="trace-field"
              />
            </div>

            <div class="d-flex flex-wrap align-center ga-2 mt-2">
              <v-btn
                variant="text"
                size="small"
                :prepend-icon="showBarriers ? 'mdi-chevron-up' : 'mdi-chevron-down'"
                @click="showBarriers = !showBarriers"
              >
                Барьеры
              </v-btn>
              <v-checkbox
                v-if="traceType === 'connected'"
                v-model="stopAtValves"
                label="Остановить на задвижках"
                density="compact"
                hide-details
              />
              <v-spacer />
              <v-btn
                color="primary"
                variant="flat"
                prepend-icon="mdi-play"
                :loading="loading"
                @click="runTrace"
              >
                Трассировать
              </v-btn>
            </div>

            <div
              v-if="showBarriers"
              class="d-flex flex-wrap ga-3 mt-2"
            >
              <v-text-field
                v-model="barrierLines"
                label="Участки-барьеры"
                density="compact"
                variant="outlined"
                hide-details
                clearable
                class="trace-field"
              />
              <v-text-field
                v-model="barrierNodes"
                label="Узлы-барьеры"
                density="compact"
                variant="outlined"
                hide-details
                clearable
                class="trace-field"
              />
              <div class="text-caption text-medium-emphasis w-100">
                Закрытые задвижки — барьер всегда. Барьер не проводит воду: обход через него не идёт.
              </div>
            </div>
          </v-card>

          <template v-if="result">
            <div class="d-flex flex-wrap ga-2 mb-3">
              <v-chip
                :color="traceTypeMeta(result.trace_type).color"
                variant="flat"
                size="small"
              >
                {{ traceTypeMeta(result.trace_type).label }}
              </v-chip>
              <v-chip size="small">Участков: {{ result.summary.lines_count }}</v-chip>
              <v-chip size="small">Узлов: {{ result.summary.nodes_count }}</v-chip>
              <v-chip size="small">Длина труб: {{ formatNumber(result.summary.total_pipe_length_m) }} м</v-chip>
              <v-chip size="small">Объём: {{ formatNumber(result.summary.total_pipe_volume_m3) }} м³</v-chip>
              <v-chip size="small">Питающих точек: {{ result.summary.sources_count }}</v-chip>
              <v-chip size="small">Задвижек: {{ result.summary.valves_count }}</v-chip>
              <v-chip
                v-if="result.trace_type !== 'upstream'"
                size="small"
              >
                Потребителей: {{ result.summary.consumers_count }} · {{ result.summary.total_load_gcal_h }} Гкал/ч
              </v-chip>
            </div>

            <v-alert
              type="info"
              variant="tonal"
              density="compact"
              class="mb-3"
            >
              Оценка по связности сети: направление потока задают питающие точки (источники и узлы заданного
              напора), напор и расход не проверяются.
              <template v-if="result.geometry_truncated">
                Участков слишком много для показа на карте — доступны списком и в CSV.
              </template>
            </v-alert>

            <div class="d-flex flex-wrap ga-2 mb-3">
              <v-btn
                variant="tonal"
                prepend-icon="mdi-map-marker-path"
                :disabled="result.geometry_truncated"
                @click="emitShowOnMap"
              >
                Показать на карте
              </v-btn>
              <v-btn
                v-if="overlayShown"
                variant="text"
                prepend-icon="mdi-close"
                @click="emitClearHighlight"
              >
                Снять с карты
              </v-btn>
              <v-spacer />
              <v-btn
                variant="tonal"
                prepend-icon="mdi-download"
                @click="exportCsv"
              >
                CSV
              </v-btn>
            </div>

            <v-card
              variant="outlined"
              class="rounded-lg"
            >
              <v-tabs
                v-model="resultTab"
                density="compact"
                color="primary"
              >
                <v-tab
                  v-if="result.trace_type !== 'upstream'"
                  value="consumers"
                >
                  Потребители ({{ result.summary.consumers_count }})
                </v-tab>
                <v-tab value="valves">Задвижки ({{ result.valves.length }})</v-tab>
                <v-tab value="sources">Питающие точки ({{ result.sources.length }})</v-tab>
              </v-tabs>
              <v-divider />
              <v-window v-model="resultTab">
                <v-window-item value="consumers">
                  <v-table
                    density="compact"
                    hover
                    fixed-header
                    height="320"
                  >
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Наименование</th>
                        <th>Узел</th>
                        <th>Q сум, Гкал/ч</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="c in result.consumers.slice(0, CONSUMERS_SHOWN)"
                        :key="`${c.consumer_type}-${c.id}`"
                      >
                        <td>{{ c.id }}</td>
                        <td>{{ c.name }}</td>
                        <td>{{ c.node_id }}</td>
                        <td>{{ c.total_load }}</td>
                        <td>
                          <v-btn
                            v-if="c.longitude && c.latitude"
                            icon="mdi-crosshairs-gps"
                            size="x-small"
                            variant="text"
                            aria-label="Показать потребителя"
                            @click="emit('focus-coords', c.longitude, c.latitude)"
                          />
                        </td>
                      </tr>
                      <tr v-if="!result.consumers.length">
                        <td
                          colspan="5"
                          class="text-center text-medium-emphasis py-4"
                        >
                          Потребителей нет
                        </td>
                      </tr>
                      <tr v-else-if="result.consumers.length > CONSUMERS_SHOWN || result.consumers_truncated">
                        <td
                          colspan="5"
                          class="text-center text-medium-emphasis py-2"
                        >
                          Показаны первые {{ CONSUMERS_SHOWN }} из {{ result.summary.consumers_count }} — полный список в CSV
                        </td>
                      </tr>
                    </tbody>
                  </v-table>
                </v-window-item>

                <v-window-item value="valves">
                  <v-table
                    density="compact"
                    hover
                    fixed-header
                    height="320"
                  >
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Наименование</th>
                        <th>Где</th>
                        <th>Состояние</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="v in result.valves"
                        :key="v.id"
                      >
                        <td>{{ v.id }}</td>
                        <td>{{ v.display_name }}</td>
                        <td>{{ v.owner_node_id ? `узел ${v.owner_node_id}` : `участок ${v.lineid}` }}</td>
                        <td>{{ v.state_name }}</td>
                        <td>
                          <v-btn
                            v-if="v.lng && v.lat"
                            icon="mdi-crosshairs-gps"
                            size="x-small"
                            variant="text"
                            aria-label="Показать задвижку"
                            @click="emit('focus-coords', v.lng, v.lat)"
                          />
                        </td>
                      </tr>
                      <tr v-if="!result.valves.length">
                        <td
                          colspan="5"
                          class="text-center text-medium-emphasis py-4"
                        >
                          Задвижек нет
                        </td>
                      </tr>
                    </tbody>
                  </v-table>
                </v-window-item>

                <v-window-item value="sources">
                  <v-table density="compact">
                    <thead>
                      <tr>
                        <th>Узел</th>
                        <th>Вид</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="s in result.sources"
                        :key="s.node_id"
                      >
                        <td>{{ s.node_id }}</td>
                        <td>{{ FEED_POINT_LABELS[s.kind] }}</td>
                      </tr>
                      <tr v-if="!result.sources.length">
                        <td
                          colspan="2"
                          class="text-center text-medium-emphasis py-4"
                        >
                          Нет связи ни с одной питающей точкой
                        </td>
                      </tr>
                    </tbody>
                  </v-table>
                </v-window-item>
              </v-window>
            </v-card>
          </template>
        </template>

        <template v-else>
          <div class="d-flex align-center ga-2 mb-3">
            <div
              v-if="zones"
              class="text-body-2"
            >
              Зон: <b>{{ zones.zones_count }}</b>, с питанием {{ zones.zones_with_source }}, без питания
              <b>{{ zones.islands_count }}</b> ({{ zones.islands_nodes_count }} узлов)
            </div>
            <v-spacer />
            <v-btn
              variant="tonal"
              prepend-icon="mdi-refresh"
              :loading="zonesLoading"
              @click="loadZones"
            >
              Обновить
            </v-btn>
          </div>
          <v-progress-linear
            v-if="zonesLoading && !zones"
            indeterminate
          />
          <template v-if="zones">
            <div class="text-subtitle-2 mb-1">Без питания — проверить данные</div>
            <div class="text-caption text-medium-emphasis mb-2">
              Участки, не связанные ни с источником, ни с узлом заданного напора: разрыв топологии,
              потерянная связь фрагментов или сеть, отрезанная закрытыми задвижками.
            </div>
            <v-table
              density="compact"
              hover
              fixed-header
              height="260"
              class="mb-4"
            >
              <thead>
                <tr>
                  <th>Зона</th>
                  <th>Узлов</th>
                  <th>Участков</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="z in islands.slice(0, ISLANDS_SHOWN)"
                  :key="z.zone"
                >
                  <td>№ {{ z.zone }}</td>
                  <td>{{ z.nodes_count }}</td>
                  <td>{{ z.lines_count }}</td>
                  <td>
                    <v-btn
                      size="x-small"
                      variant="text"
                      prepend-icon="mdi-map-search-outline"
                      @click="traceZone(z.sample_node_id)"
                    >
                      Показать
                    </v-btn>
                  </td>
                </tr>
                <tr v-if="!islands.length">
                  <td
                    colspan="4"
                    class="text-center text-medium-emphasis py-4"
                  >
                    Все участки связаны с питанием
                  </td>
                </tr>
              </tbody>
            </v-table>

            <div class="text-subtitle-2 mb-1">Крупнейшие зоны с питанием</div>
            <v-table
              density="compact"
              hover
            >
              <thead>
                <tr>
                  <th>Зона</th>
                  <th>Узлов</th>
                  <th>Питающие точки</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="z in fedZones.slice(0, 20)"
                  :key="z.zone"
                >
                  <td>№ {{ z.zone }}</td>
                  <td>{{ z.nodes_count }}</td>
                  <td>
                    {{ z.sources.map((s) => `${s.node_id} (${FEED_POINT_LABELS[s.kind].toLowerCase()})`).join(', ') }}
                  </td>
                  <td>
                    <v-btn
                      size="x-small"
                      variant="text"
                      prepend-icon="mdi-map-search-outline"
                      @click="traceZone(z.sample_node_id)"
                    >
                      Показать
                    </v-btn>
                  </td>
                </tr>
              </tbody>
            </v-table>
          </template>
        </template>
      </v-card-text>

      <v-divider />
      <v-card-actions class="px-4 py-2">
        <v-spacer />
        <v-btn
          v-if="overlayShown"
          variant="tonal"
          prepend-icon="mdi-map-check-outline"
          @click="keepOnMap"
        >Оставить на карте</v-btn>
        <v-btn
          variant="text"
          @click="visible = false"
        >Закрыть</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.trace-dialog {
  max-height: 90vh;
}

.trace-field {
  min-width: 220px;
  flex: 1 1 220px;
}
</style>
