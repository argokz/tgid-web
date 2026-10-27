/**
 * Подписи полигонов (нагрузки зданий) — по одной в середине объекта.
 *
 * MapLibre ставит подпись полигона из векторного тайла в каждый его кусок: GeoServer режет дом
 * по границам тайла (с запасом), и большой дом на 17–19-м зуме получал две-три подписи у краёв.
 * Здесь куски одного объекта (по id) из загруженных тайлов собираются обратно: каждый обрезается
 * по своему тайлу (без запаса — куски не перекрываются), берётся центр тяжести целого, если там
 * просторно, иначе (Г-образный, с двором) — самое просторное место дома ближе к центру (labelPointOf).
 * Для каждого варианта многострочной подписи считается, при каком шрифте она помещается в доме
 * (textFit) — слой показывает на зуме самый полный вариант, который не вылезает на соседей.
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

type Segment = [Pt, Pt]
type Bounds = [number, number, number, number]

/**
 * Стены объекта — стороны колец без линий разреза по границе тайла: куски дома из соседних
 * тайлов прилегают друг к другу по разрезу, и он не должен «делить» дом пополам.
 */
export function wallsOf(polys: Poly[], bounds: ReadonlyArray<Bounds | null> = []): Segment[] {
  const out: Segment[] = []
  polys.forEach((poly, k) => {
    const b = bounds[k]
    const eps = b ? (b[2] - b[0]) * 1e-9 : 0
    const onCut = (a: Pt, c: Pt): boolean => !!b && (
      (Math.abs(a[0] - b[0]) <= eps && Math.abs(c[0] - b[0]) <= eps)
      || (Math.abs(a[0] - b[2]) <= eps && Math.abs(c[0] - b[2]) <= eps)
      || (Math.abs(a[1] - b[1]) <= eps && Math.abs(c[1] - b[1]) <= eps)
      || (Math.abs(a[1] - b[3]) <= eps && Math.abs(c[1] - b[3]) <= eps))
    for (const ring of poly) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        if (!onCut(ring[j], ring[i])) out.push([ring[j], ring[i]])
      }
    }
  })
  return out
}

/** Расстояние от точки до ближайшей стены */
function edgeDistance(p: Pt, walls: readonly Segment[]): number {
  let best = Infinity
  for (const [[ax, ay], [bx, by]] of walls) {
    const dx = bx - ax
    const dy = by - ay
    const len2 = dx * dx + dy * dy
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / len2)) : 0
    const d = Math.hypot(p[0] - ax - t * dx, p[1] - ay - t * dy)
    if (d < best) best = d
  }
  return best
}

/** Доля наибольшего «запаса» до стен, при которой точка ещё считается серединой дома */
const ROOMY = 0.75
const GRID = 16

/** Центр тяжести набора полигонов (дыры — минус) и охват по y */
function centroidOf(polys: Poly[]): { c: Pt | null; minY: number; maxY: number } {
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
  return { c: Math.abs(area) > 0 ? [sx / area, sy / area] : null, minY, maxY }
}

/**
 * Точка подписи одного объекта по его кускам (меркатор): центр тяжести, если он внутри дома и
 * от него просторно до стен; иначе (Г-образный, П-образный, с двором) — ближайшая к центру тяжести
 * точка сетки, где места почти столько же, сколько в самом просторном месте дома.
 */
export function labelPointOf(polys: Poly[], walls: readonly Segment[] = wallsOf(polys)): Pt | null {
  const { c, minY, maxY } = centroidOf(polys)
  if (!c) return polys[0]?.[0]?.[0] ?? null
  let x0 = Infinity
  let x1 = -Infinity
  for (const poly of polys) {
    for (const p of poly[0] ?? []) {
      if (p[0] < x0) x0 = p[0]
      if (p[0] > x1) x1 = p[0]
    }
  }
  const step = Math.max(x1 - x0, maxY - minY) / GRID
  const samples: Array<{ p: Pt; d: number }> = []
  let dmax = 0
  if (step > 0) {
    for (let x = x0 + step / 2; x < x1; x += step) {
      for (let y = minY + step / 2; y < maxY; y += step) {
        const p: Pt = [x, y]
        if (!inside(p, polys)) continue
        const d = edgeDistance(p, walls)
        samples.push({ p, d })
        if (d > dmax) dmax = d
      }
    }
  }
  if (inside(c, polys) && edgeDistance(c, walls) >= ROOMY * dmax) return c
  let best: Pt | null = null
  let bestDist = Infinity
  for (const { p, d } of samples) {
    if (d < ROOMY * dmax) continue
    const dist = Math.hypot(p[0] - c[0], p[1] - c[1])
    if (dist < bestDist) {
      bestDist = dist
      best = p
    }
  }
  if (best) return best
  if (inside(c, polys)) return c
  return scanlinePoint(c[1], polys) ?? scanlinePoint((minY + maxY) / 2, polys) ?? polys[0][0][0]
}

/** Отрезок задевает внутренность прямоугольника (Лян — Барски) */
function segmentHitsBox(a: Pt, b: Pt, [x0, y0, x1, y1]: Bounds): boolean {
  let t0 = 0
  let t1 = 1
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const checks: Array<[number, number]> = [[-dx, a[0] - x0], [dx, x1 - a[0]], [-dy, a[1] - y0], [dy, y1 - a[1]]]
  for (const [p, q] of checks) {
    if (p === 0) {
      if (q <= 0) return false
      continue
    }
    const r = q / p
    if (p < 0) {
      if (r > t1) return false
      if (r > t0) t0 = r
    } else {
      if (r < t0) return false
      if (r < t1) t1 = r
    }
  }
  return t1 - t0 > 1e-9
}

/** Прямоугольник вокруг точки внутри дома (точка — внутри, стены его не пересекают) */
function boxClear(box: Bounds, walls: readonly Segment[]): boolean {
  for (const [a, b] of walls) {
    if (segmentHitsBox(a, b, box)) return false
  }
  return true
}

/** Ширина знака и высота строки подписи — в долях размера шрифта */
export const LABEL_CHAR_EM = 0.56
export const LABEL_LINE_EM = 1.2

/**
 * Наибольший размер шрифта (м меркатора), при котором текст целиком помещается в доме вокруг точки p.
 * По нему слой подписи выбирает, сколько строк показать на текущем зуме: подпись остаётся в своём
 * доме и не наезжает на соседний — видно, к какому дому она относится.
 */
export function textFit(text: string, p: Pt, walls: readonly Segment[]): number {
  const lines = text.split('\n')
  const w = Math.max(...lines.map(l => l.length)) * LABEL_CHAR_EM
  const h = lines.length * LABEL_LINE_EM
  if (!(w > 0)) return 0
  const box = (f: number): Bounds =>
    [p[0] - f * w / 2, p[1] - f * h / 2, p[0] + f * w / 2, p[1] + f * h / 2]
  let lo = 0
  let hi = 2 * edgeDistance(p, walls) / Math.min(w, h)
  if (!(hi > 0)) return 0
  // наверняка не помещается при hi (вписанный круг × 2 по меньшей стороне) — ищем делением пополам
  if (boxClear(box(hi), walls)) return Math.round(hi * 100) / 100
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2
    if (boxClear(box(mid), walls)) lo = mid
    else hi = mid
  }
  return Math.round(lo * 100) / 100
}

/**
 * Суффиксы свойств с сокращениями многострочной подписи (адрес, Qот, Qгвс, [Qвент], Qсум):
 * __wide — все данные в три строки (адрес / средние строки в одну / итог), __mid — адрес и итог,
 * __short — итог
 */
export const LABEL_SHORT_SUFFIX = '__short'
export const LABEL_MID_SUFFIX = '__mid'
export const LABEL_WIDE_SUFFIX = '__wide'
/** Суффикс размера шрифта (м меркатора), при котором вариант подписи помещается в доме (textFit) */
export const LABEL_FIT_SUFFIX = '__fit'
/** Свойство с площадью объекта (м² меркатора) — крупные дома подписываются первыми */
export const LABEL_AREA_PROP = '__area'

/** Значащих цифр у дробных значений подписи (Qот, Qгвс, Qсум, Гкал/ч); точные значения — в карточке */
export const LABEL_SIGNIFICANT_DIGITS = 3

/**
 * Дробные значения после «=» с 4+ знаками после точки — до LABEL_SIGNIFICANT_DIGITS значащих цифр:
 * «Qсум=0.0764841» → «Qсум=0.0765». Адреса и целые числа не трогаем.
 */
export function roundLabelNumbers(text: string): string {
  return text.replace(/(=\s*)(-?\d+\.\d{4,})/g, (_, eq: string, num: string) => {
    const n = Number(num)
    if (!Number.isFinite(n)) return eq + num
    const rounded = Math.abs(n) >= 10 ** LABEL_SIGNIFICANT_DIGITS
      ? Math.round(n)
      : Number(n.toPrecision(LABEL_SIGNIFICANT_DIGITS))
    return eq + String(rounded)
  })
}

/** Свойства точки подписи и варианты многострочных подписей: имя свойства → текст */
const cleanProperties = (props: Record<string, any>): { out: Record<string, any>; variants: Record<string, string> } => {
  const out: Record<string, any> = {}
  const variants: Record<string, string> = {}
  for (const [k, v] of Object.entries(props)) {
    if (typeof v !== 'string') {
      out[k] = v
      continue
    }
    // «\r\n» из базы десктопа MapLibre рисует пустым квадратом
    const text = roundLabelNumbers(v.replace(/\r/g, '').trim())
    out[k] = text
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) continue
    const last = lines[lines.length - 1]
    variants[k] = text
    variants[k + LABEL_SHORT_SUFFIX] = last
    variants[k + LABEL_MID_SUFFIX] = lines.length > 2 ? `${lines[0]}\n${last}` : text
    if (lines.length > 3) variants[k + LABEL_WIDE_SUFFIX] = `${lines[0]}\n${lines.slice(1, -1).join('  ')}\n${last}`
  }
  return { out, variants }
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
    const byZoom = new Map<number, { polys: Poly[]; bounds: Array<Bounds | null>; area: number }>()
    for (const f of list) {
      const z = f.tile?.z ?? -1
      const bounds = f.tile ? tileBoundsMerc(f.tile.z, f.tile.x, f.tile.y) : null
      const entry = byZoom.get(z) ?? { polys: [], bounds: [], area: 0 }
      for (const poly of polygonsOf(f.geometry)) {
        const rings = poly
          .map(ring => ring.map(toMerc))
          .map(ring => (bounds ? clipRing(ring, bounds) : ring))
        if (!rings[0] || rings[0].length < 3) continue
        const kept = rings.filter(r => r.length >= 3)
        entry.polys.push(kept)
        entry.bounds.push(bounds)
        entry.area += Math.abs(ringMoments(kept[0]).a)
      }
      byZoom.set(z, entry)
    }
    let best: { polys: Poly[]; bounds: Array<Bounds | null>; area: number } | null = null
    let bestZ = -Infinity
    for (const [z, e] of byZoom) {
      if (!e.polys.length) continue
      if (!best || e.area > best.area * 1.001 || (e.area >= best.area * 0.999 && z > bestZ)) {
        best = e
        bestZ = z
      }
    }
    if (!best) continue
    const walls = wallsOf(best.polys, best.bounds)
    const p = labelPointOf(best.polys, walls)
    if (!p) continue
    const { out, variants } = cleanProperties(list[0].properties || {})
    for (const [name, text] of Object.entries(variants)) {
      out[name] = text
      out[name + LABEL_FIT_SUFFIX] = textFit(text, p, walls)
    }
    features.push({
      type: 'Feature',
      ...(typeof k === 'number' || typeof k === 'string' ? { id: k } : {}),
      properties: { ...out, [LABEL_AREA_PROP]: Math.round(best.area) },
      geometry: { type: 'Point', coordinates: toLonLat(p) },
    })
  }
  return { type: 'FeatureCollection', features }
}
