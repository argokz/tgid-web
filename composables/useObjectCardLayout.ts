import { reactive, watch } from 'vue';
import { appStorage } from '~/utils/appStorage';

/**
 * Размещение окна свойств объекта: боковая панель справа (по умолчанию) или плавающее окно.
 * Карта остаётся рабочей в обоих режимах. Ширина панели и положение окна запоминаются.
 */
export type ObjectCardMode = 'panel' | 'float';

export interface ObjectCardLayout {
  mode: ObjectCardMode;
  panelWidth: number;
  float: { x: number; y: number; w: number; h: number };
}

const STORAGE_KEY = 'objectCardLayout';
export const PANEL_MIN_WIDTH = 360;
export const PANEL_MAX_WIDTH = 900;

const defaults = (): ObjectCardLayout => ({
  mode: 'panel',
  panelWidth: 460,
  float: { x: 80, y: 80, w: 560, h: 640 },
});

function load(): ObjectCardLayout {
  const base = defaults();
  try {
    const saved = JSON.parse(appStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return base;
    return {
      mode: saved.mode === 'float' ? 'float' : 'panel',
      panelWidth: Number.isFinite(saved.panelWidth) ? saved.panelWidth : base.panelWidth,
      float: { ...base.float, ...(saved.float || {}) },
    };
  } catch {
    return base;
  }
}

let state: ObjectCardLayout | null = null;

/** Состояние одно на приложение (оболочка и кнопка переключения в шапке карточки) */
export function useObjectCardLayout(): ObjectCardLayout {
  if (state) return state;
  state = reactive(typeof window === 'undefined' ? defaults() : load());
  watch(state, (v) => {
    try {
      appStorage.setItem(STORAGE_KEY, JSON.stringify(v));
    } catch {
      // localStorage недоступен — размещение до перезагрузки
    }
  }, { deep: true });
  return state;
}

/** Ширина панели в допустимых пределах (и не шире окна браузера минус 120 px под карту) */
export function clampPanelWidth(width: number, viewport: number): number {
  const max = Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, viewport - 120));
  return Math.round(Math.min(max, Math.max(PANEL_MIN_WIDTH, width)));
}

/** Плавающее окно целиком в окне браузера (после смены размеров экрана) */
export function clampFloat(
  f: { x: number; y: number; w: number; h: number }, vw: number, vh: number,
): { x: number; y: number; w: number; h: number } {
  const w = Math.min(Math.max(320, f.w), Math.max(320, vw - 16));
  const h = Math.min(Math.max(240, f.h), Math.max(240, vh - 16));
  const x = Math.min(Math.max(8, f.x), Math.max(8, vw - w - 8));
  const y = Math.min(Math.max(8, f.y), Math.max(8, vh - h - 8));
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}
