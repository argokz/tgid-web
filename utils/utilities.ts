/** Общая карта коммуникаций (itwin-api database/utility_conflicts.py): типы, цвета, слои карты. */

export type UtilityKind = 'heat' | 'water';

export interface UtilityNorm {
  kind_a: UtilityKind;
  kind_b: UtilityKind;
  horizontal_m: number | null;
  vertical_m: number | null;
  source: string | null;
  updated_by: string | null;
  updated_at: string;
}

interface ConflictBase {
  water_link: string;
  heat_line: number;
  fileid: number | null;
  water_d_mm: number | null;
  heat_d_mm: number | null;
  heat_pipes: number;
  point: GeoJSON.Point | null;
}

export interface UtilityCrossing extends ConflictBase { heat_depth_m: number | null }

export interface UtilityClose extends ConflictBase {
  axis_m: number;
  clearance_m: number;
  near_length_m: number;
}

export interface UtilityConflicts {
  model_id: number;
  norm: UtilityNorm | null;
  crossings: UtilityCrossing[];
  close: UtilityClose[];
  depth_note: string | null;
  truncated: boolean;
  summary: { crossings: number; close: number; close_length_m: number };
}

export interface UtilityExcavation {
  buffer_m: number;
  heat: { id: number; fileid: number | null; fragment: string | null; owner: string | null; d_mm: number | null;
    depth_m: number | null; pipes: number; distance_m: number }[];
  water: { model_id: number; model: string; link: string; type: string; d_mm: number | null; distance_m: number }[];
  owners: Record<string, number>;
  depth_note: string | null;
  truncated: boolean;
  geojson: GeoJSON.FeatureCollection;
}

export const UTILITY_KIND_LABEL: Record<UtilityKind, string> = { heat: 'теплосеть', water: 'водопровод' };

/** Сети на карте — привычные цвета: теплосеть — красная, водопровод — синий; зона работ — жёлтая */
export const NET_COLOR: Record<UtilityKind | 'zone', string> = { heat: '#C62828', water: '#1565C0', zone: '#F9A825' };

export const CONFLICT_META = {
  crossing: { label: 'пересечение в плане', color: '#6A1B9A' },
  close: { label: 'ближе нормы', color: '#EF6C00' },
} as const;

/** Точки сближений и пересечений для карты */
export function conflictsFrame(c: UtilityConflicts): GeoJSON.FeatureCollection {
  const point = (x: ConflictBase, kind: keyof typeof CONFLICT_META, label: string): GeoJSON.Feature | null => (x.point
    ? { type: 'Feature', geometry: x.point, properties: { kind, color: CONFLICT_META[kind].color, label,
      water_link: x.water_link, heat_line: x.heat_line } }
    : null);
  const features = [
    ...c.crossings.map((x) => point(x, 'crossing', `${x.water_link} × ${x.heat_line}`)),
    ...c.close.map((x) => point(x, 'close', `${x.clearance_m.toLocaleString('ru-RU')} м`)),
  ].filter((f): f is GeoJSON.Feature => f !== null);
  return { type: 'FeatureCollection', features };
}

/** Зона работ и сети в ней — с цветом по виду сети */
export function excavationFrame(e: UtilityExcavation): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: e.geojson.features.map((f) => {
      const kind = (f.properties?.kind ?? 'zone') as UtilityKind | 'zone';
      return { ...f, properties: { ...f.properties, color: NET_COLOR[kind] ?? NET_COLOR.zone } };
    }),
  };
}

/** Расстояние в свету: отрицательное — трубы перекрываются в плане (оси ближе суммы радиусов) */
export function clearanceText(m: number): string {
  return m < 0 ? `перекрытие ${(-m).toLocaleString('ru-RU')} м` : `${m.toLocaleString('ru-RU')} м`;
}

/** Точка зоны работ (отступ вокруг неё строит сервер) — округление до ~1 см */
export function pointGeometry(lng: number, lat: number): GeoJSON.Point {
  return { type: 'Point', coordinates: [Number(lng.toFixed(7)), Number(lat.toFixed(7))] };
}
