import { describe, expect, it } from 'vitest';
import { clampBelowModeRow, clampPanelPos, parsePanelPos, snapPanelPos } from '~/utils/floatingPanel';

describe('floatingPanel', () => {
  const panel = { w: 600, h: 48 };
  const area = { w: 1200, h: 800 };

  it('панель внутри карты — положение не меняется', () => {
    expect(clampPanelPos({ x: 100, y: 200 }, panel, area)).toEqual({ x: 100, y: 200 });
  });

  it('за край не уходит: ни влево-вверх, ни вправо-вниз', () => {
    expect(clampPanelPos({ x: -50, y: -10 }, panel, area)).toEqual({ x: 8, y: 8 });
    expect(clampPanelPos({ x: 900, y: 790 }, panel, area)).toEqual({ x: 592, y: 744 });
  });

  it('панель шире карты — прижата к левому краю', () => {
    expect(clampPanelPos({ x: 300, y: 10 }, { w: 1300, h: 48 }, area)).toEqual({ x: 8, y: 10 });
  });

  it('сохранённое положение: испорченное — как не заданное', () => {
    expect(parsePanelPos('{"x":10,"y":20}')).toEqual({ x: 10, y: 20 });
    expect(parsePanelPos(null)).toBeNull();
    expect(parsePanelPos('oops')).toBeNull();
    expect(parsePanelPos('{"x":"a","y":1}')).toBeNull();
  });

  it('магнит: у края — к краю с отступом, у середины по горизонтали — по центру, иначе как есть', () => {
    expect(snapPanelPos({ x: 20, y: 300 }, panel, area)).toEqual({ x: 8, y: 300 });
    expect(snapPanelPos({ x: 580, y: 740 }, panel, area)).toEqual({ x: 592, y: 744 });
    expect(snapPanelPos({ x: 310, y: 400 }, panel, area)).toEqual({ x: 300, y: 400 });
    expect(snapPanelPos({ x: 200, y: 200 }, panel, area)).toEqual({ x: 200, y: 200 });
  });

  it('панель режима не поднимается выше строки режимов; в низкой карте — сколько влезает', () => {
    // без CSS (jsdom) — запасные значения: отступ 12 + строка 46 + зазор 8 = 66
    const panel = { w: 300, h: 200 };
    expect(clampBelowModeRow({ x: 100, y: 8 }, panel, { w: 1200, h: 800 })).toEqual({ x: 100, y: 66 });
    expect(clampBelowModeRow({ x: 100, y: 300 }, panel, { w: 1200, h: 800 })).toEqual({ x: 100, y: 300 });
    expect(clampBelowModeRow({ x: 100, y: 8 }, panel, { w: 1200, h: 240 })).toEqual({ x: 100, y: 32 });
  });
});
