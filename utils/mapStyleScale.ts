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

/** Подпись в стиле GeoServer (px) на экране веба: ×0,9 издали (z13), как в стиле на z15, ×1,25 вблизи (z18) */
export const READABLE_TEXT_STOPS: ReadonlyArray<[number, number]> = [[13, 0.9], [15, 1], [18, 1.25]]
/** Мельче не бывает — иначе не прочесть */
export const READABLE_TEXT_MIN_PX = 11

/**
 * Шрифт подписей узлов, камер, диаметров — читаемый на всех масштабах: постоянный размер из стиля
 * растёт с зумом (издали чуть меньше, вблизи крупнее). Раньше веб уменьшал его на 20% (10–13 px).
 * Размер, уже заданный по зуму, не трогаем. Смещение text-offset задано в em — растёт вместе со шрифтом.
 */
export function readableTextLayout(layout: Record<string, any>): Record<string, any> {
  const size = layout['text-size']
  if (!isNumber(size)) return layout
  const expr: any[] = ['interpolate', ['linear'], ['zoom']]
  for (const [z, k] of READABLE_TEXT_STOPS) expr.push(z, Math.max(READABLE_TEXT_MIN_PX, Math.round(size * k * 10) / 10))
  return { ...layout, 'text-size': expr }
}
