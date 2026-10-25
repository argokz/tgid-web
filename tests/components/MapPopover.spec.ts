import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { h } from 'vue';
import MapPopover, { type MapPopoverMap } from '~/components/MapPopover.vue';
import { mountWithVuetify } from './mountHelper';

/** Карта-заглушка: точка проецируется в `point`, контейнер 800×600 в (0, 50), события move/resize */
const fakeMap = () => {
  const listeners = new Map<string, Set<() => void>>();
  const container = document.createElement('div');
  container.getBoundingClientRect = () => ({ left: 0, top: 50, width: 800, height: 600, right: 800, bottom: 650, x: 0, y: 50, toJSON: () => ({}) });
  const state = { point: { x: 400, y: 300 } };
  const map: MapPopoverMap = {
    project: () => state.point,
    getContainer: () => container,
    on: (type, fn) => listeners.set(type, (listeners.get(type) ?? new Set()).add(fn)),
    off: (type, fn) => listeners.get(type)?.delete(fn),
  };
  const fire = (type: string) => listeners.get(type)?.forEach(fn => fn());
  return { map, state, fire, listeners };
};

const mountPopover = (map: MapPopoverMap) =>
  mountWithVuetify(MapPopover, {
    props: { map, lngLat: [76.9, 43.2] as [number, number], title: 'НС-6', subtitle: 'Узел 14488' },
    slots: { default: () => h('div', { class: 'fields' }, 'Код РС1'), actions: () => h('button', { class: 'open-card' }, 'Карточка') },
  });

const popover = () => document.body.querySelector<HTMLElement>('.map-popover')!;

describe('MapPopover', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1; });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('стоит над точкой, следует за ней при сдвиге карты, фокус — на первое действие', async () => {
    const { map, state, fire } = fakeMap();
    const w = mountPopover(map);
    await w.vm.$nextTick();
    const el = popover();
    expect(el.textContent).toContain('НС-6');
    expect(el.querySelector('.fields')).not.toBeNull();
    expect(document.activeElement?.classList.contains('open-card')).toBe(true);
    expect(el.classList.contains('map-popover--top')).toBe(true);
    expect(el.style.getPropertyValue('--map-popover-tip')).not.toBe('');

    const leftBefore = parseFloat(el.style.left);
    state.point = { x: 300, y: 300 };
    fire('move');
    await w.vm.$nextTick();
    expect(parseFloat(el.style.left)).toBe(leftBefore - 100);
    w.unmount();
  });

  it('у верхнего края раскрывается вниз; точка ушла за карту — прячется', async () => {
    const { map, state, fire } = fakeMap();
    const w = mountPopover(map);
    state.point = { x: 400, y: -45 }; // в тестовом DOM у поповера нет высоты: якорь у самого края окна
    fire('move');
    await w.vm.$nextTick();
    expect(popover().classList.contains('map-popover--bottom')).toBe(true);
    expect(popover().classList.contains('map-popover--hidden')).toBe(true);
    w.unmount();
  });

  it('Esc и крестик закрывают; при размонтировании слушатели карты сняты', async () => {
    const { map, listeners } = fakeMap();
    const w = mountPopover(map);
    await w.vm.$nextTick();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(w.emitted('close')).toHaveLength(1);
    (popover().querySelector('button[aria-label="Закрыть"]') as HTMLButtonElement).click();
    expect(w.emitted('close')).toHaveLength(2);
    w.unmount();
    expect(listeners.get('move')?.size ?? 0).toBe(0);
    expect(listeners.get('resize')?.size ?? 0).toBe(0);
  });
});
