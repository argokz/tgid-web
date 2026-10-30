/**
 * Показатели эксплуатации (фаза 2, дашборды KPI): типы сводки itwin-api GET /api/v1/kpi/dashboard и чистые правила
 * окна «Показатели» — периоды, видимая область карты, параметры графиков ECharts.
 *
 * Графики — по одной серии одного цвета (без двух осей); категории износа — порядковые, одним оттенком от светлого
 * к тёмному; статусы нарядов — их собственными цветами (STATUS_META) с подписью.
 */
import { STATUS_META, type WorkOrderStatus } from './workOrders';

export interface KpiItem {
  id: number | null;
  name: string;
  count: number;
}

export interface KpiDashboard {
  period: { from: string; to: string; days: number };
  filters: { fileid: number | null; bbox: number[] | null };
  defects: {
    total: number;
    open_now: number;
    per_100km_year: number | null;
    by_month: Array<{ month: string; count: number }>;
    by_category: KpiItem[];
    by_state: KpiItem[];
    by_source: KpiItem[];
    repairs_done: number;
    repair_avg_days: number | null;
  };
  work_orders: {
    by_status: Partial<Record<WorkOrderStatus, number>>;
    overdue: number;
    created: number;
    done: number;
    avg_hours_to_done: number | null;
    arrived_share: number | null;
  };
  outages: { total: number; by_kind: Record<string, number>; consumers: number; avg_hours: number | null; active_now: number };
  network: { km: number; lines: number; by_diameter: Array<{ name: string; km: number }>; by_decade: Array<{ name: string; km: number }> };
  wear: {
    calculation_id: number;
    name: string | null;
    at: string | null;
    lines: number;
    avg_wear: number | null;
    by_category: Record<string, number>;
    category_labels: Record<string, string>;
  } | null;
  generated_at: string;
}

export type PeriodPreset = '12m' | 'year' | 'prev-year' | 'custom';

const iso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Период по кнопке: последние 12 месяцев (с 1-го числа), этот год, прошлый год */
export function presetPeriod(preset: Exclude<PeriodPreset, 'custom'>, today = new Date()): { from: string; to: string } {
  const y = today.getFullYear();
  if (preset === 'year') return { from: `${y}-01-01`, to: iso(today) };
  if (preset === 'prev-year') return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
  return { from: iso(new Date(y - 1, today.getMonth(), 1)), to: iso(today) };
}

/** Видимая область карты → параметр bbox («минДолгота,минШирота,максДолгота,максШирота», 5 знаков) */
export function bboxParam(b: { west: number; south: number; east: number; north: number }): string {
  const clamp = (v: number, lim: number) => Math.max(-lim, Math.min(lim, v));
  return [clamp(b.west, 180), clamp(b.south, 90), clamp(b.east, 180), clamp(b.north, 90)].map((v) => v.toFixed(5)).join(',');
}

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

/** «2026-05» → «май 26» */
export function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  return `${MONTHS[Number(m) - 1] ?? m} ${y.slice(2)}`;
}

/** Месяц с наибольшим числом («май 26»); все нули — null */
export function peakMonth(months: Array<{ month: string; count: number }>): string | null {
  const top = months.reduce<{ month: string; count: number } | null>((a, b) => (b.count > (a?.count ?? 0) ? b : a), null);
  return top ? monthLabel(top.month) : null;
}

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(text: string): string {
  return String(text).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

const nf = (v: number, digits = 0) => v.toLocaleString('ru-RU', { maximumFractionDigits: digits });

interface BarSpec {
  categories: string[];
  values: number[];
  /** имя серии — в подсказке */
  name: string;
  unit?: string;
  digits?: number;
  horizontal?: boolean;
  /** свой цвет каждого столбца (порядковая шкала, статусы); нет — цвет темы */
  colors?: string[];
}

/** Столбчатый график одной серии: подсказка по наведению, подписи значений — только у столбцов */
export function barOption(spec: BarSpec): Record<string, unknown> {
  const unit = spec.unit ? ` ${spec.unit}` : '';
  const cat = { type: 'category', data: spec.categories, axisLabel: { interval: 0, hideOverlap: true } };
  const val = { type: 'value', minInterval: spec.digits ? undefined : 1 };
  return {
    // сверху — место под кнопку «PNG» рамки графика
    grid: { left: 8, right: 24, top: 36, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'item',
      // подсказка ECharts — HTML, а названия категорий — из справочников, которые правят в вебе: экранировать
      formatter: (p: { name: string; value: number }) => `${escapeHtml(p.name)}: <b>${nf(p.value, spec.digits)}${unit}</b>`,
    },
    xAxis: spec.horizontal ? val : cat,
    yAxis: spec.horizontal ? { ...cat, inverse: true } : val,
    series: [{
      type: 'bar',
      name: spec.name,
      data: spec.values.map((v, i) => (spec.colors?.[i] ? { value: v, itemStyle: { color: spec.colors[i] } } : v)),
      barMaxWidth: 28,
      itemStyle: { borderRadius: spec.horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0] },
      label: { show: spec.values.length <= 12, position: spec.horizontal ? 'right' : 'top', fontSize: 11,
        formatter: (p: { value: number }) => (p.value ? nf(p.value, spec.digits) : '') },
      emphasis: { focus: 'self' },
    }],
  };
}

/** Категории износа 1…5 — одним оттенком от светлого (хорошее) к тёмному (плохое) */
export const WEAR_RAMP = ['#FFE0B2', '#FFB74D', '#FB8C00', '#E65100', '#8D2A00'];

export function wearBars(wear: NonNullable<KpiDashboard['wear']>): BarSpec {
  const keys = ['1', '2', '3', '4', '5'];
  return {
    categories: keys.map((k) => wear.category_labels[k] ?? `Категория ${k}`),
    values: keys.map((k) => wear.by_category[k] ?? 0),
    name: 'Участков',
    colors: WEAR_RAMP,
  };
}

export function workOrderBars(byStatus: KpiDashboard['work_orders']['by_status'], labels: Record<string, string>): BarSpec {
  const statuses = Object.keys(STATUS_META) as WorkOrderStatus[];
  return {
    categories: statuses.map((s) => labels[s] ?? s),
    values: statuses.map((s) => byStatus[s] ?? 0),
    name: 'Нарядов',
    colors: statuses.map((s) => STATUS_META[s].mapColor),
  };
}

/** Дефекты для слоя карты: цвет — состояние (нарушение — красный, ремонт — оранжевый, после ремонта — серый) */
export const DEFECT_STATE_COLORS: Record<number, string> = { 1: '#C62828', 2: '#EF6C00', 3: '#78909C' };

export function defectMapFeatures(fc: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: fc.features.map((f) => ({
      ...f,
      properties: { ...f.properties, color: DEFECT_STATE_COLORS[Number(f.properties?.state_id)] ?? '#C62828' },
    })),
  };
}

/** Строки табличного вида: одна таблица на график */
export function tableRows(categories: string[], values: number[]): Array<{ name: string; value: number }> {
  return categories.map((name, i) => ({ name, value: values[i] ?? 0 }));
}
