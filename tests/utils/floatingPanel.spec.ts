import { describe, expect, it } from 'vitest';
import { clampPanelPos, parsePanelPos } from '~/utils/floatingPanel';

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
});
