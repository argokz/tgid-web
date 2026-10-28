import { describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import { journalErrorText, useJournalDetails, useJournalList } from '~/composables/useJournalList';

const deferred = <T>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

const pageOf = (ids: number[], extra: Record<string, unknown> = {}) => ({ items: ids.map((id) => ({ id })), total: ids.length, pages: 3, ...extra });

describe('useJournalList', () => {
  it('ответ раннего запроса не перекрывает поздний', async () => {
    const first = deferred<ReturnType<typeof pageOf>>();
    const second = deferred<ReturnType<typeof pageOf>>();
    const fetch = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const list = useJournalList({ fetch, errorText: 'x', isActive: () => true });
    const a = list.load();
    const b = list.load();
    second.resolve(pageOf([2]));
    await b;
    first.resolve(pageOf([1]));
    await a;
    expect(list.items.value).toEqual([{ id: 2 }]);
    expect(list.loading.value).toBe(false);
  });

  it('смена фильтра — первая страница и перезагрузка; закрытый журнал не грузит', async () => {
    const active = ref(true);
    const state = ref<number | undefined>();
    const fetch = vi.fn().mockResolvedValue(pageOf([1], { state_counts: [{ state_id: 1, count: 1 }] }));
    const list = useJournalList({ fetch, errorText: 'x', isActive: () => active.value, filters: [state] });
    list.page.value = 3;
    await nextTick();
    expect(fetch).toHaveBeenLastCalledWith({ page: 3, page_size: 50 });
    state.value = 2;
    await nextTick();
    await nextTick();
    expect(list.page.value).toBe(1);
    expect(fetch).toHaveBeenLastCalledWith({ page: 1, page_size: 50 });
    expect((list.lastResult.value as any).state_counts).toHaveLength(1);
    active.value = false;
    const calls = fetch.mock.calls.length;
    state.value = 3;
    list.onSearch();
    await nextTick();
    expect(fetch.mock.calls.length).toBe(calls);
  });

  it('ошибка — текст сервера или запасной', async () => {
    const list = useJournalList({
      fetch: vi.fn().mockRejectedValue({ data: { detail: 'Нет доступа' } }),
      errorText: 'Не удалось загрузить',
      isActive: () => true,
    });
    await list.load();
    expect(list.error.value).toBe('Нет доступа');
    expect(journalErrorText(new Error(''), 'запасной')).toBe('запасной');
  });
});

describe('useJournalDetails', () => {
  it('поздняя карточка побеждает, beforeOpen вызывается', async () => {
    const first = deferred<{ id: number }>();
    const beforeOpen = vi.fn();
    const fetch = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce({ id: 2 });
    const d = useJournalDetails({ fetch, errorText: 'x', beforeOpen });
    const a = d.open(1);
    await d.open(2);
    first.resolve({ id: 1 });
    await a;
    expect(d.selected.value).toEqual({ id: 2 });
    expect(d.visible.value).toBe(true);
    expect(beforeOpen).toHaveBeenCalledTimes(2);
  });

  it('обновление с ошибкой оставляет прежние данные', async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ id: 5, name: 'a' }).mockRejectedValueOnce(new Error('сеть'));
    const d = useJournalDetails({ fetch, errorText: 'x' });
    await d.open(5);
    const onError = vi.fn();
    await d.refresh(onError);
    expect(d.selected.value).toEqual({ id: 5, name: 'a' });
    expect(onError).toHaveBeenCalled();
  });
});
