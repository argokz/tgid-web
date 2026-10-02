/**
 * Мастер импорта сети (этап 10): типы API /api/v1/import/* и чистые помощники UI.
 * Режимы: узлы (SHP-точки или таблица X/Y), участки (SHP-линии), координаты узлов (id/код → X/Y).
 */

import { formatApiError } from '~/utils/apiError'

export type NetworkImportMode = 'nodes' | 'lines' | 'coords'
export type NetworkImportCrs = 'auto' | 'wgs84' | 'local' | 'desktop'

export interface NetworkImportTarget {
  key: string
  label: string
  required: boolean
}

export interface NetworkImportInspect {
  kind: 'shp' | 'table'
  columns: string[]
  row_count: number
  sample: Record<string, unknown>[]
  geometry_type: string | null
  crs: string | null
  crs_known: boolean
  sheet: string | null
  sheets: string[]
  warnings: string[]
  targets: NetworkImportTarget[]
  suggested_mapping: Record<string, string>
}

export interface NetworkImportParams {
  mode: NetworkImportMode
  fileid?: number | null
  source_crs: NetworkImportCrs
  mapping: Record<string, string>
  match_by?: 'id' | 'code'
  snap_tolerance_m?: number
  recalc_lengths?: boolean
  build_missing_lines?: boolean
  skip_errors?: boolean
  encoding?: string
  sheet?: string
}

export interface NetworkImportAction {
  row: number
  action: 'create_node' | 'create_line' | 'move_node'
  id: number
  [key: string]: unknown
}

export interface NetworkImportReport {
  mode: NetworkImportMode
  dry_run: boolean
  total_rows: number
  ok_rows: number
  fileid: number | null
  created_nodes: number
  created_lines: number
  updated_nodes: number
  recalculated_lines: number
  built_lines: number
  errors: { row: number; message: string }[]
  actions: NetworkImportAction[]
  actions_truncated: boolean
  warnings: string[]
  operation_id?: number | null
}

export const IMPORT_MODES: { value: NetworkImportMode; title: string; hint: string; accept: string }[] = [
  {
    value: 'nodes',
    title: 'Узлы',
    hint: 'Точки SHP или таблица Excel/CSV с X/Y → новые узлы фрагмента (код, наименование, отметка)',
    accept: '.zip,.shp,.shx,.dbf,.prj,.cpg,.xlsx,.xlsm,.csv,.txt',
  },
  {
    value: 'lines',
    title: 'Участки',
    hint: 'Линии SHP → участки: концы привязываются к узлам фрагмента в допуске, иначе создаются узлы',
    accept: '.zip,.shp,.shx,.dbf,.prj,.cpg',
  },
  {
    value: 'coords',
    title: 'Координаты узлов',
    hint: 'Таблица «id или код узла → X, Y»: перенос узлов, концы участков и длины пересчитываются',
    accept: '.xlsx,.xlsm,.csv,.txt,.zip,.shp,.shx,.dbf,.prj,.cpg',
  },
]

export const IMPORT_CRS_OPTIONS: { value: NetworkImportCrs; title: string }[] = [
  { value: 'auto', title: 'Из файла (.prj)' },
  { value: 'wgs84', title: 'WGS84: долгота / широта' },
  { value: 'local', title: 'Местная система (SRID 9998), м' },
  { value: 'desktop', title: 'Координаты десктопа (x/y узлов, см)' },
]

/** Допустимые системы координат: SHP с .prj — «из файла»; таблица — только явная система */
export const crsOptionsFor = (inspect: NetworkImportInspect | null) =>
  IMPORT_CRS_OPTIONS.filter((o) => {
    if (!inspect) return true
    if (inspect.kind === 'shp') return inspect.crs_known ? o.value === 'auto' : o.value === 'wgs84' || o.value === 'local'
    return o.value !== 'auto'
  })

export const defaultCrsFor = (inspect: NetworkImportInspect): NetworkImportCrs =>
  inspect.kind === 'shp' ? (inspect.crs_known ? 'auto' : 'local') : 'local'

/** Пустые сопоставления не отправляются */
export const cleanMapping = (mapping: Record<string, string | null | undefined>): Record<string, string> =>
  Object.fromEntries(Object.entries(mapping).filter(([, v]) => typeof v === 'string' && v !== '')) as Record<string, string>

export const missingRequired = (targets: NetworkImportTarget[], mapping: Record<string, string | null | undefined>): string[] =>
  targets.filter((t) => t.required && !mapping[t.key]).map((t) => t.label)

export const importSummary = (r: NetworkImportReport): string => {
  const parts: string[] = []
  if (r.created_nodes) parts.push(`узлов создано: ${r.created_nodes}`)
  if (r.created_lines) parts.push(`участков создано: ${r.created_lines}`)
  if (r.updated_nodes) parts.push(`узлов перенесено: ${r.updated_nodes}`)
  if (r.recalculated_lines) parts.push(`длин пересчитано: ${r.recalculated_lines}`)
  if (r.built_lines) parts.push(`геометрий участков построено: ${r.built_lines}`)
  if (!parts.length) parts.push('изменений нет')
  const errors = r.errors.length ? `, строк с ошибками: ${r.errors.length}` : ''
  return `${r.dry_run ? 'Будет: ' : 'Готово: '}${parts.join(', ')}${errors} (строк: ${r.total_rows})`
}

const ACTION_LABELS: Record<string, string> = {
  create_node: 'новый узел',
  create_line: 'новый участок',
  move_node: 'перенос узла',
}

export const describeImportAction = (a: NetworkImportAction): string => {
  const base = `${ACTION_LABELS[a.action] ?? a.action} ${a.id}`
  if (a.action === 'create_line') {
    const created = Array.isArray(a.new_nodes) && a.new_nodes.length ? `, новые узлы ${a.new_nodes.join(', ')}` : ''
    return `${base}: ${a.nodeid1} → ${a.nodeid2}, ${a.length} м${created}`
  }
  if (a.action === 'move_node') {
    const shift = a.had_no_shape ? 'геометрия задана впервые' : `сдвиг ${a.shift_m ?? '?'} м`
    return `${base}: ${shift}, длин пересчитано ${a.recalculated_lines ?? 0}`
  }
  return a.code ? `${base} (код ${a.code})` : base
}

/** Текст ошибки API; для 422 row_errors — отчёт с ошибками строк */
export const importApiError = (e: any): { message: string; report: NetworkImportReport | null } => {
  const detail = e?.data?.detail ?? e?.response?._data?.detail
  if (detail && typeof detail === 'object' && detail.code === 'row_errors') {
    return { message: 'Есть строки с ошибками — исправьте файл или включите «пропустить строки с ошибками»', report: detail.report }
  }
  if (typeof detail === 'string') return { message: detail, report: null }
  if (detail?.message) return { message: detail.message, report: null }
  return { message: formatApiError(e, 'Не удалось выполнить импорт'), report: null }
}
