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
};
