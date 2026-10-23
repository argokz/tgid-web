/**
 * Качество исходных данных: правила на сервере (database/data_quality.py, routers/data_quality.py),
 * объяснение и шаги исправления — помощник ИИ (ai/tools.py).
 */
import { fastApiService } from '~/services/fastApiService';
import { aiService } from '~/services/aiService';

export type DqSeverity = 'error' | 'warning' | 'info';

export interface DqRuleSummary {
  rule: string;
  label: string;
  severity: DqSeverity;
  kind: string;
  fix: string;
  fix_label: string;
  count: number | null;
  sum_gcal_h: number | null;
  error: string | null;
}

export interface DqSummary {
  fragment_id: number | null;
  items: DqRuleSummary[];
  total_errors: number;
  total_warnings: number;
}

export interface DqIssue {
  id: number;
  name?: string | null;
  fragment_id?: number | null;
  value?: number | null;
  longitude?: number | null;
  latitude?: number | null;
  [key: string]: unknown;
}

export interface DqIssues {
  rule: string;
  label: string;
  severity: DqSeverity;
  kind: string;
  fix: string;
  total: number;
  items: DqIssue[];
}

export interface DqAdvice {
  summary: DqSummary;
  advice: {
    summary: string;
    rules: Array<{ rule: string; cause: string; impact: string; fix_tool: string; fix_steps: string[]; priority: 1 | 2 | 3 }>;
    notes: string[];
  };
}

const qs = (params: Record<string, unknown>): string => {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') out.set(k, String(v));
  const s = out.toString();
  return s ? `?${s}` : '';
};

export const dataQualityService = {
  summary(fragmentId?: number): Promise<DqSummary> {
    return fastApiService.request(`api/v1/data-quality/summary${qs({ fragment_id: fragmentId })}`);
  },
  issues(rule: string, params: { fragment_id?: number; limit?: number; offset?: number } = {}): Promise<DqIssues> {
    return fastApiService.request(`api/v1/data-quality/issues${qs({ rule, ...params })}`);
  },
  geojson(rule: string, params: { fragment_id?: number; limit?: number } = {}): Promise<GeoJSON.FeatureCollection & { total: number }> {
    return fastApiService.request(`api/v1/data-quality/geojson${qs({ rule, ...params })}`);
  },
  explain(fragmentId?: number): Promise<DqAdvice> {
    return aiService.call<DqAdvice>('data-quality/explain', { fragment_id: fragmentId ?? null });
  },
};
