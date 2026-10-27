import { describe, expect, it, vi } from 'vitest';
import { MapScaleControl, roundScaleDistance, scaleBar } from '~/utils/mapScaleControl';

describe('mapScaleControl', () => {
  it('круглые расстояния 1, 2, 3, 5 × 10ⁿ не больше исходного', () => {
    expect(roundScaleDistance(1)).toBe(1);
    expect(roundScaleDistance(2.9)).toBe(2);
    expect(roundScaleDistance(4.99)).toBe(3);
    expect(roundScaleDistance(7)).toBe(5);
    expect(roundScaleDistance(730)).toBe(500);
    expect(roundScaleDistance(0.37)).toBeCloseTo(0.3);
    expect(roundScaleDistance(0)).toBe(0);
    expect(roundScaleDistance(Number.NaN)).toBe(0);
  });

  it('метры до километра, дальше километры; полоса — доля от ширины', () => {
    expect(scaleBar(730, 100)).toEqual({ width: 68, label: '500 м' });
    expect(scaleBar(2600, 100)).toEqual({ width: 77, label: '2 км' });
    expect(scaleBar(0, 100)).toBeNull();
  });

  it('обновляется только по окончании движения, не на каждом кадре', () => {
    const handlers: Record<string, () => void> = {};
    const map = {
      on: vi.fn((ev: string, fn: () => void) => { handlers[ev] = fn; }),
      off: vi.fn(),
      getCanvas: () => ({ height: 1600 }),
      getPixelRatio: () => 2,
      // слева направо 100 px = 730 м
      unproject: ([x]: [number, number]) => ({ distanceTo: () => (x === 0 ? 730 : 0) }),
    };
    const control = new MapScaleControl(100);
    const el = control.onAdd(map as never);
    expect(Object.keys(handlers)).toEqual(['moveend']);
    expect(el.textContent).toBe('500 м');
    expect(el.style.width).toBe('68px');
    control.onRemove();
    expect(map.off).toHaveBeenCalledWith('moveend', handlers.moveend);
  });
});
