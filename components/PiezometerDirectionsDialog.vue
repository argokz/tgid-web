<template>
  <v-dialog
    :model-value="modelValue"
    max-width="640"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card>
      <v-toolbar
        color="primary"
        density="compact"
      >
        <v-toolbar-title>Направления пьезометра</v-toolbar-title>
        <v-spacer />
        <v-btn
          icon
          size="small"
          aria-label="Закрыть"
          @click="$emit('update:modelValue', false)"
        >
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-toolbar>
      <v-card-text>
        <p class="text-caption text-medium-emphasis mb-2">
          Как «Список направлений» / «Сохранить направление» в десктопе: хранятся опорные узлы маршрута
          (таблицы directions и deployeddirections), путь между ними строится заново.
        </p>

        <div
          v-if="canEditData"
          class="d-flex align-center ga-2 mb-3"
        >
          <v-text-field
            v-model="newName"
            label="Название для текущего маршрута"
            density="compact"
            hide-details
            :disabled="waypoints.length < 2"
            @keyup.enter="save(false)"
          />
          <v-btn
            color="primary"
            variant="flat"
            :disabled="waypoints.length < 2 || !newName.trim()"
            :loading="saving"
            @click="save(false)"
          >
            Сохранить
          </v-btn>
        </div>
        <v-alert
          v-if="conflictName"
          type="warning"
          variant="tonal"
          density="compact"
          class="mb-3"
        >
          Направление «{{ conflictName }}» уже есть в этом фрагменте.
          <template #append>
            <v-btn
              size="small"
              variant="text"
              color="warning"
              :loading="saving"
              @click="save(true)"
            >Заменить</v-btn>
          </template>
        </v-alert>

        <v-text-field
          v-model="filter"
          prepend-inner-icon="mdi-magnify"
          label="Поиск"
          density="compact"
          hide-details
          clearable
          class="mb-2"
        />
        <div
          v-if="loading"
          class="d-flex justify-center py-6"
        ><v-progress-circular
          indeterminate
          color="primary"
        /></div>
        <v-alert
          v-else-if="error"
          type="error"
          variant="tonal"
          density="compact"
        >{{ error }}</v-alert>
        <div
          v-else-if="!filtered.length"
          class="text-caption text-disabled py-4 text-center"
        >Нет сохранённых направлений</div>
        <v-list
          v-else
          density="compact"
          max-height="380"
          class="overflow-y-auto"
        >
          <v-list-item
            v-for="d in filtered"
            :key="d.id"
            :title="d.name || `Направление ${d.id}`"
            :subtitle="`${d.fragment_name || `фрагмент ${d.fileid}`} · узлов: ${d.node_count}${d.missing_nodes ? ` · удалено: ${d.missing_nodes}` : ''}`"
            @click="load(d.id)"
          >
            <template #append>
              <v-btn
                v-if="canEditData"
                icon="mdi-delete"
                size="small"
                variant="text"
                color="error"
                :aria-label="`Удалить ${d.name}`"
                @click.stop="remove(d)"
              />
            </template>
          </v-list-item>
        </v-list>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { fastApiService, type PiezometerDirection } from '~/services/fastApiService';
import { useAuthStore } from '~/stores/authStore';
import { useNotificationStore } from '~/stores/notificationStore';

const props = defineProps<{
  modelValue: boolean;
  /** Текущие опорные узлы маршрута — для сохранения */
  waypoints: number[];
}>();

const emit = defineEmits<{
  'update:modelValue': [boolean];
  /** Опорные узлы выбранного направления — родитель строит по ним пьезометр */
  load: [number[]];
}>();

const authStore = useAuthStore();
const notify = useNotificationStore();
const canEditData = computed(() => authStore.canEditData);

const items = ref<PiezometerDirection[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const filter = ref<string | null>('');
const newName = ref('');
const saving = ref(false);
const conflictName = ref<string | null>(null);

const filtered = computed(() => {
  const q = (filter.value || '').trim().toLowerCase();
  if (!q) return items.value;
  return items.value.filter((d) => `${d.name} ${d.fragment_name || ''}`.toLowerCase().includes(q));
});

const refresh = async () => {
  loading.value = true;
  error.value = null;
  try {
    items.value = (await fastApiService.listPiezometerDirections()).items;
  } catch (err: any) {
    error.value = err?.message || 'Ошибка загрузки направлений';
  } finally {
    loading.value = false;
  }
};

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      conflictName.value = null;
      refresh();
    }
  },
  { immediate: true }
);

const load = async (id: number) => {
  try {
    const d = await fastApiService.getPiezometerDirection(id);
    // Подряд одинаковые узлы (встречаются в старых записях десктопа) не нужны маршруту
    const nodes = d.nodes.filter((n, i) => i === 0 || n !== d.nodes[i - 1]);
    if (d.missing_nodes.length) {
      notify.showWarning(`В направлении удалены узлы: ${d.missing_nodes.slice(0, 5).join(', ')}`);
      return;
    }
    if (nodes.length < 2) {
      notify.showWarning('В направлении меньше двух узлов');
      return;
    }
    emit('load', nodes);
    emit('update:modelValue', false);
  } catch (err: any) {
    notify.showError(`Направление: ${err?.message || 'ошибка сервера'}`);
  }
};

const save = async (replace: boolean) => {
  const name = newName.value.trim();
  if (!name || props.waypoints.length < 2) return;
  saving.value = true;
  try {
    await fastApiService.savePiezometerDirection({ name, nodes: [...props.waypoints], replace });
    conflictName.value = null;
    newName.value = '';
    notify.showSuccess(`Направление «${name}» сохранено`);
    await refresh();
  } catch (err: any) {
    if (err?.status === 409 || err?.statusCode === 409) {
      conflictName.value = name;
    } else {
      notify.showError(`Сохранение: ${err?.message || 'ошибка сервера'}`);
    }
  } finally {
    saving.value = false;
  }
};

const remove = async (d: PiezometerDirection) => {
  if (!window.confirm(`Удалить направление «${d.name}»?`)) return;
  try {
    await fastApiService.deletePiezometerDirection(d.id);
    await refresh();
  } catch (err: any) {
    notify.showError(`Удаление: ${err?.message || 'ошибка сервера'}`);
  }
};
</script>
