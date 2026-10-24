import { describe, expect, it } from 'vitest';
import SegmentedToggle from '~/components/SegmentedToggle.vue';
import { mountWithVuetify } from './mountHelper';

const items = [
  { value: 'line', label: 'Трубопровод', icon: 'mdi-pipe' },
  { value: 'node', label: 'Узел', icon: 'mdi-circle-medium' },
  { value: 'area', label: 'Область', disabled: true, hint: 'Недоступно без выбранного фрагмента' },
];

describe('SegmentedToggle', () => {
  it('рендерит сегменты с подписями, выбранный помечен aria-pressed', () => {
    const w = mountWithVuetify(SegmentedToggle, { props: { modelValue: 'node', items, ariaLabel: 'Что отключаем' } });
    const buttons = w.findAll('button');
    expect(buttons.map((b) => b.text())).toEqual(['Трубопровод', 'Узел', 'Область']);
    expect(buttons[1].attributes('aria-pressed')).toBe('true');
    expect(buttons[0].attributes('aria-pressed')).toBe('false');
    expect(w.find('[role="group"]').attributes('aria-label')).toBe('Что отключаем');
  });

  it('клик по сегменту меняет значение; недоступный сегмент виден с пояснением, но не активен', async () => {
    const w = mountWithVuetify(SegmentedToggle, { props: { modelValue: 'line', items } });
    const buttons = w.findAll('button');
    await buttons[1].trigger('click');
    expect(w.emitted('update:modelValue')).toEqual([['node']]);
    expect(buttons[2].attributes('disabled')).toBeDefined();
    expect(buttons[2].attributes('title')).toBe('Недоступно без выбранного фрагмента');
  });

  it('mandatory: повторный клик по выбранному не снимает выбор', async () => {
    const w = mountWithVuetify(SegmentedToggle, { props: { modelValue: 'line', items } });
    await w.findAll('button')[0].trigger('click');
    expect(w.emitted('update:modelValue')).toBeUndefined();
  });

  it('iconOnly прячет подписи, оставляя их в aria-label', () => {
    const w = mountWithVuetify(SegmentedToggle, { props: { modelValue: 'line', items, iconOnly: true } });
    const first = w.findAll('button')[0];
    expect(first.text()).toBe('');
    expect(first.attributes('aria-label')).toBe('Трубопровод');
  });
});
