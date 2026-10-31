import { describe, expect, it } from 'vitest';
import { ABOVE_GROUND, DEPTH_CLASSES, NO_DEPTH, depthColor, pipePositions, pipeWidth, type Network3dItem } from '~/utils/network3d';

describe('network3d', () => {
  it('глубина линейно по длине, ось ниже верха на радиус', () => {
    // два отрезка равной длины вдоль меридиана: середина — среднее глубин
    const item: Network3dItem = [1, 500, 1, 3, 1, [77, 43, 77, 43.001, 77, 43.002]];
    const p = pipePositions(item);
    expect(p).toHaveLength(9);
    expect(p[2]).toBeCloseTo(-1.25);       // 1 м + радиус 0,25
    expect(p[5]).toBeCloseTo(-2.25, 2);
    expect(p[8]).toBeCloseTo(-3.25);
  });

  it('рельеф у концов прибавляется, без глубины — на поверхности', () => {
    const item: Network3dItem = [2, null, null, null, 2, [77, 43, 77, 43.001]];
    expect(pipePositions(item, 800, 810)).toEqual([77, 43, 800, 77, 43.001, 810]);
    const deep: Network3dItem = [3, 0, 2, 2, 1, [77, 43, 77, 43.001]];
    expect(pipePositions(deep, 800, 800)[2]).toBe(798);
  });

  it('цвет по средней глубине', () => {
    expect(depthColor(null, 1)).toBe(NO_DEPTH.color);
    expect(depthColor(-2, -1)).toBe(ABOVE_GROUND.color);
    expect(depthColor(0.5, 0.7)).toBe(DEPTH_CLASSES[0].color);
    expect(depthColor(1.5, 2.5)).toBe(DEPTH_CLASSES[2].color);
    expect(depthColor(4, 5)).toBe(DEPTH_CLASSES[3].color);
  });

  it('толщина по Ду в пределах 2–8 px', () => {
    expect(pipeWidth(null)).toBe(2);
    expect(pipeWidth(100)).toBe(2);
    expect(pipeWidth(1000)).toBe(8);
  });
});
