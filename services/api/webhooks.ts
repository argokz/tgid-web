/** Вебхуки и ключ API v2 (itwin-api routers/webhooks.py, routers/api_v2.py). Часть fastApiService. */
import type {
  ApiKeyIssued,
  DeliveryStatus,
  WebhookDelivery,
  WebhookEventType,
  WebhookInput,
  WebhookPatch,
  WebhookRow,
  WebhookTestResult,
} from '~/utils/webhooks';
import { encodePath, mutationOptions, request } from './http';

export const webhooksApi = {
  async getWebhookEventTypes(): Promise<WebhookEventType[]> {
    return request<WebhookEventType[]>('api/v1/webhooks/event-types', mutationOptions('GET'));
  },

  async getWebhooks(): Promise<WebhookRow[]> {
    return request<WebhookRow[]>('api/v1/webhooks', mutationOptions('GET'));
  },

  /** Новая подписка: секрет подписи (secret) — только в этом ответе */
  async createWebhook(body: WebhookInput): Promise<WebhookRow> {
    return request<WebhookRow>('api/v1/webhooks', mutationOptions('POST', body));
  },

  async updateWebhook(id: number, body: WebhookPatch): Promise<WebhookRow> {
    return request<WebhookRow>(`api/v1/webhooks/${encodePath(id)}`, mutationOptions('PATCH', body));
  },

  async deleteWebhook(id: number): Promise<{ id: number; name: string }> {
    return request(`api/v1/webhooks/${encodePath(id)}`, mutationOptions('DELETE'));
  },

  /** Новый секрет: старый перестаёт действовать сразу */
  async rotateWebhookSecret(id: number): Promise<WebhookRow> {
    return request<WebhookRow>(`api/v1/webhooks/${encodePath(id)}/secret`, mutationOptions('POST'));
  },

  async testWebhook(id: number): Promise<WebhookTestResult> {
    return request<WebhookTestResult>(`api/v1/webhooks/${encodePath(id)}/test`, mutationOptions('POST'));
  },

  async getWebhookDeliveries(id: number, status?: DeliveryStatus): Promise<WebhookDelivery[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return request<WebhookDelivery[]>(`api/v1/webhooks/${encodePath(id)}/deliveries${query}`, mutationOptions('GET'));
  },

  async retryWebhookDelivery(deliveryId: number): Promise<{ id: number; status: DeliveryStatus }> {
    return request(`api/v1/webhooks/deliveries/${encodePath(deliveryId)}/retry`, mutationOptions('POST'));
  },

  /** Ключ API v2: действует только на /api/v2, права — пользователя */
  async createApiKey(): Promise<ApiKeyIssued> {
    return request<ApiKeyIssued>('api/v1/api-key', mutationOptions('POST'));
  },
};
