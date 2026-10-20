/**
 * Масштаб размеров стиля GeoServer в вебе (services/mapService.ts уменьшает шрифт подписей).
 *
 * Размер бывает числом, функцией MBStyle `{stops: [[zoom, value], …]}` или выражением
 * `interpolate` / `step` по зуму. Умножать нужно только значения — не ступени зума
 * (раньше `interpolate` умножался целиком и ступени 10/18 превращались в 8/14,4).
 */

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function scaleZoomValue(value: any, k: number): any {
  if (isNumber(value)) return Math.round(value * k * 100) / 100;
  if (Array.isArray(value)) {
    const [op] = value;
    if (op === 'interpolate' || op === 'interpolate-hcl' || op === 'interpolate-lab') {
      // ['interpolate', interp, input, z1, v1, z2, v2, …]
      return value.map((item, i) => (i >= 4 && i % 2 === 0 ? scaleZoomValue(item, k) : item));
    }
    if (op === 'step') {
      // ['step', input, v0, z1, v1, …]
      return value.map((item, i) => (i >= 2 && i % 2 === 0 ? scaleZoomValue(item, k) : item));
    }
    return value; // прочие выражения не трогаем
  }
  if (value && typeof value === 'object' && Array.isArray(value.stops)) {
    return {
      ...value,
      stops: value.stops.map((stop: any) =>
        (Array.isArray(stop) && stop.length >= 2 ? [stop[0], scaleZoomValue(stop[1], k)] : stop)),
    };
  }
  return value;
}

/**
 * Шрифт подписи ×k. Смещение `text-offset` задано в em (долях шрифта) — при меньшем шрифте
 * подпись съезжала бы на значок, поэтому смещение делится на k: в пикселях оно прежнее.
 */
export function scaleTextLayout(layout: Record<string, any>, k: number): Record<string, any> {
  const size = layout['text-size'];
  if (size == null) return layout;
  const out: Record<string, any> = { ...layout, 'text-size': scaleZoomValue(size, k) };
  const offset = layout['text-offset'];
  if (isNumber(size) && Array.isArray(offset) && offset.length === 2 && offset.every(isNumber)) {
    out['text-offset'] = offset.map((v: number) => Math.round((v / k) * 1000) / 1000);
  }
  return out;
}

/**
 * Подпись в стиле GeoServer (px) на экране веба: ×0,85 издали (z13), ×0,92 на z15, ×1,1 вблизи (z18).
 * 20.10: ×0,9 / 1 / 1,25 — подписи крупные, на средних масштабах заслоняли сеть и друг друга.
 */
export const READABLE_TEXT_STOPS: ReadonlyArray<[number, number]> = [[13, 0.85], [15, 0.92], [18, 1.1]]
/** Мельче не бывает — иначе не прочесть */
export const READABLE_TEXT_MIN_PX = 10.5
/** Значки точек (узлы, камеры) из стиля GeoServer — крупнее, чем в стиле: их видно издали */
export const POINT_SYMBOL_SCALE = 1.2
/** Подпись у значка отодвигается на столько пикселей — значок крупнее, и она не наезжает на него */
const LABEL_ICON_GAP_PX = 2

/**
 * Шрифт подписей узлов, камер, диаметров — читаемый на всех масштабах: постоянный размер из стиля
 * меняется с зумом (издали меньше, вблизи крупнее). Размер, уже заданный по зуму, не трогаем.
 * Смещение text-offset задано в em — растёт вместе со шрифтом; к нему добавляется зазор под
 * увеличенный значок.
 */
export function readableTextLayout(layout: Record<string, any>): Record<string, any> {
  const size = layout['text-size']
  if (!isNumber(size)) return layout
  const expr: any[] = ['interpolate', ['linear'], ['zoom']]
  for (const [z, k] of READABLE_TEXT_STOPS) expr.push(z, Math.max(READABLE_TEXT_MIN_PX, Math.round(size * k * 10) / 10))
  const out: Record<string, any> = { ...layout, 'text-size': expr }
  const offset = layout['text-offset']
  if (Array.isArray(offset) && offset.length === 2 && offset.every(isNumber) && size > 0) {
    const gap = LABEL_ICON_GAP_PX / size
    out['text-offset'] = offset.map((v: number) => (v ? Math.round((v + Math.sign(v) * gap) * 1000) / 1000 : v))
  }
  return out
}

/** Значок точки крупнее: icon-size (число или по зуму) у символов, circle-radius у кружков */
export function largerPointLayer<T extends { type?: string; layout?: Record<string, any>; paint?: Record<string, any> }>(layer: T): T {
  if (layer.type === 'symbol' && layer.layout?.['icon-image'] != null && layer.layout?.['icon-size'] != null) {
    return { ...layer, layout: { ...layer.layout, 'icon-size': scaleZoomValue(layer.layout['icon-size'], POINT_SYMBOL_SCALE) } }
  }
  if (layer.type === 'circle' && layer.paint?.['circle-radius'] != null) {
    return { ...layer, paint: { ...layer.paint, 'circle-radius': scaleZoomValue(layer.paint['circle-radius'], POINT_SYMBOL_SCALE) } }
  }
  return layer
}
