<template>
  <v-dialog
    v-model="visible"
    :fullscreen="mobile"
    :max-width="mobile ? undefined : 1000"
    scrollable
  >
    <v-card :rounded="mobile ? '0' : 'lg'">
      <v-card-title class="d-flex align-center ga-2 py-2">
        <v-icon>mdi-select-group</v-icon>
        Групповые установщики
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" density="compact" aria-label="Закрыть" @click="visible = false" />
      </v-card-title>

      <v-card-text class="pt-0">
        <v-alert v-if="!canEditData" type="info" variant="tonal" density="compact" class="mb-3">
          Предпросмотр доступен редактору; применение — при включённой записи на сервере (MUTATIONS_ENABLED).
        </v-alert>
        <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-3" closable @click:close="error = ''">
          {{ error }}
        </v-alert>

        <!-- 1. Установщик -->
        <div class="text-subtitle-2 mb-1">1. Что установить</div>
        <v-autocomplete
          v-model="setterKey"
          :items="setterItems"
          item-title="title"
          item-value="value"
          label="Установщик"
          variant="outlined"
          density="compact"
          :loading="loadingList"
          hide-details
          class="mb-2"
        >
          <template #item="{ props: itemProps, item }">
            <v-list-item v-bind="itemProps" :subtitle="item.raw.subtitle" />
          </template>
        </v-autocomplete>

        <template v-if="setter">
          <div class="text-caption text-medium-emphasis mb-2">
            {{ setter.target_label }} · пишется: {{ setter.writes.join(', ') }} · десктоп: {{ setter.desktop }}
            <span v-if="setter.note"><br>{{ setter.note }}</span>
          </div>
          <v-alert v-if="setter.affects_calc" type="warning" variant="tonal" density="compact" class="mb-2">
            Поле участвует в гидравлическом расчёте — после изменения пересчитайте режим.
          </v-alert>

          <div class="d-flex flex-wrap ga-2 align-start mb-3">
            <div style="flex: 1 1 320px; min-width: 240px;">
              <SetterValueInput
                v-if="setter.kind !== 'computed'"
                v-model="value"
                :setter="setter"
                :fragment-ids="selectionFragmentIds"
                label="Новое значение"
              />
              <v-alert v-else type="info" variant="tonal" density="compact">
                {{ setter.key === 'length' ? 'Значение вычисляется для каждого объекта (длина по геометрии участка).' : 'Значение не задаётся: поля очищаются.' }}
              </v-alert>
            </div>
          </div>

          <!-- 2. Набор объектов -->
          <div class="text-subtitle-2 mb-1">2. Для каких объектов</div>
          <v-btn-toggle v-model="draft.mode" mandatory density="compact" color="primary" variant="outlined" class="mb-2 flex-wrap">
            <v-btn value="fragment" prepend-icon="mdi-layers-outline">Фрагмент</v-btn>
            <v-btn value="map" prepend-icon="mdi-cursor-default-click-outline">Выбрать на карте</v-btn>
            <v-btn value="filter" prepend-icon="mdi-filter-outline">Фильтр</v-btn>
          </v-btn-toggle>

          <v-autocomplete
            v-if="draft.mode !== 'map'"
            v-model="draft.fragmentIds"
            :items="fragmentItems"
            item-title="title"
            item-value="value"
            :label="draft.mode === 'fragment' ? 'Фрагменты' : 'Фрагменты (необязательно)'"
            multiple
            chips
            closable-chips
            variant="outlined"
            density="compact"
            hide-details
            class="mb-2"
          />

          <div v-if="draft.mode === 'map'" class="d-flex flex-wrap align-center ga-2 mb-2">
            <v-btn prepend-icon="mdi-cursor-default-click-outline" color="orange-darken-3" variant="tonal" @click="pickOnMap">
              {{ draft.pickedIds.length ? 'Изменить выбор' : 'Выбрать' }} {{ pickKind === 'node' ? 'узлы' : 'участки' }}
            </v-btn>
            <v-chip v-if="draft.pickedIds.length" closable @click:close="draft.pickedIds = []">
              Выбрано: {{ draft.pickedIds.length }}
            </v-chip>
            <span class="text-caption text-medium-emphasis">
              {{ pickKind === 'node' ? 'Кликайте по узлам потребителей' : 'Кликайте по участкам' }}; «Готово» вернёт к диалогу.
            </span>
          </div>

          <template v-if="draft.mode === 'filter'">
            <v-checkbox
              v-model="draft.useBbox"
              density="compact"
              hide-details
              label="Только в видимой области карты (как «Выделить область» десктопа)"
            />
            <div v-for="(cond, idx) in draft.conditions" :key="idx" class="d-flex flex-wrap ga-2 align-start mb-2">
              <v-select
                v-model="cond.field"
                :items="filterFieldItems"
                item-title="title"
                item-value="value"
                label="Поле"
                variant="outlined"
                density="compact"
                hide-details
                style="flex: 1 1 220px;"
                @update:model-value="cond.value = null"
              />
              <v-select
                v-model="cond.op"
                :items="opItems"
                label="Условие"
                variant="outlined"
                density="compact"
                hide-details
                style="flex: 0 1 150px;"
              />
              <div v-if="cond.op === 'eq' && settersByKey[cond.field]" style="flex: 1 1 220px;">
                <SetterValueInput
                  v-model="cond.value"
                  :setter="filterSetter(cond.field)"
                  :fragment-ids="draft.fragmentIds"
                  label="Значение"
                />
              </div>
              <v-btn icon="mdi-delete" variant="text" density="compact" aria-label="Удалить условие" @click="draft.conditions.splice(idx, 1)" />
            </div>
            <v-btn size="small" variant="text" prepend-icon="mdi-plus" :disabled="!filterFieldItems.length" @click="addCondition">
              Условие по полю
            </v-btn>
          </template>

          <!-- 3. Предпросмотр -->
          <div class="d-flex flex-wrap ga-2 mt-3">
            <v-btn color="primary" variant="tonal" prepend-icon="mdi-magnify" :loading="previewing" :disabled="!canPreview" @click="runPreview">
              Предпросмотр
            </v-btn>
            <v-btn
              color="deep-orange-darken-2"
              variant="flat"
              prepend-icon="mdi-check"
              :loading="applying"
              :disabled="!preview || !preview.changes || !canEditData || previewStale"
              @click="runApply"
            >
              Применить
            </v-btn>
          </div>

          <div v-if="preview" class="mt-3">
            <v-alert v-if="previewStale" type="warning" variant="tonal" density="compact" class="mb-2">
              Параметры изменились — повторите предпросмотр.
            </v-alert>
            <div class="text-body-2 mb-1">
              Объектов: <b>{{ preview.objects }}</b> · изменится строк: <b>{{ preview.changes }}</b>
              <span v-if="preview.value_label"> · значение «{{ preview.value_label }}»</span>
            </div>
            <div class="text-caption text-medium-emphasis mb-1">
              <span v-for="(t, name) in preview.by_table" :key="name" class="me-3">{{ name }}: {{ t.changes }} из {{ t.rows }}</span>
            </div>
            <div v-if="!preview.changes" class="text-body-2 text-medium-emphasis mb-2">
              Изменять нечего: у всех объектов набора уже это значение.
            </div>
            <v-alert v-if="preview.missing_ids.length" type="info" variant="tonal" density="compact" class="mb-2">
              Не подходят для установщика (нет объекта, удалён или не {{ setter.target_label.toLowerCase() }}):
              {{ preview.missing_ids.slice(0, 20).join(', ') }}<span v-if="preview.missing_ids.length > 20"> …</span>
            </v-alert>
            <v-alert v-for="w in preview.warnings.filter((x) => !x.startsWith('Поле используется'))" :key="w" type="warning" variant="tonal" density="compact" class="mb-2">
              {{ w }}
            </v-alert>
            <v-table v-if="preview.sample?.length" density="compact" class="sample-table">
              <thead>
                <tr>
                  <th>Объект</th>
                  <th>Таблица</th>
                  <th>Было → станет</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in preview.sample" :key="`${row.table}-${row.row_id}`">
                  <td>{{ row.name || '—' }} <span class="text-medium-emphasis">#{{ row.object_id }}</span></td>
                  <td class="text-caption">{{ row.table }}</td>
                  <td class="text-caption">{{ describeChange(row.old, row.new) }}</td>
                </tr>
              </tbody>
            </v-table>
            <div v-if="preview.sample_truncated" class="text-caption text-medium-emphasis">
              Показаны первые {{ preview.sample?.length }} изменений.
            </div>
          </div>
        </template>

        <v-alert v-if="lastResult" type="success" variant="tonal" density="compact" class="mt-3">
          <div>
            «{{ lastResult.label }}»: изменено {{ lastResult.changed }} строк.
            Группа изменений {{ lastResult.change_group_id }} (История правок).
          </div>
          <v-btn
            class="mt-2"
            size="small"
            variant="outlined"
            prepend-icon="mdi-undo"
            :loading="undoing"
            :disabled="!canEditData || lastUndone"
            @click="runUndo"
          >
            {{ lastUndone ? 'Отменено' : 'Отменить операцию' }}
          </v-btn>
        </v-alert>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useDisplay } from 'vuetify';
import SetterValueInput from '~/components/SetterValueInput.vue';
import { useJournalMapBridge } from '~/composables/useJournalMapBridge';
import {
  groupSettersService,
  type GroupSetterApplyResult,
  type GroupSetterInfo,
  type GroupSetterPreview,
  type GroupSettersResponse,
} from '~/services/groupSettersService';
import { useAuthStore } from '~/stores/authStore';
import { useFragmentStore } from '~/stores/fragmentStore';
import { useMapStore } from '~/stores/mapStore';
import { useNotificationStore } from '~/stores/notificationStore';
import {
  apiErrorText,
  buildSelection,
  describeChange,
  groupSetters,
  parseSetterValue,
  pickKindForTarget,
  type SelectionDraft,
} from '~/utils/groupSetters';

const { mobile } = useDisplay();
const authStore = useAuthStore();
const fragmentStore = useFragmentStore();
const mapStore = useMapStore();
const bridge = useJournalMapBridge();

const visible = ref(false);
const loadingList = ref(false);
const previewing = ref(false);
const applying = ref(false);
const undoing = ref(false);
const error = ref('');
const catalog = ref<GroupSettersResponse | null>(null);
const setterKey = ref<string | null>(null);
const value = ref<unknown>(null);
const preview = ref<GroupSetterPreview | null>(null);
const previewKey = ref('');
const lastResult = ref<GroupSetterApplyResult | null>(null);
const lastUndone = ref(false);

const draft = reactive<SelectionDraft>({
  mode: 'fragment',
  fragmentIds: [],
  pickedIds: [],
  useBbox: true,
  bbox: null,
  conditions: [],
});

const canEditData = computed(() => authStore.canEditData);
const settersByKey = computed<Record<string, GroupSetterInfo>>(() =>
  Object.fromEntries((catalog.value?.setters || []).map((s) => [s.key, s])),
);
const setter = computed(() => (setterKey.value ? settersByKey.value[setterKey.value] || null : null));
const pickKind = computed(() => (setter.value ? pickKindForTarget(setter.value.target) : 'line'));

const setterItems = computed(() => {
  const out: Array<{ title: string; value: string; subtitle: string }> = [];
  for (const g of groupSetters(catalog.value?.setters || [])) {
    for (const s of g.items) out.push({ title: s.label, value: s.key, subtitle: `${g.group} · ${s.desktop}` });
  }
  return out;
});

const fragmentItems = computed(() =>
  (fragmentStore.fragments || []).map((f: any) => ({ title: `${f.name} (${f.id})`, value: Number(f.id) })),
);

const filterFieldItems = computed(() => {
  if (!setter.value || !catalog.value) return [];
  const keys = catalog.value.targets[setter.value.target]?.filter_fields || [];
  return keys.map((k) => ({ title: settersByKey.value[k]?.field_label || k, value: k }));
});

const opItems = [
  { title: 'равно', value: 'eq' },
  { title: 'не заполнено', value: 'null' },
  { title: 'заполнено', value: 'not_null' },
];

/** Для фильтра диаметр — число (условный диаметр), а не строка сортамента */
const filterSetter = (key: string): GroupSetterInfo => {
  const s = settersByKey.value[key];
  if (s.key === 'diameter') return { ...s, kind: 'float', min: null, max: null, field_label: 'Ду, мм' };
  if (s.kind === 'float') return { ...s, min: null, max: null };
  return s;
};

const selectionFragmentIds = computed(() => (draft.mode === 'map' ? [] : draft.fragmentIds));

const currentBbox = (): [number, number, number, number] | null => {
  const map: any = mapStore.map;
  if (!map?.getBounds) return null;
  const b = map.getBounds();
  const clamp = (v: number, lim: number) => Math.max(-lim, Math.min(lim, v));
  return [clamp(b.getWest(), 180), clamp(b.getSouth(), 90), clamp(b.getEast(), 180), clamp(b.getNorth(), 90)];
};

const requestKey = () => JSON.stringify({ k: setterKey.value, v: value.value, d: { ...draft, bbox: null } });
const previewStale = computed(() => Boolean(preview.value) && previewKey.value !== requestKey());
const canPreview = computed(() => Boolean(setter.value) && authStore.canEdit);

const addCondition = () => {
  draft.conditions.push({ field: filterFieldItems.value[0]?.value || '', op: 'eq', value: null });
};

const selectionOrError = () => {
  draft.bbox = draft.mode === 'filter' && draft.useBbox ? currentBbox() : null;
  return buildSelection(draft);
};

const runPreview = async () => {
  if (!setter.value) return;
  error.value = '';
  const parsed = parseSetterValue(setter.value, value.value);
  if ('error' in parsed) {
    error.value = parsed.error;
    return;
  }
  const selection = selectionOrError();
  if (typeof selection === 'string') {
    error.value = selection;
    return;
  }
  previewing.value = true;
  try {
    preview.value = await groupSettersService.preview(setter.value.key, selection, parsed.value);
    previewKey.value = requestKey();
    lastSelection = selection;
    lastValue = parsed.value;
  } catch (e: any) {
    preview.value = null;
    error.value = apiErrorText(e, 'Не удалось выполнить предпросмотр');
  } finally {
    previewing.value = false;
  }
};

let lastSelection: ReturnType<typeof buildSelection> | null = null;
let lastValue: unknown = null;

const runApply = async () => {
  if (!setter.value || !preview.value || !lastSelection || typeof lastSelection === 'string') return;
  const p = preview.value;
  const text = `${setter.value.label}\n\nБудет изменено строк: ${p.changes} (объектов в наборе: ${p.objects}).`
    + (setter.value.affects_calc ? '\nПоле участвует в расчёте.' : '')
    + '\n\nПрименить?';
  if (!confirm(text)) return;
  applying.value = true;
  error.value = '';
  try {
    lastResult.value = await groupSettersService.apply(setter.value.key, lastSelection, lastValue, p.changes);
    lastUndone.value = false;
    useNotificationStore().showSuccess(`Изменено строк: ${lastResult.value.changed}`);
    preview.value = null;
  } catch (e: any) {
    error.value = apiErrorText(e, 'Не удалось применить');
    if (e?.status === 409) preview.value = null;
  } finally {
    applying.value = false;
  }
};

const runUndo = async () => {
  if (!lastResult.value) return;
  undoing.value = true;
  error.value = '';
  try {
    const dry = await groupSettersService.undo(lastResult.value.change_group_id, true);
    const conflictText = dry.conflicts.length
      ? `\nСтрок, изменённых после операции (останутся как есть): ${dry.conflicts.length}.`
      : '';
    if (!confirm(`Вернуть прежние значения для ${dry.restorable} строк?${conflictText}`)) return;
    const res = await groupSettersService.undo(lastResult.value.change_group_id, false);
    lastUndone.value = true;
    useNotificationStore().showSuccess(`Восстановлено строк: ${res.restorable}`);
  } catch (e: any) {
    error.value = apiErrorText(e, 'Не удалось отменить операцию');
  } finally {
    undoing.value = false;
  }
};

const pickOnMap = async () => {
  if (!setter.value) return;
  visible.value = false;
  const ids = await bridge.startPick(draft.pickedIds, setter.value.label, pickKind.value);
  if (ids) draft.pickedIds = ids;
  visible.value = true;
};

watch(setterKey, () => {
  value.value = setter.value?.default ?? null;
  preview.value = null;
  if (draft.conditions.length) draft.conditions = [];
});

watch(() => setter.value?.target, (target, before) => {
  if (before && target !== before) draft.pickedIds = [];
});

const loadCatalog = async () => {
  if (catalog.value) return;
  loadingList.value = true;
  try {
    catalog.value = await groupSettersService.list();
  } catch (e: any) {
    error.value = apiErrorText(e, 'Не удалось загрузить установщики');
  } finally {
    loadingList.value = false;
  }
};

const openDialog = () => {
  visible.value = true;
  if (!draft.fragmentIds.length && fragmentStore.visibleFragments.length) {
    draft.fragmentIds = [...fragmentStore.visibleFragments];
  }
  if (!fragmentStore.fragments.length) fragmentStore.loadFragments();
  loadCatalog();
};

defineExpose({ openDialog });
</script>

<style scoped>
.sample-table {
  max-height: 320px;
  overflow-y: auto;
}
</style>
