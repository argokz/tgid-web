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
  base_demand_ls: number;
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
  const leaks = run.summary.leaks ?? [];
  if (!leaks.length) return `№${run.id} · базовый`;
  const where = leaks.map((l) => `${l.node} (${l.area_cm2.toLocaleString('ru-RU')} см²)`).join(', ');
  return `№${run.id} · утечка ${where}`;
}

/** Время шага расчёта: «5 ч 30 мин» от начала периода модели */
export function stepTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}
