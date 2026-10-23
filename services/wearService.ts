/**
 * Износ участков и приоритет ремонта: сервер routers/wear.py (database/wear.py, формула gid6 tgid_iznos.sql),
 * записка к плану ремонтов — помощник ИИ (ai/wear_plan.py).
 */
import { fastApiService } from '~/services/fastApiService';
import { aiService } from '~/services/aiService';

export interface WearRun {
  id: number;
  daterascheta: string | null;
  name: string | null;
  lines: number;
  avg_wear: number | null;
  max_priority: number | null;
}

export interface WearSummary {
  calculation_id: number | null;
  name?: string | null;
  at?: string | null;
  lines?: number;
  avg_wear?: number | null;
  by_category?: Record<string, number>;
  category_labels?: Record<string, string>;
  factors_filled?: Record<string, number>;
  no_date?: number;
  with_defects?: number;
  with_flow?: number;
  weights?: Record<string, number>;
  factor_labels?: Record<string, string>;
}

export interface WearSection {
  lineid: number;
  fileid: number | null;
  fragment_name: string | null;
  node1: string | null;
  node2: string | null;
  diameter: number | null;
  length_m: number | null;
  tubing: string | null;
  age_years: number | null;
  age_source: string;
  srok_ball: number | null;
  n_defects: number;
  koef_povr: number | null;
  koef_povr_ball: number | null;
  vnesniivid: number;
  sostoborudovania: number;
  kategorii: number;
  vnesnkorrozia: number;
  vnunrenkorrozia: number;
  sostkonstrukz: number;
  factors_filled: number;
  wear_pct: number | null;
  wear_pct_known: number | null;
  category: number | null;
  consequence: number;
  flow_t_h: number | null;
  priority: number | null;
}

export interface WearPlan {
  calculation_id: number;
  summary: WearSummary;
  sections: WearSection[];
  notes: string[];
  plan: {
    summary: string;
    groups: Array<{ title: string; reason: string; line_ids: number[]; recommended_action: string; urgency: 1 | 2 | 3 }>;
    data_quality: string[];
    next_steps: string[];
  };
}

export type WearOrder = 'priority' | 'wear' | 'age' | 'defects';

const qs = (params: Record<string, unknown>): string => {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') out.set(k, String(v));
  const s = out.toString();
  return s ? `?${s}` : '';
};

export const wearService = {
  calculate(body: { fragment_ids?: number[]; name?: string }): Promise<{ task_id: string; status: string }> {
    return fastApiService.request('api/v1/wear/calculate', { method: 'POST', body });
  },
  taskStatus(taskId: string): Promise<{ task_id: string; status: string; result?: Record<string, unknown>; error?: string }> {
    return fastApiService.request(`api/v1/task/${encodeURIComponent(taskId)}`);
  },
  runs(): Promise<{ items: WearRun[] }> {
    return fastApiService.request('api/v1/wear/runs');
  },
  latest(): Promise<WearSummary> {
    return fastApiService.request('api/v1/wear/latest');
  },
  summary(calculationId: number): Promise<WearSummary> {
    return fastApiService.request(`api/v1/wear/${calculationId}`);
  },
  sections(calculationId: number, params: { fragment_id?: number; min_category?: number; order?: WearOrder; limit?: number; offset?: number }) {
    return fastApiService.request<{ total: number; items: WearSection[] }>(`api/v1/wear/${calculationId}/sections${qs(params)}`);
  },
  geojson(calculationId: number, params: { fragment_id?: number; min_category?: number }) {
    return fastApiService.request<GeoJSON.FeatureCollection>(`api/v1/wear/${calculationId}/geojson${qs(params)}`);
  },
  remove(calculationId: number): Promise<{ deleted: number }> {
    return fastApiService.request(`api/v1/wear/${calculationId}`, { method: 'DELETE' });
  },
  plan(body: { calculation_id?: number; fragment_id?: number; top?: number }): Promise<WearPlan> {
    return aiService.call<WearPlan>('wear/plan', body);
  },
};
