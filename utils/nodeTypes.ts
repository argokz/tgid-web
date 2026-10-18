/**
 * Расчётный тип узла, заданный напор и подпитка — как в десктопе gid8 (itwin-api database/node_types).
 *
 * Тип узла — таблица карточки по nodeID: Узел (без таблицы), Потребитель (realConsumers),
 * Обобщённый потребитель (generalizedConsumers), Источник тепла (heatSources), Насосная станция
 * (pumpStations), Узел соединения (connectNodes). Это не «вид» узла nodes.nodeTypeID (павильон,
 * камера, ввод…) — тот правится в карточке узла.
 *
 * Заданный напор и подпитка — дополнения к любому узлу (строка в setPressNodes / refillNodes),
 * значения вводятся в их карточке.
 */

export type NodeType = 'US' | 'PR' | 'PO' | 'IS' | 'HS' | 'US2'
export type NodeFlag = 'setpress' | 'refill'

export const NODE_TYPE_ITEMS: readonly { value: NodeType; title: string; icon: string }[] = [
  { value: 'US', title: 'Узел', icon: 'mdi-circle-small' },
  { value: 'PR', title: 'Потребитель', icon: 'mdi-home-outline' },
  { value: 'PO', title: 'Обобщённый потребитель', icon: 'mdi-home-group' },
  { value: 'IS', title: 'Источник тепла', icon: 'mdi-factory' },
  { value: 'HS', title: 'Насосная станция', icon: 'mdi-pump' },
  { value: 'US2', title: 'Узел соединения', icon: 'mdi-circle-double' },
]

export const nodeTypeTitle = (t: string | null | undefined): string =>
  NODE_TYPE_ITEMS.find((i) => i.value === t)?.title ?? String(t ?? '')

export const NODE_FLAG_ITEMS: readonly { value: NodeFlag; title: string; table: string; kind: NodeFlag }[] = [
  { value: 'setpress', title: 'Узел с заданным напором', table: 'setPressNodes', kind: 'setpress' },
  { value: 'refill', title: 'Узел подпитки', table: 'refillNodes', kind: 'refill' },
]

/** Типы, у которых не бывает внутренней схемы потребителя (десктоп: в ПР/ПО нельзя со схемой) */
export const CONSUMER_TYPES: ReadonlySet<NodeType> = new Set<NodeType>(['PR', 'PO'])

/** GET api/v1/topology/node/{id}/type */
export interface NodeTypeInfo {
  node_id: number
  type: NodeType
  label: string
  cards: { table: string; type: NodeType; id: number; name: string | null }[]
  flags: Record<NodeFlag, number | null>
  conflict: boolean
  inner_nodes: number
  version: string | null
}

/** POST api/v1/topology/node/{id}/type (в том числе dry_run) */
export interface NodeTypeChangeResult {
  dry_run?: boolean
  node_id: number
  old_type: NodeType
  new_type: NodeType
  old_label: string
  new_label: string
  removed_cards: { table: string; type: NodeType; id: number; name: string | null }[]
  created_card: { table: string; type: NodeType; id: number } | null
  removed_scheme: { nodes: number; lines: number }
  versions?: Record<string, string>
  operation_id?: number | null
}

/** POST api/v1/topology/node/{id}/flag */
export interface NodeFlagResult {
  dry_run?: boolean
  node_id: number
  flag: NodeFlag
  on: boolean
  id?: number
  removed?: number[]
  operation_id?: number | null
}

/** «Будет удалено: карточка потребителя «Дом 1», внутренняя схема (узлов: 3, участков: 4)» */
export const nodeTypeLosses = (r: NodeTypeChangeResult): string[] => {
  const out: string[] = []
  for (const c of r.removed_cards) {
    out.push(`карточка «${nodeTypeTitle(c.type)}»${c.name ? ` «${c.name}»` : ''} (№${c.id}) со всеми её значениями`)
  }
  if (r.removed_scheme.nodes || r.removed_scheme.lines) {
    out.push(`внутренняя схема: узлов ${r.removed_scheme.nodes}, участков ${r.removed_scheme.lines}`)
  }
  return out
}
