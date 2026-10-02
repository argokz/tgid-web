/**
 * Пункты шапки приложения (layouts/default.vue). Один список на две раскладки:
 * кнопки в шапке на широком экране и выдвижное меню (гамбургер) на узком.
 * Права те же, что у кнопок шапки: «Расчет» — calculator+ (сервер проверяет то же).
 */
import type { Permissions } from '~/utils/permissions'

/**
 * Шапка с кнопками занимает ~900 px: брендинг 133 + пункты ~760 («Скрыть протокол»
 * длиннее «Протокол») + аватар 56. Уже 1000 px пункты прячутся в меню, чтобы
 * шапка не обрезалась на планшете (768–1024) и при другом шрифте (QA F1, F57).
 */
export const HEADER_NAV_MIN_WIDTH = 1000

export function isHeaderNavCollapsed(viewportWidth: number): boolean {
  return viewportWidth > 0 && viewportWidth < HEADER_NAV_MIN_WIDTH
}

export type ExportFormat = 'shp' | 'dxf' | 'geojson' | 'geojson-attrs'

export type HeaderAction =
  | { kind: 'route'; to: string }
  | { kind: 'calculation' }
  | { kind: 'protocol' }
  | { kind: 'tools' }
  | { kind: 'export'; format: ExportFormat }
  | { kind: 'excel'; docType: string }

export interface HeaderMenuItem {
  id: string
  title: string
  subtitle?: string
  icon: string
  action?: HeaderAction
  children?: HeaderMenuItem[]
}

const EXPORT_ITEMS: HeaderMenuItem[] = [
  { id: 'export-shp', title: 'SHP (узлы и участки, zip)', icon: 'mdi-export', action: { kind: 'export', format: 'shp' } },
  { id: 'export-dxf', title: 'DXF (линии участков)', icon: 'mdi-vector-polyline', action: { kind: 'export', format: 'dxf' } },
  { id: 'export-geojson', title: 'GeoJSON (геометрия и паспорт)', icon: 'mdi-code-json', action: { kind: 'export', format: 'geojson' } },
  {
    id: 'export-geojson-attrs',
    title: 'GeoJSON с атрибутами (L, D, K_E)',
    subtitle: 'Для ZuluGIS/QGIS: короткие имена полей',
    icon: 'mdi-code-json',
    action: { kind: 'export', format: 'geojson-attrs' },
  },
]

const EXCEL_ITEMS: HeaderMenuItem[] = [
  { id: 'excel-ut', title: 'Участки теплопроводов', icon: 'mdi-pipe', action: { kind: 'excel', docType: 'ut' } },
  { id: 'excel-zd', title: 'Задвижки и арматура', icon: 'mdi-valve', action: { kind: 'excel', docType: 'zd' } },
  { id: 'excel-bp', title: 'Байпасы', icon: 'mdi-dip-switch', action: { kind: 'excel', docType: 'bp' } },
  { id: 'excel-ns', title: 'Насосные агрегаты', icon: 'mdi-water-pump', action: { kind: 'excel', docType: 'ns' } },
  { id: 'excel-pt', title: 'Потребители', icon: 'mdi-home-city', action: { kind: 'excel', docType: 'pt' } },
  { id: 'excel-tu', title: 'Технические условия', icon: 'mdi-file-certificate-outline', action: { kind: 'excel', docType: 'tu' } },
]

export interface HeaderMenuState {
  protocolOpen?: boolean
}

export function buildHeaderMenu(
  permissions: Pick<Permissions, 'canCalculate'>,
  state: HeaderMenuState = {},
): HeaderMenuItem[] {
  const items: HeaderMenuItem[] = [
    { id: 'map', title: 'Карта', icon: 'mdi-map', action: { kind: 'route', to: '/' } },
  ]
  if (permissions.canCalculate) {
    items.push({ id: 'calculation', title: 'Расчет', icon: 'mdi-calculator-variant', action: { kind: 'calculation' } })
  }
  items.push(
    {
      id: 'protocol',
      title: state.protocolOpen ? 'Скрыть протокол' : 'Протокол',
      icon: 'mdi-console-line',
      action: { kind: 'protocol' },
    },
    { id: 'tools', title: 'Инструменты', icon: 'mdi-toolbox-outline', action: { kind: 'tools' } },
    { id: 'export', title: 'Экспорт', icon: 'mdi-export', children: EXPORT_ITEMS },
    { id: 'excel', title: 'Ведомости Excel', icon: 'mdi-file-excel', children: EXCEL_ITEMS },
  )
  return items
}
