<template>
  <!-- Плитка числа (stat tile по dataviz): подпись · значение · дельта · тренд; состояние — иконка + подпись, не только цвет -->
  <component
    :is="selectable ? 'button' : 'div'"
    :type="selectable ? 'button' : undefined"
    class="kpi-tile"
    :class="[
      `kpi-tile--${status}`,
      { 'kpi-tile--selectable': selectable, 'kpi-tile--active': active },
    ]"
    :aria-pressed="selectable ? String(active) : undefined"
    :aria-label="selectable ? ariaLabel : undefined"
    @click="selectable && $emit('select')"
  >
    <div class="kpi-tile__label">
      <v-icon
        v-if="statusIcon"
        size="14"
        class="kpi-tile__status-icon"
      >{{ statusIcon }}</v-icon>
      <span>{{ label }}</span>
    </div>
    <div class="kpi-tile__row">
      <span
        class="kpi-tile__value"
        :title="valueTitle"
      >{{ displayValue }}<span
        v-if="units"
        class="kpi-tile__units"
      > {{ units }}</span></span>
      <Sparkline
        v-if="trend && trend.length"
        :values="trend"
        :label="trendLabel"
        class="kpi-tile__trend"
      />
    </div>
    <div
      v-if="delta != null"
      class="kpi-tile__delta num"
      :class="`kpi-tile__delta--${deltaTone}`"
    >
      <v-icon size="12">{{ delta > 0 ? 'mdi-arrow-up-thin' : delta < 0 ? 'mdi-arrow-down-thin' : 'mdi-minus' }}</v-icon>
      <span>{{ deltaText }}</span>
      <span
        v-if="deltaLabel"
        class="kpi-tile__delta-label"
      >{{ deltaLabel }}</span>
    </div>
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Sparkline from '~/components/Sparkline.vue';

/**
 * KpiTile — плитка показателя в шапке журнала или итогах расчёта (docs/ui-primitives.md, по `dataviz`):
 * `label` (без двоеточия), `value` (авто-сокращение 12,9 тыс.; пропорциональные цифры), `units`,
 * `delta` (со знаком, относительно `deltaLabel`; цвет = направление × `upIsGood`), `trend` (Sparkline),
 * `status` (good / warning / serious / critical — иконка + цвет, подпись остаётся). `selectable` делает плитку
 * кнопкой-фильтром (aria-pressed, событие select) — как чипы качества в журналах.
 */
export type KpiStatus = 'none' | 'good' | 'warning' | 'serious' | 'critical';

const props = withDefaults(defineProps<{
  label: string;
  value: number | string | null | undefined;
  units?: string;
  /** Сокращать большие числа (12 900 → 12,9 тыс.) */
  compact?: boolean;
  /** Знаков после запятой для чисел */
  digits?: number;
  delta?: number | null;
  deltaLabel?: string;
  upIsGood?: boolean;
  trend?: readonly (number | null)[] | null;
  trendLabel?: string;
  status?: KpiStatus;
  selectable?: boolean;
  active?: boolean;
}>(), {
  units: '',
  compact: true,
  digits: 0,
  delta: null,
  deltaLabel: '',
  upIsGood: true,
  trend: null,
  trendLabel: '',
  status: 'none',
  selectable: false,
  active: false,
});

defineEmits<{ select: [] }>();

const COMPACT_FROM = 10_000;

const formatNumber = (n: number, digits: number) => n.toLocaleString('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const displayValue = computed(() => {
  const v = props.value;
  if (v == null || v === '') return '—';
  if (typeof v !== 'number') return v;
  if (!Number.isFinite(v)) return '—';
  if (props.compact && Math.abs(v) >= 1_000_000) return `${formatNumber(v / 1_000_000, 1)} млн`;
  if (props.compact && Math.abs(v) >= COMPACT_FROM) return `${formatNumber(v / 1_000, 1)} тыс.`;
  return formatNumber(v, props.digits);
});

/** Полное число в title, когда показано сокращённое */
const valueTitle = computed(() => (typeof props.value === 'number' && Math.abs(props.value) >= COMPACT_FROM ? formatNumber(props.value, props.digits) : undefined));

const deltaText = computed(() => {
  if (props.delta == null) return '';
  const sign = props.delta > 0 ? '+' : props.delta < 0 ? '−' : '';
  return `${sign}${formatNumber(Math.abs(props.delta), props.digits)}`;
});

const deltaTone = computed(() => {
  if (props.delta == null || props.delta === 0) return 'flat';
  const good = props.delta > 0 ? props.upIsGood : !props.upIsGood;
  return good ? 'good' : 'bad';
});

const STATUS_ICONS: Record<KpiStatus, string> = {
  none: '',
  good: 'mdi-check-circle-outline',
  warning: 'mdi-alert-outline',
  serious: 'mdi-alert-circle-outline',
  critical: 'mdi-close-octagon-outline',
};
const statusIcon = computed(() => STATUS_ICONS[props.status]);

const ariaLabel = computed(() => `${props.label}: ${displayValue.value}${props.units ? ` ${props.units}` : ''}${props.active ? ', фильтр включён' : ''}`);

defineExpose({ displayValue, deltaTone });
</script>

<style scoped>
.kpi-tile {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 112px;
  padding: var(--space-2) var(--space-3);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  border-radius: var(--radius-md);
  background: rgb(var(--v-theme-surface));
  text-align: left;
  color: rgb(var(--v-theme-on-surface));
  font: inherit;
  line-height: 1.3;
}

.kpi-tile--selectable {
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out);
}

.kpi-tile--selectable:hover {
  background: rgba(var(--v-theme-on-surface), 0.04);
}

.kpi-tile--selectable:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.kpi-tile--active {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.kpi-tile__label {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.kpi-tile__row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-2);
}

/* крупное число — пропорциональные цифры (tabular только в колонках) */
.kpi-tile__value {
  font-size: var(--text-lg);
  font-weight: 600;
  font-variant-numeric: proportional-nums;
  white-space: nowrap;
}

.kpi-tile__units {
  font-size: var(--text-xs);
  font-weight: 400;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.kpi-tile__trend {
  flex-shrink: 0;
}

.kpi-tile__delta {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: var(--text-xs);
}

.kpi-tile__delta--good { color: #006300; }
.kpi-tile__delta--bad { color: rgb(var(--v-theme-error)); }
.kpi-tile__delta--flat { color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity)); }

.kpi-tile__delta-label {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.kpi-tile--good .kpi-tile__status-icon { color: #0ca30c; }
.kpi-tile--warning .kpi-tile__status-icon { color: #b36b00; }
.kpi-tile--serious .kpi-tile__status-icon { color: #c2410c; }
.kpi-tile--critical .kpi-tile__status-icon { color: rgb(var(--v-theme-error)); }
</style>
