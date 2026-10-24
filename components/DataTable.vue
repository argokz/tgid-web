<template>
  <component
    :is="virtual ? VDataTableVirtual : VDataTable"
    class="data-table num"
    :class="{ 'data-table--selectable': selectable, 'data-table--dense': density === 'compact' }"
    :headers="tableHeaders"
    :items="items"
    :item-value="itemKey"
    :loading="loading"
    :density="density"
    :height="virtual ? height : undefined"
    :fixed-header="true"
    :hover="selectable"
    :items-per-page="virtual ? undefined : -1"
    :hide-default-footer="!virtual"
    :sort-by="sortBy"
    :multi-sort="false"
    :must-sort="false"
    :no-data-text="noDataText"
    :loading-text="loadingText"
    :row-props="rowProps"
    :item-selectable="selectable"
    @update:sort-by="$emit('update:sortBy', $event)"
    @click:row="onRowClick"
  >
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
import { computed } from 'vue';
import { VDataTable, VDataTableVirtual } from 'vuetify/components/VDataTable';

/**
 * DataTable — обёртка над v-data-table / v-data-table-virtual (docs/ui-primitives.md). Колонки описываются
 * как в десктопе: заголовок, ключ, тип (число — выравнивание вправо и tabular-nums), ширина, сортируемость.
 * Виртуализация включается от `virtualFrom` строк (200): высота строки предсказуема (одна строка текста,
 * длинное — обрезается с полным текстом в title), иначе ломается расчёт прокрутки Vuetify.
 * Выбор строки — событие `select(item)` и подсветка `selectedKey`; слоты `item.<key>` проходят насквозь.
 */
export interface DataTableColumn {
  key: string;
  title: string;
  /** число — вправо, моноширинные цифры */
  type?: 'text' | 'number' | 'date' | 'actions';
  width?: number | string;
  sortable?: boolean;
  align?: 'start' | 'center' | 'end';
}

const props = withDefaults(defineProps<{
  columns: readonly DataTableColumn[];
  items: readonly Record<string, unknown>[];
  itemKey?: string;
  loading?: boolean;
  density?: 'default' | 'comfortable' | 'compact';
  /** Принудительно: виртуальный список (null — от числа строк) */
  virtual?: boolean | null;
  virtualFrom?: number;
  /** Высота области прокрутки виртуальной таблицы */
  height?: number | string;
  selectable?: boolean;
  selectedKey?: string | number | null;
  sortBy?: readonly { key: string; order?: 'asc' | 'desc' | boolean }[];
  noDataText?: string;
  loadingText?: string;
}>(), {
  itemKey: 'id',
  loading: false,
  density: 'compact',
  virtual: null,
  virtualFrom: 200,
  height: 480,
  selectable: false,
  selectedKey: null,
  sortBy: () => [],
  noDataText: 'Записей нет',
  loadingText: 'Загрузка…',
});

const emit = defineEmits<{
  select: [item: Record<string, unknown>];
  'update:sortBy': [value: unknown];
}>();

const virtual = computed(() => props.virtual ?? props.items.length >= props.virtualFrom);

const tableHeaders = computed(() => props.columns.map((c) => ({
  key: c.key,
  title: c.title,
  width: c.width,
  sortable: c.sortable ?? c.type !== 'actions',
  align: c.align ?? (c.type === 'number' ? 'end' : 'start'),
  cellProps: c.type === 'number' ? { class: 'data-table__num' } : undefined,
})));

const rowProps = ({ item }: { item: Record<string, unknown> }) => {
  const selected = props.selectedKey != null && item[props.itemKey] === props.selectedKey;
  return { class: selected ? 'data-table__row--selected' : undefined, 'aria-selected': selected ? 'true' : undefined };
};

const onRowClick = (_event: Event, { item }: { item: Record<string, unknown> }) => {
  if (props.selectable) emit('select', item);
};

defineExpose({ virtual });
</script>

<style scoped>
.data-table :deep(th) {
  font-size: var(--text-xs);
  font-weight: 600;
  white-space: nowrap;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.data-table :deep(td) {
  font-size: var(--text-sm);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 360px;
}

.data-table :deep(.data-table__num) {
  text-align: end;
  font-variant-numeric: tabular-nums;
}

/* зебра по токенам: чуть темнее поверхность, без собственных цветов */
.data-table :deep(tbody tr:nth-child(even) td) {
  background: rgba(var(--v-theme-on-surface), 0.02);
}

.data-table--selectable :deep(tbody tr) {
  cursor: pointer;
}

.data-table :deep(tr.data-table__row--selected td) {
  background: var(--accent-soft);
  box-shadow: inset 3px 0 0 var(--accent);
}
</style>
