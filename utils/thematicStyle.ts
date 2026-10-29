/**
 * Тематические карты участков (Smart Mapping, фаза 1): классы, палитры и выражения MapLibre.
 *
 * Сервер (GET api/v1/thematic/pipes) отдаёт значение темы у каждого участка, здесь из значений строятся
 * классы (равные интервалы, квантили, естественные границы Дженкса, свои границы) или уникальные значения
 * справочника. Стиль — JSON, тот же, что хранит API (database/layer_styles.py, clean_style): по нему
 * и рисуется слой, и строится легенда.
 */

export type ThematicMethod = 'equal' | 'quantile' | 'jenks' | 'manual' | 'unique'
export type ThematicKind = 'number' | 'category'

export interface ThematicTheme {
  key: string
  label: string
  units: string
  kind: ThematicKind
  source: 'passport' | 'calc' | 'wear' | 'heat_losses'
  hint: string
  method: Exclude<ThematicMethod, 'unique'>
  breaks: number[]
  palette: string
  digits: number
}

export interface ThematicCategoryColor {
  value: number
  color: string
}

/** Стиль слоя (format 1): поля — как у clean_style в API */
export interface ThematicStyle {
  format: 1
  theme: string
  method: ThematicMethod
  width: number
  opacity: number
  show_nulls: boolean
  null_color: string
  palette?: string
  classes?: number
  colors?: string[]
  /** границы между классами по возрастанию (на одну меньше, чем классов) */
  breaks?: number[]
  categories?: ThematicCategoryColor[]
}

export interface ThematicLegendRow {
  color: string
  label: string
  count: number
}

export const MIN_CLASSES = 2
export const MAX_CLASSES = 9
export const DEFAULT_CLASSES = 5
/** Классы Дженкса считаются по выборке: O(k·n²) на всех участках города — секунды */
export const JENKS_SAMPLE = 1500

export const METHOD_ITEMS: { value: Exclude<ThematicMethod, 'unique'>; title: string }[] = [
  { value: 'quantile', title: 'Квантили (поровну участков)' },
  { value: 'jenks', title: 'Естественные границы (Дженкс)' },
  { value: 'equal', title: 'Равные интервалы' },
  { value: 'manual', title: 'Свои границы' },
]

/** Опорные цвета палитр (ColorBrewer / viridis — различимы при нарушениях цветового зрения) */
export const PALETTES: Record<string, { title: string; colors: string[] }> = {
  ylorrd: { title: 'Жёлтый → красный', colors: ['#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c', '#bd0026', '#800026'] },
  viridis: { title: 'Viridis', colors: ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'] },
  blues: { title: 'Синие', colors: ['#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'] },
  rdylgn: { title: 'Зелёный → красный', colors: ['#1a9850', '#91cf60', '#d9ef8b', '#fee08b', '#fc8d59', '#d73027'] },
  spectral: { title: 'Спектр', colors: ['#3288bd', '#66c2a5', '#abdda4', '#e6f598', '#fee08b', '#fdae61', '#f46d43', '#d53e4f'] },
}
export const CATEGORY_COLORS = ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948', '#b07aa1',
  '#ff9da7', '#9c755f', '#bab0ac']
export const NULL_COLOR = '#9e9e9e'
const REVERSED = '_r'

/** Палитра темы с сервера (sequential / sequential_reverse) → имя палитры веба */
export const themePalette = (theme: Pick<ThematicTheme, 'palette'>): string =>
  theme.palette === 'sequential_reverse' ? `ylorrd${REVERSED}` : 'ylorrd'

const hexToRgb = (hex: string): [number, number, number] => {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const rgbToHex = (rgb: number[]): string =>
  `#${rgb.map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('')}`

/** n цветов палитры: опорные цвета растягиваются интерполяцией; «_r» — в обратном порядке */
export function paletteColors(name: string, n: number): string[] {
  const reversed = name.endsWith(REVERSED)
  const base = PALETTES[reversed ? name.slice(0, -REVERSED.length) : name] ?? PALETTES.ylorrd!
  const anchors = reversed ? [...base.colors].reverse() : base.colors
  if (n <= 1) return [anchors[anchors.length - 1]!]
  return Array.from({ length: n }, (_, i) => {
    const pos = (i / (n - 1)) * (anchors.length - 1)
    const lo = Math.floor(pos)
    const hi = Math.min(anchors.length - 1, lo + 1)
    const t = pos - lo
    const a = hexToRgb(anchors[lo]!)
    const b = hexToRgb(anchors[hi]!)
    return rgbToHex(a.map((c, k) => c + (b[k]! - c) * t))
  })
}

const roundTo = (value: number, digits: number): number => {
  const f = 10 ** Math.max(0, digits)
  return Math.round(value * f) / f
}

/** Границы по возрастанию без повторов (совпавшие квантили схлопываются — классов становится меньше) */
const uniqueAscending = (breaks: number[]): number[] =>
  breaks.filter((b, i) => Number.isFinite(b) && (i === 0 || b > breaks[i - 1]!))

export function equalBreaks(values: number[], classes: number, digits = 2): number[] {
  if (!values.length) return []
  let min = Infinity
  let max = -Infinity
  for (const v of values) {
    if (v < min) min = v
    if (v > max) max = v
  }
  if (min === max) return []
  const step = (max - min) / classes
  return uniqueAscending(Array.from({ length: classes - 1 }, (_, i) => roundTo(min + step * (i + 1), digits)))
}

export function quantileBreaks(values: number[], classes: number, digits = 2): number[] {
  if (!values.length) return []
  const sorted = [...values].sort((a, b) => a - b)
  const min = sorted[0]!
  const breaks = Array.from({ length: classes - 1 }, (_, i) =>
    roundTo(sorted[Math.floor(((i + 1) * sorted.length) / classes)]!, digits))
  return uniqueAscending(breaks).filter((b) => b > min)
}

/** Равномерная выборка из отсортированных значений (крайние сохраняются) */
const sampleSorted = (sorted: number[], size: number): number[] => {
  if (sorted.length <= size) return sorted
  return Array.from({ length: size }, (_, i) => sorted[Math.round((i * (sorted.length - 1)) / (size - 1))]!)
}

/** Естественные границы Дженкса (Fisher–Jenks): минимум суммы квадратов отклонений внутри классов */
export function jenksBreaks(values: number[], classes: number, digits = 2): number[] {
  const data = sampleSorted([...values].sort((a, b) => a - b), JENKS_SAMPLE)
  const n = data.length
  if (n === 0) return []
  const k = Math.min(classes, n)
  if (k < 2) return []
  // lower[i][j] — начало последнего класса при j классах на первых i значениях; variance — его стоимость
  const lower = Array.from({ length: n + 1 }, () => new Int32Array(k + 1))
  const cost = Array.from({ length: n + 1 }, () => new Float64Array(k + 1).fill(Infinity))
  for (let j = 1; j <= k; j += 1) {
    lower[1]![j] = 1
    cost[1]![j] = 0
  }
  for (let i = 2; i <= n; i += 1) {
    let sum = 0
    let sumSq = 0
    for (let m = 1; m <= i; m += 1) {
      const start = i - m + 1
      const v = data[start - 1]!
      sum += v
      sumSq += v * v
      const variance = sumSq - (sum * sum) / m
      if (start === 1) {
        lower[i]![1] = 1
        cost[i]![1] = variance
        continue
      }
      for (let j = 2; j <= k; j += 1) {
        const candidate = variance + cost[start - 1]![j - 1]!
        if (candidate <= cost[i]![j]!) {
          lower[i]![j] = start
          cost[i]![j] = candidate
        }
      }
    }
  }
  const breaks: number[] = []
  let end = n
  for (let j = k; j >= 2; j -= 1) {
    const start = lower[end]![j]!
    breaks.unshift(roundTo(data[start - 1]!, digits))
    end = start - 1
  }
  return uniqueAscending(breaks).filter((b) => b > data[0]!)
}

export function classBreaks(method: Exclude<ThematicMethod, 'unique' | 'manual'>, values: number[],
  classes: number, digits = 2): number[] {
  if (method === 'equal') return equalBreaks(values, classes, digits)
  if (method === 'jenks') return jenksBreaks(values, classes, digits)
  return quantileBreaks(values, classes, digits)
}

/** Числа значений темы (без пустых) */
export const numericValues = (values: ReadonlyArray<number | null | undefined>): number[] =>
  values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))

/**
 * Стиль по теме и значениям: способ, число классов и палитра — заданные или темы по умолчанию;
 * для «своих границ» без заданных берутся границы темы, а если их нет — квантили.
 */
export function buildStyle(theme: ThematicTheme, values: ReadonlyArray<number | null>, options: {
  method?: Exclude<ThematicMethod, 'unique'>
  classes?: number
  palette?: string
  breaks?: number[]
  categories?: number[]
  base?: Partial<ThematicStyle>
} = {}): ThematicStyle {
  const base: ThematicStyle = {
    format: 1,
    theme: theme.key,
    method: 'unique',
    width: options.base?.width ?? 3,
    opacity: options.base?.opacity ?? 0.9,
    show_nulls: options.base?.show_nulls ?? true,
    null_color: options.base?.null_color ?? NULL_COLOR,
  }
  if (theme.kind === 'category') {
    const cats = (options.categories ?? []).slice(0, CATEGORY_COLORS.length * 5)
    return {
      ...base,
      palette: 'category',
      categories: cats.map((value, i) => ({ value, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length]! })),
    }
  }
  const palette = options.palette ?? themePalette(theme)
  const nums = numericValues(values)
  let method = options.method ?? theme.method
  let breaks: number[]
  if (method === 'manual') {
    breaks = uniqueAscending(options.breaks ?? theme.breaks)
    if (!breaks.length) {
      method = 'quantile'
      breaks = quantileBreaks(nums, options.classes ?? DEFAULT_CLASSES, theme.digits)
    }
  } else {
    const classes = Math.min(MAX_CLASSES, Math.max(MIN_CLASSES, options.classes ?? DEFAULT_CLASSES))
    breaks = classBreaks(method, nums, classes, theme.digits)
  }
  breaks = breaks.slice(0, MAX_CLASSES - 1)
  const classes = Math.max(MIN_CLASSES, breaks.length + 1)
  // все значения одинаковые — один класс не бывает: граница на самом значении, второй класс пуст
  if (!breaks.length) breaks = [nums.length ? nums[0]! : 0]
  return { ...base, method, palette, classes, breaks, colors: paletteColors(palette, classes) }
}

/** Цвет значения по стилю (тот же, что даст выражение MapLibre) */
export function colorFor(style: ThematicStyle, value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return style.show_nulls ? style.null_color : null
  if (style.method === 'unique') return style.categories?.find((c) => c.value === value)?.color ?? style.null_color
  const breaks = style.breaks ?? []
  const colors = style.colors ?? []
  let index = 0
  while (index < breaks.length && value >= breaks[index]!) index += 1
  return colors[index] ?? colors[colors.length - 1] ?? style.null_color
}

const HAS_VALUE = ['==', ['typeof', ['get', 'v']], 'number']

/** Выражение `line-color`: `step` по значению (на границе — верхний класс) или `match` по коду справочника */
export function colorExpression(style: ThematicStyle): unknown[] {
  if (style.method === 'unique') {
    const pairs = (style.categories ?? []).flatMap((c) => [c.value, c.color])
    const match = pairs.length ? ['match', ['to-number', ['get', 'v']], ...pairs, style.null_color] : style.null_color
    return ['case', HAS_VALUE, match, style.null_color]
  }
  const colors = style.colors ?? [style.null_color]
  const breaks = style.breaks ?? []
  const step = ['step', ['get', 'v'], colors[0], ...breaks.flatMap((b, i) => [b, colors[i + 1] ?? colors[colors.length - 1]])]
  return ['case', HAS_VALUE, step, style.null_color]
}

/** Фильтр слоя: участки без значения скрыты, если их не показывать */
export const layerFilter = (style: ThematicStyle): unknown[] | undefined => (style.show_nulls ? undefined : HAS_VALUE)

/** Толщина линии по масштабу: на обзорных масштабах тоньше, вблизи толще */
export const widthExpression = (width: number): unknown[] =>
  ['interpolate', ['linear'], ['zoom'], 11, Math.max(1, width * 0.6), 15, width, 18, width * 1.8]

const fmt = (v: number, digits: number): string =>
  v.toLocaleString('ru-RU', { maximumFractionDigits: Math.max(0, digits) })

/** Строки легенды с числом участков в классе; последняя — «нет данных» */
export function legendRows(style: ThematicStyle, values: ReadonlyArray<number | null>, options: {
  digits?: number
  units?: string
  labels?: Record<number, string>
} = {}): ThematicLegendRow[] {
  const digits = options.digits ?? 2
  const units = options.units ? ` ${options.units}` : ''
  const nulls = values.filter((v) => v === null || v === undefined).length
  let rows: ThematicLegendRow[]
  if (style.method === 'unique') {
    const counts = new Map<number, number>()
    for (const v of values) if (typeof v === 'number') counts.set(v, (counts.get(v) ?? 0) + 1)
    const known = new Set((style.categories ?? []).map((c) => c.value))
    rows = (style.categories ?? []).map((c) => ({
      color: c.color, label: options.labels?.[c.value] ?? `код ${c.value}`, count: counts.get(c.value) ?? 0,
    }))
    const other = [...counts.entries()].filter(([v]) => !known.has(v)).reduce((s, [, n]) => s + n, 0)
    if (other) rows.push({ color: style.null_color, label: 'Прочие', count: other })
  } else {
    const breaks = style.breaks ?? []
    const colors = style.colors ?? []
    const counts = new Array<number>(colors.length).fill(0)
    for (const v of values) {
      if (typeof v !== 'number') continue
      let i = 0
      while (i < breaks.length && v >= breaks[i]!) i += 1
      counts[Math.min(i, counts.length - 1)] += 1
    }
    rows = colors.map((color, i) => {
      const lo = breaks[i - 1]
      const hi = breaks[i]
      const label = lo === undefined ? `до ${fmt(hi ?? 0, digits)}${units}`
        : hi === undefined ? `${fmt(lo, digits)}${units} и выше`
          : `${fmt(lo, digits)} – ${fmt(hi, digits)}${units}`
      return { color, label, count: counts[i] ?? 0 }
    })
  }
  if (nulls && style.show_nulls) rows.push({ color: style.null_color, label: 'Нет данных', count: nulls })
  return rows
}
