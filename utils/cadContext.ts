/**
 * Привязка трассы к зданиям и улицам подложки (MapTiler) и живые размеры до них.
 *
 * Геометрия берётся из векторных тайлов: здания — тайлсет buildings (у каждого здания свой id,
 * тот же, что у номера дома building_number в Planet v4), улицы — Planet v4: оси road без имён
 * и подписи road_label с именами. Тайлы z15 (сетка 4096 — шаг ≈ 0,2 м), поэтому всё здесь
 * ориентировочное: привязка к зданию не точнее съёмки OSM, размеры подписаны «≈».
 *
 * Здание, попавшее на край тайла, приходит кусками из нескольких тайлов; каждый кусок обрезан
 * по краю тайла с запасом (буфер 64 из 4096). Такие «стены» по линии обреза — не стены: они
 * отбрасываются (isClipEdge), а куски одного здания склеиваются по id.
 */
import { localFrame, projectOnSegment, type LocalFrame, type XY } from '~/utils/cadGeometry';
import type { LngLat } from '~/utils/lineVertices';
import type { SnapIndex, SnapDataLine } from '~/utils/cadSnap';

/** Зум, экстент и буфер тайлов зданий и дорог MapTiler (maxzoom источников — 15) */
export const CONTEXT_TILE_ZOOM = 15;
const TILE_EXTENT = 4096;
const TILE_BUFFER = 64;
/** привязка и размеры — только с этого зума карты: ниже тайлы грубее */
export const CONTEXT_MIN_MAP_ZOOM = 15;

export type ContextSnapKind = 'corner' | 'wall' | 'road';

/** Объект GeoJSON из querySourceFeatures (только нужное) */
export interface ContextSourceFeature {
  id?: string | number;
  properties?: Record<string, any> | null;
  geometry: { type: string; coordinates: any };
}

export interface ContextBuilding {
  id: string;
  /** кольца всех кусков (первое кольцо куска — внешнее) */
  polygons: LngLat[][][];
  /** номер дома по карте (building_number), если есть */
  number?: string;
}

export interface ContextRoad {
  cls: string;
  coords: LngLat[];
}

export interface ContextRoadLabel {
  name: string;
  coords: LngLat[];
}

interface Wall {
  building: BuildingEntry;
  a: XY;
  b: XY;
}

interface Corner {
  building: BuildingEntry;
  xy: XY;
  coord: LngLat;
}

interface RoadSeg {
  a: XY;
  b: XY;
  cls: string;
}

interface LabelSeg {
  a: XY;
  b: XY;
  name: string;
}

interface BuildingEntry {
  building: ContextBuilding;
  /** кольца в метрах (для «точка внутри») */
  rings: XY[][][];
  bbox: [number, number, number, number];
}

export interface ContextIndex {
  frame: LocalFrame;
  cell: number;
  corners: Map<string, Corner[]>;
  walls: Map<string, Wall[]>;
  roads: Map<string, RoadSeg[]>;
  labels: Map<string, LabelSeg[]>;
  buildings: BuildingEntry[];
  buildingCells: Map<string, BuildingEntry[]>;
  count: { buildings: number; roads: number };
}

const DEFAULT_CELL_M = 25;
const key = (cx: number, cy: number) => `${cx}:${cy}`;
const push = <T>(m: Map<string, T[]>, k: string, v: T) => {
  const list = m.get(k);
  if (list) list.push(v);
  else m.set(k, [v]);
};

/** Координата точки в пикселях сетки тайлов z15 (экстент 4096) — по всей карте */
export const tileGridXY = (c: LngLat, zoom = CONTEXT_TILE_ZOOM): XY => {
  const scale = 2 ** zoom * TILE_EXTENT;
  const x = ((c[0] + 180) / 360) * scale;
  const s = Math.sin((c[1] * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale;
  return [x, y];
};

const onClipLine = (v: number) => {
  const r = Math.round(v);
  if (Math.abs(v - r) > 0.05) return false;
  const m = ((r % TILE_EXTENT) + TILE_EXTENT) % TILE_EXTENT;
  return m === TILE_BUFFER || m === TILE_EXTENT - TILE_BUFFER;
};

/** Отрезок кольца лежит на линии обреза тайла — это не стена здания */
export const isClipEdge = (a: LngLat, b: LngLat, zoom = CONTEXT_TILE_ZOOM): boolean => {
  const pa = tileGridXY(a, zoom);
  const pb = tileGridXY(b, zoom);
  if (Math.abs(pa[0] - pb[0]) < 0.05 && onClipLine(pa[0]) && onClipLine(pb[0])) return true;
  if (Math.abs(pa[1] - pb[1]) < 0.05 && onClipLine(pa[1]) && onClipLine(pb[1])) return true;
  return false;
};

const polygonsOf = (g: ContextSourceFeature['geometry']): LngLat[][][] => {
  if (g.type === 'Polygon') return [g.coordinates as LngLat[][]];
  if (g.type === 'MultiPolygon') return g.coordinates as LngLat[][][];
  return [];
};

const linesOf = (g: ContextSourceFeature['geometry']): LngLat[][] => {
  if (g.type === 'LineString') return [g.coordinates as LngLat[]];
  if (g.type === 'MultiLineString') return g.coordinates as LngLat[][];
  return [];
};

/** Куски зданий из тайлов → здания по id (без id — каждый кусок отдельным зданием) */
export const mergeBuildingPieces = (
  features: readonly ContextSourceFeature[],
  numbers: ReadonlyMap<string, string> = new Map(),
): ContextBuilding[] => {
  const byId = new Map<string, ContextBuilding>();
  let anon = 0;
  for (const f of features) {
    if (f.properties?.underground === true || f.properties?.underground === 'true') continue;
    const polys = polygonsOf(f.geometry);
    if (!polys.length) continue;
    const id = f.id != null ? String(f.id) : `anon-${anon++}`;
    let b = byId.get(id);
    if (!b) {
      b = { id, polygons: [] };
      const n = numbers.get(id);
      if (n) b.number = n;
      byId.set(id, b);
    }
    b.polygons.push(...polys);
  }
  return [...byId.values()];
};

/** Номера домов building_number: id здания → номер */
export const buildingNumbers = (features: readonly ContextSourceFeature[]): Map<string, string> => {
  const out = new Map<string, string>();
  for (const f of features) {
    const n = f.properties?.number;
    if (f.id != null && n != null && String(n).trim()) out.set(String(f.id), String(n).trim());
  }
  return out;
};

export const roadsFrom = (features: readonly ContextSourceFeature[]): ContextRoad[] =>
  features.flatMap((f) => linesOf(f.geometry).map((coords) => ({ cls: String(f.properties?.class ?? ''), coords })));

export const roadLabelsFrom = (features: readonly ContextSourceFeature[]): ContextRoadLabel[] =>
  features.flatMap((f) => {
    const p = f.properties ?? {};
    const name = String(p['name:ru'] || p.name || p.ref || '').trim();
    if (!name) return [];
    return linesOf(f.geometry).map((coords) => ({ name, coords }));
  });

/** Угол в вершине кольца меньше этого — не угол здания (шум квантования на прямой стене) */
const MIN_CORNER_TURN_DEG = 12;

const cornerTurn = (prev: XY, cur: XY, next: XY): number => {
  const a1 = Math.atan2(cur[1] - prev[1], cur[0] - prev[0]);
  const a2 = Math.atan2(next[1] - cur[1], next[0] - cur[0]);
  let d = ((a2 - a1) * 180) / Math.PI;
  d = ((d + 540) % 360) - 180;
  return Math.abs(d);
};

export interface ContextData {
  buildings: readonly ContextBuilding[];
  roads: readonly ContextRoad[];
  labels: readonly ContextRoadLabel[];
}

/** Индекс по сетке ячеек в метрах, как у сети (cadSnap) */
export const buildContextIndex = (data: ContextData, origin: LngLat, cellM = DEFAULT_CELL_M): ContextIndex => {
  const frame = localFrame(origin);
  const idx: ContextIndex = {
    frame,
    cell: cellM,
    corners: new Map(),
    walls: new Map(),
    roads: new Map(),
    labels: new Map(),
    buildings: [],
    buildingCells: new Map(),
    count: { buildings: data.buildings.length, roads: data.roads.length },
  };
  const cellOf = (xy: XY): [number, number] => [Math.floor(xy[0] / cellM), Math.floor(xy[1] / cellM)];
  const pushSeg = <T>(m: Map<string, T[]>, a: XY, b: XY, v: T) => {
    const [x0, y0] = cellOf([Math.min(a[0], b[0]), Math.min(a[1], b[1])]);
    const [x1, y1] = cellOf([Math.max(a[0], b[0]), Math.max(a[1], b[1])]);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 400) return;
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) push(m, key(cx, cy), v);
  };

  for (const building of data.buildings) {
    const rings = building.polygons.map((poly) => poly.map((ring) => ring.map((c) => frame.toXY(c))));
    let bbox: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const poly of rings) for (const ring of poly) for (const p of ring) {
      bbox = [Math.min(bbox[0], p[0]), Math.min(bbox[1], p[1]), Math.max(bbox[2], p[0]), Math.max(bbox[3], p[1])];
    }
    if (!Number.isFinite(bbox[0])) continue;
    const entry: BuildingEntry = { building, rings, bbox };
    idx.buildings.push(entry);
    const [x0, y0] = cellOf([bbox[0], bbox[1]]);
    const [x1, y1] = cellOf([bbox[2], bbox[3]]);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) <= 400) {
      for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) push(idx.buildingCells, key(cx, cy), entry);
    }
    building.polygons.forEach((poly, pi) => {
      poly.forEach((ring, ri) => {
        const xy = rings[pi][ri];
        // кольцо замкнуто (последняя точка = первая)
        const n = ring.length - 1;
        if (n < 3) return;
        const clip: boolean[] = [];
        for (let i = 0; i < n; i++) clip.push(isClipEdge(ring[i], ring[i + 1]));
        for (let i = 0; i < n; i++) {
          if (!clip[i]) pushSeg(idx.walls, xy[i], xy[i + 1], { building: entry, a: xy[i], b: xy[i + 1] });
          // угол — вершина между двумя настоящими стенами с заметным поворотом
          const prevEdge = (i - 1 + n) % n;
          if (clip[i] || clip[prevEdge]) continue;
          const prev = xy[(i - 1 + n) % n];
          if (cornerTurn(prev, xy[i], xy[i + 1]) < MIN_CORNER_TURN_DEG) continue;
          const [cx, cy] = cellOf(xy[i]);
          push(idx.corners, key(cx, cy), { building: entry, xy: xy[i], coord: ring[i] });
        }
      });
    });
  }

  for (const road of data.roads) {
    const pts = road.coords.map((c) => frame.toXY(c));
    for (let i = 0; i < pts.length - 1; i++) pushSeg(idx.roads, pts[i], pts[i + 1], { a: pts[i], b: pts[i + 1], cls: road.cls });
  }
  for (const label of data.labels) {
    const pts = label.coords.map((c) => frame.toXY(c));
    for (let i = 0; i < pts.length - 1; i++) pushSeg(idx.labels, pts[i], pts[i + 1], { a: pts[i], b: pts[i + 1], name: label.name });
  }
  return idx;
};

const cellsAround = (idx: ContextIndex, p: XY, r: number): string[] => {
  const out: string[] = [];
  const c0x = Math.floor((p[0] - r) / idx.cell);
  const c1x = Math.floor((p[0] + r) / idx.cell);
  const c0y = Math.floor((p[1] - r) / idx.cell);
  const c1y = Math.floor((p[1] + r) / idx.cell);
  for (let cx = c0x; cx <= c1x; cx++) for (let cy = c0y; cy <= c1y; cy++) out.push(key(cx, cy));
  return out;
};

const pointInRing = (p: XY, ring: XY[]): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

const insideEntry = (e: BuildingEntry, p: XY): boolean => {
  if (p[0] < e.bbox[0] || p[0] > e.bbox[2] || p[1] < e.bbox[1] || p[1] > e.bbox[3]) return false;
  // кусок: внутри внешнего кольца и вне дыр
  return e.rings.some((poly) => poly.length > 0 && pointInRing(p, poly[0]) && !poly.slice(1).some((h) => pointInRing(p, h)));
};

/** Здание под точкой */
export const buildingAt = (idx: ContextIndex, at: LngLat): ContextBuilding | null => {
  const p = idx.frame.toXY(at);
  const k = key(Math.floor(p[0] / idx.cell), Math.floor(p[1] / idx.cell));
  for (const e of idx.buildingCells.get(k) ?? []) if (insideEntry(e, p)) return e.building;
  return null;
};

/** Направление отрезка, градусы от оси X (для сравнения параллельности) */
const segAngle = (a: XY, b: XY) => (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
const parallelDiff = (a1: number, a2: number) => {
  const d = Math.abs((((a1 - a2) % 180) + 180) % 180);
  return Math.min(d, 180 - d);
};

/** подпись ищется в стольких метрах от оси (подписи — те же линии улиц, но склеенные иначе) */
const LABEL_MATCH_M = 6;

const roadNameAt = (idx: ContextIndex, p: XY, seg: RoadSeg): string | null => {
  const ang = segAngle(seg.a, seg.b);
  let best = LABEL_MATCH_M;
  let name: string | null = null;
  for (const k of cellsAround(idx, p, LABEL_MATCH_M)) {
    for (const l of idx.labels.get(k) ?? []) {
      if (parallelDiff(ang, segAngle(l.a, l.b)) > 20) continue;
      const d = projectOnSegment(p, l.a, l.b).dist;
      if (d <= best) {
        best = d;
        name = l.name;
      }
    }
  }
  return name;
};

export interface ContextSnap {
  kind: ContextSnapKind;
  coord: LngLat;
  distM: number;
  buildingId?: string;
  buildingNumber?: string;
  roadName?: string | null;
}

const RANK: Record<ContextSnapKind, number> = { corner: 0, wall: 1, road: 2 };

/** Привязка к углу или стене здания, затем к оси улицы, в радиусе radiusM */
export const findContextSnap = (idx: ContextIndex, cursor: LngLat, radiusM: number): ContextSnap | null => {
  const p = idx.frame.toXY(cursor);
  let best: ContextSnap | null = null;
  let bestRoad: RoadSeg | null = null;
  const consider = (c: ContextSnap, road: RoadSeg | null = null) => {
    if (c.distM > radiusM) return;
    if (!best || RANK[c.kind] < RANK[best.kind] || (RANK[c.kind] === RANK[best.kind] && c.distM < best.distM)) {
      best = c;
      bestRoad = road;
    }
  };
  for (const k of cellsAround(idx, p, radiusM)) {
    for (const c of idx.corners.get(k) ?? []) {
      consider({
        kind: 'corner', coord: c.coord, distM: Math.hypot(p[0] - c.xy[0], p[1] - c.xy[1]),
        buildingId: c.building.building.id, buildingNumber: c.building.building.number,
      });
    }
    for (const w of idx.walls.get(k) ?? []) {
      const pr = projectOnSegment(p, w.a, w.b);
      consider({
        kind: 'wall', coord: idx.frame.toLngLat(pr.point), distM: pr.dist,
        buildingId: w.building.building.id, buildingNumber: w.building.building.number,
      });
    }
    for (const r of idx.roads.get(k) ?? []) {
      const pr = projectOnSegment(p, r.a, r.b);
      consider({ kind: 'road', coord: idx.frame.toLngLat(pr.point), distM: pr.dist }, r);
    }
  }
  const found = best as ContextSnap | null;
  if (found?.kind === 'road' && bestRoad) found.roadName = roadNameAt(idx, idx.frame.toXY(found.coord), bestRoad);
  return found;
};

export interface ContextDistance {
  distM: number;
  /** ближайшая точка стены / оси */
  coord: LngLat;
  inside?: boolean;
  buildingNumber?: string;
  roadName?: string | null;
}

/** ближе этого к стене — точка на стене, м */
export const ON_WALL_M = 0.05;

/** Расстояние от точки до ближайшей стены здания и до оси улицы в пределах maxM */
export const contextDistances = (
  idx: ContextIndex,
  at: LngLat,
  maxM: number,
): { building: ContextDistance | null; road: ContextDistance | null } => {
  const p = idx.frame.toXY(at);
  let building: ContextDistance | null = null;
  let road: ContextDistance | null = null;
  let roadSeg: RoadSeg | null = null;
  const inside = buildingAt(idx, at);
  for (const k of cellsAround(idx, p, maxM)) {
    for (const w of idx.walls.get(k) ?? []) {
      const pr = projectOnSegment(p, w.a, w.b);
      if (pr.dist <= maxM && (!building || pr.dist < building.distM)) {
        building = { distM: pr.dist, coord: idx.frame.toLngLat(pr.point), buildingNumber: w.building.building.number };
      }
    }
    for (const r of idx.roads.get(k) ?? []) {
      const pr = projectOnSegment(p, r.a, r.b);
      if (pr.dist <= maxM && (!road || pr.dist < road.distM)) {
        road = { distM: pr.dist, coord: idx.frame.toLngLat(pr.point) };
        roadSeg = r;
      }
    }
  }
  // на стене (привязка к углу / стене) — не «внутри»: граница кольца численно неустойчива
  const onWall = building != null && building.distM < ON_WALL_M;
  if (inside && !onWall) building = { ...(building ?? { distM: 0, coord: at }), inside: true, buildingNumber: inside.number };
  if (road && roadSeg) road.roadName = roadNameAt(idx, idx.frame.toXY(road.coord), roadSeg);
  return { building, road };
};

/** Ввод в здание: точка на трубе и точка на стене, ближайшие друг к другу */
export interface BuildingEntryPlan {
  lineId: number;
  /** точка на трубе (врезка) */
  tap: LngLat;
  /** узел трубы, если ближайшая точка — её конец (тогда без врезки) */
  nodeId: number | null;
  /** точка на стене здания — узел потребителя */
  wall: LngLat;
  lengthM: number;
  /** расстояния от точки врезки до концов участка, м */
  alongM: [number, number];
}

/** конец участка ближе этого к точке врезки — ввод от узла, без врезки */
const ENTRY_NODE_SNAP_M = 0.5;

const closestBetween = (p1: XY, p2: XY, q1: XY, q2: XY): { a: XY; b: XY; dist: number } => {
  // отрезки не пересекаются (труба вне здания) — минимум на конце одного из них
  const cands = [
    { a: p1, b: projectOnSegment(p1, q1, q2).point },
    { a: p2, b: projectOnSegment(p2, q1, q2).point },
    { a: projectOnSegment(q1, p1, p2).point, b: q1 },
    { a: projectOnSegment(q2, p1, p2).point, b: q2 },
  ];
  let best = { a: cands[0].a, b: cands[0].b, dist: Infinity };
  for (const c of cands) {
    const d = Math.hypot(c.a[0] - c.b[0], c.a[1] - c.b[1]);
    if (d < best.dist) best = { ...c, dist: d };
  }
  return best;
};

/**
 * Ближайшая к зданию труба (паспорт трубы, рабочие фрагменты) из индекса сети и кратчайший
 * отрезок от неё до стены. null — труб ближе maxM нет (или индекс сети не загружен).
 */
export const planBuildingEntry = (
  snap: SnapIndex,
  building: ContextBuilding,
  maxM: number,
  fragmentIds: readonly number[] = [],
): BuildingEntryPlan | null => {
  const f = snap.frame;
  const fragments = fragmentIds.length ? new Set(fragmentIds) : null;
  const walls: [XY, XY][] = [];
  let bbox: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const poly of building.polygons) for (const ring of poly) {
    for (let i = 0; i < ring.length - 1; i++) {
      if (isClipEdge(ring[i], ring[i + 1])) continue;
      const a = f.toXY(ring[i]);
      const b = f.toXY(ring[i + 1]);
      walls.push([a, b]);
      bbox = [Math.min(bbox[0], a[0], b[0]), Math.min(bbox[1], a[1], b[1]), Math.max(bbox[2], a[0], b[0]), Math.max(bbox[3], a[1], b[1])];
    }
  }
  if (!walls.length) return null;
  const seen = new Set<unknown>();
  let best: { line: SnapDataLine; tap: XY; wall: XY; dist: number; along: number; total: number } | null = null;
  const c0x = Math.floor((bbox[0] - maxM) / snap.cell);
  const c1x = Math.floor((bbox[2] + maxM) / snap.cell);
  const c0y = Math.floor((bbox[1] - maxM) / snap.cell);
  const c1y = Math.floor((bbox[3] + maxM) / snap.cell);
  for (let cx = c0x; cx <= c1x; cx++) {
    for (let cy = c0y; cy <= c1y; cy++) {
      for (const seg of snap.segments.get(`${cx}:${cy}`) ?? []) {
        if (seen.has(seg)) continue;
        seen.add(seg);
        if (!seg.line.pipe || seg.len === 0) continue;
        if (fragments && (seg.line.f == null || !fragments.has(seg.line.f))) continue;
        for (const [wa, wb] of walls) {
          const c = closestBetween(seg.a, seg.b, wa, wb);
          if (c.dist <= maxM && (!best || c.dist < best.dist)) {
            const t = projectOnSegment(c.a, seg.a, seg.b).t;
            best = { line: seg.line, tap: c.a, wall: c.b, dist: c.dist, along: seg.before + t * seg.len, total: seg.total };
          }
        }
      }
    }
  }
  if (!best) return null;
  const alongM: [number, number] = [best.along, Math.max(0, best.total - best.along)];
  let nodeId: number | null = null;
  let tap = f.toLngLat(best.tap);
  if (alongM[0] < ENTRY_NODE_SNAP_M && best.line.n1 != null) {
    nodeId = best.line.n1;
    tap = best.line.c[0];
  } else if (alongM[1] < ENTRY_NODE_SNAP_M && best.line.n2 != null) {
    nodeId = best.line.n2;
    tap = best.line.c[best.line.c.length - 1];
  }
  return { lineId: best.line.id, tap, nodeId, wall: f.toLngLat(best.wall), lengthM: best.dist, alongM };
};

/** «≈ 5,2 м» — размеры по подложке ориентировочные */
/** улица у здания ищется в стольких метрах от его стен (подпись лежит на оси улицы) */
export const STREET_NEAR_BUILDING_M = 60;

/** Название ближайшей к зданию улицы по подписям подложки (null — подписанной улицы рядом нет) */
export const buildingStreet = (idx: ContextIndex, building: ContextBuilding, maxM = STREET_NEAR_BUILDING_M): string | null => {
  const entry = idx.buildings.find((e) => e.building.id === building.id);
  if (!entry) return null;
  let best = maxM;
  let name: string | null = null;
  const seen = new Set<LabelSeg>();
  for (const poly of entry.rings) {
    for (const v of poly[0] ?? []) {
      for (const k of cellsAround(idx, v, maxM)) {
        for (const l of idx.labels.get(k) ?? []) {
          if (seen.has(l)) continue;
          seen.add(l);
          for (const w of poly[0]) {
            const d = projectOnSegment(w, l.a, l.b).dist;
            if (d <= best) {
              best = d;
              name = l.name;
            }
          }
        }
      }
    }
  }
  return name;
};

/** Подпись потребителя из адреса по карте: «ул. Абая, 10», «ул. Абая», «10» */
export const entryAddress = (street: string | null | undefined, number: string | null | undefined): string =>
  [street?.trim(), number?.trim()].filter(Boolean).join(', ');

export const formatApproxM = (m: number): string => `≈ ${m.toFixed(1).replace('.', ',')} м`;

/** Подпись привязки к подложке для бейджа */
export const contextSnapLabel = (s: ContextSnap): string => {
  const house = s.buildingNumber ? ` (дом ${s.buildingNumber})` : '';
  switch (s.kind) {
    case 'corner':
      return `Угол здания${house}`;
    case 'wall':
      return `Стена здания${house}`;
    case 'road':
      return s.roadName ? `Ось: ${s.roadName}` : 'Ось улицы';
  }
};

/** Контур здания для подсветки: кольца, разорванные на линиях обреза тайлов */
export const buildingOutline = (building: ContextBuilding): LngLat[][] => {
  const out: LngLat[][] = [];
  for (const poly of building.polygons) for (const closed of poly) {
    const n = closed.length - 1;
    // кольцо замкнуто: обход — сразу после линии обреза, чтобы стены через начало кольца не рвались
    const firstClip = [...Array(Math.max(n, 0)).keys()].find((i) => isClipEdge(closed[i], closed[i + 1]));
    const start = firstClip == null ? 0 : firstClip + 1;
    const ring = [...closed.slice(start, n), ...closed.slice(0, start), closed[start % Math.max(n, 1)]];
    let cur: LngLat[] = [];
    for (let i = 0; i < ring.length - 1; i++) {
      if (isClipEdge(ring[i], ring[i + 1])) {
        if (cur.length >= 2) out.push(cur);
        cur = [];
        continue;
      }
      if (!cur.length) cur.push(ring[i]);
      cur.push(ring[i + 1]);
    }
    if (cur.length >= 2) out.push(cur);
  }
  return out;
};
