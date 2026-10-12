/**
 * Карточка объекта сети как в десктопе gid8 — из API (`/node/<таблица>/<id узла>`, `/line/<таблица>/<id линии>`).
 *
 * API строит её по описаниям карточек десктопа (tab/gid8, видимость полей по схеме потребителя, подписи),
 * а SQL-view GeoServer id_* несут старые описания (у источника тепла одна вкладка вместо трёх).
 * Здесь ответ API переводится в формат панели атрибутов: tg_tabs (вкладка → раздел → ключи полей),
 * tg_names (ключ → подпись) и значения под теми же ключами. Ключи свои (`tgc_<n>_<поле>`):
 * у участка оба узла дают одноимённые поля, а значения карточки не должны затирать свойства объекта.
 */
import type { Tab } from '~/types'

/** Таблица объекта сети (MVT `tab` / таблица WFS) → вид запроса карточки API */
export const DESKTOP_CARD_KIND: Record<string, 'node' | 'line'> = {
  nodes: 'node',
  heatsources: 'node',
  pumpstations: 'node',
  realconsumers: 'node',
  generalizedconsumers: 'node',
  heatpipesections: 'line',
}

export interface DesktopCardProps {
  tg_tabs: string
  tg_names: string
  /** Участок-пара (подача и обратка, как в десктопе): заголовки колонок и ключ второго значения */
  tg_pair?: string
  values: Record<string, unknown>
}

export interface DesktopCardPair {
  columns: string[]
  keys: Record<string, string>
}

/** tg_pair свойств объекта → пара колонок; null — одна колонка */
export function parseDesktopCardPair(raw: unknown): DesktopCardPair | null {
  if (!raw) return null
  try {
    const pair = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(pair?.columns) && pair.keys ? pair as DesktopCardPair : null
  } catch {
    return null
  }
}

export function desktopCardKind(table: string): 'node' | 'line' | null {
  return DESKTOP_CARD_KIND[table.toLowerCase()] ?? null
}

/**
 * null — в ответе нет полей (объект не найден): остаётся карточка GeoServer.
 * ``columns`` — у участка-пары заголовки колонок; второе значение поля API отдаёт в value2.
 */
export function desktopCardProps(tabs: Tab[] | undefined | null, columns?: string[] | null): DesktopCardProps | null {
  const tgTabs: Array<Record<string, Array<Record<string, string[]>>>> = []
  const names: Record<string, string> = {}
  const values: Record<string, unknown> = {}
  const pairKeys: Record<string, string> = {}
  let n = 0
  for (const tab of tabs ?? []) {
    const sections: Array<Record<string, string[]>> = []
    for (const sub of tab.subsections ?? []) {
      const keys: string[] = []
      for (const f of sub.fields ?? []) {
        const key = `tgc_${n++}_${String(f.field).toLowerCase()}`
        keys.push(key)
        names[key] = f.label
        values[key] = f.value
        if (columns?.length && 'value2' in f) {
          pairKeys[key] = `${key}__2`
          values[pairKeys[key]] = f.value2
        }
      }
      if (keys.length) sections.push({ [sub.title]: keys })
    }
    if (sections.length) tgTabs.push({ [tab.title]: sections })
  }
  if (!n) return null
  const props: DesktopCardProps = { tg_tabs: JSON.stringify(tgTabs), tg_names: JSON.stringify(names), values }
  if (columns?.length && Object.keys(pairKeys).length) {
    props.tg_pair = JSON.stringify({ columns, keys: pairKeys })
  }
  return props
}
