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

/** Добавить CQL_FILTER к URL тайлов (MVT через WMS GetMap). У WMTS/GWC параметр не поддержан — null */
export function withCqlParam(url: string, cql: string | undefined): string | null {
  if (!cql) return url
  if (!/REQUEST=GetMap/i.test(url)) return null
  return `${url}${url.includes('?') ? '&' : '?'}CQL_FILTER=${encodeURIComponent(cql)}`
}
