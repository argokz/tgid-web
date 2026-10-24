<template>
  <div
    class="field-cell"
    :class="[
      `field-cell--label-${position}`,
      { 'field-cell--error': Boolean(error), 'field-cell--readonly': readonly, 'field-cell--dirty': dirty, 'field-cell--span': span },
    ]"
  >
    <label
      v-if="label"
      class="field-cell__label"
      :for="controlId"
    >
      <span>{{ label }}</span>
      <span
        v-if="required"
        class="field-cell__required"
        aria-hidden="true"
      >*</span>
      <HintTip
        v-if="hint"
        :text="hint"
        location="top"
      >
        <template #default="{ props: tip }">
          <v-icon
            v-bind="tip"
            size="14"
            class="field-cell__hint-icon"
            tabindex="0"
            role="img"
            :aria-label="hint"
          >mdi-help-circle-outline</v-icon>
        </template>
      </HintTip>
      <span
        v-if="dirty"
        class="field-cell__dirty"
        title="Изменено, не сохранено"
        aria-label="изменено, не сохранено"
      />
    </label>
    <div class="field-cell__control">
      <slot :id="controlId" />
      <span
        v-if="units"
        class="field-cell__units"
      >{{ units }}</span>
    </div>
    <div
      v-if="error"
      :id="`${controlId}-error`"
      class="field-cell__error"
      role="alert"
    >{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, useId } from 'vue';
import HintTip from '~/components/HintTip.vue';
import { FIELD_GRID_KEY } from '~/utils/fieldGrid';

/**
 * FieldCell — ячейка формы (docs/ui-primitives.md): видимая подпись (над полем или слева — по FieldGrid),
 * обязательность, подсказка у неочевидных полей (HintTip), единицы справа от поля, ошибка под полем
 * (`role="alert"`), признаки `readonly` и `dirty` («изменено, не сохранено»). Само поле — в слоте;
 * слот получает `id`, чтобы связать label и control.
 */
const props = withDefaults(defineProps<{
  label?: string;
  required?: boolean;
  hint?: string;
  units?: string;
  error?: string | null;
  readonly?: boolean;
  dirty?: boolean;
  /** Положение подписи; по умолчанию — как у FieldGrid */
  labelPosition?: 'top' | 'inline' | null;
  /** Растянуть на всю ширину сетки (примечание, адрес) */
  span?: boolean;
}>(), {
  label: '',
  required: false,
  hint: '',
  units: '',
  error: null,
  readonly: false,
  dirty: false,
  labelPosition: null,
  span: false,
});

const grid = inject(FIELD_GRID_KEY, null);
const position = computed(() => props.labelPosition ?? grid?.labelPosition() ?? 'top');
const controlId = `field-${useId()}`;

defineExpose({ position, controlId });
</script>

<style scoped>
.field-cell {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.field-cell--span {
  grid-column: 1 / -1;
}

.field-cell--label-inline {
  display: grid;
  grid-template-columns: minmax(96px, 38%) minmax(0, 1fr);
  column-gap: var(--space-2);
  align-items: center;
}

.field-cell--label-inline .field-cell__error {
  grid-column: 2;
}

.field-cell__label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  line-height: 1.3;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.field-cell--label-inline .field-cell__label {
  font-size: var(--text-sm);
  justify-content: flex-end;
  text-align: right;
}

.field-cell__required {
  color: rgb(var(--v-theme-error));
}

.field-cell__hint-icon {
  cursor: help;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.field-cell__hint-icon:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  border-radius: 50%;
}

/* точка «изменено»: акцент, но не единственный носитель — есть title и aria-label */
.field-cell__dirty {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
}

.field-cell__control {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.field-cell__control > :first-child {
  flex: 1 1 auto;
  min-width: 0;
}

.field-cell__units {
  flex: 0 0 auto;
  font-size: var(--text-xs);
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  white-space: nowrap;
}

.field-cell__error {
  font-size: var(--text-xs);
  color: rgb(var(--v-theme-error));
}

.field-cell--readonly .field-cell__label {
  color: rgba(var(--v-theme-on-surface), var(--v-disabled-opacity));
}
</style>
