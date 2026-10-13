/**
 * Высота земли в точке по модели рельефа MapTiler terrain-rgb-v2 (та же, по которой строятся изолинии
 * и рельеф 3D). Тайлы читаются в браузере, рельеф 3D на карте включать не нужно.
 *
 * Точность: глобальная модель ~30 м вместе с застройкой и деревьями. Сверка 13.10.2026 с отметками земли
 * узлов (nodes.geomarknodearea, 400 узлов): Алматы — в среднем на +7 м выше, σ 3 м; Астана — +2 м, σ 5 м.
 * Годится для формы рельефа и перепадов, не для гидравлики.
 */
import { getMapTilerKey, getMapTilerTerrainRgbTilesUrl } from '~/utils/maptiler'

export const DEM_ZOOM = 14

/** Высота по пикселю terrain-rgb (кодировка mapbox): -10000 + (R·256² + G·256 + B)·0,1 */
export function elevationFromRgb(r: number, g: number, b: number): number {
  return -10000 + (r * 65536 + g * 256 + b) * 0.1
}

/** Тайл и доля внутри тайла (0..1) для точки на зуме z */
export function tilePosition(lng: number, lat: number, z: number): { x: number; y: number; fx: number; fy: number } {
  const n = 2 ** z
  const tx = ((lng + 180) / 360) * n
  const latRad = (lat * Math.PI) / 180
  const ty = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  const x = Math.floor(tx)
  const y = Math.floor(ty)
  return { x, y, fx: tx - x, fy: ty - y }
}

interface DecodedTile { width: number; height: number; data: Uint8ClampedArray }

const tiles = new Map<string, Promise<DecodedTile | null>>()
const MAX_TILES = 96

async function loadTile(x: number, y: number): Promise<DecodedTile | null> {
  const url = getMapTilerTerrainRgbTilesUrl()
    .replace('{z}', String(DEM_ZOOM)).replace('{x}', String(x)).replace('{y}', String(y))
  const res = await fetch(url)
  if (!res.ok) return null
  const bitmap = await createImageBitmap(await res.blob())
  const canvas: OffscreenCanvas | HTMLCanvasElement = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(bitmap.width, bitmap.height)
    : Object.assign(document.createElement('canvas'), { width: bitmap.width, height: bitmap.height })
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
  if (!ctx) return null
  const { width, height } = bitmap
  ctx.drawImage(bitmap, 0, 0)
  const { data } = ctx.getImageData(0, 0, width, height)
  // Размеры — до close(): у закрытой картинки width/height = 0
  bitmap.close?.()
  return { width, height, data }
}

function tile(x: number, y: number): Promise<DecodedTile | null> {
  const key = `${x}/${y}`
  let p = tiles.get(key)
  if (!p) {
    p = loadTile(x, y).catch(() => null)
    tiles.set(key, p)
    if (tiles.size > MAX_TILES) tiles.delete(tiles.keys().next().value as string)
  }
  return p
}

/** Высота земли, м (null — нет ключа MapTiler или тайл не загрузился) */
export async function sampleElevation(lng: number, lat: number): Promise<number | null> {
  if (!getMapTilerKey()) return null
  const { x, y, fx, fy } = tilePosition(lng, lat, DEM_ZOOM)
  const t = await tile(x, y)
  if (!t) return null
  const px = Math.min(t.width - 1, Math.floor(fx * t.width))
  const py = Math.min(t.height - 1, Math.floor(fy * t.height))
  const i = (py * t.width + px) * 4
  return elevationFromRgb(t.data[i], t.data[i + 1], t.data[i + 2])
}
