import { ref, shallowRef, watch, type Ref, type WatchSource } from 'vue';

/**
 * Общая механика журналов (было скопировано в каждый *JournalDialog.vue):
 *  - useJournalList — серверный список: страница, загрузка, ошибка, ответ позднего запроса побеждает,
 *    смена фильтров → первая страница и перезагрузка, поиск по паузе ввода;
 *  - useJournalDetails — карточка записи: открыть по id (ответ раннего запроса не перекрывает поздний),
 *    обновить открытую запись;
 *  - useLatestCall — «последний вызов побеждает» для openDialog и подобного.
 */

export interface JournalPage<T> {
  items: T[];
  total: number;
  pages: number;
}

/** Текст ошибки из ответа API ({ data: { detail } }) или исключения */
export function journalErrorText(e: unknown, fallback: string): string {
  const err = e as { data?: { detail?: unknown }; message?: unknown } | null;
  const detail = err?.data?.detail;
  if (typeof detail === 'string' && detail) return detail;
  if (typeof err?.message === 'string' && err.message) return err.message;
  return fallback;
}

/** Номер вызова: вызов «устарел», если после него начался новый. */
export function useLatestCall() {
  let seq = 0;
  return {
    next: (): number => ++seq,
    isLatest: (token: number): boolean => token === seq,
  };
}

export interface JournalListOptions<T, R extends JournalPage<T>> {
  /** Запрос страницы: page и page_size подставляет список, фильтры — вызывающий */
  fetch: (paging: { page: number; page_size: number }) => Promise<R>;
  /** Текст, если сервер не сказал причину */
  errorText: string;
  /** Журнал открыт — иначе смена фильтров и страницы ничего не грузит */
  isActive: () => boolean;
  /** Фильтры: смена → первая страница и перезагрузка */
  filters?: WatchSource[];
  pageSize?: number;
}

export function useJournalList<T, R extends JournalPage<T> = JournalPage<T>>(options: JournalListOptions<T, R>) {
  const items = ref([]) as Ref<T[]>;
  const total = ref(0);
  const pages = ref(0);
  const page = ref(1);
  const pageSize = options.pageSize ?? 50;
  const loading = ref(false);
  const error = ref('');
  /** Ответ последнего удачного запроса целиком (счётчики по состояниям и т. п.) */
  const lastResult = shallowRef<R | null>(null);
  const latest = useLatestCall();

  const load = async (): Promise<void> => {
    const token = latest.next();
    loading.value = true;
    error.value = '';
    try {
      const result = await options.fetch({ page: page.value, page_size: pageSize });
      if (!latest.isLatest(token)) return;
      items.value = result.items;
      total.value = result.total;
      pages.value = result.pages;
      lastResult.value = result;
    } catch (e) {
      if (!latest.isLatest(token)) return;
      error.value = journalErrorText(e, options.errorText);
    } finally {
      if (latest.isLatest(token)) loading.value = false;
    }
  };

  /** С первой страницы (фильтры, поиск, область журнала) */
  const reload = (): Promise<void> => {
    page.value = 1;
    return load();
  };

  /** Текст поиска после паузы ввода (SearchField) */
  const onSearch = (): void => {
    if (options.isActive()) void reload();
  };

  watch(page, () => {
    if (options.isActive()) void load();
  });
  if (options.filters?.length) {
    watch(options.filters, () => {
      if (options.isActive()) void reload();
    });
  }

  return { items, total, pages, page, pageSize, loading, error, lastResult, load, reload, onSearch };
}

export interface JournalDetailsOptions<D> {
  fetch: (id: number) => Promise<D>;
  errorText: string;
  /** Перед открытием другой записи (например, оставить черновик текущей) */
  beforeOpen?: () => void;
}

export function useJournalDetails<D extends { id: number }>(options: JournalDetailsOptions<D>) {
  const visible = ref(false);
  const loading = ref(false);
  const error = ref('');
  const selected = ref(null) as Ref<D | null>;
  const latest = useLatestCall();

  const open = async (id: number): Promise<void> => {
    options.beforeOpen?.();
    const token = latest.next();
    visible.value = true;
    loading.value = true;
    error.value = '';
    selected.value = null;
    try {
      const record = await options.fetch(id);
      if (!latest.isLatest(token)) return;
      selected.value = record;
    } catch (e) {
      if (!latest.isLatest(token)) return;
      error.value = journalErrorText(e, options.errorText);
    } finally {
      if (latest.isLatest(token)) loading.value = false;
    }
  };

  /** Перечитать открытую запись; не вышло — onError(e), прежние данные остаются */
  const refresh = async (onError?: (e: unknown) => void): Promise<void> => {
    const id = selected.value?.id;
    if (!id) return;
    try {
      const record = await options.fetch(id);
      if (selected.value?.id === id) selected.value = record;
    } catch (e) {
      onError?.(e);
    }
  };

  return { visible, loading, error, selected, open, refresh };
}
