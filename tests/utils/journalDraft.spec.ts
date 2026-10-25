import { describe, expect, it } from 'vitest';
import { clearDraft, DRAFT_INDEX_KEY, DRAFT_LIMIT, journalDraftKey, draftMatches, hasChanges, isDraftExpired, loadDraft, NEW_DRAFT_TTL_MS, recordSnapshot, saveDraft } from '~/utils/journalDraft';

const memStorage = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); },
    size: () => m.size,
  };
};

describe('черновики журналов', () => {
  it('ключ привязан к пользователю, журналу и записи; снимок не зависит от порядка ключей', () => {
    expect(journalDraftKey('ivanov', 'defects', 12)).toBe('journalDraft:ivanov:defects:12');
    expect(journalDraftKey('', 'defects', 'new')).toBe('journalDraft:anon:defects:new');
    const a = recordSnapshot({ name: 'x', state_id: 2, extra: 1 }, ['state_id', 'name']);
    const b = recordSnapshot({ state_id: 2, name: 'x' }, ['name', 'state_id']);
    expect(a).toBe(b);
    expect(recordSnapshot({ name: null }, ['name'])).toBe(recordSnapshot({}, ['name']));
    expect(recordSnapshot(null, ['name'])).toBe('new');
  });

  it('сохранение, загрузка, очистка; LRU не больше лимита', () => {
    const s = memStorage();
    const key = journalDraftKey('u', 'defects', 1);
    saveDraft(s, key, { fields: { name: 'a' }, snapshot: 'snap' });
    expect(loadDraft(s, key)?.fields).toEqual({ name: 'a' });
    expect(draftMatches(loadDraft(s, key)!, 'snap')).toBe(true);
    expect(draftMatches(loadDraft(s, key)!, 'other')).toBe(false);
    for (let i = 0; i < DRAFT_LIMIT + 5; i++) saveDraft(s, journalDraftKey('u', 'defects', 100 + i), { fields: {}, snapshot: 's' });
    const index = JSON.parse(s.getItem(DRAFT_INDEX_KEY)!);
    expect(index).toHaveLength(DRAFT_LIMIT);
    expect(loadDraft(s, key)).toBeNull(); // самый старый вытеснен
    clearDraft(s, index[0]);
    expect(loadDraft(s, index[0])).toBeNull();
    expect(JSON.parse(s.getItem(DRAFT_INDEX_KEY)!)).toHaveLength(DRAFT_LIMIT - 1);
    s.setItem(key, 'не json');
    expect(loadDraft(s, key)).toBeNull();
  });

  it('хранилище недоступно — saveDraft возвращает false и не трогает очередь', () => {
    const s = memStorage();
    const kept = journalDraftKey('u', 'defects', 1);
    expect(saveDraft(s, kept, { fields: {}, snapshot: 's' })).toBe(true);
    const broken = { ...s, setItem: (k: string, v: string) => { if (k !== DRAFT_INDEX_KEY) throw new Error('quota'); s.setItem(k, v); } };
    expect(saveDraft(broken, journalDraftKey('u', 'defects', 2), { fields: {}, snapshot: 's' })).toBe(false);
    expect(JSON.parse(s.getItem(DRAFT_INDEX_KEY)!)).toEqual([kept]);
    expect(loadDraft(s, kept)).not.toBeNull();
  });

  it('черновик создаваемой записи истекает, черновик существующей — нет', () => {
    const now = Date.parse('2026-10-25T12:00:00Z');
    const fresh = { fields: {}, snapshot: 'new', savedAt: new Date(now - 1000).toISOString() };
    const old = { fields: {}, snapshot: 'new', savedAt: new Date(now - NEW_DRAFT_TTL_MS - 1).toISOString() };
    expect(isDraftExpired(fresh, now)).toBe(false);
    expect(isDraftExpired(old, now)).toBe(true);
    expect(isDraftExpired({ ...old, snapshot: '[["name","a"]]' }, now)).toBe(false);
    expect(isDraftExpired({ ...fresh, savedAt: 'не дата' }, now)).toBe(true);
  });

  it('hasChanges сравнивает только записываемые ключи, пусто и null равны', () => {
    const original = { name: 'a', note: null, other: 1 };
    expect(hasChanges({ name: 'a', note: '' }, original, ['name', 'note'])).toBe(false);
    expect(hasChanges({ name: 'b', note: '' }, original, ['name', 'note'])).toBe(true);
    expect(hasChanges({ name: 'a', other: 2 }, original, ['name'])).toBe(false);
    expect(hasChanges({ name: 'a' }, null, ['name'])).toBe(true);
  });
});
