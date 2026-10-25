import { afterEach, describe, expect, it, vi } from 'vitest';
import { h } from 'vue';
import { mount } from '@vue/test-utils';
import { createVuetify } from 'vuetify';
import HintTip from '~/components/HintTip.vue';

/** VTooltip рендерит содержимое в оверлей только при наведении — проверяем активатор и собранный текст */
const mountTip = (props: { text: string; hotkey?: string; hint?: string }) =>
  mount(HintTip, {
    props,
    slots: { default: '<template #default="{ props }"><button v-bind="props" aria-label="Построить пьезометр">П</button></template>' },
    global: { plugins: [createVuetify()] },
    attachTo: document.body,
  });

describe('HintTip', () => {
  it('рендерит активатор и собирает текст подсказки: название, хоткей, пояснение', () => {
    const w = mountTip({ text: 'Построить пьезометр', hotkey: 'P', hint: 'Выберите два узла на карте' });
    expect(w.find('button').exists()).toBe(true);
    expect(w.find('button').attributes('aria-label')).toBe('Построить пьезометр');
    expect((w.vm as any).ariaText).toBe('Построить пьезометр (P) Выберите два узла на карте');
  });

  it('без хоткея и пояснения — только название', () => {
    const w = mountTip({ text: 'Закрыть' });
    expect((w.vm as any).ariaText).toBe('Закрыть');
  });

  describe('палец: долгое нажатие', () => {
    afterEach(() => vi.useRealTimers());

    const touch = (type: string, x = 10, y = 10) => {
      const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
      Object.assign(e, { pointerType: 'touch' });
      return e;
    };

    const mountWithClick = () => {
      const onClick = vi.fn();
      const w = mount(HintTip, {
        props: { text: 'Построить пьезометр' },
        slots: { default: (p: { props: Record<string, unknown> }) => h('button', { ...p.props, onClick }, 'П') },
        global: { plugins: [createVuetify()] },
        attachTo: document.body,
      });
      return { w, onClick, btn: w.find('button').element };
    };

    it('полсекунды — подсказка открыта, отпускание не нажимает кнопку; обычное касание — нажимает', async () => {
      vi.useFakeTimers();
      const { w, onClick, btn } = mountWithClick();
      btn.dispatchEvent(touch('pointerdown'));
      vi.advanceTimersByTime(500);
      await w.vm.$nextTick();
      expect((w.vm as any).$.setupState.open).toBe(true);
      btn.dispatchEvent(touch('pointerup'));
      btn.click();
      expect(onClick).not.toHaveBeenCalled();
      vi.advanceTimersByTime(2500);
      expect((w.vm as any).$.setupState.open).toBe(false);

      btn.dispatchEvent(touch('pointerdown'));
      vi.advanceTimersByTime(100);
      btn.dispatchEvent(touch('pointerup'));
      btn.click();
      expect(onClick).toHaveBeenCalledTimes(1);
      w.unmount();
    });

    it('после долгого нажатия click не пришёл (палец ушёл с кнопки) — следующее нажатие не глотается', () => {
      vi.useFakeTimers();
      const { w, onClick, btn } = mountWithClick();
      btn.dispatchEvent(touch('pointerdown'));
      vi.advanceTimersByTime(500);
      btn.dispatchEvent(touch('pointercancel'));
      vi.advanceTimersByTime(400);
      btn.click();
      expect(onClick).toHaveBeenCalledTimes(1);

      // и мышью сразу после долгого нажатия — нажатие проходит
      btn.dispatchEvent(touch('pointerdown'));
      vi.advanceTimersByTime(500);
      btn.dispatchEvent(touch('pointerup'));
      const mouse = new MouseEvent('pointerdown', { bubbles: true });
      Object.assign(mouse, { pointerType: 'mouse' });
      btn.dispatchEvent(mouse);
      btn.click();
      expect(onClick).toHaveBeenCalledTimes(2);
      w.unmount();
    });

    it('палец сдвинулся — это прокрутка, подсказки нет', () => {
      vi.useFakeTimers();
      const { w, btn } = mountWithClick();
      btn.dispatchEvent(touch('pointerdown', 10, 10));
      btn.dispatchEvent(touch('pointermove', 10, 40));
      vi.advanceTimersByTime(600);
      expect((w.vm as any).$.setupState.open).toBe(false);
      w.unmount();
    });
  });
});
