import { describe, expect, it } from 'vitest';
import {
  bearingDeg,
  distanceM,
  formatMeters,
  localFrame,
  polylineLengthM,
  projectOnSegment,
  turnAngleDeg,
} from '~/utils/cadGeometry';
import { buildSnapIndex, findSnap, snapLabel, type SnapData } from '~/utils/cadSnap';
import {
  chainRequestPoints,
  finalizePoints,
  finishesTrace,
  pointFromClick,
  samePoint,
  traceCollection,
  traceLengths,
  traceOutcome,
  type TracePoint,
} from '~/utils/cadChain';
import type { LngLat } from '~/utils/lineVertices';

const ORIGIN: LngLat = [76.9, 43.24];
const f = localFrame(ORIGIN);
/** точка в x/y метрах от ORIGIN */
const at = (x: number, y: number): LngLat => f.toLngLat([x, y]);

describe('cadGeometry', () => {
  it('меряет метры на земле, а не градусы', () => {
    // 100 м на восток и на север от Алматы — 100 м, хотя в градусах разные
    expect(distanceM(ORIGIN, at(100, 0))).toBeCloseTo(100, 1);
    expect(distanceM(ORIGIN, at(0, 100))).toBeCloseTo(100, 1);
    expect(polylineLengthM([ORIGIN, at(30, 0), at(30, 40)])).toBeCloseTo(70, 1);
  });

  it('проекция на отрезок, азимут и угол поворота', () => {
    const pr = projectOnSegment([5, 3], [0, 0], [10, 0]);
    expect(pr.point).toEqual([5, 0]);
    expect(pr.t).toBeCloseTo(0.5);
    expect(pr.dist).toBeCloseTo(3);
    expect(projectOnSegment([-4, 0], [0, 0], [10, 0]).t).toBe(0);
    expect(bearingDeg(ORIGIN, at(0, 10))).toBeCloseTo(0, 3);
    expect(bearingDeg(ORIGIN, at(10, 0))).toBeCloseTo(90, 3);
    expect(turnAngleDeg(at(-10, 0), ORIGIN, at(10, 0))).toBeCloseTo(0, 3);
    expect(turnAngleDeg(at(-10, 0), ORIGIN, at(0, 10))).toBeCloseTo(90, 3);
    expect(turnAngleDeg(ORIGIN, ORIGIN, at(1, 0))).toBeNull();
    expect(formatMeters(12.345)).toBe('12,35 м');
    expect(formatMeters(1500)).toBe('1,50 км');
  });
});

const DATA: SnapData = {
  too_large: false,
  truncated: false,
  nodes: [
    { id: 1, c: at(0, 0), f: 74, s: 1 },
    { id: 2, c: at(100, 0), f: 74, s: 1 },
    { id: 3, c: at(0, 50), f: 99, s: 1 },
  ],
  lines: [
    // 1 → излом (50, 20) → 2
    { id: 10, n1: 1, n2: 2, s: 1, f: 74, pipe: true, c: [at(0, 0), at(50, 20), at(100, 0)] },
    { id: 11, n1: 3, n2: 1, s: 1, f: 99, pipe: false, c: [at(0, 50), at(0, 0)] },
  ],
};

describe('cadSnap', () => {
  const index = buildSnapIndex(DATA, ORIGIN, 10);

  it('узел важнее трубы, излом важнее точки на трубе', () => {
    const node = findSnap(index, at(1, 1), 5);
    expect(node).toMatchObject({ kind: 'node', nodeId: 1 });
    const bend = findSnap(index, at(51, 19), 5);
    expect(bend).toMatchObject({ kind: 'vertex', lineId: 10 });
    expect(bend?.coord).toEqual(DATA.lines[0].c[1]);
  });

  it('врезка в трубу — проекция с расстоянием до концов по трассе', () => {
    const s = findSnap(index, at(25, 13), 5);
    expect(s?.kind).toBe('segment');
    expect(s?.lineId).toBe(10);
    const half = Math.hypot(50, 20);
    expect(s!.alongM![0] + s!.alongM![1]).toBeCloseTo(2 * half, 1);
    expect(snapLabel(s!)).toMatch(/^Врезка в уч\. 10: /);
  });

  it('середина участка — по длине трассы', () => {
    const second = findSnap(index, at(0, 25.5), 2);
    expect(second).toMatchObject({ kind: 'midpoint', lineId: 11, pipe: false });
    expect(distanceM(second!.coord, at(0, 25))).toBeLessThan(0.01);
  });

  it('фильтр фрагментов, исключения, только узлы и радиус', () => {
    expect(findSnap(index, at(0, 49), 3, { fragmentIds: [74] })).toBeNull();
    expect(findSnap(index, at(0, 49), 3)).toMatchObject({ kind: 'node', nodeId: 3 });
    expect(findSnap(index, at(1, 1), 5, { excludeNodes: [1], fragmentIds: [74] })?.kind).toBe('segment');
    expect(findSnap(index, at(25, 13), 5, { lines: false })).toBeNull();
    expect(findSnap(index, at(25, 40), 5)).toBeNull();
  });
});

describe('cadChain', () => {
  const node = (id: number, x: number, y: number): TracePoint => ({ kind: 'node', nodeId: id, coord: at(x, y) });

  it('точка клика по привязке', () => {
    expect(pointFromClick({ kind: 'node', nodeId: 5, coord: at(1, 1), distM: 0 }, at(2, 2), false))
      .toEqual({ kind: 'node', nodeId: 5, coord: at(1, 1) });
    expect(pointFromClick({ kind: 'midpoint', lineId: 7, coord: at(1, 1), distM: 0 }, at(2, 2), false).kind).toBe('tap');
    expect(pointFromClick(null, at(2, 2), true).kind).toBe('new');
    expect(pointFromClick(null, at(2, 2), false).kind).toBe('vertex');
  });

  it('узел или труба завершают трассу, Shift — продолжает', () => {
    const start = [node(1, 0, 0)];
    expect(finishesTrace(node(2, 10, 0), start, false)).toBe(true);
    expect(finishesTrace(node(2, 10, 0), start, true)).toBe(false);
    expect(finishesTrace(node(2, 10, 0), [], false)).toBe(false);
    expect(finishesTrace({ kind: 'vertex', coord: at(5, 5) }, start, false)).toBe(false);
    expect(samePoint(node(1, 0, 0), node(1, 3, 3))).toBe(true);
    expect(samePoint({ kind: 'vertex', coord: at(5, 5) }, { kind: 'vertex', coord: at(5, 5.001) })).toBe(true);
  });

  it('итог трассы: узел, разрезание или цепочка; последний излом — новый узел', () => {
    expect(traceOutcome([])).toEqual({ action: 'none' });
    expect(traceOutcome([{ kind: 'new', coord: at(1, 1) }])).toEqual({ action: 'node', coord: at(1, 1) });
    expect(traceOutcome([{ kind: 'tap', lineId: 9, coord: at(1, 1) }]))
      .toEqual({ action: 'split', lineId: 9, coord: at(1, 1) });
    const pts: TracePoint[] = [node(1, 0, 0), { kind: 'vertex', coord: at(5, 5) }, { kind: 'vertex', coord: at(9, 5) }];
    const out = traceOutcome(pts);
    expect(out.action).toBe('chain');
    expect(out.action === 'chain' && out.points.map((p) => p.kind)).toEqual(['node', 'vertex', 'new']);
    expect(pts[2].kind).toBe('vertex'); // исходные точки не меняются
    expect(finalizePoints([node(1, 0, 0)])[0].kind).toBe('node');
  });

  it('запрос к серверу и длины', () => {
    const pts: TracePoint[] = [
      node(1, 0, 0),
      { kind: 'vertex', coord: at(30, 0) },
      { kind: 'tap', lineId: 4, coord: at(30, 40) },
      { kind: 'new', coord: at(60, 40) },
    ];
    expect(chainRequestPoints(pts)).toEqual([
      { kind: 'node', node_id: 1 },
      { kind: 'vertex', lng: pts[1].coord[0], lat: pts[1].coord[1] },
      { kind: 'tap', line_id: 4, lng: pts[2].coord[0], lat: pts[2].coord[1] },
      { kind: 'new', lng: pts[3].coord[0], lat: pts[3].coord[1] },
    ]);
    const l = traceLengths(pts, at(60, 50));
    expect(l.totalM).toBeCloseTo(110, 0);
    expect(l.segmentM).toBeCloseTo(10, 0);
    expect(l.lastM).toBeCloseTo(10, 0);
    const fc = traceCollection(pts, at(60, 50), null);
    expect(fc.features.map((x: any) => x.properties.role)).toEqual(['trace', 'rubber', 'point', 'point', 'point', 'point']);
  });
});
