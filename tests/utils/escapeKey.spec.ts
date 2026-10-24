import { afterEach, describe, expect, it } from 'vitest';
import { focusOnMapCanvas, hasBlockingOverlay, isTypingTarget, shouldHandleEscape } from '~/utils/escapeKey';

const esc = (target: EventTarget | null, init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, ...init });
  Object.defineProperty(event, 'target', { value: target });
  return event;
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('escapeKey', () => {
  it('поля ввода с текстом и contenteditable забирают Esc себе, пустое поле — нет', () => {
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
    expect(isTypingTarget(document.createElement('input'))).toBe(false);
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

  it('фокус на холсте карты блокирует Esc для панелей только при активном инструменте карты', () => {
    document.body.innerHTML = '<button id="btn"></button><div class="maplibregl-canvas-container"><canvas id="map" tabindex="0"></canvas></div>';
    expect(focusOnMapCanvas(document)).toBe(false);
    document.getElementById('btn')!.focus();
    expect(focusOnMapCanvas(document)).toBe(false);
    expect(shouldHandleEscape(esc(document.getElementById('btn')), document, true)).toBe(true);
    const map = document.getElementById('map')!;
    map.focus();
    expect(focusOnMapCanvas(document)).toBe(true);
    expect(shouldHandleEscape(esc(map), document, true)).toBe(false);
    expect(shouldHandleEscape(esc(map), document, false)).toBe(true);
  });
});
