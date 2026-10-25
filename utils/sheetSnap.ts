/**
 * Положения нижнего листа (BottomSheet, docs/ui-primitives.md): низкое — шапка и пара строк, половина экрана,
 * почти весь экран. Чистые функции: высоты по высоте окна и выбор положения после перетаскивания.
 */
export type SheetSnap = 'peek' | 'half' | 'full';

export const SHEET_SNAPS: readonly SheetSnap[] = ['peek', 'half', 'full'];

/** Зазор над полностью раскрытым листом: видно, что под ним карта */
export const SHEET_TOP_GAP = 16;
/** Низкое положение — не ниже, чем шапка с действиями */
export const SHEET_PEEK_MIN = 160;
/** Скорость «броска» вверх/вниз, px/мс: переводит на соседнее положение, а не к ближайшему */
export const SHEET_FLICK_VELOCITY = 0.5;
/** Отпущен ниже этой доли низкого положения — лист закрывается */
export const SHEET_DISMISS_RATIO = 0.6;

export type SheetHeights = Record<SheetSnap, number>;

export const sheetHeights = (viewportHeight: number): SheetHeights => {
  const full = Math.max(SHEET_PEEK_MIN, viewportHeight - SHEET_TOP_GAP);
  const peek = Math.min(full, Math.max(SHEET_PEEK_MIN, Math.round(viewportHeight * 0.28)));
  const half = Math.min(full, Math.max(peek, Math.round(viewportHeight * 0.55)));
  return { peek, half, full };
};

/**
 * Куда встать после перетаскивания: `visible` — видимая высота листа, `velocity` — скорость в px/мс
 * (плюс — вверх). Быстрый бросок — на соседнее положение по направлению, медленно — к ближайшему;
 * ниже низкого положения — закрыть.
 */
export const settleSheet = (visible: number, velocity: number, heights: SheetHeights): SheetSnap | 'dismiss' => {
  if (velocity > SHEET_FLICK_VELOCITY) {
    return SHEET_SNAPS.find(snap => heights[snap] > visible + 1) ?? 'full';
  }
  if (velocity < -SHEET_FLICK_VELOCITY) {
    return [...SHEET_SNAPS].reverse().find(snap => heights[snap] < visible - 1) ?? 'dismiss';
  }
  if (visible < heights.peek * SHEET_DISMISS_RATIO) return 'dismiss';
  return SHEET_SNAPS.reduce((best, snap) =>
    Math.abs(heights[snap] - visible) < Math.abs(heights[best] - visible) ? snap : best, SHEET_SNAPS[0]);
};

/** Следующее положение по кнопке-ручке: низко → половина → весь экран → низко */
export const nextSheetSnap = (snap: SheetSnap): SheetSnap =>
  SHEET_SNAPS[(SHEET_SNAPS.indexOf(snap) + 1) % SHEET_SNAPS.length];
