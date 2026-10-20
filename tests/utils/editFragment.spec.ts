import { describe, expect, it } from 'vitest';
import {
  creationFragment,
  fragmentChoices,
  fragmentLabel,
  traceFragmentConflict,
  traceFragmentConflictText,
  tracePointFragment,
} from '~/utils/editFragment';
import type { SnapIndex } from '~/utils/cadSnap';

describe('creationFragment', () => {
  it('один фрагмент на карте — он и есть фрагмент создания, выбор в редакторе не нужен', () => {
    expect(creationFragment([42], null)).toBe(42);
    expect(creationFragment([42], 41)).toBe(42);
  });

  it('несколько видимых — только выбранный среди них, иначе не определён', () => {
    expect(creationFragment([41, 42], null)).toBeNull();
    expect(creationFragment([41, 42], 41)).toBe(41);
    expect(creationFragment([41, 42], 95)).toBeNull();
  });

  it('показаны все фрагменты — годится любой выбранный', () => {
    expect(creationFragment([], 95)).toBe(95);
    expect(creationFragment([], null)).toBeNull();
  });
});

describe('fragmentChoices / fragmentLabel', () => {
  it('выбор — из видимых, а без фильтра — из всех', () => {
    expect(fragmentChoices([42, 41, 42], [1, 2])).toEqual([41, 42]);
    expect(fragmentChoices([], [93, 91])).toEqual([91, 93]);
  });

  it('подпись — номер и имя', () => {
    expect(fragmentLabel(42, 'Магистраль')).toBe('42 · Магистраль');
    expect(fragmentLabel(42, '42')).toBe('42');
    expect(fragmentLabel(42, null)).toBe('42');
  });
});

describe('tracePointFragment', () => {
  const idx = {
    nodeById: new Map([[7, { id: 7, c: [0, 0], f: 41, s: 1 }]]),
    lineById: new Map([[9, { id: 9, n1: 7, n2: 8, s: 1, f: 42, pipe: true, c: [] }]]),
  } as unknown as SnapIndex;

  it('узел — его фрагмент, врезка — фрагмент трубы, новая точка — неизвестно', () => {
    expect(tracePointFragment({ kind: 'node', coord: [0, 0], nodeId: 7 }, idx)).toBe(41);
    expect(tracePointFragment({ kind: 'tap', coord: [0, 0], lineId: 9 }, idx)).toBe(42);
    expect(tracePointFragment({ kind: 'new', coord: [0, 0] }, idx)).toBeNull();
    expect(tracePointFragment({ kind: 'node', coord: [0, 0], nodeId: 7 }, null)).toBeNull();
  });
});

describe('traceFragmentConflict', () => {
  const idx = {
    nodeById: new Map([
      [7, { id: 7, c: [0, 0], f: 41, s: 1 }],
      [8, { id: 8, c: [1, 0], f: 42, s: 1 }],
      [6, { id: 6, c: [2, 0], f: 41, s: 1 }],
    ]),
    lineById: new Map([[9, { id: 9, n1: 7, n2: 6, s: 1, f: 41, pipe: true, c: [] }]]),
  } as unknown as SnapIndex;
  const node = (nodeId: number) => ({ kind: 'node' as const, coord: [0, 0] as [number, number], nodeId });
  const free = { kind: 'vertex' as const, coord: [0, 0] as [number, number] };

  it('начало и конец в одном фрагменте (изломы не в счёт) — без замечаний', () => {
    expect(traceFragmentConflict([node(7), free, node(6)], idx, null)).toBeNull();
    expect(traceFragmentConflict([node(7), { kind: 'tap', coord: [0, 0], lineId: 9 }], idx, 41)).toBeNull();
    expect(traceFragmentConflict([{ kind: 'new', coord: [0, 0] }, free], idx, null)).toBeNull();
  });

  it('конечный узел другого фрагмента — конфликт с понятным текстом', () => {
    const c = traceFragmentConflict([node(7), free, node(8)], idx, null);
    expect(c).toMatchObject({ index: 2, fragment: 42, expected: 41 });
    expect(traceFragmentConflictText(c!)).toMatch(/^Узел 8 — во фрагменте 42, а трасса — во фрагменте 41/);
  });

  it('выбранный фрагмент создания важнее первой точки', () => {
    expect(traceFragmentConflict([node(7)], idx, 42)).toMatchObject({ index: 0, fragment: 41, expected: 42 });
    expect(traceFragmentConflict([{ kind: 'new', coord: [0, 0] }, node(8)], idx, 42)).toBeNull();
  });
});
