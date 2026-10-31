/** Перспективный прирост нагрузки по реестру ТУ (itwin-api database/load_perspective.py): типы и подписи. */

export interface PerspectiveCheck {
  cutoff: string;
  years: number[];
  predicted: number[];
  actual: number[];
  predicted_total: number;
  actual_total: number;
  error_share: number | null;
}

export interface PerspectiveSource {
  label: string;
  share: number;
  cumulative: number[];
}

export interface LoadPerspective {
  today: string;
  horizon: number;
  years: number[];
  registry: { rows: number; used: number; dropped: Record<string, number>; connected: number; annulled: number; waiting: number };
  acts_complete_until: string;
  acts_by_year: Record<string, number>;
  unrecorded: number;
  unrecorded_years: number[];
  trend_rate: number;
  trend_years: [number, number];
  cumulative: number[];
  milestones: Record<string, number>;
  by_source: PerspectiveSource[];
  trend_backtest: PerspectiveCheck | null;
  upper: { cumulative: number[]; milestones: Record<string, number>; issue_rate: number };
  upper_backtest: PerspectiveCheck | null;
  largest_waiting: { id: number; name: string | null; label: string; increment: number; issued: string }[];
}

const num = (v: number, digits = 1) => v.toLocaleString('ru-RU', { maximumFractionDigits: digits });

/** «503 против 480 Гкал/ч (+4,8 %)» */
export function checkText(c: PerspectiveCheck | null): string {
  if (!c) return 'нет данных для проверки';
  const err = c.error_share == null ? '' : ` (${c.error_share >= 0 ? '+' : ''}${num(c.error_share * 100)} %)`;
  return `${c.years[0]}–${c.years[c.years.length - 1]}: прогноз ${num(c.predicted_total, 0)} против `
    + `фактических ${num(c.actual_total, 0)} Гкал/ч${err}`;
}

/** Причины, по которым записи реестра не вошли в расчёт: «нет прироста нагрузки — 1 169; …» */
export function droppedText(dropped: Record<string, number>): string {
  return Object.entries(dropped).sort((a, b) => b[1] - a[1])
    .map(([reason, n]) => `${reason} — ${n.toLocaleString('ru-RU')}`).join('; ');
}

/** Перспективный режим фрагмента (itwin-api database/perspective_scenario.py) */
export interface PerspectiveConsumer {
  node: number;
  type: 'generalized' | 'real';
  id: number;
  name: string;
  load: number;
  add: number;
  factor: number;
}

export interface PerspectiveScenarioPlan {
  fileid: number;
  horizon: number;
  years: [number, number];
  city_growth: number;
  radius_m: number;
  parts: { fragment: number; other_fragments: number; new_areas: number; no_location: number };
  fragment_growth: number;
  skipped_zero_load: number;
  fragment_load: number;
  consumers: PerspectiveConsumer[];
  consumers_count: number;
  copies_excluded: number;
}

export interface PerspectiveScenarioResult {
  scenario_id: number;
  name: string;
  fileid: number;
  consumers_changed: number;
  plan: PerspectiveScenarioPlan;
}

/** Куда ушёл прирост города: фрагмент, другие фрагменты, новые районы без сети, ТУ без здания */
export function partsText(p: PerspectiveScenarioPlan): string {
  const n = (v: number) => v.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
  return `Прирост города за ${p.horizon} лет — ${n(p.city_growth)} Гкал/ч: во фрагменте — ${n(p.parts.fragment)}, `
    + `в других фрагментах — ${n(p.parts.other_fragments)}, в новых районах без сети (дальше ${n(p.radius_m)} м `
    + `от потребителей) — ${n(p.parts.new_areas)}, ТУ без здания на карте — ${n(p.parts.no_location)}.`;
}
