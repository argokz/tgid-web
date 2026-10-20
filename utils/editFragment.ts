/**
 * Фрагмент, в котором создаются новые узлы и участки.
 *
 * Фрагменты-копии сети (годы, сезоны, варианты) лежат на карте друг на друге, поэтому по месту
 * фрагмент не определить: он задаётся явно — выбранный или единственный видимый фрагмент карты,
 * иначе выбранный на панели редактора или взятый от узла/трубы, с которых начата трасса.
 */
import type { TracePoint } from '~/utils/cadChain';
import type { SnapIndex } from '~/utils/cadSnap';

/**
 * active — фрагменты карты (выбранный или видимые; пусто — показаны все);
 * chosen — выбранный в редакторе (годится, только если он среди видимых).
 */
export const creationFragment = (active: readonly number[], chosen: number | null): number | null => {
  if (active.length === 1) return active[0]!;
  if (chosen == null) return null;
  return active.length === 0 || active.includes(chosen) ? chosen : null;
};

/** Из каких фрагментов выбирать: видимые, а если показаны все — все фрагменты города */
export const fragmentChoices = (active: readonly number[], all: readonly number[]): number[] =>
  [...new Set(active.length ? active : all)].sort((a, b) => a - b);

/** Фрагмент точки трассы по индексу привязки: узел — его фрагмент, врезка — фрагмент трубы */
export const tracePointFragment = (p: TracePoint | undefined, idx: SnapIndex | null): number | null => {
  if (!p || !idx) return null;
  if (p.kind === 'node' && p.nodeId != null) return idx.nodeById.get(p.nodeId)?.f ?? null;
  if (p.kind === 'tap' && p.lineId != null) return idx.lineById.get(p.lineId)?.f ?? null;
  return null;
};

/** Точка трассы на объекте чужого фрагмента */
export interface TraceFragmentConflict {
  index: number;
  point: TracePoint;
  fragment: number;
  expected: number;
}

/**
 * Узлы и трубы трассы из разных фрагментов: участок соединяет узлы одного фрагмента (иначе сервер
 * откажет — mixed_context). Фрагмент трассы — выбранный для создания, а если его нет — первой
 * точки на узле/трубе. → первая точка не из него, null — всё в одном фрагменте
 */
export const traceFragmentConflict = (
  points: readonly TracePoint[],
  idx: SnapIndex | null,
  chosen: number | null,
): TraceFragmentConflict | null => {
  let expected = chosen;
  for (let i = 0; i < points.length; i++) {
    const f = tracePointFragment(points[i], idx);
    if (f == null) continue;
    if (expected == null) expected = f;
    else if (f !== expected) return { index: i, point: points[i]!, fragment: f, expected };
  }
  return null;
};

export const traceFragmentConflictText = (c: TraceFragmentConflict): string => {
  const what = c.point.kind === 'node' ? `Узел ${c.point.nodeId}` : `Участок ${c.point.lineId}`;
  return `${what} — во фрагменте ${c.fragment}, а трасса — во фрагменте ${c.expected}. `
    + 'Начальный и конечный узлы участка должны быть в одном фрагменте.';
};

/** «42 · Магистраль 2026» — номер и имя фрагмента для панели и уведомлений */
export const fragmentLabel = (id: number, name?: string | null): string => {
  const n = (name ?? '').trim();
  return n && n !== String(id) ? `${id} · ${n}` : String(id);
};
