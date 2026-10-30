<template>
  <v-dialog
    v-model="visible"
    :max-width="760"
    :fullscreen="isMobile"
    scrollable
  >
    <v-card>
      <v-card-title class="d-flex align-center py-3 px-4">
        <v-icon
          class="mr-2"
          color="primary"
        >
          mdi-school-outline
        </v-icon>
        <span class="text-h6 flex-grow-1">Социальные объекты</span>
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
        <p class="text-body-2 mb-3">
          Школы, детские сады, больницы, поликлиники и соцучреждения — для выборок «в 500 м от школ» («Выборка по
          условиям») и списка социальных объектов в зоне отключения.
        </p>
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
        <v-alert
          v-if="resultText"
          type="success"
          variant="tonal"
          density="compact"
          class="mb-3"
          closable
          @click:close="resultText = ''"
        >
          {{ resultText }}
        </v-alert>

        <!-- категории -->
        <div class="d-flex flex-wrap ga-2 mb-2">
          <v-chip
            v-for="c in categoryRows"
            :key="c.id"
            :variant="selected.includes(c.id) ? 'tonal' : 'outlined'"
            :color="selected.includes(c.id) ? 'primary' : undefined"
            :aria-pressed="selected.includes(c.id)"
            @click="toggleCategory(c.id)"
          >
            <i
              class="poi-dot mr-2"
              :style="{ background: c.color }"
            />
            {{ c.title }} · {{ c.count }}
          </v-chip>
        </div>
        <div class="d-flex flex-wrap align-center ga-2 mb-4">
          <v-btn
            color="primary"
            variant="tonal"
            prepend-icon="mdi-map-marker-multiple-outline"
            :disabled="!selectedCount"
            :loading="showing"
            @click="showOnMap"
          >
            Показать на карте
          </v-btn>
          <v-btn
            v-if="shownOnMap"
            variant="text"
            @click="hideFromMap"
          >
            Убрать с карты
          </v-btn>
          <span
            v-if="!total && !loading"
            class="text-body-2 text-medium-emphasis"
          >Объектов ещё нет{{ authStore.isAdmin ? ' — загрузите их ниже' : ' — их загружает администратор' }}.</span>
        </div>

        <!-- загрузка (администратор) -->
        <v-expansion-panels
          v-if="authStore.isAdmin"
          class="mb-4"
        >
          <v-expansion-panel>
            <v-expansion-panel-title>
              <v-icon
                icon="mdi-file-upload-outline"
                size="small"
                class="mr-2"
              />
              Загрузить или обновить
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <div class="poi-source">
                <div>
                  <strong>Из потребителей сети</strong>
                  <p class="text-body-2 text-medium-emphasis mb-0">
                    По названиям: «Школа 23», «Д/С № 26», «Роддом N1», «Поликлиника №1». Корпуса и вводы одного здания —
                    один объект. Ошибочно найденные скройте в списке — повторный поиск их не вернёт.
                  </p>
                </div>
                <v-btn
                  variant="tonal"
                  prepend-icon="mdi-account-search-outline"
                  :loading="busy === 'consumers'"
                  :disabled="!!busy"
                  @click="refreshConsumers"
                >
                  Найти
                </v-btn>
              </div>
              <div class="poi-source">
                <div>
                  <strong>Из файла акимата</strong>
                  <p class="text-body-2 text-medium-emphasis mb-1">
                    GeoJSON (точки или контуры зданий) или CSV с колонками lon и lat в градусах. Категория — колонка
                    category («школа», «больница» …) или выбранная здесь. Повторная загрузка заменяет объекты этих
                    категорий из прошлого файла.
                  </p>
                  <div class="d-flex flex-wrap ga-2">
                    <v-select
                      v-model="fileCategory"
                      :items="categoryItems"
                      label="Категория, если в файле нет"
                      clearable
                      density="compact"
                      hide-details
                      class="poi-field"
                    />
                    <v-file-input
                      v-model="file"
                      label="Файл"
                      accept=".geojson,.json,.csv,.txt"
                      density="compact"
                      hide-details
                      prepend-icon=""
                      class="poi-field"
                    />
                  </div>
                </div>
                <v-btn
                  variant="tonal"
                  prepend-icon="mdi-file-upload-outline"
                  :loading="busy === 'file'"
                  :disabled="!!busy || !file"
                  @click="importFile"
                >
                  Загрузить
                </v-btn>
              </div>
              <div class="poi-source">
                <div>
                  <strong>Из OpenStreetMap</strong>
                  <p class="text-body-2 text-medium-emphasis mb-0">
                    Сервер ТГИД запросит у OpenStreetMap (Overpass API) школы, сады, больницы, поликлиники и
                    соцучреждения в охвате сети города. Нужен доступ сервера в интернет; займёт до минуты.
                  </p>
                </div>
                <v-btn
                  variant="tonal"
                  prepend-icon="mdi-earth"
                  :loading="busy === 'osm'"
                  :disabled="!!busy"
                  @click="importOsm"
                >
                  Загрузить
                </v-btn>
              </div>
              <div class="d-flex flex-wrap align-center ga-2 mt-2">
                <span class="text-body-2 text-medium-emphasis">Удалить всё из источника:</span>
                <v-btn
                  v-for="(label, key) in POI_SOURCE_LABELS"
                  :key="key"
                  size="small"
                  variant="text"
                  color="error"
                  :disabled="!!busy || !sourceCount(key)"
                  @click="deleteSource(key)"
                >
                  {{ label }} ({{ sourceCount(key) }})
                </v-btn>
              </div>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>

        <!-- список -->
        <div class="d-flex flex-wrap align-center ga-2 mb-2">
          <v-text-field
            v-model="query"
            label="Поиск по названию или адресу"
            prepend-inner-icon="mdi-magnify"
            density="compact"
            hide-details
            clearable
            class="poi-field"
          />
          <v-checkbox
            v-if="authStore.isAdmin"
            v-model="showHidden"
            label="Скрытые"
            density="compact"
            hide-details
          />
        </div>
        <v-progress-linear
          v-if="loading"
          indeterminate
          class="mb-2"
        />
        <p
          v-else-if="!items.length"
          class="text-body-2 text-medium-emphasis"
        >
          {{ showHidden ? 'Скрытых объектов нет.' : 'Ничего не найдено.' }}
        </p>
        <v-list
          v-else
          density="compact"
          class="py-0"
        >
          <v-list-item
            v-for="p in items"
            :key="p.id"
            class="px-0"
          >
            <template #prepend>
              <i
                class="poi-dot mr-3"
                :style="{ background: poiColor(p.category) }"
              />
            </template>
            <v-list-item-title>{{ p.name || '(без названия)' }}</v-list-item-title>
            <v-list-item-subtitle>
              {{ p.category_label }}<span v-if="p.address"> · {{ p.address }}</span> · {{ POI_SOURCE_LABELS[p.source] }}
            </v-list-item-subtitle>
            <template #append>
              <v-btn
                icon="mdi-crosshairs-gps"
                size="small"
                variant="text"
                :aria-label="`Показать на карте: ${p.name}`"
                @click="focus(p)"
              />
              <v-btn
                v-if="authStore.isAdmin"
                :icon="p.hidden ? 'mdi-eye-outline' : 'mdi-eye-off-outline'"
                size="small"
                variant="text"
                :aria-label="p.hidden ? `Вернуть: ${p.name}` : `Скрыть — не социальный объект: ${p.name}`"
                :loading="updating === p.id"
                @click="toggleHidden(p)"
              />
            </template>
          </v-list-item>
        </v-list>
        <p
          v-if="items.length >= LIST_LIMIT"
          class="text-caption text-medium-emphasis mt-1"
        >
          Показаны первые {{ LIST_LIMIT }} — уточните поиск.
        </p>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import HintTip from '~/components/HintTip.vue';
import { confirmAction } from '~/composables/useConfirm';
import { useMobile } from '~/composables/useMobile';
import { fastApiService } from '~/services/fastApiService';
import { useAuthStore } from '~/stores/authStore';
import { formatApiError } from '~/utils/apiError';
import {
  POI_CATEGORIES,
  POI_SOURCE_LABELS,
  fileFeatures,
  poiColor,
  type PoiCategory,
  type PoiImportResult,
  type PoiItem,
  type PoiSource,
  type PoiSummary,
} from '~/utils/poi';

/**
 * Социальные объекты (фаза 2): категории с числом объектов, показ на карте, загрузка из потребителей сети,
 * файла акимата и OpenStreetMap (администратор), список с поиском и «скрыть — не социальный объект».
 * API — itwin-api routers/poi.py.
 */
const visible = defineModel<boolean>({ default: false });
const emit = defineEmits<{
  'show-on-map': [data: GeoJSON.FeatureCollection];
  'clear-highlight': [];
  'focus-coords': [lng: number, lat: number];
}>();
const { isMobile } = useMobile();
const authStore = useAuthStore();

const LIST_LIMIT = 500;
const SEARCH_DEBOUNCE_MS = 300;

const summary = ref<PoiSummary | null>(null);
const items = ref<PoiItem[]>([]);
const selected = ref<PoiCategory[]>(POI_CATEGORIES.map((c) => c.id));
const query = ref('');
const showHidden = ref(false);
const loading = ref(false);
const showing = ref(false);
const shownOnMap = ref(false);
const busy = ref<'' | 'consumers' | 'file' | 'osm' | 'delete'>('');
const updating = ref<number | null>(null);
const errorMessage = ref('');
const resultText = ref('');
const file = ref<File | File[] | null>(null);
const fileCategory = ref<PoiCategory | null>(null);
let searchTimer: ReturnType<typeof setTimeout> | null = null;

const categoryRows = computed(() => POI_CATEGORIES.map((c) => ({
  ...c, count: summary.value?.categories.find((x) => x.id === c.id)?.count ?? 0,
})));
const categoryItems = POI_CATEGORIES.map((c) => ({ value: c.id, title: c.title }));
const total = computed(() => categoryRows.value.reduce((s, c) => s + c.count, 0));
const selectedCount = computed(() => categoryRows.value.filter((c) => selected.value.includes(c.id))
  .reduce((s, c) => s + c.count, 0));

const sourceCount = (source: PoiSource) => (summary.value?.categories ?? [])
  .reduce((s, c) => s + (c.by_source[source] ?? 0), 0);

const loadSummary = async () => {
  summary.value = await fastApiService.getPoiSummary();
};

const loadList = async () => {
  loading.value = true;
  try {
    items.value = selected.value.length
      ? await fastApiService.getPoiList({ category: selected.value.join(','), q: query.value || undefined,
        hidden: showHidden.value || undefined })
      : [];
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Список не загружен');
  } finally {
    loading.value = false;
  }
};

const reload = async () => {
  errorMessage.value = '';
  try {
    await loadSummary();
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Социальные объекты не загружены');
    return;
  }
  await loadList();
  if (shownOnMap.value) await showOnMap();
};

const toggleCategory = (id: PoiCategory) => {
  selected.value = selected.value.includes(id) ? selected.value.filter((c) => c !== id) : [...selected.value, id];
};

const showOnMap = async () => {
  if (!selected.value.length) return;
  showing.value = true;
  try {
    emit('show-on-map', await fastApiService.getPoiGeojson(selected.value.join(',')));
    shownOnMap.value = true;
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Объекты не показаны на карте');
  } finally {
    showing.value = false;
  }
};

const hideFromMap = () => {
  emit('clear-highlight');
  shownOnMap.value = false;
};

const focus = (p: PoiItem) => {
  emit('focus-coords', p.lon, p.lat);
  if (isMobile.value) visible.value = false;
};

const resultSummary = (what: string, r: PoiImportResult) => {
  const parts = [`${what}: сохранено ${r.saved}`];
  if (r.removed) parts.push(`удалено устаревших ${r.removed}`);
  if (r.outside) parts.push(`далеко от сети ${r.outside} — проверьте координаты`);
  if (r.notes?.length) parts.push(`пропущено — ${r.notes.join('; ')}`);
  return parts.join(', ');
};

const run = async (kind: 'consumers' | 'file' | 'osm', what: string, action: () => Promise<PoiImportResult>) => {
  busy.value = kind;
  errorMessage.value = '';
  resultText.value = '';
  try {
    resultText.value = resultSummary(what, await action());
    await reload();
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, `${what}: не удалось`);
  } finally {
    busy.value = '';
  }
};

const refreshConsumers = () => run('consumers', 'Из потребителей сети', () => fastApiService.refreshPoiFromConsumers());

const importOsm = async () => {
  const ok = await confirmAction({
    text: 'Сервер ТГИД запросит социальные объекты в охвате сети у OpenStreetMap (overpass-api.de) и заменит ими '
      + 'прежнюю загрузку из OpenStreetMap. Продолжить?',
    action: 'Загрузить',
  });
  if (ok) await run('osm', 'Из OpenStreetMap', () => fastApiService.importPoiOsm());
};

const importFile = async () => {
  const f = Array.isArray(file.value) ? file.value[0] : file.value;
  if (!f) return;
  const parsed = fileFeatures(f.name, await f.text());
  if (parsed.error) {
    errorMessage.value = parsed.error;
    return;
  }
  await run('file', `Файл «${f.name}»`, async () => {
    const r = await fastApiService.importPoiFile({ features: parsed.features, category: fileCategory.value });
    return parsed.skipped ? { ...r, notes: [...(r.notes ?? []), `строк без координат: ${parsed.skipped}`] } : r;
  });
  file.value = null;
};

const deleteSource = async (source: PoiSource) => {
  const ok = await confirmAction({
    text: `Удалить все социальные объекты из источника «${POI_SOURCE_LABELS[source]}» (${sourceCount(source)})?`,
    action: 'Удалить',
    color: 'error',
  });
  if (!ok) return;
  busy.value = 'delete';
  try {
    const r = await fastApiService.deletePoiSource(source);
    resultText.value = `Удалено: ${r.removed}`;
    await reload();
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Не удалено');
  } finally {
    busy.value = '';
  }
};

const toggleHidden = async (p: PoiItem) => {
  updating.value = p.id;
  try {
    await fastApiService.updatePoi(p.id, { hidden: !p.hidden });
    items.value = items.value.filter((x) => x.id !== p.id);
    await loadSummary();
    if (shownOnMap.value) await showOnMap();
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Не сохранено');
  } finally {
    updating.value = null;
  }
};

watch([selected, showHidden], () => void loadList());
watch(query, () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => void loadList(), SEARCH_DEBOUNCE_MS);
});
watch(visible, (open) => {
  if (open) void reload();
}, { immediate: true });

const openDialog = () => {
  visible.value = true;
};

defineExpose({ openDialog });
</script>

<style scoped>
.poi-dot { display: inline-block; flex: none; width: 10px; height: 10px; border-radius: 50%; }
.poi-source {
  display: flex; align-items: flex-start; gap: var(--space-3, 12px); padding: var(--space-2, 8px) 0;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.poi-source > div { flex: 1; min-width: 0; }
.poi-field { min-width: 200px; flex: 1 1 200px; }
</style>
