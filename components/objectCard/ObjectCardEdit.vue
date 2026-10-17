<template>
  <div class="oce">
    <div
      v-if="loading"
      class="oce-state"
    >
      <v-progress-circular
        indeterminate
        color="primary"
        size="28"
      />
      <div class="text-body-2 text-medium-emphasis mt-2">Загрузка карточки…</div>
    </div>
    <div
      v-else-if="loadError"
      class="oce-state"
    >
      <v-icon
        color="error"
        size="32"
      >mdi-alert-circle-outline</v-icon>
      <div class="text-body-2 mt-2">{{ loadError }}</div>
      <v-btn
        class="mt-3"
        variant="tonal"
        size="small"
        @click="load"
      >Повторить</v-btn>
    </div>
    <template v-else-if="card">
      <div
        v-if="card.batch && card.selection"
        class="oce-batch"
      >
        <v-icon
          size="18"
          color="primary"
        >mdi-select-multiple</v-icon>
        <span>
          Участков: <b>{{ card.selection.lines }}</b><template v-if="card.selection.columns.length > 1">
            (подача {{ card.selection.columns[0].line_ids.length }}, обратка {{ card.selection.columns[1].line_ids.length }})</template>.
          Поля с пометкой «разные» не меняются, пока не задано значение.
        </span>
      </div>
      <v-tabs
        v-model="tab"
        density="compact"
        color="primary"
        show-arrows
        class="oce-tabs"
      >
        <v-tab
          v-for="(t, i) in editTabs"
          :key="i"
          :value="i"
          class="text-none"
        >
          {{ t.title }}
          <v-badge
            v-if="changedInTab(t)"
            :content="changedInTab(t)"
            color="warning"
            inline
          />
        </v-tab>
      </v-tabs>
      <v-divider />
      <div class="oce-body">
        <v-window v-model="tab">
          <v-window-item
            v-for="(t, i) in editTabs"
            :key="i"
            :value="i"
          >
            <div class="pa-2">
              <div
                v-for="(sub, si) in t.subsections"
                :key="si"
                class="oce-section"
              >
                <div class="oce-section-title">{{ sub.title }}</div>
                <div
                  v-if="columns.length > 1"
                  class="oce-row oce-row--head"
                >
                  <span />
                  <span
                    v-for="c in columns"
                    :key="c"
                    class="oce-col-head"
                  >{{ c }}</span>
                </div>
                <template
                  v-for="f in sub.fields"
                  :key="f.table + f.field"
                >
                  <div
                    v-if="!isHidden(f)"
                    class="oce-row"
                    :class="{ 'oce-row--changed': rowChanged(f) }"
                    :style="{ gridTemplateColumns: gridColumns }"
                  >
                    <span
                      class="oce-label"
                      :title="f.label"
                    >
                      {{ f.label }}<span
                        v-if="f.edit?.not_null"
                        class="text-error"
                      > *</span>
                    </span>
                    <template
                      v-for="(col, ci) in fieldColumns(f)"
                      :key="ci"
                    >
                      <CardFieldEditor
                        v-if="!col.readonly"
                        :model-value="draft[draftKey(f.table, col.id, f.field)]"
                        :edit="f.edit!"
                        :table="f.table"
                        :field="f.field"
                        :display-text="displayText(f, ci)"
                        :fileid="card.fileid"
                        :row-id="col.id"
                        :error="errors[draftKey(f.table, col.id, f.field)]"
                        :mixed="Boolean(f.edit?.mixed?.[ci]) && draft[draftKey(f.table, col.id, f.field)] == null"
                        @update:model-value="setValue(f, ci, $event)"
                        @helper="openHelper(f, ci)"
                      />
                      <span
                        v-else
                        class="oce-readonly"
                      >{{ f.edit?.mixed?.[ci] ? 'разные' : shown(ci === 0 ? f.value : f.value2) }}</span>
                    </template>
                  </div>
                </template>
              </div>
            </div>
          </v-window-item>
        </v-window>
      </div>
      <v-divider />
      <div class="oce-actions">
        <span class="text-caption text-medium-emphasis">
          {{ changes.length ? `Изменено полей: ${changes.length}` : 'Изменений нет' }}
        </span>
        <v-spacer />
        <v-btn
          variant="text"
          size="small"
          :disabled="saving"
          @click="cancel"
        >Отмена</v-btn>
        <v-btn
          color="primary"
          variant="flat"
          size="small"
          :loading="saving"
          :disabled="!changes.length"
          @click="save"
        >{{ card.batch ? 'Применить…' : 'Сохранить' }}</v-btn>
      </div>
    </template>
    <!-- Несколько участков: предпросмотр «было → станет» перед применением -->
    <v-dialog
      v-model="previewOpen"
      max-width="640"
      scrollable
    >
      <v-card v-if="preview">
        <v-card-title class="text-subtitle-1">Изменить свойства участков</v-card-title>
        <v-divider />
        <v-card-text class="oce-preview">
          <div class="text-body-2 mb-2">
            Участков в выборе: {{ preview.lines }}. Изменится строк: <b>{{ preview.changes }}</b>.
          </div>
          <div
            v-for="(pf, i) in preview.fields"
            :key="i"
            class="oce-pv-field"
          >
            <div class="font-weight-medium">
              {{ pf.label }}<span
                v-if="pf.column_title"
                class="text-medium-emphasis"
              > · {{ pf.column_title }}</span>
            </div>
            <div class="text-body-2">
              → <b>{{ shown(pf.new_title) }}</b>
              <span class="text-medium-emphasis"> — изменится {{ pf.changes }} из {{ pf.rows }}</span>
            </div>
            <div
              v-if="pf.was.length"
              class="text-caption text-medium-emphasis"
            >
              было: {{ wasText(pf.was) }}
            </div>
          </div>
        </v-card-text>
        <v-divider />
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            :disabled="saving"
            @click="previewOpen = false"
          >Назад</v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :loading="saving"
            :disabled="!preview.changes"
            @click="applyBatch"
          >Применить</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <CardHelperDialog
      v-model="helperOpen"
      :helper="helperData"
      :loading="helperLoading"
      :error="helperError"
      :mestn-text="helperMestnText"
      @apply="applyHelper"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import CardFieldEditor from '~/components/objectCard/CardFieldEditor.vue';
import CardHelperDialog from '~/components/objectCard/CardHelperDialog.vue';
import { ApiError, fastApiService } from '~/services/fastApiService';
import { confirmAction } from '~/composables/useConfirm';
import { useNotificationStore } from '~/stores/notificationStore';
import { formatApiError } from '~/utils/apiError';
import { formatDesktopNumber } from '~/utils/desktopNumber';
import {
  applyFieldValues, draftChanges, draftKey, fieldColumns, hiddenByVis, initialDraft, ruleValues, validateDraft,
  type CardBatchPreview, type CardEditData, type CardField, type CardHelper, type CardTab,
} from '~/utils/objectCard';

const props = defineProps<{
  kind: 'line' | 'node'
  table: string
  objectId: number
  /** несколько участков (linesobj.id): одна карточка, значения по колонкам */
  batchIds?: number[] | null
}>();
const emit = defineEmits<{
  saved: [result: { changed: number; changeGroupId?: string | null }]
  cancel: []
  dirty: [dirty: boolean]
}>();

const card = ref<CardEditData | null>(null);
const draft = ref<Record<string, unknown>>({});
const loading = ref(false);
const loadError = ref('');
const saving = ref(false);
const tab = ref(0);
const showErrors = ref(false);

const load = async () => {
  loading.value = true;
  loadError.value = '';
  try {
    const data = props.batchIds?.length
      ? await fastApiService.getCardBatch(props.batchIds)
      : await fastApiService.getCardEdit(props.kind, props.table, props.objectId);
    card.value = data;
    draft.value = initialDraft(data);
    titles.value = {};
    showErrors.value = false;
  } catch (e) {
    loadError.value = formatApiError(e, 'Не удалось загрузить карточку');
  } finally {
    loading.value = false;
  }
};
watch(() => [props.kind, props.table, props.objectId, props.batchIds?.join(',')], () => { void load(); }, { immediate: true });

// Вкладки результатов расчёта — только просмотр, в форме правки их нет
const editTabs = computed<CardTab[]>(() => (card.value?.tabs ?? []).filter((t) => !t.readonly));
const columns = computed(() => card.value?.columns ?? ['']);
const gridColumns = computed(() => `minmax(140px, 0.9fr) repeat(${columns.value.length}, minmax(0, 1fr))`);

const changes = computed(() => (card.value ? draftChanges(card.value, draft.value) : []));
watch(() => changes.value.length > 0, (d) => emit('dirty', d), { immediate: true });
const errors = computed(() => (card.value && showErrors.value ? validateDraft(card.value, draft.value) : {}));

const changedKeys = computed(() => new Set(changes.value.map((c) => draftKey(c.table, c.id, c.field))));
const rowChanged = (f: CardField) => fieldColumns(f).some((c) => changedKeys.value.has(draftKey(f.table, c.id, f.field)));
const changedInTab = (t: CardTab) => t.subsections.reduce((n, s) => n + s.fields.filter(rowChanged).length, 0);

// Видимость как в десктопе: правила .vis по текущим значениям (меняются вместе с черновиком)
const hiddenSets = computed(() => {
  const out: Record<string, Set<string>[]> = {};
  if (!card.value) return out;
  for (const [table, r] of Object.entries(card.value.rules || {})) {
    out[table] = columns.value.map((_, ci) => hiddenByVis(r.vis, ruleValues(card.value!, draft.value, table, ci)));
  }
  return out;
});
const isHidden = (f: CardField) => {
  const sets = hiddenSets.value[f.table.toLowerCase()];
  if (!sets) return Boolean(f.hidden);
  return sets.every((s) => s.has(f.field.toLowerCase()));
};

// Подписи значений списков, поставленных не из самого списка (зависимые поля ms_rs)
const titles = ref<Record<string, string | null>>({});
const displayText = (f: CardField, ci: number) => {
  const col = fieldColumns(f)[ci];
  const key = col ? draftKey(f.table, col.id, f.field) : '';
  if (key in titles.value) return titles.value[key] ?? undefined;
  return ci === 0 ? f.value : f.value2;
};

const setValue = async (f: CardField, ci: number, value: unknown) => {
  const col = fieldColumns(f)[ci];
  if (!col || !card.value) return;
  const key = draftKey(f.table, col.id, f.field);
  draft.value = { ...draft.value, [key]: value };
  const { [key]: _drop, ...rest } = titles.value;
  titles.value = rest;
  if (!f.edit?.after) return;
  // как ms_rs десктопа: магистраль / участок МС / участок РС заполняют или сбрасывают друг друга
  try {
    const res = await fastApiService.getCardAfter({ table: f.table, field: f.field, value });
    const values = Object.fromEntries(Object.entries(res.set).map(([k, v]) => [k, v?.value ?? null]));
    const { draft: next, applied } = applyFieldValues(card.value, draft.value, f.table, ci, values);
    draft.value = next;
    const t = { ...titles.value };
    for (const [k, v] of Object.entries(res.set)) {
      const hit = applied.find((a) => a.endsWith(`:${k.toLowerCase()}`));
      if (hit) t[hit] = v?.title ?? null;
    }
    titles.value = t;
  } catch (e) {
    useNotificationStore().showError(formatApiError(e, 'Не удалось заполнить связанные поля'));
  }
};

// --- окно-помощник поля (сортамент, справочная таблица, местные сопротивления) ---
const helperOpen = ref(false);
const helperData = ref<CardHelper | null>(null);
const helperLoading = ref(false);
const helperError = ref('');
const helperTarget = ref<{ table: string; column: number } | null>(null);
const helperMestnText = ref<unknown>(null);

const openHelper = async (f: CardField, ci: number) => {
  if (!card.value) return;
  const values = ruleValues(card.value, draft.value, f.table, ci);
  helperTarget.value = { table: f.table, column: ci };
  helperMestnText.value = values.mestn ?? null;
  helperData.value = null;
  helperError.value = '';
  helperLoading.value = true;
  helperOpen.value = true;
  try {
    const sid = Number(values.standardid);
    helperData.value = await fastApiService.getCardHelper({
      table: f.table, field: f.field, standard_id: Number.isFinite(sid) && sid > 0 ? sid : null,
    });
  } catch (e) {
    helperError.value = formatApiError(e, 'Не удалось загрузить данные');
  } finally {
    helperLoading.value = false;
  }
};

const applyHelper = (values: Record<string, unknown>) => {
  if (!card.value || !helperTarget.value) return;
  const { table, column } = helperTarget.value;
  draft.value = applyFieldValues(card.value, draft.value, table, column, values).draft;
};

const shown = (v: unknown) => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'number') return formatDesktopNumber(v);
  return String(v);
};

const cancel = async () => {
  if (changes.value.length && !(await confirmAction({ text: 'Отменить несохранённые изменения?', action: 'Отменить изменения' }))) return;
  emit('cancel');
};

// --- несколько участков: предпросмотр и применение ---
const previewOpen = ref(false);
const preview = ref<CardBatchPreview | null>(null);
const wasText = (was: CardBatchPreview['fields'][number]['was']) =>
  was.map((w) => `${shown(w.title)} (${w.count})`).join(', ');

// «разные» без нового значения — не изменение
const isMixedChange = (c: { table: string; id: number; field: string; value: unknown }) => {
  if (c.value !== null) return false;
  for (const t of card.value?.tabs ?? []) {
    for (const sub of t.subsections) {
      for (const f of sub.fields) {
        if (f.table.toLowerCase() === c.table.toLowerCase() && f.field.toLowerCase() === c.field.toLowerCase()) {
          return Boolean(f.edit?.mixed?.[c.id - 1]);
        }
      }
    }
  }
  return false;
};
const batchChanges = computed(() => changes.value.filter((c) => !isMixedChange(c)));

const applyBatch = async () => {
  if (!preview.value || !props.batchIds?.length) return;
  saving.value = true;
  try {
    const res = await fastApiService.applyCardBatch({
      ids: props.batchIds, changes: batchChanges.value, expected_changes: preview.value.changes,
    });
    previewOpen.value = false;
    emit('saved', { changed: res.changed, changeGroupId: res.change_group_id });
  } catch (e) {
    previewOpen.value = false;
    if (e instanceof ApiError && e.status === 409) {
      useNotificationStore().showWarning(formatApiError(e, 'Данные изменились — повторите'));
    } else {
      useNotificationStore().showError(formatApiError(e, 'Не удалось применить'));
    }
  } finally {
    saving.value = false;
  }
};

const save = async () => {
  if (!card.value || !changes.value.length) return;
  showErrors.value = true;
  if (Object.keys(validateDraft(card.value, draft.value)).length) return;
  if (card.value.batch) {
    if (!props.batchIds?.length || !batchChanges.value.length) return;
    saving.value = true;
    try {
      preview.value = await fastApiService.previewCardBatch({ ids: props.batchIds, changes: batchChanges.value });
      previewOpen.value = true;
    } catch (e) {
      useNotificationStore().showError(formatApiError(e, 'Не удалось подготовить предпросмотр'));
    } finally {
      saving.value = false;
    }
    return;
  }
  saving.value = true;
  try {
    const res = await fastApiService.saveCardEdit({ changes: changes.value, versions: card.value.versions });
    const changed = res.rows.reduce((n, r) => n + Object.keys(r.changed || {}).length, 0);
    emit('saved', { changed });
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) {
      const reload = await confirmAction({
        text: 'Объект изменил другой пользователь. Перечитать карточку? Ваши изменения будут потеряны.',
        action: 'Перечитать',
      });
      if (reload) await load();
    } else {
      useNotificationStore().showError(formatApiError(e, 'Не удалось сохранить'));
    }
  } finally {
    saving.value = false;
  }
};

defineExpose({ hasChanges: () => changes.value.length > 0, reload: load });
</script>

<style scoped>
.oce {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}
.oce-state {
  padding: 32px 16px;
  text-align: center;
}
.oce-tabs {
  flex-shrink: 0;
}
.oce-batch {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 8px 12px;
  font-size: 12.5px;
  background: rgba(var(--v-theme-primary), 0.06);
  flex-shrink: 0;
}
.oce-preview {
  max-height: 60vh;
}
.oce-pv-field {
  padding: 6px 0;
  border-bottom: 1px solid rgba(var(--v-border-color), 0.08);
}
.oce-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}
.oce-section {
  margin-bottom: 10px;
}
.oce-section-title {
  font-size: 12px;
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
  padding: 6px 4px 4px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  margin-bottom: 4px;
}
.oce-row {
  display: grid;
  grid-template-columns: minmax(140px, 0.9fr) minmax(0, 1fr);
  gap: 6px;
  align-items: center;
  padding: 2px 4px;
  border-radius: 6px;
}
.oce-row--head {
  font-size: 11px;
  color: rgba(0, 0, 0, 0.55);
}
.oce-row--changed {
  background: rgba(255, 193, 7, 0.12);
}
.oce-col-head {
  font-weight: 600;
}
.oce-label {
  font-size: 12.5px;
  color: rgba(0, 0, 0, 0.7);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.oce-readonly {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.55);
  padding: 6px 4px;
}
.oce-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  flex-shrink: 0;
}
</style>
