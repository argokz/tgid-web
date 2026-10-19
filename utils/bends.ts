/**
 * Отводы участка → «Местные сопротивления» паспорта (itwin-api database/bends).
 *
 * Сервер считает повороты по геометрии и относит их к классам 22,5° / 30° / 45° / 60° / 90°; здесь —
 * новый список mestn («id|количество|коэффициент») и сумма localResSum для каждого паспорта.
 * Сумма у большинства паспортов введена без списка: её «нерасписанная» часть (сумма минус список)
 * по умолчанию сохраняется и прибавляется к новому списку.
 */
import { mestnResult, parseMestn } from '~/utils/objectCard'

export interface LineBend { vertex: number; angle: number; lng: number; lat: number; cls: number; count: number }

export interface BendClass {
  cls: number
  title: string
  count: number
  default: number
  options: { id: number; name: string; v: number }[]
}

export interface BendPassport { line_id: number; id: number; mestn: string; localressum: number | null; version: string }

/** GET api/v1/topology/line/{id}/bends */
export interface LineBendsData {
  line_id: number
  pair_line_id: number | null
  has_shape: boolean
  vertices: number
  bends: LineBend[]
  classes: BendClass[]
  bend_item_ids: number[]
  items: Record<string, { name: string; v: number }>
  passports: BendPassport[]
  thresholds: { min_angle_deg: number; min_segment_m: number }
}

/** missing — добавить недостающие отводы (по умолчанию); replace — заменить все отводы списка */
export type BendMode = 'missing' | 'replace'

export interface BendRow { id: number; k: number; v: number; name: string; added: number }

export interface BendPlan {
  passport: BendPassport
  before: BendRow[]
  after: BendRow[]
  beforeSum: number
  /** часть суммы, не расписанная по видам (сумма − список), ≥ 0 */
  unlisted: number
  afterSum: number
  list: string
  changed: boolean
}

const round6 = (x: number) => Math.round(x * 1e6) / 1e6

export const planBendResistances = (
  data: LineBendsData,
  passport: BendPassport,
  choice: Record<number, number>,
  mode: BendMode,
  keepUnlisted: boolean,
): BendPlan => {
  const name = (id: number) => data.items[String(id)]?.name ?? `№${id}`
  const current = parseMestn(passport.mestn)
  const before: BendRow[] = [...current].map(([id, r]) => ({ id, k: r.k, v: r.v, name: name(id), added: 0 }))
  const listSum = before.reduce((s, r) => s + r.k * r.v, 0)
  const beforeSum = Number(passport.localressum ?? 0)
  const unlisted = Math.max(0, round6(beforeSum - listSum))
  const bendIds = new Set(data.bend_item_ids)

  let after: BendRow[] = mode === 'replace'
    ? before.filter((r) => !bendIds.has(r.id)).map((r) => ({ ...r }))
    : before.map((r) => ({ ...r }))
  for (const c of data.classes) {
    if (!c.count) continue
    const id = choice[c.cls] ?? c.default
    const v = c.options.find((o) => o.id === id)?.v ?? data.items[String(id)]?.v ?? 0
    // уже в списке отводов этого класса (любого вида) — недостающие добавляются к выбранному виду
    const have = mode === 'replace' ? 0 : after.filter((r) => c.options.some((o) => o.id === r.id)).reduce((s, r) => s + r.k, 0)
    const add = Math.max(0, c.count - have)
    if (!add) continue
    const row = after.find((r) => r.id === id)
    if (row) {
      row.k += add
      row.added += add
    } else {
      after.push({ id, k: add, v, name: name(id), added: add })
    }
  }
  after = after.filter((r) => r.k > 0)
  const res = mestnResult(after)
  const afterSum = round6(res.sum + (keepUnlisted ? unlisted : 0))
  return {
    passport, before, after, beforeSum, unlisted, afterSum, list: res.list,
    changed: res.list !== (passport.mestn ?? '').trim() || Math.abs(afterSum - beforeSum) > 1e-9,
  }
}

/** Правки карточки для PUT card-edit: mestn и localResSum паспорта */
export const bendChanges = (plans: BendPlan[]) => {
  const changed = plans.filter((p) => p.changed)
  return {
    changes: changed.flatMap((p) => [
      { table: 'heatpipesections', id: p.passport.id, field: 'mestn', value: p.list || null },
      { table: 'heatpipesections', id: p.passport.id, field: 'localressum', value: p.afterSum },
    ]),
    versions: Object.fromEntries(changed.map((p) => [`heatpipesections:${p.passport.id}`, p.passport.version])),
  }
}

export const formatCoef = (x: number) => String(round6(x)).replace('.', ',')
