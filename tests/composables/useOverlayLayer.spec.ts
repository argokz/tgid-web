import { describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import { useOverlayLayer } from '~/composables/useOverlayLayer';

/** Мини-модель карты: источники, слои в порядке добавления, журнал вызовов */
const makeMap = () => {
  const sources = new Map<string, any>();
  const layers: any[] = [];
  const calls: string[] = [];
  return {
    sources,
    layers,
    calls,
    addSource: (id: string, spec: any) => { calls.push(`addSource:${id}`); sources.set(id, spec); },
    getSource: (id: string) => sources.get(id),
    removeSource: (id: string) => { calls.push(`removeSource:${id}`); sources.delete(id); },
    addLayer: (spec: any) => { calls.push(`addLayer:${spec.id}`); layers.push(spec); },
    getLayer: (id: string) => layers.find((l) => l.id === id),
    removeLayer: (id: string) => {
      calls.push(`removeLayer:${id}`);
      layers.splice(layers.findIndex((l) => l.id === id), 1);
    },
    setLayoutProperty: (id: string, name: string, value: any) => {
      const l = layers.find((x) => x.id === id);
      l.layout = { ...(l.layout || {}), [name]: value };
    },
    setPaintProperty: (id: string, name: string, value: any) => {
      const l = layers.find((x) => x.id === id);
      l.paint = { ...(l.paint || {}), [name]: value };
    },
  };
};

const FC = { type: 'FeatureCollection', features: [] };

describe('useOverlayLayer', () => {
  it('show добавляет источник и слои с подставленным source', () => {
    const map = makeMap();
    const ov = useOverlayLayer(() => map as any, 'src');
    expect(ov.show(FC, [{ id: 'a', type: 'line' }, { id: 'b', type: 'circle' }])).toBe(true);
    expect(map.sources.get('src')).toEqual({ type: 'geojson', data: FC });
    expect(map.layers.map((l) => [l.id, l.source])).toEqual([['a', 'src'], ['b', 'src']]);
    expect(ov.isShown()).toBe(true);
  });

  it('повторный show заменяет прежний оверлей, clear снимает слои в обратном порядке и источник', () => {
    const map = makeMap();
    const ov = useOverlayLayer(() => map as any, 'src');
    ov.show(FC, [{ id: 'a', type: 'line' }, { id: 'b', type: 'circle' }]);
    ov.show(FC, [{ id: 'a', type: 'line' }]);
    expect(map.layers.map((l) => l.id)).toEqual(['a']);
    map.calls.length = 0;
    ov.clear();
    expect(map.calls).toEqual(['removeLayer:a', 'removeSource:src']);
    expect(ov.isShown()).toBe(false);
    ov.clear(); // повторно — без ошибок
  });

  it('clear снимает заранее объявленные слои, даже если show не вызывался', () => {
    const map = makeMap();
    map.addSource('src', {});
    map.addLayer({ id: 'x', source: 'src' });
    const ov = useOverlayLayer(() => map as any, 'src', { layerIds: ['x'] });
    ov.clear();
    expect(map.layers).toHaveLength(0);
    expect(map.sources.size).toBe(0);
  });

  it('setLayout/setPaint меняют только существующие слои; без карты — no-op', () => {
    const map = makeMap();
    const ov = useOverlayLayer(() => map as any, 'src');
    ov.show(FC, [{ id: 'a', type: 'line' }]);
    ov.setLayout('a', 'visibility', 'none');
    ov.setPaint('a', 'line-color', '#fff');
    ov.setLayout('missing', 'visibility', 'none');
    expect(map.layers[0].layout).toEqual({ visibility: 'none' });
    expect(map.layers[0].paint).toEqual({ 'line-color': '#fff' });
    const none = useOverlayLayer(() => null, 'src');
    expect(none.show(FC, [])).toBe(false);
    expect(none.isShown()).toBe(false);
    none.clear();
  });

  it('при размонтировании компонента оверлей снимается', () => {
    const map = makeMap();
    let ov: ReturnType<typeof useOverlayLayer> | null = null;
    const Comp = defineComponent({
      setup() {
        ov = useOverlayLayer(() => map as any, 'src');
        return () => h('div');
      },
    });
    const wrapper = mount(Comp);
    ov!.show(FC, [{ id: 'a', type: 'line' }]);
    wrapper.unmount();
    expect(map.layers).toHaveLength(0);
    expect(map.sources.size).toBe(0);
  });
});
