<template>
  <!-- Оборудование узла, как вход во внутреннюю схему десктопа: задвижки, регуляторы, насосы… -->
  <div class="nel">
    <div class="nel-head">
      <HintTip
        text="Вернуться к карточке узла"
      >
        <template #default="{ props: tip }">
          <v-btn
            v-bind="tip"
            icon="mdi-arrow-left"
            variant="text"
            size="small"
            aria-label="К карточке узла"
            @click="emit('close')"
          />
        </template>
      </HintTip>
      <span class="nel-title">Оборудование узла</span>
      <span
        v-if="data"
        class="text-medium-emphasis"
      >{{ data.items.length }}</span>
      <v-spacer />
      <HintTip
        text="Обновить"
      >
        <template #default="{ props: tip }">
          <v-btn
            v-bind="tip"
            icon="mdi-refresh"
            variant="text"
            size="small"
            aria-label="Обновить"
            :loading="loading"
            @click="load"
          />
        </template>
      </HintTip>
    </div>
    <div class="nel-search">
      <v-text-field
        v-model="search"
        placeholder="Поиск по имени и узлам"
        prepend-inner-icon="mdi-magnify"
        density="compact"
        variant="outlined"
        hide-details
        clearable
      />
    </div>
    <div
      v-if="loading && !data"
      class="nel-state"
    >
      <v-progress-circular
        indeterminate
        color="primary"
        size="24"
      />
    </div>
    <div
      v-else-if="loadError"
      class="nel-state"
    >
      <div class="text-body-2">{{ loadError }}</div>
      <v-btn
        class="mt-2"
        size="small"
        variant="tonal"
        @click="load"
      >Повторить</v-btn>
    </div>
    <div
      v-else-if="data && !data.items.length"
      class="nel-state text-body-2 text-medium-emphasis"
    >
      У узла и в его внутренней схеме нет оборудования с карточкой (задвижки, регуляторы, насосы, байпасы,
      обратные клапаны, элеваторы, теплообменники).
    </div>
    <div
      v-else-if="data"
      class="nel-list"
    >
      <div
        v-if="!groups.length"
        class="nel-state text-body-2 text-medium-emphasis"
      >Ничего не найдено</div>
      <div
        v-for="g in groups"
        :key="g.kind"
        class="nel-group"
      >
        <div class="nel-group-head">
          <v-checkbox-btn
            v-if="canEdit"
            :model-value="groupState(g) === 'all'"
            :indeterminate="groupState(g) === 'some'"
            density="compact"
            :aria-label="`Выбрать: ${g.label}`"
            @update:model-value="toggleGroup(g, $event)"
          />
          <span>{{ g.label }}</span>
          <span class="text-medium-emphasis">{{ g.items.length }}</span>
        </div>
        <div
          v-for="i in g.items"
          :key="i.id"
          class="nel-item"
          :class="{ 'nel-item--click': canEdit }"
          @click="canEdit && emit('open', i)"
        >
          <v-checkbox-btn
            v-if="canEdit"
            :model-value="selected.has(i.id)"
            density="compact"
            :aria-label="`Выбрать ${equipmentTitle(i)}`"
            @click.stop
            @update:model-value="toggle(i, $event)"
          />
          <div class="nel-item-text">
            <div class="nel-item-name">{{ equipmentTitle(i) }}</div>
            <div class="text-caption text-medium-emphasis">
              {{ i.nodes || '—' }} · {{ i.inner ? 'внутренняя схема' : 'примыкает к узлу' }}
            </div>
          </div>
          <v-icon
            v-if="canEdit"
            size="16"
            color="grey"
          >mdi-pencil</v-icon>
        </div>
      </div>
      <div
        v-if="data.truncated"
        class="text-caption text-medium-emphasis pa-2"
      >Показаны первые {{ data.items.length }} объектов</div>
    </div>
    <div
      v-if="canEdit && selectedItems.length"
      class="nel-actions"
    >
      <span class="text-body-2">Выбрано: {{ selectedItems.length }}</span>
      <v-spacer />
      <v-btn
        size="small"
        variant="text"
        @click="selected = new Set()"
      >Снять</v-btn>
      <v-btn
        size="small"
        color="primary"
        variant="flat"
        prepend-icon="mdi-select-multiple"
        @click="emitBatch"
      >Править выбранные</v-btn>
    </div>
    <div
      v-else-if="canEdit && data?.items.length"
      class="nel-hint text-caption text-medium-emphasis"
    >
      Нажмите на объект, чтобы править его карточку; отметьте несколько объектов одного вида — чтобы править их вместе.
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { fastApiService } from '~/services/fastApiService';
import { formatApiError } from '~/utils/apiError';
import {
  equipmentTitle, groupEquipment, type EquipmentKind, type NodeEquipment, type NodeEquipmentItem,
} from '~/utils/objectCard';
import HintTip from '~/components/HintTip.vue';

const props = defineProps<{
  nodeId: number
  canEdit: boolean
}>();
const emit = defineEmits<{
  close: []
  open: [item: NodeEquipmentItem]
  batch: [value: { kind: EquipmentKind; table: string; ids: number[] }]
}>();

const data = ref<NodeEquipment | null>(null);
const loading = ref(false);
const loadError = ref('');
const search = ref('');
// выбор — объекты одного вида (одна карточка на выбор)
const selected = ref<Set<number>>(new Set());

const load = async () => {
  loading.value = true;
  loadError.value = '';
  try {
    data.value = await fastApiService.getNodeEquipment(props.nodeId);
    const ids = new Set(data.value.items.map((i) => i.id));
    selected.value = new Set([...selected.value].filter((id) => ids.has(id)));
  } catch (e) {
    loadError.value = formatApiError(e, 'Не удалось загрузить оборудование узла');
  } finally {
    loading.value = false;
  }
};
watch(() => props.nodeId, () => { selected.value = new Set(); data.value = null; void load(); }, { immediate: true });

const groups = computed(() => groupEquipment(data.value?.items ?? [], search.value ?? ''));
const selectedItems = computed(() => (data.value?.items ?? []).filter((i) => selected.value.has(i.id)));

const toggle = (item: NodeEquipmentItem, on: boolean) => {
  const next = new Set(selectedItems.value.some((i) => i.kind !== item.kind) ? [] : selected.value);
  if (on) next.add(item.id);
  else next.delete(item.id);
  selected.value = next;
};
type Group = ReturnType<typeof groupEquipment>[number];
const groupState = (g: Group): 'all' | 'some' | 'none' => {
  const n = g.items.filter((i) => selected.value.has(i.id)).length;
  return n === 0 ? 'none' : n === g.items.length ? 'all' : 'some';
};
const toggleGroup = (g: Group, on: boolean) => {
  selected.value = on ? new Set(g.items.map((i) => i.id)) : new Set();
};

const emitBatch = () => {
  const items = selectedItems.value;
  if (!items.length) return;
  emit('batch', { kind: items[0].kind, table: items[0].table, ids: items.map((i) => i.id) });
};

defineExpose({ reload: load });
</script>

<style scoped>
.nel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1 1 auto;
}
.nel-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
}
.nel-title {
  font-weight: 500;
}
.nel-search {
  padding: 4px 12px 8px;
}
.nel-state {
  padding: 24px 16px;
  text-align: center;
}
.nel-list {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 0 4px 8px;
}
.nel-group-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px 2px;
  font-size: 13px;
  font-weight: 500;
}
.nel-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 6px;
}
.nel-item--click {
  cursor: pointer;
}
.nel-group-head :deep(.v-selection-control),
.nel-item :deep(.v-selection-control) {
  flex: 0 0 auto;
}
.nel-item--click:hover {
  background: rgba(var(--v-theme-on-surface), 0.05);
}
.nel-item-text {
  flex: 1 1 auto;
  min-width: 0;
}
.nel-item-name {
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nel-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.nel-hint {
  padding: 6px 12px 10px;
}
</style>
