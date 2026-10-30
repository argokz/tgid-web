import { describe, expect, it } from 'vitest';
import {
  changeText,
  createSseParser,
  editorsOf,
  mergeChanges,
  othersOnline,
  reconnectDelay,
  touches,
  type LivePresence,
  type SseMessage,
} from '~/utils/liveStream';

describe('liveStream', () => {
  it('createSseParser собирает сообщения из кусков, пропускает комментарии', () => {
    const got: SseMessage[] = [];
    const feed = createSseParser((m) => got.push(m));
    feed('event: hello\ndata: {"a"');
    feed(':1}\n\n: ping\n\nevent: presence\r\ndata: [1,\r\n');
    feed('data: 2]\r\n\r\ndata: x\n\n');
    expect(got).toEqual([
      { event: 'hello', data: '{"a":1}' },
      { event: 'presence', data: '[1,\n2]' },
      { event: 'message', data: 'x' },
    ]);
  });

  it('reconnectDelay растёт до потолка', () => {
    expect([0, 1, 2, 3, 10].map((a) => reconnectDelay(a))).toEqual([2000, 4000, 8000, 16000, 30000]);
  });

  const presence: LivePresence[] = [
    { key: 'me', username: 'ivan', since: '' },
    { key: 'a1', username: 'olga', since: '' },
    { key: 'a2', username: 'olga', since: '', editing: { kind: 'node', id: 7, label: 'карточка узла 7' } },
    { key: 'b1', username: 'petr', since: '', editing: { kind: 'line', id: 7, label: '' } },
    { key: 'me2', username: 'ivan', since: '', editing: { kind: 'node', id: 7, label: '' } },
  ];

  it('othersOnline: без своей вкладки, один пользователь — одна строка (с правкой)', () => {
    const others = othersOnline(presence, 'me');
    expect(others.map((p) => [p.username, p.key])).toEqual([['olga', 'a2'], ['petr', 'b1'], ['ivan', 'me2']]);
  });

  it('editorsOf: тот же вид и id, кроме своей вкладки', () => {
    expect(editorsOf(presence, 'node', 7, 'me2').map((p) => p.key)).toEqual(['a2']);
    expect(editorsOf(presence, 'line', 7, 'me').map((p) => p.username)).toEqual(['petr']);
    expect(editorsOf(presence, 'node', 8, null)).toEqual([]);
  });

  it('changeText и touches', () => {
    expect(changeText({ by: 'olga', label: 'узлы', count: 3, ops: ['UPDATE'] })).toBe('olga: узлы — 3');
    expect(changeText({ by: 'postgres', label: 'участки', count: 1, ops: ['DELETE'], direct: true }))
      .toBe('десктоп (postgres): удалены участки — 1');
    const c = { table: 'nodes', ids: [5, 7], count: 2 };
    expect(touches(c, 'nodes', 7)).toBe(true);
    expect(touches(c, 'linesobj', 7)).toBe(false);
  });

  it('mergeChanges: один автор и таблица — одна строка, объекты без повторов', () => {
    const base = { label: 'узлы', at: '', ops: ['UPDATE'] };
    const merged = mergeChanges([
      { ...base, table: 'nodes', by: 'postgres', direct: true, count: 1, ids: [7] },
      { ...base, table: 'nodes', by: 'postgres', direct: true, count: 2, ids: [7, 8], ops: ['DELETE'] },
      { ...base, table: 'nodes', by: 'olga', count: 1, ids: [7] },
      { ...base, table: 'linesobj', label: 'участки', by: 'olga', count: 80, ids: Array.from({ length: 50 }, (_, i) => i) },
      { ...base, table: 'linesobj', label: 'участки', by: 'olga', count: 1, ids: [999] },
    ]);
    expect(merged.map((c) => [c.by, c.table, c.count, c.ops.join()])).toEqual([
      ['postgres', 'nodes', 2, 'DELETE,UPDATE'], ['olga', 'nodes', 1, 'UPDATE'], ['olga', 'linesobj', 80, 'UPDATE'],
    ]);
  });
});
