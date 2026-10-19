/**
 * Ввод точки по координатам (этап F плана CAD): WGS84, местная система (SRID 9998, метры) и координаты
 * десктопа (nodes.x/y: сантиметры местной системы, Y с обратным знаком). Пересчёт — на сервере
 * (POST api/v1/topology/convert-point, PostGIS по spatial_ref_sys базы города).
 */

export type PointCrs = 'wgs84' | 'local' | 'desktop'

export const POINT_CRS_ITEMS: readonly { value: PointCrs; title: string; x: string; y: string }[] = [
  { value: 'local', title: 'Местная система (9998), м', x: 'X, м', y: 'Y, м' },
  { value: 'desktop', title: 'Координаты десктопа (x/y узлов, см)', x: 'x, см', y: 'y, см' },
  { value: 'wgs84', title: 'WGS84: долгота / широта', x: 'Долгота, °', y: 'Широта, °' },
]

/** POST api/v1/topology/convert-point */
export interface ConvertedPoint {
  lng: number
  lat: number
  local: { x: number; y: number }
  desktop: { x: number; y: number }
}

/** Число из поля: «12,5», «1 234,5», «12.5»; иначе null */
export const parseCoord = (text: string | number | null | undefined): number | null => {
  if (typeof text === 'number') return Number.isFinite(text) ? text : null
  // \s в JS включает и неразрывный пробел (разделитель тысяч из Excel)
  const s = String(text ?? '').trim().replace(/\s+/g, '')
  if (!s) return null
  const norm = s.includes(',') && !s.includes('.') ? s.replace(',', '.') : s.replace(/,/g, '')
  if (!/^[-+]?\d+(\.\d+)?$/.test(norm)) return null
  return Number(norm)
}

/** Строка «X Y» или «X;Y» / «X<Tab>Y» из ведомости → [x, y] (вставка двух чисел в одно поле) */
export const parseCoordPair = (text: string): [number, number] | null => {
  const parts = text.trim().split(/[;\t]+|\s+(?=[-+]?\d)/).filter(Boolean)
  if (parts.length !== 2) return null
  const x = parseCoord(parts[0])
  const y = parseCoord(parts[1])
  return x == null || y == null ? null : [x, y]
}

/** Проверка диапазона до запроса: WGS84 — градусы */
export const coordRangeError = (crs: PointCrs, x: number, y: number): string | null => {
  if (crs === 'wgs84' && (Math.abs(x) > 180 || Math.abs(y) > 90)) return 'Долгота — до ±180°, широта — до ±90°'
  return null
}

const fmt = (v: number, digits: number) => v.toFixed(digits).replace('.', ',')

/** «43,377223° с. ш., 76,998393° в. д. · местн. X 3652,896 Y 13155,392 · десктоп x 365289,6 y −1315539,2» */
export const describeConverted = (p: ConvertedPoint): string =>
  `${fmt(p.lat, 6)}°, ${fmt(p.lng, 6)}° · местн. X ${fmt(p.local.x, 3)} Y ${fmt(p.local.y, 3)}`
  + ` · десктоп x ${fmt(p.desktop.x, 1)} y ${fmt(p.desktop.y, 1)}`
