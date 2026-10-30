/** Прогноз нагрузки по погоде (itwin-api database/load_forecast.py, weather.py): типы и графики. */

export interface WeatherState {
  provider: string;
  updated_at?: string | null;
  error?: string | null;
  lat?: number | null;
  lon?: number | null;
}

export interface WeatherHour { ts: string; kind: 'forecast' | 'fact'; t_air: number; source: string }

export interface ForecastNext {
  hours: number;
  t_min?: number;
  t_max?: number;
  q_max?: number;
  q_avg?: number;
  q_sum?: number;
  tn_calc?: number;
}

export interface ForecastSource {
  id: number;
  name: string | null;
  node_id: number;
  fileid: number;
  fragment: string | null;
  consumers: number;
  calculation: { id: number; tn: number; at: string | null };
  base: { tn: number; heating: number; vent: number; hw: number; total: number };
  next: ForecastNext;
}

export interface ForecastOverview {
  weather: WeatherState;
  now: string;
  hours: WeatherHour[];
  sources: ForecastSource[];
}

export interface ForecastPoint {
  ts: string;
  t_air: number;
  kind: 'forecast' | 'fact';
  source: string;
  heating: number;
  vent: number;
  hw: number;
  total: number;
  t1: number;
  t2: number;
  fact: number | null;
}

export interface ForecastDetail extends ForecastSource {
  weather: WeatherState;
  now: string;
  sensors: Record<string, string[]>;
  points: ForecastPoint[];
  accuracy: { hours: number; mean_pct: number; mean_abs_pct: number } | null;
}

export const FORECAST_COLOR = '#1565C0';
export const FACT_COLOR = '#C2410C';

const nf = (v: number, digits = 1) => v.toLocaleString('ru-RU', { maximumFractionDigits: digits });
const hourText = (iso: string) => new Date(iso).toLocaleString('ru-RU', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
});

/** Ось времени по-русски: дни — дд.мм, часы — чч:мм (по умолчанию ECharts пишет месяцы по-английски) */
const TIME_AXIS = {
  type: 'time',
  axisLabel: {
    hideOverlap: true,
    formatter: { year: '{yyyy}', month: '{dd}.{MM}', day: '{dd}.{MM}', hour: '{HH}:{mm}', minute: '{HH}:{mm}' },
  },
};
// сверху — легенда, под ней подпись единиц оси
const GRID = { left: 8, right: 24, top: 48, bottom: 8, containLabel: true };

/** Вертикаль «сейчас» на оси времени */
function nowLine(now: string) {
  return {
    symbol: 'none', silent: true,
    lineStyle: { type: 'solid', color: '#9E9E9E', width: 1 },
    label: { formatter: 'сейчас', position: 'insideEndTop', color: '#616161' },
    data: [{ xAxis: now }],
  };
}

/** Температура воздуха: факт — сплошная, прогноз — пунктир (один цвет, вид — стилем линии) */
export function temperatureOption(points: { ts: string; t_air: number; kind: string }[], now: string): Record<string, unknown> {
  const fact = points.map((p) => [p.ts, p.kind === 'fact' ? p.t_air : null]);
  // прогноз начинается с последней точки факта — линия без разрыва
  const lastFact = points.reduce((i, p, idx) => (p.kind === 'fact' ? idx : i), -1);
  const forecast = points.map((p, idx) => [p.ts, p.kind === 'forecast' || idx === lastFact ? p.t_air : null]);
  return {
    grid: GRID,
    legend: { top: 0, left: 0, data: ['Факт', 'Прогноз'], textStyle: { fontSize: 11 } },
    tooltip: {
      trigger: 'axis',
      formatter: (items: { dataIndex: number }[]) => {
        const p = points[items[0]?.dataIndex ?? 0];
        return p ? `${hourText(p.ts)}<br><b>${nf(p.t_air)} °C</b> · ${p.kind === 'fact' ? 'факт' : 'прогноз'}` : '';
      },
    },
    xAxis: TIME_AXIS,
    yAxis: { type: 'value', scale: true, name: '°C', nameTextStyle: { align: 'left' } },
    series: [
      { type: 'line', name: 'Факт', data: fact, symbol: 'none', connectNulls: false,
        lineStyle: { width: 2, color: FORECAST_COLOR }, itemStyle: { color: FORECAST_COLOR }, markLine: nowLine(now) },
      { type: 'line', name: 'Прогноз', data: forecast, symbol: 'none', connectNulls: false,
        lineStyle: { width: 2, color: FORECAST_COLOR, type: 'dashed' }, itemStyle: { color: FORECAST_COLOR } },
    ],
  };
}

/** Нагрузка источника: прогноз по погоде (на прошлых часах — по фактической погоде) и факт по датчикам */
export function loadOption(points: ForecastPoint[], now: string): Record<string, unknown> {
  const hasFact = points.some((p) => p.fact != null);
  return {
    grid: GRID,
    legend: { top: 0, left: 0, data: hasFact ? ['Прогноз по погоде', 'Факт по датчикам'] : ['Прогноз по погоде'],
      textStyle: { fontSize: 11 } },
    tooltip: {
      trigger: 'axis',
      formatter: (items: { dataIndex: number }[]) => {
        const p = points[items[0]?.dataIndex ?? 0];
        if (!p) return '';
        const fact = p.fact != null ? `<br>факт <b>${nf(p.fact)}</b>` : '';
        return `${hourText(p.ts)} · ${nf(p.t_air)} °C<br>прогноз <b>${nf(p.total)}</b> Гкал/ч${fact}`
          + `<br>отопление ${nf(p.heating)} · вентиляция ${nf(p.vent)} · ГВС ${nf(p.hw)}`
          + `<br>график: подача ${nf(p.t1)} / обратка ${nf(p.t2)} °C`;
      },
    },
    xAxis: TIME_AXIS,
    yAxis: { type: 'value', scale: true, name: 'Гкал/ч', nameTextStyle: { align: 'left' } },
    series: [
      { type: 'line', name: 'Прогноз по погоде', data: points.map((p) => [p.ts, p.total]), symbol: 'none',
        lineStyle: { width: 2, color: FORECAST_COLOR }, itemStyle: { color: FORECAST_COLOR }, markLine: nowLine(now) },
      ...(hasFact ? [{
        type: 'line', name: 'Факт по датчикам', data: points.map((p) => [p.ts, p.fact]), symbol: 'circle',
        symbolSize: 8, connectNulls: false, lineStyle: { width: 2, color: FACT_COLOR }, itemStyle: { color: FACT_COLOR },
      }] : []),
    ],
  };
}

/** Короткое описание графика нагрузки — для чтения с экрана и подписи */
export function loadSummary(d: ForecastDetail): string {
  const n = d.next;
  if (!n.hours) return 'Прогноза погоды на ближайшие сутки нет';
  const acc = d.accuracy
    ? `; по фактической погоде против датчиков — в среднем ${d.accuracy.mean_pct > 0 ? '+' : ''}${nf(d.accuracy.mean_pct)} %`
      + ` (${d.accuracy.hours} ч)`
    : '';
  return `Сутки: воздух ${nf(n.t_min ?? 0)}…${nf(n.t_max ?? 0)} °C, пик ${nf(n.q_max ?? 0)} Гкал/ч, `
    + `среднее ${nf(n.q_avg ?? 0)} Гкал/ч, отпуск ${nf(n.q_sum ?? 0, 0)} Гкал${acc}`;
}

/** Состояние источника погоды одной строкой */
export function weatherText(w: WeatherState): string {
  if (w.provider !== 'open-meteo') return 'Прогноз погоды — вручную или файлом (Open-Meteo выключен)';
  const at = w.updated_at ? `, обновлено ${hourText(w.updated_at)}` : '';
  const err = w.error ? ` — ${w.error}` : '';
  return `Погода — Open-Meteo (${nf(w.lat ?? 0, 2)}, ${nf(w.lon ?? 0, 2)})${at}${err}`;
}
