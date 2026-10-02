import { describe, expect, it } from 'vitest';
import {
  CAMERA_GROUND_CLEARANCE_M,
  cameraRangeToZoom,
  clampCameraHeight,
  metersPerPixel,
  pitchFromCesium,
  pitchToCesium,
  safeViewport,
  verticalFov,
  zoomToCameraRange,
} from '~/utils/cameraSync';

const ALMATY_LAT = 43.24;
const FOV = Math.PI / 3; // frustum.fov Cesium по умолчанию
const VIEWPORT = { width: 1260, height: 843 };

describe('cameraSync (QA F18)', () => {
  it('метры на пиксель MapLibre (тайл 512 px)', () => {
    expect(metersPerPixel(0, 0)).toBeCloseTo(78271.517, 2);
    // на z15 в Алматы ≈1,74 м/px; прежняя формула с 156543 давала вдвое больше
    expect(metersPerPixel(15, ALMATY_LAT)).toBeCloseTo(1.743, 2);
  });

  it('дальность камеры зависит от зума: +1 зум — вдвое ближе', () => {
    const r15 = zoomToCameraRange(15, ALMATY_LAT, VIEWPORT, FOV);
    const r16 = zoomToCameraRange(16, ALMATY_LAT, VIEWPORT, FOV);
    expect(r15 / r16).toBeCloseTo(2, 6);
    // видимая высота кадра в 3D = mpp·H, как в 2D
    const fovy = verticalFov(FOV, VIEWPORT);
    expect(2 * r15 * Math.tan(fovy / 2)).toBeCloseTo(metersPerPixel(15, ALMATY_LAT) * VIEWPORT.height, 6);
  });

  it('цикл 2D→3D→2D сохраняет зум (было 15 → 16,5)', () => {
    for (const zoom of [11, 15, 16.5, 19]) {
      const range = zoomToCameraRange(zoom, ALMATY_LAT, VIEWPORT, FOV);
      expect(cameraRangeToZoom(range, ALMATY_LAT, VIEWPORT, FOV)).toBeCloseTo(zoom, 9);
    }
  });

  it('вертикальный угол обзора: fov Cesium — по большей стороне окна', () => {
    expect(verticalFov(FOV, { width: 800, height: 800 })).toBeCloseTo(FOV, 9);
    expect(verticalFov(FOV, { width: 600, height: 900 })).toBeCloseTo(FOV, 9);
    expect(verticalFov(FOV, { width: 1600, height: 800 })).toBeLessThan(FOV);
  });

  it('скрытое окно (0×0) не обнуляет дальность', () => {
    const vp = safeViewport({ width: 0, height: 0 });
    expect(vp.width).toBeGreaterThan(0);
    expect(zoomToCameraRange(15, ALMATY_LAT, vp, FOV)).toBeGreaterThan(100);
  });

  it('зум ограничен пределами MapLibre', () => {
    expect(cameraRangeToZoom(1e9, ALMATY_LAT, VIEWPORT, FOV)).toBe(0);
    expect(cameraRangeToZoom(0, ALMATY_LAT, VIEWPORT, FOV)).toBe(22);
  });

  it('камера не ниже рельефа плюс запас', () => {
    // Алматы: рельеф ~850 м над эллипсоидом, прежняя высота 891 м была почти у земли
    expect(clampCameraHeight(500, 850)).toBe(850 + CAMERA_GROUND_CLEARANCE_M);
    expect(clampCameraHeight(2000, 850)).toBe(2000);
    expect(clampCameraHeight(10, undefined)).toBe(CAMERA_GROUND_CLEARANCE_M);
  });

  it('наклон: 0 в 2D = взгляд сверху (−90°) в 3D, и обратно', () => {
    expect(pitchToCesium(0)).toBe(-90);
    expect(pitchToCesium(60)).toBe(-30);
    expect(pitchFromCesium(-30)).toBe(60);
    expect(pitchFromCesium(-95)).toBe(0);
    expect(pitchFromCesium(10)).toBe(85);
  });
});
