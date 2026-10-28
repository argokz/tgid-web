import type { Map as MapLibreMap } from 'maplibre-gl';
import { watch } from 'vue';
import { useFragmentStore } from '~/stores/fragmentStore';
import { useLayerStore } from '~/stores/layerStore';
import { formatPermalinkHash, parsePermalinkHash, type PermalinkState } from '~/utils/mapPermalink';

/**
 * Ссылка на вид карты в адресе (utils/mapPermalink.ts).
 * - applyFromUrl(): при открытии ссылки — вид, фрагменты и слои из «#…» (после загрузки карты и слоёв);
 * - follow(): адрес обновляется сам при движении карты и смене фрагментов/слоёв (без перехода);
 * - copyLink(): полная ссылка в буфер обмена.
 */
export function useMapPermalink() {
  const fragmentStore = useFragmentStore();
  const layerStore = useLayerStore();
  let map: MapLibreMap | null = null;

  const currentState = (target: MapLibreMap | null = map): PermalinkState => {
    const state: PermalinkState = {
      fragments: [...fragmentStore.visibleFragments],
      layers: [...layerStore.visibleGeoServerLayers],
    };
    if (target) {
      const c = target.getCenter();
      state.view = { center: [c.lng, c.lat], zoom: target.getZoom(), bearing: target.getBearing(), pitch: target.getPitch() };
    }
    return state;
  };

  const currentUrl = (target: MapLibreMap | null = map): string => {
    const { origin, pathname, search } = window.location;
    return `${origin}${pathname}${search}${formatPermalinkHash(currentState(target))}`;
  };

  const writeUrl = () => {
    if (!map) return;
    const hash = formatPermalinkHash(currentState());
    if (hash === window.location.hash) return;
    // state роутера сохраняем: vue-router хранит в нём позицию прокрутки и навигацию
    history.replaceState(history.state, '', `${window.location.pathname}${window.location.search}${hash}`);
  };

  /** Применить ссылку из адреса. → true, если в адресе был вид карты или выбор. */
  const applyFromUrl = async (target: MapLibreMap): Promise<boolean> => {
    map = target;
    const state = parsePermalinkHash(window.location.hash);
    if (!state) return false;
    if (state.view) {
      target.jumpTo({ center: state.view.center, zoom: state.view.zoom, bearing: state.view.bearing, pitch: state.view.pitch });
    }
    if (state.fragments?.length) {
      // карту не двигать к охвату фрагментов: вид уже задан ссылкой
      fragmentStore.applyVisibleFragmentsSelection(state.fragments, !state.view);
    }
    if (state.layers?.length) {
      const known = new Set(layerStore.geoServerLayers.map((l) => l.layerId));
      const layers = state.layers.filter((id) => known.has(id));
      if (layers.length) await layerStore.applyVisibleLayersSelection(layers);
    }
    return true;
  };

  /** Обновлять адрес вслед за картой. → функция отписки. */
  const follow = (target: MapLibreMap): (() => void) => {
    map = target;
    target.on('moveend', writeUrl);
    const stopWatch = watch(
      () => [fragmentStore.visibleFragments.join(','), layerStore.visibleGeoServerLayers.join(',')],
      writeUrl,
    );
    return () => {
      target.off('moveend', writeUrl);
      stopWatch();
    };
  };

  /** Скопировать ссылку на текущий вид. → текст ссылки (если буфер обмена недоступен — показать его). */
  const copyLink = async (target: MapLibreMap): Promise<{ url: string; copied: boolean }> => {
    const url = currentUrl(target);
    try {
      await navigator.clipboard.writeText(url);
      return { url, copied: true };
    } catch {
      return { url, copied: false };
    }
  };

  return { applyFromUrl, follow, copyLink, currentUrl };
}
