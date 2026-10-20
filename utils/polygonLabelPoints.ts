/**
 * Подписи полигонов (нагрузки зданий) — по одной в середине объекта.
 *
 * MapLibre ставит подпись полигона из векторного тайла в каждый его кусок: GeoServer режет дом
 * по границам тайла (с запасом), и большой дом на 17–19-м зуме получал две-три подписи у краёв.
 * Здесь куски одного объекта (по id) из загруженных тайлов собираются обратно: каждый обрезается
 * по своему тайлу (без запаса — куски не перекрываются), берётся центр тяжести целого; если он вне
 * дома (Г-образный), — середина самого широкого отрезка горизонтали через него (как ST_PointOnSurface).
 */

export interface LabelPieceInput {
  id?: string | number | null
  properties: Record<string, any>
  geometry: { type: string; coordinates: any } | null | undefined
  /** Тайл данных куска (z/x/y) — по нему кусок обрезается; null — без обрезки */
  tile?: { z: number; x: number; y: number } | null
}

type Pt = [number, number]
type Ring = Pt[]
type Poly = Ring[]

const R = 6378137
const HALF = Math.PI * R

const toMerc = ([lon, lat]: number[]): Pt => {
  const φ = Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI / 180
  return [lon * Math.PI / 180 * R, R * Math.log(Math.tan(Math.PI / 4 + φ / 2))]
}
const toLonLat = ([x, y]: Pt): Pt => [
  x / R * 180 / Math.PI,
  (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180 / Math.PI,
]

/** Границы тайла в меркаторе: [x0, y0, x1, y1] */
export function tileBoundsMerc(z: number, x: number, y: number): [number, number, number, number] {
  const size = 2 * HALF / 2 ** z
  return [-HALF + x * size, HALF - (y + 1) * size, -HALF + (x + 1) * size, HALF - y * size]
}

/** Обрезка кольца прямоугольником (Сазерленд — Ходжмен) */
export function clipRing(ring: Ring, [x0, y0, x1, y1]: [number, number, number, number]): Ring {
  const edges: Array<[(p: Pt) => boolean, (a: Pt, b: Pt) => Pt]> = [
    [p => p[0] >= x0, (a, b) => [x0, a[1] + (b[1] - a[1]) * (x0 - a[0]) / (b[0] - a[0])]],
    [p => p[0] <= x1, (a, b) => [x1, a[1] + (b[1] - a[1]) * (x1 - a[0]) / (b[0] - a[0])]],
    [p => p[1] >= y0, (a, b) => [a[0] + (b[0] - a[0]) * (y0 - a[1]) / (b[1] - a[1]), y0]],
    [p => p[1] <= y1, (a, b) => [a[0] + (b[0] - a[0]) * (y1 - a[1]) / (b[1] - a[1]), y1]],
  ]
  let out = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
    ? ring.slice(0, -1)
    : ring.slice()
  for (const [inside, cross] of edges) {
    if (!out.length) break
    const src = out
    out = []
    for (let i = 0; i < src.length; i++) {
      const cur = src[i]
      const prev = src[(i + src.length - 1) % src.length]
      if (inside(cur)) {
        if (!inside(prev)) out.push(cross(prev, cur))
        out.push(cur)
      } else if (inside(prev)) {
        out.push(cross(prev, cur))
      }
    }
  }
  return out
}

/** Площадь (со знаком) и центр тяжести кольца */
function ringMoments(ring: Ring): { a: number; cx: number; cy: number } {
  let a = 0
  let cx = 0
  let cy = 0
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[(i + 1) % n]
    const f = x1 * y2 - x2 * y1
    a += f
    cx += (x1 + x2) * f
    cy += (y1 + y2) * f
  }
  return { a: a / 2, cx, cy }
}

function polygonsOf(geometry: LabelPieceInput['geometry']): number[][][][] {
  if (!geometry) return []
  if (geometry.type === 'Polygon') return [geometry.coordinates]
  if (geometry.type === 'MultiPolygon') return geometry.coordinates
  return []
}

/** Точка внутри набора полигонов (чётность пересечений по всем кольцам) */
function inside(p: Pt, polys: Poly[]): boolean {
  let c = false
  for (const poly of polys) {
    for (const ring of poly) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i]
        const [xj, yj] = ring[j]
        if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) c = !c
      }
    }
  }
  return c
}

/** Середина самого широкого внутреннего отрезка горизонтали y */
function scanlinePoint(y: number, polys: Poly[]): Pt | null {
  const xs: number[] = []
  for (const poly of polys) {
    for (const ring of poly) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i]
        const [xj, yj] = ring[j]
        if ((yi > y) !== (yj > y)) xs.push((xj - xi) * (y - yi) / (yj - yi) + xi)
      }
    }
  }
  xs.sort((a, b) => a - b)
  let best: Pt | null = null
  let width = 0
  for (let i = 0; i + 1 < xs.length; i += 2) {
    if (xs[i + 1] - xs[i] > width) {
      width = xs[i + 1] - xs[i]
      best = [(xs[i] + xs[i + 1]) / 2, y]
    }
  }
  return best
}

/** Точка подписи одного объекта по его кускам (меркатор) */
export function labelPointOf(polys: Poly[]): Pt | null {
  let area = 0
  let sx = 0
  let sy = 0
  let minY = Infinity
  let maxY = -Infinity
  for (const poly of polys) {
    poly.forEach((ring, i) => {
      const m = ringMoments(ring)
      // внешнее кольцо — плюс, дыры — минус, независимо от обхода
      const sign = (i === 0 ? 1 : -1) * Math.sign(m.a)
      area += sign * m.a
      sx += sign * m.cx / 6
      sy += sign * m.cy / 6
      for (const p of ring) {
        if (p[1] < minY) minY = p[1]
        if (p[1] > maxY) maxY = p[1]
      }
    })
  }
  if (!(Math.abs(area) > 0)) return polys[0]?.[0]?.[0] ?? null
  const c: Pt = [sx / area, sy / area]
  if (inside(c, polys)) return c
  return scanlinePoint(c[1], polys) ?? scanlinePoint((minY + maxY) / 2, polys) ?? polys[0][0][0]
}

const cleanProperties = (props: Record<string, any>): Record<string, any> => {
  const out: Record<string, any> = {}
  // «\r\n» из базы десктопа MapLibre рисует пустым квадратом
  for (const [k, v] of Object.entries(props)) out[k] = typeof v === 'string' ? v.replace(/\r/g, '') : v
  return out
}

const keyOf = (f: LabelPieceInput): string | number | null => {
  const k = f.id ?? f.properties?.id ?? f.properties?.objectid ?? f.properties?.fid
  return k === undefined || k === null || k === '' ? null : k
}

/** Точки подписей: по одной на объект (куски из разных тайлов — один объект по id) */
export function computeLabelPoints(pieces: readonly LabelPieceInput[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const groups = new Map<string | number | symbol, LabelPieceInput[]>()
  for (const f of pieces) {
    const k = keyOf(f) ?? Symbol('piece')
    const list = groups.get(k)
    if (list) list.push(f)
    else groups.set(k, [f])
  }
  const features: GeoJSON.Feature<GeoJSON.Point>[] = []
  for (const [k, list] of groups) {
    // Куски одного зума (пока догружается зум, есть тайлы двух уровней): берём уровень, где
    // объект собран полнее всего (больше площадь), при равенстве — подробнее
    const byZoom = new Map<number, { polys: Poly[]; area: number }>()
    for (const f of list) {
      const z = f.tile?.z ?? -1
      const bounds = f.tile ? tileBoundsMerc(f.tile.z, f.tile.x, f.tile.y) : null
      const entry = byZoom.get(z) ?? { polys: [], area: 0 }
      for (const poly of polygonsOf(f.geometry)) {
        const rings = poly
          .map(ring => ring.map(toMerc))
          .map(ring => (bounds ? clipRing(ring, bounds) : ring))
        if (!rings[0] || rings[0].length < 3) continue
        const kept = rings.filter(r => r.length >= 3)
        entry.polys.push(kept)
        entry.area += Math.abs(ringMoments(kept[0]).a)
      }
      byZoom.set(z, entry)
    }
    let best: { polys: Poly[]; area: number } | null = null
    let bestZ = -Infinity
    for (const [z, e] of byZoom) {
      if (!e.polys.length) continue
      if (!best || e.area > best.area * 1.001 || (e.area >= best.area * 0.999 && z > bestZ)) {
        best = e
        bestZ = z
      }
    }
    if (!best) continue
    const p = labelPointOf(best.polys)
    if (!p) continue
    features.push({
      type: 'Feature',
      ...(typeof k === 'number' || typeof k === 'string' ? { id: k } : {}),
      properties: cleanProperties(list[0].properties || {}),
      geometry: { type: 'Point', coordinates: toLonLat(p) },
    })
  }
  return { type: 'FeatureCollection', features }
}
