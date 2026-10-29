<template>
  <v-dialog
    v-model="visible"
    :max-width="720"
    :fullscreen="isMobile"
    scrollable
  >
    <v-card>
      <v-card-title class="d-flex align-center py-3 px-4">
        <v-icon
          class="mr-2"
          color="primary"
        >
          mdi-database-search
        </v-icon>
        <span class="text-h6 flex-grow-1">Выборка по условиям</span>
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

        <!-- вопрос словами: ИИ заполняет конструктор, сервер проверяет и выполняет запрос -->
        <div
          v-if="authStore.canUseAi"
          class="d-flex align-start ga-2 mb-3"
        >
          <v-text-field
            v-model="question"
            label="Спросите словами"
            placeholder="например: бесканальные трубы Ду 400 и больше старше 1985 года в 500 м от 3-47"
            prepend-inner-icon="mdi-creation"
            density="compact"
            variant="outlined"
            hide-details
            maxlength="500"
            :disabled="asking"
            @keydown.enter.prevent="ask"
          />
          <v-btn
            color="primary"
            variant="tonal"
            :loading="asking"
            :disabled="question.trim().length < 2"
            @click="ask"
          >
            Спросить
          </v-btn>
        </div>
        <v-alert
          v-if="aiNote"
          type="info"
          variant="tonal"
          density="compact"
          class="mb-3"
        >
          {{ aiNote }}
        </v-alert>

        <SegmentedToggle
          :model-value="state.target"
          :items="targetItems"
          aria-label="Что выбрать"
          class="mb-3"
          @update:model-value="setTarget($event as SelectTarget)"
        />

        <!-- условия -->
        <div
          v-for="(row, index) in state.rows"
          :key="row.id"
          class="d-flex flex-wrap align-start ga-2 mb-2 select-row"
        >
          <AppSelect
            :model-value="row.field"
            :items="fieldItems"
            label="Поле"
            :clearable="false"
            class="select-row__field"
            @update:model-value="setField(index, $event as string)"
          />
          <AppSelect
            v-model="row.op"
            :items="opItems(row.field)"
            label="Условие"
            :clearable="false"
            :searchable="false"
            class="select-row__op"
          />
          <template v-if="opNeedsValue(row.op)">
            <AppSelect
              v-if="fieldOf(row.field)?.kind === 'category'"
              v-model="row.values"
              :items="fieldOf(row.field)?.choices ?? []"
              item-title="label"
              item-value="value"
              label="Значения"
              multiple
              class="select-row__value"
            />
            <template v-else>
              <v-text-field
                v-model="row.value"
                :label="row.op === 'between' ? 'от' : 'Значение'"
                :suffix="fieldOf(row.field)?.units"
                :inputmode="fieldOf(row.field)?.kind === 'number' ? 'decimal' : 'text'"
                density="compact"
                variant="outlined"
                hide-details
                class="select-row__num"
                @keydown.enter.prevent="run"
              />
              <v-text-field
                v-if="row.op === 'between'"
                v-model="row.value2"
                label="до"
                :suffix="fieldOf(row.field)?.units"
                inputmode="decimal"
                density="compact"
                variant="outlined"
                hide-details
                class="select-row__num"
                @keydown.enter.prevent="run"
              />
            </template>
          </template>
          <v-btn
            icon="mdi-close"
            variant="text"
            size="small"
            :aria-label="`Убрать условие ${index + 1}`"
            @click="state.rows.splice(index, 1)"
          />
        </div>
        <div class="d-flex flex-wrap align-center ga-2 mb-3">
          <v-btn
            prepend-icon="mdi-plus"
            variant="text"
            size="small"
            :disabled="!fieldItems.length || state.rows.length >= MAX_ROWS"
            @click="addRow"
          >
            Условие
          </v-btn>
          <SegmentedToggle
            v-if="state.rows.length > 1"
            v-model="state.match"
            :items="matchItems"
            aria-label="Как сочетать условия"
          />
        </div>

        <!-- где -->
        <div class="d-flex flex-wrap align-center ga-2">
          <v-checkbox
            v-model="state.nearOn"
            label="Рядом с узлом"
            density="compact"
            hide-details
          />
          <template v-if="state.nearOn">
            <v-text-field
              v-model="state.nearNode"
              label="Узел (имя или код)"
              density="compact"
              variant="outlined"
              hide-details
              class="select-row__field"
            />
            <v-text-field
              v-model.number="state.nearMeters"
              label="Радиус"
              suffix="м"
              type="number"
              :min="1"
              :max="fields?.max_near_m ?? 5000"
              density="compact"
              variant="outlined"
              hide-details
              class="select-row__num"
            />
          </template>
        </div>
        <div class="d-flex flex-wrap align-center ga-2 mb-2">
          <v-checkbox
            v-model="state.inView"
            label="В видимой области карты"
            density="compact"
            hide-details
          />
          <AppSelect
            v-model="state.scope"
            :items="scopeItems"
            label="Фрагменты"
            :clearable="false"
            :searchable="false"
            class="select-row__field"
          />
        </div>
        <div class="d-flex flex-wrap align-center ga-2 mb-3">
          <AppSelect
            v-model="state.orderBy"
            :items="orderItems"
            label="Порядок"
            placeholder="по номеру"
            persistent-placeholder
            class="select-row__field"
          />
          <SegmentedToggle
            v-if="state.orderBy && state.orderBy !== 'distance'"
            :model-value="state.orderDesc"
            :items="directionItems"
            aria-label="Направление"
            @update:model-value="state.orderDesc = $event as boolean"
          />
          <v-text-field
            v-model.number="state.limit"
            label="Не больше"
            type="number"
            :min="1"
            :max="fields?.max_limit ?? 5000"
            density="compact"
            variant="outlined"
            hide-details
            class="select-row__num"
          />
        </div>

        <div class="d-flex flex-wrap ga-2 mb-3">
          <v-btn
            color="primary"
            prepend-icon="mdi-magnify"
            :loading="loading"
            :disabled="!fields"
            @click="run"
          >
            Выбрать
          </v-btn>
          <v-btn
            variant="text"
            @click="reset"
          >
            Сбросить
          </v-btn>
        </div>

        <!-- результат -->
        <template v-if="result">
          <v-divider class="mb-3" />
          <div class="text-caption text-medium-emphasis">
            Запрос
          </div>
          <p class="text-body-2 mb-2 select-description">
            {{ result.description }}
          </p>
          <div class="d-flex flex-wrap align-center ga-2 mb-2">
            <span class="text-subtitle-2">{{ totalText }}</span>
            <v-spacer />
            <v-btn
              v-if="result.items.length"
              prepend-icon="mdi-download"
              variant="text"
              size="small"
              @click="downloadCsv"
            >
              CSV
            </v-btn>
            <v-btn
              v-if="overlayShown"
              variant="text"
              size="small"
              @click="clearMap"
            >
              Снять с карты
            </v-btn>
            <v-btn
              v-if="overlayShown"
              variant="tonal"
              size="small"
              @click="keepOnMap"
            >
              Оставить на карте
            </v-btn>
          </div>
          <v-list
            v-if="result.items.length"
            density="compact"
            class="select-list"
          >
            <v-list-item
              v-for="item in shownItems"
              :key="item.id"
              :title="item.title"
              :subtitle="itemSubtitle(item)"
              @click="focus(item)"
            >
              <template #append>
                <span class="text-caption text-medium-emphasis">#{{ item.id }}</span>
              </template>
            </v-list-item>
          </v-list>
          <p
            v-if="result.items.length > ITEMS_SHOWN"
            class="text-caption text-medium-emphasis mt-1"
          >
            В списке первые {{ ITEMS_SHOWN }}; все {{ result.items.length }} — на карте и в CSV.
          </p>
        </template>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AppSelect from '~/components/AppSelect.vue';
import HintTip from '~/components/HintTip.vue';
import SegmentedToggle from '~/components/SegmentedToggle.vue';
import { useDialogMapOverlay } from '~/composables/useDialogMapOverlay';
import { useMobile } from '~/composables/useMobile';
import { aiService } from '~/services/aiService';
import {
  fastApiService,
  type AiSelectResult,
  type SelectField,
  type SelectFields,
  type SelectItem,
  type SelectResult,
  type SelectTarget,
} from '~/services/fastApiService';
import { useAuthStore } from '~/stores/authStore';
import { useFragmentStore } from '~/stores/fragmentStore';
import { useMapStore } from '~/stores/mapStore';
import { formatApiError } from '~/utils/apiError';
import {
  buildSpec,
  builderFromSpec,
  emptyBuilder,
  formatNumber,
  formatValue,
  newRow,
  opNeedsValue,
  resultCsv,
  type BuilderState,
} from '~/utils/networkSelect';
import { downloadBlob } from '~/utils/printRender';

/**
 * Выборка объектов сети по условиям (п. 10 фазы 1): конструктор запроса и вопрос словами (помощник ИИ
 * заполняет тот же конструктор). Запрос выполняет сервер по белому списку полей и показывает его словами;
 * найденное — на карте (оверлей MapViewer) и в списке, выгрузка — CSV.
 */
const emit = defineEmits<{
  'show-on-map': [data: SelectResult];
  'clear-highlight': [];
  'focus-coords': [lng: number, lat: number];
}>();

const visible = defineModel<boolean>({ default: false });
const overlay = useDialogMapOverlay(visible, () => emit('clear-highlight'));
const { shown: overlayShown, keepOnMap } = overlay;
const { isMobile } = useMobile();
const authStore = useAuthStore();
const fragmentStore = useFragmentStore();
const mapStore = useMapStore();

const MAX_ROWS = 8;
/** Сколько строк показывать в списке (все — на карте и в CSV) */
const ITEMS_SHOWN = 200;

const fields = ref<SelectFields | null>(null);
const state = ref<BuilderState>(emptyBuilder());
const result = ref<SelectResult | null>(null);
const loading = ref(false);
const errorMessage = ref('');
const question = ref('');
const asking = ref(false);
const aiNote = ref('');

const visibleFragments = computed(() => fragmentStore.visibleFragments ?? []);

const targetItems = [
  { value: 'lines', label: 'Участки', icon: 'mdi-vector-polyline' },
  { value: 'nodes', label: 'Узлы', icon: 'mdi-circle-medium' },
];
const matchItems = [
  { value: 'all', label: 'Все условия' },
  { value: 'any', label: 'Любое' },
];
const directionItems = [
  { value: true, label: 'По убыванию' },
  { value: false, label: 'По возрастанию' },
];

const targetFields = computed<SelectField[]>(() =>
  fields.value?.targets.find((t) => t.key === state.value.target)?.fields ?? []);
const fieldOf = (key: string) => targetFields.value.find((f) => f.key === key);
const fieldItems = computed(() => targetFields.value.map((f) => ({
  value: f.key,
  title: f.units ? `${f.label}, ${f.units}` : f.label,
})));
const opItems = (key: string) => (fieldOf(key)?.ops ?? []).map((op) => ({
  value: op,
  title: fields.value?.op_labels[op] ?? op,
}));
const scopeItems = computed(() => {
  const items = [
    { value: 'visible', title: `На карте (${visibleFragments.value.length})` },
    { value: 'all', title: 'Все фрагменты' },
  ];
  if (state.value.scope === 'list') {
    items.push({ value: 'list', title: `Из запроса: ${state.value.fragments.join(', ')}` });
  }
  return items;
});
const orderItems = computed(() => [
  ...(state.value.nearOn ? [{ value: 'distance', title: 'Ближе к узлу' }] : []),
  ...targetFields.value.filter((f) => f.kind === 'number').map((f) => ({ value: f.key, title: f.label })),
]);

const setTarget = (target: SelectTarget) => {
  if (target === state.value.target) return;
  state.value = { ...state.value, target, rows: [], orderBy: null };
};

// «Рядом с узлом»: место задаёт узел (он может быть не во фрагментах на карте) — фрагменты «все»
watch(() => state.value.nearOn, (on, was) => {
  if (on && !was && state.value.scope === 'visible') state.value.scope = 'all';
});

const addRow = () => {
  const first = targetFields.value[0];
  if (first) state.value.rows.push(newRow(first));
};

const setField = (index: number, key: string) => {
  const field = fieldOf(key);
  if (field) state.value.rows[index] = newRow(field);
};

const currentBbox = (): [number, number, number, number] | null => {
  const map = mapStore.map as { getBounds?: () => { getWest(): number; getSouth(): number; getEast(): number; getNorth(): number } } | null;
  const b = map?.getBounds?.();
  if (!b) return null;
  const clamp = (v: number, lim: number) => Math.max(-lim, Math.min(lim, v));
  return [clamp(b.getWest(), 180), clamp(b.getSouth(), 90), clamp(b.getEast(), 180), clamp(b.getNorth(), 90)];
};

const show = (res: SelectResult) => {
  result.value = res;
  if (res.geojson?.features.length || res.near_center) {
    emit('show-on-map', res);
    overlay.markShown();
  } else {
    clearMap();
  }
};

const clearMap = () => {
  emit('clear-highlight');
  overlay.markCleared();
};

const run = async () => {
  if (!fields.value) return;
  loading.value = true;
  errorMessage.value = '';
  aiNote.value = '';
  try {
    const spec = buildSpec(state.value, targetFields.value, visibleFragments.value);
    show(await fastApiService.runNetworkSelect(spec, spec.in_view ? currentBbox() : null));
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Выборка не выполнена');
  } finally {
    loading.value = false;
  }
};

const ask = async () => {
  const text = question.value.trim();
  if (text.length < 2 || asking.value) return;
  asking.value = true;
  errorMessage.value = '';
  aiNote.value = '';
  try {
    const bbox = currentBbox();
    const res = await aiService.call<AiSelectResult>('select', {
      text,
      fragment_ids: visibleFragments.value,
      bbox: bbox ? bbox.map((v) => v.toFixed(5)).join(',') : null,
    });
    state.value = builderFromSpec(res.spec, visibleFragments.value);
    aiNote.value = [res.note, res.confidence > 0 && res.confidence < 0.6 ? 'проверьте условия' : '']
      .filter(Boolean).join(' — ');
    if (res.error) {
      errorMessage.value = `Запрос ИИ не прошёл проверку: ${res.error}. Поправьте условия и нажмите «Выбрать».`;
      return;
    }
    if (!res.description) {
      aiNote.value = aiNote.value || 'Вопрос не похож на выборку объектов сети — уточните его';
      return;
    }
    show(res as SelectResult);
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Вопрос не разобран');
  } finally {
    asking.value = false;
  }
};

const reset = () => {
  state.value = emptyBuilder(state.value.target);
  result.value = null;
  aiNote.value = '';
  question.value = '';
  clearMap();
};

const shownItems = computed(() => result.value?.items.slice(0, ITEMS_SHOWN) ?? []);

const totalText = computed(() => {
  const res = result.value;
  if (!res) return '';
  if (!res.total) return 'Ничего не найдено';
  const shown = res.truncated ? ` (показано ${res.items.length})` : '';
  const length = res.total_length_m ? ` · длина по паспорту ${formatNumber(res.total_length_m / 1000, 2)} км` : '';
  return `Найдено: ${res.total}${shown}${length}`;
});

const itemSubtitle = (item: SelectItem) => {
  const res = result.value;
  const parts = [item.fileid != null ? `фр. ${item.fileid}` : ''];
  if (item.card_type && item.card_type !== 'Узел') parts.push(item.card_type);
  if (item.distance_m !== undefined) parts.push(`${formatNumber(item.distance_m, 0)} м`);
  for (const c of res?.columns ?? []) {
    if (c.key === 'card_type') continue;
    parts.push(`${c.label}: ${formatValue(item.values[c.key])}${c.units && item.values[c.key] != null ? ` ${c.units}` : ''}`);
  }
  return parts.filter(Boolean).join(' · ');
};

const focus = (item: SelectItem) => {
  if (item.lon != null && item.lat != null) emit('focus-coords', item.lon, item.lat);
};

const downloadCsv = () => {
  const res = result.value;
  if (!res) return;
  const blob = new Blob([`\uFEFF${resultCsv(res)}`], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `Выборка_${res.target === 'lines' ? 'участки' : 'узлы'}_${Date.now()}.csv`);
};

const loadFields = async () => {
  try {
    fields.value = await fastApiService.getNetworkSelectFields();
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Не удалось загрузить поля выборки');
  }
};

watch(visible, (open) => {
  if (open && !fields.value) loadFields();
}, { immediate: true });

const openDialog = () => {
  visible.value = true;
};

defineExpose({ openDialog });
</script>

<style scoped>
.select-row__field { flex: 1 1 220px; min-width: 180px; }
.select-row__op { flex: 0 1 150px; min-width: 120px; }
.select-row__value { flex: 1 1 200px; min-width: 160px; }
.select-row__num { flex: 0 1 130px; min-width: 100px; }
.select-description { white-space: pre-wrap; }
.select-list { max-height: 320px; overflow-y: auto; }
</style>
