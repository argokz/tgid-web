import type {
  SelectCondition,
  SelectField,
  SelectOp,
  SelectResult,
  SelectSpec,
  SelectTarget,
  SelectValue,
} from '~/services/api/types';

/**
 * Конструктор выборки по условиям (окно NetworkSelectDialog): строки условий в виде, удобном для полей
 * ввода, и запрос SelectSpec для api/v1/network-select. Проверку полей и операций делает и сервер
 * (белый список) — здесь только то, что нужно, чтобы не отправлять пустые строки.
 */

export interface ConditionRow {
  /** Ключ строки в списке (v-for) */
  id: number;
  field: string;
  op: SelectOp;
  /** Число или текст как введено (запятая в дробях допустима) */
  value: string;
  value2: string;
  values: SelectValue[];
}

export interface BuilderState {
  target: SelectTarget;
  rows: ConditionRow[];
  match: 'all' | 'any';
  nearOn: boolean;
  nearNode: string;
  nearMeters: number;
  inView: boolean;
  /** visible — фрагменты на карте; all — все фрагменты; list — названные в запросе (fragments) */
  scope: 'visible' | 'all' | 'list';
  fragments: number[];
  orderBy: string | null;
  orderDesc: boolean;
  limit: number;
}

export const DEFAULT_LIMIT = 1000;
export const DEFAULT_NEAR_M = 200;
/** Точек в окружности «в N м от» на карте */
const CIRCLE_STEPS = 64;
const EARTH_M_PER_DEG = 111_320;

export const emptyBuilder = (target: SelectTarget = 'lines'): BuilderState => ({
  target,
  rows: [],
  match: 'all',
  nearOn: false,
  nearNode: '',
  nearMeters: DEFAULT_NEAR_M,
  inView: false,
  scope: 'visible',
  fragments: [],
  orderBy: null,
  orderDesc: true,
  limit: DEFAULT_LIMIT,
});

export const defaultOp = (field: SelectField): SelectOp => {
  if (field.kind === 'category') return 'in';
  if (field.kind === 'text') return 'contains';
  return 'ge';
};

let rowSeq = 0;
const nextRowId = (): number => {
  rowSeq += 1;
  return rowSeq;
};

export const newRow = (field: SelectField): ConditionRow => ({
  id: nextRowId(),
  field: field.key,
  op: defaultOp(field),
  value: '',
  value2: '',
  values: [],
});

/** «1,5» → 1.5; пусто или не число — null */
export const parseNumber = (text: string): number | null => {
  const s = text.trim().replace(/\s/g, '').replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

export const opNeedsValue = (op: SelectOp): boolean => op !== 'is_null' && op !== 'not_null';

/** Условие строки или null, если строка не заполнена */
export const rowCondition = (row: ConditionRow, field: SelectField | undefined): SelectCondition | null => {
  if (!field || !field.ops.includes(row.op)) return null;
  if (!opNeedsValue(row.op)) return { field: row.field, op: row.op };
  if (field.kind === 'category') {
    return row.values.length ? { field: row.field, op: row.op, values: [...row.values] } : null;
  }
  if (field.kind === 'text') {
    const text = row.value.trim();
    return text ? { field: row.field, op: row.op, value: text } : null;
  }
  const value = parseNumber(row.value);
  if (value === null) return null;
  if (row.op !== 'between') return { field: row.field, op: row.op, value };
  const value2 = parseNumber(row.value2);
  return value2 === null ? null : { field: row.field, op: row.op, value, value2 };
};

const scopeFragments = (state: BuilderState, visibleFragments: number[]): number[] | null => {
  if (state.scope === 'list' && state.fragments.length) return [...state.fragments];
  if (state.scope === 'visible' && visibleFragments.length) return [...visibleFragments];
  return null;
};

export const buildSpec = (
  state: BuilderState,
  fields: SelectField[],
  visibleFragments: number[],
): SelectSpec => {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const conditions = state.rows
    .map((row) => rowCondition(row, byKey.get(row.field)))
    .filter((c): c is SelectCondition => c !== null);
  const nearNode = state.nearNode.trim();
  return {
    target: state.target,
    conditions,
    match: state.match,
    near: state.nearOn && nearNode ? { node_name: nearNode, meters: state.nearMeters } : null,
    in_view: state.inView,
    fragment_ids: scopeFragments(state, visibleFragments),
    order_by: state.orderBy,
    order_desc: state.orderDesc,
    limit: state.limit,
  };
};

const toText = (v: SelectValue | null | undefined): string => (v === null || v === undefined ? '' : String(v));

/** Запрос (от ИИ или из результата) → состояние конструктора */
export const builderFromSpec = (spec: SelectSpec, visibleFragments: number[]): BuilderState => {
  const ids = spec.fragment_ids ?? [];
  const sameAsVisible = ids.length === visibleFragments.length && ids.every((id) => visibleFragments.includes(id));
  const scope: BuilderState['scope'] = !ids.length ? 'all' : sameAsVisible ? 'visible' : 'list';
  const near = spec.near;
  return {
    target: spec.target,
    rows: spec.conditions.map((c) => ({
      id: nextRowId(),
      field: c.field,
      op: c.op,
      value: toText(c.value),
      value2: toText(c.value2),
      values: [...(c.values ?? [])],
    })),
    match: spec.match,
    nearOn: !!near,
    nearNode: near?.node_name ?? (near?.node_id != null ? String(near.node_id) : ''),
    nearMeters: near?.meters ?? DEFAULT_NEAR_M,
    inView: spec.in_view,
    scope,
    fragments: scope === 'list' ? [...ids] : [],
    orderBy: spec.order_by ?? null,
    orderDesc: spec.order_desc,
    limit: spec.limit,
  };
};

/** Число с разрядами и без лишних нулей: 12 345,6 */
export const formatNumber = (v: number, digits = 1): string =>
  v.toLocaleString('ru-RU', { maximumFractionDigits: digits });

export const formatValue = (v: SelectValue | null | undefined): string => {
  if (v === null || v === undefined || v === '') return '—';
  return typeof v === 'number' ? formatNumber(v, 3) : v;
};

const csvCell = (v: unknown): string => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Результат в CSV (разделитель «;», как ждёт Excel с русской локалью) */
export const resultCsv = (res: SelectResult): string => {
  const extra = res.target === 'lines' ? ['Длина, м'] : ['Вид узла', 'Тип'];
  const near = res.near_center ? ['Расстояние, м'] : [];
  const header = ['id', 'Фрагмент', res.target === 'lines' ? 'Участок' : 'Узел', ...extra, ...near,
    ...res.columns.map((c) => (c.units ? `${c.label}, ${c.units}` : c.label)), 'Долгота', 'Широта'];
  const lines = res.items.map((item) => [
    item.id,
    item.fileid,
    item.title,
    ...(res.target === 'lines' ? [item.length] : [item.node_type, item.card_type]),
    ...(res.near_center ? [item.distance_m] : []),
    ...res.columns.map((c) => item.values[c.key]),
    item.lon,
    item.lat,
  ].map(csvCell).join(';'));
  return [header.map(csvCell).join(';'), ...lines].join('\r\n');
};

/** Окружность «в N м от» для карты (WGS 84) */
export const circlePolygon = (lon: number, lat: number, meters: number): GeoJSON.Polygon => {
  const dLat = meters / EARTH_M_PER_DEG;
  const dLon = meters / (EARTH_M_PER_DEG * Math.max(Math.cos((lat * Math.PI) / 180), 0.05));
  const ring: [number, number][] = [];
  for (let i = 0; i <= CIRCLE_STEPS; i += 1) {
    const a = (2 * Math.PI * i) / CIRCLE_STEPS;
    ring.push([lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return { type: 'Polygon', coordinates: [ring] };
};

/** Объекты выборки и окружность «рядом с» — одна коллекция для оверлея карты */
export const resultMapData = (res: SelectResult): GeoJSON.FeatureCollection => {
  const features: GeoJSON.Feature[] = [...(res.geojson?.features ?? [])];
  if (res.near_center) {
    const { lon, lat, meters } = res.near_center;
    features.unshift({ type: 'Feature', geometry: circlePolygon(lon, lat, meters), properties: { kind: 'near' } });
  }
  return { type: 'FeatureCollection', features };
};
