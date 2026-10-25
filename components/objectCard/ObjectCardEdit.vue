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
      <!-- кто создал объект в вебе (право «только свои») -->
      <div
        v-if="card.created"
        class="text-caption text-medium-emphasis px-3 pt-1"
      >
        Создан: <b>{{ card.created.created_by }}</b><template v-if="card.created.created_at">, {{ formatCreated(card.created.created_at) }}</template>
      </div>
      <div
        v-if="card.batch && card.selection"
        class="oce-batch"
      >
        <v-icon
          size="18"
          color="primary"
        >mdi-select-multiple</v-icon>
        <span>
          {{ kindText.Many }}: <b>{{ card.selection.lines }}</b><template v-if="card.selection.columns.length > 1">
            (подача {{ card.selection.columns[0].line_ids.length }}, обратка {{ card.selection.columns[1].line_ids.length }})</template>.
          Поля с пометкой «разные» не меняются, пока не задано значение.
        </span>
      </div>
      <!-- Заполнение: как у соседнего участка (узла), из шаблона; сохранить значения как шаблон -->
      <div class="oce-fill">
        <v-btn
          v-if="!card.batch && kindText.neighborTip"
          size="small"
          variant="text"
          prepend-icon="mdi-content-duplicate"
          :loading="neighborLoading"
          @click="fillFromNeighbor"
        >
          Как у соседнего
          <v-tooltip
            activator="parent"
            location="bottom"
            max-width="300"
          >{{ kindText.neighborTip }}</v-tooltip>
        </v-btn>
        <v-menu location="bottom start">
          <template #activator="{ props: menuProps }">
            <v-btn
              v-bind="menuProps"
              size="small"
              variant="text"
              prepend-icon="mdi-file-document-multiple-outline"
              @click="loadTemplates"
            >Шаблон</v-btn>
          </template>
          <v-list
            density="compact"
            min-width="260"
            max-width="380"
          >
            <v-list-subheader>Применить шаблон</v-list-subheader>
            <v-list-item
              v-if="templatesLoading"
              title="Загрузка…"
            />
            <v-list-item
              v-else-if="!templates.length"
              title="Шаблонов пока нет"
              class="text-medium-emphasis"
            />
            <v-list-item
              v-for="t in templates"
              :key="t.id"
              :title="t.name"
              :subtitle="templateSubtitle(t)"
              @click="applyTemplate(t)"
            >
              <template #append>
                <HintTip
                  v-if="t.author === currentUser"
                  text="Удалить шаблон"
                >
                  <template #default="{ props: tip }">
                    <v-btn
                      v-bind="tip"
                      icon="mdi-delete-outline"
                      size="x-small"
                      variant="text"
                      aria-label="Удалить шаблон"
                      @click.stop="removeTemplate(t)"
                    />
                  </template>
                </HintTip>
              </template>
            </v-list-item>
            <v-divider />
            <v-list-item
              prepend-icon="mdi-content-save-outline"
              title="Сохранить как шаблон…"
              @click="openSaveTemplate"
            />
          </v-list>
        </v-menu>
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
                        v-if="!col.readonly && !isDisabled(f, ci)"
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
    <!-- Сохранить значения карточки как шаблон -->
    <v-dialog
      v-model="saveTplOpen"
      max-width="560"
      scrollable
    >
      <v-card>
        <v-card-title class="text-subtitle-1">Сохранить как шаблон</v-card-title>
        <v-divider />
        <v-card-text class="oce-preview">
          <v-text-field
            v-model="tplName"
            label="Название"
            density="compact"
            variant="outlined"
            autofocus
            :counter="200"
          />
          <v-checkbox
            v-model="tplShared"
            label="Общий — виден всем редакторам"
            density="compact"
            hide-details
          />
          <div
            v-if="columns.length > 1"
            class="d-flex align-center ga-2 my-2"
          >
            <span class="text-body-2">Значения колонки:</span>
            <v-btn-toggle
              v-model="tplColumn"
              density="compact"
              mandatory
              divided
              variant="outlined"
            >
              <v-btn
                v-for="(c, ci) in columns"
                :key="ci"
                :value="ci"
                size="small"
              >{{ c }}</v-btn>
            </v-btn-toggle>
          </div>
          <div class="text-caption text-medium-emphasis my-2">
            Поля шаблона ({{ kindText.templateNote }}):
          </div>
          <div
            v-for="it in tplCandidates"
            :key="it.table + it.field"
            class="oce-tpl-row"
          >
            <v-checkbox
              v-model="tplPicked"
              :value="it.table + '.' + it.field"
              density="compact"
              hide-details
            >
              <template #label>
                <span class="text-body-2">{{ it.label }}: <b>{{ shown(it.text ?? it.value) }}</b></span>
              </template>
            </v-checkbox>
          </div>
        </v-card-text>
        <v-divider />
        <v-card-actions>
          <span class="text-caption text-medium-emphasis ml-2">Выбрано полей: {{ tplPicked.length }}</span>
          <v-spacer />
          <v-btn
            variant="text"
            @click="saveTplOpen = false"
          >Отмена</v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :loading="tplSaving"
            :disabled="!tplName.trim() || !tplPicked.length"
            @click="saveTemplate"
          >Сохранить</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <!-- Несколько участков (узлов): предпросмотр «было → станет» перед применением -->
    <v-dialog
      v-model="previewOpen"
      max-width="640"
      scrollable
    >
      <v-card v-if="preview">
        <v-card-title class="text-subtitle-1">Изменить свойства {{ kindText.many }}</v-card-title>
        <v-divider />
        <v-card-text class="oce-preview">
          <div class="text-body-2 mb-2">
            {{ kindText.Many }} в выборе: {{ preview.lines }}. Изменится строк: <b>{{ preview.changes }}</b>.
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
    <ConsumerSchemeDialog
      v-model="schemeOpen"
      :scheme="schemeCurrent"
      @apply="applyScheme"
    />
  </div>
</template>

<script setup lang="ts">
import HintTip from '~/components/HintTip.vue'
/** «19.10.2026 12:21» — дата создания объекта в карточке */
const formatCreated = (iso: string) => new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
import { computed, ref, watch } from 'vue';
import CardFieldEditor from '~/components/objectCard/CardFieldEditor.vue';
import CardHelperDialog from '~/components/objectCard/CardHelperDialog.vue';
import ConsumerSchemeDialog from '~/components/objectCard/ConsumerSchemeDialog.vue';
import { schemeChangeValues, schemeVisValues } from '~/utils/consumerScheme';
import { ApiError, fastApiService } from '~/services/fastApiService';
import { confirmAction } from '~/composables/useConfirm';
import { useNotificationStore } from '~/stores/notificationStore';
import { useAuthStore } from '~/stores/authStore';
import { formatApiError } from '~/utils/apiError';
import { formatDesktopNumber } from '~/utils/desktopNumber';
import {
  applyFieldValues, columnValues, disabledByRules, draftChanges, draftKey, fieldColumns, hiddenByVis, initialDraft, KIND_TEXT,
  ruleValues, validateDraft,
  type CardBatchPreview, type CardEditData, type CardField, type CardHelper, type CardKind, type CardTab, type CardTemplate,
  type CardValues,
} from '~/utils/objectCard';

const props = defineProps<{
  kind: CardKind
  table: string
  objectId: number
  /** несколько участков (linesobj.id) или узлов (nodes.id; у потребителей и т.п. — их узлы): одна карточка */
  batchIds?: number[] | null
}>();
const kindText = computed(() => KIND_TEXT[props.kind]);
const emit = defineEmits<{
  saved: [result: { changed: number; changeGroupId?: string | null; operationId?: number | null }]
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
      ? await fastApiService.getCardBatch(props.batchIds, props.kind)
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

// Видимость как в десктопе: правила .vis по текущим значениям (меняются вместе с черновиком);
// у потребителя ключи — признаки номера схемы (setPR: elev, otop, gvs, …)
const visValues = (table: string, ci: number) => {
  const values = ruleValues(card.value!, draft.value, table, ci);
  return table === 'realconsumers' ? { ...values, ...schemeVisValues(values.schemenum) } : values;
};
const hiddenSets = computed(() => {
  const out: Record<string, Set<string>[]> = {};
  if (!card.value) return out;
  for (const [table, r] of Object.entries(card.value.rules || {})) {
    out[table] = columns.value.map((_, ci) => hiddenByVis(r.vis, visValues(table, ci)));
  }
  return out;
});
// Доступность как в десктопе: правила .disable по кодам списков (setDisableAll)
const disabledSets = computed(() => {
  const out: Record<string, Set<string>[]> = {};
  if (!card.value) return out;
  for (const [table, r] of Object.entries(card.value.rules || {})) {
    if (!r.disable || !Object.keys(r.disable).length) continue;
    out[table] = columns.value.map((_, ci) => disabledByRules(r.disable, ruleValues(card.value!, draft.value, table, ci)));
  }
  return out;
});
const isDisabled = (f: CardField, ci: number) => Boolean(disabledSets.value[f.table.toLowerCase()]?.[ci]?.has(f.field.toLowerCase()));
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

// Значения по таблицам → черновик колонки (с подписями списков)
const fillColumn = (column: number, values: CardValues, valueTitles: CardValues = {}) => {
  if (!card.value) return;
  const t = { ...titles.value };
  for (const [table, fields] of Object.entries(values)) {
    const { draft: next, applied } = applyFieldValues(card.value, draft.value, table, column, fields);
    draft.value = next;
    const tt = Object.fromEntries(Object.entries(valueTitles[table] ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
    for (const key of applied) {
      const field = key.slice(key.lastIndexOf(':') + 1);
      if (field in tt) t[key] = tt[field] == null ? null : String(tt[field]);
    }
  }
  titles.value = t;
};

// --- как у соседнего ---
const neighborLoading = ref(false);
const fillFromNeighbor = async () => {
  if (!card.value || card.value.batch) return;
  neighborLoading.value = true;
  try {
    const res = await fastApiService.getCardNeighbor(props.kind, props.objectId);
    const before = changes.value.length;
    const from = new Set<number>();
    res.columns.forEach((c, ci) => {
      if (!c.neighbor_id) return;
      from.add(c.neighbor_id);
      fillColumn(ci, c.values, c.titles);
    });
    const notify = useNotificationStore();
    const diff = changes.value.length - before;
    const who = kindText.value.of;
    if (!from.size) notify.showWarning(kindText.value.neighborMissing);
    else if (!diff) notify.showInfo(`Значения уже как у ${who} ${[...from].join(', ')}`);
    else notify.showInfo(`Как у ${who} ${[...from].join(', ')}: изменено полей ${diff} (подсвечены). Проверьте и сохраните.`);
  } catch (e) {
    useNotificationStore().showError(formatApiError(e, 'Не удалось получить значения соседнего объекта'));
  } finally {
    neighborLoading.value = false;
  }
};

// --- шаблоны ---
const authStore = useAuthStore();
const currentUser = computed(() => authStore.username || null);
const templates = ref<CardTemplate[]>([]);
const templatesLoading = ref(false);
const loadTemplates = async () => {
  templatesLoading.value = true;
  try {
    templates.value = (await fastApiService.listCardTemplates(props.kind)).items;
  } catch (e) {
    useNotificationStore().showError(formatApiError(e, 'Не удалось загрузить шаблоны'));
  } finally {
    templatesLoading.value = false;
  }
};
const templateSubtitle = (t: CardTemplate) => {
  const n = Object.values(t.values).reduce((acc, f) => acc + Object.keys(f).length, 0);
  return `полей: ${n}${t.shared ? ' · общий' : ''}${t.author && t.author !== currentUser.value ? ` · ${t.author}` : ''}`;
};
const applyTemplate = (t: CardTemplate) => {
  const before = changes.value.length;
  columns.value.forEach((_, ci) => { fillColumn(ci, t.values, t.titles ?? {}); });
  const diff = changes.value.length - before;
  useNotificationStore().showInfo(diff
    ? `Шаблон «${t.name}»: изменено полей ${diff} (подсвечены). Проверьте и ${card.value?.batch ? 'примените' : 'сохраните'}.`
    : `Шаблон «${t.name}»: значения уже такие`);
};
const removeTemplate = async (t: CardTemplate) => {
  if (!(await confirmAction({ text: `Удалить шаблон «${t.name}»?`, action: 'Удалить' }))) return;
  try {
    await fastApiService.deleteCardTemplate(t.id);
    templates.value = templates.value.filter((x) => x.id !== t.id);
  } catch (e) {
    useNotificationStore().showError(formatApiError(e, 'Не удалось удалить шаблон'));
  }
};

const saveTplOpen = ref(false);
const tplName = ref('');
const tplShared = ref(false);
const tplColumn = ref(0);
const tplPicked = ref<string[]>([]);
const tplSaving = ref(false);
const tplCandidates = computed(() => (card.value ? columnValues(card.value, draft.value, tplColumn.value) : []));
watch(tplCandidates, (list) => {
  // поля, которые есть в выбранной колонке, — отмечены по умолчанию
  if (saveTplOpen.value) tplPicked.value = list.map((it) => `${it.table}.${it.field}`);
});
const openSaveTemplate = () => {
  tplName.value = '';
  tplShared.value = false;
  tplColumn.value = 0;
  saveTplOpen.value = true;
  tplPicked.value = tplCandidates.value.map((it) => `${it.table}.${it.field}`);
};
const saveTemplate = async () => {
  const values: CardValues = {};
  const picked = new Set(tplPicked.value);
  for (const it of tplCandidates.value) {
    if (!picked.has(`${it.table}.${it.field}`)) continue;
    (values[it.table] ??= {})[it.field] = it.value;
  }
  tplSaving.value = true;
  try {
    const t = await fastApiService.createCardTemplate({ kind: props.kind, name: tplName.value.trim(), values, shared: tplShared.value });
    templates.value = [...templates.value, t];
    saveTplOpen.value = false;
    useNotificationStore().showSuccess(`Шаблон «${t.name}» сохранён`);
  } catch (e) {
    useNotificationStore().showError(formatApiError(e, 'Не удалось сохранить шаблон'));
  } finally {
    tplSaving.value = false;
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
  if (f.edit?.fun_name === 'schemeNum') {
    schemeTarget.value = { table: f.table, column: ci };
    schemeCurrent.value = values.schemenum == null ? '' : String(values.schemenum);
    schemeOpen.value = true;
    return;
  }
  helperTarget.value = { table: f.table, column: ci };
  helperMestnText.value = values.mestn ?? null;
  helperData.value = null;
  helperError.value = '';
  helperLoading.value = true;
  helperOpen.value = true;
  try {
    const sid = Number(values.standardid);
    const h = await fastApiService.getCardHelper({
      table: f.table, field: f.field, standard_id: Number.isFinite(sid) && sid > 0 ? sid : null,
    });
    // коэффициент смешения источника — по температурам из его карточки (fun_uf)
    if (h.type === 'uf' && h.from) {
      for (const k of ['t1', 't2', 't3'] as const) {
        const v = Number(values[h.from[k]]);
        if (Number.isFinite(v) && v !== 0) h[k] = v;
      }
    }
    helperData.value = h;
  } catch (e) {
    helperError.value = formatApiError(e, 'Не удалось загрузить данные');
  } finally {
    helperLoading.value = false;
  }
};

// --- схема присоединения потребителя (fun_schemeNum): номер и перенос нагрузок ---
const schemeOpen = ref(false);
const schemeCurrent = ref('');
const schemeTarget = ref<{ table: string; column: number } | null>(null);
const applyScheme = (scheme: string) => {
  if (!card.value || !schemeTarget.value || scheme === schemeCurrent.value) return;
  const { table, column } = schemeTarget.value;
  const values = ruleValues(card.value, draft.value, table, column);
  const before = changes.value.length;
  draft.value = applyFieldValues(card.value, draft.value, table, column,
    schemeChangeValues(values, values.schemenum, scheme)).draft;
  useNotificationStore().showInfo(`Схема ${scheme}: нагрузки перенесены в поля новой схемы, `
    + `изменено полей ${changes.value.length - before}. Проверьте и сохраните.`);
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

// --- несколько участков (узлов): предпросмотр и применение ---
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
      kind: props.kind, ids: props.batchIds, changes: batchChanges.value, expected_changes: preview.value.changes,
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
      preview.value = await fastApiService.previewCardBatch({ kind: props.kind, ids: props.batchIds, changes: batchChanges.value });
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
    emit('saved', { changed, operationId: res.operation_id ?? null });
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
.oce-fill {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 2px 6px;
  flex-shrink: 0;
}
.oce-tpl-row :deep(.v-selection-control) {
  min-height: 28px;
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
