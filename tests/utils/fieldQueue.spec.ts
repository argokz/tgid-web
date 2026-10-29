import { describe, expect, it, vi } from 'vitest';
import {
  applyPending,
  classifySendError,
  describeAction,
  flushQueue,
  newActionId,
  type FieldAction,
} from '~/utils/fieldQueue';
import { fitWithin, routeLink } from '~/utils/fieldPhoto';
import type { WorkOrder, WorkOrderStatus } from '~/utils/workOrders';

const TRANSITIONS = {
  new: ['assigned', 'cancelled'],
  assigned: ['in_progress', 'new', 'cancelled'],
  in_progress: ['done', 'assigned', 'cancelled'],
  done: ['closed', 'in_progress'],
  closed: [],
  cancelled: ['new'],
} as Record<WorkOrderStatus, WorkOrderStatus[]>;

const order = (over: Partial<WorkOrder> = {}): WorkOrder => ({
  id: 7, number: 'Н-2026-00007', title: 'Порыв', status: 'assigned', revision: 3, result: '',
  next: TRANSITIONS.assigned, ...over,
} as WorkOrder);

let seq = 0;
const action = (over: Partial<FieldAction>): FieldAction => ({
  id: `a${++seq}`, orderId: 7, orderNumber: 'Н-2026-00007', kind: 'comment', createdAt: `2026-10-30T10:00:0${seq}Z`,
  lon: null, lat: null, state: 'pending', ...over,
});

const httpError = (status: number, message = `HTTP ${status}`) => Object.assign(new Error(message), { status });
const info = (e: unknown) => ({ status: (e as { status?: number }).status ?? 0, message: (e as Error).message });

describe('classifySendError', () => {
  it('нет сети и 5xx — повторить, 401 — войти, 409 — конфликт, прочие 4xx — отказ', () => {
    expect([0, 408, 429, 502, 503, 500].map(classifySendError)).toEqual(Array(6).fill('retry'));
    expect(classifySendError(401)).toBe('auth');
    expect(classifySendError(409)).toBe('conflict');
    expect([403, 404, 413, 415, 422].map(classifySendError)).toEqual(Array(5).fill('failed'));
  });
});

describe('newActionId', () => {
  it('UUID v4, каждый раз новый', () => {
    const a = newActionId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(newActionId()).not.toBe(a);
  });
});

describe('applyPending', () => {
  it('неотправленные переходы видны сразу: «Начать» и «Выполнено» без связи', () => {
    const q = [action({ kind: 'transition', to: 'in_progress', revision: 3 }),
      action({ kind: 'transition', to: 'done', revision: 3, result: 'Заварено' })];
    const shown = applyPending(order(), q, TRANSITIONS);
    expect(shown.status).toBe('done');
    expect(shown.result).toBe('Заварено');
    expect(shown.next).toEqual(TRANSITIONS.done);
    expect(shown.revision).toBe(3);
  });

  it('конфликтный переход и чужой наряд не меняют карточку', () => {
    const q = [action({ kind: 'transition', to: 'in_progress', state: 'conflict' }),
      action({ kind: 'transition', to: 'in_progress', orderId: 8 })];
    expect(applyPending(order(), q, TRANSITIONS).status).toBe('assigned');
  });
});

describe('flushQueue', () => {
  it('по порядку; цепочка переходов одного наряда получает ревизию из ответа', async () => {
    const start = action({ kind: 'transition', to: 'in_progress', revision: 3 });
    const photo = action({ kind: 'photo', photo: new Blob(['x']) });
    const done = action({ kind: 'transition', to: 'done', revision: 3, result: 'ok' });
    const sent: FieldAction[] = [];
    const send = vi.fn(async (a: FieldAction) => {
      sent.push(a);
      return order({ status: a.to ?? 'in_progress', revision: a.kind === 'transition' ? (a.revision as number) + 1 : 4 });
    });
    const r = await flushQueue([done, photo, start], send, info);
    expect(sent.map((a) => a.id)).toEqual([start.id, photo.id, done.id]);
    expect(sent[2].revision).toBe(4); // не 3 из очереди — иначе 409 на собственный «Начать»
    expect(r.sent).toHaveLength(3);
    expect(r.stopped).toBeNull();
    expect(r.orders.get(7)?.revision).toBe(5);
  });

  it('нет сети — остановиться, ничего не помечая; 401 — остановиться и войти', async () => {
    const q = [action({}), action({})];
    const r = await flushQueue(q, async () => { throw httpError(0, 'нет сети'); }, info);
    expect(r).toMatchObject({ sent: [], stopped: 'retry', marked: [] });
    const r2 = await flushQueue(q, async () => { throw httpError(401); }, info);
    expect(r2.stopped).toBe('auth');
  });

  it('конфликт перехода блокирует следующие переходы наряда, но не комментарии и не другие наряды', async () => {
    const start = action({ kind: 'transition', to: 'in_progress', revision: 3 });
    const comment = action({ kind: 'comment', note: 'на месте' });
    const done = action({ kind: 'transition', to: 'done', revision: 3 });
    const other = action({ kind: 'transition', to: 'in_progress', revision: 1, orderId: 8 });
    const send = vi.fn(async (a: FieldAction) => {
      if (a.id === start.id) throw httpError(409, 'Наряд уже изменили');
      return order({ id: a.orderId });
    });
    const r = await flushQueue([start, comment, done, other], send, info);
    expect(r.sent).toEqual([comment.id, other.id]);
    expect(r.marked).toEqual([
      { id: start.id, state: 'conflict', error: 'Наряд уже изменили' },
      { id: done.id, state: 'conflict', error: 'Предыдущий переход этого наряда не прошёл' },
    ]);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('отказ сервера (не фото) помечается, очередь идёт дальше; помеченные не отправляются', async () => {
    const bad = action({ kind: 'photo' });
    const ok = action({ kind: 'comment', note: 'x' });
    const old = action({ kind: 'comment', state: 'failed' });
    const send = vi.fn(async (a: FieldAction) => {
      if (a.id === bad.id) throw httpError(415, 'Это не фото');
      return order();
    });
    const r = await flushQueue([bad, ok, old], send, info);
    expect(r.marked).toEqual([{ id: bad.id, state: 'failed', error: 'Это не фото' }]);
    expect(r.sent).toEqual([ok.id]);
  });
});

describe('describeAction', () => {
  it('подписи для списка «Не отправлено»', () => {
    const label = (s: WorkOrderStatus) => ({ in_progress: 'В работе' } as Record<string, string>)[s] ?? s;
    expect(describeAction(action({ kind: 'transition', to: 'in_progress' }), label)).toBe('Н-2026-00007: В работе');
    expect(describeAction(action({ kind: 'comment', note: 'На месте' }), label)).toBe('Н-2026-00007: «На месте»');
    expect(describeAction(action({ kind: 'photo', caption: 'Шурф' }), label)).toBe('Н-2026-00007: фото «Шурф»');
  });
});

describe('fieldPhoto', () => {
  it('fitWithin уменьшает по длинной стороне и не увеличивает', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('маршрут: geo: на Android, Apple Maps на iPhone', () => {
    expect(routeLink(43.25, 76.95, 'Н-1', 'Mozilla/5.0 (Linux; Android 14)')).toBe('geo:43.25,76.95?q=43.25,76.95(%D0%9D-1)');
    expect(routeLink(43.25, 76.95, 'Н-1', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toMatch(/^https:\/\/maps\.apple\.com\/\?daddr=43\.25,76\.95/);
  });
});
