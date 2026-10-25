import { onBeforeUnmount, onMounted, ref, toValue, type MaybeRefOrGetter, type Ref } from 'vue';
import { appStorage } from '~/utils/appStorage';
import { clampPanelPos, parsePanelPos, snapPanelPos, type PanelPos, type Size } from '~/utils/floatingPanel';

/**
 * Перетаскивание плавающей панели — одна механика для карточки, панели редактора и измерений.
 * Pointer events (мышь, тач и перо одинаково); пока кнопка нажата, панель едет через
 * `transform: translate3d` раз в кадр (rAF) — без перерисовки компонента, в реактивное положение итог
 * пишется на отпускании. Панель держится в области (карта или окно), у краёв и середины — магнит;
 * стрелки на ручке двигают с клавиатуры; при смене размера окна панель возвращается в видимую часть.
 */

/** Сдвиг, после которого нажатие считается перетаскиванием (а не щелчком по ручке), px */
const DRAG_THRESHOLD_PX = 3;
/** Шаг стрелками, px; с Shift — крупный */
const KEY_STEP_PX = 16;
const KEY_STEP_LARGE_PX = 64;
/** Внутри ручки не тащат: кнопки и поля работают как обычно */
const INTERACTIVE = 'button, a, input, textarea, select, .v-field';

const KEY_DIRS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

export interface FloatingDragOptions {
  /** Панель, которая двигается */
  target: Ref<HTMLElement | null>;
  /** Левый верхний угол относительно области; null — место по умолчанию из CSS */
  pos: Ref<PanelPos | null>;
  /** 'parent' — панель absolute внутри карты (offsetParent), 'viewport' — fixed в окне браузера */
  area?: 'parent' | 'viewport';
  enabled?: MaybeRefOrGetter<boolean>;
  /** Тащить только за этот элемент панели (селектор); без него обработчик вешается прямо на ручку */
  handle?: string;
  /** Своё ограничение положения (карточка держит размеры окна); по умолчанию clampPanelPos */
  clamp?: (p: PanelPos, panel: Size, area: Size) => PanelPos;
  /** Возвращать в видимую часть при смене размера окна; false — владелец делает это сам */
  keepInView?: boolean;
  /** Итог перетаскивания или сдвига стрелками — сохранить */
  onCommit?: (p: PanelPos) => void;
}

interface AreaBox extends Size {
  left: number;
  top: number;
}

const samePos = (a: PanelPos | null, b: PanelPos): boolean => Boolean(a && a.x === b.x && a.y === b.y);

export function useFloatingDrag(opts: FloatingDragOptions) {
  const { target, pos, area = 'parent', handle, keepInView = true, onCommit } = opts;
  const clamp = opts.clamp ?? ((p: PanelPos, panel: Size, box: Size) => clampPanelPos(p, panel, box));
  const dragging = ref(false);
  const isEnabled = () => toValue(opts.enabled ?? true);

  const measureArea = (el: HTMLElement): AreaBox | null => {
    if (area === 'viewport') return { left: 0, top: 0, w: window.innerWidth, h: window.innerHeight };
    const parent = el.offsetParent as HTMLElement | null;
    if (!parent) return null;
    const r = parent.getBoundingClientRect();
    return { left: r.left + parent.clientLeft, top: r.top + parent.clientTop, w: parent.clientWidth, h: parent.clientHeight };
  };
  const panelSize = (el: HTMLElement): Size => ({ w: el.offsetWidth, h: el.offsetHeight });
  /** Где панель сейчас на экране (с учётом CSS-центрирования места по умолчанию) */
  const currentPos = (el: HTMLElement, box: AreaBox): PanelPos => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left - box.left), y: Math.round(r.top - box.top) };
  };

  let stopDrag: ((commit: boolean) => void) | null = null;

  const onPointerDown = (e: PointerEvent) => {
    if (!isEnabled() || stopDrag || e.button !== 0) return;
    const el = target.value;
    if (!el) return;
    if (handle) {
      const t = e.target as HTMLElement | null;
      const h = t?.closest(handle);
      if (!h || !el.contains(h) || t?.closest(INTERACTIVE)) return;
    }
    const box = measureArea(el);
    if (!box) return;
    e.preventDefault();
    const base = currentPos(el, box);
    const panel = panelSize(el);
    const start = { x: e.clientX, y: e.clientY };
    let next = base;
    let moved = false;
    let frame = 0;
    const paint = () => {
      frame = 0;
      el.style.transform = `translate3d(${next.x - base.x}px, ${next.y - base.y}px, 0)`;
    };
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      if (!moved) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
        moved = true;
        dragging.value = true;
        // с места по умолчанию (CSS-центрирование) — в явные координаты, от них и едет transform
        if (!samePos(pos.value, base)) pos.value = base;
        el.style.willChange = 'transform';
      }
      next = snapPanelPos(clamp({ x: base.x + dx, y: base.y + dy }, panel, box), panel, box);
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const up = () => stopDrag?.(true);
    const cancel = () => stopDrag?.(false);
    stopDrag = (commit: boolean) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      if (frame) cancelAnimationFrame(frame);
      stopDrag = null;
      // transform снимается в том же такте, где положение уходит в style через Vue, — без мигания
      el.style.transform = '';
      el.style.willChange = '';
      dragging.value = false;
      if (!moved || !commit) return;
      pos.value = next;
      onCommit?.(next);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  };

  /** Стрелки на ручке: сдвиг без мыши (без магнита — иначе у края шаг возвращал бы обратно) */
  const onKeydown = (e: KeyboardEvent) => {
    const dir = KEY_DIRS[e.key];
    if (!dir || !isEnabled() || stopDrag || e.altKey || e.ctrlKey || e.metaKey) return;
    const el = target.value;
    const box = el && measureArea(el);
    if (!el || !box) return;
    e.preventDefault();
    const step = e.shiftKey ? KEY_STEP_LARGE_PX : KEY_STEP_PX;
    const from = currentPos(el, box);
    const next = clamp({ x: from.x + dir[0] * step, y: from.y + dir[1] * step }, panelSize(el), box);
    if (samePos(pos.value, next)) return;
    pos.value = next;
    onCommit?.(next);
  };

  // Окно уменьшилось или панель выросла — не уходить за край. Сохранённое положение не трогается:
  // окно вернули к прежнему размеру — после перезагрузки панель встанет туда, куда её поставили.
  // Без ResizeObserver: панели перестраиваются внутри наблюдателей Vuetify («ResizeObserver loop»)
  let reclampFrame = 0;
  const reclamp = () => {
    if (reclampFrame) return;
    reclampFrame = requestAnimationFrame(() => {
      reclampFrame = 0;
      const el = target.value;
      const box = el && measureArea(el);
      if (!pos.value || stopDrag || !el || !box) return;
      const next = clamp(pos.value, panelSize(el), box);
      if (!samePos(pos.value, next)) pos.value = next;
    });
  };

  onMounted(() => {
    if (!keepInView) return;
    window.addEventListener('resize', reclamp);
    reclamp();
  });
  onBeforeUnmount(() => {
    stopDrag?.(false);
    if (reclampFrame) cancelAnimationFrame(reclampFrame);
    window.removeEventListener('resize', reclamp);
  });

  return { dragging, onPointerDown, onKeydown, reclamp };
}

/** Положение панели, запомненное между сеансами (appStorage); без хранилища живёт до перезагрузки */
export function usePersistedPanelPos(key: string) {
  const read = (): string | null => {
    try {
      return appStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const pos = ref<PanelPos | null>(parsePanelPos(read()));
  const save = (p: PanelPos | null) => {
    try {
      if (p) appStorage.setItem(key, JSON.stringify(p));
      else appStorage.removeItem(key);
    } catch {
      // удобство: приватный режим или квота — положение живёт до перезагрузки
    }
  };
  const reset = () => {
    pos.value = null;
    save(null);
  };
  return { pos, save, reset };
}
