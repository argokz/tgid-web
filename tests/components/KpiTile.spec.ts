import { describe, expect, it } from 'vitest';
import KpiTile from '~/components/KpiTile.vue';
import Sparkline from '~/components/Sparkline.vue';
import { mountWithVuetify } from './mountHelper';

/** toLocaleString('ru-RU') разделяет разряды узким неразрывным пробелом — сравниваем без него */
const plain = (s: unknown) => String(s).replace(/[\s\u202f\u00a0]/g, ' ');

describe('KpiTile', () => {
  it('форматирует число по-русски и сокращает большие значения, полное — в title', () => {
    const w = mountWithVuetify(KpiTile, { props: { label: 'Всего арматуры', value: 14869, units: 'шт.' } });
    expect(plain((w.vm as any).displayValue)).toBe('14,9 тыс.');
    expect(plain(w.find('.kpi-tile__value').attributes('title'))).toBe('14 869');
    expect(w.text()).toContain('шт.');
    const small = mountWithVuetify(KpiTile, { props: { label: 'Готовы', value: 1234, compact: false, digits: 0 } });
    expect(plain((small.vm as any).displayValue)).toBe('1 234');
    const none = mountWithVuetify(KpiTile, { props: { label: 'Нет', value: null } });
    expect((none.vm as any).displayValue).toBe('—');
  });

  it('дельта со знаком и тоном: рост хорош, если upIsGood; иначе плох', () => {
    const up = mountWithVuetify(KpiTile, { props: { label: 'Готовы', value: 10, delta: 3, deltaLabel: 'за неделю' } });
    expect(up.text()).toContain('+3');
    expect(up.text()).toContain('за неделю');
    expect((up.vm as any).deltaTone).toBe('good');
    const down = mountWithVuetify(KpiTile, { props: { label: 'Просрочено', value: 10, delta: 3, upIsGood: false } });
    expect((down.vm as any).deltaTone).toBe('bad');
    const flat = mountWithVuetify(KpiTile, { props: { label: 'x', value: 1, delta: 0 } });
    expect((flat.vm as any).deltaTone).toBe('flat');
  });

  it('selectable — кнопка-фильтр с aria-pressed и событием select', async () => {
    const w = mountWithVuetify(KpiTile, { props: { label: 'Нет линии', value: 5, selectable: true, active: true, status: 'serious' } });
    const btn = w.find('button.kpi-tile');
    expect(btn.exists()).toBe(true);
    expect(btn.attributes('aria-pressed')).toBe('true');
    expect(btn.attributes('aria-label')).toContain('Нет линии: 5');
    expect(w.find('.kpi-tile__status-icon').exists()).toBe(true);
    await btn.trigger('click');
    expect(w.emitted('select')).toHaveLength(1);
  });

  it('тренд рисует Sparkline', () => {
    const w = mountWithVuetify(KpiTile, { props: { label: 'Расход', value: 1.2, trend: [0.8, 1.0, 1.4, 1.2] } });
    expect(w.findComponent(Sparkline).exists()).toBe(true);
  });
});

describe('Sparkline', () => {
  it('строит путь по значениям, последняя точка — акцент, подпись описывает тренд', () => {
    const w = mountWithVuetify(Sparkline, { props: { values: [1, 3, 2, 4], width: 60, height: 20 } });
    expect(w.find('path.sparkline__line').attributes('d')).toMatch(/^M3(\.0)? 17(\.0)? L/);
    expect(w.find('circle.sparkline__last').exists()).toBe(true);
    expect((w.vm as any).ariaLabel).toBe('4 значений, от 1 до 4, сейчас 4: рост');
  });

  it('пропуски в ряду не рвут путь, меньше двух значений — пунктир и «нет данных»', () => {
    const w = mountWithVuetify(Sparkline, { props: { values: [1, null, 2] } });
    expect((w.vm as any).points.length).toBe(2);
    const empty = mountWithVuetify(Sparkline, { props: { values: [5] } });
    expect(empty.find('line.sparkline__empty').exists()).toBe(true);
    expect((empty.vm as any).ariaLabel).toBe('Нет данных для графика');
  });
});
