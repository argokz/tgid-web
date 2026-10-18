/**
 * Ядро привязок CAD-редактора сети по точной геометрии с сервера (GET topology/snap-data).
 *
 * Векторные тайлы для привязки не годятся: координаты в них квантованы сеткой тайла и обрезаны
 * по его краю. Объекты окна раскладываются по сетке ячеек в метрах — поиск ближайшего занимает
 * доли миллисекунды и на 20 тыс. объектов, поэтому его можно делать на каждое движение мыши.
 *
 * Приоритет (как в CAD): узел → излом трубы → середина участка → точка на трубе (врезка).
 * Внутри одного вида — ближайший. Узел совпадает с концом участка, поэтому концы участков
 * отдельно не индексируются: их представляют узлы.
 */
import { distanceM, localFrame, projectOnSegment, type LocalFrame, type XY } from '~/utils/cadGeometry';
import type { LngLat } from '~/utils/lineVertices';

/** Ответ GET api/v1/topology/snap-data */
export interface SnapDataNode {
  id: number;
  c: LngLat;
  /** фрагмент (nodes.fileid) */
  f: number | null;
  /** признак узла: 1 — обе сети, 2 — подающая, 3 — обратная */
  s: number | null;
}
export interface SnapDataLine {
  id: number;
  n1: number | null;
  n2: number | null;
  /** признак участка (externalsignlineid 1–5) */
  s: number | null;
  f: number | null;
  /** есть паспорт трубы (врезаться можно только в трубу) */
  pipe: boolean;
  c: LngLat[];
}
export interface SnapData {
  too_large: boolean;
  truncated: boolean;
  max_side_m?: number;
  nodes: SnapDataNode[];
  lines: SnapDataLine[];
}

export type SnapKind = 'node' | 'vertex' | 'midpoint' | 'segment';

export interface SnapResult {
  kind: SnapKind;
  coord: LngLat;
  /** расстояние от курсора, м */
  distM: number;
  nodeId?: number;
  lineId?: number;
  /** для привязки к трубе: расстояния до её начала и конца по трассе, м */
  alongM?: [number, number];
  /** труба (true) или оборудование (false) — врезаться можно только в трубу */
  pipe?: boolean;
  fragmentId?: number | null;
}

interface IndexedSegment {
  line: SnapDataLine;
  i: number;
  a: XY;
  b: XY;
  /** длина трассы участка до начала отрезка, м */
  before: number;
  len: number;
  total: number;
}

export interface SnapIndex {
  frame: LocalFrame;
  cell: number;
  nodes: Map<string, { node: SnapDataNode; xy: XY }[]>;
  segments: Map<string, IndexedSegment[]>;
  /** вершины-изломы (без концов участка) */
  vertices: Map<string, { line: SnapDataLine; xy: XY; coord: LngLat }[]>;
  nodeById: Map<number, SnapDataNode>;
  lineById: Map<number, SnapDataLine>;
  count: { nodes: number; lines: number };
}

const DEFAULT_CELL_M = 25;

const key = (cx: number, cy: number) => `${cx}:${cy}`;

const push = <T>(m: Map<string, T[]>, k: string, v: T) => {
  const list = m.get(k);
  if (list) list.push(v);
  else m.set(k, [v]);
};

/** Индекс по данным окна; origin — центр окна (точность локальной плоскости) */
export const buildSnapIndex = (data: Pick<SnapData, 'nodes' | 'lines'>, origin: LngLat, cellM = DEFAULT_CELL_M): SnapIndex => {
  const frame = localFrame(origin);
  const index: SnapIndex = {
    frame,
    cell: cellM,
    nodes: new Map(),
    segments: new Map(),
    vertices: new Map(),
    nodeById: new Map(),
    lineById: new Map(),
    count: { nodes: data.nodes.length, lines: data.lines.length },
  };
  const cellOf = (xy: XY): [number, number] => [Math.floor(xy[0] / cellM), Math.floor(xy[1] / cellM)];
  for (const node of data.nodes) {
    const xy = frame.toXY(node.c);
    const [cx, cy] = cellOf(xy);
    push(index.nodes, key(cx, cy), { node, xy });
    index.nodeById.set(node.id, node);
  }
  for (const line of data.lines) {
    index.lineById.set(line.id, line);
    const pts = line.c.map((c) => frame.toXY(c));
    const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
    const total = lens.reduce((s, l) => s + l, 0);
    let before = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const seg: IndexedSegment = { line, i, a, b, before, len: lens[i], total };
      // отрезок — во все ячейки своего охвата (отрезки участков короткие, ячеек мало)
      const [x0, y0] = cellOf([Math.min(a[0], b[0]), Math.min(a[1], b[1])]);
      const [x1, y1] = cellOf([Math.max(a[0], b[0]), Math.max(a[1], b[1])]);
      if ((x1 - x0 + 1) * (y1 - y0 + 1) <= 400) {
        for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) push(index.segments, key(cx, cy), seg);
      }
      before += lens[i];
      if (i > 0) {
        const [cx, cy] = cellOf(a);
        push(index.vertices, key(cx, cy), { line, xy: a, coord: line.c[i] });
      }
    }
  }
  return index;
};

export interface SnapOptions {
  /** фрагменты, к которым можно привязываться; пусто — любые */
  fragmentIds?: readonly number[];
  excludeNodes?: readonly number[];
  excludeLines?: readonly number[];
  /** привязка к трубам (изломы, середины, врезка); false — только к узлам */
  lines?: boolean;
}

const RANK: Record<SnapKind, number> = { node: 0, vertex: 1, midpoint: 2, segment: 3 };

/** Лучшая привязка в радиусе radiusM от курсора; null — привязки нет */
export const findSnap = (index: SnapIndex, cursor: LngLat, radiusM: number, opts: SnapOptions = {}): SnapResult | null => {
  const p = index.frame.toXY(cursor);
  const fragments = opts.fragmentIds?.length ? new Set(opts.fragmentIds) : null;
  const exNodes = new Set(opts.excludeNodes ?? []);
  const exLines = new Set(opts.excludeLines ?? []);
  const allowFragment = (f: number | null) => !fragments || (f != null && fragments.has(f));
  const r = Math.max(0, radiusM);
  const c0x = Math.floor((p[0] - r) / index.cell);
  const c1x = Math.floor((p[0] + r) / index.cell);
  const c0y = Math.floor((p[1] - r) / index.cell);
  const c1y = Math.floor((p[1] + r) / index.cell);
  let best: SnapResult | null = null;
  const consider = (cand: SnapResult) => {
    if (cand.distM > r) return;
    if (!best || RANK[cand.kind] < RANK[best.kind] || (RANK[cand.kind] === RANK[best.kind] && cand.distM < best.distM)) {
      best = cand;
    }
  };
  const seenSeg = new Set<IndexedSegment>();
  for (let cx = c0x; cx <= c1x; cx++) {
    for (let cy = c0y; cy <= c1y; cy++) {
      const k = key(cx, cy);
      for (const { node, xy } of index.nodes.get(k) ?? []) {
        if (exNodes.has(node.id) || !allowFragment(node.f)) continue;
        consider({
          kind: 'node', coord: node.c, nodeId: node.id, fragmentId: node.f,
          distM: Math.hypot(p[0] - xy[0], p[1] - xy[1]),
        });
      }
      if (opts.lines === false) continue;
      for (const v of index.vertices.get(k) ?? []) {
        if (exLines.has(v.line.id) || !allowFragment(v.line.f)) continue;
        const along = alongOf(index, v.line, v.coord);
        consider({
          kind: 'vertex', coord: v.coord, lineId: v.line.id, pipe: v.line.pipe, fragmentId: v.line.f,
          distM: Math.hypot(p[0] - v.xy[0], p[1] - v.xy[1]), alongM: along,
        });
      }
      for (const seg of index.segments.get(k) ?? []) {
        if (seenSeg.has(seg)) continue;
        seenSeg.add(seg);
        if (exLines.has(seg.line.id) || !allowFragment(seg.line.f)) continue;
        // середина участка — по длине трассы, а не середина отрезка
        const half = seg.total / 2;
        if (half >= seg.before && half <= seg.before + seg.len && seg.len > 0) {
          const t = (half - seg.before) / seg.len;
          const mid: XY = [seg.a[0] + t * (seg.b[0] - seg.a[0]), seg.a[1] + t * (seg.b[1] - seg.a[1])];
          consider({
            kind: 'midpoint', coord: index.frame.toLngLat(mid), lineId: seg.line.id, pipe: seg.line.pipe,
            fragmentId: seg.line.f, distM: Math.hypot(p[0] - mid[0], p[1] - mid[1]), alongM: [half, half],
          });
        }
        const pr = projectOnSegment(p, seg.a, seg.b);
        const d = seg.before + pr.t * seg.len;
        consider({
          kind: 'segment', coord: index.frame.toLngLat(pr.point), lineId: seg.line.id, pipe: seg.line.pipe,
          fragmentId: seg.line.f, distM: pr.dist, alongM: [d, Math.max(0, seg.total - d)],
        });
      }
    }
  }
  return best;
};

const alongOf = (index: SnapIndex, line: SnapDataLine, coord: LngLat): [number, number] => {
  let d = 0;
  let total = 0;
  let found = false;
  for (let i = 1; i < line.c.length; i++) {
    const l = distanceM(line.c[i - 1], line.c[i]);
    total += l;
    if (!found) {
      d += l;
      if (line.c[i][0] === coord[0] && line.c[i][1] === coord[1]) found = true;
    }
  }
  return [d, Math.max(0, total - d)];
};

/** Подпись привязки для бейджа у курсора */
export const snapLabel = (s: SnapResult): string => {
  const m = (v: number) => v.toFixed(1).replace('.', ',');
  switch (s.kind) {
    case 'node':
      return `Узел ${s.nodeId}`;
    case 'vertex':
      return `Излом уч. ${s.lineId}`;
    case 'midpoint':
      return `Середина уч. ${s.lineId}`;
    case 'segment':
      return s.alongM
        ? `Врезка в уч. ${s.lineId}: ${m(s.alongM[0])} / ${m(s.alongM[1])} м`
        : `Врезка в уч. ${s.lineId}`;
  }
};

const segBearing = (a: XY, b: XY) => ((Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI + 360) % 360;

/**
 * Направления труб у точки трассы — для направляющих ∥ и ⊥: у узла — первые отрезки
 * всех его участков, у врезки — отрезок трубы в точке врезки.
 */
export const pipeBearingsAt = (
  index: SnapIndex,
  point: { nodeId?: number; lineId?: number; coord: LngLat },
): number[] => {
  const out: number[] = [];
  if (point.nodeId != null) {
    for (const line of index.lineById.values()) {
      if (line.c.length < 2) continue;
      if (line.n1 === point.nodeId) out.push(segBearing(index.frame.toXY(line.c[0]), index.frame.toXY(line.c[1])));
      if (line.n2 === point.nodeId) {
        const n = line.c.length;
        out.push(segBearing(index.frame.toXY(line.c[n - 1]), index.frame.toXY(line.c[n - 2])));
      }
    }
  } else if (point.lineId != null) {
    const line = index.lineById.get(point.lineId);
    if (line && line.c.length >= 2) {
      const p = index.frame.toXY(point.coord);
      let best = Infinity;
      let bearing: number | null = null;
      for (let i = 0; i < line.c.length - 1; i++) {
        const a = index.frame.toXY(line.c[i]);
        const b = index.frame.toXY(line.c[i + 1]);
        const d = projectOnSegment(p, a, b).dist;
        if (d < best) {
          best = d;
          bearing = segBearing(a, b);
        }
      }
      if (bearing != null) out.push(bearing);
    }
  }
  return out;
};

/** Направление ближайшей к курсору трубы в радиусе radiusM (направляющая «вдоль трубы»), null — нет */
export const nearestPipeBearing = (
  index: SnapIndex,
  cursor: LngLat,
  radiusM: number,
  fragmentIds?: readonly number[],
): number | null => {
  const p = index.frame.toXY(cursor);
  const fragments = fragmentIds?.length ? new Set(fragmentIds) : null;
  const c0x = Math.floor((p[0] - radiusM) / index.cell);
  const c1x = Math.floor((p[0] + radiusM) / index.cell);
  const c0y = Math.floor((p[1] - radiusM) / index.cell);
  const c1y = Math.floor((p[1] + radiusM) / index.cell);
  let best = radiusM;
  let bearing: number | null = null;
  for (let cx = c0x; cx <= c1x; cx++) {
    for (let cy = c0y; cy <= c1y; cy++) {
      for (const seg of index.segments.get(key(cx, cy)) ?? []) {
        if ((fragments && (seg.line.f == null || !fragments.has(seg.line.f))) || seg.len === 0) continue;
        const d = projectOnSegment(p, seg.a, seg.b).dist;
        if (d <= best) {
          best = d;
          bearing = segBearing(seg.a, seg.b);
        }
      }
    }
  }
  return bearing;
};
