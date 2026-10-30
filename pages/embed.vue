<template>
  <div class="em-page">
    <div
      ref="mapEl"
      class="em-map"
      role="region"
      :aria-label="config ? `Карта тепловой сети: ${config.name}` : 'Карта тепловой сети'"
    />

    <div
      v-if="blocked"
      class="em-blocked"
      role="alert"
    >
      <v-icon
        icon="mdi-map-marker-off"
        size="40"
        class="mb-2"
      />
      <p class="text-body-1">
        {{ blocked }}
      </p>
    </div>

    <template v-else-if="opts.ui && config">
      <section
        class="em-legend"
        aria-label="Слои карты"
      >
        <button
          type="button"
          class="em-legend__head"
          :aria-expanded="legendOpen"
          @click="legendOpen = !legendOpen"
        >
          <span class="em-legend__title">{{ config.city_label || config.name }}</span>
          <v-icon
            :icon="legendOpen ? 'mdi-chevron-up' : 'mdi-chevron-down'"
            size="small"
          />
        </button>
        <div
          v-if="legendOpen"
          class="em-legend__body"
        >
          <label
            v-for="l in config.layers"
            :key="l.id"
            class="em-legend__row"
          >
            <input
              type="checkbox"
              :checked="visible.includes(l.id)"
              @change="toggleLayer(l.id)"
            >
            <i
              class="em-swatch"
              :class="{ 'em-swatch--line': l.geometry === 'LineString' }"
              :style="{ background: swatchColor(l.id) }"
            />
            {{ l.title }}
          </label>
          <div
            v-if="config.outages"
            class="em-legend__row"
          >
            <i
              class="em-swatch"
              :style="{ background: PUBLIC_COLORS.active }"
            />
            Отключения
          </div>
          <p
            v-if="hiddenByZoom.length"
            class="em-legend__hint"
          >
            Приблизьте карту, чтобы увидеть: {{ hiddenByZoom.join(', ').toLowerCase() }}
          </p>
        </div>
      </section>

      <section
        v-if="selected"
        class="em-card"
        aria-live="polite"
      >
        <header class="em-card__head">
          <strong>{{ EMBED_LAYER_TITLES[selected.layer] }}</strong>
          <button
            type="button"
            class="em-card__close"
            aria-label="Закрыть карточку"
            @click="clearSelection"
          >
            <v-icon
              icon="mdi-close"
              size="small"
            />
          </button>
        </header>
        <dl class="em-card__rows">
          <template
            v-for="r in selectedRows"
            :key="r.label"
          >
            <dt>{{ r.label }}</dt>
            <dd>{{ r.value }}</dd>
          </template>
        </dl>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { getMapTilerStreetsStyleUrl } from '~/utils/maptiler';
import { getMaplibreDefault } from '~/utils/maplibreLoader';
import { absoluteApiBase } from '~/utils/staticTiles';
import { PUBLIC_COLORS, zonesForMap, type PublicOutageFeature } from '~/utils/publicOutages';
import {
  EMBED_COLORS,
  EMBED_LAYER_TITLES,
  embedMapLayers,
  embedSourceId,
  embedTileUrl,
  eventMessage,
  featureRows,
  frameAllowed,
  layerOfMapLayer,
  parentOrigin,
  parseCommand,
  parseEmbedQuery,
  type EmbedCommand,
  type EmbedConfig,
  type EmbedEvent,
  type EmbedLayerId,
  type EmbedView,
} from '~/utils/embedProtocol';

/**
 * Встраиваемая карта (фаза 2, п. 14): слои сети по ключу встраивания для iframe на чужом сайте — портал акимата,
 * ЕДДС, кабинет потребителя. Без входа и без макета приложения. Ключ, слои и сайты — itwin-api routers/embed.py;
 * протокол postMessage и SDK — utils/embedProtocol.ts и public/tgid-embed.js.
 */
definePageMeta({ layout: false });
useHead({ title: 'Карта тепловой сети', meta: [{ name: 'robots', content: 'noindex' }] });

const DEFAULT_API = 'http://localhost:8000';
const OUTAGES_SOURCE = 'tgid-embed-outages';
const OUTAGES_REFRESH_MS = 5 * 60 * 1000;
const MOVE_DEBOUNCE_MS = 250;
const PICK_TOLERANCE_PX = 6;
const FIT_PADDING = 30;

const runtime = useRuntimeConfig().public as { mapApiBaseUrl?: string; externalApiUrl?: string };
const apiBase = String(runtime.mapApiBaseUrl || runtime.externalApiUrl || DEFAULT_API).replace(/\/+$/, '');

const route = useRoute();
const opts = parseEmbedQuery(route.query);
const mapEl = ref<HTMLElement | null>(null);
const config = ref<EmbedConfig | null>(null);
const blocked = ref('');
const legendOpen = ref(true);
const visible = ref<EmbedLayerId[]>([]);
const zoom = ref(0);
const selected = ref<{ layer: EmbedLayerId; id: number; properties: Record<string, unknown> } | null>(null);
const selectedRows = computed(() => (selected.value ? featureRows(selected.value.properties) : []));
const hiddenByZoom = computed(() => (config.value?.layers ?? [])
  .filter((l) => visible.value.includes(l.id) && zoom.value < l.minzoom)
  .map((l) => l.title));

let map: any = null;
let parent: string | null = null;
let highlighted: { layer: EmbedLayerId; ids: number[] } | null = null;
let selectedState: { layer: EmbedLayerId; id: number } | null = null;
let moveTimer: ReturnType<typeof setTimeout> | null = null;
let outagesTimer: ReturnType<typeof setInterval> | null = null;

const swatchColor = (id: EmbedLayerId) => ({
  pipes: EMBED_COLORS.both, heat_sources: EMBED_COLORS.source, consumers: EMBED_COLORS.consumer,
  nodes: EMBED_COLORS.node, valves: '#212121',
})[id];

/** Событие сайту-родителю: только ему (по проверенному адресу), не «всем» */
const emit = (event: EmbedEvent) => {
  if (!parent || window.parent === window) return;
  window.parent.postMessage(eventMessage(event), parent);
};

const currentView = (): { view: EmbedView; bounds: [number, number, number, number] } => {
  const c = map.getCenter();
  const b = map.getBounds();
  const r = (n: number) => Math.round(n * 1e6) / 1e6;
  return {
    view: { center: [r(c.lng), r(c.lat)], zoom: Math.round(map.getZoom() * 100) / 100 },
    bounds: [r(b.getWest()), r(b.getSouth()), r(b.getEast()), r(b.getNorth())],
  };
};

const setState = (layer: EmbedLayerId, id: number, state: Record<string, boolean>) => {
  map?.setFeatureState({ source: embedSourceId(layer), sourceLayer: layer, id }, state);
};

const highlight = (layer: EmbedLayerId, ids: number[]) => {
  if (highlighted) for (const id of highlighted.ids) setState(highlighted.layer, id, { hl: false });
  highlighted = ids.length ? { layer, ids } : null;
  for (const id of ids) setState(layer, id, { hl: true });
  if (selectedState) setState(selectedState.layer, selectedState.id, { hl: true });
};

const clearSelection = () => {
  if (selectedState && !(highlighted?.layer === selectedState.layer && highlighted.ids.includes(selectedState.id))) {
    setState(selectedState.layer, selectedState.id, { hl: false });
  }
  selectedState = null;
  selected.value = null;
};

const applyVisibility = () => {
  for (const l of config.value?.layers ?? []) {
    for (const spec of embedMapLayers(l)) {
      if (map.getLayer(spec.id)) map.setLayoutProperty(spec.id, 'visibility', visible.value.includes(l.id) ? 'visible' : 'none');
    }
  }
};

const toggleLayer = (id: EmbedLayerId) => {
  visible.value = visible.value.includes(id) ? visible.value.filter((x) => x !== id) : [...visible.value, id];
  applyVisibility();
};

const run = (cmd: EmbedCommand) => {
  switch (cmd.type) {
    case 'setView':
      map.easeTo({ ...(cmd.center ? { center: cmd.center } : {}), ...(cmd.zoom !== undefined ? { zoom: cmd.zoom } : {}) });
      break;
    case 'fitBounds':
      map.fitBounds([[cmd.bounds[0], cmd.bounds[1]], [cmd.bounds[2], cmd.bounds[3]]], { padding: cmd.padding ?? FIT_PADDING });
      break;
    case 'setLayers': {
      const allowed = new Set(config.value?.layers.map((l) => l.id));
      visible.value = cmd.layers.filter((l) => allowed.has(l));
      applyVisibility();
      break;
    }
    case 'highlight':
      if (config.value?.layers.some((l) => l.id === cmd.layer)) highlight(cmd.layer, cmd.ids);
      break;
    case 'getView':
      emit({ type: 'view', id: cmd.id, ...currentView() });
      break;
  }
};

const onMessage = (event: MessageEvent) => {
  if (!parent || event.source !== window.parent || event.origin !== parent || !map) return;
  const cmd = parseCommand(event.data);
  if (cmd) run(cmd);
};

const pick = (e: any) => {
  const ids = (config.value?.layers ?? []).flatMap((l) => embedMapLayers(l).map((s) => String(s.id)))
    .filter((id) => map.getLayer(id));
  const p = e.point;
  const box = [[p.x - PICK_TOLERANCE_PX, p.y - PICK_TOLERANCE_PX], [p.x + PICK_TOLERANCE_PX, p.y + PICK_TOLERANCE_PX]];
  const hit = map.queryRenderedFeatures(box, { layers: ids })[0];
  if (!hit || hit.id === undefined) {
    clearSelection();
    return;
  }
  const layer = layerOfMapLayer(hit.layer.id);
  if (!layer) return;
  clearSelection();
  const id = Number(hit.id);
  selectedState = { layer, id };
  setState(layer, id, { hl: true });
  selected.value = { layer, id, properties: { ...hit.properties } };
  emit({ type: 'select', layer, id, properties: { ...hit.properties }, lngLat: [e.lngLat.lng, e.lngLat.lat] });
};

const drawOutages = async () => {
  try {
    const res = await fetch(`${apiBase}/api/v1/public/outages`, { headers: { Accept: 'application/json' } });
    if (!res.ok) return;
    const fc = (await res.json()) as GeoJSON.FeatureCollection;
    const data = zonesForMap(fc.features as PublicOutageFeature[]);
    const source = map?.getSource(OUTAGES_SOURCE);
    if (source) {
      source.setData(data);
      return;
    }
    if (!map) return;
    map.addSource(OUTAGES_SOURCE, { type: 'geojson', data });
    const beforeId = map.getLayer(`${embedSourceId('pipes')}-line`) ? `${embedSourceId('pipes')}-line` : undefined;
    map.addLayer({ id: `${OUTAGES_SOURCE}-fill`, type: 'fill', source: OUTAGES_SOURCE,
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.2 } }, beforeId);
    map.addLayer({ id: `${OUTAGES_SOURCE}-line`, type: 'line', source: OUTAGES_SOURCE,
      paint: { 'line-color': ['get', 'color'], 'line-width': 2 } }, beforeId);
  } catch {
    // отключения — дополнение: без них карта работает
  }
};

const addNetwork = (cfg: EmbedConfig) => {
  const base = absoluteApiBase(apiBase, window.location.origin);
  for (const l of cfg.layers) {
    map.addSource(embedSourceId(l.id), {
      type: 'vector', tiles: [embedTileUrl(base, opts.key, l.id)], minzoom: l.minzoom, maxzoom: 16,
      attribution: 'ТГИД',
    });
    for (const spec of embedMapLayers(l)) map.addLayer(spec);
  }
  applyVisibility();
};

const loadConfig = async (): Promise<EmbedConfig | null> => {
  if (!opts.key) {
    blocked.value = 'В адресе карты нет ключа встраивания (key).';
    return null;
  }
  try {
    const res = await fetch(`${apiBase}/api/v1/embed/config?key=${encodeURIComponent(opts.key)}`);
    if (res.status === 403 || res.status === 404) {
      blocked.value = 'Ключ встраивания не принят: он отозван, истёк или выдан для другого города.';
      return null;
    }
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as EmbedConfig;
  } catch {
    blocked.value = 'Карта сейчас недоступна — попробуйте обновить страницу позже.';
    return null;
  }
};

onMounted(async () => {
  const cfg = await loadConfig();
  if (!cfg) return;
  parent = parentOrigin({ framed: window.parent !== window, ancestorOrigins: window.location.ancestorOrigins, referrer: document.referrer });
  if (!frameAllowed(parent, cfg.origins, window.location.origin)) {
    blocked.value = parent
      ? `Эта карта не разрешена для сайта ${parent}. Попросите администратора ТГИД добавить сайт в ключ встраивания.`
      : 'Не удалось определить сайт, на котором открыта карта. Уберите у iframe referrerpolicy="no-referrer".';
    parent = null;
    return;
  }
  config.value = cfg;
  const allowed = cfg.layers.map((l) => l.id);
  visible.value = opts.layers ? allowed.filter((l) => opts.layers!.includes(l)) : allowed;
  useHead({ title: `Карта тепловой сети — ${cfg.city_label || cfg.name}` });

  const maplibregl = await getMaplibreDefault();
  await import('maplibre-gl/dist/maplibre-gl.css');
  if (!mapEl.value) return;
  const view = opts.center ? { center: opts.center, zoom: opts.zoom ?? 15 } : cfg.view;
  map = new maplibregl.Map({
    container: mapEl.value,
    style: getMapTilerStreetsStyleUrl(),
    ...(view ? { center: view.center, zoom: opts.zoom ?? view.zoom } : { bounds: [[cfg.extent[0], cfg.extent[1]], [cfg.extent[2], cfg.extent[3]]], fitBoundsOptions: { padding: FIT_PADDING } }),
    attributionControl: false,
  });
  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  map.on('load', () => {
    zoom.value = map.getZoom();
    addNetwork(cfg);
    if (cfg.outages) {
      void drawOutages();
      outagesTimer = setInterval(() => void drawOutages(), OUTAGES_REFRESH_MS);
    }
    map.on('click', pick);
    map.on('zoomend', () => { zoom.value = map.getZoom(); });
    map.on('moveend', () => {
      if (moveTimer) clearTimeout(moveTimer);
      moveTimer = setTimeout(() => emit({ type: 'moveend', ...currentView() }), MOVE_DEBOUNCE_MS);
    });
    window.addEventListener('message', onMessage);
    emit({ type: 'ready', layers: [...visible.value], view: currentView().view });
  });
  map.on('error', (e: any) => {
    // ошибки тайлов подложки — не повод сообщать сайту; ключ отозван во время работы — да
    if (String(e?.error?.status ?? '') === '403') emit({ type: 'error', message: 'Ключ встраивания больше не действует' });
  });
});

onBeforeUnmount(() => {
  window.removeEventListener('message', onMessage);
  if (moveTimer) clearTimeout(moveTimer);
  if (outagesTimer) clearInterval(outagesTimer);
  map?.remove();
  map = null;
});
</script>

<style scoped>
.em-page { position: fixed; inset: 0; background: rgb(var(--v-theme-surface)); }
.em-map { position: absolute; inset: 0; }
.em-blocked {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 24px; text-align: center; color: rgba(var(--v-theme-on-surface), 0.75); background: rgb(var(--v-theme-surface));
}
.em-blocked p { max-width: 420px; }
.em-legend {
  position: absolute; top: 10px; left: 10px; max-width: min(260px, calc(100% - 70px)); border-radius: 10px;
  background: rgb(var(--v-theme-surface)); box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18); font-size: 0.8125rem;
}
.em-legend__head {
  display: flex; align-items: center; gap: 6px; width: 100%; padding: 8px 10px; border: 0; background: transparent;
  color: inherit; font: inherit; font-weight: 600; cursor: pointer; text-align: left;
}
.em-legend__title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.em-legend__body { padding: 0 10px 8px; }
.em-legend__row { display: flex; align-items: center; gap: 8px; min-height: 28px; cursor: pointer; }
.em-legend__hint { margin: 4px 0 0; color: rgba(var(--v-theme-on-surface), 0.65); font-size: 0.75rem; }
.em-swatch { display: inline-block; flex: none; width: 10px; height: 10px; border-radius: 50%; }
.em-swatch--line { width: 16px; height: 4px; border-radius: 2px; }
.em-card {
  position: absolute; left: 10px; bottom: 10px; width: min(300px, calc(100% - 20px)); max-height: 50%; overflow-y: auto;
  padding: 10px 12px; border-radius: 10px; background: rgb(var(--v-theme-surface));
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18); font-size: 0.8125rem;
}
.em-card__head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.em-card__head strong { flex: 1; }
.em-card__close {
  display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: 0;
  border-radius: 50%; background: transparent; color: inherit; cursor: pointer;
}
.em-card__close:hover { background: rgba(var(--v-theme-on-surface), 0.08); }
.em-card__rows { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; margin: 0; }
.em-card__rows dt { color: rgba(var(--v-theme-on-surface), 0.65); }
.em-card__rows dd { margin: 0; overflow-wrap: anywhere; }
</style>
