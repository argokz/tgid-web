/**
 * Макет печати карты (этап 10): геометрия листа, масштаб ↔ zoom MapLibre, линейка масштаба,
 * цвет легенды. Чистые функции без DOM — рендер в utils/printRender.ts.
 *
 * Десктоп (gid8 GidWidget::onPrintFr): форматы A4–A0, масштабы 1:500…1:10000, книжная/альбомная,
 * фрагмент печати режется на страницы; рамки, штампа и легенды там нет. В вебе — один лист
 * с рамкой (поля по ГОСТ 2.301: слева 20 мм, остальные 5 мм), заголовком, легендой видимых
 * слоёв, линейкой масштаба, стрелкой севера и упрощённым штампом.
 */

export type PaperFormat = 'A4' | 'A3'
export type PageOrientation = 'landscape' | 'portrait'

/** Короткая и длинная сторона листа, мм */
export const PAPER_MM: Record<PaperFormat, [number, number]> = {
  A4: [210, 297],
  A3: [297, 420],
}

/** Масштабы десктопа (1:500…1:10000) и обзорные */
export const SCALE_PRESETS = [500, 1000, 2000, 5000, 10000, 25000, 50000]

export interface RectMm {
  x: number
  y: number
  width: number
  height: number
}

export interface PrintLayoutGeometry {
  page: { width: number; height: number }
  frame: RectMm
  title: RectMm
  map: RectMm
  stamp: RectMm
}

export const FRAME_MARGINS_MM = { left: 20, top: 5, right: 5, bottom: 5 }
export const TITLE_HEIGHT_MM = 12
export const STAMP_MM = { width: 120, height: 32 }

export function pageSizeMm(format: PaperFormat, orientation: PageOrientation): { width: number; height: number } {
  const [short, long] = PAPER_MM[format]
  return orientation === 'landscape' ? { width: long, height: short } : { width: short, height: long }
}

export function computeLayout(format: PaperFormat, orientation: PageOrientation): PrintLayoutGeometry {
  const page = pageSizeMm(format, orientation)
  const m = FRAME_MARGINS_MM
  const frame = { x: m.left, y: m.top, width: page.width - m.left - m.right, height: page.height - m.top - m.bottom }
  const title = { x: frame.x, y: frame.y, width: frame.width, height: TITLE_HEIGHT_MM }
  const map = {
    x: frame.x,
    y: frame.y + TITLE_HEIGHT_MM,
    width: frame.width,
    height: frame.height - TITLE_HEIGHT_MM,
  }
  const stamp = {
    x: frame.x + frame.width - STAMP_MM.width,
    y: frame.y + frame.height - STAMP_MM.height,
    width: STAMP_MM.width,
    height: STAMP_MM.height,
  }
  return { page, frame, title, map, stamp }
}

export function mmToPx(mm: number, dpi: number): number {
  return Math.round((mm / 25.4) * dpi)
}

/** Экваториальная длина окружности Земли (WGS84), м; тайл MapLibre — 512 CSS px */
const EARTH_CIRCUMFERENCE_M = 40075016.686
const TILE_SIZE = 512
/** CSS-пиксель = 1/96 дюйма */
const CSS_DPI = 96

/** Метров на местности в одном CSS-пикселе при данном zoom (Web Mercator) */
export function metersPerCssPixel(zoom: number, latitude: number): number {
  return (EARTH_CIRCUMFERENCE_M * Math.cos((latitude * Math.PI) / 180)) / (TILE_SIZE * 2 ** zoom)
}

/** Zoom, при котором 1 CSS px на бумаге (1/96 дюйма) соответствует масштабу 1:scale */
export function zoomForScale(scale: number, latitude: number): number {
  const metersPerPx = (scale * 0.0254) / CSS_DPI
  return Math.log2((EARTH_CIRCUMFERENCE_M * Math.cos((latitude * Math.PI) / 180)) / (TILE_SIZE * metersPerPx))
}

/** Знаменатель масштаба (1:N) для zoom; при печати CSS px = 1/96 дюйма */
export function scaleForZoom(zoom: number, latitude: number): number {
  return (metersPerCssPixel(zoom, latitude) * CSS_DPI) / 0.0254
}

/** Округление знаменателя для штампа: 2 значащие цифры (1:2347 → 1:2300) */
export function roundScale(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) return 0
  const p = 10 ** Math.max(0, Math.floor(Math.log10(scale)) - 1)
  return Math.round(scale / p) * p
}

/** Круглая длина линейки масштаба (1, 2, 5 × 10ⁿ м) не длиннее maxMeters */
export function niceScaleBar(maxMeters: number): { meters: number; label: string } {
  if (!(maxMeters > 0)) return { meters: 0, label: '' }
  const pow = 10 ** Math.floor(Math.log10(maxMeters))
  const step = [5, 2, 1].map((k) => k * pow).find((v) => v <= maxMeters) ?? pow
  return { meters: step, label: step >= 1000 ? `${step / 1000} км` : `${step} м` }
}

const COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\(.+\)|hsla?\(.+\))$/i

/** Первый цвет из paint-свойства (строка или выражение MapLibre) — для образца в легенде */
export function firstColor(value: unknown): string | null {
  if (typeof value === 'string') return COLOR_RE.test(value.trim()) ? value.trim() : null
  if (Array.isArray(value)) {
    // В match/case/step цвет «по умолчанию» — последний аргумент; иначе первый найденный
    const last = value[value.length - 1]
    const fromLast = typeof last === 'string' ? firstColor(last) : null
    if (fromLast) return fromLast
    for (const item of value) {
      const c = firstColor(item)
      if (c) return c
    }
  }
  return null
}

export type LegendKind = 'line' | 'circle' | 'fill' | 'symbol' | 'image'

export interface LegendItem {
  label: string
  kind: LegendKind
  color: string | null
}

/** Цвет слоя для легенды по типу слоя MapLibre */
export function legendColor(kind: LegendKind, paint: Record<string, unknown> | undefined): string | null {
  if (!paint) return null
  const key =
    kind === 'line' ? 'line-color' : kind === 'circle' ? 'circle-color' : kind === 'fill' ? 'fill-color' : 'icon-color'
  return firstColor(paint[key]) ?? firstColor(paint['text-color'])
}

export function formatPrintDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}.${date.getFullYear()}`
}
