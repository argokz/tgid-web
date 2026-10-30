/**
 * Разовый выбор точки на карте: следующий клик — точка, Esc — отмена. Пока выбор идёт, клики карты не выбирают
 * объекты сети и не трассируют (общий признак activeDrawMode из useMapDraw: обработчики смотрят isMapMeasureActive).
 * Занята другим режимом (измерение) — выбор не начинается.
 */
import type { Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';
import { activeDrawMode } from '~/composables/useMapDraw';

export interface PickedPoint {
  lon: number;
  lat: number;
  zoom: number;
}

let cancelCurrent: (() => void) | null = null;

/** Отменить идущий выбор (диалог закрыли) */
export function cancelMapPointPick(): void {
  cancelCurrent?.();
}

export function pickMapPoint(map: MapLibreMap | null | undefined): Promise<PickedPoint | null> {
  if (!map || activeDrawMode.value !== 'none') return Promise.resolve(null);
  return new Promise((resolve) => {
    const canvas = map.getCanvas();
    const prevCursor = canvas.style.cursor;
    const finish = (point: PickedPoint | null) => {
      map.off('click', onClick);
      window.removeEventListener('keydown', onKey, true);
      canvas.style.cursor = prevCursor;
      activeDrawMode.value = 'none';
      cancelCurrent = null;
      resolve(point);
    };
    const onClick = (e: MapMouseEvent) => finish({ lon: e.lngLat.lng, lat: e.lngLat.lat, zoom: map.getZoom() });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      finish(null);
    };
    activeDrawMode.value = 'pick-point';
    canvas.style.cursor = 'crosshair';
    map.on('click', onClick);
    window.addEventListener('keydown', onKey, true);
    cancelCurrent = () => finish(null);
  });
}
