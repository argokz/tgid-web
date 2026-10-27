<template>
  <section
    class="map-legend"
    :style="legendStyle"
    role="region"
    :aria-label="`Легенда: ${title}`"
  >
    <div class="map-legend__head">
      <div class="map-legend__title text-truncate">
        {{ title }}
      </div>
      <slot name="actions" />
    </div>
    <div
      v-if="subtitle"
      class="map-legend__subtitle text-truncate"
    >
      {{ subtitle }}
    </div>
    <div
      class="map-legend__bar"
      :style="{ background: gradient }"
      aria-hidden="true"
    />
    <div class="map-legend__ticks">
      <span
        v-for="(tick, index) in ticks"
        :key="index"
      >{{ tick }}</span>
    </div>
    <div
      v-if="note"
      class="map-legend__note"
    >
      {{ note }}
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore } from '~/stores/uiStore'
import { formatChartNumber } from '~/utils/chartOptions'

/**
 * Легенда цветовой шкалы на карте (docs/ui-primitives.md, этап 6): название показателя, полоса градиента и
 * подписи порогов с единицами — цвет на карте читается без диалога, а подписи несут смысл и без цвета.
 * Стоит в нижнем левом углу карты над координатами курсора (`--z-hud`).
 */
const props = withDefaults(defineProps<{
  title: string
  subtitle?: string
  /** Пороги шкалы по возрастанию: [значение, цвет] */
  stops: ReadonlyArray<readonly [number, string]>
  units?: string
  /** Пояснение под шкалой («выше максимума — тёмно-красный») */
  note?: string
}>(), {
  subtitle: '',
  units: '',
  note: ''
})

const ui = useUiStore()
/** Левее — открытая панель слоёв: легенда встаёт правее неё с отступом каркаса */
const legendStyle = computed(() => ({ '--legend-left': `${ui.leftInset}px` }))

const max = computed(() => props.stops[props.stops.length - 1]?.[0] || 1)
const gradient = computed(() => `linear-gradient(to right, ${props.stops
  .map(([value, color]) => `${color} ${Math.round((value / max.value) * 100)}%`).join(', ')})`)
const ticks = computed(() => props.stops.map(([value], index) => {
  const label = formatChartNumber(value, 2)
  const last = index === props.stops.length - 1
  return last ? `≥ ${label}${props.units ? ` ${props.units}` : ''}` : label
}))
</script>

<style scoped>
.map-legend {
  position: absolute;
  left: calc(var(--legend-left, 0px) + var(--shell-inset));
  bottom: calc(40px + var(--safe-bottom, 0px));
  z-index: var(--z-hud);
  width: 248px;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-2, 8px);
  background: rgba(var(--v-theme-surface), 0.94);
  box-shadow: var(--shadow-2, 0 2px 8px rgba(0, 0, 0, 0.16));
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  font-size: var(--text-xs, 0.75rem);
}
.map-legend__head { display: flex; align-items: center; gap: var(--space-1); }
.map-legend__title { flex: 1; font-weight: 600; font-size: var(--text-sm, 0.875rem); }
.map-legend__subtitle { color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity)); }
.map-legend__bar { height: 10px; border-radius: 5px; margin-top: var(--space-2); }
.map-legend__ticks {
  display: flex;
  justify-content: space-between;
  margin-top: 2px;
  font-variant-numeric: tabular-nums;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
.map-legend__note { margin-top: var(--space-1); color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity)); }
@media (max-width: 600px) { .map-legend { width: 220px; } }
/* телефон: внизу слева — кнопка слоёв (MapSidebar), легенда над ней */
@media (max-width: 959.98px) {
  .map-legend { bottom: calc(var(--shell-inset) + 32px + var(--corner-btn) + var(--shell-gap) + var(--safe-bottom, 0px)); }
}
</style>
