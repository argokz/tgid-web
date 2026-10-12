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
  values: Record<string, unknown>
}

export function desktopCardKind(table: string): 'node' | 'line' | null {
  return DESKTOP_CARD_KIND[table.toLowerCase()] ?? null
}

/** null — в ответе нет полей (объект не найден): остаётся карточка GeoServer */
export function desktopCardProps(tabs: Tab[] | undefined | null): DesktopCardProps | null {
  const tgTabs: Array<Record<string, Array<Record<string, string[]>>>> = []
  const names: Record<string, string> = {}
  const values: Record<string, unknown> = {}
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
      }
      if (keys.length) sections.push({ [sub.title]: keys })
    }
    if (sections.length) tgTabs.push({ [tab.title]: sections })
  }
  if (!n) return null
  return { tg_tabs: JSON.stringify(tgTabs), tg_names: JSON.stringify(names), values }
}
