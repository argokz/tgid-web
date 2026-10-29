<template>
  <v-dialog
    v-model="visible"
    :max-width="640"
    :fullscreen="isMobile"
    scrollable
  >
    <v-card>
      <v-card-title class="d-flex align-center py-3 px-4">
        <v-icon
          class="mr-2"
          color="primary"
        >
          mdi-palette-swatch-variant
        </v-icon>
        <span class="text-h6 flex-grow-1">Тематическая карта сети</span>
        <HintTip text="Закрыть (тема остаётся на карте)">
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

        <!-- сохранённые стили: тема, классы, палитра (api/v1/layer-styles) -->
        <div class="d-flex flex-wrap align-center ga-2 mb-3">
          <AppSelect
            :model-value="styleId"
            :items="styleItems"
            item-title="title"
            item-value="value"
            label="Сохранённый стиль"
            placeholder="Свой"
            persistent-placeholder
            class="thematic-field"
            @update:model-value="applySavedStyle($event as string | null)"
          />
          <HintTip :text="selectedStyle && canEditSelected ? 'Сохранить изменения стиля' : 'Сохранить как стиль'">
            <template #default="{ props: tip }">
              <v-btn
                v-bind="tip"
                icon="mdi-content-save-outline"
                variant="text"
                size="small"
                aria-label="Сохранить стиль"
                :disabled="!currentStyle"
                @click="selectedStyle && canEditSelected ? updateSelected() : openSave()"
              />
            </template>
          </HintTip>
          <HintTip
            v-if="selectedStyle && canEditSelected"
            text="Удалить стиль"
          >
            <template #default="{ props: tip }">
              <v-btn
                v-bind="tip"
                icon="mdi-delete-outline"
                variant="text"
                size="small"
                aria-label="Удалить стиль"
                @click="deleteSelected"
              />
            </template>
          </HintTip>
        </div>
        <div
          v-if="saveOpen"
          class="d-flex flex-wrap align-center ga-2 mb-3"
        >
          <v-text-field
            v-model="saveName"
            label="Название стиля"
            density="compact"
            variant="outlined"
            hide-details
            autofocus
            maxlength="200"
            class="thematic-field"
            @keyup.enter="saveNew"
          />
          <v-checkbox
            v-if="canShared"
            v-model="saveShared"
            label="Общий"
            density="compact"
            hide-details
          />
          <v-btn
            color="primary"
            variant="tonal"
            size="small"
            :loading="saving"
            :disabled="!saveName.trim()"
            @click="saveNew"
          >
            Сохранить
          </v-btn>
          <v-btn
            variant="text"
            size="small"
            @click="saveOpen = false"
          >
            Отмена
          </v-btn>
        </div>

        <AppSelect
          v-model="themeKey"
          :items="themeItems"
          item-title="title"
          item-value="value"
          label="Показать на участках"
          :clearable="false"
          :hint="theme?.hint"
          persistent-hint
          class="mb-3"
        />
        <div class="d-flex flex-wrap align-center ga-3 mb-2">
          <span class="text-body-2">
            Фрагментов: {{ fragmentIds.length || 'не выбрано' }}
          </span>
          <v-checkbox
            v-model="onlyView"
            label="Только в видимой области карты"
            density="compact"
            hide-details
          />
          <v-spacer />
          <v-btn
            color="primary"
            variant="flat"
            :loading="loading"
            :disabled="!themeKey || !fragmentIds.length"
            prepend-icon="mdi-map-legend"
            @click="build"
          >
            {{ thematic.shown.value ? 'Обновить' : 'Построить' }}
          </v-btn>
        </div>

        <template v-if="data && theme">
          <v-divider class="my-3" />
          <div class="text-body-2 text-medium-emphasis mb-3">
            {{ summaryText }}
          </div>

          <template v-if="theme.kind === 'number'">
            <v-row dense>
              <v-col
                cols="12"
                sm="6"
              >
                <AppSelect
                  v-model="method"
                  :items="METHOD_ITEMS"
                  item-title="title"
                  item-value="value"
                  label="Классы"
                  :clearable="false"
                />
              </v-col>
              <v-col
                cols="12"
                sm="6"
              >
                <AppSelect
                  v-model="palette"
                  :items="paletteItems"
                  item-title="title"
                  item-value="value"
                  label="Палитра"
                  :clearable="false"
                >
                  <template #item="{ props: itemProps, item }">
                    <v-list-item v-bind="itemProps">
                      <template #append>
                        <span
                          class="thematic-ramp"
                          :style="{ background: rampCss(item.raw.value) }"
                        />
                      </template>
                    </v-list-item>
                  </template>
                </AppSelect>
              </v-col>
            </v-row>
            <v-slider
              v-if="method !== 'manual'"
              v-model="classes"
              :min="MIN_CLASSES"
              :max="MAX_CLASSES"
              :step="1"
              show-ticks="always"
              thumb-label
              label="Число классов"
              density="compact"
              hide-details
              class="mb-2"
            />
            <v-text-field
              v-else
              v-model="breaksText"
              label="Границы классов через точку с запятой"
              :hint="`Например: ${theme.breaks.length ? theme.breaks.join('; ') : '10; 20; 50'}`"
              persistent-hint
              density="compact"
              variant="outlined"
              :error-messages="breaksError"
              class="mb-2"
            />
          </template>

          <v-row
            dense
            align="center"
          >
            <v-col
              cols="12"
              sm="6"
            >
              <v-slider
                v-model="width"
                :min="1"
                :max="10"
                :step="0.5"
                thumb-label
                label="Толщина"
                density="compact"
                hide-details
              />
            </v-col>
            <v-col
              cols="12"
              sm="6"
            >
              <v-slider
                v-model="opacity"
                :min="0.2"
                :max="1"
                :step="0.05"
                thumb-label
                label="Непрозрачность"
                density="compact"
                hide-details
              />
            </v-col>
          </v-row>
          <v-switch
            v-model="showNulls"
            label="Показывать участки без значения (серым)"
            color="primary"
            density="compact"
            hide-details
          />

          <ul class="thematic-preview mt-2">
            <li
              v-for="row in thematic.legend.value"
              :key="row.label"
            >
              <span
                class="thematic-preview__swatch"
                :style="{ background: row.color }"
              />
              <span class="flex-grow-1">{{ row.label }}</span>
              <span class="text-medium-emphasis">{{ row.count.toLocaleString('ru-RU') }}</span>
            </li>
          </ul>
        </template>
      </v-card-text>

      <v-divider />
      <v-card-actions class="px-4">
        <v-btn
          v-if="thematic.shown.value"
          variant="text"
          color="error"
          @click="clearMap"
        >
          Снять с карты
        </v-btn>
        <v-spacer />
        <v-btn
          variant="text"
          @click="visible = false"
        >
          Закрыть
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AppSelect from '~/components/AppSelect.vue';
import HintTip from '~/components/HintTip.vue';
import { confirmAction } from '~/composables/useConfirm';
import { useMobile } from '~/composables/useMobile';
import { useThematicMap } from '~/composables/useThematicMap';
import { fastApiService, type LayerStyle, type ThematicPipesResponse } from '~/services/fastApiService';
import { useFragmentStore } from '~/stores/fragmentStore';
import { useMapStore } from '~/stores/mapStore';
import { useNotificationStore } from '~/stores/notificationStore';
import { formatApiError } from '~/utils/apiError';
import { featureBounds } from '~/utils/networkTrace';
import {
  MAX_CLASSES,
  METHOD_ITEMS,
  MIN_CLASSES,
  PALETTES,
  buildStyle,
  paletteColors,
  themePalette,
  type ThematicMethod,
  type ThematicStyle,
  type ThematicTheme,
} from '~/utils/thematicStyle';

/**
 * Smart Mapping (фаза 1, п. 5 раздела 2а): участки видимых фрагментов раскрашиваются по теме — диаметр,
 * год, износ, теплопотери, режим расчёта, тип прокладки. Классы и легенда считаются в браузере
 * (utils/thematicStyle), стиль сохраняется JSON-ом в базе города (api/v1/layer-styles).
 */
const visible = ref(false);
const { isMobile } = useMobile();
const thematic = useThematicMap();
const fragmentStore = useFragmentStore();
const mapStore = useMapStore();
const notify = useNotificationStore();

const errorMessage = ref('');
const loading = ref(false);
const themes = ref<ThematicTheme[]>([]);
const themeKey = ref<string | null>(null);
const onlyView = ref(false);

const method = ref<Exclude<ThematicMethod, 'unique'>>('quantile');
const classes = ref(5);
const palette = ref('ylorrd');
const breaksText = ref('');
const width = ref(3);
const opacity = ref(0.9);
const showNulls = ref(true);

const SOURCE_TITLES: Record<ThematicTheme['source'], string> = {
  passport: 'паспорт',
  calc: 'расчёт',
  wear: 'износ',
  heat_losses: 'теплопотери',
};
const themeItems = computed(() => themes.value.map((t) => ({
  value: t.key, title: `${t.label}${t.units ? `, ${t.units}` : ''} — ${SOURCE_TITLES[t.source]}`,
})));
const theme = computed(() => themes.value.find((t) => t.key === themeKey.value) ?? null);
const paletteItems = Object.entries(PALETTES).flatMap(([key, p]) => [
  { value: key, title: p.title },
  { value: `${key}_r`, title: `${p.title} (обратная)` },
]);
const rampCss = (name: string) => `linear-gradient(to right, ${paletteColors(name, 5).join(', ')})`;
const fmt = (v: number | undefined) => (v === undefined ? '—'
  : v.toLocaleString('ru-RU', { maximumFractionDigits: theme.value?.digits ?? 2 }));

/** Данные на карте — той ли темы, что выбрана в окне */
const data = computed(() => {
  const res = thematic.result.value;
  return res && res.theme.key === themeKey.value ? res : null;
});

const summaryText = computed(() => {
  const res = data.value;
  if (!res) return '';
  const s = res.summary;
  const n = (v: number) => v.toLocaleString('ru-RU');
  let text = `Участков: ${n(s.count)}, со значением — ${n(s.with_value)}`;
  if (s.min !== undefined) text += `, от ${fmt(s.min)} до ${fmt(s.max)} ${res.theme.units}`.trimEnd();
  if (res.truncated) text += ` — показана часть: больше ${n(s.count)} участков, сузьте выбор фрагментов`;
  return text;
});

const fragmentIds = computed(() => fragmentStore.visibleFragments ?? []);

const parsedBreaks = computed<number[] | null>(() => {
  const parts = breaksText.value.split(/[;\s]+/).map((s) => s.trim().replace(',', '.')).filter(Boolean);
  if (!parts.length) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isFinite(n))) return null;
  return nums.every((n, i) => i === 0 || n > nums[i - 1]!) ? nums.slice(0, MAX_CLASSES - 1) : null;
});
const breaksError = computed(() => (method.value === 'manual' && breaksText.value.trim() && !parsedBreaks.value
  ? 'Числа по возрастанию через «;»' : ''));

/** Стиль из настроек окна по данным на карте */
const currentStyle = computed<ThematicStyle | null>(() => {
  const res = data.value;
  const t = theme.value;
  if (!res || !t) return null;
  const values = res.geojson.features.map((f) => f.properties.v);
  return buildStyle(t, values, {
    method: method.value,
    classes: classes.value,
    palette: palette.value,
    breaks: method.value === 'manual' ? parsedBreaks.value ?? undefined : undefined,
    categories: (res.summary.categories ?? []).map((c) => c.value),
    base: { width: width.value, opacity: opacity.value, show_nulls: showNulls.value },
  });
});

watch(currentStyle, (next) => {
  if (next && thematic.shown.value) thematic.restyle(next);
});

/** Настройки темы по умолчанию (с сервера) */
const resetControls = (t: ThematicTheme) => {
  method.value = t.method;
  palette.value = themePalette(t);
  breaksText.value = t.breaks.join('; ');
  classes.value = t.method === 'manual' ? Math.max(MIN_CLASSES, t.breaks.length + 1) : 5;
};

watch(themeKey, (key, old) => {
  const t = themes.value.find((x) => x.key === key);
  if (t && old !== undefined && !applyingStyle) resetControls(t);
  if (!applyingStyle) styleId.value = null;
});

const currentBbox = (): [number, number, number, number] | null => {
  const map = mapStore.map as { getBounds?: () => { getWest(): number; getSouth(): number; getEast(): number; getNorth(): number } } | null;
  const b = map?.getBounds?.();
  if (!b) return null;
  const clamp = (v: number, lim: number) => Math.max(-lim, Math.min(lim, v));
  return [clamp(b.getWest(), 180), clamp(b.getSouth(), 90), clamp(b.getEast(), 180), clamp(b.getNorth(), 90)];
};

/** Участков темы в кадре нет (фрагмент далеко) — перелёт к ним, иначе вид пользователя не трогаем */
const fitIfOutOfView = (res: ThematicPipesResponse) => {
  const bounds = featureBounds(res.geojson);
  const view = currentBbox();
  const map = mapStore.map as { fitBounds?: (b: [[number, number], [number, number]], o: object) => void } | null;
  if (!bounds || !view || !map?.fitBounds) return;
  const [xmin, ymin, xmax, ymax] = bounds;
  const overlaps = xmin <= view[2] && xmax >= view[0] && ymin <= view[3] && ymax >= view[1];
  if (!overlaps) map.fitBounds([[xmin, ymin], [xmax, ymax]], { padding: 80, maxZoom: 16, duration: 800 });
};

const build = async () => {
  const t = theme.value;
  if (!t || !fragmentIds.value.length) return;
  loading.value = true;
  errorMessage.value = '';
  try {
    const res = await fastApiService.getThematicPipes(t.key, fragmentIds.value, onlyView.value ? currentBbox() : null);
    const values = res.geojson.features.map((f) => f.properties.v);
    const next = buildStyle(t, values, {
      method: method.value,
      classes: classes.value,
      palette: palette.value,
      breaks: method.value === 'manual' ? parsedBreaks.value ?? undefined : undefined,
      categories: (res.summary.categories ?? []).map((c) => c.value),
      base: { width: width.value, opacity: opacity.value, show_nulls: showNulls.value },
    });
    if (!(await thematic.show(res, next, selectedStyle.value?.name ?? ''))) {
      errorMessage.value = 'Карта ещё не готова';
      return;
    }
    if (!onlyView.value) fitIfOutOfView(res);
    if (!res.summary.with_value) notify.showWarning('У участков нет значений этой темы');
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Тема не построена');
  } finally {
    loading.value = false;
  }
};

const clearMap = () => thematic.clear();

// --- сохранённые стили ---
const styles = ref<LayerStyle[]>([]);
const canShared = ref(false);
const styleId = ref<string | null>(null);
let applyingStyle = false;
const selectedStyle = computed(() => styles.value.find((s) => s.id === styleId.value) ?? null);
const styleItems = computed(() => styles.value.map((s) => ({
  value: s.id,
  title: `${s.name} — ${themes.value.find((t) => t.key === s.style.theme)?.label ?? s.style.theme}${s.shared ? ' (общий)' : ''}`,
})));
const canEditSelected = computed(() => Boolean(selectedStyle.value));
const saveOpen = ref(false);
const saveName = ref('');
const saveShared = ref(false);
const saving = ref(false);

/** Стиль к сохранению: границы — только у «своих», остальные способы пересчитываются по данным */
const styleToSave = (): ThematicStyle | null => {
  const s = currentStyle.value;
  if (!s) return null;
  const { breaks, ...rest } = s;
  return s.method === 'manual' ? s : rest;
};

const applySavedStyle = async (id: string | null) => {
  styleId.value = id;
  const saved = styles.value.find((s) => s.id === id);
  if (!saved) return;
  applyingStyle = true;
  const st = saved.style;
  themeKey.value = st.theme;
  if (st.method !== 'unique') method.value = st.method;
  if (st.palette && st.palette !== 'category') palette.value = st.palette;
  if (st.classes) classes.value = st.classes;
  breaksText.value = (st.breaks ?? theme.value?.breaks ?? []).join('; ');
  width.value = st.width;
  opacity.value = st.opacity;
  showNulls.value = st.show_nulls;
  await Promise.resolve();
  applyingStyle = false;
  if (data.value) {
    const next = currentStyle.value;
    if (next) thematic.restyle(next, saved.name);
  } else {
    await build();
  }
};

const loadStyles = async () => {
  try {
    const res = await fastApiService.getLayerStyles();
    styles.value = res.styles;
    canShared.value = res.can_shared;
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Не удалось загрузить стили');
  }
};

const openSave = () => {
  saveName.value = '';
  saveShared.value = false;
  saveOpen.value = true;
};

const saveNew = async () => {
  const style = styleToSave();
  const name = saveName.value.trim();
  if (!style || !name) return;
  saving.value = true;
  try {
    const created = await fastApiService.createLayerStyle({ name, style, shared: saveShared.value });
    styles.value = [...styles.value, created];
    applyingStyle = true;
    styleId.value = created.id;
    applyingStyle = false;
    thematic.restyle(currentStyle.value!, created.name);
    saveOpen.value = false;
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Стиль не сохранён');
  } finally {
    saving.value = false;
  }
};

const updateSelected = async () => {
  const sel = selectedStyle.value;
  const style = styleToSave();
  if (!sel || !style) return;
  saving.value = true;
  try {
    const updated = await fastApiService.updateLayerStyle(sel.id, { style, revision: sel.revision });
    styles.value = styles.value.map((s) => (s.id === updated.id ? updated : s));
    notify.showSuccess(`Стиль «${updated.name}» сохранён`);
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Стиль не сохранён');
  } finally {
    saving.value = false;
  }
};

const deleteSelected = async () => {
  const sel = selectedStyle.value;
  if (!sel) return;
  if (!(await confirmAction({ text: `Удалить стиль «${sel.name}»?`, action: 'Удалить' }))) return;
  try {
    await fastApiService.deleteLayerStyle(sel.id);
    styles.value = styles.value.filter((s) => s.id !== sel.id);
    styleId.value = null;
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Стиль не удалён');
  }
};

const loadThemes = async () => {
  try {
    themes.value = (await fastApiService.getThematicThemes()).themes;
    const shownKey = thematic.result.value?.theme.key;
    const first = themes.value.find((t) => t.key === shownKey) ?? themes.value[0];
    if (first && !themeKey.value) {
      resetControls(first);
      themeKey.value = first.key;
    }
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Не удалось загрузить темы');
  }
};

watch(visible, (open) => {
  if (!open) return;
  if (!themes.value.length) loadThemes();
  if (!styles.value.length) loadStyles();
}, { immediate: true });

const openDialog = () => {
  visible.value = true;
};

defineExpose({ openDialog });
</script>

<style scoped>
.thematic-field { flex: 1 1 260px; min-width: 220px; }
.thematic-ramp { display: inline-block; width: 64px; height: 8px; border-radius: 4px; }
.thematic-preview { list-style: none; padding: 0; margin: 0; font-size: var(--text-sm, 0.875rem); }
.thematic-preview li { display: flex; align-items: center; gap: var(--space-2, 8px); line-height: 1.8; }
.thematic-preview__swatch { flex: none; width: 28px; height: 8px; border-radius: 4px; }
</style>
