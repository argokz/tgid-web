<template>
  <!-- Выпадающий список одного вида для всех форм: плотный, с очисткой; при длинном списке — с поиском внутри -->
  <component
    :is="searchable ? VAutocomplete : VSelect"
    :model-value="modelValue"
    :items="items"
    :item-title="itemTitle"
    :item-value="itemValue"
    :label="label"
    :placeholder="placeholder"
    :hint="hint"
    :persistent-hint="Boolean(hint)"
    :suffix="units"
    :loading="loading"
    :disabled="disabled"
    :readonly="readonly"
    :clearable="clearable && !readonly"
    :multiple="multiple"
    :chips="multiple"
    :closable-chips="multiple && !readonly"
    :error-messages="errorMessages"
    :no-data-text="noDataText"
    :menu-props="menuProps"
    :auto-select-first="searchable ? 'exact' : undefined"
    density="compact"
    variant="outlined"
    hide-details="auto"
    class="app-select"
    :class="{ 'app-select--readonly': readonly }"
    @update:model-value="$emit('update:modelValue', $event)"
    @update:search="onSearch"
    @keydown.enter="onEnter"
  >
    <template
      v-if="allowCreate && searchable"
      #no-data
    >
      <v-list-item
        v-if="search.trim()"
        :title="`Нет варианта «${search.trim()}» — создать?`"
        prepend-icon="mdi-plus"
        @click="create"
      />
      <v-list-item
        v-else
        :title="noDataText"
      />
    </template>
    <template
      v-for="(_, name) in $slots"
      #[name]="slotProps"
    >
      <slot
        :name="name"
        v-bind="slotProps ?? {}"
      />
    </template>
  </component>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { VAutocomplete, VSelect } from 'vuetify/components';

/**
 * AppSelect — обёртка над v-select / v-autocomplete (docs/ui-primitives.md): единая плотность и вид,
 * поиск внутри при `items.length > searchThreshold` (50), виртуальный список Vuetify при длинных списках,
 * очистка, клавиатура, единицы справа (`units`), подсказка (`hint`), «не найдено — создать?» (`allowCreate`,
 * событие `create`). `readonly` показывает значение без возможности смены и не прячет его.
 */
const props = withDefaults(defineProps<{
  modelValue: unknown;
  items: readonly unknown[];
  itemTitle?: string | ((item: any) => string);
  itemValue?: string | ((item: any) => unknown);
  label?: string;
  placeholder?: string;
  hint?: string;
  /** Единицы измерения справа от значения */
  units?: string;
  loading?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  clearable?: boolean;
  multiple?: boolean;
  errorMessages?: string | string[];
  /** С какого числа пунктов включать поиск внутри списка */
  searchThreshold?: number;
  /** Принудительно: поиск есть / нет, независимо от числа пунктов */
  searchable?: boolean | null;
  /** Разрешить «не найдено — создать?» (событие create с текстом) */
  allowCreate?: boolean;
  noDataText?: string;
}>(), {
  itemTitle: 'title',
  itemValue: 'value',
  label: '',
  placeholder: '',
  hint: '',
  units: '',
  loading: false,
  disabled: false,
  readonly: false,
  clearable: true,
  multiple: false,
  errorMessages: () => [],
  searchThreshold: 50,
  searchable: null,
  allowCreate: false,
  noDataText: 'Ничего не найдено',
});

const emit = defineEmits<{
  'update:modelValue': [value: unknown];
  create: [text: string];
  search: [text: string];
}>();

const SEARCH_THRESHOLD_DEFAULT = 50;

const searchable = computed(() =>
  props.searchable ?? props.items.length > (props.searchThreshold ?? SEARCH_THRESHOLD_DEFAULT),
);

const search = ref('');
const onSearch = (value: string) => {
  search.value = value ?? '';
  emit('search', search.value);
};

const create = () => {
  const text = search.value.trim();
  if (text) emit('create', text);
};

const onEnter = () => {
  // Enter в пустом результате поиска — то же, что «создать?»
  if (props.allowCreate && searchable.value && search.value.trim() && !hasMatch.value) create();
};

const titleOf = (item: unknown): string => {
  if (item == null) return '';
  if (typeof item !== 'object') return String(item);
  const t = props.itemTitle;
  return String(typeof t === 'function' ? t(item) : (item as Record<string, unknown>)[t] ?? '');
};
const hasMatch = computed(() => {
  const q = search.value.trim().toLowerCase();
  return !q || props.items.some((item) => titleOf(item).toLowerCase() === q);
});

/** Длинные списки: ограничить высоту меню, чтобы виртуальный список работал, и не выходить за экран */
const menuProps = computed(() => ({ maxHeight: 320, contentClass: 'app-select__menu' }));

defineExpose({ searchable });
</script>

<style scoped>
.app-select :deep(.v-field__input) {
  font-size: var(--text-sm);
}

.app-select--readonly :deep(.v-field) {
  background: rgba(var(--v-theme-on-surface), 0.04);
}

.app-select :deep(.v-text-field__suffix) {
  font-size: var(--text-xs);
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
</style>
