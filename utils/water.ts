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

/** Время шага расчёта: «5 ч 30 мин» от начала периода модели */
export function stepTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}
