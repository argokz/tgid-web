import { afterEach, describe, expect, it, vi } from 'vitest';
import { registeredHotkeyCount, registerHotkeys } from '~/composables/useHotkeys';

const key = (init: KeyboardEventInit, target: HTMLElement = document.body) => {
  const ev = new KeyboardEvent('keydown', { cancelable: true, bubbles: true, ...init });
  target.dispatchEvent(ev);
  return ev;
};

const disposers: (() => void)[] = [];
afterEach(() => {
  disposers.splice(0).forEach((d) => d());
  document.body.innerHTML = '';
});

describe('useHotkeys — регистрация и слушатель окна', () => {
  it('обработчик получает клавишу с окна, событие гасится; после снятия — не получает', () => {
    const handle = vi.fn((ev: KeyboardEvent) => ev.key === 'F2');
    const dispose = registerHotkeys({ id: 't', area: 'global', handle });
    disposers.push(dispose);
    expect(registeredHotkeyCount()).toBe(1);
    const taken = key({ key: 'F2' });
    expect(handle).toHaveBeenCalledTimes(1);
    expect(taken.defaultPrevented).toBe(true);
    const skipped = key({ key: 'F3' });
    expect(skipped.defaultPrevented).toBe(false);
    expect(handle).toHaveBeenCalledTimes(2);
    dispose();
    expect(registeredHotkeyCount()).toBe(0);
    key({ key: 'F2' });
    expect(handle).toHaveBeenCalledTimes(2);
  });

  it('буквы из поля ввода до обработчиков без allowInInput не доходят', () => {
    const handle = vi.fn(() => true);
    disposers.push(registerHotkeys({ id: 't', area: 'editor', handle }));
    const input = document.createElement('input');
    document.body.appendChild(input);
    key({ key: 'l', code: 'KeyL' }, input);
    expect(handle).not.toHaveBeenCalled();
    key({ key: 'l', code: 'KeyL' });
    expect(handle).toHaveBeenCalledTimes(1);
  });

  it('открытый диалог Vuetify забирает клавиши себе', () => {
    const handle = vi.fn(() => true);
    disposers.push(registerHotkeys({ id: 't', area: 'editor', handle }));
    document.body.innerHTML = '<div class="v-overlay v-dialog v-overlay--active"></div>';
    key({ key: 'Escape' });
    expect(handle).not.toHaveBeenCalled();
  });
});
