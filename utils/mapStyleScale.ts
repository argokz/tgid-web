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
