/**
 * Телеметрия (itwin-api routers/telemetry.py): типы, оценка «факт против модели» и график показаний для окна
 * «Телеметрия» (components/TelemetryDialog.vue).
 */

export type SensorKind = 'pressure' | 'temperature' | 'flow';
export type SensorPipe = 'supply' | 'return';
export type SensorStatus = 'ok' | 'warn' | 'bad' | 'stale' | 'no_model' | 'no_data';

export interface SensorDeviation {
  diff: number;
  pct: number | null;
  status: 'ok' | 'warn' | 'bad';
  base_unit: string;
}

export interface Sensor {
  id: number;
  code: string;
  name: string;
  kind: SensorKind;
  kind_label: string;
  pipe: SensorPipe;
  pipe_label: string;
  unit: string;
  unit_label: string;
  node_id: number | null;
  line_id: number | null;
  node_name?: string | null;
  fileid: number | null;
  lon: number | null;
  lat: number | null;
  active: boolean;
  note: string;
  last?: { ts: string; value: number } | null;
  stale?: boolean;
  calculation?: { id: number; at: string } | null;
  /** значение модели в единицах датчика */
  model?: number | null;
  base_unit?: string;
  deviation?: SensorDeviation | null;
}

export interface SensorInput {
  code: string;
  name: string;
  kind: SensorKind;
  pipe: SensorPipe;
  unit: string;
  node_id?: number | null;
  line_id?: number | null;
  active: boolean;
  note: string;
}

export interface TelemetryUnits {
  kinds: { value: SensorKind; label: string; base_unit: string }[];
  pipes: { value: SensorPipe; label: string }[];
  units: { value: string; kind: SensorKind; label: string }[];
  thresholds: { ok_pct: number; warn_pct: number; ok_deg: number; warn_deg: number; stale_min: number };
}

export interface SeriesPoint {
  t: string;
  avg: number;
  min: number;
  max: number;
  n: number;
}

export interface SensorSeries {
  sensor: Sensor;
  step_min: number;
  points: SeriesPoint[];
}

export interface ImportResult {
  accepted: number;
  skipped: number;
  unknown_codes: string[];
  future: number;
  notes?: string[];
}

export type AlertStatus = 'bad' | 'silent' | 'normal';

export interface TelemetryAlert {
  id: number;
  sensor_id: number;
  code: string;
  name: string;
  kind: SensorKind;
  pipe: SensorPipe;
  status: AlertStatus;
  prev_status: AlertStatus | null;
  label: string;
  at: string;
  value: number | null;
  model: number | null;
  diff: number | null;
  pct: number | null;
  unit_label: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
}

export type CalibrationStatus = 'ok' | 'noise' | 'rough' | 'local' | 'check';

export interface CalibrationSegment {
  pipe: SensorPipe;
  label: string;
  from: { sensor_id: number; code: string; node_id: number; node_name: string | null };
  to: { sensor_id: number; code: string; node_id: number; node_name: string | null };
  calculation_id: number;
  dh_model: number;
  dh_fact: number;
  ratio: number;
  uncertainty: number;
  status: CalibrationStatus;
  text: string;
  roughness_factor: number | null;
  roughness_mm: number | null;
  roughness_suggested_mm: number | null;
  line_ids: number[];
  lines: number;
  length_m: number;
  d_min: number | null;
  d_max: number | null;
  geometry: GeoJSON.Geometry | null;
}

export interface CalibrationResult {
  window_min: number;
  accuracy_m: number;
  segments: CalibrationSegment[];
  skipped: string[];
}

/** Вывод калибровки: подпись и цвет (значок — в окне) */
export const CALIBRATION_META: Record<CalibrationStatus, { label: string; color: string }> = {
  ok: { label: 'согласовано', color: '#2E7D32' },
  noise: { label: 'в погрешности', color: '#616161' },
  rough: { label: 'шероховатость', color: '#B26A00' },
  local: { label: 'местное сопротивление', color: '#C62828' },
  check: { label: 'проверить датчики', color: '#6A1B9A' },
};

/** Участки пары для карты: линия цвета вывода */
export function calibrationFeature(seg: CalibrationSegment): GeoJSON.FeatureCollection {
  if (!seg.geometry) return { type: 'FeatureCollection', features: [] };
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: seg.geometry,
      properties: { name: seg.label, color: CALIBRATION_META[seg.status].color },
    }],
  };
}

/** Цвет тревоги: расхождение, молчит, вернулся в норму */
export const ALERT_COLORS: Record<AlertStatus, string> = { bad: '#C62828', silent: '#616161', normal: '#2E7D32' };

/** Оценка датчика: молчит → нет показаний → нет модели → расхождение */
export function sensorStatus(s: Pick<Sensor, 'last' | 'stale' | 'deviation' | 'model'>): SensorStatus {
  if (!s.last) return 'no_data';
  if (s.stale) return 'stale';
  if (s.deviation) return s.deviation.status;
  return 'no_model';
}

/** Подпись и цвет оценки (значки — в окне: components/TelemetryDialog.vue) */
export const STATUS_META: Record<SensorStatus, { label: string; color: string }> = {
  ok: { label: 'норма', color: '#2E7D32' },
  warn: { label: 'внимание', color: '#B26A00' },
  bad: { label: 'расхождение', color: '#C62828' },
  stale: { label: 'молчит', color: '#616161' },
  no_model: { label: 'нет расчёта', color: '#78909C' },
  no_data: { label: 'нет показаний', color: '#9E9E9E' },
};

const nf = (v: number, digits = 2) => v.toLocaleString('ru-RU', { maximumFractionDigits: digits });

/** «+12,6 %» или «−2,6 °C» — расхождение факта с моделью */
export function deviationText(d: SensorDeviation | null | undefined): string {
  if (!d) return '—';
  const sign = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '');
  if (d.pct != null) return `${sign(d.pct)}${nf(Math.abs(d.pct), 1)} %`;
  return `${sign(d.diff)}${nf(Math.abs(d.diff), 1)} ${d.base_unit}`;
}

export function valueText(v: number | null | undefined, unit: string): string {
  return v == null ? '—' : `${nf(v, Math.abs(v) >= 100 ? 1 : 3)} ${unit}`;
}

/** Порядок в списке: сначала требующие внимания */
const ORDER: SensorStatus[] = ['bad', 'warn', 'stale', 'no_data', 'no_model', 'ok'];
export function sortSensors(list: Sensor[]): Sensor[] {
  return [...list].sort((a, b) => ORDER.indexOf(sensorStatus(a)) - ORDER.indexOf(sensorStatus(b))
    || a.name.localeCompare(b.name, 'ru'));
}

/**
 * График показаний: одна серия (среднее по интервалу) с полосой «мин–макс» и горизонтальной линией модели —
 * сразу видно, насколько факт уходит от расчёта.
 */
export function seriesOption(series: SensorSeries, model: number | null | undefined, color = '#1565C0'): Record<string, unknown> {
  const { sensor, points } = series;
  const unit = sensor.unit_label;
  const data = points.map((p) => [p.t, p.avg]);
  const low = points.map((p) => [p.t, p.min]);
  const band = points.map((p) => [p.t, p.max - p.min]);
  const time = (iso: string) => new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return {
    grid: { left: 8, right: 64, top: 36, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      formatter: (items: { dataIndex: number }[]) => {
        const p = points[items[0]?.dataIndex ?? 0];
        if (!p) return '';
        const range = p.n > 1 ? `<br>мин ${nf(p.min, 3)} · макс ${nf(p.max, 3)}` : '';
        const vs = model != null ? `<br>модель ${nf(model, 3)}` : '';
        return `${time(p.t)}<br><b>${nf(p.avg, 3)} ${unit}</b>${range}${vs}`;
      },
    },
    xAxis: { type: 'time', axisLabel: { hideOverlap: true } },
    // ось — и по факту, и по модели: расстояние между ними и есть смысл графика
    yAxis: {
      type: 'value', scale: true, name: unit, nameTextStyle: { align: 'left' },
      // края оси — с запасом, дробные: подписи только у круглых делений
      axisLabel: { showMinLabel: false, showMaxLabel: false },
      min: (v: { min: number; max: number }) => padded(Math.min(v.min, model ?? v.min), v, -1),
      max: (v: { min: number; max: number }) => padded(Math.max(v.max, model ?? v.max), v, 1),
    },
    series: [
      // полоса мин–макс: невидимое основание + высота полосы
      { type: 'line', data: low, stack: 'band', symbol: 'none', lineStyle: { opacity: 0 }, silent: true, tooltip: { show: false } },
      { type: 'line', data: band, stack: 'band', symbol: 'none', lineStyle: { opacity: 0 }, silent: true,
        areaStyle: { color, opacity: 0.12 }, tooltip: { show: false } },
      {
        type: 'line', name: 'Факт', data, symbol: 'none', lineStyle: { width: 2, color }, itemStyle: { color },
        markLine: model == null ? undefined : {
          symbol: 'none', silent: true,
          lineStyle: { type: 'dashed', color: '#424242', width: 1.5 },
          label: { formatter: `модель ${nf(model, 3)}`, position: 'end', color: '#424242' },
          data: [{ yAxis: model }],
        },
      },
    ],
  };
}

/** Край оси с запасом 5 % размаха (с моделью размах шире) */
function padded(edge: number, v: { min: number; max: number }, dir: 1 | -1): number {
  const span = Math.max(v.max - v.min, Math.abs(edge) * 0.01, 1e-6);
  return Number((edge + dir * span * 0.05).toPrecision(6));
}

/** Короткое описание графика для чтения с экрана и подписи под ним */
export function seriesSummary(series: SensorSeries, model: number | null | undefined): string {
  const pts = series.points;
  if (!pts.length) return 'Показаний за период нет';
  const avg = pts.reduce((s, p) => s + p.avg * p.n, 0) / pts.reduce((s, p) => s + p.n, 0);
  const min = Math.min(...pts.map((p) => p.min));
  const max = Math.max(...pts.map((p) => p.max));
  const u = series.sensor.unit_label;
  const vs = model != null ? `; модель — ${nf(model, 3)} ${u}` : '';
  return `Среднее ${nf(avg, 3)} ${u}, от ${nf(min, 3)} до ${nf(max, 3)} (интервал ${series.step_min} мин)${vs}`;
}
