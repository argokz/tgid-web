/**
 * Правила, по которым Esc доходит до менеджера панелей (`stores/uiStore.ts`, docs/ui-zones.md).
 * Чистые функции — чтобы проверять их без окна и без Vuetify.
 */

/** Поле ввода или contenteditable: буквы там — текст, а не хоткеи */
export const isTypingTarget = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== 'string') return false;
  return Boolean(el.isContentEditable) || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
};

/** Поле держит Esc себе (отмена ввода): есть текст или это contenteditable / select. Пустое поле Esc отпускает */
export const holdsEscape = (target: EventTarget | null): boolean => {
  if (!isTypingTarget(target)) return false;
  const el = target as HTMLInputElement;
  return !(el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') || el.value !== '';
};

/** Открыт оверлей Vuetify (диалог, меню): Esc закрывает его сам. Тултип и всплывающее сообщение не в счёт */
export const hasBlockingOverlay = (doc: Document): boolean =>
  Boolean(doc.querySelector('.v-overlay--active:not(.v-tooltip):not(.v-snackbar)'));

/**
 * Esc дошёл до панелей: клавиша Esc (не автоповтор), поле ввода её не держит, диалогов нет.
 * Инструменты карты (измерение, редактор) стоят в реестре хоткеев выше панелей и берут Esc раньше.
 */
export const shouldHandleEscape = (event: KeyboardEvent, doc: Document = document): boolean =>
  event.key === 'Escape'
  && !event.repeat
  && !event.defaultPrevented
  && !holdsEscape(event.target)
  && !hasBlockingOverlay(doc);
