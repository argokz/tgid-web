import { describe, expect, it } from 'vitest';
import { nextSheetSnap, settleSheet, sheetHeights, SHEET_PEEK_MIN, SHEET_TOP_GAP } from '~/utils/sheetSnap';

describe('sheetSnap', () => {
  const heights = sheetHeights(800);

  it('высоты: низко ≥ минимума, половина, весь экран минус зазор; на низком экране не перекрещиваются', () => {
    expect(heights).toEqual({ peek: 224, half: 440, full: 800 - SHEET_TOP_GAP });
    const tiny = sheetHeights(300);
    expect(tiny.peek).toBe(SHEET_PEEK_MIN);
    expect(tiny.peek).toBeLessThanOrEqual(tiny.half);
    expect(tiny.half).toBeLessThanOrEqual(tiny.full);
  });

  it('медленно — к ближайшему положению, ниже низкого — закрыть', () => {
    expect(settleSheet(470, 0, heights)).toBe('half');
    expect(settleSheet(700, 0, heights)).toBe('full');
    expect(settleSheet(250, 0, heights)).toBe('peek');
    expect(settleSheet(100, 0, heights)).toBe('dismiss');
  });

  it('бросок — на соседнее положение по направлению', () => {
    expect(settleSheet(300, 1, heights)).toBe('half');
    expect(settleSheet(460, 1, heights)).toBe('full');
    expect(settleSheet(780, 1, heights)).toBe('full');
    expect(settleSheet(420, -1, heights)).toBe('peek');
    expect(settleSheet(200, -1, heights)).toBe('dismiss');
  });

  it('ручка: низко → половина → весь экран → низко', () => {
    expect(nextSheetSnap('peek')).toBe('half');
    expect(nextSheetSnap('half')).toBe('full');
    expect(nextSheetSnap('full')).toBe('peek');
  });
});
