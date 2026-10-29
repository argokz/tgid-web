<template>
  <div class="fom">
    <div
      ref="mapEl"
      class="fom__map"
      role="region"
      :aria-label="`Карта места работ ${order.number}`"
    />
    <div
      v-if="note"
      class="fom__note text-caption"
    >
      {{ note }}
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Карта места работ в полевом приложении (pages/field.vue): точка наряда, участки и узлы сети вокруг
 * (utils/fieldNetwork.ts — сохранены на телефоне, поэтому видны и без связи), положение бригады.
 * Подложка — растровые тайлы MapTiler: без связи их нет, сеть рисуется на сером фоне.
 */
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { FieldNetwork } from '~/utils/fieldNetwork';
import { formatDateTime, type WorkOrder } from '~/utils/workOrders';
import { getMaplibreDefault } from '~/utils/maplibreLoader';
import { getMapTilerStreetsTilesUrl } from '~/utils/maptiler';

const props = defineProps<{ order: WorkOrder; network: FieldNetwork | null; online: boolean }>();

const ZOOM = 17;
const ORDER_COLOR = '#D32F2F';
const LINE_COLOR = '#1565C0';
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

const mapEl = ref<HTMLElement | null>(null);
let map: MapLibreMap | null = null;

const note = computed(() => {
  if (!props.network) return props.online ? 'Сеть вокруг загружается…' : 'Сеть вокруг не сохранена — откройте наряд при связи';
  const parts = [`Сеть в радиусе 300 м, сохранена ${formatDateTime(props.network.savedAt)}`];
  if (props.network.truncated) parts.push('показана не вся');
  if (!props.online) parts.push('без связи — без подложки');
  return parts.join(' · ');
});

function orderPoint(): GeoJSON.FeatureCollection {
  const { lon, lat } = props.order;
  if (lon == null || lat == null) return EMPTY;
  return { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: {} }] };
}

function draw(): void {
  // не isStyleLoaded(): он ложен, пока грузятся тайлы подложки, — а без связи они не загрузятся никогда
  if (!map?.getSource('lines')) return;
  (map.getSource('lines') as GeoJSONSource | undefined)?.setData(props.network?.lines ?? EMPTY);
  (map.getSource('nodes') as GeoJSONSource | undefined)?.setData(props.network?.nodes ?? EMPTY);
  (map.getSource('order') as GeoJSONSource | undefined)?.setData(orderPoint());
}

onMounted(async () => {
  const maplibregl = await getMaplibreDefault();
  await import('maplibre-gl/dist/maplibre-gl.css');
  if (!mapEl.value || props.order.lon == null || props.order.lat == null) return;
  map = new maplibregl.Map({
    container: mapEl.value,
    center: [props.order.lon, props.order.lat],
    zoom: ZOOM,
    attributionControl: false,
    style: {
      version: 8,
      sources: {
        base: {
          type: 'raster', tiles: [getMapTilerStreetsTilesUrl()], tileSize: 256, maxzoom: 20,
          attribution: '© MapTiler © OpenStreetMap',
        },
        lines: { type: 'geojson', data: EMPTY },
        nodes: { type: 'geojson', data: EMPTY },
        order: { type: 'geojson', data: EMPTY },
      },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': '#ECEFF1' } },
        { id: 'base', type: 'raster', source: 'base' },
        { id: 'lines-casing', type: 'line', source: 'lines', paint: { 'line-color': '#FFFFFF', 'line-width': 6 } },
        { id: 'lines', type: 'line', source: 'lines', paint: { 'line-color': LINE_COLOR, 'line-width': 3 } },
        {
          id: 'nodes', type: 'circle', source: 'nodes',
          paint: { 'circle-radius': 4, 'circle-color': '#FFFFFF', 'circle-stroke-color': LINE_COLOR, 'circle-stroke-width': 2 },
        },
        {
          id: 'order', type: 'circle', source: 'order',
          paint: { 'circle-radius': 9, 'circle-color': ORDER_COLOR, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 3 },
        },
      ],
    },
  });
  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  // где бригада относительно места работ (спутники телефона работают и без связи)
  map.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }), 'top-right');
  map.on('load', draw);
  // узел или участок по нажатию: имя и тип — текстом (setText, без HTML из базы)
  map.on('click', (e) => {
    const f = map?.queryRenderedFeatures(e.point, { layers: ['nodes', 'lines'] })[0];
    if (!f || !map) return;
    const p = f.properties ?? {};
    const text = [p.title, p.node_type, p.card_type].filter(Boolean).join(' · ') || `объект ${p.id}`;
    new maplibregl.Popup({ closeButton: false, maxWidth: '260px' }).setLngLat(e.lngLat).setText(text).addTo(map);
  });
});

watch(() => props.network, draw);
watch(() => [props.order.lon, props.order.lat], () => {
  draw();
  if (props.order.lon != null && props.order.lat != null) map?.jumpTo({ center: [props.order.lon, props.order.lat] });
});

onBeforeUnmount(() => {
  map?.remove();
  map = null;
});
</script>

<style scoped>
.fom {
  position: relative;
  height: 240px;
  border-radius: 12px;
  overflow: hidden;
  background: #eceff1;
}
.fom__map {
  position: absolute;
  inset: 0;
}
.fom__note {
  position: absolute;
  left: 8px;
  top: 8px;
  max-width: calc(100% - 60px);
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.9);
  color: #37474f;
}
</style>
