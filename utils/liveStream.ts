/**
 * Живая карта (itwin-api routers/live.py): разбор потока событий (Server-Sent Events) и подписи для присутствия
 * и правок других пользователей. Поток читается через fetch (EventSource не передаёт Authorization).
 */

export interface LiveEditing {
  kind: string;
  id: number;
  label: string;
}

export interface LivePresence {
  key: string;
  username: string;
  since: string;
  center?: [number, number];
  zoom?: number | null;
  editing?: LiveEditing;
}

export interface LiveChange {
  table: string;
  label: string;
  by: string;
  count: number;
  ids: number[];
  ops: string[];
  at: string;
  bbox?: [number, number, number, number] | null;
  /** правка мимо веба — десктоп или скрипт (автор — роль базы) */
  direct?: boolean;
}

export interface SseMessage {
  event: string;
  data: string;
}

/**
 * Разбор потока по кускам: куски приходят как угодно (посередине строки), сообщение — до пустой строки.
 * Комментарии («: ping») пропускаются.
 */
export function createSseParser(onMessage: (m: SseMessage) => void): (chunk: string) => void {
  let buffer = '';
  let event = 'message';
  let data: string[] = [];
  const flush = () => {
    if (data.length) onMessage({ event, data: data.join('\n') });
    event = 'message';
    data = [];
  };
  return (chunk: string) => {
    buffer += chunk;
    let nl = buffer.search(/\r?\n/);
    while (nl >= 0) {
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(buffer[nl] === '\r' ? nl + 2 : nl + 1);
      if (line === '') flush();
      else if (!line.startsWith(':')) {
        const colon = line.indexOf(':');
        const field = colon < 0 ? line : line.slice(0, colon);
        const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '');
        if (field === 'event') event = value;
        else if (field === 'data') data.push(value);
      }
      nl = buffer.search(/\r?\n/);
    }
  };
}

/** Пауза перед переподключением: 2, 4, 8 … до 30 с */
export function reconnectDelay(attempt: number, baseMs = 2000, maxMs = 30_000): number {
  return Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt));
}

/** Другие вкладки, правящие тот же объект (своя вкладка — по ключу) */
export function editorsOf(presence: LivePresence[], kind: string, id: number, selfKey: string | null): LivePresence[] {
  return presence.filter((p) => p.key !== selfKey && p.editing?.kind === kind && p.editing.id === id);
}

/** Пользователи на карте без своей вкладки; один пользователь в нескольких вкладках — одна строка */
export function othersOnline(presence: LivePresence[], selfKey: string | null): LivePresence[] {
  const byUser = new Map<string, LivePresence>();
  for (const p of presence) {
    if (p.key === selfKey) continue;
    const prev = byUser.get(p.username);
    // показать вкладку, где человек что-то правит
    if (!prev || (!prev.editing && p.editing)) byUser.set(p.username, p);
  }
  return [...byUser.values()];
}

/** «ivanov: узлы — 3», «десктоп (postgres): участки — 1» — для уведомления и списка правок */
export function changeText(c: Pick<LiveChange, 'by' | 'label' | 'count' | 'ops' | 'direct'>): string {
  const what = c.ops.length === 1 && c.ops[0] === 'DELETE' ? `удалены ${c.label}` : c.label;
  const who = c.direct ? `десктоп (${c.by})` : c.by || 'кто-то';
  return `${who}: ${what} — ${c.count}`;
}

/** Склеить правки одного автора в одной таблице (для уведомления): число объектов — по уникальным id */
export function mergeChanges(list: LiveChange[]): LiveChange[] {
  const out = new Map<string, LiveChange>();
  for (const c of list) {
    const key = `${c.direct ? 1 : 0}|${c.by}|${c.table}`;
    const prev = out.get(key);
    if (!prev) {
      out.set(key, { ...c, ids: [...c.ids], ops: [...c.ops] });
      continue;
    }
    const ids = [...new Set([...prev.ids, ...c.ids])];
    // id в событии — не больше 50: если урезаны, число — не меньше большего из счётчиков
    const truncated = prev.count > prev.ids.length || c.count > c.ids.length;
    prev.count = truncated ? Math.max(prev.count, c.count, ids.length) : ids.length;
    prev.ids = ids;
    prev.ops = [...new Set([...prev.ops, ...c.ops])].sort();
  }
  return [...out.values()];
}

/** Правка касается объекта карточки (таблица и id записи) */
export function touches(c: Pick<LiveChange, 'table' | 'ids' | 'count'>, table: string, id: number): boolean {
  return c.table === table && c.ids.includes(id);
}
