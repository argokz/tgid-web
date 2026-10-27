import { describe, expect, it } from 'vitest';
import { h } from 'vue';
import ChartDock from '~/components/ChartDock.vue';
import { useUiStore } from '~/stores/uiStore';
import { mountWithVuetify } from './mountHelper';

const mountDock = (props: Record<string, unknown> = {}) =>
  mountWithVuetify(ChartDock, {
    props: { modelValue: true, title: 'Пьезометрический график', subtitle: 'Длина 1,2 км', ...props },
    slots: {
      default: () => h('div', { class: 'dock-body' }, 'график'),
      actions: () => h('button', { class: 'dock-action' }, 'CSV'),
    },
    global: { stubs: { VTooltip: false, teleport: true } },
  });

describe('ChartDock', () => {
  it('шапка, действия и тело; свернуть — тело скрыто, действия убраны', async () => {
    const w = mountDock();
    expect(w.find('.chart-dock__title').text()).toBe('Пьезометрический график');
    expect(w.find('.dock-action').exists()).toBe(true);
    expect(w.find('.dock-body').isVisible()).toBe(true);
    await w.find('button[aria-label="Свернуть панель"]').trigger('click');
    expect(w.emitted('update:collapsed')?.at(-1)).toEqual([true]);
    await w.setProps({ collapsed: true });
    expect(w.find('.dock-action').exists()).toBe(false);
    expect(w.find('button[aria-label="Развернуть панель"]').attributes('aria-expanded')).toBe('false');
  });

  it('закрытие крестиком и Esc из стека панелей; справа отступ от карточки объекта', async () => {
    const w = mountDock();
    const ui = useUiStore();
    ui.setRightInset(400);
    await w.vm.$nextTick();
    // ширина карточки — в переменную, колонку контролов (--controls-w) прибавляет стиль
    expect((w.find('.chart-dock--desktop').element as HTMLElement).style.getPropertyValue('--dock-right')).toBe('400px');
    await w.find('button[aria-label="Закрыть"]').trigger('click');
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([false]);
    expect(ui.handleEscape()).toBe(true);
    expect(w.emitted('update:modelValue')).toHaveLength(2);
  });
});
