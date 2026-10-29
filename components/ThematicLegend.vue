<template>
  <section
    class="thematic-legend"
    :class="{ 'thematic-legend--stacked': stacked }"
    :style="legendStyle"
    role="region"
    :aria-label="`Легенда: ${title}`"
  >
    <div class="thematic-legend__head">
      <div class="thematic-legend__title text-truncate">
        {{ title }}
      </div>
      <HintTip text="Настроить тему">
        <template #default="{ props: tip }">
          <v-btn
            v-bind="tip"
            icon="mdi-tune-variant"
            size="x-small"
            variant="text"
            aria-label="Настроить тему"
            @click="ui.requestToolDialog('thematicMap')"
          />
        </template>
      </HintTip>
      <HintTip text="Убрать тему с карты">
        <template #default="{ props: tip }">
          <v-btn
            v-bind="tip"
            icon="mdi-close"
            size="x-small"
            variant="text"
            aria-label="Убрать тему с карты"
            @click="thematic.clear()"
          />
        </template>
      </HintTip>
    </div>
    <div
      v-if="subtitle"
      class="thematic-legend__subtitle text-truncate"
    >
      {{ subtitle }}
    </div>
    <ul class="thematic-legend__rows">
      <li
        v-for="row in thematic.legend.value"
        :key="row.label"
        class="thematic-legend__row"
      >
        <span
          class="thematic-legend__swatch"
          :style="{ background: row.color }"
          aria-hidden="true"
        />
        <span class="thematic-legend__label text-truncate">{{ row.label }}</span>
        <span class="thematic-legend__count">{{ row.count.toLocaleString('ru-RU') }}</span>
      </li>
    </ul>
    <div
      v-if="thematic.result.value?.truncated"
      class="thematic-legend__note"
    >
      Показана часть участков — сузьте выбор фрагментов
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import HintTip from '~/components/HintTip.vue';
import { useThematicMap } from '~/composables/useThematicMap';
import { useUiStore } from '~/stores/uiStore';

/**
 * Легенда тематической карты (Smart Mapping): классы с цветом, диапазоном и числом участков —
 * подписи несут смысл и без цвета. Над легендой расчёта, если она тоже на карте (stacked).
 */
defineProps<{ stacked?: boolean }>();

const ui = useUiStore();
const thematic = useThematicMap();
const legendStyle = computed(() => ({ '--legend-left': `${ui.leftInset}px` }));

const title = computed(() => {
  const theme = thematic.result.value?.theme;
  if (!theme) return '';
  return theme.units ? `${theme.label}, ${theme.units}` : theme.label;
});
const subtitle = computed(() => [thematic.styleName.value, thematic.result.value?.source_run?.label]
  .filter(Boolean).join(' · '));
</script>

<style scoped>
.thematic-legend {
  position: absolute;
  left: calc(var(--legend-left, 0px) + var(--shell-inset));
  bottom: calc(40px + var(--safe-bottom, 0px));
  z-index: var(--z-hud);
  width: 248px;
  max-height: 46vh;
  overflow-y: auto;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-2, 8px);
  background: rgba(var(--v-theme-surface), 0.94);
  box-shadow: var(--shadow-2, 0 2px 8px rgba(0, 0, 0, 0.16));
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  font-size: var(--text-xs, 0.75rem);
}
/* легенда расчёта (MapLegend) стоит на том же месте: тема — над ней */
.thematic-legend--stacked { bottom: calc(40px + 96px + var(--safe-bottom, 0px)); }
.thematic-legend__head { display: flex; align-items: center; gap: var(--space-1); }
.thematic-legend__title { flex: 1; font-weight: 600; font-size: var(--text-sm, 0.875rem); }
.thematic-legend__subtitle { color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity)); }
.thematic-legend__rows { list-style: none; margin: var(--space-1) 0 0; padding: 0; }
.thematic-legend__row { display: flex; align-items: center; gap: var(--space-2); line-height: 1.6; }
.thematic-legend__swatch { flex: none; width: 18px; height: 6px; border-radius: 3px; }
.thematic-legend__label { flex: 1; }
.thematic-legend__count {
  font-variant-numeric: tabular-nums;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
.thematic-legend__note { margin-top: var(--space-1); color: rgb(var(--v-theme-warning)); }
@media (max-width: 600px) { .thematic-legend { width: 220px; } }
@media (max-width: 959.98px) {
  .thematic-legend { bottom: calc(var(--shell-inset) + 32px + var(--corner-btn) + var(--shell-gap) + var(--safe-bottom, 0px)); }
  .thematic-legend--stacked {
    bottom: calc(var(--shell-inset) + 32px + 96px + var(--corner-btn) + var(--shell-gap) + var(--safe-bottom, 0px));
  }
}
</style>
