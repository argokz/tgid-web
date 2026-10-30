<template>
  <v-dialog
    v-model="visible"
    fullscreen
    scrollable
  >
    <v-card v-if="form">
      <v-card-title class="d-flex align-center py-2 px-3">
        <div class="flex-grow-1 min-w-0">
          <div class="text-subtitle-1 text-truncate">
            {{ form.name }}
          </div>
          <div class="text-caption text-medium-emphasis text-truncate">
            {{ subtitle }}
          </div>
        </div>
        <v-btn
          icon="mdi-close"
          variant="text"
          aria-label="Закрыть без сохранения"
          @click="visible = false"
        />
      </v-card-title>
      <v-divider />
      <v-card-text class="pa-3">
        <FormRenderer
          v-model="answers"
          :schema="form.schema"
          :errors="tried ? errors : undefined"
          :photo-urls="photoUrls"
          @add-photo="pickPhoto"
        />
        <input
          ref="photoInput"
          type="file"
          accept="image/*"
          capture="environment"
          class="d-none"
          @change="onPhoto"
        >
      </v-card-text>
      <v-divider />
      <v-card-actions class="px-3">
        <span
          v-if="tried && errorCount"
          class="text-caption text-error"
        >Исправьте поля: {{ errorCount }}</span>
        <v-spacer />
        <v-btn
          color="primary"
          variant="flat"
          size="large"
          prepend-icon="mdi-content-save"
          :loading="photoBusy"
          @click="save"
        >
          Сохранить
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import FormRenderer from '~/components/forms/FormRenderer.vue';
import { downscalePhoto } from '~/utils/fieldPhoto';
import { newActionId } from '~/utils/fieldQueue';
import { validateAnswers, type FormAnswers, type FormRow, type FormSchema } from '~/utils/forms';

export interface FieldFormPhoto {
  /** ключ фото = client_id фото наряда; он же в ответе поля */
  id: string;
  blob: Blob;
  caption: string;
  takenAt: string;
}

export interface FieldFormResult {
  answers: FormAnswers;
  photos: FieldFormPhoto[];
}

/**
 * Заполнение формы обхода в полевом приложении (pages/field.vue): поля, условия, фото с камеры (уменьшаются на
 * телефоне). Фото держатся здесь до «Сохранить»: закрыл без сохранения — ничего не уходит. Сохранение отдаёт
 * ответы и фото — в очередь их ставит страница.
 */
const props = defineProps<{ form: FormRow | null; subtitle: string }>();
const visible = defineModel<boolean>({ default: false });
const emit = defineEmits<{ save: [result: FieldFormResult] }>();

const answers = ref<FormAnswers>({});
const tried = ref(false);
const photoBusy = ref(false);
const photoInput = ref<HTMLInputElement | null>(null);
const photos = ref<FieldFormPhoto[]>([]);
const photoUrls = ref<Record<string, string>>({});
let photoField = '';

const schema = computed<FormSchema>(() => props.form?.schema ?? { fields: [] });
const errors = computed(() => validateAnswers(schema.value, answers.value).errors);
const errorCount = computed(() => Object.keys(errors.value).length);

const releaseUrls = () => {
  Object.values(photoUrls.value).forEach((u) => URL.revokeObjectURL(u));
  photoUrls.value = {};
};

watch(visible, (open) => {
  if (!open) return;
  answers.value = {};
  tried.value = false;
  photos.value = [];
  releaseUrls();
});
onBeforeUnmount(releaseUrls);

const pickPhoto = (field: string) => {
  photoField = field;
  photoInput.value?.click();
};

const onPhoto = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !photoField) return;
  photoBusy.value = true;
  try {
    const blob = await downscalePhoto(file);
    const id = newActionId();
    const label = schema.value.fields.find((f) => f.name === photoField)?.label ?? 'Фото';
    photos.value.push({ id, blob, caption: `${props.form?.name ?? 'Форма'}: ${label}`,
      takenAt: new Date(file.lastModified || Date.now()).toISOString() });
    photoUrls.value = { ...photoUrls.value, [id]: URL.createObjectURL(blob) };
    const prev = answers.value[photoField];
    answers.value = { ...answers.value, [photoField]: [...(Array.isArray(prev) ? prev : []), id] };
  } finally {
    photoBusy.value = false;
  }
};

const save = () => {
  tried.value = true;
  if (errorCount.value) return;
  const { clean } = validateAnswers(schema.value, answers.value);
  // фото, убранные из ответа или из скрытого условием поля, не отправляются
  const used = new Set(Object.values(clean).flatMap((v) => (Array.isArray(v) ? v : [])));
  emit('save', { answers: clean, photos: photos.value.filter((p) => used.has(p.id)) });
  visible.value = false;
};
</script>
