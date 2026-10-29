/**
 * Диагностика топологии фрагмента (GET api/v1/topology/diagnostics, QA F35) и проверка после
 * правки (GET api/v1/topology/operations/{id}/check): подписи, цвета и иконки типов проблем.
 * Иконки — только из utils/mdiSvgPaths.ts.
 */
import { pluralRu } from './pluralRu'

export interface TopologyFaultMeta {
  label: string;
  color: string;
  icon: string;
}

export const TOPOLOGY_FAULT_META: Record<string, TopologyFaultMeta> = {
  dangling_line: { label: 'Участок на снятый узел', color: 'red-darken-2', icon: 'mdi-link-variant-off' },
  zero_length_line: { label: 'Замкнутый участок', color: 'deep-purple-darken-2', icon: 'mdi-ray-start-end' },
  duplicate_line: { label: 'Повторяющийся участок', color: 'pink-darken-2', icon: 'mdi-vector-polyline' },
  cross_fragment_line: { label: 'Участок между фрагментами', color: 'indigo-darken-1', icon: 'mdi-swap-horizontal' },
  orphaned_node: { label: 'Изолированный узел', color: 'orange-darken-2', icon: 'mdi-map-marker-off' },
  no_source_component: { label: 'Часть сети без источника', color: 'brown-darken-1', icon: 'mdi-source-branch' },
  dangling_node: { label: 'Тупиковый узел', color: 'amber-darken-3', icon: 'mdi-vector-line' },
  geometry_mismatch: { label: 'Геометрия не у узлов', color: 'blue-grey-darken-1', icon: 'mdi-ruler' },
  // правила связности (проверка после правки)
  node_type_conflict: { label: 'Узел в нескольких типах', color: 'red-darken-2', icon: 'mdi-card-multiple-outline' },
  unsnapped_end: { label: 'Конец не привязан к сети', color: 'deep-orange-darken-2', icon: 'mdi-magnet' },
  no_supply: { label: 'Узлы без питания', color: 'brown-darken-1', icon: 'mdi-power-plug-off' },
}

const FALLBACK: TopologyFaultMeta = { label: 'Проблема', color: 'grey', icon: 'mdi-alert' }

export function topologyFaultMeta(type: string): TopologyFaultMeta {
  return TOPOLOGY_FAULT_META[type] ?? FALLBACK
}

export function topologyFaultTitle(fault: { type: string; object_type?: string; object_id?: number | string }): string {
  const what = fault.object_type === 'node' ? 'узел' : 'участок'
  return `${topologyFaultMeta(fault.type).label}: ${what} #${fault.object_id ?? '?'}`
}

/** Непустые счётчики в порядке сервера: [{type, label, count}] */
export function topologyFaultCounts(counts: Record<string, number> | null | undefined) {
  return Object.entries(counts || {})
    .filter(([, n]) => n > 0)
    .map(([type, count]) => ({ type, count, ...topologyFaultMeta(type) }))
}

/** «1 ошибка, 2 предупреждения» — итог проверки правки; пусто — замечаний нет */
export function topologyCheckSummary(check: { total: number; errors: number } | null | undefined): string {
  if (!check || check.total <= 0) return ''
  const warnings = check.total - check.errors
  const parts: string[] = []
  if (check.errors > 0) parts.push(`${check.errors} ${pluralRu(check.errors, ['ошибка', 'ошибки', 'ошибок'])}`)
  if (warnings > 0) parts.push(`${warnings} ${pluralRu(warnings, ['предупреждение', 'предупреждения', 'предупреждений'])}`)
  return parts.join(', ')
}
