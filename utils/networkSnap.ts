/**
 * Привязка (snap) в редакторе топологии — только к слоям сети (узлы и участки).
 *
 * Подложки, здания, надписи, слои рисования/измерений и оверлеи самого редактора
 * в привязке не участвуют: иначе вершина участка «прилипает» к чужой геометрии.
 */

export type NetworkKind = 'node' | 'line';

/** Слои оверлеев (рисование, редактор вершин, трассировка) — не сеть */
const OVERLAY_PREFIXES = ['draw-', 'topology-vertex-', 'trace-', 'route-', 'outage-', 'hydraulic-', 'measure-'];

const featureSignature = (feature: any): string =>
  [
    feature?.layer?.id,
    feature?.sourceLayer,
    feature?.layer?.['source-layer'],
    feature?.source,
    feature?.properties?.table,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

/** Слой сети по имени (слой/источник/таблица), без догадок по типу геометрии */
export const networkFeatureKind = (feature: any): NetworkKind | null => {
  const layerId = String(feature?.layer?.id || '').toLowerCase();
  if (OVERLAY_PREFIXES.some((p) => layerId.startsWith(p))) return null;
  const sig = featureSignature(feature);
  const type = feature?.geometry?.type;
  if ((sig.includes('node') || sig.includes('узел') || sig.includes('узл')) && (type === 'Point' || type === 'MultiPoint')) {
    return 'node';
  }
  if (
    (sig.includes('line') || sig.includes('pipe') || sig.includes('heatpipesection') || sig.includes('труб') || sig.includes('участ'))
    && (type === 'LineString' || type === 'MultiLineString')
  ) {
    return 'line';
  }
  return null;
};

export interface SnapCandidate {
  coord: [number, number];
  kind: NetworkKind;
  id: number | null;
}

const featureId = (feature: any): number | null => {
  const id = Number(feature?.properties?.id ?? feature?.id);
  return Number.isFinite(id) && id > 0 ? id : null;
};

/**
 * Лучшая точка привязки среди объектов сети рядом с курсором: узел приоритетнее вершины
 * участка; среди равных — ближайшая на экране. project — lng/lat → пиксели экрана.
 * exclude — объекты, к которым привязываться нельзя (сам редактируемый участок/узел).
 */
export const pickNetworkSnap = (
  features: any[],
  cursor: { x: number; y: number },
  project: (c: [number, number]) => { x: number; y: number },
  radiusPx: number,
  exclude: { nodes?: number[]; lines?: number[] } = {},
): SnapCandidate | null => {
  // держатель, а не let: TS не видит присваиваний из замыкания и сузил бы best до null
  const found: { best: (SnapCandidate & { d: number; rank: number }) | null } = { best: null };
  const consider = (coord: any, kind: NetworkKind, id: number | null) => {
    if (!Array.isArray(coord) || coord.length < 2) return;
    const c: [number, number] = [Number(coord[0]), Number(coord[1])];
    if (!Number.isFinite(c[0]) || !Number.isFinite(c[1])) return;
    const p = project(c);
    const d = Math.hypot(p.x - cursor.x, p.y - cursor.y);
    if (d > radiusPx) return;
    const rank = kind === 'node' ? 0 : 1;
    const b = found.best;
    if (!b || rank < b.rank || (rank === b.rank && d < b.d)) found.best = { coord: c, kind, id, d, rank };
  };
  for (const f of features) {
    const kind = networkFeatureKind(f);
    if (!kind) continue;
    const id = featureId(f);
    if (kind === 'node') {
      if (id != null && exclude.nodes?.includes(id)) continue;
      const g = f.geometry;
      if (g.type === 'Point') consider(g.coordinates, 'node', id);
      else for (const c of g.coordinates || []) consider(c, 'node', id);
    } else {
      if (id != null && exclude.lines?.includes(id)) continue;
      const g = f.geometry;
      const parts = g.type === 'LineString' ? [g.coordinates] : g.coordinates || [];
      for (const part of parts) for (const c of part || []) consider(c, 'line', id);
    }
  }
  if (!found.best) return null;
  const { coord, kind, id } = found.best;
  return { coord, kind, id };
};
