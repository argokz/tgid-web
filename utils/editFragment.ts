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

/** «42 · Магистраль 2026» — номер и имя фрагмента для панели и уведомлений */
export const fragmentLabel = (id: number, name?: string | null): string => {
  const n = (name ?? '').trim();
  return n && n !== String(id) ? `${id} · ${n}` : String(id);
};
