<template>
  <!-- Точка трассы по координатам: местная система, x/y десктопа или WGS84 -->
  <v-dialog
    v-model="open"
    max-width="460"
  >
    <v-card rounded="lg">
      <v-card-title class="d-flex align-center bg-primary text-white pa-3">
        <v-icon class="me-2">
          mdi-crosshairs-gps
        </v-icon>
        <span class="text-subtitle-1">Точка по координатам</span>
      </v-card-title>

      <v-card-text class="pa-4">
        <v-select
          v-model="crs"
          :items="POINT_CRS_ITEMS"
          item-title="title"
          item-value="value"
          label="Система координат"
          density="compact"
          variant="outlined"
          hide-details
          class="mb-3"
        />
        <div class="d-flex ga-2">
          <v-text-field
            v-model="xText"
            :label="crsItem.x"
            density="compact"
            variant="outlined"
            hide-details="auto"
            autofocus
            @paste="onPaste"
            @keydown.enter="add"
          />
          <v-text-field
            v-model="yText"
            :label="crsItem.y"
            density="compact"
            variant="outlined"
            hide-details="auto"
            @keydown.enter="add"
          />
        </div>
        <div class="text-caption text-medium-emphasis mt-1">
          Можно вставить пару «X Y» из ведомости в первое поле. Ближе
          {{ String(COORD_NODE_SNAP_M).replace('.', ',') }} м к узлу сети — точка встанет в узел.
        </div>

        <v-alert
          v-if="error"
          type="error"
          variant="tonal"
          density="compact"
          class="mt-3"
        >
          {{ error }}
        </v-alert>
        <div
          v-for="(l, i) in log"
          :key="i"
          class="text-caption mt-2"
        >
          <v-icon
            size="14"
            :color="l.ok ? 'success' : 'warning'"
            class="me-1"
          >
            {{ l.ok ? 'mdi-check' : 'mdi-alert-outline' }}
          </v-icon>
          {{ l.text }}
        </div>
      </v-card-text>

      <v-card-actions class="pa-3">
        <v-spacer />
        <v-btn
          variant="text"
          @click="open = false"
        >
          Закрыть
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :loading="busy"
          @click="add"
        >
          Добавить в трассу
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { appStorage } from '~/utils/appStorage';
import { formatApiError } from '~/utils/apiError';
import { COORD_NODE_SNAP_M } from '~/composables/useTraceDraw';
import {
  POINT_CRS_ITEMS,
  coordRangeError,
  describeConverted,
  parseCoord,
  parseCoordPair,
  type ConvertedPoint,
  type PointCrs,
} from '~/utils/pointCrs';
import type { TracePoint } from '~/utils/cadChain';

const open = defineModel<boolean>({ default: false });
const props = defineProps<{
  /** пересчёт и добавление точки (useTopologyEditor.addTracePointByCoords) */
  addPoint: (crs: PointCrs, x: number, y: number) => Promise<{ converted: ConvertedPoint; point: TracePoint | null }>
}>();

const CRS_KEY = 'topologyCoordCrs';
const crs = ref<PointCrs>((() => {
  try {
    const v = appStorage.getItem(CRS_KEY);
    return POINT_CRS_ITEMS.some((i) => i.value === v) ? (v as PointCrs) : 'local';
  } catch {
    return 'local';
  }
})());
watch(crs, (v) => {
  try {
    appStorage.setItem(CRS_KEY, v);
  } catch {
    // удобство: без хранилища действует до перезагрузки
  }
});
const crsItem = computed(() => POINT_CRS_ITEMS.find((i) => i.value === crs.value)!);
const xText = ref('');
const yText = ref('');
const busy = ref(false);
const error = ref<string | null>(null);
const log = ref<{ ok: boolean; text: string }[]>([]);

const onPaste = (e: ClipboardEvent) => {
  const pair = parseCoordPair(e.clipboardData?.getData('text') ?? '');
  if (!pair) return;
  e.preventDefault();
  xText.value = String(pair[0]);
  yText.value = String(pair[1]);
};

const add = async () => {
  error.value = null;
  const x = parseCoord(xText.value);
  const y = parseCoord(yText.value);
  if (x == null || y == null) {
    error.value = 'Введите два числа: X и Y';
    return;
  }
  const range = coordRangeError(crs.value, x, y);
  if (range) {
    error.value = range;
    return;
  }
  busy.value = true;
  try {
    const { converted, point } = await props.addPoint(crs.value, x, y);
    const where = point?.kind === 'node' ? `узел ${point.nodeId}` : point ? 'новая точка' : 'совпала с предыдущей — не добавлена';
    log.value = [{ ok: Boolean(point), text: `${where}: ${describeConverted(converted)}` }, ...log.value].slice(0, 5);
    xText.value = '';
    yText.value = '';
  } catch (err) {
    error.value = formatApiError(err, 'Не удалось добавить точку');
  } finally {
    busy.value = false;
  }
};
</script>
