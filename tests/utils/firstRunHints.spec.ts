import { describe, expect, it } from 'vitest';
import { HINT_GAP_PX, placeHintCard } from '~/utils/firstRunHints';

const view = { w: 1280, h: 720 };
const card = { w: 300, h: 160 };

describe('placeHintCard', () => {
  it('снизу — под якорем по центру; у нижнего края — над ним', () => {
    expect(placeHintCard({ left: 400, top: 10, width: 200, height: 36 }, card, view, 'bottom'))
      .toEqual({ x: 350, y: 46 + HINT_GAP_PX });
    expect(placeHintCard({ left: 400, top: 650, width: 200, height: 40 }, card, view, 'bottom'))
      .toEqual({ x: 350, y: 650 - 160 - HINT_GAP_PX });
  });

  it('справа от колонки; слева от правых кнопок; по вертикали — центр якоря в пределах окна', () => {
    expect(placeHintCard({ left: 12, top: 68, width: 340, height: 600 }, card, view, 'right'))
      .toEqual({ x: 352 + HINT_GAP_PX, y: 368 - 80 });
    expect(placeHintCard({ left: 1220, top: 68, width: 48, height: 600 }, card, view, 'left'))
      .toEqual({ x: 1220 - 300 - HINT_GAP_PX, y: 288 });
  });

  it('сбоку не помещается (телефон) — под якорем, прижато к окну', () => {
    const phone = { w: 375, h: 812 };
    // правые кнопки у края: слева места нет (8 px < отступа) — под ними, прижато к правому краю окна
    expect(placeHintCard({ left: 320, top: 68, width: 44, height: 400 }, card, phone, 'left'))
      .toEqual({ x: 375 - 300 - HINT_GAP_PX, y: 468 + HINT_GAP_PX });
    // колонка во всю ширину — под ней, по центру
    expect(placeHintCard({ left: 0, top: 68, width: 360, height: 400 }, card, phone, 'right'))
      .toEqual({ x: 30, y: 468 + HINT_GAP_PX });
  });
});
