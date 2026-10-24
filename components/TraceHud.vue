<template>
  <!-- Бейдж у курсора при рисовании трассы: привязка, длины, поворот, ввод длины и угла -->
  <div
    v-if="position"
    class="trace-hud"
    :style="{ left: `${position.x + 16}px`, top: `${position.y + 16}px` }"
  >
    <div
      v-if="snapText"
      class="trace-hud__snap"
    >
      {{ snapText }}
    </div>
    <div v-if="drawing">
      {{ formatMeters(lengths.lastM) }}
      <span
        v-if="turnText"
        class="trace-hud__turn"
      >· {{ turnText }}</span>
      <span
        v-if="guideText"
        class="trace-hud__guide"
      >· {{ guideText }}</span>
    </div>
    <div
      v-if="drawing && (lengths.segmentM !== lengths.lastM || lengths.totalM !== lengths.segmentM)"
      class="trace-hud__dim"
    >
      <span v-if="lengths.segmentM !== lengths.lastM">участок {{ formatMeters(lengths.segmentM) }}</span>
      <span v-if="lengths.totalM !== lengths.segmentM"> · всего {{ formatMeters(lengths.totalM) }}</span>
    </div>
    <div
      v-if="drawing && input"
      class="trace-hud__input"
    >
      <span
        class="trace-hud__field"
        :class="{ 'trace-hud__field--active': input.field === 'length', 'trace-hud__field--locked': metrics?.lockedLength }"
      >Длина <b>{{ input.length || '—' }}</b> м</span>
      <span
        class="trace-hud__field"
        :class="{ 'trace-hud__field--active': input.field === 'angle', 'trace-hud__field--locked': metrics?.lockedAngle }"
      >{{ angleIsAzimuth ? 'Азимут' : 'Поворот' }} <b>{{ input.angle || '—' }}</b>°</span>
    </div>
    <div
      v-if="drawing && input && !input.field"
      class="trace-hud__dim"
    >
      цифры — длина, Tab — {{ angleIsAzimuth ? 'азимут' : 'поворот (− влево)' }}, Shift — 90°
    </div>
    <div
      v-else-if="drawing && input?.field"
      class="trace-hud__dim"
    >
      Enter — поставить точку, Tab — другое поле, Esc — сбросить ввод
    </div>
    <div
      v-if="buildingText"
      :class="distances?.buildingWarn ? 'trace-hud__warn' : 'trace-hud__ctx'"
    >
      {{ buildingText }}
    </div>
    <div
      v-if="roadText"
      :class="distances?.roadWarn ? 'trace-hud__warn' : 'trace-hud__ctx'"
    >
      {{ roadText }}
    </div>
    <div
      v-if="hint"
      class="trace-hud__dim"
    >
      {{ hint }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { formatMeters, formatTurn } from '~/utils/cadGeometry';
import { formatApproxM, ON_WALL_M } from '~/utils/cadContext';
import { snapLabel, type SnapResult } from '~/utils/cadSnap';
import type { CadInputState } from '~/utils/cadInput';
import type { TraceDistances, TraceMetrics } from '~/composables/useTraceDraw';
import type { CadDefaults } from '~/utils/cityConfig';

const props = defineProps<{
  position: { x: number; y: number } | null
  snap: SnapResult | null
  drawing: boolean
  lengths: { totalM: number; segmentM: number; lastM: number }
  metrics?: TraceMetrics | null
  input?: CadInputState | null
  /** угол в поле — азимут (первый участок трассы), иначе поворот от предыдущего */
  angleIsAzimuth?: boolean
  hint?: string
  /** размеры до здания и оси улицы по подложке (ориентировочно) */
  distances?: TraceDistances | null
  /** охранные расстояния города, м */
  norms?: CadDefaults | null
}>();

const normText = (m: number | null | undefined) => (m != null ? ` — меньше нормы ${formatMeters(m)}` : '');

const buildingText = computed(() => {
  const b = props.distances?.building;
  if (!b) return '';
  const house = b.buildingNumber ? ` (дом ${b.buildingNumber})` : '';
  if (b.inside) return `внутри здания${house}`;
  if (b.distM < ON_WALL_M) return `на стене здания${house}`;
  const warn = props.distances?.buildingWarn ? normText(props.norms?.buildingM) : '';
  return `${formatApproxM(b.distM)} до здания${house}${warn}`;
});

const roadText = computed(() => {
  const r = props.distances?.road;
  if (!r) return '';
  const warn = props.distances?.roadWarn ? normText(props.norms?.roadM) : '';
  if (r.distM < ON_WALL_M) return `на оси ${r.roadName || 'улицы'}${warn}`;
  return `${formatApproxM(r.distM)} до оси ${r.roadName || 'улицы'}${warn}`;
});

const snapText = computed(() => {
  if (!props.snap) return '';
  const label = snapLabel(props.snap);
  return props.snap.lineId != null && props.snap.kind !== 'node' && props.snap.pipe === false
    ? `${label} (оборудование — врезка невозможна)`
    : label;
});

const turnText = computed(() => {
  const t = props.metrics?.turnDeg;
  return t == null ? '' : formatTurn(t);
});

const guideText = computed(() => {
  switch (props.metrics?.guide) {
    case 'parallel':
      return '∥ трубе';
    case 'perpendicular':
      return '⊥ трубе';
    case 'polar':
      return 'шаг угла';
    default:
      return '';
  }
});
</script>

<style scoped>
.trace-hud {
  position: absolute;
  z-index: var(--z-hud);
  pointer-events: none;
  padding: 3px 8px;
  border-radius: 6px;
  background: rgba(33, 33, 33, 0.85);
  color: #fff;
  font-size: 12px;
  line-height: 1.4;
  white-space: nowrap;
}
.trace-hud__snap {
  font-weight: 600;
}
.trace-hud__dim {
  opacity: 0.75;
}
.trace-hud__turn {
  color: #ffcc80;
}
.trace-hud__ctx {
  color: #d7ccc8;
}
.trace-hud__warn {
  color: #ff8a80;
  font-weight: 600;
}
.trace-hud__guide {
  color: #80cbc4;
}
.trace-hud__input {
  display: flex;
  gap: 6px;
  margin-top: 2px;
}
.trace-hud__field {
  padding: 0 5px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 4px;
}
.trace-hud__field--active {
  border-color: #ffb74d;
  background: rgba(255, 183, 77, 0.2);
}
.trace-hud__field--locked b {
  color: #ffcc80;
}
</style>
