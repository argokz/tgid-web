/**
 * Пересчёт вида между MapLibre (2D: центр, зум, наклон) и Cesium (3D: точка взгляда,
 * дальность камеры) — QA F18. Чистая математика, без Cesium: тестируется в vitest.
 *
 * Масштаб MapLibre: тайл 512 px, поэтому метров на пиксель
 *   mpp = 2π·R·cos(φ) / (512·2^z).
 * Камера Cesium (перспектива) на дальности d от точки взгляда видит по вертикали
 *   2·d·tan(fovy/2) метров — столько же, сколько MapLibre показывает на высоту окна: mpp·H.
 * Отсюда d = mpp·H / (2·tan(fovy/2)) и обратно z = log2(2πR·cos(φ)·H / (512·2·d·tan(fovy/2))).
 */

const EARTH_RADIUS_M = 6378137;
const EARTH_CIRCUMFERENCE_M = 2 * Math.PI * EARTH_RADIUS_M;
const TILE_SIZE_PX = 512;

/** Минимальный запас камеры над рельефом, м: ниже — камера «под землёй» (чёрный экран) */
export const CAMERA_GROUND_CLEARANCE_M = 30;
/** Пределы MapLibre */
export const MIN_ZOOM = 0;
export const MAX_ZOOM = 22;
export const MAX_PITCH = 85;

export interface Viewport {
  width: number;
  height: number;
}

const DEFAULT_VIEWPORT: Viewport = { width: 1280, height: 800 };

const cosLat = (lat: number) => Math.max(Math.cos((lat * Math.PI) / 180), 1e-6);

/** Размер окна карты; 0×0 (скрытый контейнер) → разумное значение по умолчанию */
export const safeViewport = (viewport?: Partial<Viewport> | null): Viewport => {
  const width = Number(viewport?.width);
  const height = Number(viewport?.height);
  return width > 0 && height > 0 ? { width, height } : DEFAULT_VIEWPORT;
};

/** Метров на пиксель MapLibre на широте lat при зуме zoom */
export const metersPerPixel = (zoom: number, lat: number): number =>
  (EARTH_CIRCUMFERENCE_M * cosLat(lat)) / (TILE_SIZE_PX * 2 ** zoom);

/**
 * Вертикальный угол обзора Cesium: `frustum.fov` (по умолчанию 60°) — это угол по большей
 * стороне окна, поэтому в горизонтальном окне вертикальный угол меньше.
 */
export const verticalFov = (fov: number, viewport: Viewport): number => {
  const aspect = viewport.width / viewport.height;
  return aspect > 1 ? 2 * Math.atan(Math.tan(fov / 2) / aspect) : fov;
};

/** Дальность камеры Cesium до точки взгляда, при которой масштаб совпадает с зумом MapLibre */
export const zoomToCameraRange = (zoom: number, lat: number, viewport: Viewport, fov: number): number => {
  const fovy = verticalFov(fov, viewport);
  return (metersPerPixel(zoom, lat) * viewport.height) / (2 * Math.tan(fovy / 2));
};

/** Обратный пересчёт: зум MapLibre по дальности камеры Cesium до точки взгляда */
export const cameraRangeToZoom = (range: number, lat: number, viewport: Viewport, fov: number): number => {
  const fovy = verticalFov(fov, viewport);
  const mpp = (Math.max(range, 1) * 2 * Math.tan(fovy / 2)) / viewport.height;
  const zoom = Math.log2((EARTH_CIRCUMFERENCE_M * cosLat(lat)) / (TILE_SIZE_PX * mpp));
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
};

/** Наклон MapLibre (0 — сверху) → pitch Cesium в градусах (−90 — сверху) и обратно */
export const pitchToCesium = (pitch: number): number => Math.min(MAX_PITCH, Math.max(0, pitch)) - 90;
export const pitchFromCesium = (cesiumPitchDeg: number): number =>
  Math.min(MAX_PITCH, Math.max(0, cesiumPitchDeg + 90));

/** Высота камеры над эллипсоидом не ниже рельефа под ней плюс запас */
export const clampCameraHeight = (height: number, groundHeight: number | null | undefined): number => {
  const ground = Number.isFinite(groundHeight as number) ? (groundHeight as number) : 0;
  return Math.max(height, ground + CAMERA_GROUND_CLEARANCE_M);
};
