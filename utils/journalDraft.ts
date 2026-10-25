/**
 * Локальные черновики форм журналов (план, раздел 17): правки записи живут в `appStorage`, пока пользователь
 * не нажал «Сохранить» или «Отменить». В базу ничего не пишется. Ключ — пользователь + журнал + id записи
 * (`new` для создаваемой), очередь черновиков ограничена (LRU), при открытии сверяется снимок исходной записи:
 * если запись на сервере изменилась — черновик устарел и не предлагается.
 */

export interface JournalDraft {
  /** Поля формы на момент последнего автосохранения */
  fields: Record<string, unknown>;
  /** Снимок исходной записи (значения записываемых полей), чтобы заметить изменения на сервере */
  snapshot: string;
  savedAt: string;
}

interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export const DRAFT_INDEX_KEY = 'journalDrafts.index';
export const DRAFT_LIMIT = 20;
/** Черновик создаваемой записи не привязан к снимку — живёт ограниченно */
export const NEW_DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export const journalDraftKey = (user: string, journal: string, recordId: number | 'new'): string =>
  `journalDraft:${user || 'anon'}:${journal}:${recordId}`;

/** Снимок исходной записи по ключам формы: порядок ключей фиксирован, null и undefined равны */
export const recordSnapshot = (original: Record<string, unknown> | null | undefined, keys: readonly string[]): string => {
  if (!original) return 'new';
  const picked = [...keys].sort().map((k) => [k, original[k] ?? null]);
  return JSON.stringify(picked);
};

const readIndex = (storage: StorageLike): string[] => {
  try {
    const parsed = JSON.parse(storage.getItem(DRAFT_INDEX_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

const writeIndex = (storage: StorageLike, index: string[]) => {
  try {
    storage.setItem(DRAFT_INDEX_KEY, JSON.stringify(index));
  } catch {
    // хранилище недоступно — черновики живут до перезагрузки
  }
};

export const loadDraft = (storage: StorageLike, key: string): JournalDraft | null => {
  try {
    const parsed = JSON.parse(storage.getItem(key) || 'null');
    if (!parsed || typeof parsed !== 'object' || typeof parsed.fields !== 'object' || typeof parsed.snapshot !== 'string') return null;
    return parsed as JournalDraft;
  } catch {
    return null;
  }
};

/**
 * Сохранить черновик и поднять его в начало очереди; лишние (старше DRAFT_LIMIT) удаляются только после
 * успешной записи. false — хранилище недоступно (квота, приватный режим): вызывающий код предупреждает.
 */
export const saveDraft = (storage: StorageLike, key: string, draft: Omit<JournalDraft, 'savedAt'>): boolean => {
  try {
    storage.setItem(key, JSON.stringify({ ...draft, savedAt: new Date().toISOString() }));
  } catch {
    return false;
  }
  const index = [key, ...readIndex(storage).filter((k) => k !== key)];
  for (const stale of index.splice(DRAFT_LIMIT)) {
    try {
      storage.removeItem(stale);
    } catch {
      // уже нет
    }
  }
  writeIndex(storage, index);
  return true;
};

/** Черновик создаваемой записи старше NEW_DRAFT_TTL_MS — не предлагать */
export const isDraftExpired = (draft: JournalDraft, now: number = Date.now()): boolean => {
  if (draft.snapshot !== 'new') return false;
  const saved = Date.parse(draft.savedAt);
  return !Number.isFinite(saved) || now - saved > NEW_DRAFT_TTL_MS;
};

export const clearDraft = (storage: StorageLike, key: string): void => {
  try {
    storage.removeItem(key);
  } catch {
    // уже нет
  }
  writeIndex(storage, readIndex(storage).filter((k) => k !== key));
};

/** Черновик применим к текущей записи: снимок исходных значений совпадает */
export const draftMatches = (draft: JournalDraft, snapshot: string): boolean => draft.snapshot === snapshot;

/** Есть ли отличия формы от исходной записи по записываемым ключам */
export const hasChanges = (edited: Record<string, unknown>, original: Record<string, unknown> | null | undefined, keys: readonly string[]): boolean =>
  keys.some((k) => normalize(edited[k]) !== normalize(original?.[k]));

const normalize = (v: unknown): string => (v === null || v === undefined || v === '' ? '' : String(v));
