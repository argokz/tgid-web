<template>
  <v-autocomplete
    v-if="setter.kind === 'ref'"
    :model-value="modelValue"
    :items="items"
    item-title="label"
    item-value="id"
    :label="label || setter.field_label"
    :loading="loading"
    :no-data-text="loading ? 'Загрузка…' : 'Нет значений'"
    variant="outlined"
    density="compact"
    hide-details="auto"
    no-filter
    clearable
    @update:search="onSearch"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #item="{ props: itemProps, item }">
      <v-list-item
        v-bind="itemProps"
        :subtitle="item.raw.fileid ? `фрагмент ${item.raw.fileid}` : undefined"
      />
    </template>
    <template
      v-if="total > items.length"
      #append-item
    >
      <div class="text-caption text-medium-emphasis px-4 py-1">
        Показано {{ items.length }} из {{ total }} — уточните поиск
      </div>
    </template>
  </v-autocomplete>
  <v-select
    v-else-if="setter.kind === 'choice'"
    :model-value="modelValue"
    :items="setter.choices"
    item-title="label"
    item-value="value"
    :label="label || setter.field_label"
    variant="outlined"
    density="compact"
    hide-details="auto"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <v-text-field
    v-else-if="setter.kind === 'date'"
    :model-value="modelValue"
    type="date"
    :label="label || setter.field_label"
    variant="outlined"
    density="compact"
    hide-details="auto"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <v-text-field
    v-else-if="setter.kind !== 'computed'"
    :model-value="modelValue"
    :label="label || setter.field_label"
    :hint="rangeHint"
    persistent-hint
    inputmode="decimal"
    variant="outlined"
    density="compact"
    hide-details="auto"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { groupSettersService, type GroupSetterInfo, type SetterOption } from '~/services/groupSettersService';

const props = defineProps<{
  setter: GroupSetterInfo
  modelValue: unknown
  fragmentIds?: number[]
  label?: string
}>();
const emit = defineEmits<{ (e: 'update:modelValue', value: unknown): void }>();

const items = ref<SetterOption[]>([]);
const total = ref(0);
const loading = ref(false);
let searchTimer: ReturnType<typeof setTimeout> | null = null;
let requestSeq = 0;

const rangeHint = computed(() => {
  const s = props.setter;
  const parts: string[] = [];
  if (s.min !== null) parts.push(`от ${s.min}`);
  if (s.max !== null) parts.push(`до ${s.max}`);
  return parts.length ? parts.join(' ') : undefined;
});

const load = async (q?: string) => {
  if (props.setter.kind !== 'ref') return;
  const seq = ++requestSeq;
  loading.value = true;
  try {
    const res = await groupSettersService.options(props.setter.key, {
      q,
      fragmentIds: props.setter.ref?.fragment_scoped ? props.fragmentIds : undefined,
      limit: 200,
    });
    if (seq !== requestSeq) return;
    // выбранное значение не должно пропадать из списка при новом поиске
    const selected = items.value.find((i) => i.id === props.modelValue);
    items.value = selected && !res.items.some((i) => i.id === selected.id) ? [selected, ...res.items] : res.items;
    total.value = res.total;
  } catch {
    if (seq === requestSeq) items.value = [];
  } finally {
    if (seq === requestSeq) loading.value = false;
  }
};

const onSearch = (text: string) => {
  if (searchTimer) clearTimeout(searchTimer);
  const selected = items.value.find((i) => i.id === props.modelValue);
  if (selected && text === selected.label) return;
  searchTimer = setTimeout(() => load(text || undefined), 300);
};

watch(
  () => [props.setter.key, (props.fragmentIds || []).join(',')],
  () => {
    items.value = [];
    load();
  },
  { immediate: true },
);
</script>
