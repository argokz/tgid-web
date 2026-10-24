import { describe, expect, it } from 'vitest';
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
});
