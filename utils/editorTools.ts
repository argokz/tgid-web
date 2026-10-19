/**
 * Инструменты редактора сети и горячие клавиши (как в современных ГИС: один активный инструмент,
 * Esc — назад к «Выбору», клавиша-буква — инструмент). Чистые функции — для тестов и справки «?».
 */

import { canDo, type PermKind, type Permissions } from '~/utils/permissions';

export type EditorTool = 'select' | 'trace' | 'node' | 'vertex' | 'merge' | 'entry';

const NODE_KINDS: PermKind[] = ['node', 'consumer', 'source'];

/** Инструмент доступен по правам (матрица permissions): «Выбор» — всем, остальные — по действию */
export const toolAllowed = (tool: EditorTool, p: Pick<Permissions, 'matrix'>): boolean => {
  switch (tool) {
    case 'trace':
      return canDo(p, 'line', 'create');
    case 'entry':
      return canDo(p, 'line', 'create') && canDo(p, 'consumer', 'create');
    case 'node':
      return NODE_KINDS.some((k) => canDo(p, k, 'create'));
    case 'vertex':
      return canDo(p, 'line', 'move');
    case 'merge':
      return NODE_KINDS.some((k) => canDo(p, k, 'delete'));
    default:
      return true;
  }
};

/** Перемещать узлы (своих или все) — хоть какого-то вида */
export const canMoveNodes = (p: Pick<Permissions, 'matrix'>) => NODE_KINDS.some((k) => canDo(p, k, 'move'));

export interface EditorToolInfo {
  value: EditorTool;
  title: string;
  icon: string;
  /** клавиша (латиница; русская раскладка — та же физическая клавиша) */
  key: string;
  hint: string;
}

export const EDITOR_TOOLS: readonly EditorToolInfo[] = [
  { value: 'select', title: 'Выбор', icon: 'mdi-cursor-default-outline', key: 'V',
    hint: 'Щелчок — выделить узел или участок и открыть свойства; выделенный узел можно перетащить' },
  { value: 'trace', title: 'Трасса', icon: 'mdi-vector-polyline-plus', key: 'L',
    hint: 'Участки с изломами: узел → изломы → узел, труба (врезка) или пустое место (новый узел)' },
  { value: 'node', title: 'Узел', icon: 'mdi-circle-medium', key: 'N',
    hint: 'Щелчок по карте — новый узел выбранного типа' },
  { value: 'vertex', title: 'Изломы', icon: 'mdi-vector-polyline-edit', key: 'E',
    hint: 'Правка изломов участка: тянуть, «○» — добавить, правый щелчок — убрать' },
  { value: 'merge', title: 'Слияние', icon: 'mdi-call-merge', key: 'M',
    hint: 'Слить узел в другой: сначала целевой узел, затем сливаемый' },
  { value: 'entry', title: 'Ввод в здание', icon: 'mdi-home-import-outline', key: 'B',
    hint: 'Щелчок по зданию: врезка в ближайшую трубу, участок до стены и узел-потребитель' },
];

/** Физическая клавиша → латинская буква: работает и в русской раскладке (KeyV и «м») */
const keyLetter = (ev: Pick<KeyboardEvent, 'key' | 'code'>): string => {
  if (ev.code && /^Key[A-Z]$/.test(ev.code)) return ev.code.slice(3);
  return (ev.key || '').toUpperCase();
};

export type EditorKeyAction =
  | { type: 'tool'; tool: EditorTool }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'escape' }
  | { type: 'delete' }
  | { type: 'focus' }
  | { type: 'help' }
  | { type: 'coords' }
  | { type: 'save' };

/**
 * Клавиша вне рисования трассы → действие редактора (null — не наша).
 * Клавиши трассы (цифры, Tab, Enter, Backspace) обрабатывает сама трасса до этого.
 */
export const editorKeyAction = (
  ev: Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>,
): EditorKeyAction | null => {
  const ctrl = ev.ctrlKey || ev.metaKey;
  const letter = keyLetter(ev);
  if (ctrl && (letter === 'Y' || (letter === 'Z' && ev.shiftKey))) return { type: 'redo' };
  if (ctrl && letter === 'Z') return { type: 'undo' };
  if (ctrl && letter === 'S') return { type: 'save' };
  if (ctrl || ev.altKey) return null;
  if (ev.key === 'Escape') return { type: 'escape' };
  if (ev.key === 'Delete') return { type: 'delete' };
  if (ev.key === '?' || (ev.shiftKey && ev.code === 'Slash')) return { type: 'help' };
  if (ev.shiftKey) return null;
  if (letter === 'F') return { type: 'focus' };
  if (letter === 'G') return { type: 'coords' };
  const tool = EDITOR_TOOLS.find((t) => t.key === letter);
  return tool ? { type: 'tool', tool: tool.value } : null;
};

export interface HotkeyGroup {
  title: string;
  items: { keys: string[]; text: string }[];
}

/** Справка «?» — та же таблица, что и обработчик */
export const EDITOR_HOTKEYS: readonly HotkeyGroup[] = [
  {
    title: 'Инструменты',
    items: [
      ...EDITOR_TOOLS.map((t) => ({ keys: [t.key], text: t.title })),
      { keys: ['G'], text: 'Точка трассы по координатам' },
      { keys: ['Esc'], text: 'Назад: прервать действие → «Выбор» → снять выделение' },
    ],
  },
  {
    title: 'Выделенный объект',
    items: [
      { keys: ['Щелчок'], text: 'Выделить и открыть свойства' },
      { keys: ['Перетащить'], text: 'Переместить выделенный узел (трубы тянутся следом)' },
      { keys: ['Alt'], text: 'Перетаскивать без привязки' },
      { keys: ['Del'], text: 'Удалить выделенное' },
      { keys: ['F'], text: 'Показать выделенное на карте' },
      { keys: ['C'], text: 'Скопировать координаты курсора (строка внизу карты)' },
    ],
  },
  {
    title: 'Трасса',
    items: [
      { keys: ['Enter', 'Двойной щелчок'], text: 'Завершить в пустом месте' },
      { keys: ['Backspace'], text: 'Убрать последнюю точку' },
      { keys: ['Shift'], text: 'Строго 90°; Shift+щелчок по узлу — продолжить через него' },
      { keys: ['Alt'], text: 'Без привязки' },
      { keys: ['Цифры'], text: 'Длина участка, м' },
      { keys: ['Tab'], text: 'Угол поворота, °' },
    ],
  },
  {
    title: 'Отмена',
    items: [
      { keys: ['Ctrl+Z'], text: 'Отменить (в трассе — убрать точку)' },
      { keys: ['Ctrl+Y', 'Ctrl+Shift+Z'], text: 'Повторить' },
      { keys: ['Ctrl+S'], text: 'Сохранить изломы' },
      { keys: ['?'], text: 'Эта справка' },
    ],
  },
];

export interface EditorStatus {
  tool: EditorTool;
  selection: { kind: 'node' | 'line'; id: number } | null;
  tracing: boolean;
  vertexLineId: number | null;
  vertexDirty: boolean;
  mergeTarget: number | null;
  nodeTypeTitle: string;
  entryHint: string;
}

/** Подсказка следующего шага для строки состояния */
export const editorStatusHint = (s: EditorStatus): string => {
  switch (s.tool) {
    case 'select':
      if (!s.selection) return 'Щёлкните узел или участок — свойства. ? — горячие клавиши';
      return s.selection.kind === 'node'
        ? `Узел ${s.selection.id}: тяните, чтобы переместить · Del — удалить · Esc — снять выделение`
        : `Участок ${s.selection.id}: E — изломы · Del — удалить · Esc — снять выделение`;
    case 'trace':
      return s.tracing
        ? 'Следующая точка · узел или труба — завершить · Enter — завершить здесь · Backspace — шаг назад · Esc — сбросить'
        : 'Щёлкните узел, трубу или карту — начало трассы · Esc — к «Выбору»';
    case 'node':
      return `Щёлкните карту — новый узел «${s.nodeTypeTitle}» · Esc — к «Выбору»`;
    case 'vertex':
      if (s.vertexLineId == null) return 'Щёлкните участок · Esc — к «Выбору»';
      return `Участок ${s.vertexLineId}: тяните излом, «○» — добавить, правый щелчок — убрать`
        + (s.vertexDirty ? ' · Ctrl+S — сохранить · Esc — отказаться' : ' · Esc — закрыть');
    case 'merge':
      return s.mergeTarget == null
        ? 'Щёлкните целевой узел · Esc — к «Выбору»'
        : `Целевой узел ${s.mergeTarget}: щёлкните узел, который слить в него · Esc — выбрать другой`;
    case 'entry':
      return s.entryHint || 'Наведите на здание и щёлкните · Esc — к трассе';
    default:
      return '';
  }
};

/** Что удаляется в окне предпросмотра удаления (DeletePreviewDialog) */
export interface DeleteTarget {
  kind: 'node' | 'line';
  id: number;
  version?: string;
  expectedSectionId?: number | null;
}

/** Итог удаления: текст уведомления и операция журнала для «Отменить» */
export interface DeleteDone {
  message: string;
  operationId: number | null;
  kind: 'node' | 'line';
  id: number;
}

export type EditorContextAction =
  | 'props' | 'trace-from' | 'merge-into' | 'focus' | 'copy' | 'dissolve' | 'delete'
  | 'vertices' | 'split-here' | 'node-here' | 'divider';

/** Правый щелчок в правке сети: объект под курсором (или точка карты) и где показать меню */
export interface EditorContextTarget {
  kind: 'node' | 'line' | 'map';
  id: number | null;
  fragmentId: number | null;
  /** точка щелчка, WGS84 */
  lngLat: [number, number];
  /** координаты объекта (узел — его точка) */
  coords: [number, number][];
  clientX: number;
  clientY: number;
}
