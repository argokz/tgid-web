<template>
  <svg
    class="sparkline"
    :width="width"
    :height="height"
    :viewBox="`0 0 ${width} ${height}`"
    role="img"
    :aria-label="ariaLabel"
    preserveAspectRatio="none"
  >
    <title>{{ ariaLabel }}</title>
    <template v-if="points.length">
      <path
        v-if="area"
        :d="areaPath"
        class="sparkline__area"
      />
      <path
        :d="linePath"
        class="sparkline__line"
        fill="none"
      />
      <circle
        :cx="last.x"
        :cy="last.y"
        r="2.5"
        class="sparkline__last"
      />
    </template>
    <line
      v-else
      :x1="0"
      :x2="width"
      :y1="height / 2"
      :y2="height / 2"
      class="sparkline__empty"
    />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';

/**
 * Sparkline (по `dataviz`): тонкая линия в приглушённом тоне, последняя точка — акцентом; один ряд, без осей
 * и подписей (число рядом несёт значение). Цвет не единственный носитель смысла — `aria-label` описывает тренд.
 */
const props = withDefaults(defineProps<{
  values: readonly (number | null | undefined)[];
  width?: number;
  height?: number;
  /** Заливка под линией (для плиток), в строках таблицы — нет */
  area?: boolean;
  /** Подпись для читалок: «Расход за 12 месяцев: от 0,8 до 1,4, сейчас 1,2» */
  label?: string;
  /** Нижняя граница шкалы; по умолчанию минимум ряда (а не 0 — тренд важнее абсолюта) */
  min?: number | null;
  max?: number | null;
}>(), {
  width: 72,
  height: 20,
  area: false,
  label: '',
  min: null,
  max: null,
});

const PAD = 3;

const numeric = computed(() => props.values.map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)));

const points = computed(() => {
  const vals = numeric.value;
  const present = vals.filter((v): v is number => v !== null);
  if (present.length < 2) return [] as Array<{ x: number; y: number }>;
  const lo = props.min ?? Math.min(...present);
  const hi = props.max ?? Math.max(...present);
  const span = hi - lo || 1;
  const stepX = (props.width - PAD * 2) / Math.max(1, vals.length - 1);
  return vals.flatMap((v, i) => (v === null ? [] : [{
    x: PAD + i * stepX,
    y: PAD + (props.height - PAD * 2) * (1 - (v - lo) / span),
  }]));
});

const fmt = (n: number) => n.toFixed(1).replace(/\.0$/, '').replace('.', ',');
const linePath = computed(() => points.value.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' '));
const areaPath = computed(() => {
  const pts = points.value;
  if (!pts.length) return '';
  const first = pts[0];
  const end = pts[pts.length - 1];
  return `${linePath.value} L${end.x.toFixed(1)} ${props.height - PAD} L${first.x.toFixed(1)} ${props.height - PAD} Z`;
});
const last = computed(() => points.value[points.value.length - 1] ?? { x: 0, y: 0 });

const ariaLabel = computed(() => {
  if (props.label) return props.label;
  const present = numeric.value.filter((v): v is number => v !== null);
  if (present.length < 2) return 'Нет данных для графика';
  const first = present[0];
  const lastValue = present[present.length - 1];
  const direction = lastValue > first ? 'рост' : lastValue < first ? 'снижение' : 'без изменений';
  return `${present.length} значений, от ${fmt(Math.min(...present))} до ${fmt(Math.max(...present))}, сейчас ${fmt(lastValue)}: ${direction}`;
});

defineExpose({ points, ariaLabel });
</script>

<style scoped>
.sparkline {
  display: inline-block;
  vertical-align: middle;
  overflow: visible;
}

.sparkline__line {
  stroke: rgba(var(--v-theme-on-surface), 0.45);
  stroke-width: 1.5;
  stroke-linejoin: round;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}

.sparkline__area {
  fill: rgba(var(--v-theme-on-surface), 0.06);
}

.sparkline__last {
  fill: var(--accent);
}

.sparkline__empty {
  stroke: rgba(var(--v-theme-on-surface), 0.2);
  stroke-dasharray: 2 3;
}
</style>
