/**
 * Палитра команд Ctrl+K (docs/ui-zones.md): чистая часть — ранжирование по запросу и список недавних.
 * Компонент — `components/CommandPalette.vue`.
 */

export type CommandKind = 'action' | 'tool' | 'node' | 'address';

export interface CommandItem {
  /** Устойчивый ключ: для недавних и `aria-activedescendant` */
  id: string;
  kind: CommandKind;
  title: string;
  subtitle?: string;
  icon: string;
  /** Дополнительные слова для поиска (группа, событие) */
  keywords?: string;
  /** Выполнить; палитра закрывается после, если не keepOpen */
  run: () => void | Promise<void>;
  /** Команда наполняет палитру (поиск адреса) — не закрывать */
  keepOpen?: boolean;
}

export const KIND_TITLES: Record<CommandKind, string> = {
  action: 'Действия',
  tool: 'Журналы и инструменты',
  node: 'Узлы сети',
  address: 'Адреса',
};

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').trim();

/** Вес совпадения: начало названия > слово в названии > подстрока названия > подстрока описания; 0 — нет */
export const matchScore = (query: string, item: Pick<CommandItem, 'title' | 'subtitle' | 'keywords'>): number => {
  const q = norm(query);
  if (!q) return 1;
  const title = norm(item.title);
  if (title.startsWith(q)) return 100;
  if (title.split(/[\s,.()—-]+/).some((w) => w.startsWith(q))) return 80;
  if (title.includes(q)) return 60;
  const rest = norm(`${item.subtitle ?? ''} ${item.keywords ?? ''}`);
  if (rest.includes(q)) return 30;
  return 0;
};

/** Подходящие команды по убыванию веса (устойчиво — порядок исходного списка при равном весе) */
export const rankCommands = <T extends Pick<CommandItem, 'title' | 'subtitle' | 'keywords'>>(query: string, items: readonly T[]): T[] =>
  items
    .map((item, i) => ({ item, i, score: matchScore(query, item) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((x) => x.item);

export const RECENT_KEY = 'commandPalette.recent';
export const RECENT_LIMIT = 8;

/** Недавняя команда: достаточно, чтобы выполнить снова без данных (узел и адрес — по координатам) */
export interface RecentEntry {
  id: string;
  kind: CommandKind;
  title: string;
  subtitle?: string;
  center?: [number, number];
}

interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

const isEntry = (x: unknown): x is RecentEntry =>
  typeof x === 'object' && x !== null && typeof (x as RecentEntry).id === 'string' && typeof (x as RecentEntry).title === 'string';

/** Недавние команды, самая свежая первая */
export const readRecent = (storage: StorageLike): RecentEntry[] => {
  try {
    const parsed = JSON.parse(storage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(isEntry).slice(0, RECENT_LIMIT) : [];
  } catch {
    return [];
  }
};

/** Поднять команду наверх (LRU на RECENT_LIMIT) */
export const pushRecent = (storage: StorageLike, entry: RecentEntry): RecentEntry[] => {
  const next = [entry, ...readRecent(storage).filter((x) => x.id !== entry.id)].slice(0, RECENT_LIMIT);
  try {
    storage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // localStorage недоступен — недавние живут до перезагрузки
  }
  return next;
};
