import { describe, expect, it, vi } from 'vitest';
import ChartFrame from '~/components/ChartFrame.vue';
import { mountWithVuetify } from './mountHelper';

const { dispatchAction, getDataURL, seen } = vi.hoisted(() => ({
  dispatchAction: vi.fn(),
  getDataURL: vi.fn(() => 'data:image/png;base64,AAA'),
  seen: { option: null as Record<string, unknown> | null },
}));

/** Заглушка v-chart: методы экземпляра ECharts — шпионы, опции запоминаются */
vi.mock('vue-echarts', async () => {
  const { defineComponent: define, h: render } = await import('vue');
  return {
    default: define({
      name: 'VChart',
      props: { option: { type: Object, default: null }, theme: { type: Object, default: null } },
      emits: ['brush-end'],
      setup(props, { expose }) {
        expose({
          dispatchAction,
          getDataURL,
          getOption: () => ({ xAxis: [{ type: 'category', data: [0, 1, 2, 3, 4] }] }),
        });
        return () => {
          seen.option = props.option as Record<string, unknown>;
          return render('div', { class: 'vchart-stub' });
        };
      },
    }),
  };
});

const mountFrame = (props: Record<string, unknown> = {}) =>
  mountWithVuetify(ChartFrame, {
    props: { option: { series: [] }, label: 'График', summary: '34 точки', ...props },
    global: { stubs: { VTooltip: false } },
  });

describe('ChartFrame', () => {
  it('кнопки масштаба и PNG, подпись-описание, кисть добавлена к опциям', () => {
    const w = mountFrame();
    const labels = w.findAll('.chart-frame__tools button').map((b) => b.attributes('aria-label'));
    expect(labels).toEqual(['Масштаб выделением', 'Сбросить масштаб', 'Сохранить график картинкой']);
    expect(w.find('figcaption').text()).toBe('34 точки');
    expect(seen.option?.brush).toBeTruthy();

    const plain = mountFrame({ zoomable: false });
    expect(plain.findAll('.chart-frame__tools button')).toHaveLength(1);
    expect(seen.option?.brush).toBeUndefined();
  });

  it('выделение: кисть по оси X, конец выделения — зум в процентах оси категорий, режим выключается', async () => {
    dispatchAction.mockClear();
    const w = mountFrame();
    const select = w.find('button[aria-label="Масштаб выделением"]');
    await select.trigger('click');
    expect(select.attributes('aria-pressed')).toBe('true');
    expect(dispatchAction).toHaveBeenCalledWith(expect.objectContaining({ type: 'takeGlobalCursor', key: 'brush' }));

    w.findComponent({ name: 'VChart' }).vm.$emit('brush-end', { areas: [{ coordRange: [1, 3] }] });
    await w.vm.$nextTick();
    expect(dispatchAction).toHaveBeenCalledWith({ type: 'dataZoom', start: 25, end: 75 });
    expect(w.find('button[aria-label="Масштаб выделением"]').attributes('aria-pressed')).toBe('false');
  });

  it('сброс масштаба и PNG через экземпляр графика', async () => {
    dispatchAction.mockClear();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const w = mountFrame({ exportName: 'Насос: Д2000/100' });
    await w.find('button[aria-label="Сбросить масштаб"]').trigger('click');
    expect(dispatchAction).toHaveBeenCalledWith({ type: 'dataZoom', start: 0, end: 100 });
    await w.find('button[aria-label="Сохранить график картинкой"]').trigger('click');
    expect(getDataURL).toHaveBeenCalledWith(expect.objectContaining({ type: 'png', pixelRatio: 2 }));
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });
});
