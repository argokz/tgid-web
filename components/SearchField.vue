<template>
  <v-text-field
    ref="field"
    :model-value="modelValue"
    :label="label"
    :placeholder="placeholder"
    :prepend-inner-icon="icon"
    :loading="loading"
    :disabled="disabled"
    :autofocus="autofocus"
    :density="density"
    variant="outlined"
    clearable
    clear-icon="mdi-close-circle"
    hide-details
    type="search"
    :aria-label="ariaLabel || label || placeholder"
    class="search-field"
    @update:model-value="onInput"
    @click:clear="clear"
    @keydown.esc.prevent="onEscape"
    @keydown.enter="onEnter"
  >
    <template
      v-if="countLabel"
      #append-inner
    >
      <span
        class="search-field__count num"
        role="status"
        aria-live="polite"
      >{{ countLabel }}</span>
    </template>
  </v-text-field>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';

/**
 * SearchField — обёртка над v-text-field (docs/ui-primitives.md): `update:modelValue` сразу (для подсветки
 * и локальной фильтрации), `search` — после паузы ввода (`debounce`, по умолчанию 200 мс; результат поиска
 * должен появляться < 300 мс после паузы). Esc очищает поле, повторный Esc — событие `escape` (закрыть панель).
 */
const props = withDefaults(defineProps<{
  /** Текст; null/undefined от фильтров журналов — как пустая строка */
  modelValue?: string | null;
  label?: string;
  placeholder?: string;
  icon?: string;
  /** Пауза после ввода до события search, мс */
  debounce?: number;
  loading?: boolean;
  disabled?: boolean;
  autofocus?: boolean;
  density?: 'default' | 'comfortable' | 'compact';
  /** Число результатов; null — не показывать */
  resultCount?: number | null;
  ariaLabel?: string;
}>(), {
  modelValue: '',
  label: '',
  placeholder: 'Поиск…',
  icon: 'mdi-magnify',
  debounce: 200,
  loading: false,
  disabled: false,
  autofocus: false,
  density: 'compact',
  resultCount: null,
  ariaLabel: '',
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  /** Текст после паузы ввода (обрезанный); пустая строка — поиск сброшен */
  search: [query: string];
  clear: [];
  escape: [];
  enter: [query: string];
}>();

const field = ref<{ focus: () => void } | null>(null);
let timer: ReturnType<typeof setTimeout> | null = null;

const schedule = (value: string) => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    emit('search', value.trim());
  }, props.debounce);
};

const onInput = (value: string | null) => {
  const next = value ?? '';
  emit('update:modelValue', next);
  schedule(next);
};

const clear = () => {
  if (timer) clearTimeout(timer);
  timer = null;
  emit('update:modelValue', '');
  emit('search', '');
  emit('clear');
};

const onEscape = () => {
  if (props.modelValue) clear();
  else emit('escape');
};

const onEnter = () => {
  // Enter — искать сейчас, не дожидаясь паузы
  if (timer) clearTimeout(timer);
  timer = null;
  const query = (props.modelValue ?? '').trim();
  emit('search', query);
  emit('enter', query);
};

const countLabel = computed(() => {
  if (props.resultCount == null || !props.modelValue) return '';
  if (props.resultCount === 0) return 'ничего';
  return `${props.resultCount.toLocaleString('ru-RU')}`;
});

onBeforeUnmount(() => { if (timer) clearTimeout(timer); });

defineExpose({ focus: () => field.value?.focus(), countLabel });
</script>

<style scoped>
.search-field :deep(.v-field__input) {
  font-size: var(--text-sm);
}

.search-field__count {
  align-self: center;
  padding: 0 var(--space-1);
  font-size: var(--text-xs);
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  white-space: nowrap;
}
</style>
