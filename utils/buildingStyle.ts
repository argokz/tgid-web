/**
 * Здания и изолинии MapTiler: оформление и подсказка при наведении.
 *
 * Тайлы buildings (MapTiler, z12–15), слой `building`: class, subclass, height, height_min (только с z15),
 * facade_color, roof_color, roof_shape, underground; слой `building_label` (z15): name, name:ru, class, rank.
 * Изолинии contours-v2, слой `contour`: height (м), nth_line (1, 2, 5, 10 — каждая N-я линия).
 */

/** Цвет здания по назначению (class) — приглушённые тона, чтобы сеть оставалась заметнее */
export const BUILDING_CLASS_COLORS: Record<string, string> = {
  residential: '#cfc6b4',
  commercial: '#e0b77f',
  retail: '#e0b77f',
  industrial: '#a9a6bd',
  education: '#9fc9a6',
  medical: '#e8a3a3',
  civic: '#a8c1de',
  religious: '#c9a9dc',
  transportation: '#b9bcc2',
  service: '#c2b597',
  outbuilding: '#dcd8cf',
  agricultural: '#c7d39a',
  sport: '#9ed1cf',
}
export const BUILDING_DEFAULT_COLOR = '#c4c8d4'

export const BUILDING_CLASS_LABELS: Record<string, string> = {
  residential: 'Жилое',
  commercial: 'Коммерческое',
  retail: 'Торговое',
  industrial: 'Производственное',
  education: 'Образование',
  medical: 'Медицина',
  civic: 'Общественное',
  religious: 'Религиозное',
  transportation: 'Транспорт',
  service: 'Служебное',
  outbuilding: 'Хозпостройка',
  agricultural: 'Сельхоз',
  sport: 'Спорт',
}

const SUBCLASS_LABELS: Record<string, string> = {
  apartments: 'многоквартирный дом',
  house: 'частный дом',
  detached: 'частный дом',
  residential: 'жилой дом',
  dormitory: 'общежитие',
  commercial: 'коммерческое',
  office: 'офис',
  retail: 'магазин',
  supermarket: 'супермаркет',
  hotel: 'гостиница',
  university: 'университет',
  college: 'колледж',
  school: 'школа',
  kindergarten: 'детский сад',
  hospital: 'больница',
  clinic: 'поликлиника',
  government: 'госучреждение',
  civic: 'общественное',
  public: 'общественное',
  church: 'церковь',
  mosque: 'мечеть',
  industrial: 'промышленное',
  warehouse: 'склад',
  garage: 'гараж',
  garages: 'гаражи',
  carport: 'навес',
  parking: 'паркинг',
  roof: 'навес',
  shed: 'сарай',
  service: 'служебное',
  train_station: 'вокзал',
  transportation: 'транспорт',
}

const ROOF_LABELS: Record<string, string> = {
  flat: 'плоская',
  gabled: 'двускатная',
  hipped: 'вальмовая',
  pyramidal: 'шатровая',
  skillion: 'односкатная',
  mansard: 'мансардная',
  dome: 'купол',
  round: 'полукруглая',
  saltbox: 'несимметричная двускатная',
  gambrel: 'ломаная',
  onion: 'луковичная',
}

/** Высота без данных (z12–14: высоты в тайлах только с z15) — по назначению, м */
const DEFAULT_HEIGHT = 8
const FLOOR_HEIGHT_M = 3

/** Выражение MapLibre: цвет по назначению */
export function buildingColorExpression(): any {
  const match: any[] = ['match', ['get', 'class']]
  for (const [cls, color] of Object.entries(BUILDING_CLASS_COLORS)) match.push(cls, color)
  match.push(BUILDING_DEFAULT_COLOR)
  return match
}

/** Фон подложки (#f0ede6): к нему осветляются цвета зданий в плане */
const MAP_BACKGROUND_RGB = [0xf0, 0xed, 0xe6] as const
/** Доля фона в цвете плоского здания: в плане здания тише сети, оттенок назначения сохраняется */
export const BUILDING_FLAT_LIGHTEN = 0.45

/** Цвет #rrggbb, смешанный с фоном подложки в доле `share` (0 — исходный, 1 — фон) */
export function lightenTowardsBackground(hex: string, share: number = BUILDING_FLAT_LIGHTEN): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const n = Number.parseInt(m[1], 16)
  const rgb = [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
  return `#${rgb.map((c, i) => Math.round(c + (MAP_BACKGROUND_RGB[i] - c) * share).toString(16).padStart(2, '0')).join('')}`
}

/** Выражение MapLibre: цвет здания в плане (2D) — тот же оттенок назначения, светлее объёма */
export function buildingFlatColorExpression(): any {
  const match: any[] = ['match', ['get', 'class']]
  for (const [cls, color] of Object.entries(BUILDING_CLASS_COLORS)) match.push(cls, lightenTowardsBackground(color))
  match.push(lightenTowardsBackground(BUILDING_DEFAULT_COLOR))
  return match
}

/** Paint зданий в плане: заливка с обводкой чуть темнее фона — контур читается, сеть остаётся главной */
export function buildingFlatPaint(): Record<string, any> {
  return {
    'fill-color': buildingFlatColorExpression(),
    'fill-outline-color': '#d2cabd',
  }
}

/**
 * Наклон карты (°), с которого здания рисуются объёмом. Ниже — в плане: объёмы при взгляде сверху
 * не видны, а проход fill-extrusion стоит GPU на каждом кадре.
 */
export const BUILDINGS_3D_MIN_PITCH = 10

/** Paint объёмов зданий; opacity — ниже при рельефе 3D (сеть натянута на рельеф и видна сквозь здания) */
export function buildingExtrusionPaint(opacity: number): Record<string, any> {
  return {
    'fill-extrusion-color': buildingColorExpression(),
    'fill-extrusion-opacity': opacity,
    'fill-extrusion-height': ['coalesce', ['get', 'height'], ['get', 'render_height'], DEFAULT_HEIGHT],
    'fill-extrusion-base': ['coalesce', ['get', 'height_min'], ['get', 'render_min_height'], 0],
    'fill-extrusion-vertical-gradient': true,
  }
}

/** Прозрачность объёмов: без рельефа — плотные, с рельефом — полупрозрачные (трубы под ними видны) */
export const BUILDING_OPACITY = { flat: 0.85, terrain: 0.45 } as const

/** Подземные сооружения не рисуем объёмом */
export const BUILDING_FILTER: any = ['!=', ['get', 'underground'], true]

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export interface HoverSummary {
  title: string
  rows: Array<{ label: string; value: string; color?: string }>
  note?: string
}

/** Подсказка для изолинии: высота по модели рельефа (её отличие от отметок земли — см. заметку) */
function contourSummary(props: Record<string, any>, sourceLayer: string): HoverSummary {
  const h = num(props.height)
  const feet = sourceLayer === 'contour_ft'
  return {
    title: 'Изолиния рельефа',
    rows: h == null ? [] : [{ label: 'Высота', value: feet ? `${h} фут` : `${h} м` }],
    note: 'Модель рельефа MapTiler (~30 м, вместе с застройкой): от отметок земли узлов в базе отличается '
      + 'в среднем на +2…+7 м — для формы рельефа, не для гидравлики.',
  }
}

function buildingSummary(props: Record<string, any>): HoverSummary {
  const cls = String(props.class || '')
  const sub = String(props.subclass || '')
  const name = props['name:ru'] || props.name
  const kind = BUILDING_CLASS_LABELS[cls] || cls || 'Здание'
  const subLabel = SUBCLASS_LABELS[sub] || (sub && sub !== cls ? sub : '')
  const rows: HoverSummary['rows'] = []
  rows.push({ label: 'Назначение', value: subLabel ? `${kind}, ${subLabel}` : kind, color: BUILDING_CLASS_COLORS[cls] })
  const h = num(props.height ?? props.render_height)
  const base = num(props.height_min ?? props.render_min_height)
  if (h != null && h > 0) {
    const floors = Math.max(1, Math.round((h - (base || 0)) / FLOOR_HEIGHT_M))
    rows.push({ label: 'Высота', value: `${Math.round(h)} м (≈${floors} эт.)` })
  }
  if (base != null && base > 0) rows.push({ label: 'Основание', value: `${Math.round(base)} м` })
  if (props.roof_shape) rows.push({ label: 'Крыша', value: ROOF_LABELS[props.roof_shape] || String(props.roof_shape) })
  if (props.facade_color) rows.push({ label: 'Фасад', value: String(props.facade_color), color: String(props.facade_color) })
  if (props.underground === true) rows.push({ label: 'Расположение', value: 'подземное' })
  return { title: name ? String(name) : 'Здание', rows }
}

/**
 * Понятная подсказка для объекта подложки/контекста MapTiler (здание, изолиния) или null —
 * тогда выводятся сырые атрибуты.
 */
export function contextHoverSummary(feature: { properties?: Record<string, any>; sourceLayer?: string; layer?: any }): HoverSummary | null {
  const props = feature.properties || {}
  const sourceLayer = String(feature.sourceLayer || feature.layer?.['source-layer'] || '')
  if (sourceLayer === 'contour' || sourceLayer === 'contour_ft') return contourSummary(props, sourceLayer)
  if (sourceLayer === 'building' || sourceLayer === 'building_label') return buildingSummary(props)
  return null
}
