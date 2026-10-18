/**
 * Схема присоединения потребителя (поле realConsumers.schemeNum) — как в десктопе
 * (gid8 property/potr_fun.cpp: readCxema, get_nomer, fun_schemeNum; окно CPotrcxemaDialog).
 *
 * Номер схемы «[C]n1.n2»: n1 — вид ГВС (1 — нет, 2 — только вентиляция, 3 — параллельная,
 * 4 — смешанная, 5 — последовательная, 15 — предвключённая, 6/7 — открытая из подачи/обратки),
 * n2 — отопление (зависимое, элеваторное, независимое) + вентиляция + рециркуляция; «C» — без отопления.
 * По схеме десктоп прячет поля карточки (realConsumers.vis: ключи elev, otop, gvs, gvs_all, vent, rez).
 */

export type GvsType = 'op' | 'oo' | 'pr' | 'sm' | 'ps' | 'pw' | ''

export interface Cxema {
  /** элеваторная зависимая система отопления */
  elev: '0' | '1'
  /** z — зависимая, n — независимая, '' — без отопления */
  otop: 'z' | 'n' | ''
  gvs: GvsType
  gvs_all: '1' | ''
  vent: '0' | '1' | ''
  rez: '0' | '1' | ''
}

const SCHEME_RE = /^(C?)([0-9]+)\.([0-9]+)$/
const GVS_BY_N1: Record<number, GvsType> = { 5: 'ps', 4: 'sm', 3: 'pr', 15: 'pw', 6: 'op', 7: 'oo' }

/** readCxema десктопа: признаки схемы; null — номер не задан (видимость тогда не меняется) */
export function readCxema(scheme: unknown): Cxema | null {
  const s = scheme === null || scheme === undefined ? '' : String(scheme).trim()
  if (s === '') return null
  const r: Cxema = { elev: '0', otop: '', gvs: '', gvs_all: '', vent: '', rez: '' }
  const m = SCHEME_RE.exec(s)
  if (!m) return r
  const c1 = m[1]
  const n1 = Number(m[2])
  const n2 = Number(m[3])
  if (s === '2.1') return { ...r, vent: '1' } // только вентиляция
  let el = false
  if ([5, 6, 7, 8].includes(n2) || s === '1.3' || s === '1.4') {
    r.otop = 'z'
    el = true
  } else if ([1, 2, 3, 4].includes(n2)) {
    r.otop = 'z'
  }
  if ([9, 10, 11, 12].includes(n2) || s === '1.5' || s === '1.6') {
    r.otop = 'n'
    el = false
  }
  if (c1) r.otop = ''
  r.elev = el ? '1' : '0'
  r.gvs = GVS_BY_N1[n1] ?? ''
  if (r.gvs) r.gvs_all = '1'
  const vent = (n1 > 2 && [3, 4, 7, 8, 11, 12].includes(n2)) || (n1 === 1 && [2, 4, 6].includes(n2)) || (n1 === 2 && n2 === 1)
  r.vent = vent ? '1' : '0'
  r.rez = n1 > 2 && n2 % 2 === 0 && (r.gvs === 'op' || r.gvs === 'oo') ? '1' : '0'
  return r
}

/** Состояние окна выбора схемы (CPotrcxemaDialog) */
export interface SchemeOptions {
  /** есть отопление */
  otop: boolean
  /** отопление зависимое (иначе независимое) */
  dependent: boolean
  /** зависимое элеваторное */
  elevator: boolean
  /** есть ГВС */
  gvs: boolean
  /** вид ГВС: op — открытая из подачи, oo — из обратки, pr/sm/ps/pw — закрытая параллельная/смешанная/
   * последовательная/предвключённая */
  gvsType: Exclude<GvsType, ''>
  vent: boolean
  /** рециркуляция (только открытая ГВС) */
  rez: boolean
}

/** Окно десктопа по текущему номеру (fun_schemeNum: m_bOtopl, m_radioZavis, …) */
export function schemeOptions(scheme: unknown): SchemeOptions {
  const cx = readCxema(scheme)
  return {
    otop: Boolean(cx?.otop),
    dependent: (cx?.otop ?? '') !== 'n',
    elevator: cx?.elev === '1',
    gvs: Boolean(cx?.gvs),
    gvsType: (cx?.gvs || 'pr') as SchemeOptions['gvsType'],
    vent: cx?.vent === '1',
    rez: cx?.rez === '1',
  }
}

/** Рециркуляция доступна при отоплении и открытой ГВС (potrcxemaDialogCallback) */
export const rezAllowed = (o: SchemeOptions): boolean => o.otop && o.gvs && (o.gvsType === 'op' || o.gvsType === 'oo')

const N1_BY_GVS: Record<SchemeOptions['gvsType'], number> = { op: 6, oo: 7, pr: 3, sm: 4, ps: 5, pw: 15 }

/** get_nomer десктопа: номер схемы по выбору в окне */
export function schemeNumber(o: SchemeOptions): string {
  const vent = o.vent ? 1 : 0
  const otopN = o.otop && !o.dependent
  const otopZ = o.otop && o.dependent
  const elev = o.elevator
  const rez = o.rez && rezAllowed(o) ? 1 : 0
  if (!o.otop && o.vent && !o.gvs) return '2.1'
  const n1 = o.gvs ? N1_BY_GVS[o.gvsType] : 1
  let n2 = o.otop ? 0 : 1
  if (n1 > 2) {
    if (otopZ) n2 = 1
    if (otopZ && elev) n2 = 5
    if (otopN) n2 = 9
    if (vent) n2 += 2
    if (rez) n2 += 1
  }
  if (n1 === 1) {
    if (otopZ) n2 = 1
    if (otopZ && elev) n2 = 3
    if (otopN) n2 = 5
    if (vent) n2 += 1
  }
  return `${o.otop ? '' : 'C'}${n1}.${n2}`
}

// Поля нагрузок по признаку схемы (fun_schemeNum): расчётные и договорные
const OTOP_LOAD = { z: 'calcHLdep', n: 'calcHLindep' } as const
const OTOP_CONTRACT = { z: 'contCalcHLdep', n: 'contcalcHLindep' } as const
const GVS_LOAD: Record<Exclude<GvsType, ''>, string> = {
  pr: 'avgHLGVScloseParall', sm: 'avgHLGVScloseMix', ps: 'avgHLGVScloseConseq', pw: 'avgHLGVSclosePreON',
  op: 'avgHLGVSopenFlow', oo: 'avgHLGVSopenRet',
}
const GVS_CONTRACT: Record<Exclude<GvsType, ''>, string> = {
  pr: 'contAvgHLGVScloseParall', sm: 'contAvgHLGVScloseMix', ps: 'contAvgHLGVScloseConseq', pw: 'contAvgHLGVSclosePreON',
  op: 'contAvgHLGVSopenFlow', oo: 'contAvgHLGVSopenRet',
}
/** Поля, которые десктоп обнуляет при смене схемы, прежде чем перенести нагрузки */
export const SCHEME_LOAD_FIELDS: readonly string[] = [
  ...Object.values(OTOP_LOAD), ...Object.values(GVS_LOAD), 'circHLosOpen', 'calcHLventil',
  ...Object.values(OTOP_CONTRACT), ...Object.values(GVS_CONTRACT),
]

const num = (v: unknown): number => {
  const n = Number(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/**
 * Смена схемы как fun_schemeNum десктопа: нагрузки старой схемы (отопление, ГВС, рециркуляция,
 * вентиляция; расчётные и договорные) переходят в поля новой, остальные поля нагрузок — 0.
 * values — значения карточки по lower-имени поля. → {поле: значение}, включая schemeNum.
 */
export function schemeChangeValues(values: Record<string, unknown>, oldScheme: unknown, newScheme: string): Record<string, unknown> {
  const v = (f: string) => num(values[f.toLowerCase()])
  const was = readCxema(oldScheme)
  const otop = was?.otop ? v(OTOP_LOAD[was.otop]) : 0
  const gv = was?.gvs ? v(GVS_LOAD[was.gvs]) : 0
  const rez = was?.rez === '1' ? v('circHLosOpen') : 10
  const vent = was?.vent === '1' ? v('calcHLventil') : 0
  const dogOtop = was?.otop ? v(OTOP_CONTRACT[was.otop]) : 0
  const dogGv = was?.gvs ? v(GVS_CONTRACT[was.gvs]) : 0

  const out: Record<string, unknown> = Object.fromEntries(SCHEME_LOAD_FIELDS.map((f) => [f, 0]))
  const now = readCxema(newScheme)
  if (now?.otop) {
    out[OTOP_LOAD[now.otop]] = otop
    out[OTOP_CONTRACT[now.otop]] = dogOtop
  }
  if (now?.gvs) {
    out[GVS_LOAD[now.gvs]] = gv
    out[GVS_CONTRACT[now.gvs]] = dogGv
  }
  if (now?.rez === '1') out.circHLosOpen = rez
  if (now?.vent === '1') out.calcHLventil = vent
  out.schemeNum = newScheme
  return out
}

/** Ключи видимости realConsumers.vis по номеру схемы (setPR десктопа); {} — номер не задан */
export function schemeVisValues(scheme: unknown): Record<string, string> {
  const cx = readCxema(scheme)
  if (!cx) return {}
  return { elev: cx.elev, otop: cx.otop, gvs: cx.gvs, gvs_all: cx.gvs_all, vent: cx.vent, rez: cx.rez }
}

/** Подпись схемы для окна: что входит */
export function schemeSummary(scheme: unknown): string {
  const cx = readCxema(scheme)
  if (!cx) return 'Схема не задана'
  const parts: string[] = []
  if (cx.otop === 'z') parts.push(cx.elev === '1' ? 'отопление зависимое элеваторное' : 'отопление зависимое')
  if (cx.otop === 'n') parts.push('отопление независимое')
  const gvs: Record<string, string> = {
    op: 'ГВС открытая из подачи', oo: 'ГВС открытая из обратки', pr: 'ГВС параллельная', sm: 'ГВС смешанная',
    ps: 'ГВС последовательная', pw: 'ГВС предвключённая',
  }
  if (cx.gvs) parts.push(gvs[cx.gvs])
  if (cx.vent === '1') parts.push('вентиляция')
  if (cx.rez === '1') parts.push('рециркуляция')
  return parts.length ? parts.join(', ') : 'без нагрузок'
}
