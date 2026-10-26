<template>
  <!-- v-memo: см. комментарий у memoDeps -->
  <component
    :is="virtual ? VDataTableVirtual : VDataTable"
    v-memo="memoDeps()"
    v-bind="{ ...$attrs, ...tableProps }"
    class="data-table num"
    :class="{ 'data-table--selectable': selectable, 'data-table--dense': density === 'compact' }"
    :headers="tableHeaders"
    :items="items"
    :item-value="itemKey"
    :loading="loading"
    :density="density"
    :hover="selectable"
    :sort-by="internalSort"
    :multi-sort="false"
    :must-sort="false"
    :no-data-text="noDataText"
    :loading-text="loadingText"
    :row-props="rowProps"
    @update:sort-by="onSort"
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
import { computed, ref, useAttrs, useSlots, watch } from 'vue';
import { VDataTable, VDataTableVirtual } from 'vuetify/components/VDataTable';

/**
 * DataTable — обёртка над v-data-table / v-data-table-virtual (docs/ui-primitives.md). Колонки описываются
 * как в десктопе: заголовок, ключ, тип (число — выравнивание вправо и tabular-nums), ширина, сортируемость.
 * Виртуализация включается от `virtualFrom` строк (200): высота строки предсказуема (одна строка текста,
 * длинное — обрезается с полным текстом в title), иначе ломается расчёт прокрутки Vuetify.
 * Выбор строки — событие `select(item)` мышью и с клавиатуры (Enter / пробел), подсветка `selectedKey`;
 * только что сохранённая строка — `flashKey` (подсветка гаснет, _motion.scss);
 * слоты `item.<key>` проходят насквозь. Сортировка работает сама; родитель может задать `sortBy` и слушать
 * `update:sortBy` (например, для серверной сортировки).
 */
/** Элемент сортировки v-data-table */
export interface SortItem {
  key: string;
  order?: boolean | 'asc' | 'desc';
}

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
  /** Строка, которую только что сохранили: подсвечивается и гаснет (снимает родитель, обычно через 2,5 с) */
  flashKey?: string | number | null;
  sortBy?: readonly SortItem[];
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
  flashKey: null,
  sortBy: () => [],
  noDataText: 'Записей нет',
  loadingText: 'Загрузка…',
});

defineOptions({ inheritAttrs: false });

const emit = defineEmits<{
  select: [item: Record<string, unknown>];
  'update:sortBy': [value: SortItem[]];
}>();

const virtual = computed(() => props.virtual ?? props.items.length >= props.virtualFrom);

/** Пропсы, которые есть только у одной из таблиц: у виртуальной — высота и липкая шапка, у обычной — без футера */
const tableProps = computed(() => (virtual.value
  ? { height: props.height, fixedHeader: true }
  : { itemsPerPage: -1, hideDefaultFooter: true }));

/** Сортировка — своё состояние (иначе controlled-модель Vuetify не меняется без родителя), проп — начальное/внешнее */
const internalSort = ref<SortItem[]>([...props.sortBy]);
watch(() => props.sortBy, (v) => { internalSort.value = [...v]; }, { deep: true });
const onSort = (value: SortItem[]) => {
  internalSort.value = value;
  emit('update:sortBy', value);
};

const LONG_TEXT = 24;
const tableHeaders = computed(() => props.columns.map((c) => ({
  key: c.key,
  title: c.title,
  width: c.width,
  sortable: c.sortable ?? c.type !== 'actions',
  align: c.align ?? (c.type === 'number' ? 'end' : 'start'),
  // длинный текст обрезается — полный остаётся в title
  cellProps: ({ value }: { value: unknown }) => ({
    class: c.type === 'number' ? 'data-table__num' : undefined,
    title: typeof value === 'string' && value.length > LONG_TEXT ? value : undefined,
  }),
})));

const rowProps = ({ item }: { item: Record<string, unknown> }) => {
  const selected = props.selectedKey != null && item[props.itemKey] === props.selectedKey;
  const flash = props.flashKey != null && item[props.itemKey] === props.flashKey;
  const rowClass = [selected && 'data-table__row--selected', flash && 'motion-row-flash'].filter(Boolean);
  const cls = rowClass.length ? rowClass : undefined;
  if (!props.selectable) {
    return { class: cls };
  }
  return {
    class: cls,
    'aria-selected': selected ? 'true' : 'false',
    tabindex: 0,
    onClick: () => emit('select', item),
    onKeydown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        emit('select', item);
      }
    },
  };
};

/**
 * Таблица перерисовывается только при смене своих входных данных (S3b). Журналы лежат в слотах v-dialog / v-card —
 * компонентов на render-функциях, там Vue не видит стабильности слотов и при любой перерисовке родителя (пришёл
 * справочник, сменился флаг загрузки) заставляет DataTable перерисоваться, а через слоты — все строки: ~1 с на
 * 50 строк при CPU ×4. Ячейки от этого не устаревают: реактивное состояние, которое читает слот, отслеживает
 * сама строка, где слот выполняется. Атрибуты родителя передаются явно (inheritAttrs: false) — иначе Vue клонирует
 * корневой узел и мемо не срабатывает. Функция, а не computed: атрибуты и набор слотов не реактивны, их читаем
 * при каждой перерисовке DataTable.
 */
const attrs = useAttrs();
const slots = useSlots();
const memoDeps = () => [
  virtual.value, tableProps.value, tableHeaders.value, props.items, props.itemKey, props.loading, props.density,
  props.selectable, props.selectedKey, props.flashKey, internalSort.value, props.noDataText, props.loadingText,
  Object.keys(slots).join('|'), ...Object.entries(attrs).flat(),
];

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
