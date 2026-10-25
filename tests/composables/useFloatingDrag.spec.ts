import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { useFloatingDrag } from '~/composables/useFloatingDrag';
import type { PanelPos } from '~/utils/floatingPanel';

/** Панель 200×100 в окне 1000×800; положение на экране — из pos (или 300,50 на месте по умолчанию) */
function mountPanel(opts: { enabled?: () => boolean; handle?: string; start?: PanelPos | null } = {}) {
  const pos = ref<PanelPos | null>(opts.start ?? null);
  const onCommit = vi.fn();
  let api!: ReturnType<typeof useFloatingDrag>;
  const Host = defineComponent({
    setup() {
      const el = ref<HTMLElement | null>(null);
      api = useFloatingDrag({ target: el, pos, area: 'viewport', enabled: opts.enabled, handle: opts.handle, onCommit });
      return () => h('div', { ref: el, class: 'panel' }, [
        h('div', { class: 'head', 'data-drag': '' }, [h('button', { class: 'btn' }, 'x')]),
      ]);
    },
  });
  const w = mount(Host, { attachTo: document.body });
  const el = w.find('.panel').element as HTMLElement;
  Object.defineProperty(el, 'offsetWidth', { value: 200 });
  Object.defineProperty(el, 'offsetHeight', { value: 100 });
  el.getBoundingClientRect = () => {
    const p = pos.value ?? { x: 300, y: 50 };
    return { left: p.x, top: p.y, right: p.x + 200, bottom: p.y + 100, width: 200, height: 100, x: p.x, y: p.y, toJSON: () => ({}) };
  };
  return { w, el, pos, onCommit, api: () => api };
}

const pointer = (type: string, x: number, y: number, target?: EventTarget) => {
  const e = new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true }) as unknown as PointerEvent;
  (target ?? window).dispatchEvent(e as unknown as Event);
  return e;
};

describe('useFloatingDrag', () => {
  beforeEach(() => {
    Object.assign(window, { innerWidth: 1000, innerHeight: 800 });
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number);
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('перетаскивание: transform во время движения, итог — в pos и onCommit, transform снят', async () => {
    const { w, el, pos, onCommit, api } = mountPanel();
    api().onPointerDown({ button: 0, clientX: 310, clientY: 60, target: el, preventDefault: vi.fn() } as unknown as PointerEvent);
    pointer('pointermove', 410, 260);
    expect(pos.value).toEqual({ x: 300, y: 50 }); // с места по умолчанию — в явные координаты
    expect(api().dragging.value).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(el.style.transform).toBe('translate3d(100px, 200px, 0)');
    pointer('pointerup', 410, 260);
    expect(pos.value).toEqual({ x: 400, y: 250 });
    expect(onCommit).toHaveBeenCalledWith({ x: 400, y: 250 });
    expect(el.style.transform).toBe('');
    expect(api().dragging.value).toBe(false);
    w.unmount();
  });

  it('щелчок без сдвига — не перетаскивание: место по умолчанию сохраняется', () => {
    const { w, el, pos, onCommit, api } = mountPanel();
    api().onPointerDown({ button: 0, clientX: 310, clientY: 60, target: el, preventDefault: vi.fn() } as unknown as PointerEvent);
    pointer('pointermove', 311, 61);
    pointer('pointerup', 311, 61);
    expect(pos.value).toBeNull();
    expect(onCommit).not.toHaveBeenCalled();
    w.unmount();
  });

  it('за край окна не уходит, у края — магнит; pointercancel не сохраняет', () => {
    const { w, el, pos, onCommit, api } = mountPanel({ start: { x: 300, y: 300 } });
    api().onPointerDown({ button: 0, clientX: 310, clientY: 310, target: el, preventDefault: vi.fn() } as unknown as PointerEvent);
    pointer('pointermove', -500, 320);
    pointer('pointerup', -500, 320);
    expect(pos.value).toEqual({ x: 8, y: 310 });
    api().onPointerDown({ button: 0, clientX: 20, clientY: 320, target: el, preventDefault: vi.fn() } as unknown as PointerEvent);
    pointer('pointermove', 800, 330);
    pointer('pointercancel', 800, 330);
    expect(pos.value).toEqual({ x: 8, y: 310 });
    expect(onCommit).toHaveBeenCalledTimes(1);
    w.unmount();
  });

  it('ручка: за кнопку внутри не тащит; выключено — не тащит', () => {
    const off = ref(false);
    const { w, el, pos, api } = mountPanel({ handle: '[data-drag]', enabled: () => !off.value, start: { x: 100, y: 100 } });
    const btn = el.querySelector('.btn')!;
    api().onPointerDown({ button: 0, clientX: 110, clientY: 110, target: btn, preventDefault: vi.fn() } as unknown as PointerEvent);
    pointer('pointermove', 300, 300);
    pointer('pointerup', 300, 300);
    expect(pos.value).toEqual({ x: 100, y: 100 });
    off.value = true;
    api().onPointerDown({ button: 0, clientX: 110, clientY: 110, target: el.querySelector('.head'), preventDefault: vi.fn() } as unknown as PointerEvent);
    pointer('pointermove', 300, 300);
    pointer('pointerup', 300, 300);
    expect(pos.value).toEqual({ x: 100, y: 100 });
    w.unmount();
  });

  it('стрелки: шаг 16, с Shift — 64, в пределах окна', () => {
    const { w, pos, onCommit, api } = mountPanel({ start: { x: 100, y: 100 } });
    const key = (k: string, shiftKey = false) => api().onKeydown({ key: k, shiftKey, preventDefault: vi.fn() } as unknown as KeyboardEvent);
    key('ArrowRight');
    expect(pos.value).toEqual({ x: 116, y: 100 });
    key('ArrowUp', true);
    expect(pos.value).toEqual({ x: 116, y: 36 });
    key('ArrowUp', true);
    expect(pos.value).toEqual({ x: 116, y: 8 });
    expect(onCommit).toHaveBeenCalledTimes(3);
    w.unmount();
  });

  it('окно уменьшилось — панель возвращается в видимую часть', async () => {
    const { w, pos } = mountPanel({ start: { x: 700, y: 600 } });
    Object.assign(window, { innerWidth: 600, innerHeight: 500 });
    window.dispatchEvent(new Event('resize'));
    await new Promise((r) => setTimeout(r, 0));
    expect(pos.value).toEqual({ x: 392, y: 392 });
    w.unmount();
  });
});
