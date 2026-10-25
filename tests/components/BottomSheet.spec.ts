import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { h } from 'vue';
import BottomSheet from '~/components/BottomSheet.vue';
import { sheetHeights } from '~/utils/sheetSnap';
import { mountWithVuetify } from './mountHelper';

const pointer = (type: string, clientY: number, timeStamp: number, target: EventTarget = window) => {
  const ev = new MouseEvent(type, { bubbles: true, clientY, button: 0 });
  Object.defineProperty(ev, 'pointerId', { value: 1 });
  Object.defineProperty(ev, 'timeStamp', { value: timeStamp });
  target.dispatchEvent(ev);
};

const mountSheet = (props: Record<string, unknown> = {}) =>
  mountWithVuetify(BottomSheet, {
    props: { modelValue: true, ...props },
    slots: { default: () => h('header', { 'data-sheet-drag': '' }, [h('span', { class: 'title' }, 'ТК-12'), h('button', { class: 'act' }, 'Закрыть')]) },
  });

describe('BottomSheet', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1; });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
  });
  afterEach(() => vi.unstubAllGlobals());

  const heights = sheetHeights(800);
  const visibleOf = (el: Element) => heights.full - parseFloat((el as HTMLElement).style.transform.replace(/[^\d.-]/g, ''));

  it('открывается на половине экрана; ручка переключает положения по кругу', async () => {
    const w = mountSheet();
    const sheet = w.find('.bottom-sheet');
    expect(visibleOf(sheet.element)).toBe(heights.half);
    expect(w.find('.bottom-sheet__handle').attributes('aria-label')).toBe('Развернуть');
    await w.find('.bottom-sheet__handle').trigger('click');
    expect(w.emitted('update:snap')?.at(-1)).toEqual(['full']);
    expect(visibleOf(sheet.element)).toBe(heights.full);
    expect(w.find('.bottom-sheet__handle').attributes('aria-label')).toBe('Свернуть');
  });

  it('тянется за шапку: вверх — весь экран, кнопки в шапке не перехватываются', async () => {
    const w = mountSheet();
    const title = w.find('.title').element;
    pointer('pointerdown', 400, 0, title);
    pointer('pointermove', 300, 200);
    pointer('pointermove', 100, 400);
    pointer('pointerup', 100, 420);
    await w.vm.$nextTick();
    expect(w.emitted('update:snap')?.at(-1)).toEqual(['full']);

    pointer('pointerdown', 400, 1000, w.find('.act').element);
    pointer('pointermove', 700, 1200);
    pointer('pointerup', 700, 1220);
    expect(w.emitted('update:snap')).toHaveLength(1);
  });

  it('смахнут вниз — dismiss, лист остаётся на месте до решения владельца', async () => {
    const w = mountSheet({ snap: 'peek' });
    const handle = w.find('.bottom-sheet__handle').element;
    pointer('pointerdown', 600, 0, handle);
    pointer('pointermove', 700, 100);
    pointer('pointerup', 790, 300);
    await w.vm.$nextTick();
    expect(w.emitted('dismiss')).toHaveLength(1);
    expect(visibleOf(w.find('.bottom-sheet').element)).toBe(heights.peek);
  });
});
