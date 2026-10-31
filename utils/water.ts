/** Водопровод (itwin-api database/water.py, движок water_engine): типы, классы давления и скорости, слой карты. */

export interface WaterModel {
  id: number;
  name: string;
  source: string;
  units_in_file: string | null;
  placement: { mode: 'schematic' | 'srid'; extent_m?: number; srid?: number };
  summary: Record<string, number | string | null>;
  created_by: string | null;
  created_at: string;
  runs: number;
}

export interface WaterRunSummary {
  steps: number;
  min_pressure_m: number | null;
  max_pressure_m: number | null;
  max_velocity_ms: number | null;
  low_pressure_nodes: string[];
  negative_pressure_nodes: string[];
  high_velocity_pipes: string[];
  thresholds: { low_pressure_m: number; high_velocity_ms: number };
  /** Сценарий утечек расчёта (нет — базовый расчёт) */
  leaks?: WaterLeak[];
  /** Расчёт отключения участка (database/water_isolation.py) */
  isolation?: { link: string; close_valves: number; segment_links: number; no_water_nodes: number; demand_ls: number };
}

export interface WaterLeak {
  node: string;
  area_cm2: number;
  avg_ls: number | null;
  volume_m3: number | null;
  /** Зона водоучёта узла утечки (в ответе баланса) */
  zone?: number | null;
}

export interface WaterRun {
  id: number;
  duration_h: number | null;
  report_step_h: number | null;
  summary: WaterRunSummary;
  created_by: string | null;
  created_at: string;
  steps: number;
}

export interface WaterStep {
  step: number;
  time_s: number;
  times_s: number[];
  pressure_m: Record<string, number | null>;
  flow_ls: Record<string, number | null>;
  velocity_ms: Record<string, number | null>;
}

export interface WaterStatus { available: boolean; url: string; wntr?: string; error?: string }

/** Давление узла: отрицательное, ниже нормы, норма (порог — как у движка, 10 м) */
export const PRESSURE_META = {
  negative: { label: 'отрицательное', color: '#6A1B9A' },
  low: { label: 'ниже 10 м', color: '#C62828' },
  ok: { label: 'норма', color: '#2E7D32' },
  source: { label: 'источник / бак', color: '#1565C0' },
  no_data: { label: 'нет расчёта', color: '#78909C' },
} as const;
export type PressureStatus = keyof typeof PRESSURE_META;

/** Скорость в трубе — последовательная шкала одного тона (светлее — медленнее) */
export const VELOCITY_CLASSES: { max: number; label: string; color: string }[] = [
  { max: 0.3, label: 'до 0,3 м/с', color: '#BBDEFB' },
  { max: 1.0, label: '0,3–1 м/с', color: '#64B5F6' },
  { max: 2.0, label: '1–2 м/с', color: '#1E88E5' },
  { max: Infinity, label: 'больше 2 м/с', color: '#0D47A1' },
];

export function pressureStatus(type: string, pressure: number | null | undefined): PressureStatus {
  if (type !== 'Junction') return 'source';
  if (pressure == null) return 'no_data';
  if (pressure < 0) return 'negative';
  return pressure < 10 ? 'low' : 'ok';
}

export function velocityColor(v: number | null | undefined): string {
  if (v == null) return '#90A4AE';
  const a = Math.abs(v);
  return (VELOCITY_CLASSES.find((c) => a <= c.max) ?? VELOCITY_CLASSES[VELOCITY_CLASSES.length - 1]).color;
}

/** Кадр для карты: сеть модели (геометрия — один раз) + значения шага расчёта (цвет и подпись) */
export function waterFrame(net: GeoJSON.FeatureCollection, step: WaterStep | null): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: net.features.map((f) => {
      const p = f.properties ?? {};
      if (p.kind === 'link') {
        const v = step?.velocity_ms[p.id] ?? null;
        return { ...f, properties: { ...p, velocity_ms: v, flow_ls: step?.flow_ls[p.id] ?? null, color: velocityColor(v) } };
      }
      const pressure = step?.pressure_m[p.id] ?? null;
      const status = step ? pressureStatus(p.type, pressure) : (p.type === 'Junction' ? 'no_data' : 'source');
      return { ...f, properties: { ...p, pressure_m: pressure, status, color: PRESSURE_META[status].color } };
    }),
  };
}

// --- зоны водоучёта (database/water_zones.py) ---

export type WaterZoneKind = 'dma' | 'source' | 'transit';

export interface WaterZone {
  index: number;
  name: string;
  kind: WaterZoneKind;
  nodes: number;
  junctions: number;
  sources: string[];
  demand_ls: number;
  inlets: string[];
}

export interface WaterBoundary {
  link: string;
  type: string;
  reason: 'meter' | 'pump' | 'valve' | 'closed';
  start: string;
  end: string;
  start_zone: number;
  end_zone: number;
}

export interface WaterZones {
  meters: string[];
  zones: WaterZone[];
  boundary: WaterBoundary[];
  node_zone: Record<string, number>;
  link_zone: Record<string, number>;
}

export interface WaterZoneBalance {
  index: number;
  name: string;
  kind: WaterZoneKind;
  supply_avg_ls: number;
  use_avg_ls: number | null;
  mnf_ls: number | null;
  mnf_time_s: number | null;
  mnf_share: number | null;
  imbalance_ls: number;
  leak_avg_ls: number | null;
  supply_ls: number[];
  nodes: number;
  junctions: number;
}

export interface WaterDetection {
  index: number;
  d_supply_avg_ls: number;
  d_mnf_ls: number;
  d_mnf_share: number | null;
  threshold_ls: number;
  detected: boolean;
}

export interface WaterMeterChange { link: string; from_zone: number; to_zone: number; avg_ls: number; d_avg_ls: number }

export interface WaterBalance {
  run_id: number;
  times_s: number[];
  meters: string[];
  zones: WaterZoneBalance[];
  leaks: WaterLeak[];
  baseline_id: number | null;
  detection: WaterDetection[];
  meter_changes: WaterMeterChange[];
}

/** Зоны — категориальная шкала в постоянном порядке (номер зоны — по размеру); девятая и дальше — «прочие» */
export const ZONE_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
export const ZONE_OTHER_COLOR = '#B0BEC5';
export const ZONE_SOURCE_COLOR = '#78909C';
export const METER_COLOR = '#212121';
export const BOUNDARY_COLOR = '#616161';
const METER_WIDTH = 5;

export const ZONE_KIND_LABEL: Record<WaterZoneKind, string> = {
  dma: 'район водоучёта',
  source: 'источник',
  transit: 'без потребителей',
};

/** Цвет зоны по её месту среди районов водоучёта (источники и зоны без потребителей — серые) */
export function zoneColors(zones: WaterZone[]): Record<number, string> {
  const out: Record<number, string> = {};
  let slot = 0;
  for (const z of zones) {
    if (z.kind !== 'dma') out[z.index] = ZONE_SOURCE_COLOR;
    else out[z.index] = ZONE_COLORS[slot++] ?? ZONE_OTHER_COLOR;
  }
  return out;
}

/** Кадр карты «по зонам»: участки и узлы — цветом зоны, расходомеры — толстые тёмные, прочие границы — серые */
export function zoneFrame(net: GeoJSON.FeatureCollection, zones: WaterZones): GeoJSON.FeatureCollection {
  const colors = zoneColors(zones.zones);
  const boundary = new Map(zones.boundary.map((b) => [b.link, b]));
  return {
    type: 'FeatureCollection',
    features: net.features.map((f) => {
      const p = f.properties ?? {};
      if (p.kind === 'link') {
        const b = boundary.get(p.id);
        if (b) {
          const meter = b.reason === 'meter';
          return { ...f, properties: { ...p, zone: null, boundary: b.reason, color: meter ? METER_COLOR : BOUNDARY_COLOR,
            ...(meter ? { width: METER_WIDTH } : {}) } };
        }
        const zone = zones.link_zone[p.id] ?? null;
        return { ...f, properties: { ...p, zone, color: zone == null ? ZONE_OTHER_COLOR : colors[zone] ?? ZONE_OTHER_COLOR } };
      }
      const zone = zones.node_zone[p.id] ?? null;
      return { ...f, properties: { ...p, zone, color: zone == null ? ZONE_OTHER_COLOR : colors[zone] ?? ZONE_OTHER_COLOR } };
    }),
  };
}

/** Подпись расчёта в списке: номер, базовый или сценарий утечек */
export function runLabel(run: WaterRun): string {
  if (run.summary.isolation) return `№${run.id} · отключение трубы ${run.summary.isolation.link}`;
  const leaks = run.summary.leaks ?? [];
  if (!leaks.length) return `№${run.id} · базовый`;
  const where = leaks.map((l) => `${l.node} (${l.area_cm2.toLocaleString('ru-RU')} см²)`).join(', ');
  return `№${run.id} · утечка ${where}`;
}

// --- отключение участка задвижками (database/water_isolation.py) ---

export interface WaterValves extends GeoJSON.FeatureCollection {
  count: number;
  by_source: Record<string, number>;
}

export interface WaterShortNode { node: string; expected_ls: number; delivered_ls: number; base_delivered_ls?: number | null }

export interface WaterIsolation {
  link: string;
  segment: { links: string[]; nodes: string[]; length_m: number };
  close_valves: { id: number; link: string; node: string }[];
  close_devices: string[];
  sources_inside: string[];
  no_water: { segment_nodes: string[]; cut_off_nodes: string[]; demand_ls: number };
  closed_links: string[];
  valves_total: number;
  /** С расчётом: номер расчёта модели (null — EPANET не сошёлся, причина в simulation_error) */
  run_id?: number | null;
  simulation_error?: string | null;
  supply?: {
    expected_ls: number | null;
    delivered_ls: number | null;
    short_nodes: number;
    pressure_short_nodes: number;
    pressure_short: WaterShortNode[];
  };
}

export const ISOLATION_META = {
  segment: { label: 'отключаемый участок', color: '#C62828' },
  cut_off: { label: 'отрезаны от источников', color: '#6A1B9A' },
  pressure: { label: 'недоподача из-за давления', color: '#EF6C00' },
  valve: { label: 'закрыть', color: '#212121' },
  other: { label: 'остальная сеть', color: '#B0BEC5' },
} as const;
const SEGMENT_WIDTH = 5;

/** Кадр карты «отключение»: участок — красный, закрываемые трубы и задвижки — тёмные, отрезанные узлы — фиолетовые,
 * узлы с недоподачей из-за давления — оранжевые, остальная сеть — серая */
export function isolationFrame(net: GeoJSON.FeatureCollection, iso: WaterIsolation,
  valves: GeoJSON.FeatureCollection | null): GeoJSON.FeatureCollection {
  const segLinks = new Set(iso.segment.links);
  const closed = new Set(iso.closed_links);
  const segNodes = new Set(iso.segment.nodes);
  const cutOff = new Set(iso.no_water.cut_off_nodes);
  const pressure = new Set((iso.supply?.pressure_short ?? []).map((s) => s.node));
  const toClose = new Set(iso.close_valves.map((v) => v.id));
  const features = net.features.map((f) => {
    const p = f.properties ?? {};
    let color: string = ISOLATION_META.other.color;
    let width: number | undefined;
    if (p.kind === 'link') {
      if (segLinks.has(p.id)) {
        color = ISOLATION_META.segment.color;
        width = SEGMENT_WIDTH;
      } else if (closed.has(p.id)) color = ISOLATION_META.valve.color;
    } else if (segNodes.has(p.id)) color = ISOLATION_META.segment.color;
    else if (cutOff.has(p.id)) color = ISOLATION_META.cut_off.color;
    else if (pressure.has(p.id)) color = ISOLATION_META.pressure.color;
    return { ...f, properties: { ...p, color, ...(width ? { width } : {}) } };
  });
  const valveFeatures = (valves?.features ?? [])
    .filter((v) => toClose.has(v.properties?.id))
    .map((v) => ({ ...v, properties: { ...v.properties, color: ISOLATION_META.valve.color } }));
  return { type: 'FeatureCollection', features: [...features, ...valveFeatures] };
}

// --- сеть водоканала из ГИС (database/water_gis.py) ---

export interface WaterGisInspect {
  format: string | null;
  layer: string | null;
  layers: { name: string; geometry_type: string | null; count: number }[];
  columns: string[];
  geometry_type: string | null;
  crs: string | null;
  count: number;
  warnings: string[];
  suggested: {
    diameter_field: string | null;
    material_field: string | null;
    id_field: string | null;
    status_field: string | null;
    valves_layer: string | null;
  };
}

export interface WaterGisParams {
  layer?: string | null;
  valves_layer?: string | null;
  diameter_field?: string | null;
  material_field?: string | null;
  id_field?: string | null;
  status_field?: string | null;
  total_demand_ls: number;
  source_head_m: number;
  elevation_m: number;
  snap_m: number;
  components: 'largest' | 'each';
}

export interface WaterGisReport {
  epsg: number;
  lines_in: number;
  rows_without_lines: number;
  t_splits: number;
  zero_length_dropped: number;
  components: number;
  kept_components: number;
  pipes: number;
  junctions: number;
  dropped_pipes: number;
  length_km: number;
  diameter: { field_in_metres: boolean; missing: number };
  materials: Record<string, number>;
  sources: { node: string; auto: boolean; lon: number; lat: number }[];
  source_head_m: number;
  valves?: { points: number; matched: number; missed: number };
  engine: { Nodes: number; Links: number };
}

/** Линейные слои файла — кандидаты в слой труб; точечные — в слой задвижек */
export function gisLayers(info: WaterGisInspect | null, kind: 'line' | 'point'): string[] {
  return (info?.layers ?? []).filter((l) => String(l.geometry_type ?? '').toLowerCase().includes(kind)).map((l) => l.name);
}

/** Отчёт сборки сети одной строкой: трубы, длина, части, Т-примыкания, отброшенное */
export function gisReportLines(r: WaterGisReport): string[] {
  const n = (v: number) => v.toLocaleString('ru-RU');
  const lines = [
    `Труб в модели: ${n(r.pipes)} (${n(r.length_km)} км), узлов: ${n(r.junctions)}, источников: ${r.sources.length}.`,
    `Связных частей: ${r.components}, в модели — ${r.kept_components}` +
      (r.dropped_pipes ? `; отброшено труб: ${n(r.dropped_pipes)} (не связаны с источником).` : '.'),
  ];
  if (r.t_splits) lines.push(`Т-примыканий разрезано: ${n(r.t_splits)}.`);
  if (r.zero_length_dropped) lines.push(`Нулевых труб (короче допуска сшивки): ${n(r.zero_length_dropped)}.`);
  if (r.diameter.missing) lines.push(`Без диаметра: ${n(r.diameter.missing)} — взят диаметр по умолчанию.`);
  if (r.diameter.field_in_metres) lines.push('Диаметры в поле — в метрах, переведены в мм.');
  if (r.valves) lines.push(`Задвижек: ${n(r.valves.matched)} привязано, ${n(r.valves.missed)} без трубы рядом.`);
  return lines;
}

/** Время шага расчёта: «5 ч 30 мин» от начала периода модели */
export function stepTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}
