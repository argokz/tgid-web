/**
 * Очередь действий полевого приложения (pages/field.vue): бригада работает без связи — «Начать», «Выполнено»,
 * комментарии и фото копятся на устройстве и уходят, когда сеть вернулась. Каждое действие несёт свой ключ
 * (client_id): если ответ потерялся после записи, повтор сервер узнаёт и второй раз не применяет
 * (itwin-api database/work_orders.py, _already_done).
 *
 * Здесь — чистые правила (порядок отправки, цепочка ревизий, что делать с ошибкой); хранение — fieldStore.ts.
 */
import type { WorkOrder, WorkOrderStatus } from './workOrders';

export type FieldActionKind = 'transition' | 'comment' | 'photo';
/** pending — ждёт отправки; conflict — наряд успели изменить (409); failed — сервер отказал, повтор не поможет */
export type FieldActionState = 'pending' | 'conflict' | 'failed';

export interface FieldAction {
  /** ключ действия = client_id для сервера */
  id: string;
  orderId: number;
  orderNumber: string;
  kind: FieldActionKind;
  createdAt: string;
  lon: number | null;
  lat: number | null;
  state: FieldActionState;
  error?: string;
  // переход
  to?: WorkOrderStatus;
  revision?: number;
  result?: string;
  // комментарий; у перехода — примечание
  note?: string;
  // фото
  photo?: Blob;
  caption?: string;
  takenAt?: string;
}

/** Что делать с ошибкой отправки */
export type SendFailure = 'retry' | 'auth' | 'conflict' | 'failed';

/** Нет сети, сервер перегружен или перезапускается — повторить позже; 401 — войти заново, очередь не трогать */
export function classifySendError(status: number): SendFailure {
  if (status === 0 || status === 408 || status === 425 || status === 429 || status >= 500) return 'retry';
  if (status === 401) return 'auth';
  if (status === 409) return 'conflict';
  return 'failed';
}

export function newActionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // старые браузеры: UUID v4 из getRandomValues
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export const ACTION_LABELS: Record<FieldActionKind, string> = {
  transition: 'Смена статуса',
  comment: 'Комментарий',
  photo: 'Фото',
};

/** Подпись действия в списке «Не отправлено» */
export function describeAction(a: FieldAction, statusLabel: (s: WorkOrderStatus) => string): string {
  if (a.kind === 'transition' && a.to) return `${a.orderNumber}: ${statusLabel(a.to)}`;
  if (a.kind === 'comment') return `${a.orderNumber}: «${(a.note ?? '').slice(0, 40)}»`;
  return `${a.orderNumber}: фото${a.caption ? ` «${a.caption.slice(0, 40)}»` : ''}`;
}

/**
 * Наряд, каким его видит бригада с учётом ещё не отправленных переходов: «Начать» без связи сразу показывает
 * «В работе» и кнопку «Выполнено». Ревизия остаётся серверной — её поправит отправка (см. flushQueue).
 */
export function applyPending(order: WorkOrder, queue: FieldAction[], transitions: Record<WorkOrderStatus, WorkOrderStatus[]>): WorkOrder {
  const mine = queue.filter((a) => a.orderId === order.id && a.kind === 'transition' && a.state === 'pending' && a.to);
  if (!mine.length) return order;
  const last = mine[mine.length - 1];
  const status = last.to as WorkOrderStatus;
  return {
    ...order,
    status,
    next: transitions[status] ?? [],
    result: [...mine].reverse().find((a) => a.result)?.result ?? order.result,
  };
}

export interface FlushResult {
  sent: string[];
  /** отправка остановлена: нет сети (retry) или нужен вход (auth) */
  stopped: 'retry' | 'auth' | null;
  /** действия, получившие состояние conflict/failed, с текстом ошибки */
  marked: Array<{ id: string; state: Exclude<FieldActionState, 'pending'>; error: string }>;
  /** свежие наряды из ответов сервера */
  orders: Map<number, WorkOrder>;
}

export type SendFn = (action: FieldAction) => Promise<WorkOrder>;
export type ErrorInfo = (error: unknown) => { status: number; message: string };

/**
 * Отправить ожидающие действия по порядку создания. Без связи — остановиться (порядок важен: «Выполнено» не
 * должно уйти раньше «Начать»). Переходы одного наряда, накопленные без связи, все записаны с одной ревизией:
 * после успешного перехода следующий из той же цепочки получает ревизию из ответа. Если переход наряда упёрся
 * в конфликт — остальные переходы этого наряда не отправляются (тоже конфликт), комментарии и фото — уходят.
 */
export async function flushQueue(queue: FieldAction[], send: SendFn, info: ErrorInfo): Promise<FlushResult> {
  const out: FlushResult = { sent: [], stopped: null, marked: [], orders: new Map() };
  // orderId → ревизия, с которой копилась цепочка, и ревизия после последнего отправленного перехода
  const chain = new Map<number, { from: number; to: number }>();
  const blocked = new Set<number>();
  const pending = queue.filter((a) => a.state === 'pending').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const original of pending) {
    let action = original;
    if (action.kind === 'transition') {
      if (blocked.has(action.orderId)) {
        out.marked.push({ id: action.id, state: 'conflict', error: 'Предыдущий переход этого наряда не прошёл' });
        continue;
      }
      const c = chain.get(action.orderId);
      if (c && action.revision === c.from) action = { ...action, revision: c.to };
    }
    try {
      const order = await send(action);
      out.sent.push(action.id);
      out.orders.set(order.id, order);
      if (action.kind === 'transition' && original.revision != null) {
        chain.set(action.orderId, { from: original.revision, to: order.revision });
      }
    } catch (error) {
      const { status, message } = info(error);
      const kind = classifySendError(status);
      if (kind === 'retry' || kind === 'auth') {
        out.stopped = kind;
        break;
      }
      out.marked.push({ id: action.id, state: kind, error: message });
      if (action.kind === 'transition') blocked.add(action.orderId);
    }
  }
  return out;
}
