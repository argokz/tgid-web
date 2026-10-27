import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import FirstRunHints from '~/components/FirstRunHints.vue';
import { FIRST_RUN_STORAGE_KEY, FIRST_RUN_VERSION } from '~/utils/firstRunHints';
import { useUiStore } from '~/stores/uiStore';
import { useNotificationStore } from '~/stores/notificationStore';
import { mountWithVuetify } from './mountHelper';

/** Зона на экране: элемент с размером (happy-dom сам не раскладывает) */
const zone = (cls: string, rect = { left: 10, top: 10, width: 100, height: 40 }) => {
  const el = document.createElement('div');
  el.className = cls;
  el.getBoundingClientRect = () => ({ ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height, x: rect.left, y: rect.top, toJSON: () => ({}) });
  document.body.appendChild(el);
  return el;
};

const card = () => document.body.querySelector<HTMLElement>('.first-run');
/** Карточка телепортирована в body — кнопки ищем в документе */
const press = (text: string) => [...document.body.querySelectorAll<HTMLButtonElement>('.first-run button')]
  .find((b) => b.textContent?.trim() === text)!.click();
const flush = async () => { await nextTick(); await nextTick(); await nextTick(); };

describe('FirstRunHints', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.assign(window, { innerWidth: 1280, innerHeight: 720 });
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('первый вход: шаги только по зонам на экране, «Понятно» — больше не показывать', async () => {
    vi.useFakeTimers();
    zone('nav-links');
    zone('map-modes', { left: 600, top: 60, width: 176, height: 44 });
    const w = mountWithVuetify(FirstRunHints, { props: { delayMs: 10 } });
    vi.advanceTimersByTime(10);
    await flush();
    expect(card()?.textContent).toContain('1 из 2');
    expect(card()?.textContent).toContain('Разделы');
    expect(document.body.querySelector('.first-run__ring')?.getAttribute('style')).toContain('left: 6px');

    press('Далее');
    await flush();
    expect(card()?.textContent).toContain('Режимы карты');
    press('Понятно');
    await flush();
    expect(card()).toBeNull();
    expect(localStorage.getItem(FIRST_RUN_STORAGE_KEY)).toBe(FIRST_RUN_VERSION);
    w.unmount();
  });

  it('уже видели — сам не показывается; start() из меню — снова; Esc закрывает', async () => {
    vi.useFakeTimers();
    localStorage.setItem(FIRST_RUN_STORAGE_KEY, FIRST_RUN_VERSION);
    zone('nav-links');
    const w = mountWithVuetify(FirstRunHints, { props: { delayMs: 10 } });
    vi.advanceTimersByTime(50);
    await flush();
    expect(card()).toBeNull();

    await (w.vm as any).start();
    await flush();
    expect(card()?.textContent).toContain('1 из 1');
    expect(useUiStore().handleEscape()).toBe(true);
    await flush();
    expect(card()).toBeNull();
    w.unmount();
  });

  it('экран не готов (карта под экраном загрузки) — ждёт, потом показывает', async () => {
    vi.useFakeTimers();
    zone('nav-links');
    const w = mountWithVuetify(FirstRunHints, { props: { delayMs: 10, ready: false } });
    vi.advanceTimersByTime(100);
    await flush();
    expect(card()).toBeNull();
    await w.setProps({ ready: true });
    vi.advanceTimersByTime(10);
    await flush();
    expect(card()?.textContent).toContain('Разделы');
    w.unmount();
  });

  it('ни одной зоны на экране — ничего не показывает и не помечает; из меню — сообщение', async () => {
    const w = mountWithVuetify(FirstRunHints, { props: { auto: false } });
    const info = vi.spyOn(useNotificationStore(), 'showInfo');
    await (w.vm as any).start();
    await flush();
    expect(card()).toBeNull();
    expect(localStorage.getItem(FIRST_RUN_STORAGE_KEY)).toBeNull();
    expect(info).toHaveBeenCalledTimes(1);
    w.unmount();
  });

  it('автозапуск: открыт диалог — ждёт; потом показывает, фокус не перехватывает', async () => {
    vi.useFakeTimers();
    zone('nav-links');
    const overlay = document.createElement('div');
    overlay.className = 'v-overlay--active';
    document.body.appendChild(overlay);
    const w = mountWithVuetify(FirstRunHints, { props: { delayMs: 10 } });
    vi.advanceTimersByTime(50);
    await flush();
    expect(card()).toBeNull();
    overlay.remove();
    vi.advanceTimersByTime(10);
    await flush();
    expect(card()?.textContent).toContain('Разделы');
    expect(card()?.contains(document.activeElement)).toBe(false);
    w.unmount();
  });
});
