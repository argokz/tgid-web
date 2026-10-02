<template>
  <v-dialog
    v-model="visible"
    :fullscreen="mobile"
    :max-width="mobile ? undefined : 1200"
    scrollable
  >
    <v-card :rounded="mobile ? '0' : 'lg'">
      <v-card-title class="d-flex align-center ga-2 py-2">
        <v-icon>mdi-book-open-page-variant-outline</v-icon>
        Справочники
        <v-spacer />
        <v-btn
          icon="mdi-refresh"
          variant="text"
          density="compact"
          :loading="loading"
          aria-label="Обновить"
          @click="loadRows"
        />
        <v-btn
          icon="mdi-close"
          variant="text"
          density="compact"
          aria-label="Закрыть"
          @click="visible = false"
        />
      </v-card-title>

      <v-card-text class="pt-0">
        <v-alert
          v-if="error"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-2"
          closable
          @click:close="error = ''"
        >
          {{ error }}
          <ul
            v-if="errorUsage?.by?.length"
            class="mt-1 ms-4"
          >
            <li
              v-for="u in errorUsage.by"
              :key="`${u.table}.${u.column}`"
            >{{ u.label }} ({{ u.table }}.{{ u.column }}): {{ u.count }}</li>
          </ul>
        </v-alert>

        <div class="d-flex flex-wrap ga-2 mb-2">
          <v-select
            v-model="dictKey"
            :items="dictionaries"
            item-title="label"
            item-value="key"
            label="Справочник"
            variant="outlined"
            density="compact"
            hide-details
            :loading="loadingSchema"
            style="flex: 2 1 260px;"
          />
          <v-autocomplete
            v-if="info?.fragment_scoped"
            v-model="fragmentId"
            :items="fragmentItems"
            item-title="title"
            item-value="value"
            label="Фрагмент"
            variant="outlined"
            density="compact"
            hide-details
            clearable
            style="flex: 2 1 240px;"
          />
          <v-text-field
            v-model="search"
            label="Поиск"
            prepend-inner-icon="mdi-magnify"
            variant="outlined"
            density="compact"
            hide-details
            clearable
            style="flex: 1 1 200px;"
          />
          <v-btn
            color="primary"
            variant="tonal"
            prepend-icon="mdi-plus"
            :disabled="!info || !canEditData"
            @click="openEditor(null)"
          >
            Добавить
          </v-btn>
        </div>

        <template v-if="info">
          <v-alert
            v-if="info.affects_calc"
            type="warning"
            variant="tonal"
            density="compact"
            class="mb-2"
          >
            Справочник используется в гидравлическом расчёте — после правки пересчитайте режим.
            <span v-if="info.note"><br>{{ info.note }}</span>
          </v-alert>
          <div
            v-else-if="info.note"
            class="text-caption text-medium-emphasis mb-2"
          >{{ info.note }}</div>
          <div class="text-caption text-medium-emphasis mb-2">
            Таблица {{ info.table }} · ссылки: {{ info.usages.join(', ') || '—' }}
          </div>

          <v-data-table-server
            v-model:page="page"
            v-model:items-per-page="itemsPerPage"
            :headers="headers"
            :items="rows"
            :items-length="total"
            :loading="loading"
            density="compact"
            class="dict-table"
            fixed-header
            height="420"
            @update:options="loadRows"
          >
            <template #[`item.__actions`]="{ item }">
              <div class="d-flex ga-1">
                <v-btn
                  icon="mdi-pencil"
                  size="small"
                  variant="text"
                  density="compact"
                  aria-label="Изменить"
                  @click="openEditor(item)"
                />
                <v-btn
                  icon="mdi-delete"
                  size="small"
                  variant="text"
                  density="compact"
                  color="error"
                  aria-label="Удалить"
                  :disabled="!canEditData"
                  @click="removeRow(item)"
                />
              </div>
            </template>
          </v-data-table-server>
        </template>
      </v-card-text>
    </v-card>

    <v-dialog
      v-model="editorOpen"
      max-width="720"
      scrollable
    >
      <v-card>
        <v-card-title class="py-2">
          {{ editing ? `${info?.label}: запись ${editing.id}` : `${info?.label}: новая запись` }}
        </v-card-title>
        <v-card-text>
          <v-alert
            v-if="usage && usage.total"
            type="info"
            variant="tonal"
            density="compact"
            class="mb-3"
          >
            Используется: {{ usage.by.map((u) => `${u.label} — ${u.count}`).join('; ') }}
          </v-alert>
          <div class="editor-grid">
            <template
              v-for="f in info?.fields || []"
              :key="f.column"
            >
              <v-select
                v-if="f.lookup"
                v-model="form[f.column]"
                :items="lookupItems(f.column, f.lookup)"
                item-title="title"
                item-value="value"
                :label="fieldLabel(f)"
                variant="outlined"
                density="compact"
                hide-details="auto"
                clearable
                :readonly="!canEditData"
              />
              <v-checkbox
                v-else-if="f.kind === 'bool'"
                v-model="form[f.column]"
                :label="fieldLabel(f)"
                density="compact"
                hide-details
                :readonly="!canEditData"
              />
              <v-text-field
                v-else
                v-model="form[f.column]"
                :label="fieldLabel(f)"
                :type="f.kind === 'date' ? 'date' : 'text'"
                :inputmode="f.kind === 'int' || f.kind === 'float' ? 'decimal' : undefined"
                :maxlength="f.max_length || undefined"
                variant="outlined"
                density="compact"
                hide-details="auto"
                :readonly="!canEditData"
              />
            </template>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="editorOpen = false"
          >Отмена</v-btn>
          <v-btn
            color="primary"
            variant="flat"
            prepend-icon="mdi-content-save"
            :loading="saving"
            :disabled="!canEditData"
            @click="save"
          >
            Сохранить
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-dialog>
</template>

<script setup lang="ts">
import { confirmAction } from '~/composables/useConfirm'
import { computed, reactive, ref, watch } from 'vue';
import { useMobile } from '~/composables/useMobile';
import {
  groupSettersService,
  type DictFieldInfo,
  type DictionaryInfo,
  type DictRow,
  type DictUsage,
} from '~/services/groupSettersService';
import { useAuthStore } from '~/stores/authStore';
import { useFragmentStore } from '~/stores/fragmentStore';
import { useNotificationStore } from '~/stores/notificationStore';
import { apiErrorText, dictionaryPayload, formatCell } from '~/utils/groupSetters';

const { isMobile: mobile } = useMobile();
const authStore = useAuthStore();
const fragmentStore = useFragmentStore();

const visible = ref(false);
const loading = ref(false);
const loadingSchema = ref(false);
const saving = ref(false);
const error = ref('');
const errorUsage = ref<DictUsage | null>(null);
const dictionaries = ref<DictionaryInfo[]>([]);
const dictKey = ref<string | null>(null);
const fragmentId = ref<number | null>(null);
const search = ref('');
const rows = ref<DictRow[]>([]);
const total = ref(0);
const page = ref(1);
const itemsPerPage = ref(50);

const editorOpen = ref(false);
const editing = ref<DictRow | null>(null);
const usage = ref<DictUsage | null>(null);
const form = reactive<Record<string, any>>({});

const canEditData = computed(() => authStore.canEditData);
const info = computed(() => dictionaries.value.find((d) => d.key === dictKey.value) || null);
const fragmentItems = computed(() =>
  (fragmentStore.fragments || []).map((f: any) => ({ title: `${f.name} (${f.id})`, value: Number(f.id) })),
);

const headers = computed(() => {
  const fields = info.value?.fields || [];
  const cols = fields.slice(0, 8).map((f) => ({
    title: f.label,
    key: f.column,
    sortable: false,
    value: (row: Record<string, any>) => formatCell(row[f.column]),
  }));
  return [{ title: 'id', key: 'id', sortable: false, width: 70 }, ...cols, { title: '', key: '__actions', sortable: false, width: 80 }];
});

const fieldLabel = (f: DictFieldInfo) => `${f.label}${f.required ? ' *' : ''}`;

const lookupItems = (column: string, lookup: string) => {
  if (lookup === 'fragments') return fragmentItems.value;
  return (info.value?.lookups[column] || []).map((x) => ({ title: x.name, value: x.id }));
};

let searchTimer: ReturnType<typeof setTimeout> | null = null;

const loadRows = async () => {
  if (!info.value) return;
  loading.value = true;
  error.value = '';
  try {
    const res = await groupSettersService.dictionaryRows(info.value.key, {
      q: search.value || undefined,
      fragmentId: info.value.fragment_scoped ? fragmentId.value : null,
      limit: itemsPerPage.value > 0 ? itemsPerPage.value : 500,
      offset: (page.value - 1) * (itemsPerPage.value > 0 ? itemsPerPage.value : 500),
    });
    rows.value = res.items;
    total.value = res.total;
  } catch (e: any) {
    error.value = apiErrorText(e, 'Не удалось загрузить справочник');
  } finally {
    loading.value = false;
  }
};

const reload = () => {
  page.value = 1;
  loadRows();
};

watch([dictKey, fragmentId], reload);
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(reload, 350);
});

const openEditor = async (row: DictRow | null) => {
  if (!info.value) return;
  editing.value = row;
  usage.value = null;
  for (const key of Object.keys(form)) delete form[key];
  for (const f of info.value.fields) form[f.column] = row ? row[f.column] ?? null : null;
  if (!row && info.value.fragment_scoped) form.fileid = fragmentId.value;
  editorOpen.value = true;
  if (row) {
    try {
      usage.value = (await groupSettersService.dictionaryRow(info.value.key, row.id)).usage;
    } catch {
      usage.value = null;
    }
  }
};

const save = async () => {
  if (!info.value) return;
  const payload = dictionaryPayload(form, editing.value);
  if (editing.value && !Object.keys(payload).length) {
    editorOpen.value = false;
    return;
  }
  saving.value = true;
  error.value = '';
  errorUsage.value = null;
  try {
    if (editing.value) {
      await groupSettersService.updateDictionaryRow(info.value.key, editing.value.id, payload);
    } else {
      await groupSettersService.createDictionaryRow(info.value.key, payload);
    }
    editorOpen.value = false;
    useNotificationStore().showSuccess('Сохранено');
    await loadRows();
  } catch (e: any) {
    const text = apiErrorText(e, 'Не удалось сохранить');
    useNotificationStore().showError?.(text);
    error.value = text;
    errorUsage.value = e?.data?.usage || null;
  } finally {
    saving.value = false;
  }
};

const removeRow = async (row: DictRow) => {
  if (!info.value) return;
  const label = row[info.value.label_column] ?? row.id;
  if (!(await confirmAction({ text: `Удалить запись «${label}» из справочника «${info.value.label}»?`, action: 'Удалить' }))) return;
  error.value = '';
  errorUsage.value = null;
  try {
    await groupSettersService.deleteDictionaryRow(info.value.key, row.id);
    useNotificationStore().showSuccess('Запись удалена');
    await loadRows();
  } catch (e: any) {
    error.value = apiErrorText(e, 'Не удалось удалить');
    errorUsage.value = e?.data?.usage || null;
  }
};

const loadSchema = async () => {
  if (dictionaries.value.length) return;
  loadingSchema.value = true;
  try {
    dictionaries.value = (await groupSettersService.dictionaries()).dictionaries;
    if (!dictKey.value && dictionaries.value.length) dictKey.value = dictionaries.value[0].key;
  } catch (e: any) {
    error.value = apiErrorText(e, 'Не удалось загрузить справочники');
  } finally {
    loadingSchema.value = false;
  }
};

const openDialog = (scope?: { dictionary?: string }) => {
  visible.value = true;
  if (!fragmentStore.fragments.length) fragmentStore.loadFragments();
  if (fragmentId.value === null && fragmentStore.visibleFragments.length === 1) {
    fragmentId.value = fragmentStore.visibleFragments[0];
  }
  if (scope?.dictionary) dictKey.value = scope.dictionary;
  loadSchema();
};

defineExpose({ openDialog });
</script>

<style scoped>
.editor-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
}
.dict-table :deep(td) {
  white-space: nowrap;
}
</style>
