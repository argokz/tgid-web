<template>
  <div class="fr">
    <template
      v-for="f in visible"
      :key="f.name"
    >
      <!-- пояснение -->
      <v-alert
        v-if="f.type === 'note'"
        type="info"
        variant="tonal"
        density="compact"
        class="mb-3"
      >
        {{ f.label }}<div
          v-if="f.hint"
          class="text-caption"
        >
          {{ f.hint }}
        </div>
      </v-alert>

      <!-- просмотр ответов -->
      <div
        v-else-if="readonly"
        class="fr-view"
      >
        <div class="text-caption text-medium-emphasis">
          {{ f.label }}
        </div>
        <div
          v-if="f.type === 'image'"
          class="fr-photos"
        >
          <template v-if="photoIds(f).length">
            <a
              v-for="id in photoIds(f)"
              :key="id"
              :href="photoUrls?.[id] || undefined"
              target="_blank"
              rel="noopener"
              class="fr-photo"
            >
              <img
                v-if="photoUrls?.[id]"
                :src="photoUrls[id]"
                :alt="f.label"
              >
              <span
                v-else
                class="text-caption text-medium-emphasis"
              >ещё не дошло</span>
            </a>
          </template>
          <span v-else>—</span>
        </div>
        <div
          v-else
          class="text-body-2 fr-value"
        >
          {{ displayAnswer(f, modelValue[f.name]) }}
        </div>
      </div>

      <!-- заполнение -->
      <div
        v-else
        class="fr-field"
      >
        <div
          v-if="labelAbove(f)"
          class="text-body-2 mb-1"
        >
          {{ f.label }}<span
            v-if="f.required"
            class="text-error"
          > *</span>
        </div>
        <v-textarea
          v-if="f.type === 'text'"
          :model-value="text(f)"
          :label="requiredLabel(f)"
          :hint="f.hint"
          :persistent-hint="!!f.hint"
          :error-messages="errors?.[f.name]"
          rows="1"
          auto-grow
          density="compact"
          variant="outlined"
          maxlength="2000"
          @update:model-value="set(f, $event)"
        />
        <v-text-field
          v-else-if="f.type === 'integer' || f.type === 'decimal'"
          :model-value="text(f)"
          :label="requiredLabel(f)"
          :hint="numberHint(f)"
          :persistent-hint="!!numberHint(f)"
          :error-messages="errors?.[f.name]"
          :inputmode="f.type === 'integer' ? 'numeric' : 'decimal'"
          density="compact"
          variant="outlined"
          @update:model-value="set(f, $event)"
        />
        <v-text-field
          v-else-if="f.type === 'date'"
          :model-value="text(f)"
          :label="requiredLabel(f)"
          :hint="f.hint"
          :error-messages="errors?.[f.name]"
          type="date"
          density="compact"
          variant="outlined"
          @update:model-value="set(f, $event || null)"
        />
        <v-checkbox
          v-else-if="f.type === 'acknowledge'"
          :model-value="modelValue[f.name] === true"
          :label="requiredLabel(f)"
          :hint="f.hint"
          :persistent-hint="!!f.hint"
          :error-messages="errors?.[f.name]"
          density="compact"
          @update:model-value="set(f, $event ? true : null)"
        />
        <template v-else-if="f.type === 'select_one' || f.type === 'select_multiple'">
          <v-chip-group
            v-if="(f.choices?.length ?? 0) <= CHIP_CHOICES"
            :model-value="modelValue[f.name] ?? (f.type === 'select_multiple' ? [] : null)"
            :multiple="f.type === 'select_multiple'"
            selected-class="text-primary"
            column
            @update:model-value="set(f, $event)"
          >
            <v-chip
              v-for="c in f.choices ?? []"
              :key="c.value"
              :value="c.value"
              filter
              variant="outlined"
            >
              {{ c.label }}
            </v-chip>
          </v-chip-group>
          <v-select
            v-else
            :model-value="modelValue[f.name] ?? (f.type === 'select_multiple' ? [] : null)"
            :items="f.choices ?? []"
            item-title="label"
            item-value="value"
            :multiple="f.type === 'select_multiple'"
            :chips="f.type === 'select_multiple'"
            density="compact"
            variant="outlined"
            clearable
            @update:model-value="set(f, $event)"
          />
          <div
            v-if="f.hint || errors?.[f.name]"
            class="text-caption"
            :class="errors?.[f.name] ? 'text-error' : 'text-medium-emphasis'"
          >
            {{ errors?.[f.name] || f.hint }}
          </div>
        </template>
        <template v-else-if="f.type === 'image'">
          <div class="fr-photos mb-1">
            <div
              v-for="id in photoIds(f)"
              :key="id"
              class="fr-photo"
            >
              <img
                v-if="photoUrls?.[id]"
                :src="photoUrls[id]"
                :alt="f.label"
              >
              <v-btn
                class="fr-photo__remove"
                icon="mdi-close"
                size="x-small"
                variant="flat"
                :aria-label="`Убрать фото: ${f.label}`"
                @click="removePhoto(f, id)"
              />
            </div>
            <v-btn
              v-if="photoIds(f).length < MAX_PHOTOS"
              variant="tonal"
              prepend-icon="mdi-camera"
              @click="emit('add-photo', f.name)"
            >
              Фото
            </v-btn>
          </div>
          <div
            v-if="f.hint || errors?.[f.name]"
            class="text-caption"
            :class="errors?.[f.name] ? 'text-error' : 'text-medium-emphasis'"
          >
            {{ errors?.[f.name] || f.hint }}
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { displayAnswer, isRelevant, MAX_PHOTOS, type FormAnswer, type FormAnswers, type FormField, type FormSchema } from '~/utils/forms';

/**
 * Форма обхода: заполнение (полевое приложение, предпросмотр в конструкторе) или просмотр ответов (карточка
 * наряда, readonly). Поля, скрытые условием, не показываются. Фото — снаружи: событие add-photo с именем поля,
 * в ответе — ключи фото, картинки — photoUrls[ключ].
 */
const props = defineProps<{
  schema: FormSchema
  errors?: Record<string, string>
  readonly?: boolean
  photoUrls?: Record<string, string>
}>();
const modelValue = defineModel<FormAnswers>({ required: true });
const emit = defineEmits<{ 'add-photo': [field: string] }>();

/** До стольких вариантов — кнопки-чипы (удобно пальцем), больше — выпадающий список */
const CHIP_CHOICES = 8;

const visible = computed(() => props.schema.fields.filter((f) => isRelevant(f, modelValue.value)
  && (!props.readonly || f.type !== 'note')));

const set = (f: FormField, value: unknown) => {
  modelValue.value = { ...modelValue.value, [f.name]: value as FormAnswer };
};
const text = (f: FormField) => {
  const v = modelValue.value[f.name];
  return v === null || v === undefined ? '' : String(v);
};
const photoIds = (f: FormField): string[] => {
  const v = modelValue.value[f.name];
  return Array.isArray(v) ? v : [];
};
const removePhoto = (f: FormField, id: string) => set(f, photoIds(f).filter((x) => x !== id));
const requiredLabel = (f: FormField) => (labelAbove(f) ? undefined : `${f.label}${f.required ? ' *' : ''}`);
/** Подпись над полем — у выбора и фото (у них нет своей подписи) */
const labelAbove = (f: FormField) => ['select_one', 'select_multiple', 'image'].includes(f.type);
const numberHint = (f: FormField) => {
  const range = f.min != null && f.max != null ? `от ${f.min} до ${f.max}`
    : f.min != null ? `не меньше ${f.min}` : f.max != null ? `не больше ${f.max}` : '';
  return [f.hint, range].filter(Boolean).join(' · ');
};
</script>

<style scoped>
.fr-field { margin-bottom: var(--space-3, 12px); }
.fr-view { margin-bottom: var(--space-2, 8px); }
.fr-value { white-space: pre-wrap; }
.fr-photos { display: flex; flex-wrap: wrap; gap: var(--space-2, 8px); align-items: center; }
.fr-photo {
  position: relative;
  width: 72px;
  height: 72px;
  border-radius: var(--radius-1, 4px);
  overflow: hidden;
  background: rgba(var(--v-theme-on-surface), 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
}
.fr-photo img { width: 100%; height: 100%; object-fit: cover; }
.fr-photo__remove { position: absolute; top: 2px; right: 2px; }
</style>
