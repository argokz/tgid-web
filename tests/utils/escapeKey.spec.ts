import { afterEach, describe, expect, it } from 'vitest';
import { hasBlockingOverlay, holdsEscape, isTypingTarget, shouldHandleEscape } from '~/utils/escapeKey';

const esc = (target: EventTarget | null, init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, ...init });
  Object.defineProperty(event, 'target', { value: target });
  return event;
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('escapeKey', () => {
  it('поля ввода и contenteditable — печатающие цели; Esc держит только поле с текстом', () => {
    const input = document.createElement('input');
    input.value = 'текст';
    const area = document.createElement('textarea');
    area.value = 'текст';
    const select = document.createElement('select');
    const editable = document.createElement('div');
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    const button = document.createElement('button');
    expect(isTypingTarget(input)).toBe(true);
    expect(isTypingTarget(area)).toBe(true);
    expect(isTypingTarget(select)).toBe(true);
    expect(isTypingTarget(editable)).toBe(true);
    expect(isTypingTarget(button)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
    const empty = document.createElement('input');
    expect(isTypingTarget(empty)).toBe(true);
    expect(holdsEscape(empty)).toBe(false);
    expect(holdsEscape(input)).toBe(true);
    expect(holdsEscape(editable)).toBe(true);
    expect(holdsEscape(button)).toBe(false);
  });

  it('открытый диалог или меню Vuetify блокирует Esc для панелей, тултип и уведомление — нет', () => {
    document.body.innerHTML = '<div class="v-overlay v-tooltip v-overlay--active"></div><div class="v-overlay v-snackbar v-overlay--active"></div>';
    expect(hasBlockingOverlay(document)).toBe(false);
    document.body.innerHTML += '<div class="v-overlay v-dialog v-overlay--active"></div>';
    expect(hasBlockingOverlay(document)).toBe(true);
  });

  it('shouldHandleEscape: только Esc, не обработанный, не из поля, без диалога', () => {
    const button = document.createElement('button');
    document.body.appendChild(button);
    expect(shouldHandleEscape(esc(button))).toBe(true);
    expect(shouldHandleEscape(esc(button, { key: 'Enter' }))).toBe(false);
    const prevented = esc(button);
    prevented.preventDefault();
    expect(shouldHandleEscape(prevented)).toBe(false);
    const input = document.createElement('input');
    input.value = 'x';
    expect(shouldHandleEscape(esc(input))).toBe(false);
    expect(shouldHandleEscape(esc(button, { repeat: true }))).toBe(false);
    document.body.innerHTML += '<div class="v-overlay v-menu v-overlay--active"></div>';
    expect(shouldHandleEscape(esc(button))).toBe(false);
  });

  it('Esc из пустого поля доходит до панелей', () => {
    const empty = document.createElement('input');
    document.body.appendChild(empty);
    expect(shouldHandleEscape(esc(empty))).toBe(true);
  });
});
