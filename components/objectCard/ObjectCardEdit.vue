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
                        :display-text="ci === 0 ? f.value : f.value2"
                        :fileid="card.fileid"
                        :row-id="col.id"
                        :error="errors[draftKey(f.table, col.id, f.field)]"
                        @update:model-value="setValue(f, col.id, $event)"
                      />
                      <span
                        v-else
                        class="oce-readonly"
                      >{{ shown(ci === 0 ? f.value : f.value2) }}</span>
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
        >Сохранить</v-btn>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import CardFieldEditor from '~/components/objectCard/CardFieldEditor.vue';
import { ApiError, fastApiService } from '~/services/fastApiService';
import { confirmAction } from '~/composables/useConfirm';
import { useNotificationStore } from '~/stores/notificationStore';
import { formatApiError } from '~/utils/apiError';
import { formatDesktopNumber } from '~/utils/desktopNumber';
import {
  draftChanges, draftKey, fieldColumns, hiddenByVis, initialDraft, ruleValues, validateDraft,
  type CardEditData, type CardField, type CardTab,
} from '~/utils/objectCard';

const props = defineProps<{ kind: 'line' | 'node'; table: string; objectId: number }>();
const emit = defineEmits<{
  saved: [result: { changed: number }]
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
    const data = await fastApiService.getCardEdit(props.kind, props.table, props.objectId);
    card.value = data;
    draft.value = initialDraft(data);
    showErrors.value = false;
  } catch (e) {
    loadError.value = formatApiError(e, 'Не удалось загрузить карточку');
  } finally {
    loading.value = false;
  }
};
watch(() => [props.kind, props.table, props.objectId], () => { void load(); }, { immediate: true });

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

const setValue = (f: CardField, id: number, value: unknown) => {
  draft.value = { ...draft.value, [draftKey(f.table, id, f.field)]: value };
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

const save = async () => {
  if (!card.value || !changes.value.length) return;
  showErrors.value = true;
  if (Object.keys(validateDraft(card.value, draft.value)).length) return;
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
