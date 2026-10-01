/**
 * Диагностика топологии фрагмента (GET api/v1/topology/diagnostics, QA F35):
 * подписи, цвета и иконки типов проблем. Иконки — только из utils/mdiSvgPaths.ts.
 */
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
