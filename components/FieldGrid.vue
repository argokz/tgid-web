<template>
  <div
    class="field-grid"
    :class="[`field-grid--${columns}`, `field-grid--label-${labelPosition}`]"
    :style="minWidth ? { '--field-min': typeof minWidth === 'number' ? `${minWidth}px` : minWidth } : undefined"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import { provide } from 'vue';
import { FIELD_GRID_KEY } from '~/utils/fieldGrid';

/**
 * FieldGrid — сетка полей формы (docs/ui-primitives.md): одинаковые отступы, адаптивные колонки
 * (`auto` — столько, сколько влезает по `minWidth`; 1–3 — фиксированно) и положение подписи у всех
 * ячеек (`top` — над полем, `inline` — слева, как в десктопных карточках). Ячейка — `FieldCell`.
 */
const props = withDefaults(defineProps<{
  columns?: 'auto' | 1 | 2 | 3;
  /** Минимальная ширина ячейки при columns=auto */
  minWidth?: number | string;
  labelPosition?: 'top' | 'inline';
}>(), {
  columns: 'auto',
  minWidth: 220,
  labelPosition: 'top',
});

provide(FIELD_GRID_KEY, { labelPosition: () => props.labelPosition });
</script>

<style scoped>
.field-grid {
  --field-min: 220px;
  display: grid;
  gap: var(--space-3) var(--space-4);
  align-items: start;
}

.field-grid--auto { grid-template-columns: repeat(auto-fit, minmax(min(var(--field-min), 100%), 1fr)); }
.field-grid--1 { grid-template-columns: 1fr; }
.field-grid--2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.field-grid--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }

@media (max-width: 600px) {
  .field-grid--2,
  .field-grid--3 {
    grid-template-columns: 1fr;
  }
}
</style>
