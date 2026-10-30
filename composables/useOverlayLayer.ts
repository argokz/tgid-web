import type maplibregl from 'maplibre-gl';
import { getCurrentInstance, onBeforeUnmount } from 'vue';

/** Слой оверлея без source: источник подставляется из самого оверлея */
export type OverlayLayerSpec = { id: string; type: string; [key: string]: any };

type MapLike = Pick<
  maplibregl.Map,
  'addSource' | 'addLayer' | 'getSource' | 'getLayer' | 'removeLayer' | 'removeSource' | 'setLayoutProperty' | 'setPaintProperty'
> & Partial<Pick<maplibregl.Map, 'once'>>;

/** Стиль карты ещё грузится (смена подложки, первая загрузка) — повторить, когда карта успокоится */
const STYLE_RETRIES = 20;
const styleNotLoaded = (e: unknown) => /not done loading/i.test(String((e as Error)?.message ?? e));

interface Options {
  /** Слои, которые снимаются при clear() даже если show() в этом сеансе не вызывался */
  layerIds?: string[];
}

/**
 * Временный GeoJSON-оверлей поверх карты (маршрут пьезометра, зона отключения,
 * гидравлический режим): один источник и несколько слоёв над ним.
 * show() заменяет прежнее содержимое, clear() снимает слои и источник;
 * при размонтировании компонента оверлей снимается автоматически.
 */
export function useOverlayLayer(getMap: () => MapLike | null | undefined, sourceId: string, options: Options = {}) {
  let layerIds: string[] = [...(options.layerIds ?? [])];

  const clear = () => {
    const map = getMap();
    if (!map) return;
    for (const id of [...layerIds].reverse()) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    if (map.getSource(sourceId)) map.removeSource(sourceId);
  };

  let pending = 0;

  /** Снять прежний оверлей и нарисовать новый; false — карты нет. Стиль ещё грузится — нарисуется позже */
  const show = (data: any, layers: OverlayLayerSpec[], attempt = 0): boolean => {
    const map = getMap();
    if (!map) return false;
    const call = ++pending;
    clear();
    try {
      map.addSource(sourceId, { type: 'geojson', data });
      for (const layer of layers) {
        if (!layerIds.includes(layer.id)) layerIds.push(layer.id);
        map.addLayer({ ...layer, source: sourceId } as any);
      }
    } catch (e) {
      if (!styleNotLoaded(e) || !map.once || attempt >= STYLE_RETRIES) throw e;
      clear();
      // новый show() отменяет отложенный: рисуется последнее
      map.once('idle', () => {
        if (call === pending) show(data, layers, attempt + 1);
      });
    }
    return true;
  };

  const isShown = () => Boolean(getMap()?.getSource(sourceId));

  const setLayout = (layerId: string, name: string, value: unknown) => {
    const map = getMap();
    if (map?.getLayer(layerId)) map.setLayoutProperty(layerId, name, value as any);
  };

  const setPaint = (layerId: string, name: string, value: unknown) => {
    const map = getMap();
    if (map?.getLayer(layerId)) map.setPaintProperty(layerId, name, value as any);
  };

  if (getCurrentInstance()) {
    onBeforeUnmount(() => {
      try {
        clear();
      } catch {
        // карта уже уничтожена — снимать нечего
      }
    });
  }

  return {
    sourceId,
    get layerIds() {
      return [...layerIds];
    },
    show,
    clear,
    isShown,
    setLayout,
    setPaint,
  };
}
