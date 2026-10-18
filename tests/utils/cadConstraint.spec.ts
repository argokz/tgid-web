import { describe, expect, it } from 'vitest';
import {
  bearingDeg,
  destination,
  distanceM,
  formatDeg,
  formatTurn,
  localFrame,
  normalizeDeg180,
  signedTurnDeg,
  turnArc,
  vertexAngles,
} from '~/utils/cadGeometry';
import { constrainPoint } from '~/utils/cadConstraint';
import { cadInputKey, cadInputLocks, EMPTY_CAD_INPUT, parseCadNumber, type CadInputState } from '~/utils/cadInput';
import { buildSnapIndex, nearestPipeBearing, pipeBearingsAt, type SnapData } from '~/utils/cadSnap';
import { traceCollection, type TracePoint } from '~/utils/cadChain';
import { angleLabels } from '~/composables/useMapDraw';
import type { LngLat } from '~/utils/lineVertices';

const ORIGIN: LngLat = [76.9, 43.24];
const f = localFrame(ORIGIN);
const at = (x: number, y: number): LngLat => f.toLngLat([x, y]);
const xy = (p: LngLat) => f.toXY(p);

describe('cadGeometry: углы и точка по длине', () => {
  it('destination — точка на заданном расстоянии и азимуте', () => {
    const p = destination(ORIGIN, 50, 90);
    expect(distanceM(ORIGIN, p)).toBeCloseTo(50, 2);
    expect(bearingDeg(ORIGIN, p)).toBeCloseTo(90, 3);
    const [x, y] = xy(destination(ORIGIN, 10, 225));
    expect(x).toBeCloseTo(-7.071, 2);
    expect(y).toBeCloseTo(-7.071, 2);
  });

  it('поворот со знаком: + вправо, − влево', () => {
    expect(signedTurnDeg(0, 90)).toBeCloseTo(90);
    expect(signedTurnDeg(0, 270)).toBeCloseTo(-90);
    expect(signedTurnDeg(350, 10)).toBeCloseTo(20);
    expect(normalizeDeg180(540)).toBeCloseTo(180);
  });

  it('vertexAngles: Г-образная трасса — поворот 90°, внутренний угол 90°', () => {
    const angles = vertexAngles([at(0, 0), at(0, 20), at(15, 20)]);
    expect(angles).toHaveLength(1);
    expect(angles[0].turnDeg).toBeCloseTo(90, 3);
    expect(angles[0].innerDeg).toBeCloseTo(90, 3);
    // совпавшие точки пропускаются
    expect(vertexAngles([at(0, 0), at(0, 0), at(5, 0)])).toEqual([]);
  });

  it('подписи углов', () => {
    expect(formatDeg(90)).toBe('90°');
    expect(formatDeg(22.46)).toBe('22,5°');
    expect(formatTurn(-45)).toBe('поворот 45° влево');
    expect(formatTurn(0.01)).toBe('прямо');
  });

  it('дуга угла — от продолжения входящего направления к исходящему, на радиусе', () => {
    const arc = turnArc(ORIGIN, 0, 90, 5, 4);
    expect(arc).toHaveLength(5);
    expect(bearingDeg(ORIGIN, arc[0])).toBeCloseTo(0, 3);
    expect(bearingDeg(ORIGIN, arc[4])).toBeCloseTo(90, 3);
    for (const p of arc) expect(distanceM(ORIGIN, p)).toBeCloseTo(5, 2);
  });
});

describe('cadConstraint', () => {
  const base = { last: at(0, 0), prev: at(0, -10), toleranceM: 2 };

  it('без ограничений — курсор как есть', () => {
    const r = constrainPoint({ ...base, cursor: at(3, 7) });
    expect(r.guide).toBeNull();
    expect(xy(r.coord)[0]).toBeCloseTo(3, 6);
    expect(r.turnDeg).toBeCloseTo(signedTurnDeg(0, bearingDeg(at(0, 0), at(3, 7))), 6);
  });

  it('полярная привязка: курсор у луча 90° — точка ровно на луче (проекция)', () => {
    const r = constrainPoint({ ...base, cursor: at(20, 1), polarStepDeg: 45 });
    expect(r.guide).toBe('polar');
    expect(r.bearing).toBeCloseTo(90, 6);
    expect(r.turnDeg).toBeCloseTo(90, 6);
    const [x, y] = xy(r.coord);
    expect(x).toBeCloseTo(20, 2);
    expect(y).toBeCloseTo(0, 2);
  });

  it('полярная привязка: далеко от луча (вне допуска) — без прилипания', () => {
    const r = constrainPoint({ ...base, cursor: at(20, 9), polarStepDeg: 45 });
    expect(r.guide).toBeNull();
  });

  it('шаг считается от предыдущего участка, а не от севера', () => {
    // предыдущий участок на северо-восток (45°): поворот на 90° вправо — азимут 135°
    const r = constrainPoint({
      last: at(0, 0), prev: at(-10, -10), cursor: destination(at(0, 0), 30, 133), polarStepDeg: 90, toleranceM: 2,
    });
    expect(r.guide).toBe('polar');
    expect(r.bearing).toBeCloseTo(135, 3);
    expect(r.turnDeg).toBeCloseTo(90, 6);
  });

  it('Shift (орто) — по шагу 90° без допуска', () => {
    const r = constrainPoint({ ...base, cursor: at(20, 9), ortho: true });
    expect(r.guide).toBe('polar');
    expect(r.bearing).toBeCloseTo(90, 6);
  });

  it('направляющие ∥ и ⊥ трубе', () => {
    const pipe = 30; // труба по азимуту 30°
    const par = constrainPoint({ ...base, prev: null, cursor: destination(at(0, 0), 40, 211), polarStepDeg: 90, guideBearings: [pipe] });
    expect(par.guide).toBe('parallel');
    expect(par.bearing).toBeCloseTo(210, 6);
    const perp = constrainPoint({ ...base, prev: null, cursor: destination(at(0, 0), 40, 121), polarStepDeg: 90, guideBearings: [pipe] });
    expect(perp.guide).toBe('perpendicular');
    expect(perp.bearing).toBeCloseTo(120, 6);
    // полярная привязка выключена — направляющих нет
    expect(constrainPoint({ ...base, prev: null, cursor: destination(at(0, 0), 40, 121), guideBearings: [pipe] }).guide).toBeNull();
  });

  it('замок длины: точка на заданном расстоянии в сторону курсора', () => {
    const r = constrainPoint({ ...base, cursor: at(30, 40), lengthM: 12.5 });
    expect(r.lockedLength).toBe(true);
    expect(distanceM(at(0, 0), r.coord)).toBeCloseTo(12.5, 3);
    expect(bearingDeg(at(0, 0), r.coord)).toBeCloseTo(bearingDeg(at(0, 0), at(30, 40)), 3);
  });

  it('замок угла: поворот от предыдущего участка; длина — проекция курсора', () => {
    const r = constrainPoint({ ...base, cursor: at(-20, 3), angleDeg: -90 });
    expect(r.lockedAngle).toBe(true);
    expect(r.bearing).toBeCloseTo(270, 6);
    expect(r.lengthM).toBeCloseTo(20, 2);
  });

  it('замок длины и угла: первый участок — азимут от севера', () => {
    const r = constrainPoint({ last: at(0, 0), prev: null, cursor: at(1, 1), lengthM: 10, angleDeg: 180, toleranceM: 2 });
    const [x, y] = xy(r.coord);
    expect(x).toBeCloseTo(0, 3);
    expect(y).toBeCloseTo(-10, 3);
    expect(r.turnDeg).toBeNull();
  });
});

describe('cadInput', () => {
  const press = (s: CadInputState, ...keys: (string | { key: string; shiftKey?: boolean })[]) => {
    let st = s;
    let last = { handled: false, place: false as boolean | undefined };
    for (const k of keys) {
      const step = cadInputKey(st, typeof k === 'string' ? { key: k } : k);
      st = step.state;
      last = { handled: step.handled, place: step.place };
    }
    return { state: st, ...last };
  };

  it('цифры — длина, Tab — угол, минус — поворот влево', () => {
    const r = press(EMPTY_CAD_INPUT, '1', '2', ',', '5', 'Tab', '-', '9', '0');
    expect(r.state).toEqual({ length: '12,5', angle: '-90', field: 'angle' });
    expect(cadInputLocks(r.state)).toEqual({ lengthM: 12.5, angleDeg: -90 });
  });

  it('минус без поля начинает ввод угла; в длине минус не пишется', () => {
    expect(press(EMPTY_CAD_INPUT, '-', '4', '5').state).toEqual({ length: '', angle: '-45', field: 'angle' });
    expect(press(EMPTY_CAD_INPUT, '5', '-').state.length).toBe('5');
  });

  it('точка или запятая — одна, ведущий ноль добавляется', () => {
    expect(press(EMPTY_CAD_INPUT, '.', '5', ',', '1').state.length).toBe('0,51');
  });

  it('Enter со значением — поставить точку; без значений — трассе', () => {
    expect(press(EMPTY_CAD_INPUT, '7', 'Enter')).toMatchObject({ handled: true, place: true });
    expect(press(EMPTY_CAD_INPUT, 'Enter')).toMatchObject({ handled: false });
    // поле открыто, но пусто: Enter закрывает ввод
    expect(press(EMPTY_CAD_INPUT, 'Tab', 'Enter')).toMatchObject({ handled: true, place: undefined });
  });

  it('Backspace стирает символ, в пустом поле — закрывает ввод, без ввода — трассе', () => {
    const r = press(EMPTY_CAD_INPUT, '1', '0', 'Backspace');
    expect(r.state.length).toBe('1');
    const closed = press(r.state, 'Backspace', 'Backspace');
    expect(closed.state.field).toBeNull();
    expect(press(EMPTY_CAD_INPUT, 'Backspace').handled).toBe(false);
  });

  it('Esc сбрасывает ввод, без ввода — трассе', () => {
    expect(press(EMPTY_CAD_INPUT, '3', 'Escape').state).toEqual(EMPTY_CAD_INPUT);
    expect(press(EMPTY_CAD_INPUT, 'Escape').handled).toBe(false);
  });

  it('с Ctrl/Alt — не ввод (Ctrl+Z остаётся отменой)', () => {
    expect(cadInputKey(EMPTY_CAD_INPUT, { key: '1', ctrlKey: true }).handled).toBe(false);
  });

  it('parseCadNumber', () => {
    expect(parseCadNumber('12,5')).toBe(12.5);
    expect(parseCadNumber('-')).toBeNull();
    expect(parseCadNumber('')).toBeNull();
    // длина 0 — не замок
    expect(cadInputLocks({ length: '0', angle: '', field: 'length' }).lengthM).toBeNull();
  });
});

describe('cadSnap: направления соседних труб', () => {
  const data: Pick<SnapData, 'nodes' | 'lines'> = {
    nodes: [
      { id: 1, c: at(0, 0), f: 7, s: 1 },
      { id: 2, c: at(0, 50), f: 7, s: 1 },
      { id: 3, c: at(40, 0), f: 7, s: 1 },
    ],
    lines: [
      { id: 10, n1: 1, n2: 2, s: 1, f: 7, pipe: true, c: [at(0, 0), at(0, 50)] },
      { id: 11, n1: 3, n2: 1, s: 1, f: 7, pipe: true, c: [at(40, 0), at(20, 10), at(0, 0)] },
    ],
  };
  const index = buildSnapIndex(data, ORIGIN);

  it('у узла — первые отрезки всех его участков (от узла)', () => {
    const b = pipeBearingsAt(index, { nodeId: 1, coord: at(0, 0) }).sort((a, c) => a - c);
    expect(b).toHaveLength(2);
    expect(b[0]).toBeCloseTo(0, 3);
    expect(b[1]).toBeCloseTo(bearingDeg(at(0, 0), at(20, 10)), 1);
  });

  it('у врезки — отрезок трубы в точке', () => {
    const b = pipeBearingsAt(index, { lineId: 11, coord: at(30, 5) });
    expect(b).toHaveLength(1);
    expect(b[0]).toBeCloseTo(bearingDeg(at(40, 0), at(20, 10)), 1);
  });

  it('ближайшая к курсору труба в радиусе', () => {
    expect(nearestPipeBearing(index, at(3, 25), 5)).toBeCloseTo(0, 3);
    expect(nearestPipeBearing(index, at(30, 40), 5)).toBeNull();
    expect(nearestPipeBearing(index, at(3, 25), 5, [99])).toBeNull();
  });
});

describe('traceCollection: размеры на трассе', () => {
  const pts: TracePoint[] = [
    { kind: 'node', coord: at(0, 0), nodeId: 1 },
    { kind: 'vertex', coord: at(0, 20) },
  ];

  it('подписи длин отрезков, угол и дуга в изломе (с «резинкой»), направляющая', () => {
    const fc = traceCollection(pts, at(15, 20), null, {
      arcRadiusM: 4,
      guide: { from: at(0, 20), bearing: 90, lengthM: 30, kind: 'polar' },
    });
    const roles = fc.features.map((x: any) => x.properties.role);
    expect(roles.filter((r: string) => r === 'label')).toHaveLength(2);
    const angle = fc.features.find((x: any) => x.properties.role === 'angle');
    expect(angle.properties.text).toBe('∠ 90°');
    expect(roles).toContain('arc');
    const guide = fc.features.find((x: any) => x.properties.role === 'guide');
    expect(distanceM(guide.geometry.coordinates[0], guide.geometry.coordinates[1])).toBeCloseTo(30, 1);
  });

  it('без arcRadiusM — без подписей (как раньше)', () => {
    const fc = traceCollection(pts, at(15, 20), null);
    expect(fc.features.some((x: any) => x.properties.role === 'label' || x.properties.role === 'angle')).toBe(false);
  });
});

describe('линейка: углы в изломах', () => {
  it('angleLabels — поворот в каждой внутренней вершине', () => {
    const labels = angleLabels([at(0, 0), at(0, 10), at(10, 10), at(10, 10.0)] as number[][]);
    expect(labels).toHaveLength(1);
    expect(labels[0].properties.angleLabel).toBe('∠ 90°');
  });
});
