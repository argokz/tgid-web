/**
 * Рендер макета печати на клиенте: карта рисуется во внеэкранном MapLibre нужного размера
 * (стиль копируется с основной карты, preserveDrawingBuffer), затем на 2D-канве листа
 * собираются рамка, заголовок, карта, легенда, линейка, стрелка севера и штамп.
 * Внешних сервисов нет: PNG — canvas.toBlob, PDF — utils/pdfImage.ts.
 */
import type { Map as MaplibreMap } from 'maplibre-gl'
import { getMaplibreDefault } from '~/utils/maplibreLoader'
import {
  computeLayout,
  metersPerCssPixel,
  mmToPx,
  niceScaleBar,
  roundScale,
  scaleForZoom,
  zoomForScale,
  type LegendItem,
  type PageOrientation,
  type PaperFormat,
  type RectMm,
} from '~/utils/printLayout'

export interface PrintOptions {
  format: PaperFormat
  orientation: PageOrientation
  dpi: number
  /** view — вписать текущий вид карты; fixed — масштаб 1:scale от центра карты */
  scaleMode: 'view' | 'fixed'
  scale: number
  title: string
  organization: string
  author: string
  sheet: string
  date: string
  showLegend: boolean
  showStamp: boolean
}

export interface PrintResult {
  canvas: HTMLCanvasElement
  /** Фактический масштаб 1:N (для режима view — округлённый) */
  scale: number
  /** Не все тайлы карты загрузились за отведённое время — лист может быть неполным */
  incomplete: boolean
  pageMm: { width: number; height: number }
}

const CSS_DPI = 96
const MAP_IDLE_TIMEOUT_MS = 45000

/** Снимок текущего вида основной карты (без макета) */
export function captureCurrentView(map: MaplibreMap): Promise<HTMLCanvasElement> {
  return new Promise((resolve) => {
    map.once('render', () => {
      const src = map.getCanvas()
      const copy = document.createElement('canvas')
      copy.width = src.width
      copy.height = src.height
      copy.getContext('2d')!.drawImage(src, 0, 0)
      resolve(copy)
    })
    map.triggerRepaint()
  })
}

/** Внеэкранная отрисовка карты заданного CSS-размера и плотности пикселей */
async function renderMapOffscreen(
  source: MaplibreMap,
  cssWidth: number,
  cssHeight: number,
  pixelRatio: number,
  center: [number, number],
  zoom: number,
  onIncomplete?: (incomplete: boolean) => void,
): Promise<HTMLCanvasElement> {
  const maplibregl = await getMaplibreDefault()
  const container = document.createElement('div')
  Object.assign(container.style, {
    position: 'fixed',
    left: '-100000px',
    top: '0',
    width: `${cssWidth}px`,
    height: `${cssHeight}px`,
    visibility: 'hidden',
  })
  document.body.appendChild(container)
  const off = new maplibregl.Map({
    container,
    style: source.getStyle(),
    center,
    zoom,
    bearing: 0,
    pitch: 0,
    interactive: false,
    attributionControl: false,
    fadeDuration: 0,
    pixelRatio,
    preserveDrawingBuffer: true,
  })
  // Иконки, добавленные в основную карту через addImage, в getStyle() не попадают
  off.on('styleimagemissing', (e: { id: string }) => {
    const img = (source as any).style?.getImage?.(e.id)
    if (img?.data && !off.hasImage(e.id)) {
      off.addImage(
        e.id,
        { width: img.data.width, height: img.data.height, data: img.data.data },
        { pixelRatio: img.pixelRatio ?? 1, sdf: !!img.sdf },
      )
    }
  })
  try {
    // Ждём загрузки стиля и тайлов. Только на 'idle' полагаться нельзя: если последний тайл
    // пришёл с ошибкой (WMS отдал XML вместо картинки), перерисовки не будет и 'idle' не
    // наступит. Поэтому опрос loaded() и контрольная перерисовка; по таймауту — что успело.
    const deadline = Date.now() + MAP_IDLE_TIMEOUT_MS
    let complete = false
    while (Date.now() < deadline) {
      if (off.loaded()) {
        await new Promise<void>((resolve) => {
          off.once('render', () => resolve())
          off.triggerRepaint()
          window.setTimeout(resolve, 2000)
        })
        if (off.loaded()) {
          complete = true
          break
        }
      }
      await new Promise((r) => window.setTimeout(r, 250))
    }
    if (!complete) {
      // рисуем то, что загрузилось: лучше лист с пропусками, чем никакого
      await new Promise<void>((resolve) => {
        off.once('render', () => resolve())
        off.triggerRepaint()
        window.setTimeout(resolve, 2000)
      })
    }
    onIncomplete?.(!complete)
    const src = off.getCanvas()
    const copy = document.createElement('canvas')
    copy.width = src.width
    copy.height = src.height
    copy.getContext('2d')!.drawImage(src, 0, 0)
    return copy
  } finally {
    off.remove()
    container.remove()
  }
}

/** Масштаб и zoom для листа: вписать текущий вид или задать 1:N */
export function resolvePrintView(
  map: Pick<MaplibreMap, 'getCenter' | 'getZoom' | 'getContainer'>,
  mapAreaCss: { width: number; height: number },
  options: Pick<PrintOptions, 'scaleMode' | 'scale'>,
): { center: [number, number]; zoom: number; scale: number } {
  const c = map.getCenter()
  const center: [number, number] = [c.lng, c.lat]
  if (options.scaleMode === 'fixed') {
    return { center, zoom: zoomForScale(options.scale, c.lat), scale: options.scale }
  }
  const el = map.getContainer()
  const kx = mapAreaCss.width / Math.max(1, el.clientWidth)
  const ky = mapAreaCss.height / Math.max(1, el.clientHeight)
  const zoom = map.getZoom() + Math.log2(Math.min(kx, ky))
  return { center, zoom, scale: roundScale(scaleForZoom(zoom, c.lat)) }
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  sizePx: number,
  opts: { bold?: boolean; align?: CanvasTextAlign; maxWidth?: number } = {},
) {
  ctx.font = `${opts.bold ? 'bold ' : ''}${Math.round(sizePx)}px Arial, "Helvetica Neue", sans-serif`
  ctx.textAlign = opts.align ?? 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y, opts.maxWidth)
}

export async function renderPrintPage(
  map: MaplibreMap,
  options: PrintOptions,
  legend: LegendItem[],
): Promise<PrintResult> {
  const layout = computeLayout(options.format, options.orientation)
  const dpi = options.dpi
  const px = (mm: number) => mmToPx(mm, dpi)
  const rect = (r: RectMm) => [px(r.x), px(r.y), px(r.width), px(r.height)] as const

  const mapCss = { width: (layout.map.width / 25.4) * CSS_DPI, height: (layout.map.height / 25.4) * CSS_DPI }
  const view = resolvePrintView(map, mapCss, options)
  let incomplete = false
  const mapImage = await renderMapOffscreen(
    map,
    Math.round(mapCss.width),
    Math.round(mapCss.height),
    dpi / CSS_DPI,
    view.center,
    view.zoom,
    (v) => (incomplete = v),
  )

  const canvas = document.createElement('canvas')
  canvas.width = px(layout.page.width)
  canvas.height = px(layout.page.height)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const [mx, my, mw, mh] = rect(layout.map)
  ctx.drawImage(mapImage, mx, my, mw, mh)

  ctx.fillStyle = '#000000'
  ctx.strokeStyle = '#000000'
  const thick = Math.max(1, px(0.5))
  const thin = Math.max(1, px(0.25))

  // Заголовок
  const [tx, ty, tw, th] = rect(layout.title)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(tx, ty, tw, th)
  ctx.fillStyle = '#000000'
  drawText(ctx, options.title || 'Схема тепловой сети', tx + tw / 2, ty + th / 2, px(5), {
    bold: true,
    align: 'center',
    maxWidth: tw - px(10),
  })
  ctx.lineWidth = thin
  ctx.beginPath()
  ctx.moveTo(tx, ty + th)
  ctx.lineTo(tx + tw, ty + th)
  ctx.stroke()

  // Стрелка севера (карта печатается без поворота — север вверху)
  {
    const cx = mx + mw - px(10)
    const cy = my + px(12)
    const s = px(5)
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.beginPath()
    ctx.arc(cx, cy, s * 1.6, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#000000'
    ctx.beginPath()
    ctx.moveTo(cx, cy - s)
    ctx.lineTo(cx + s * 0.5, cy + s * 0.7)
    ctx.lineTo(cx, cy + s * 0.35)
    ctx.lineTo(cx - s * 0.5, cy + s * 0.7)
    ctx.closePath()
    ctx.fill()
    drawText(ctx, 'С', cx, cy - s * 1.25, px(3), { bold: true, align: 'center' })
  }

  // Линейка масштаба (левый нижний угол карты)
  {
    const metersPerDevicePx = metersPerCssPixel(view.zoom, view.center[1]) * (CSS_DPI / dpi)
    const bar = niceScaleBar(metersPerDevicePx * px(50))
    const barPx = bar.meters / metersPerDevicePx
    const bx = mx + px(6)
    const by = my + mh - px(8)
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fillRect(bx - px(2), by - px(6), barPx + px(22), px(9))
    ctx.fillStyle = '#000000'
    ctx.fillRect(bx, by, barPx / 2, px(1.2))
    ctx.lineWidth = thin
    ctx.strokeRect(bx, by, barPx, px(1.2))
    drawText(ctx, '0', bx, by - px(2.5), px(2.6), { align: 'center' })
    drawText(ctx, bar.label, bx + barPx, by - px(2.5), px(2.6), { align: 'center' })
    drawText(ctx, `1:${view.scale.toLocaleString('ru-RU')}`, bx + barPx + px(4), by + px(0.6), px(2.6))
  }

  // Легенда видимых слоёв (левый верхний угол карты)
  if (options.showLegend && legend.length) {
    const items = legend.slice(0, 24)
    const rowH = px(5)
    const lx = mx + px(4)
    const ly = my + px(4)
    ctx.font = `${px(2.8)}px Arial, sans-serif`
    const textW = Math.max(ctx.measureText('Условные обозначения').width, ...items.map((i) => ctx.measureText(i.label).width))
    const boxW = Math.min(textW + px(16), mw / 2)
    const boxH = rowH * (items.length + 1) + px(3)
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.fillRect(lx, ly, boxW, boxH)
    ctx.lineWidth = thin
    ctx.strokeStyle = '#000000'
    ctx.strokeRect(lx, ly, boxW, boxH)
    ctx.fillStyle = '#000000'
    drawText(ctx, 'Условные обозначения', lx + px(3), ly + px(4), px(3), { bold: true, maxWidth: boxW - px(6) })
    items.forEach((item, i) => {
      const y = ly + rowH * (i + 1) + px(4)
      const sx = lx + px(3)
      const color = item.color ?? '#607d8b'
      ctx.strokeStyle = color
      ctx.fillStyle = color
      if (item.kind === 'line') {
        ctx.lineWidth = px(0.8)
        ctx.beginPath()
        ctx.moveTo(sx, y)
        ctx.lineTo(sx + px(8), y)
        ctx.stroke()
      } else if (item.kind === 'fill' || item.kind === 'image') {
        ctx.fillRect(sx, y - px(1.5), px(8), px(3))
      } else {
        ctx.beginPath()
        ctx.arc(sx + px(4), y, px(1.3), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = '#000000'
      drawText(ctx, item.label, sx + px(10), y, px(2.8), { maxWidth: boxW - px(15) })
    })
    if (legend.length > items.length) {
      drawText(ctx, `… ещё ${legend.length - items.length}`, lx + px(3), ly + boxH - px(1.5), px(2.4))
    }
  }

  // Штамп
  if (options.showStamp) {
    const [sx, sy, sw, sh] = rect(layout.stamp)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(sx, sy, sw, sh)
    ctx.fillStyle = '#000000'
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = thick
    ctx.strokeRect(sx, sy, sw, sh)
    ctx.lineWidth = thin
    const rows = [10, 10, 6, 6].map(px)
    const cols = [25, 45, 20, 30].map(px)
    let y = sy
    for (const h of rows.slice(0, -1)) {
      y += h
      ctx.beginPath()
      ctx.moveTo(sx, y)
      ctx.lineTo(sx + sw, y)
      ctx.stroke()
    }
    const smallTop = sy + rows[0] + rows[1]
    let x = sx
    for (const w of cols.slice(0, -1)) {
      x += w
      ctx.beginPath()
      ctx.moveTo(x, smallTop)
      ctx.lineTo(x, sy + sh)
      ctx.stroke()
    }
    const pad = px(2)
    drawText(ctx, options.organization || '—', sx + sw / 2, sy + rows[0] / 2, px(3.4), {
      bold: true,
      align: 'center',
      maxWidth: sw - pad * 2,
    })
    drawText(ctx, options.title || 'Схема тепловой сети', sx + sw / 2, sy + rows[0] + rows[1] / 2, px(3.2), {
      align: 'center',
      maxWidth: sw - pad * 2,
    })
    const cells = [
      ['Масштаб', `1:${view.scale.toLocaleString('ru-RU')}`, 'Лист', options.sheet || '1'],
      ['Исполнитель', options.author || '', 'Дата', options.date],
    ]
    cells.forEach((row, r) => {
      const cy = smallTop + rows[2] * r + rows[2] / 2
      let cx = sx
      row.forEach((text, c) => {
        drawText(ctx, text, cx + pad, cy, px(2.6), { bold: c % 2 === 0, maxWidth: cols[c] - pad * 2 })
        cx += cols[c]
      })
    })
  }

  // Рамка поверх всего
  const [fx, fy, fw, fh] = rect(layout.frame)
  ctx.lineWidth = thick
  ctx.strokeStyle = '#000000'
  ctx.strokeRect(fx, fy, fw, fh)

  return { canvas, scale: view.scale, pageMm: layout.page, incomplete }
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Не удалось получить изображение'))), type, quality)
  })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Печать листа через скрытый iframe: @page с размером листа, картинка на всю страницу */
export function printImage(dataUrl: string, pageMm: { width: number; height: number }): void {
  const iframe = document.createElement('iframe')
  Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' })
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument!
  doc.open()
  doc.write(
    `<!doctype html><html><head><title>Печать карты</title><style>` +
      `@page{size:${pageMm.width}mm ${pageMm.height}mm;margin:0}html,body{margin:0;padding:0}` +
      `img{display:block;width:${pageMm.width}mm;height:${pageMm.height}mm}</style></head>` +
      `<body><img src="${dataUrl}"></body></html>`,
  )
  doc.close()
  const img = doc.querySelector('img')!
  const go = () => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    window.setTimeout(() => iframe.remove(), 60000)
  }
  if (img.complete) go()
  else img.onload = go
}
