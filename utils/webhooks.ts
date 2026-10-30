/**
 * Вебхуки и ключ API v2 (itwin-api routers/webhooks.py, routers/api_v2.py): типы ответов и подписи для окна
 * «Вебхуки» и панели «Ключ API» в учётной записи.
 */

export type DeliveryStatus = 'pending' | 'ok' | 'failed';

export interface WebhookEventType {
  type: string;
  label: string;
}

export interface WebhookRow {
  id: number;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_ok_at: string | null;
  failing_since: string | null;
  disabled_note: string | null;
  deliveries: Record<DeliveryStatus, number>;
  /** Секрет подписи — только в ответе на создание и на «Новый секрет» */
  secret?: string;
}

export interface WebhookInput {
  name: string;
  url: string;
  events: string[];
}

export type WebhookPatch = Partial<WebhookInput> & { active?: boolean };

export interface WebhookDelivery {
  id: number;
  event_id: number | null;
  event_type: string;
  event_key: string | null;
  status: DeliveryStatus;
  attempts: number;
  next_at: string;
  last_code: number | null;
  last_error: string | null;
  created_at: string;
  delivered_at: string | null;
}

export interface WebhookTestResult {
  ok: boolean;
  code: number | null;
  error: string | null;
  ms: number;
  event_id: string;
}

export interface ApiKeyIssued {
  token: string;
  expires_at: string;
  days: number;
  api_url: string;
  openapi_url: string;
}

export interface StateLabel {
  text: string;
  color: string;
}

const time = (iso: string): string => new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });

/** Состояние подписки для списка: выключена, сбои, работает, ещё не отправляла */
export function hookState(hook: Pick<WebhookRow, 'active' | 'failing_since' | 'last_ok_at' | 'disabled_note'>): StateLabel {
  if (!hook.active) return { text: hook.disabled_note || 'выключена', color: 'grey' };
  if (hook.failing_since) return { text: `не принимает с ${time(hook.failing_since)}`, color: 'error' };
  if (hook.last_ok_at) return { text: `принято ${time(hook.last_ok_at)}`, color: 'success' };
  return { text: 'ещё не отправляли', color: 'info' };
}

/** Состояние доставки: доставлено, повтор в …, не доставлено */
export function deliveryState(d: Pick<WebhookDelivery, 'status' | 'attempts' | 'next_at'>): StateLabel {
  if (d.status === 'ok') return { text: 'доставлено', color: 'success' };
  if (d.status === 'failed') return { text: 'не доставлено', color: 'error' };
  return d.attempts
    ? { text: `повтор ${time(d.next_at)}`, color: 'warning' }
    : { text: 'в очереди', color: 'info' };
}

/** Ответ адреса: «200», «500 · Ответ 500», «Нет ответа за 10 с» */
export function deliveryResult(d: Pick<WebhookDelivery, 'last_code' | 'last_error'>): string {
  if (d.last_error) return d.last_code && !d.last_error.includes(String(d.last_code)) ? `${d.last_code} · ${d.last_error}` : d.last_error;
  return d.last_code ? String(d.last_code) : '—';
}

/** Проверка подписи на стороне получателя (Node.js, спецификация Standard Webhooks) */
export function verifySnippet(secret: string): string {
  return [
    "const crypto = require('crypto');",
    `const SECRET = '${secret}';`,
    '// headers — заголовки запроса, body — тело как пришло (строкой, до JSON.parse)',
    'function verify(headers, body) {',
    "  const key = Buffer.from(SECRET.replace(/^whsec_/, ''), 'base64');",
    "  const msg = `${headers['webhook-id']}.${headers['webhook-timestamp']}.${body}`;",
    "  const expected = 'v1,' + crypto.createHmac('sha256', key).update(msg).digest('base64');",
    "  const fresh = Math.abs(Date.now() / 1000 - Number(headers['webhook-timestamp'])) < 300;",
    "  return fresh && headers['webhook-signature'].split(' ').includes(expected);",
    '}',
  ].join('\n');
}

/** Пример запроса к API v2 с ключом */
export function apiCurl(apiUrl: string, token: string): string {
  return `curl -H "Authorization: Bearer ${token}" "${apiUrl.replace(/\/$/, '')}/events?after=0"`;
}
