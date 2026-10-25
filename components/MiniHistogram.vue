<template>
  <figure
    class="mini-histogram"
    :aria-label="description"
  >
    <svg
      v-if="histogram"
      class="mini-histogram__chart"
      :viewBox="`0 0 ${VIEW_WIDTH} ${height}`"
      :height="height"
      preserveAspectRatio="none"
      role="img"
      :aria-label="description"
    >
      <title>{{ description }}</title>
      <rect
        v-for="(bin, index) in histogram.bins"
        :key="index"
        class="mini-histogram__bar"
        :class="{ 'mini-histogram__bar--empty': !bin.count }"
        :x="index * barWidth + BAR_GAP / 2"
        :width="Math.max(1, barWidth - BAR_GAP)"
        :y="height - barHeight(bin.count)"
        :height="barHeight(bin.count)"
      >
        <title>{{ binTitle(bin) }}</title>
      </rect>
    </svg>
    <div
      v-else
      class="mini-histogram__empty"
    >
      Нет числовых значений
    </div>
    <figcaption
      v-if="histogram"
      class="mini-histogram__axis"
    >
      <span>{{ format(histogram.min) }}</span>
      <span class="mini-histogram__label">{{ label }} · медиана {{ format(histogram.median) }}{{ unitSuffix }}</span>
      <span>{{ format(histogram.max) }}{{ unitSuffix }}</span>
    </figcaption>
  </figure>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatChartNumber } from '~/utils/chartOptions'
import { buildHistogram, type HistogramBin } from '~/utils/histogram'

/**
 * Мини-гистограмма (docs/ui-primitives.md, этап 6, по `dataviz`): распределение одного показателя в выборке —
 * столбцы равных интервалов, подписи минимума, медианы и максимума. Inline SVG без ECharts; описание для чтения
 * с экрана и подсказка у каждого столбца («−0,5 … 0 м: 12»). Цвет одинаковый — смысл несут высота и подписи.
 */
const props = withDefaults(defineProps<{
  values: ReadonlyArray<unknown>
  /** Что распределено: «Перепад» */
  label: string
  units?: string
  bins?: number
  height?: number
  digits?: number
}>(), {
  units: '',
  bins: 12,
  height: 44,
  digits: 2
})

const VIEW_WIDTH = 240
const BAR_GAP = 2

const histogram = computed(() => buildHistogram(props.values, props.bins))
const barWidth = computed(() => VIEW_WIDTH / (histogram.value?.bins.length || 1))
const unitSuffix = computed(() => (props.units ? ` ${props.units}` : ''))
const format = (value: number) => formatChartNumber(value, props.digits)
/** Высота столбца; непустой — не ниже 2 px, чтобы одиночные значения были видны */
const barHeight = (count: number) => {
  const peak = histogram.value?.peak || 1
  return count ? Math.max(2, (count / peak) * props.height) : 1
}
const binTitle = (bin: HistogramBin) => `${format(bin.from)} … ${format(bin.to)}${unitSuffix.value}: ${bin.count}`
const description = computed(() => {
  const h = histogram.value
  if (!h) return `${props.label}: нет числовых значений`
  return `${props.label}: ${h.total} значений от ${format(h.min)} до ${format(h.max)}${unitSuffix.value}, медиана ${format(h.median)}${unitSuffix.value}`
})
</script>

<style scoped>
.mini-histogram { margin: 0; min-width: 0; }
.mini-histogram__chart { display: block; width: 100%; }
.mini-histogram__bar { fill: rgb(var(--v-theme-primary)); opacity: 0.75; }
.mini-histogram__bar:hover { opacity: 1; }
.mini-histogram__bar--empty { fill: rgba(var(--v-theme-on-surface), 0.12); opacity: 1; }
.mini-histogram__axis {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  margin-top: 2px;
  font-size: var(--text-xs, 0.75rem);
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-variant-numeric: tabular-nums;
}
.mini-histogram__label { text-align: center; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mini-histogram__empty {
  font-size: var(--text-xs, 0.75rem);
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
</style>
