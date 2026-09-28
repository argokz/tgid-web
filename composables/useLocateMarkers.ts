import maplibregl from 'maplibre-gl';
import { getCurrentInstance, onBeforeUnmount } from 'vue';

/** Точка «Показать на карте» из журналов и диалогов анализа */
export interface LocatePoint {
  longitude?: number | null;
  latitude?: number | null;
  /** Координаты в стиле диагностик ({ lng, lat }) */
  lng?: number | null;
  lat?: number | null;
  id?: number;
  label?: string;
  [key: string]: unknown;
}

/** Как показывать точку: цвет/элемент маркера, масштаб и текст подсказки */
export interface LocateSpec {
  zoom: number;
  /** Цвет стандартного маркера MapLibre */
  color?: string;
  /** Собственный DOM-элемент маркера (пульсирующая точка диагностик) */
  element?: () => HTMLElement;
  /** Текст всплывающей подсказки; без него маркер ставится без попапа */
  popupText?: (point: LocatePoint) => string;
  /** Слой 3D-вида для синхронного выделения (диафрагмы, элеваторы) */
  syncLayerId?: string;
}

export interface LocateSyncSelection {
  id: number;
  longitude: number;
  latitude: number;
  label?: string;
  layerId: string;
}

type MapLike = Pick<maplibregl.Map, 'flyTo'>;

interface Options {
  /** Синхронизация выделения с 3D-видом (cesiumStore.setSyncedSelection) */
  onSync?: (selection: LocateSyncSelection) => void;
}

const pointLngLat = (point: LocatePoint): [number, number] | null => {
  const lng = point.longitude ?? point.lng;
  const lat = point.latitude ?? point.lat;
  if (lng == null || lat == null) return null;
  return [Number(lng), Number(lat)];
};

/**
 * Маркеры «Показать на карте»: один слот на источник (журнал, диагностика).
 * Повторный locate в тот же слот переставляет маркер; все маркеры снимаются при размонтировании.
 */
export function useLocateMarkers(getMap: () => MapLike | null | undefined, options: Options = {}) {
  const markers = new Map<string, maplibregl.Marker>();

  const remove = (slot: string) => {
    markers.get(slot)?.remove();
    markers.delete(slot);
  };

  const clearAll = () => {
    for (const marker of markers.values()) marker.remove();
    markers.clear();
  };

  const locate = (slot: string, point: LocatePoint, spec: LocateSpec) => {
    const map = getMap();
    if (!map) return null;
    const lngLat = pointLngLat(point);
    if (!lngLat) return null;
    if (spec.syncLayerId && options.onSync) {
      options.onSync({
        id: Number(point.id),
        longitude: lngLat[0],
        latitude: lngLat[1],
        label: point.label,
        layerId: spec.syncLayerId,
      });
    }
    map.flyTo({ center: lngLat, zoom: spec.zoom, duration: 1400, essential: true });
    remove(slot);
    const marker = new maplibregl.Marker(spec.element ? { element: spec.element() } : { color: spec.color }).setLngLat(lngLat);
    if (spec.popupText) marker.setPopup(new maplibregl.Popup({ offset: 24 }).setText(spec.popupText(point)));
    marker.addTo(map as maplibregl.Map);
    if (spec.popupText) marker.togglePopup();
    markers.set(slot, marker);
    return marker;
  };

  /** Обработчики событий диалогов: slot → (point) => locate(slot, point, spec) */
  const handlers = <K extends string>(specs: Record<K, LocateSpec>) => {
    const out = {} as Record<K, (point: LocatePoint) => void>;
    for (const slot of Object.keys(specs) as K[]) {
      out[slot] = (point: LocatePoint) => {
        locate(slot, point, specs[slot]);
      };
    }
    return out;
  };

  if (getCurrentInstance()) onBeforeUnmount(clearAll);

  return { locate, handlers, remove, clearAll, has: (slot: string) => markers.has(slot) };
}
