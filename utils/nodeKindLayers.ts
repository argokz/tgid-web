/**
 * Слои «Источники», «Насосные», «Потребители», «Обобщённые потребители».
 *
 * Отдельных слоёв для них на GeoServer нет (и в десктопе нет): все узлы рисует `uzel`, его SQL
 * вычисляет тип узла `code` по таблицам heatsources / pumpstations / realconsumers /
 * generalizedconsumers. Пункты каталога с этими именами строятся как `uzel` с фильтром по коду
 * (CQL_FILTER на GeoServer и фильтр MapLibre), а сам `uzel` тогда показывает остальные узлы.
 * Карточка объекта не меняется: тайл `uzel` отдаёт `tab`, данные — из view `id_<tab>`.
 */
import { isExpressionFilter } from '~/utils/mapFragmentFilter'

export const NODE_BASE_LAYER = 'uzel'

/** Коды `uzel.code` по таблице объекта (SQL слоя uzel на GeoServer) */
export const NODE_KIND_CODES: Record<string, string[]> = {
  heatsources: ['IS'],
  pumpstations: ['NS'],
  realconsumers: ['PR', 'EL', 'NZ'],
  generalizedconsumers: ['PO'],
}

export function nodeKindCodes(source: string): string[] | null {
  return NODE_KIND_CODES[String(source || '').toLowerCase()] ?? null
}

/** CQL GeoServer: узлы с кодами (или все, кроме них) */
export function nodeCodesCql(codes: string[], exclude = false): string {
  const list = codes.map((c) => `'${c.replace(/'/g, "''")}'`).join(',')
  return `code ${exclude ? 'NOT IN' : 'IN'} (${list})`
}

/** Объединение CQL-условий через AND; пусто — undefined */
export function combineCql(...parts: Array<string | null | undefined>): string | undefined {
  const items = parts.map((p) => String(p ?? '').trim()).filter(Boolean)
  if (!items.length) return undefined
  return items.length === 1 ? items[0] : items.map((p) => `(${p})`).join(' AND ')
}

/** Фильтр MapLibre по коду узла в синтаксисе исходного фильтра подслоя (legacy или выражение) */
export function combineWithNodeCodes(original: unknown, codes: string[], exclude = false): any {
  const expression = original != null && isExpressionFilter(original)
  const codeFilter = expression
    ? (exclude
      ? ['!', ['in', ['get', 'code'], ['literal', codes]]]
      : ['in', ['get', 'code'], ['literal', codes]])
    : [exclude ? '!in' : 'in', 'code', ...codes]
  return original != null ? ['all', original, codeFilter] : codeFilter
}

/**
 * Коды узла, которыми фильтр подслоя ограничивает `code` (null — не ограничивает).
 * Понимает legacy (`["==","code","IS"]`, `["in","code",...]`) и выражения
 * (`["==",["get","code"],"IS"]`, `["in",["get","code"],["literal",[...]]]`), `all` — пересечение, `any` — объединение.
 */
export function filterCodeSet(filter: unknown): Set<string> | null {
  if (!Array.isArray(filter) || filter.length === 0) return null
  const [op, a, b] = filter
  const isCodeRef = (x: unknown) => x === 'code' || (Array.isArray(x) && x[0] === 'get' && x[1] === 'code' && x.length === 2)
  if (op === '==' && filter.length === 3) {
    if (isCodeRef(a) && (typeof b === 'string' || typeof b === 'number')) return new Set([String(b)])
    if (isCodeRef(b) && (typeof a === 'string' || typeof a === 'number')) return new Set([String(a)])
    return null
  }
  if (op === 'in' && isCodeRef(a)) {
    if (a === 'code') return new Set(filter.slice(2).map(String))
    if (Array.isArray(b) && b[0] === 'literal' && Array.isArray(b[1])) return new Set(b[1].map(String))
    return null
  }
  if (op === 'all') {
    let acc: Set<string> | null = null
    for (const part of filter.slice(1)) {
      const s = filterCodeSet(part)
      if (!s) continue
      const prev: Set<string> | null = acc
      if (!prev) {
        acc = s
        continue
      }
      const both = new Set<string>()
      prev.forEach((c) => {
        if (s.has(c)) both.add(c)
      })
      acc = both
    }
    return acc
  }
  if (op === 'any') {
    const acc = new Set<string>()
    for (const part of filter.slice(1)) {
      const s = filterCodeSet(part)
      if (!s) return null
      s.forEach((c) => acc.add(c))
    }
    return acc
  }
  return null
}

/**
 * Может ли подслой стиля uzel показать хоть один узел источника: у «Источников» (только IS)
 * правила ТК, НС, потребителей пустые, у uzel (без IS/NS/…) — пустые правила этих типов.
 * Такие подслои не создаются: стиль uzel даёт 63 подслоя на каждый из 5 источников узлов.
 */
export function layerCanMatchNodeCodes(filter: unknown, codes: string[], exclude = false): boolean {
  const own = filterCodeSet(filter)
  if (!own) return true
  let can = false
  own.forEach((c) => {
    if (exclude ? !codes.includes(c) : codes.includes(c)) can = true
  })
  return can
}

/** Добавить CQL_FILTER к URL тайлов (MVT через WMS GetMap). У WMTS/GWC параметр не поддержан — null */
export function withCqlParam(url: string, cql: string | undefined): string | null {
  if (!cql) return url
  if (!/REQUEST=GetMap/i.test(url)) return null
  return `${url}${url.includes('?') ? '&' : '?'}CQL_FILTER=${encodeURIComponent(cql)}`
}
