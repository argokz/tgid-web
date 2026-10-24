/**
 * Правила, по которым Esc доходит до менеджера панелей (`stores/uiStore.ts`, docs/ui-zones.md).
 * Чистые функции — чтобы проверять их без окна и без Vuetify.
 */

/** Поле ввода с текстом или contenteditable: Esc там — отмена ввода, а не закрытие панели. Пустое поле не держит Esc */
export const isTypingTarget = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== 'string') return false;
  if (el.isContentEditable || el.tagName === 'SELECT') return true;
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return (el as HTMLInputElement).value !== '';
  return false;
};

/** Открыт оверлей Vuetify (диалог, меню): Esc закрывает его сам. Тултип и всплывающее сообщение не в счёт */
export const hasBlockingOverlay = (doc: Document): boolean =>
  Boolean(doc.querySelector('.v-overlay--active:not(.v-tooltip):not(.v-snackbar)'));

/**
 * Фокус на холсте карты (MapLibre ставит canvas tabindex=0, Cesium — свой виджет): Esc принадлежит
 * инструментам карты — отмена измерения, действие редактора, — а не панелям.
 */
export const focusOnMapCanvas = (doc: Document): boolean => {
  const active = doc.activeElement;
  if (!active || active === doc.body) return false;
  return active instanceof HTMLCanvasElement || Boolean(active.closest('.maplibregl-canvas-container, .cesium-widget'));
};

/**
 * Esc дошёл до панелей: клавиша Esc (не автоповтор), не из поля ввода, диалогов нет, и либо фокус не на карте,
 * либо на карте нет активного инструмента (`mapToolActive`: измерение, режим правки топологии).
 * `defaultPrevented` — на случай, если слушатель повесят не первым.
 */
export const shouldHandleEscape = (event: KeyboardEvent, doc: Document = document, mapToolActive = false): boolean =>
  event.key === 'Escape'
  && !event.repeat
  && !event.defaultPrevented
  && !isTypingTarget(event.target)
  && !hasBlockingOverlay(doc)
  && !(mapToolActive && focusOnMapCanvas(doc));
