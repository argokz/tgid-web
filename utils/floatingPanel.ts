/**
 * Плавающая панель поверх карты (панель редактора сети): положение, которое оператор задал
 * перетаскиванием, удерживается в пределах карты — панель не уходит за край ни при перетаскивании,
 * ни при смене размера окна или самой панели (у инструментов разный набор параметров).
 */

/** Левый верхний угол панели относительно карты, px */
export interface PanelPos {
  x: number;
  y: number;
}

export interface Size {
  w: number;
  h: number;
}

/** Отступ панели от края карты, px */
export const PANEL_MARGIN_PX = 8;

export const clampPanelPos = (pos: PanelPos, panel: Size, area: Size, margin = PANEL_MARGIN_PX): PanelPos => ({
  x: Math.round(Math.min(Math.max(margin, pos.x), Math.max(margin, area.w - panel.w - margin))),
  y: Math.round(Math.min(Math.max(margin, pos.y), Math.max(margin, area.h - panel.h - margin))),
});

/** Сохранённое положение; испорченное или чужое значение — null (панель на месте по умолчанию) */
export const parsePanelPos = (raw: string | null | undefined): PanelPos | null => {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return Number.isFinite(v?.x) && Number.isFinite(v?.y) ? { x: Number(v.x), y: Number(v.y) } : null;
  } catch {
    return null;
  }
};

/** Расстояние, с которого панель притягивается к краю или к середине области, px */
export const PANEL_SNAP_PX = 16;

/**
 * Магнит: близко к краю области — к краю (с отступом), близко к середине по горизонтали — по центру
 * (место панели редактора по умолчанию). Положение уже должно быть в пределах области (clampPanelPos).
 */
export const snapPanelPos = (pos: PanelPos, panel: Size, area: Size, margin = PANEL_MARGIN_PX, snap = PANEL_SNAP_PX): PanelPos => {
  const axis = (v: number, size: number, areaSize: number, center: boolean) => {
    const far = areaSize - size - margin;
    if (Math.abs(v - margin) <= snap) return margin;
    if (far > margin && Math.abs(v - far) <= snap) return Math.round(far);
    const mid = (areaSize - size) / 2;
    if (center && mid > margin && Math.abs(v - mid) <= snap) return Math.round(mid);
    return v;
  };
  return { x: axis(pos.x, panel.w, area.w, true), y: axis(pos.y, panel.h, area.h, false) };
};
