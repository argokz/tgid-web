import { describe, expect, it } from 'vitest';
import {
  buildContextIndex,
  buildingAt,
  buildingNumbers,
  buildingOutline,
  buildingStreet,
  contextDistances,
  contextSnapLabel,
  entryAddress,
  findContextSnap,
  formatApproxM,
  isClipEdge,
  mergeBuildingPieces,
  planBuildingEntry,
  roadLabelsFrom,
  roadsFrom,
  tileGridXY,
  type ContextBuilding,
} from '~/utils/cadContext';
import { destination, distanceM } from '~/utils/cadGeometry';
import { buildSnapIndex, fromContextSnap, snapLabel } from '~/utils/cadSnap';
import type { LngLat } from '~/utils/lineVertices';

const O: LngLat = [76.99839, 43.37722];
/** точка в метрах от O: x — на восток, y — на север */
const at = (x: number, y: number): LngLat => destination(destination(O, x, 90), y, 0);
const SCALE = 2 ** 15 * 4096;
/** точка по пикселям сетки тайлов z15 */
const fromGrid = (x: number, y: number): LngLat => {
  const lng = (x / SCALE) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / SCALE;
  return [lng, (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))];
};
const square = (x0: number, y0: number, x1: number, y1: number): LngLat[] => [
  at(x0, y0), at(x1, y0), at(x1, y1), at(x0, y1), at(x0, y0),
];
const building = (id: string, ring: LngLat[], number?: string): ContextBuilding => ({ id, polygons: [[ring]], number });

describe('cadContext: линии обреза тайлов', () => {
  const [gx, gy] = tileGridXY(O);
  const tx = Math.floor(gx / 4096);
  const clipX = tx * 4096 + 4096 - 64;
  const y0 = Math.round(gy);

  it('отрезок по линии обреза (буфер 64) — не стена', () => {
    expect(isClipEdge(fromGrid(clipX, y0), fromGrid(clipX, y0 + 50))).toBe(true);
    expect(isClipEdge(fromGrid(tx * 4096 + 64, y0), fromGrid(tx * 4096 + 64, y0 + 50))).toBe(true);
  });

  it('стена рядом с линией обреза или по краю тайла — стена', () => {
    expect(isClipEdge(fromGrid(clipX - 1, y0), fromGrid(clipX - 1, y0 + 50))).toBe(false);
    expect(isClipEdge(fromGrid(tx * 4096, y0), fromGrid(tx * 4096, y0 + 50))).toBe(false);
    expect(isClipEdge(fromGrid(clipX, y0), fromGrid(clipX - 10, y0 + 50))).toBe(false);
  });

  it('у куска здания нет стен и углов по линии обреза, контур разорван там', () => {
    const ring = [
      fromGrid(clipX - 100, y0), fromGrid(clipX, y0), fromGrid(clipX, y0 + 100), fromGrid(clipX - 100, y0 + 100), fromGrid(clipX - 100, y0),
    ];
    const b = building('1', ring);
    const idx = buildContextIndex({ buildings: [b], roads: [], labels: [] }, O);
    const mid = fromGrid(clipX, y0 + 50);
    const s = findContextSnap(idx, mid, 3);
    expect(s).toBeNull();
    // западная стена — настоящая
    const west = findContextSnap(idx, fromGrid(clipX - 100, y0 + 50), 3);
    expect(west?.kind).toBe('wall');
    const outline = buildingOutline(b);
    expect(outline).toHaveLength(1);
    expect(outline[0]).toHaveLength(4);
  });
});

describe('cadContext: здания и улицы из тайлов', () => {
  it('куски одного здания склеиваются по id, подземные пропускаются, номер дома по id', () => {
    const numbers = buildingNumbers([
      { id: 7, properties: { number: '37' }, geometry: { type: 'Point', coordinates: O } },
      { id: 8, properties: { number: ' ' }, geometry: { type: 'Point', coordinates: O } },
    ]);
    const list = mergeBuildingPieces([
      { id: 7, properties: {}, geometry: { type: 'Polygon', coordinates: [square(0, 0, 5, 5)] } },
      { id: 7, properties: {}, geometry: { type: 'MultiPolygon', coordinates: [[square(5, 0, 10, 5)]] } },
      { id: 9, properties: { underground: true }, geometry: { type: 'Polygon', coordinates: [square(20, 0, 25, 5)] } },
      { properties: {}, geometry: { type: 'Polygon', coordinates: [square(30, 0, 35, 5)] } },
    ], numbers);
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ id: '7', number: '37' });
    expect(list[0].polygons).toHaveLength(2);
    expect(list[1].id.startsWith('anon-')).toBe(true);
    expect(numbers.has('8')).toBe(false);
  });

  it('улицы и подписи: имя по-русски, затем name и ref; без имени подпись пропускается', () => {
    const roads = roadsFrom([{ properties: { class: 'primary' }, geometry: { type: 'MultiLineString', coordinates: [[at(0, 0), at(1, 0)], [at(2, 0), at(3, 0)]] } }]);
    expect(roads).toHaveLength(2);
    expect(roads[0].cls).toBe('primary');
    const labels = roadLabelsFrom([
      { properties: { name: 'Сүйінбай даңғылы', 'name:ru': 'Проспект Суюнбая' }, geometry: { type: 'LineString', coordinates: [at(0, 0), at(1, 0)] } },
      { properties: { ref: 'A-2' }, geometry: { type: 'LineString', coordinates: [at(0, 0), at(1, 0)] } },
      { properties: {}, geometry: { type: 'LineString', coordinates: [at(0, 0), at(1, 0)] } },
    ]);
    expect(labels.map((l) => l.name)).toEqual(['Проспект Суюнбая', 'A-2']);
  });
});

describe('cadContext: привязка и размеры', () => {
  const house = building('100', square(0, 0, 20, 20), '12а');
  const idx = buildContextIndex({
    buildings: [house],
    roads: [{ cls: 'primary', coords: [at(-50, -30), at(80, -30)] }],
    labels: [{ name: 'Проспект Абая', coords: [at(-60, -30.5), at(90, -30.5)] }],
  }, O);

  it('угол здания важнее стены, стена — проекция курсора', () => {
    const corner = findContextSnap(idx, at(20.8, 20.5), 2);
    expect(corner?.kind).toBe('corner');
    expect(distanceM(corner!.coord, at(20, 20))).toBeLessThan(0.01);
    const wall = findContextSnap(idx, at(10, 21), 2);
    expect(wall?.kind).toBe('wall');
    expect(wall?.buildingNumber).toBe('12а');
    expect(distanceM(wall!.coord, at(10, 20))).toBeLessThan(0.01);
    expect(contextSnapLabel(wall!)).toBe('Стена здания (дом 12а)');
  });

  it('ось улицы с именем по ближайшей параллельной подписи', () => {
    const road = findContextSnap(idx, at(40, -31), 2);
    expect(road?.kind).toBe('road');
    expect(road?.roadName).toBe('Проспект Абая');
    expect(road!.distM).toBeCloseTo(1, 1);
    const r = fromContextSnap(road!);
    expect(r.kind).toBe('road');
    expect(snapLabel(r)).toBe('Ось: Проспект Абая');
  });

  it('адрес для ввода: ближайшая подписанная улица у стен и номер дома', () => {
    expect(buildingStreet(idx, house)).toBe('Проспект Абая');
    expect(buildingStreet(idx, house, 20)).toBeNull();
    expect(entryAddress('Проспект Абая', '12а')).toBe('Проспект Абая, 12а');
    expect(entryAddress(null, ' 12а ')).toBe('12а');
    expect(entryAddress('', undefined)).toBe('');
  });

  it('вне радиуса — нет привязки', () => {
    expect(findContextSnap(idx, at(40, 0), 2)).toBeNull();
  });

  it('размеры: до стены и до оси улицы, внутри здания', () => {
    const d = contextDistances(idx, at(10, -8), 60);
    expect(d.building!.distM).toBeCloseTo(8, 1);
    expect(d.building!.inside).toBeUndefined();
    expect(d.road!.distM).toBeCloseTo(22, 1);
    expect(d.road!.roadName).toBe('Проспект Абая');
    const inside = contextDistances(idx, at(5, 5), 60);
    expect(inside.building!.inside).toBe(true);
    expect(inside.building!.buildingNumber).toBe('12а');
    expect(buildingAt(idx, at(5, 5))?.id).toBe('100');
    expect(buildingAt(idx, at(25, 5))).toBeNull();
    const onCorner = contextDistances(idx, at(20, 20), 60);
    expect(onCorner.building!.inside).toBeUndefined();
    expect(onCorner.building!.distM).toBeLessThan(0.05);
    const far = contextDistances(idx, at(200, 200), 60);
    expect(far).toEqual({ building: null, road: null });
    expect(formatApproxM(5.24)).toBe('≈ 5,2 м');
  });
});

describe('cadContext: ввод в здание', () => {
  const house = building('100', square(0, 0, 20, 20), '37');
  const pipe = (id: number, c: LngLat[], extra: Partial<{ pipe: boolean; f: number }> = {}) => ({
    id, n1: id * 10 + 1, n2: id * 10 + 2, s: 1, f: extra.f ?? 42, pipe: extra.pipe ?? true, c,
  });

  it('ближайшая труба: врезка напротив стены, длина до стены', () => {
    const snap = buildSnapIndex({ nodes: [], lines: [pipe(1, [at(-40, -12), at(60, -12)]), pipe(2, [at(-40, -40), at(60, -40)])] }, O);
    const plan = planBuildingEntry(snap, house, 150)!;
    expect(plan.lineId).toBe(1);
    expect(plan.nodeId).toBeNull();
    expect(plan.lengthM).toBeCloseTo(12, 1);
    expect(distanceM(plan.wall, at(0, 0))).toBeLessThan(20.1);
    expect(plan.alongM[0] + plan.alongM[1]).toBeCloseTo(100, 0);
  });

  it('конец трубы у здания — ввод от узла, без врезки', () => {
    const snap = buildSnapIndex({ nodes: [], lines: [pipe(3, [at(10, -60), at(10, -15)])] }, O);
    const plan = planBuildingEntry(snap, house, 150)!;
    expect(plan.nodeId).toBe(32);
    expect(plan.lengthM).toBeCloseTo(15, 1);
  });

  it('оборудование, чужой фрагмент и дальние трубы не годятся', () => {
    const snap = buildSnapIndex({
      nodes: [],
      lines: [pipe(4, [at(-40, -5), at(60, -5)], { pipe: false }), pipe(5, [at(-40, -8), at(60, -8)], { f: 7 }), pipe(6, [at(-40, -300), at(60, -300)])],
    }, O);
    expect(planBuildingEntry(snap, house, 150, [42])).toBeNull();
    expect(planBuildingEntry(snap, house, 150)?.lineId).toBe(5);
  });
});
