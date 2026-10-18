/**
 * Индекс привязок CAD-редактора: точная геометрия сети в окне карты (GET topology/snap-data).
 *
 * Загружается при включении и после каждого сдвига карты (moveend, с задержкой), сбрасывается
 * после сохранения (invalidate). Окно с запасом в половину экрана — привязка у края работает
 * без ожидания. Слишком большое окно (мелкий масштаб) — status 'zoom-in': привязки нет,
 * оператор видит подсказку «приблизьте карту».
 */
import { ref, shallowRef } from 'vue';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { fastApiService } from '~/services/fastApiService';
import { buildSnapIndex, type SnapIndex } from '~/utils/cadSnap';
import type { LngLat } from '~/utils/lineVertices';

export type SnapIndexStatus = 'off' | 'loading' | 'ready' | 'zoom-in' | 'error';

const RELOAD_DELAY_MS = 250;

export function useSnapIndex(getMap: () => MapLibreMap | null | undefined, getFragmentIds: () => readonly number[]) {
  const index = shallowRef<SnapIndex | null>(null);
  const status = ref<SnapIndexStatus>('off');
  const truncated = ref(false);
  let loadedBounds: [number, number, number, number] | null = null;
  let loadedFragments = '';
  let timer: ReturnType<typeof setTimeout> | null = null;
  let seq = 0;
  let active = false;

  const covers = (outer: [number, number, number, number], inner: [number, number, number, number]) =>
    outer[0] <= inner[0] && outer[1] <= inner[1] && outer[2] >= inner[2] && outer[3] >= inner[3];

  const load = async (force = false) => {
    const map = getMap();
    if (!map || !active) return;
    const b = map.getBounds();
    const view: [number, number, number, number] = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
    const fragments = [...getFragmentIds()].sort((a, c) => a - c);
    const fragKey = fragments.join(',');
    if (!force && loadedBounds && fragKey === loadedFragments && status.value === 'ready' && covers(loadedBounds, view)) return;
    // запас в половину окна с каждой стороны
    const dx = (view[2] - view[0]) / 2;
    const dy = (view[3] - view[1]) / 2;
    const bbox: [number, number, number, number] = [view[0] - dx, view[1] - dy, view[2] + dx, view[3] + dy];
    const my = ++seq;
    status.value = 'loading';
    try {
      let data = await fastApiService.getSnapData(bbox, fragments);
      if (data.too_large) {
        // окно с запасом велико — пробуем ровно видимое
        data = await fastApiService.getSnapData(view, fragments);
        bbox.splice(0, 4, ...view);
      }
      if (my !== seq) return;
      if (data.too_large) {
        index.value = null;
        loadedBounds = null;
        status.value = 'zoom-in';
        return;
      }
      const center: LngLat = [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
      index.value = buildSnapIndex(data, center);
      truncated.value = data.truncated;
      loadedBounds = bbox;
      loadedFragments = fragKey;
      status.value = 'ready';
    } catch {
      if (my !== seq) return;
      index.value = null;
      loadedBounds = null;
      status.value = 'error';
    }
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void load(), RELOAD_DELAY_MS);
  };

  const start = () => {
    const map = getMap();
    if (!map || active) return;
    active = true;
    map.on('moveend', schedule);
    void load(true);
  };

  const stop = () => {
    active = false;
    seq++;
    if (timer) clearTimeout(timer);
    getMap()?.off('moveend', schedule);
    index.value = null;
    loadedBounds = null;
    status.value = 'off';
  };

  /** Сеть изменилась (сохранение, отмена) — перечитать окно */
  const invalidate = () => {
    if (active) void load(true);
  };

  return { index, status, truncated, start, stop, invalidate, reload: () => load(true) };
}
