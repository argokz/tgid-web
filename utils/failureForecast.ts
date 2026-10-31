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
  population_rule?: { passport_fields: string[]; min_filled: number; lines: number; lines_all: number; damaged_kept: number | null };
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
