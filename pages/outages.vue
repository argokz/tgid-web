<template>
  <div class="po-page">
    <div
      ref="mapEl"
      class="po-map"
      role="region"
      aria-label="Карта отключений теплоснабжения"
    />

    <section
      ref="panelEl"
      class="po-panel"
      :class="{ 'po-panel--collapsed': collapsed }"
      aria-label="Список отключений"
    >
      <header class="po-panel__head">
        <div class="po-panel__title">
          <h1 class="text-h6">
            Отключения теплоснабжения
          </h1>
          <div
            v-if="cityLabel"
            class="text-caption text-medium-emphasis"
          >
            {{ cityLabel }}<span v-if="updatedAt"> · обновлено в {{ updatedAt }}</span>
          </div>
        </div>
        <v-btn
          :icon="collapsed ? 'mdi-chevron-up' : 'mdi-chevron-down'"
          variant="text"
          size="small"
          class="po-panel__toggle"
          :aria-label="collapsed ? 'Показать список' : 'Свернуть список'"
          @click="collapsed = !collapsed"
        />
      </header>

      <div class="po-panel__body">
        <v-progress-linear
          v-if="loading && !features.length"
          indeterminate
          class="mb-2"
        />
        <v-alert
          v-if="message"
          :type="disabled ? 'info' : 'warning'"
          variant="tonal"
          density="compact"
          class="mb-2"
        >
          {{ message }}
        </v-alert>
        <p
          v-else-if="!loading && !features.length"
          class="text-body-2"
        >
          Сейчас плановых и аварийных отключений теплоснабжения нет.
        </p>

        <div class="po-legend text-caption mb-2">
          <span><i
            class="po-swatch"
            :style="{ background: PUBLIC_COLORS.active }"
          /> идёт сейчас</span>
          <span><i
            class="po-swatch"
            :style="{ background: PUBLIC_COLORS.announced }"
          /> объявлено</span>
        </div>

        <button
          v-for="f in features"
          :key="f.properties.id"
          type="button"
          class="po-item"
          :class="{ 'po-item--active': selected === f.properties.id }"
          @click="focus(f)"
        >
          <span
            class="po-item__marker"
            :style="{ background: PUBLIC_COLORS[f.properties.status] }"
          />
          <span class="po-item__text">
            <strong>{{ statusText(f.properties) }}</strong>
            <span class="d-block">{{ periodText(f.properties) }}</span>
            <span
              v-if="f.properties.note"
              class="d-block"
            >{{ f.properties.note }}</span>
            <span class="d-block text-medium-emphasis">
              {{ consumersText(f.properties.consumers_count) }} · {{ f.properties.number }}
            </span>
          </span>
        </button>

        <p class="text-caption text-medium-emphasis mt-3">
          Зона на карте — участок тепловой сети и здания, где не будет отопления и горячей воды. Сроки могут
          измениться; при аварии — звоните в диспетчерскую службу вашего города.
        </p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { getCityConfig } from '~/utils/cityConfig';
import { getMapTilerStreetsStyleUrl } from '~/utils/maptiler';
import { getMaplibreDefault } from '~/utils/maplibreLoader';
import { featureBounds } from '~/utils/networkTrace';
import {
  PUBLIC_COLORS,
  consumersText,
  periodText,
  sortOutages,
  statusText,
  zonesForMap,
  type PublicOutageFeature,
} from '~/utils/publicOutages';

/**
 * Публичная карта отключений теплоснабжения (фаза 2): для жителей и порталов акиматов, без входа.
 * Данные — лента API /api/v1/public/outages (только зона, сроки, число потребителей и текст для жителей;
 * служба включает её PUBLIC_OUTAGES_ENABLED и флажком «Показывать на публичной карте» у отключения).
 * Без общего макета приложения: ни входа, ни панелей, ни слоёв сети.
 */
definePageMeta({ layout: false });

const REFRESH_MS = 5 * 60 * 1000;
const DEFAULT_API = 'http://localhost:8000';

/** Адрес API из настроек (как services/api/http.getApiBaseUrl, без клиента API: страница — без входа) */
const runtime = useRuntimeConfig().public as { mapApiBaseUrl?: string; externalApiUrl?: string };
const apiBase = String(runtime.mapApiBaseUrl || runtime.externalApiUrl || DEFAULT_API).replace(/\/+$/, '');
const SOURCE = 'public-outages';
const NARROW = '(max-width: 700px)';

const city = getCityConfig();
const cityLabel = ref('');
useHead({ title: () => `Отключения теплоснабжения${cityLabel.value ? ` — ${cityLabel.value}` : ''}` });

/** Название города — из открытой настройки API (/auth/config, без входа) */
const loadCity = async () => {
  try {
    const res = await fetch(`${apiBase}/api/v1/auth/config`);
    if (res.ok) cityLabel.value = String((await res.json()).city_label ?? '');
  } catch {
    // без названия города страница работает
  }
};

const mapEl = ref<HTMLElement | null>(null);
const panelEl = ref<HTMLElement | null>(null);
const features = ref<PublicOutageFeature[]>([]);
const loading = ref(true);
const message = ref('');
const disabled = ref(false);
const selected = ref<number | null>(null);
const collapsed = ref(false);
const updatedAt = ref('');
let map: any = null;
let timer: ReturnType<typeof setInterval> | null = null;
let fitted = false;

const draw = () => {
  if (!map || !map.isStyleLoaded()) return;
  const data = zonesForMap(features.value);
  const source = map.getSource(SOURCE);
  if (source) {
    source.setData(data);
    return;
  }
  map.addSource(SOURCE, { type: 'geojson', data });
  map.addLayer({ id: `${SOURCE}-fill`, type: 'fill', source: SOURCE,
    paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.25 } });
  map.addLayer({ id: `${SOURCE}-line`, type: 'line', source: SOURCE,
    paint: { 'line-color': ['get', 'color'], 'line-width': 2 } });
  map.on('click', `${SOURCE}-fill`, (e: any) => {
    const id = Number(e.features?.[0]?.properties?.id);
    const f = features.value.find((x) => x.properties.id === id);
    if (f) focus(f);
  });
  map.on('mouseenter', `${SOURCE}-fill`, () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', `${SOURCE}-fill`, () => { map.getCanvas().style.cursor = ''; });
};

/** Отступы подгонки карты: зона не должна уходить под панель списка (слева на компьютере, снизу на телефоне) */
const PAD = 40;
const fitPadding = () => {
  const panel = panelEl.value?.getBoundingClientRect();
  if (!panel) return PAD;
  if (window.matchMedia(NARROW).matches) return { top: PAD + 30, left: PAD, right: PAD, bottom: panel.height + PAD };
  return { top: PAD, bottom: PAD, right: PAD + 30, left: panel.right + PAD };
};

const fitTo = (fs: PublicOutageFeature[], maxZoom: number) => {
  const bounds = featureBounds({ type: 'FeatureCollection', features: fs });
  if (map && bounds) map.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], { padding: fitPadding(), maxZoom });
};

const fitAll = () => fitTo(features.value, 15);

const load = async () => {
  try {
    const res = await fetch(`${apiBase}/api/v1/public/outages`, { headers: { Accept: 'application/json' } });
    if (res.status === 404) {
      disabled.value = true;
      message.value = 'Публичная карта отключений в этом городе пока не включена.';
      features.value = [];
      return;
    }
    if (!res.ok) throw new Error(String(res.status));
    const fc = (await res.json()) as GeoJSON.FeatureCollection;
    features.value = sortOutages(fc.features as PublicOutageFeature[]);
    message.value = '';
    disabled.value = false;
    updatedAt.value = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    draw();
    if (!fitted && features.value.length) {
      fitted = true;
      fitAll();
    }
  } catch {
    message.value = 'Не удалось загрузить отключения — попробуйте обновить страницу позже.';
  } finally {
    loading.value = false;
  }
};

const focus = (f: PublicOutageFeature) => {
  selected.value = f.properties.id;
  // на телефоне список сворачивается — подгонка после того, как панель стала низкой
  if (window.matchMedia(NARROW).matches) collapsed.value = true;
  void nextTick(() => fitTo([f], 16));
};

onMounted(async () => {
  const maplibregl = await getMaplibreDefault();
  await import('maplibre-gl/dist/maplibre-gl.css');
  if (!mapEl.value) return;
  map = new maplibregl.Map({
    container: mapEl.value,
    style: getMapTilerStreetsStyleUrl(),
    center: city.center,
    zoom: 11,
    attributionControl: false,
  });
  // на телефоне список — снизу: подписи карты — наверх, чтобы не закрывали его
  const narrow = window.matchMedia(NARROW).matches;
  map.addControl(new maplibregl.AttributionControl({ compact: true }), narrow ? 'top-left' : 'bottom-right');
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  map.on('load', () => {
    draw();
    if (!fitted && features.value.length) {
      fitted = true;
      fitAll();
    }
  });
  void loadCity();
  await load();
  timer = setInterval(() => void load(), REFRESH_MS);
});

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
  map?.remove();
  map = null;
});
</script>

<style scoped>
.po-page { position: fixed; inset: 0; background: rgb(var(--v-theme-surface)); }
.po-map { position: absolute; inset: 0; }
.po-panel {
  position: absolute; top: 16px; left: 16px; width: min(380px, calc(100vw - 32px)); max-height: calc(100vh - 32px);
  display: flex; flex-direction: column; background: rgb(var(--v-theme-surface)); border-radius: 12px;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.18); overflow: hidden;
}
.po-panel__head { display: flex; align-items: flex-start; gap: 8px; padding: 12px 12px 8px 16px; }
.po-panel__title { flex: 1; min-width: 0; }
.po-panel__title h1 { margin: 0; line-height: 1.3; }
.po-panel__toggle { display: none; }
.po-panel__body { padding: 0 16px 16px; overflow-y: auto; }
.po-legend { display: flex; gap: 16px; }
.po-swatch { display: inline-block; width: 12px; height: 12px; border-radius: 3px; vertical-align: -1px; }
.po-item {
  display: flex; gap: 10px; width: 100%; text-align: left; padding: 10px; margin-bottom: 8px; border-radius: 8px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12); background: transparent; color: inherit; font: inherit;
  cursor: pointer;
}
.po-item:hover, .po-item--active { border-color: rgb(var(--v-theme-primary)); }
.po-item:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
.po-item__marker { flex: none; width: 6px; border-radius: 3px; }
.po-item__text { min-width: 0; font-size: 0.875rem; line-height: 1.45; }
@media (max-width: 700px) {
  .po-panel { top: auto; bottom: 0; left: 0; width: 100%; max-height: 55vh; border-radius: 12px 12px 0 0; }
  .po-panel__toggle { display: inline-flex; }
  .po-panel--collapsed .po-panel__body { display: none; }
}
</style>
