import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { apiCurl, deliveryResult, deliveryState, hookState, verifySnippet } from '~/utils/webhooks';

describe('webhooks', () => {
  const base = { active: true, failing_since: null, last_ok_at: null, disabled_note: null };

  it('hookState: выключена, сбои, работает, новая', () => {
    expect(hookState({ ...base, active: false }).color).toBe('grey');
    expect(hookState({ ...base, active: false, disabled_note: 'Выключена: адрес не принимает события 3 дн.' }).text)
      .toContain('3 дн.');
    expect(hookState({ ...base, failing_since: '2026-10-30T08:00:00Z', last_ok_at: '2026-10-29T08:00:00Z' }).color)
      .toBe('error');
    expect(hookState({ ...base, last_ok_at: '2026-10-30T08:00:00Z' }).text).toMatch(/^принято /);
    expect(hookState(base)).toEqual({ text: 'ещё не отправляли', color: 'info' });
  });

  it('deliveryState и deliveryResult', () => {
    expect(deliveryState({ status: 'ok', attempts: 1, next_at: '' }).text).toBe('доставлено');
    expect(deliveryState({ status: 'failed', attempts: 8, next_at: '' }).color).toBe('error');
    expect(deliveryState({ status: 'pending', attempts: 0, next_at: '' }).text).toBe('в очереди');
    expect(deliveryState({ status: 'pending', attempts: 2, next_at: '2026-10-30T09:00:00Z' }).text).toMatch(/^повтор /);
    expect(deliveryResult({ last_code: 500, last_error: 'Ответ 500' })).toBe('Ответ 500');
    expect(deliveryResult({ last_code: 200, last_error: null })).toBe('200');
    expect(deliveryResult({ last_code: null, last_error: 'Нет ответа за 10 с' })).toBe('Нет ответа за 10 с');
    expect(deliveryResult({ last_code: null, last_error: null })).toBe('—');
  });

  it('verifySnippet проверяет подпись так же, как сервер (пример Standard Webhooks)', () => {
    const secret = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw';
    const code = verifySnippet(secret);
    // сниппет — CommonJS для получателя; здесь подставляем crypto и выполняем
    const verify = new Function('require', `${code}\nreturn verify;`)(() => ({ createHmac })) as (
      h: Record<string, string>, b: string) => boolean;
    const body = '{"test": 2432232314}';
    const ts = String(Math.floor(Date.now() / 1000));
    const key = Buffer.from(secret.slice(6), 'base64');
    const sig = `v1,${createHmac('sha256', key).update(`msg_1.${ts}.${body}`).digest('base64')}`;
    const headers = { 'webhook-id': 'msg_1', 'webhook-timestamp': ts, 'webhook-signature': sig };
    expect(verify(headers, body)).toBe(true);
    expect(verify(headers, `${body} `)).toBe(false);
    expect(verify({ ...headers, 'webhook-timestamp': '1614265330' }, body)).toBe(false); // старое — отклонить
  });

  it('apiCurl', () => {
    expect(apiCurl('https://tgid.kz/api/v2/', 'k')).toBe(
      'curl -H "Authorization: Bearer k" "https://tgid.kz/api/v2/events?after=0"');
  });
});
