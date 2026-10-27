import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { useUiStore } from '~/stores/uiStore';
import MapLegend from '~/components/MapLegend.vue';
import { calculationColorExpression, calculationScale } from '~/utils/calculationScale';

describe('calculationScale', () => {
  beforeEach(() => setActivePinia(createPinia()));
  it('пороги — доли максимума: давление до 5 атм, скорость до 3 м/с', () => {
    expect(calculationScale('pressure_drop').stops.map(([v]) => v)).toEqual([0, 1, 3, 5]);
    expect(calculationScale('velocity').stops.map(([v]) => v)).toEqual([0, 0.6, 1.8, 3]);
    expect(calculationScale('velocity').units).toBe('м/с');
  });

  it('выражение слоя — те же пороги и цвета, что у легенды; пустое свойство — 0', () => {
    const scale = calculationScale('pressure_drop');
    const expr = calculationColorExpression('pressure_drop');
    expect(expr.slice(0, 3)).toEqual(['interpolate', ['linear'], ['to-number', ['get', 'pressure_drop'], 0]]);
    expect(expr.slice(3)).toEqual(scale.stops.flat());
  });

  it('MapLegend: название, подписи порогов с единицами у последнего, градиент по долям', () => {
    const scale = calculationScale('velocity');
    const w = mount(MapLegend, { props: { title: scale.title, subtitle: 'Расчёт №7', stops: scale.stops, units: scale.units } });
    expect(w.attributes('aria-label')).toBe('Легенда: Скорость воды');
    expect(w.findAll('.map-legend__ticks span').map((s) => s.text())).toEqual(['0', '0,6', '1,8', '≥ 3 м/с']);
    const bar = w.find('.map-legend__bar').attributes('style') || '';
    expect(bar).toContain('20%');
    expect(bar).toContain('60%');
    expect(bar).toContain('100%');
  });

  it('MapLegend: правее открытой панели слоёв', async () => {
    const scale = calculationScale('pressure_drop');
    const w = mount(MapLegend, { props: { title: scale.title, stops: scale.stops } });
    // отступ каркаса (--shell-inset) от края карты или от правого края карточки слоёв
    expect(w.attributes('style')).toContain('--legend-left: 0px');
    useUiStore().setLeftInset(332);
    await w.vm.$nextTick();
    expect(w.attributes('style')).toContain('--legend-left: 332px');
  });
});
