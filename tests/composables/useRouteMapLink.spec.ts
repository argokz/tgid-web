import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import { useRouteMapLink } from '~/composables/useRouteMapLink';
import { nearestPointIndex } from '~/utils/routeFocus';

const show = vi.fn();
vi.mock('~/composables/useSelectionHighlight', () => ({
  useSelectionHighlight: () => ({ show, clear: vi.fn(), remove: vi.fn(), layerIds: [], sourceId: 's' }),
}));

/** Карта-заглушка: проекция lng/lat → px как x = lng * 100, y = lat * 100; обработчики событий по типу */
const makeMap = () => {
  const handlers: Record<string, Array<(e: any) => void>> = {};
  return {
    handlers,
    project: ([lng, lat]: [number, number]) => ({ x: lng * 100, y: lat * 100 }),
    on: (type: string, fn: (e: any) => void) => { (handlers[type] ||= []).push(fn); },
    off: (type: string, fn: (e: any) => void) => { handlers[type] = (handlers[type] || []).filter((h) => h !== fn); },
    fire: (type: string, event: any = {}) => (handlers[type] || []).forEach((h) => h(event)),
  };
};

const nodes = [
  { node_id: 10, lng: 1, lat: 1 },
  { node_id: 20, lng: 2, lat: 1 },
  { node_id: 30, lng: null, lat: null },
];

describe('nearestPointIndex', () => {
  it('ближайшая точка в допуске; без координат пропускается; дальше допуска — null', () => {
    const points = [{ x: 0, y: 0 }, null, { x: 10, y: 0 }];
    expect(nearestPointIndex(points, { x: 8, y: 1 })).toBe(2);
    expect(nearestPointIndex(points, { x: 1, y: 1 })).toBe(0);
    expect(nearestPointIndex(points, { x: 100, y: 100 })).toBeNull();
  });
});

describe('useRouteMapLink', () => {
  let frames: Array<() => void> = [];
  beforeEach(() => {
    frames = [];
    show.mockClear();
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => { frames.push(cb); return frames.length; });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
  });
  afterEach(() => vi.unstubAllGlobals());
  const flushFrames = () => { const run = frames; frames = []; run.forEach((cb) => cb()); };

  it('наведение на график: подсветка узла не чаще кадра и только при смене узла', () => {
    const map = makeMap();
    const link = useRouteMapLink(() => map, () => nodes, () => true);
    link.focusFromChart(10);
    link.focusFromChart(20);
    expect(show).not.toHaveBeenCalled();
    flushFrames();
    expect(show).toHaveBeenCalledTimes(1);
    expect(show.mock.calls[0][0].geometry.coordinates).toEqual([2, 1]);
    link.focusFromChart(20);
    flushFrames();
    expect(show).toHaveBeenCalledTimes(1);
    // узел без координат — подсветка снимается
    link.focusFromChart(30);
    flushFrames();
    expect(show).toHaveBeenLastCalledWith(null);
  });

  it('курсор над узлом на карте → mapFocusId; ушёл с карты — null; панель закрыта — слушатели сняты', async () => {
    const map = makeMap();
    const active = ref(true);
    const link = useRouteMapLink(() => map, () => nodes, () => active.value);
    map.fire('mousemove', { point: { x: 198, y: 103 } });
    expect(link.mapFocusId.value).toBeNull();
    flushFrames();
    expect(link.mapFocusId.value).toBe(20);
    map.fire('mouseout');
    expect(link.mapFocusId.value).toBeNull();

    link.focusFromChart(10);
    flushFrames();
    active.value = false;
    await nextTick();
    expect(map.handlers.mousemove).toHaveLength(0);
    expect(show).toHaveBeenLastCalledWith(null);
  });
});
