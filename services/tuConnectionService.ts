/**
 * ТУ: подбор точки подключения и оценка нагрузки (сервер database/tu_connection.py, routers/registries.py)
 * и рекомендация помощника ИИ (routers/ai.py → ai/tu_recommend.py).
 */
import { fastApiService } from '~/services/fastApiService';
import { aiService } from '~/services/aiService';

export interface ConnectionCandidate {
  node_id: number;
  name: string;
  fragment_id: number | null;
  fragment_name: string | null;
  calculation_id: number | null;
  distance_m: number;
  longitude: number | null;
  latitude: number | null;
  line_id: number | null;
  diameter_mm: number | null;
  laid_at: string | null;
  tubing: string | null;
  head_supply: number | null;
  head_return: number | null;
  available_head: number | null;
  t_supply: number | null;
  t_return: number | null;
  velocity: number | null;
  velocity_after: number | null;
  flow_t_h: number | null;
  extra_flow_t_h: number;
  dp_per_m: number | null;
  source_id: number | null;
  source_name: string | null;
  score: number;
  reasons: string[];
}

export interface ConnectionCandidates {
  point: { longitude: number; latitude: number };
  radius_m: number;
  load_gcal_h: number | null;
  items: ConnectionCandidate[];
  thresholds: { v_min: number; v_max: number; min_available_head: number };
  note: string | null;
}

export interface LoadEstimate {
  load_gcal_h: number | null;
  analogs: number;
  basis: string;
  per_1000m2?: number;
}

export interface TuRecommendation {
  request: { address: string | null; purpose: string | null; floors: number | null; area_m2: number | null; load_gcal_h: number | null };
  chosen_index: number | null;
  explanation: string;
  alternatives: Array<{ index: number; note: string }>;
  draft: {
    istochnik: string | null; kamera: string | null; prirost_nagruzki: number | null;
    otoplenie: number | null; ventilyatsiya: number | null; gvs: number | null;
  };
  risks: string[];
}

export interface TuRecommendResult {
  candidates: ConnectionCandidates;
  load_estimate: LoadEstimate;
  recommendation: TuRecommendation;
  chosen: ConnectionCandidate | null;
}

export interface TuConnectionQuery {
  lon: number;
  lat: number;
  load_gcal_h?: number;
  radius_m?: number;
  limit?: number;
}

const qs = (params: Record<string, unknown>): string => {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') out.set(k, String(v));
  const s = out.toString();
  return s ? `?${s}` : '';
};

export const tuConnectionService = {
  candidates(query: TuConnectionQuery): Promise<ConnectionCandidates> {
    return fastApiService.request<ConnectionCandidates>(`api/v1/technical-conditions/connection-candidates${qs({ ...query })}`);
  },
  loadEstimate(params: { floors?: number; area_m2?: number }): Promise<LoadEstimate> {
    return fastApiService.request<LoadEstimate>(`api/v1/technical-conditions/load-estimate${qs(params)}`);
  },
  recommend(body: TuConnectionQuery & { request_text?: string; floors?: number; area_m2?: number }): Promise<TuRecommendResult> {
    return aiService.call<TuRecommendResult>('tu/recommend', body);
  },
};
