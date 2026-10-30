<template>
  <v-dialog
    v-model="visible"
    :max-width="mode === 'list' ? 760 : 1100"
    :fullscreen="isMobile"
    scrollable
  >
    <v-card>
      <v-card-title class="d-flex align-center py-3 px-4">
        <v-icon
          class="mr-2"
          color="primary"
        >
          mdi-form-select
        </v-icon>
        <span class="text-h6 flex-grow-1">{{ mode === 'list' ? 'Формы обходов' : (draft.id ? `Форма «${draft.name}»` : 'Новая форма') }}</span>
        <HintTip text="Закрыть">
          <template #default="{ props: tip }">
            <v-btn
              v-bind="tip"
              icon="mdi-close"
              variant="text"
              size="small"
              aria-label="Закрыть"
              @click="visible = false"
            />
          </template>
        </HintTip>
      </v-card-title>
      <v-divider />

      <v-card-text class="pa-4">
        <v-alert
          v-if="errorMessage"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-3"
          closable
          @click:close="errorMessage = ''"
        >
          {{ errorMessage }}
        </v-alert>

        <!-- список -->
        <template v-if="mode === 'list'">
          <p class="text-body-2 mb-3">
            Что бригада отмечает на осмотре: состояние люка, вода в камере, температура, фото. Форму прикрепляют к
            наряду; бригада заполняет её в полевом приложении (и без связи) — раз на наряд или на каждом узле обхода.
            Готовую форму ODK / Survey123 можно загрузить из XLSForm.
          </p>
          <div class="d-flex flex-wrap ga-2 mb-3">
            <v-btn
              color="primary"
              prepend-icon="mdi-plus"
              @click="startNew()"
            >
              Новая форма
            </v-btn>
            <v-btn
              variant="tonal"
              prepend-icon="mdi-file-excel-outline"
              :loading="importing"
              @click="fileInput?.click()"
            >
              Загрузить XLSForm
            </v-btn>
            <input
              ref="fileInput"
              type="file"
              accept=".xlsx"
              class="d-none"
              @change="onImportFile"
            >
          </div>
          <v-progress-linear
            v-if="loading"
            indeterminate
            class="mb-2"
          />
          <p
            v-else-if="!forms.length"
            class="text-body-2 text-medium-emphasis"
          >
            Форм ещё нет.
          </p>
          <v-list
            v-else
            density="compact"
            class="py-0"
          >
            <v-list-item
              v-for="f in forms"
              :key="f.id"
              class="px-0"
              :class="{ 'text-medium-emphasis': !f.active }"
            >
              <v-list-item-title class="d-flex align-center ga-2">
                <span class="text-truncate">{{ f.name }}</span>
                <v-chip
                  size="x-small"
                  variant="tonal"
                  :color="f.active ? 'success' : undefined"
                >
                  {{ f.active ? 'действует' : 'выключена' }}
                </v-chip>
              </v-list-item-title>
              <v-list-item-subtitle class="fd-sub">
                {{ scopeTitle(f.scope) }} · полей {{ f.schema.fields.length }} · версия {{ f.current_version }} ·
                заполнений {{ f.submissions ?? 0 }}
              </v-list-item-subtitle>
              <template #append>
                <v-btn
                  size="small"
                  variant="text"
                  prepend-icon="mdi-pencil"
                  @click="startEdit(f)"
                >
                  Изменить
                </v-btn>
                <v-btn
                  v-if="f.submissions"
                  size="small"
                  variant="text"
                  icon="mdi-microsoft-excel"
                  :loading="busy === `export-${f.id}`"
                  :aria-label="`Заполнения формы «${f.name}» в Excel`"
                  @click="exportForm(f)"
                />
                <v-btn
                  size="small"
                  variant="text"
                  :icon="f.active ? 'mdi-pause' : 'mdi-play'"
                  :loading="busy === `active-${f.id}`"
                  :aria-label="f.active ? 'Выключить' : 'Включить'"
                  @click="toggleActive(f)"
                />
              </template>
            </v-list-item>
          </v-list>
        </template>

        <!-- редактор -->
        <template v-else>
          <v-alert
            v-if="importWarnings.length"
            type="warning"
            variant="tonal"
            density="compact"
            class="mb-3"
          >
            Из XLSForm перенесено не всё:
            <ul class="fd-warn">
              <li
                v-for="(w, i) in importWarnings"
                :key="i"
              >
                {{ w }}
              </li>
            </ul>
          </v-alert>
          <div class="fd-grid">
            <div>
              <v-text-field
                v-model="draft.name"
                label="Название формы"
                density="compact"
                variant="outlined"
                maxlength="200"
              />
              <v-textarea
                v-model="draft.description"
                label="Описание (для диспетчера)"
                rows="1"
                auto-grow
                density="compact"
                variant="outlined"
              />
              <v-btn-toggle
                v-model="draft.scope"
                mandatory
                density="compact"
                variant="outlined"
                class="mb-3"
              >
                <v-btn
                  v-for="s in SCOPES"
                  :key="s.value"
                  :value="s.value"
                  size="small"
                >
                  {{ s.title }}
                </v-btn>
              </v-btn-toggle>

              <div class="text-subtitle-2 mb-1">
                Поля
              </div>
              <v-expansion-panels
                v-model="openField"
                variant="accordion"
                class="mb-2"
              >
                <v-expansion-panel
                  v-for="(f, i) in draft.fields"
                  :key="f.key"
                  :value="f.key"
                >
                  <v-expansion-panel-title class="py-1">
                    <span class="text-truncate">{{ f.label || 'без подписи' }}</span>
                    <span class="text-caption text-medium-emphasis ml-2 flex-shrink-0">{{ typeTitle(f.type) }}{{ f.required ? ' · обязательно' : '' }}{{ f.relevant ? ' · с условием' : '' }}</span>
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <div class="d-flex ga-2">
                      <v-select
                        v-model="f.type"
                        :items="FIELD_TYPES"
                        label="Тип"
                        density="compact"
                        variant="outlined"
                        class="fd-type"
                      />
                      <v-text-field
                        v-model="f.label"
                        :label="f.type === 'note' ? 'Текст пояснения' : 'Подпись'"
                        density="compact"
                        variant="outlined"
                        maxlength="300"
                        @update:model-value="autoName(f)"
                      />
                    </div>
                    <div class="d-flex ga-2 align-center">
                      <v-text-field
                        v-model="f.name"
                        label="Имя (латиница)"
                        hint="колонка в выгрузке и в API"
                        persistent-hint
                        density="compact"
                        variant="outlined"
                        maxlength="40"
                        class="fd-name"
                        @update:model-value="f.nameTouched = true"
                      />
                      <v-checkbox
                        v-if="f.type !== 'note'"
                        v-model="f.required"
                        label="Обязательное"
                        density="compact"
                        hide-details
                      />
                    </div>
                    <v-text-field
                      v-model="f.hint"
                      label="Подсказка"
                      density="compact"
                      variant="outlined"
                      maxlength="500"
                      class="mt-2"
                    />
                    <v-textarea
                      v-if="f.type === 'select_one' || f.type === 'select_multiple'"
                      v-model="f.choicesText"
                      label="Варианты — по одному на строку"
                      hint="«значение = подпись» или просто подпись (значение составится само)"
                      persistent-hint
                      rows="3"
                      auto-grow
                      density="compact"
                      variant="outlined"
                    />
                    <div
                      v-if="f.type === 'integer' || f.type === 'decimal'"
                      class="d-flex ga-2"
                    >
                      <v-text-field
                        v-model="f.minText"
                        label="Не меньше"
                        inputmode="decimal"
                        density="compact"
                        variant="outlined"
                      />
                      <v-text-field
                        v-model="f.maxText"
                        label="Не больше"
                        inputmode="decimal"
                        density="compact"
                        variant="outlined"
                      />
                    </div>
                    <template v-if="conditionSources(i).length">
                      <v-checkbox
                        :model-value="!!f.relevant"
                        label="Показывать по условию"
                        density="compact"
                        hide-details
                        @update:model-value="toggleCondition(f, i, !!$event)"
                      />
                      <div
                        v-if="f.relevant"
                        class="d-flex ga-2"
                      >
                        <v-select
                          v-model="f.relevant.field"
                          :items="conditionSources(i)"
                          item-title="label"
                          item-value="name"
                          label="Если поле"
                          density="compact"
                          variant="outlined"
                          @update:model-value="f.relevant.value = defaultConditionValue($event)"
                        />
                        <v-select
                          v-model="f.relevant.op"
                          :items="conditionOps(f.relevant.field)"
                          label="Условие"
                          density="compact"
                          variant="outlined"
                          class="fd-op"
                        />
                        <v-select
                          v-if="conditionValues(f.relevant.field)"
                          v-model="f.relevant.value"
                          :items="conditionValues(f.relevant.field) ?? []"
                          item-title="label"
                          item-value="value"
                          label="Значение"
                          density="compact"
                          variant="outlined"
                        />
                        <v-text-field
                          v-else
                          v-model="f.relevant.value"
                          label="Значение"
                          density="compact"
                          variant="outlined"
                        />
                      </div>
                    </template>
                    <div class="d-flex ga-1 mt-1">
                      <v-btn
                        size="small"
                        variant="text"
                        icon="mdi-arrow-up"
                        :disabled="i === 0"
                        aria-label="Выше"
                        @click="moveField(i, -1)"
                      />
                      <v-btn
                        size="small"
                        variant="text"
                        icon="mdi-arrow-down"
                        :disabled="i === draft.fields.length - 1"
                        aria-label="Ниже"
                        @click="moveField(i, 1)"
                      />
                      <v-spacer />
                      <v-btn
                        size="small"
                        variant="text"
                        color="error"
                        prepend-icon="mdi-delete-outline"
                        @click="removeField(i)"
                      >
                        Удалить поле
                      </v-btn>
                    </div>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>
              <v-menu>
                <template #activator="{ props: menuProps }">
                  <v-btn
                    v-bind="menuProps"
                    variant="tonal"
                    prepend-icon="mdi-plus"
                  >
                    Добавить поле
                  </v-btn>
                </template>
                <v-list density="compact">
                  <v-list-item
                    v-for="t in FIELD_TYPES"
                    :key="t.value"
                    :title="t.title"
                    @click="addField(t.value)"
                  />
                </v-list>
              </v-menu>
            </div>

            <!-- предпросмотр: как увидит бригада -->
            <div class="fd-preview">
              <div class="d-flex align-center mb-2">
                <div class="text-subtitle-2 flex-grow-1">
                  Как увидит бригада
                </div>
                <v-btn
                  size="small"
                  variant="text"
                  @click="previewAnswers = {}"
                >
                  Очистить
                </v-btn>
              </div>
              <FormRenderer
                v-model="previewAnswers"
                :schema="schema"
                :errors="previewErrors"
                @add-photo="notify.showInfo('Фото добавляет бригада с телефона')"
              />
              <div
                v-if="!schema.fields.length"
                class="text-body-2 text-medium-emphasis"
              >
                Добавьте поля — форма появится здесь.
              </div>
            </div>
          </div>
        </template>
      </v-card-text>

      <template v-if="mode === 'edit'">
        <v-divider />
        <v-card-actions class="px-4 flex-wrap">
          <div
            v-if="problems.length"
            class="text-caption text-error fd-problems"
          >
            {{ problems.slice(0, 3).join(' · ') }}<span v-if="problems.length > 3"> · ещё {{ problems.length - 3 }}</span>
          </div>
          <v-spacer />
          <v-btn
            variant="text"
            @click="mode = 'list'"
          >
            Отмена
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :loading="saving"
            :disabled="!draft.name.trim() || problems.length > 0"
            @click="save"
          >
            Сохранить
          </v-btn>
        </v-card-actions>
      </template>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import HintTip from '~/components/HintTip.vue';
import FormRenderer from '~/components/forms/FormRenderer.vue';
import { useMobile } from '~/composables/useMobile';
import { fastApiService } from '~/services/fastApiService';
import { useNotificationStore } from '~/stores/notificationStore';
import { formatApiError } from '~/utils/apiError';
import {
  choicesText,
  fieldName,
  FIELD_TYPES,
  parseChoices,
  SCOPES,
  schemaProblems,
  validateAnswers,
  type FormAnswers,
  type FormField,
  type FormFieldType,
  type FormRelevant,
  type FormRow,
  type FormSchema,
  type FormScope,
} from '~/utils/forms';

/**
 * Конструктор форм обходов (фаза 2, п. 8): поля, варианты, обязательность, условия показа, предпросмотр «как
 * увидит бригада», импорт XLSForm, выгрузка заполнений в Excel. Только администратор. Правка полей — новая версия
 * формы на сервере, прежние ответы остаются по своей версии.
 */
const visible = defineModel<boolean>({ default: false });
const { isMobile } = useMobile();
const notify = useNotificationStore();

interface DraftField {
  key: number;
  name: string;
  nameTouched: boolean;
  type: FormFieldType;
  label: string;
  hint: string;
  required: boolean;
  choicesText: string;
  minText: string;
  maxText: string;
  relevant: FormRelevant | null;
}

const mode = ref<'list' | 'edit'>('list');
const forms = ref<FormRow[]>([]);
const loading = ref(false);
const saving = ref(false);
const importing = ref(false);
const busy = ref('');
const errorMessage = ref('');
const importWarnings = ref<string[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);
const openField = ref<number | undefined>(undefined);
const previewAnswers = ref<FormAnswers>({});
const draft = reactive({ id: null as number | null, name: '', description: '', scope: 'order' as FormScope, fields: [] as DraftField[] });
let nextKey = 1;

const typeTitle = (t: FormFieldType) => FIELD_TYPES.find((x) => x.value === t)?.title ?? t;
const scopeTitle = (s: FormScope) => SCOPES.find((x) => x.value === s)?.title ?? s;
const num = (text: string): number | null => {
  const n = Number(String(text).replace(',', '.'));
  return text.trim() === '' || !Number.isFinite(n) ? null : n;
};

/** Черновик → описание формы для сервера и предпросмотра */
const schema = computed<FormSchema>(() => ({
  fields: draft.fields.map((f): FormField => {
    const out: FormField = { name: f.name, type: f.type, label: f.label.trim(), required: f.type !== 'note' && f.required };
    if (f.hint.trim()) out.hint = f.hint.trim();
    if (f.type === 'select_one' || f.type === 'select_multiple') out.choices = parseChoices(f.choicesText);
    if (f.type === 'integer' || f.type === 'decimal') {
      out.min = num(f.minText);
      out.max = num(f.maxText);
    }
    if (f.relevant) out.relevant = { ...f.relevant };
    return out;
  }),
}));
const problems = computed(() => schemaProblems(schema.value));
const previewErrors = computed(() => validateAnswers(schema.value, previewAnswers.value).errors);

const toDraft = (f: FormField): DraftField => ({
  key: nextKey++, name: f.name, nameTouched: true, type: f.type, label: f.label, hint: f.hint ?? '',
  required: !!f.required, choicesText: choicesText(f.choices), minText: f.min != null ? String(f.min) : '',
  maxText: f.max != null ? String(f.max) : '', relevant: f.relevant ? { ...f.relevant } : null,
});

const load = async () => {
  loading.value = true;
  errorMessage.value = '';
  try {
    forms.value = await fastApiService.getForms();
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Формы не загружены');
  } finally {
    loading.value = false;
  }
};

const startNew = (prefill?: { name?: string; schema?: FormSchema }) => {
  Object.assign(draft, {
    id: null, name: prefill?.name ?? '', description: '', scope: 'order',
    fields: (prefill?.schema?.fields ?? []).map(toDraft),
  });
  if (!prefill) importWarnings.value = [];
  previewAnswers.value = {};
  openField.value = undefined;
  mode.value = 'edit';
};

const startEdit = (f: FormRow) => {
  Object.assign(draft, { id: f.id, name: f.name, description: f.description, scope: f.scope, fields: f.schema.fields.map(toDraft) });
  importWarnings.value = [];
  previewAnswers.value = {};
  openField.value = undefined;
  mode.value = 'edit';
};

const usedNames = (except?: DraftField) => draft.fields.filter((f) => f !== except).map((f) => f.name);

const addField = (type: FormFieldType) => {
  const label = type === 'note' ? 'Пояснение' : typeTitle(type);
  const f: DraftField = {
    key: nextKey++, name: fieldName(label, usedNames()), nameTouched: false, type, label, hint: '',
    required: false, choicesText: type === 'select_one' || type === 'select_multiple' ? 'Вариант 1\nВариант 2' : '',
    minText: '', maxText: '', relevant: null,
  };
  draft.fields.push(f);
  openField.value = f.key;
};

/** Имя поля следует за подписью, пока его не правили руками */
const autoName = (f: DraftField) => {
  if (!f.nameTouched) f.name = fieldName(f.label, usedNames(f));
};

const moveField = (i: number, step: number) => {
  const list = draft.fields;
  [list[i], list[i + step]] = [list[i + step], list[i]];
  // условие может ссылаться только на поле выше — сброс нарушенных
  list.forEach((f, idx) => {
    if (f.relevant && !list.slice(0, idx).some((p) => p.name === f.relevant?.field)) f.relevant = null;
  });
};

const removeField = (i: number) => {
  const [gone] = draft.fields.splice(i, 1);
  draft.fields.forEach((f) => {
    if (f.relevant?.field === gone.name) f.relevant = null;
  });
};

/** Поля выше этого, по которым можно задать условие */
const conditionSources = (i: number) => draft.fields.slice(0, i)
  .filter((f) => f.type !== 'note' && f.type !== 'image')
  .map((f) => ({ name: f.name, label: f.label || f.name, type: f.type }));

const sourceField = (name: string) => schema.value.fields.find((f) => f.name === name);

const conditionOps = (name: string) => (sourceField(name)?.type === 'select_multiple'
  ? [{ title: 'выбрано', value: 'selected' }]
  : [{ title: 'равно', value: '=' }, { title: 'не равно', value: '!=' }]);

/** Значения условия: варианты выбора или «да» у отметки; иначе — ввод текстом */
const conditionValues = (name: string): { value: string; label: string }[] | null => {
  const src = sourceField(name);
  if (!src) return null;
  if (src.type === 'acknowledge') return [{ value: '1', label: 'да' }];
  return src.choices?.length ? src.choices : null;
};

const defaultConditionValue = (name: string) => conditionValues(name)?.[0]?.value ?? '';

const toggleCondition = (f: DraftField, i: number, on: boolean) => {
  if (!on) {
    f.relevant = null;
    return;
  }
  const sources = conditionSources(i);
  const src = sources[sources.length - 1];  // чаще всего условие — по полю прямо над этим
  f.relevant = {
    field: src.name, op: src.type === 'select_multiple' ? 'selected' : '=', value: defaultConditionValue(src.name),
  };
};

const save = async () => {
  saving.value = true;
  errorMessage.value = '';
  const body = { name: draft.name.trim(), description: draft.description, scope: draft.scope, schema: schema.value };
  try {
    const saved = draft.id ? await fastApiService.updateForm(draft.id, body) : await fastApiService.createForm(body);
    notify.showSuccess(`Форма «${saved.name}» сохранена (версия ${saved.current_version})`);
    importWarnings.value = [];
    mode.value = 'list';
    await load();
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Форма не сохранена');
  } finally {
    saving.value = false;
  }
};

const onImportFile = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  importing.value = true;
  errorMessage.value = '';
  try {
    const res = await fastApiService.importXlsForm(file);
    importWarnings.value = res.warnings;
    startNew({ name: res.form.name || file.name.replace(/\.xlsx$/i, ''), schema: res.form.schema });
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'XLSForm не загружена');
  } finally {
    importing.value = false;
  }
};

const toggleActive = async (f: FormRow) => {
  busy.value = `active-${f.id}`;
  try {
    await fastApiService.setFormActive(f.id, !f.active);
    await load();
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Форма не изменена');
  } finally {
    busy.value = '';
  }
};

const exportForm = async (f: FormRow) => {
  busy.value = `export-${f.id}`;
  try {
    const blob = await fastApiService.exportFormSubmissions(f.id);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${f.name}.xlsx`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Выгрузка не получилась');
  } finally {
    busy.value = '';
  }
};

watch(visible, (open) => {
  if (open) {
    mode.value = 'list';
    void load();
  }
}, { immediate: true });

const openDialog = () => {
  visible.value = true;
};

defineExpose({ openDialog });
</script>

<style scoped>
.fd-sub { white-space: normal; }
.fd-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--space-4, 16px); }
.fd-preview {
  border-left: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  padding-left: var(--space-4, 16px);
}
.fd-type { max-width: 190px; }
.fd-name { max-width: 260px; }
.fd-op { max-width: 140px; }
.fd-warn { margin: 4px 0 0 18px; }
.fd-problems { max-width: 60%; }
@media (max-width: 900px) {
  .fd-grid { grid-template-columns: minmax(0, 1fr); }
  .fd-preview { border-left: 0; padding-left: 0; border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); padding-top: var(--space-3, 12px); }
}
</style>
