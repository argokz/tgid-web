/**
 * Порядок слоёв сети на карте (MapLibre), как в ГИС: площади (здания) → линии (участки) →
 * точки (узлы, камеры) → подписи. Внутри группы — порядок списка слоёв.
 *
 * Раньше точки поднимались над линиями, а здания и участки шли только по списку; новый или
 * перезагруженный слой до выравнивания лежал поверх всего (участки поверх узлов и зданий), а при
 * выравнивании весь блок сети уезжал на самый верх — над слоями редактора и выделения.
 */

export interface StackLayer {
  id: string
  type: string
  layout?: Record<string, any>
}

/** Группа слоя: 0 — площади и растры, 1 — линии, 2 — точки (значки), 3 — подписи */
export function stackRank(layer: StackLayer): number {
  switch (layer.type) {
    case 'line':
      return 1
    case 'circle':
      return 2
    case 'symbol':
      return layer.layout?.['icon-image'] != null ? 2 : 3
    default:
      return 0
  }
}

export interface StackMove {
  id: string
  /** перед каким слоем поставить; undefined — наверх */
  beforeId: string | undefined
}

/**
 * Перестановки для блока слоёв сети.
 * @param style слои карты в текущем порядке (снизу вверх)
 * @param groups id слоёв сети по слоям списка, снизу вверх (последний — верх списка)
 * → ходы moveLayer (пусто — порядок уже верный). Блок встаёт на место самого нижнего слоя сети:
 * слои, добавленные над ним позже (редактор, выделение, подсветка), остаются сверху.
 */
export function networkStackMoves(style: readonly StackLayer[], groups: readonly (readonly string[])[]): StackMove[] {
  const pos = new Map(style.map((l, i) => [l.id, i]))
  const byId = new Map(style.map(l => [l.id, l]))
  const entries: Array<{ id: string; rank: number; group: number; index: number }> = []
  const seen = new Set<string>()
  groups.forEach((ids, group) => {
    for (const id of ids) {
      const layer = byId.get(id)
      if (!layer || seen.has(id)) continue
      seen.add(id)
      entries.push({ id, rank: stackRank(layer), group, index: pos.get(id)! })
    }
  })
  if (!entries.length) return []
  const desired = [...entries]
    .sort((a, b) => a.rank - b.rank || a.group - b.group || a.index - b.index)
    .map(e => e.id)
  const first = Math.min(...entries.map(e => e.index))
  // первый «чужой» слой над нижним слоем сети — граница блока
  const anchor = style.slice(first).find(l => !seen.has(l.id))?.id
  // уже на месте: блок подряд в нужном порядке, сразу под границей
  const current = style.slice(first, first + desired.length).map(l => l.id)
  const anchorPos = anchor === undefined ? style.length : pos.get(anchor)!
  if (current.length === desired.length && current.every((id, i) => id === desired[i]) && first + desired.length === anchorPos) {
    return []
  }
  const moves: StackMove[] = []
  let beforeId = anchor
  for (let i = desired.length - 1; i >= 0; i--) {
    moves.push({ id: desired[i], beforeId })
    beforeId = desired[i]
  }
  return moves
}
