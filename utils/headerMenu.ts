/**
 * Пункты шапки приложения (layouts/default.vue). Один список на две раскладки:
 * кнопки в шапке на широком экране и выдвижное меню (гамбургер) на узком.
 * Права те же, что у кнопок шапки: «Расчёт» — calculator+ (сервер проверяет то же).
 */
import type { Permissions } from '~/utils/permissions'

/**
 * Шапка с кнопками (этап 10, без капса, замер 27.10 на Астане): навигация кончается на 615 px («Скрыть протокол»
 * длиннее «Протокол» ещё на ~40), справа — лупа и две иконки ~130 (поле поиска 280 px — только от 1280).
 * Итого ≈ 800 px: пункты помещаются с 960 — границы телефонной подачи (utils/breakpoints.ts). Уже порога пункты
 * прячутся в меню, чтобы шапка не обрезалась (QA F1, F57).
 */
export const HEADER_NAV_MIN_WIDTH = 960

export function isHeaderNavCollapsed(viewportWidth: number): boolean {
  return viewportWidth > 0 && viewportWidth < HEADER_NAV_MIN_WIDTH
}

export type ExportFormat = 'gpkg' | 'fgb' | 'shp' | 'dxf' | 'geojson' | 'geojson-attrs'

/** Выгрузки сети через /api/export/network (database/vector_export.py) */
export const NETWORK_FILE_FORMATS = ['gpkg', 'fgb', 'shp'] as const
export type NetworkFileFormat = (typeof NETWORK_FILE_FORMATS)[number]

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
  /** Подгруппа внутри подменю — заголовок перед первым пунктом группы */
  group?: string
  /** Где пункт в шапке: в навигации слева (по умолчанию) или иконкой справа; в выдвижном меню — все */
  placement?: 'nav' | 'end'
}

const EXPORT_ITEMS: HeaderMenuItem[] = [
  {
    id: 'export-gpkg',
    title: 'GeoPackage (узлы и участки)',
    subtitle: 'Один файл для QGIS и ArcGIS: Ду и длина по паспорту',
    icon: 'mdi-export',
    action: { kind: 'export', format: 'gpkg' },
  },
  { id: 'export-fgb', title: 'FlatGeobuf (узлы и участки, zip)', icon: 'mdi-export', action: { kind: 'export', format: 'fgb' } },
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
  { id: 'excel-zd', title: 'Задвижки', icon: 'mdi-valve', action: { kind: 'excel', docType: 'zd' } },
  { id: 'excel-bp', title: 'Байпасы', icon: 'mdi-dip-switch', action: { kind: 'excel', docType: 'bp' } },
  { id: 'excel-ns', title: 'Насосные агрегаты', icon: 'mdi-water-pump', action: { kind: 'excel', docType: 'ns' } },
  { id: 'excel-pt', title: 'Потребители', icon: 'mdi-home-city', action: { kind: 'excel', docType: 'pt' } },
  { id: 'excel-tu', title: 'Технические условия', icon: 'mdi-file-certificate-outline', action: { kind: 'excel', docType: 'tu' } },
]

export interface HeaderMenuState {
  protocolOpen?: boolean
}

/**
 * Пункты шапки (этап 10, docs/ui-felt-audit.md): «Карта» убрана — страница одна, пункт ничего не делал;
 * «Экспорт» и «Ведомости Excel» — одна «Выгрузка» с подгруппами (до любого формата по-прежнему два клика);
 * «Инструменты» — иконкой справа (второй вход в колонке у карты убран).
 */
export function buildHeaderMenu(
  permissions: Pick<Permissions, 'canCalculate'>,
  state: HeaderMenuState = {},
): HeaderMenuItem[] {
  const items: HeaderMenuItem[] = []
  if (permissions.canCalculate) {
    items.push({ id: 'calculation', title: 'Расчёт', icon: 'mdi-calculator-variant', action: { kind: 'calculation' } })
  }
  items.push(
    {
      id: 'protocol',
      title: state.protocolOpen ? 'Скрыть протокол' : 'Протокол',
      icon: 'mdi-console-line',
      action: { kind: 'protocol' },
    },
    {
      id: 'export',
      title: 'Выгрузка',
      icon: 'mdi-export',
      children: [
        ...EXPORT_ITEMS.map((item) => ({ ...item, group: 'Геоданные' })),
        ...EXCEL_ITEMS.map((item) => ({ ...item, group: 'Ведомости Excel' })),
      ],
    },
    { id: 'tools', title: 'Инструменты', icon: 'mdi-toolbox-outline', action: { kind: 'tools' }, placement: 'end' },
  )
  return items
}

export interface HeaderMenuGroup {
  /** Заголовок подгруппы; у пунктов без группы — пусто */
  title?: string
  items: HeaderMenuItem[]
}

/** Пункты подменю по подгруппам, в исходном порядке: соседние пункты одной группы — вместе */
export function groupMenuChildren(children: HeaderMenuItem[]): HeaderMenuGroup[] {
  const groups: HeaderMenuGroup[] = []
  for (const child of children) {
    const last = groups[groups.length - 1]
    if (last && last.title === child.group) last.items.push(child)
    else groups.push({ title: child.group, items: [child] })
  }
  return groups
}
