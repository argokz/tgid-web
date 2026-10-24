<template>
  <div
    class="floating-toolbar"
    role="toolbar"
    :aria-label="ariaLabel"
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
          :class="{ 'floating-toolbar__item--active': item.value === modelValue }"
          :aria-label="item.title"
          :aria-pressed="item.value === modelValue"
          :disabled="disabled || item.disabled"
          @click="select(item.value)"
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

<script setup lang="ts">
import HintTip from '~/components/HintTip.vue';

/**
 * FloatingToolbar — кнопки инструментов одного вида (docs/ui-primitives.md). Активный инструмент подсвечен
 * акцентом (`--accent`), у каждой кнопки `HintTip` с названием, хоткеем и одной строкой пояснения,
 * семантика `toolbar` + `aria-pressed`. Обязательный выбор: клик по активному ничего не делает
 * (`mandatory`), иначе снимает выбор (`null`).
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
  modelValue: unknown;
  items: readonly FloatingToolbarItem<any>[];
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

const emit = defineEmits<{ 'update:modelValue': [value: unknown] }>();

const select = (value: unknown) => {
  if (value === props.modelValue) {
    if (!props.mandatory) emit('update:modelValue', null);
    return;
  }
  emit('update:modelValue', value);
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

.floating-toolbar__item:disabled {
  opacity: 0.4;
  cursor: default;
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
