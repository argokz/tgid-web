<template>
  <!-- Переключение режимов одним видом: сегменты с иконкой и подписью, обязательный выбор -->
  <v-btn-toggle
    :model-value="modelValue"
    :mandatory="mandatory"
    :disabled="disabled"
    density="compact"
    color="primary"
    variant="outlined"
    divided
    rounded="lg"
    class="segmented-toggle"
    :class="{ 'segmented-toggle--wrap': wrap }"
    role="radiogroup"
    :aria-label="ariaLabel"
    @update:model-value="onUpdate"
  >
    <v-btn
      v-for="item in items"
      :key="String(item.value)"
      :value="item.value"
      :disabled="item.disabled"
      :prepend-icon="item.icon"
      :aria-label="item.label"
      role="radio"
      :aria-checked="item.value === modelValue"
      :title="item.hint || undefined"
      size="small"
      class="segmented-toggle__item"
    >
      <span
        v-if="!iconOnly"
        class="segmented-toggle__label"
      >{{ item.label }}</span>
    </v-btn>
  </v-btn-toggle>
</template>

<script setup lang="ts">
/**
 * SegmentedToggle — обёртка над v-btn-toggle (docs/ui-primitives.md): один вид для всех переключений режимов
 * (вместо 14 `v-btn-toggle` и части `v-switch` с разным оформлением). Обязательный выбор по умолчанию: режим
 * не может быть «никаким». Недоступные пункты показываются, но не активны, с пояснением в `hint`.
 */
export interface SegmentedToggleItem<T = string> {
  value: T;
  label: string;
  icon?: string;
  disabled?: boolean;
  /** Почему недоступен или что сделает — в title */
  hint?: string;
}

const props = withDefaults(defineProps<{
  modelValue: unknown;
  items: readonly SegmentedToggleItem<any>[];
  mandatory?: boolean;
  disabled?: boolean;
  /** Переносить сегменты на следующую строку на узком экране */
  wrap?: boolean;
  /** Только иконки (подпись остаётся в aria-label и title) */
  iconOnly?: boolean;
  ariaLabel?: string;
}>(), {
  mandatory: true,
  disabled: false,
  wrap: true,
  iconOnly: false,
  ariaLabel: 'Режим',
});

const emit = defineEmits<{ 'update:modelValue': [value: unknown] }>();

const onUpdate = (value: unknown) => {
  // при mandatory Vuetify не даёт снять выбор; без mandatory undefined — «ничего не выбрано»
  if (value === undefined && props.mandatory) return;
  emit('update:modelValue', value);
};
</script>

<style scoped>
.segmented-toggle {
  height: auto;
  min-height: 32px;
}

.segmented-toggle--wrap {
  flex-wrap: wrap;
}

.segmented-toggle__item {
  text-transform: none;
  letter-spacing: 0;
  font-size: var(--text-sm);
  transition: background-color var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out);
}

.segmented-toggle__label {
  white-space: nowrap;
}
</style>
