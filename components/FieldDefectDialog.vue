<template>
  <v-dialog
    v-model="open"
    :fullscreen="xs"
    max-width="560"
    scrollable
  >
    <v-card>
      <v-card-title class="d-flex align-center ga-2">
        <v-icon color="error">
          mdi-alert-outline
        </v-icon>
        Дефект на обходе
        <v-spacer />
        <v-btn
          icon="mdi-close"
          variant="text"
          aria-label="Закрыть"
          @click="open = false"
        />
      </v-card-title>
      <v-card-text>
        <div class="fdd-place mb-3">
          <v-icon
            :color="pos ? 'success' : 'warning'"
            aria-hidden="true"
          >
            mdi-crosshairs-gps
          </v-icon>
          <div class="flex-grow-1 text-body-2">
            <template v-if="locating && !pos">
              Определяю место…
            </template>
            <template v-else-if="pos">
              Место — здесь<span v-if="pos.accuracy != null">, точность ±{{ pos.accuracy }} м</span>.
              Участок под точкой подберётся сам.
            </template>
            <template v-else>
              Нет координат: разрешите геолокацию и выйдите на открытое место.
            </template>
          </div>
          <v-btn
            size="small"
            variant="text"
            :loading="locating"
            @click="locate"
          >
            Уточнить
          </v-btn>
        </div>

        <div class="d-flex flex-wrap ga-2 mb-2">
          <v-chip
            v-for="p in DEFECT_PRESETS"
            :key="p"
            size="small"
            variant="outlined"
            @click="addPreset(p)"
          >
            {{ p }}
          </v-chip>
        </div>
        <v-textarea
          v-model="description"
          label="Что нашли"
          rows="2"
          auto-grow
          variant="outlined"
          maxlength="2000"
          hide-details="auto"
          class="mb-3"
        />

        <div class="text-caption text-medium-emphasis mb-1">
          Срочность
        </div>
        <v-btn-toggle
          v-model="priority"
          mandatory
          divided
          variant="outlined"
          density="comfortable"
          class="mb-3"
        >
          <v-btn
            v-for="p in PRIORITIES"
            :key="p.value"
            :value="p.value"
          >
            {{ p.label }}
          </v-btn>
        </v-btn-toggle>

        <v-select
          v-if="categories.length"
          v-model="categoryId"
          :items="categories"
          item-title="name"
          item-value="id"
          label="Категория"
          clearable
          density="comfortable"
          variant="outlined"
          hide-details
          class="mb-3"
        />
        <v-select
          v-if="sources.length"
          v-model="sourceId"
          :items="sources"
          item-title="name"
          item-value="id"
          label="Источник"
          clearable
          density="comfortable"
          variant="outlined"
          hide-details
          class="mb-3"
        />

        <div class="d-flex align-center ga-2">
          <div
            v-if="photoUrl"
            class="fdd-thumb"
          >
            <img
              :src="photoUrl"
              alt="Фото дефекта"
            >
          </div>
          <v-btn
            prepend-icon="mdi-camera"
            variant="tonal"
            :loading="photoBusy"
            @click="photoInput?.click()"
          >
            {{ photo ? 'Переснять' : 'Фото' }}
          </v-btn>
          <v-btn
            v-if="photo"
            icon="mdi-delete-outline"
            variant="text"
            aria-label="Убрать фото"
            @click="clearPhoto"
          />
          <input
            ref="photoInput"
            type="file"
            accept="image/*"
            capture="environment"
            class="d-none"
            @change="onPhoto"
          >
        </div>
        <v-text-field
          v-if="photo"
          v-model="caption"
          label="Подпись к фото"
          density="compact"
          variant="outlined"
          hide-details
          maxlength="500"
          class="mt-2"
        />
        <div
          v-if="photoError"
          class="text-caption text-error mt-1"
        >
          {{ photoError }}
        </div>
      </v-card-text>
      <v-card-actions class="pa-4 pt-0">
        <v-btn
          block
          size="large"
          color="error"
          variant="flat"
          prepend-icon="mdi-alert-outline"
          :disabled="!canSubmit"
          @click="submit"
        >
          Записать дефект
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useDisplay } from 'vuetify';
import {
  DEFECT_PRESETS,
  appendPreset,
  defaultSourceId,
  type DefectRef,
  type FieldDefectDraft,
} from '~/utils/fieldDefect';
import { currentPosition, downscalePhoto, type LonLat } from '~/utils/fieldPhoto';

/**
 * «Дефект одной кнопкой» с обхода (pages/field.vue): место — точка телефона, что нашли — готовой фразой или
 * своими словами, по желанию фото. Запись уходит через очередь страницы: без связи — когда сеть вернётся.
 * Сервер пишет дефект в журнал десктопа (участок — ближайший к точке) и заявку по нему.
 */
const props = defineProps<{
  sources: DefectRef[];
  categories: DefectRef[];
}>();
const emit = defineEmits<{ submit: [draft: FieldDefectDraft] }>();
const open = defineModel<boolean>({ default: false });

const PRIORITIES = [
  { value: 1, label: 'Аварийный' },
  { value: 2, label: 'Срочный' },
  { value: 3, label: 'Плановый' },
];

const { xs } = useDisplay();
const pos = ref<LonLat | null>(null);
const locating = ref(false);
const description = ref('');
const sourceId = ref<number | null>(null);
const categoryId = ref<number | null>(null);
const priority = ref(2);
const photo = ref<Blob | null>(null);
const photoUrl = ref('');
const caption = ref('');
const takenAt = ref<string | null>(null);
const photoBusy = ref(false);
const photoError = ref('');
const photoInput = ref<HTMLInputElement | null>(null);

const canSubmit = computed(() => Boolean(pos.value && description.value.trim() && !photoBusy.value));

async function locate(): Promise<void> {
  locating.value = true;
  try {
    pos.value = (await currentPosition()) ?? pos.value;
  } finally {
    locating.value = false;
  }
}

function addPreset(text: string): void {
  description.value = appendPreset(description.value, text);
}

function clearPhoto(): void {
  if (photoUrl.value) URL.revokeObjectURL(photoUrl.value);
  photo.value = null;
  photoUrl.value = '';
}

async function onPhoto(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  photoBusy.value = true;
  photoError.value = '';
  try {
    const blob = await downscalePhoto(file);
    clearPhoto();
    photo.value = blob;
    photoUrl.value = URL.createObjectURL(blob);
    takenAt.value = new Date(file.lastModified || Date.now()).toISOString();
  } catch (error) {
    photoError.value = error instanceof Error ? error.message : 'Фото не подготовилось';
  } finally {
    photoBusy.value = false;
  }
}

function submit(): void {
  if (!canSubmit.value || !pos.value) return;
  emit('submit', {
    pos: pos.value,
    description: description.value.trim(),
    sourceId: sourceId.value,
    categoryId: categoryId.value,
    priority: priority.value,
    photo: photo.value,
    caption: caption.value.trim(),
    takenAt: takenAt.value,
  });
  open.value = false;
}

watch(open, (isOpen) => {
  if (!isOpen) return;
  description.value = '';
  categoryId.value = null;
  priority.value = 2;
  caption.value = '';
  photoError.value = '';
  takenAt.value = null;
  clearPhoto();
  sourceId.value = defaultSourceId(props.sources);
  pos.value = null;
  void locate();
}, { immediate: true });

onBeforeUnmount(clearPhoto);
</script>

<style scoped>
.fdd-place {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(var(--v-theme-on-surface), 0.05);
}
.fdd-thumb {
  width: 56px;
  height: 56px;
  overflow: hidden;
  border-radius: 8px;
  flex-shrink: 0;
}
.fdd-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
