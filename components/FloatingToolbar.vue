<template>
  <div
    class="floating-toolbar"
    role="toolbar"
    :aria-label="ariaLabel"
    @keydown="onKeydown"
  >
    <HintTip
      v-for="item in items"
      :key="String(item.value)"
      :text="item.title"
      :hotkey="item.hotkey"
      :hint="item.hint"
      :location="tipLocation"
    >
      <template #default="{ props: tip }">
        <button
          v-bind="tip"
          type="button"
          class="floating-toolbar__item"
          :class="{ 'floating-toolbar__item--active': item.value === modelValue, 'floating-toolbar__item--disabled': disabled || item.disabled }"
          :aria-label="item.title"
          :aria-pressed="item.value === modelValue"
          :aria-disabled="disabled || item.disabled ? 'true' : undefined"
          :tabindex="item.value === focusValue ? 0 : -1"
          :data-value="String(item.value)"
          @click="select(item.value, disabled || item.disabled)"
        >
          <v-icon
            size="18"
            class="floating-toolbar__icon"
          >{{ item.icon }}</v-icon>
          <span
            v-if="showActiveLabel && item.value === modelValue"
            class="floating-toolbar__label"
          >{{ item.title }}</span>
        </button>
      </template>
    </HintTip>
  </div>
</template>

<script setup lang="ts" generic="T extends string | number">
import { computed, ref } from 'vue';
import HintTip from '~/components/HintTip.vue';

/**
 * FloatingToolbar — кнопки инструментов одного вида (docs/ui-primitives.md). Активный инструмент подсвечен
 * акцентом (`--accent`), у каждой кнопки `HintTip` с названием, хоткеем и одной строкой пояснения,
 * семантика `toolbar` + `aria-pressed`, один tab-stop и стрелки между кнопками (roving tabindex).
 * Недоступные кнопки — `aria-disabled`, а не `disabled`: подсказка объясняет, почему инструмент недоступен.
 * Обязательный выбор: клик по активному ничего не делает (`mandatory`), иначе снимает выбор (`null`).
 */
export interface FloatingToolbarItem<T = string> {
  value: T;
  title: string;
  icon: string;
  hotkey?: string;
  hint?: string;
  disabled?: boolean;
}

const props = withDefaults(defineProps<{
  modelValue: T | null;
  items: readonly FloatingToolbarItem<T>[];
  mandatory?: boolean;
  disabled?: boolean;
  /** Подпись рядом с иконкой у активного инструмента */
  showActiveLabel?: boolean;
  tipLocation?: 'top' | 'bottom' | 'start' | 'end' | 'left' | 'right';
  ariaLabel?: string;
}>(), {
  mandatory: true,
  disabled: false,
  showActiveLabel: true,
  tipLocation: 'bottom',
  ariaLabel: 'Инструменты',
});

const emit = defineEmits<{ 'update:modelValue': [value: T | null] }>();

const select = (value: T, isDisabled = false) => {
  if (isDisabled) return;
  if (value === props.modelValue) {
    if (!props.mandatory) emit('update:modelValue', null);
    return;
  }
  emit('update:modelValue', value);
};

/** Какая кнопка в табе: активный инструмент, иначе первая; стрелки двигают фокус по кольцу */
const focused = ref<T | undefined>(undefined);
const focusValue = computed<T | null | undefined>(() => {
  if (focused.value !== undefined && props.items.some((i) => i.value === focused.value)) return focused.value;
  if (props.items.some((i) => i.value === props.modelValue)) return props.modelValue;
  return props.items[0]?.value;
});
const onKeydown = (e: KeyboardEvent) => {
  const keys: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1, Home: 0, End: 0 };
  if (!(e.key in keys)) return;
  const n = props.items.length;
  if (!n) return;
  const current = Math.max(0, props.items.findIndex((i) => i.value === focusValue.value));
  const next = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (current + keys[e.key] + n) % n;
  e.preventDefault();
  focused.value = props.items[next].value;
  const el = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(`[data-value="${String(props.items[next].value)}"]`);
  el?.focus();
};
</script>

<style scoped>
.floating-toolbar {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: 999px;
  background: rgba(var(--v-theme-on-surface), 0.04);
}

.floating-toolbar__item {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-width: 36px;
  height: 32px;
  padding: 0 var(--space-2);
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
  font: inherit;
  font-size: var(--text-sm);
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out);
}

.floating-toolbar__item:hover:not(:disabled) {
  background: rgba(var(--v-theme-on-surface), 0.08);
}

.floating-toolbar__item:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 1px;
}

.floating-toolbar__item--disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* активный инструмент — единственное место акцента на тулбаре */
.floating-toolbar__item--active {
  background: var(--accent-soft);
  color: var(--accent-text);
  box-shadow: inset 0 0 0 1px rgba(var(--accent-rgb), 0.5);
}

.floating-toolbar__label {
  white-space: nowrap;
}
</style>
