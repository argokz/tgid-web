import { describe, expect, it } from 'vitest';
import FloatingToolbar from '~/components/FloatingToolbar.vue';
import GlassSurface from '~/components/GlassSurface.vue';
import { mountWithVuetify } from './mountHelper';

const items = [
  { value: 'select', title: 'Выбор', icon: 'mdi-cursor-default-outline', hotkey: 'V', hint: 'Щелчок — выделить объект' },
  { value: 'trace', title: 'Трасса', icon: 'mdi-vector-polyline-plus', hotkey: 'L', hint: 'Узел → изломы → узел' },
  { value: 'merge', title: 'Слияние', icon: 'mdi-set-merge', disabled: true },
];

describe('FloatingToolbar', () => {
  it('рендерит toolbar с кнопками, активная помечена и подписана, недоступная — disabled', () => {
    const w = mountWithVuetify(FloatingToolbar, { props: { modelValue: 'trace', items, ariaLabel: 'Инструменты редактора' }, global: { stubs: { VTooltip: false } } });
    expect(w.find('[role="toolbar"]').attributes('aria-label')).toBe('Инструменты редактора');
    const buttons = w.findAll('button');
    expect(buttons).toHaveLength(3);
    expect(buttons[1].classes()).toContain('floating-toolbar__item--active');
    expect(buttons[1].attributes('aria-pressed')).toBe('true');
    expect(buttons[1].text()).toBe('Трасса');
    expect(buttons[0].text()).toBe('');
    expect(buttons[0].attributes('aria-label')).toBe('Выбор');
    expect(buttons[2].attributes('disabled')).toBeDefined();
  });

  it('клик меняет инструмент; клик по активному при mandatory ничего не делает, без mandatory — снимает', async () => {
    const w = mountWithVuetify(FloatingToolbar, { props: { modelValue: 'select', items }, global: { stubs: { VTooltip: false } } });
    const buttons = w.findAll('button');
    await buttons[1].trigger('click');
    expect(w.emitted('update:modelValue')).toEqual([['trace']]);
    await buttons[0].trigger('click');
    expect(w.emitted('update:modelValue')).toEqual([['trace']]);
    const free = mountWithVuetify(FloatingToolbar, { props: { modelValue: 'select', items, mandatory: false }, global: { stubs: { VTooltip: false } } });
    await free.findAll('button')[0].trigger('click');
    expect(free.emitted('update:modelValue')).toEqual([[null]]);
  });
});

describe('GlassSurface', () => {
  it('уровень 1 и solid — классы стекла из токенов, радиус и отступ по пропсам', () => {
    const a = mountWithVuetify(GlassSurface, { props: { level: '1', rounded: 'pill' }, slots: { default: 'x' } });
    expect(a.classes()).toContain('glass-1');
    expect(a.classes()).toContain('glass-surface--pill');
    const b = mountWithVuetify(GlassSurface, { props: { level: 'solid', padded: true, tag: 'section' } });
    expect(b.element.tagName).toBe('SECTION');
    expect(b.classes()).toContain('glass-solid');
    expect(b.classes()).toContain('glass-surface--padded');
  });
});
