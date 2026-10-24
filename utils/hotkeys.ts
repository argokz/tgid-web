import { EDITOR_HOTKEYS, type HotkeyGroup } from '~/utils/editorTools';

/**
 * Реестр горячих клавиш (docs/ui-zones.md, раздел «Клавиатура»): один диспетчер на окно,
 * обработчики регистрируются по областям и опрашиваются в порядке приоритета — первый, кто
 * вернул true, получает клавишу (`preventDefault` + `stopPropagation`). Чистая часть — здесь,
 * регистрация и слушатель окна — `composables/useHotkeys.ts`.
 *
 * Порядок областей: поповер у точки карты → действие инструмента измерений → редактор топологии →
 * карта (координаты курсора) → глобальные (палитра, справка) → стек панелей (Esc закрывает верхнюю).
 */
export type HotkeyArea = 'popover' | 'measure' | 'editor' | 'map' | 'global' | 'panels';

export const HOTKEY_AREA_ORDER: readonly HotkeyArea[] = ['popover', 'measure', 'editor', 'map', 'global', 'panels'];

export interface HotkeyEntry {
  id: string;
  area: HotkeyArea;
  /** Область сейчас активна (режим включён, меню видно); по умолчанию — да */
  enabled?: () => boolean;
  /** Опрашивать и когда фокус в поле ввода (сам обработчик решает, что делать) */
  allowInInput?: boolean;
  /** Опрашивать и при открытом диалоге/меню Vuetify */
  allowInOverlay?: boolean;
  /** true — клавиша обработана, дальше не идёт */
  handle: (ev: KeyboardEvent) => boolean;
}

export interface HotkeyContext {
  /** Фокус в поле ввода или contenteditable */
  typing: boolean;
  /** Открыт диалог или меню Vuetify */
  overlay: boolean;
}

const rank = (area: HotkeyArea) => HOTKEY_AREA_ORDER.indexOf(area);

/** Обработчики в порядке приоритета областей (внутри области — порядок регистрации) */
export const orderHotkeys = (entries: readonly HotkeyEntry[]): HotkeyEntry[] =>
  entries.map((e, i) => ({ e, i })).sort((a, b) => rank(a.e.area) - rank(b.e.area) || a.i - b.i).map(({ e }) => e);

/** Кому досталась клавиша (null — никому) */
export function dispatchHotkey(entries: readonly HotkeyEntry[], ev: KeyboardEvent, ctx: HotkeyContext): HotkeyEntry | null {
  for (const entry of orderHotkeys(entries)) {
    if (ctx.typing && !entry.allowInInput) continue;
    if (ctx.overlay && !entry.allowInOverlay) continue;
    if (entry.enabled && !entry.enabled()) continue;
    if (entry.handle(ev)) return entry;
  }
  return null;
}

/** Описания для справки «?» — те же таблицы, что и обработчики областей */
export const MEASURE_HOTKEYS: HotkeyGroup = {
  title: 'Измерения на карте',
  items: [
    { keys: ['Клик'], text: 'Точка (с привязкой к узлу сети)' },
    { keys: ['Enter', 'Двойной клик', 'ПКМ'], text: 'Завершить измерение' },
    { keys: ['Backspace'], text: 'Убрать последнюю точку' },
    { keys: ['Esc'], text: 'Отменить измерение; ещё раз — выйти из режима' },
  ],
};

export const MAP_HOTKEYS: HotkeyGroup = {
  title: 'Карта',
  items: [
    { keys: ['C'], text: 'Скопировать координаты курсора (строка внизу карты)' },
  ],
};

export const GLOBAL_HOTKEYS: HotkeyGroup = {
  title: 'Везде',
  items: [
    { keys: ['Ctrl+K'], text: 'Палитра команд: журналы, инструменты, узлы сети, адреса' },
    { keys: ['?'], text: 'Эта справка' },
    { keys: ['Esc'], text: 'Закрыть верхнюю панель: меню, «Инструменты», «Измерения», меню объекта' },
  ],
};

export interface HotkeyDocSection {
  area: HotkeyArea;
  title: string;
  groups: readonly HotkeyGroup[];
}

/** Справка «?»: разделы по областям в порядке приоритета */
export const HOTKEY_DOCS: readonly HotkeyDocSection[] = [
  { area: 'global', title: 'Общие', groups: [GLOBAL_HOTKEYS, MAP_HOTKEYS] },
  { area: 'measure', title: 'Измерения', groups: [MEASURE_HOTKEYS] },
  { area: 'editor', title: 'Редактор сети', groups: EDITOR_HOTKEYS },
];
