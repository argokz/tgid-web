<template>
  <!-- Список: встроенный (gid.lookup2) или справочник (gid.lookup) — варианты как в десктопе -->
  <v-autocomplete
    v-if="edit.list"
    :model-value="modelValue"
    :items="items"
    item-title="title"
    item-value="value"
    density="compact"
    variant="outlined"
    hide-details="auto"
    clearable
    :loading="loading"
    :disabled="readonly"
    :error-messages="error ? [error] : []"
    :placeholder="mixed ? 'разные' : undefined"
    :no-data-text="loading ? 'Загрузка…' : 'Нет вариантов'"
    class="cfe"
    @focus="loadOptions()"
    @update:search="onSearch"
    @update:model-value="emit('update:modelValue', $event ?? null)"
  />
  <v-text-field
    v-else-if="edit.kind === 'date'"
    :model-value="dateText"
    type="date"
    density="compact"
    variant="outlined"
    hide-details="auto"
    :disabled="readonly"
    :error-messages="error ? [error] : []"
    class="cfe"
    @update:model-value="emit('update:modelValue', $event || null)"
  />
  <v-checkbox
    v-else-if="edit.kind === 'bool'"
    :model-value="Boolean(modelValue)"
    density="compact"
    hide-details
    :disabled="readonly"
    class="cfe"
    @update:model-value="emit('update:modelValue', Boolean($event))"
  />
  <v-text-field
    v-else
    :model-value="modelValue ?? ''"
    density="compact"
    variant="outlined"
    hide-details="auto"
    :inputmode="isNumber ? 'decimal' : undefined"
    :counter="edit.kind === 'str' && edit.max_length && edit.max_length <= 255 ? edit.max_length : undefined"
    :disabled="readonly"
    :error-messages="error ? [error] : []"
    :placeholder="mixed ? 'разные' : undefined"
    class="cfe"
    @update:model-value="emit('update:modelValue', parseInput(edit.kind, $event))"
  >
    <template
      v-if="edit.helper || edit.fun_name === 'schemeNum'"
      #append-inner
    >
      <v-btn
        :icon="helperIcon"
        size="x-small"
        variant="text"
        density="comfortable"
        color="primary"
        :disabled="readonly"
        :aria-label="helperTitle"
        @click.stop="emit('helper')"
      />
      <v-tooltip
        activator="parent"
        location="top"
        max-width="320"
      >{{ helperTitle }}</v-tooltip>
    </template>
    <template
      v-else-if="funHint"
      #append-inner
    >
      <v-icon
        size="16"
        color="grey"
      >mdi-function-variant</v-icon>
      <v-tooltip
        activator="parent"
        location="top"
        max-width="320"
      >{{ funHint }}</v-tooltip>
    </template>
  </v-text-field>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { fastApiService } from '~/services/fastApiService';
import { parseInput, type CardFieldEdit, type CardOption } from '~/utils/objectCard';
import { cardOptionsCache } from '~/utils/objectCardOptions';

const props = defineProps<{
  modelValue: unknown
  edit: CardFieldEdit
  table: string
  field: string
  /** текст текущего значения (у списка — подпись), пока варианты не загружены */
  displayText?: unknown
  fileid?: number | null
  rowId?: number | null
  readonly?: boolean
  error?: string | null
  /** у выбранных объектов значения различаются */
  mixed?: boolean
}>();
const emit = defineEmits<{ 'update:modelValue': [value: unknown]; helper: [] }>();

const loading = ref(false);
const loaded = ref<CardOption[] | null>(null);
const isNumber = computed(() => props.edit.kind === 'int' || props.edit.kind === 'float');
const dateText = computed(() => (props.modelValue ? String(props.modelValue).slice(0, 10) : ''));

// Помощники полей, как функции десктопа (tab/<table>.fun → окно выбора)
const HELPER_TITLES: Record<string, string> = {
  diameter_std: 'Выбрать по сортаменту труб (Ду, диаметры, толщина стенки)',
  Table: 'Выбрать из справочной таблицы',
  'Местные сопротивления': 'Местные сопротивления: количество по видам и сумма',
  schemeNum: 'Выбрать схему присоединения (нагрузки перейдут в поля новой схемы)',
  uf: 'Рассчитать коэффициент смешения по температурам',
  'uf150-70': 'Рассчитать коэффициент смешения по температурам',
};
const HELPER_ICONS: Record<string, string> = {
  'Местные сопротивления': 'mdi-calculator', uf: 'mdi-calculator', 'uf150-70': 'mdi-calculator', schemeNum: 'mdi-tune-vertical',
};
const helperTitle = computed(() => HELPER_TITLES[props.edit.fun_name ?? ''] ?? 'Выбрать');
const helperIcon = computed(() => HELPER_ICONS[props.edit.fun_name ?? ''] ?? 'mdi-table-search');

// Функции без помощника в вебе — подсказка, что делает десктоп (ReadOnly/NotNull обработаны сервером)
const FUN_HINTS: Record<string, string> = {
  heatTestsCoeff: 'В десктопе — калькулятор коэффициента по результатам тепловых испытаний',
  nagruz_ot: 'В десктопе — окно расчёта нагрузки по характеристикам здания',
  nagruz_vt: 'В десктопе — окно расчёта нагрузки по характеристикам здания',
  alsecoNagr: 'В десктопе — нагрузки здания из базы Alseco (слой зданий)',
  viewNsDb: 'В десктопе — подбор насоса с расчётом коэффициентов характеристик (реестр насосов)',
  nodes: 'Узел с регулируемым напором: выберите из списка узлов фрагмента (поиск по имени)',
};
// standardDampLink — в десктопе без действия
const SILENT_FUNS = new Set(['ReadOnly', 'NotNull', 'hydroRes', 'ms_rs', 'Date', 'Hidden', 'NagrSum', 'standardDampLink']);
const funHint = computed(() => {
  const name = props.edit.fun_name;
  if (!name || SILENT_FUNS.has(name)) return '';
  return FUN_HINTS[name] ?? `Функция десктопа: ${props.edit.fun}`;
});

const items = computed<CardOption[]>(() => {
  if (loaded.value) return loaded.value;
  // до загрузки — только текущее значение с подписью из карточки
  if (props.modelValue === null || props.modelValue === undefined) return [];
  return [{ value: props.modelValue, title: String(props.displayText ?? props.modelValue) }];
});

const cacheKey = computed(() => `${props.table}|${props.field}|${props.fileid ?? ''}`.toLowerCase());

const loadOptions = async (q = '') => {
  if (!props.edit.list || props.readonly) return;
  const key = cacheKey.value;
  if (!q && cardOptionsCache.has(key)) {
    loaded.value = cardOptionsCache.get(key)!;
    return;
  }
  loading.value = true;
  try {
    const res = await fastApiService.getCardOptions({ table: props.table, field: props.field, fileid: props.fileid, row_id: props.rowId, q });
    const list = res.items ?? [];
    if (!q) cardOptionsCache.set(key, list);
    // выбранное значение остаётся в списке, даже если его нет среди вариантов (как в десктопе)
    const cur = props.modelValue;
    loaded.value = cur !== null && cur !== undefined && !list.some((i) => String(i.value) === String(cur))
      ? [{ value: cur, title: String(props.displayText ?? cur) }, ...list]
      : list;
  } catch {
    loaded.value = loaded.value ?? null;
  } finally {
    loading.value = false;
  }
};

// Большие справочники (SQL десктопа ограничен) — поиск на сервере после паузы ввода
let searchTimer: ReturnType<typeof setTimeout> | null = null;
const onSearch = (text: string | null) => {
  if (props.edit.list !== 'table' || !loaded.value || loaded.value.length < 500) return;
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { void loadOptions((text || '').trim()); }, 350);
};

watch(cacheKey, () => { loaded.value = null; });
</script>

<style scoped>
.cfe {
  min-width: 0;
}
.cfe :deep(.v-field__input) {
  min-height: 32px;
  padding-top: 4px;
  padding-bottom: 4px;
  font-size: 13px;
}
</style>
