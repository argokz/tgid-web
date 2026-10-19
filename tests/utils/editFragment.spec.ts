import { describe, expect, it } from 'vitest';
import { creationFragment, fragmentChoices, fragmentLabel, tracePointFragment } from '~/utils/editFragment';
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
