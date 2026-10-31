/** Прогноз аварийности (itwin-api database/failure_forecast.py): типы, классы риска, слой карты. */

export interface FailureMetrics {
  auc: number | null;
  auc_logit: number | null;
  auc_history_only: number | null;
  baselines_auc: Record<string, number | null>;
  top_share: number;
  top_capture: number | null;
  train: { lines: number; events: number };
  test: { lines: number; events: number };
  /** Ретроспектива плана: доля повреждений окна проверки на участках, переложенных первыми в пределах N км */
  capture_by_km?: Record<'model' | 'oldest_first' | 'near_defects', Record<string, number | null>>;
  length_km?: number;
  population_rule?: {
    passport_fields: string[]; min_filled: number; lines: number; lines_all: number; damaged_kept: number | null;
    copies_merged?: number;
  };
}

export interface FailureRun {
  id: number;
  horizon_years: number;
  cutoffs: { train: string; test: string; final: string; now: string };
  metrics: FailureMetrics;
  importance: { feature: string; label: string; share: number }[];
  population: number;
  expected_events: number | null;
  took_s: number | null;
  created_by: string | null;
  created_at: string;
}

export interface FailureRiskItem {
  lineid: number;
  prob: number;
  rank_pct: number;
  hist_all: number | null;
  near200: number | null;
  age: number | null;
  len_m: number | null;
  fileid: number | null;
  fragment: string | null;
  dn: number | null;
}

export interface FailureTop {
  run_id: number;
  items: FailureRiskItem[];
  geojson: GeoJSON.FeatureCollection;
}

/** Риск — последовательная шкала одного тона (светлее — ниже); классы — по месту в показанном списке */
export const RISK_CLASSES = [
  { label: 'первые 5 % списка', share: 0.05, color: '#7F0000' },
  { label: '5–20 %', share: 0.2, color: '#C62828' },
  { label: '20–50 %', share: 0.5, color: '#EF5350' },
  { label: 'вторая половина', share: 1, color: '#FFAB91' },
] as const;

/** Класс риска по месту в списке, отсортированном по убыванию вероятности (0 — первый) */
export function riskClass(index: number, total: number) {
  const pos = total > 0 ? (index + 1) / total : 1;
  return RISK_CLASSES.find((c) => pos <= c.share) ?? RISK_CLASSES[RISK_CLASSES.length - 1];
}

/** Участки списка для карты: цвет по классу риска, толщина по нему же */
export function riskFrame(top: FailureTop): GeoJSON.FeatureCollection {
  const order = new Map(top.items.map((x, i) => [x.lineid, i]));
  const total = top.items.length;
  return {
    type: 'FeatureCollection',
    features: top.geojson.features.map((f) => {
      const i = order.get(f.properties?.lineid) ?? total - 1;
      const cls = riskClass(i, total);
      return { ...f, properties: { ...f.properties, color: cls.color, width: i < total * 0.05 ? 6 : 4 } };
    }),
  };
}

/** Вероятность в процентах: 0,136 → «13,6 %» */
export function pctText(p: number | null | undefined, digits = 1): string {
  if (p == null) return '—';
  return `${(p * 100).toLocaleString('ru-RU', { maximumFractionDigits: digits })} %`;
}

/** Итог проверки по времени одной фразой для пользователя */
export function validationText(run: FailureRun): string {
  const m = run.metrics;
  const share = Math.round((m.top_share ?? 0.1) * 100);
  const from = run.cutoffs.test.slice(0, 4);
  const to = String(Number(from) + run.horizon_years - 1);
  return `Модель, обученная на данных до ${run.cutoffs.train.slice(0, 4)} г., на ${from}–${to} гг. (их она не видела): `
    + `${pctText(m.top_capture, 0)} из ${m.test.events} повреждений пришлись на ${share} % участков с наибольшим `
    + `прогнозом; ROC-AUC ${m.auc?.toLocaleString('ru-RU') ?? '—'}.`;
}

// --- план перекладок (database/relay_plan.py) ---

export interface RelayPrice { dn_max_mm: number; price_per_m: number; currency: string; source?: string | null }

export interface RelayObject {
  n: number;
  fragment: string | null;
  fileid: number | null;
  lines: number;
  lineids: number[];
  length_m: number;
  cost: number;
  expected_failures: number;
  benefit: number;
  max_prob: number;
  dn_min: number | null;
  dn_max: number | null;
  /** худшее отключение при повреждении одного участка объекта */
  consumers_max: number;
  load_max: number;
  social_max: number;
}

/** Критерий плана: последствия одного повреждения */
export type RelayObjective = 'consumers' | 'load' | 'wear' | 'failures';
export const RELAY_OBJECTIVES: { value: RelayObjective; title: string }[] = [
  { value: 'consumers', title: 'Отключаемые потребители' },
  { value: 'load', title: 'Отключаемая нагрузка' },
  { value: 'wear', title: 'Оценка износа (паспорт)' },
  { value: 'failures', title: 'Только число повреждений' },
];

/** Снятый ожидаемый ущерб плана или «самых старых первыми» */
export interface RelayExpected {
  lines: number;
  expected_failures: number;
  expected_failures_share: number | null;
  expected_consumers: number;
  expected_consumers_share: number | null;
  expected_load: number;
  expected_load_share: number | null;
  expected_social: number;
  expected_social_share: number | null;
}

/** Последствия аварий участков (database/outage_consequence.py) */
export interface OutageConsequenceStatus {
  computed: boolean;
  id?: number;
  lines?: number;
  consumers?: number;
  lines_with_consumers?: number;
  lines_with_downstream?: number;
  seconds?: number;
  created_by?: string | null;
  created_at?: string;
}

export interface RelayPlan extends RelayExpected {
  run_id: number;
  horizon_years: number;
  unit: 'km' | 'money';
  budget: number;
  objective: RelayObjective;
  objective_label: string;
  job_overhead_m: number;
  currency: string | null;
  spent: number;
  length_km: number;
  benefit_share: number;
  oldest_first: RelayExpected;
  consequence_values: number;
  flow_known: number;
  /** участков, у которых посчитаны последствия отключения */
  outage_known: number;
  outage: OutageConsequenceStatus;
  runs: number;
  population: number;
  /** копий одной трубы в разных фрагментах, склеенных в план */
  copies_merged: number;
  objects: RelayObject[];
  geojson: GeoJSON.FeatureCollection;
}

export const PLAN_COLOR = '#1565C0';
export const PLAN_TOP_COLOR = '#0D47A1';

/** Участки плана на карте: первые 10 объектов — темнее и толще */
export function planFrame(plan: RelayPlan): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: plan.geojson.features.map((f) => {
      const top = (f.properties?.object ?? Infinity) <= 10;
      return { ...f, properties: { ...f.properties, color: top ? PLAN_TOP_COLOR : PLAN_COLOR, width: top ? 6 : 4 } };
    }),
  };
}

/** Строки ретроспективы: для каждого бюджета в км — доля повреждений у модели и у правил «старые», «рядом» */
export function captureRows(m: FailureMetrics): { km: string; model: number | null; oldest: number | null; near: number | null }[] {
  const c = m.capture_by_km;
  if (!c) return [];
  return Object.keys(c.model).map((km) => ({
    km, model: c.model[km] ?? null, oldest: c.oldest_first[km] ?? null, near: c.near_defects[km] ?? null,
  }));
}
