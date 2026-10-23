/**
 * Помощник ИИ: сервер itwin-api routers/ai.py — /api/v1/ai/*. Веб к Claude API не обращается,
 * ключ и флаг AI_ENABLED живут только на сервере; доступность — authStore.canUseAi
 * (/auth/config ai_enabled + право calc_run). Ошибки сервера приходят как {detail: {code, message}}.
 */
import { fastApiService } from '~/services/fastApiService';

export interface AiStatus {
  enabled: boolean;
  model: string;
  reason: string | null;
  tools: string[];
}

export interface AiObjectRef {
  kind: 'node' | 'line' | 'line2' | 'consumer' | 'source' | string;
  id?: number | null;
  id1?: number | null;
  id2?: number | null;
  label: string;
}

/** Текст ошибки помощника для пользователя: {detail: {code, message}} разбирает utils/apiError.formatApiError */

export interface RootCause {
  category: string;
  title: string;
  why: string;
  action: string;
  fix: 'calc_params' | 'fixed_head' | 'temp_graph' | 'rs' | 'object' | null;
  objects: AiObjectRef[];
}

export interface ProtocolExplanation {
  summary: string;
  root_causes: RootCause[];
  regulators_note: string;
  next_run: Array<{ flag: string; reason: string }>;
  data_quality: string[];
}

/** Регулятор, не удержавший уставку (посчитано на сервере по тексту протокола) */
export interface ProtocolRegulator {
  seq: number | null;
  kind: string;
  label: string;
  objects: AiObjectRef[];
  setpoint: number;
  actual: number;
  flow: number | null;
  deficit: number;
  state: string;
  severity: string;
  count: number;
}

export interface ExplainProtocolResult {
  protocol_ids: number[];
  calculation_ids: Array<number | null>;
  regulators: ProtocolRegulator[];
  explanation: ProtocolExplanation | null;
  generated_at?: string;
  cached: boolean;
}

const post = <T>(path: string, body?: unknown) =>
  fastApiService.request<T>(path, { method: 'POST', body: body ?? {} });

export const aiService = {
  status(): Promise<AiStatus> {
    return fastApiService.request<AiStatus>('api/v1/ai/status');
  },
  /** Общий вызов инструмента ИИ (конкретные обёртки добавляют этапы 3–6) */
  call<T>(tool: string, body?: unknown): Promise<T> {
    return post<T>(`api/v1/ai/${tool}`, body);
  },
  /** Объяснение протокола расчёта: причины, что открыть, регуляторы с дефицитом (этап 3) */
  explainProtocol(body: { protocol_id?: number; calculation_id?: number; request_id?: string; refresh?: boolean }) {
    return post<ExplainProtocolResult>('api/v1/ai/calc-protocol/explain', body);
  },
};
