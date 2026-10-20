import { describe, expect, it } from 'vitest'
import { networkStackMoves, stackRank, type StackLayer } from '../../utils/networkLayerStack'

/** Применить ходы к списку слоёв, как moveLayer MapLibre */
function apply(style: StackLayer[], moves: ReturnType<typeof networkStackMoves>): string[] {
  const ids = style.map(l => l.id)
  for (const { id, beforeId } of moves) {
    ids.splice(ids.indexOf(id), 1)
    if (beforeId === undefined) ids.push(id)
    else ids.splice(ids.indexOf(beforeId), 0, id)
  }
  return ids
}

const L = (id: string, type: string, layout?: Record<string, any>): StackLayer => ({ id, type, layout })

describe('порядок слоёв сети', () => {
  it('группы: здания → участки → узлы → подписи', () => {
    expect(stackRank(L('a', 'fill'))).toBe(0)
    expect(stackRank(L('a', 'raster'))).toBe(0)
    expect(stackRank(L('a', 'line'))).toBe(1)
    expect(stackRank(L('a', 'circle'))).toBe(2)
    expect(stackRank(L('a', 'symbol', { 'icon-image': 'us', 'text-field': '{name}' }))).toBe(2)
    expect(stackRank(L('a', 'symbol', { 'text-field': '{name}' }))).toBe(3)
  })

  it('участки, догруженные последними, ложатся под узлы и над зданиями; слои редактора остаются сверху', () => {
    const style = [
      L('base', 'raster'),
      L('uzel-icons', 'symbol', { 'icon-image': 'us' }),
      L('uzel-labels', 'symbol', { 'text-field': '{label}' }),
      L('zd-fill', 'fill'),
      L('zd-labels', 'symbol', { 'text-field': '{txt}' }),
      L('edit-sel-node', 'circle'),
      L('pipes-line', 'line'),
      L('pipes-du', 'symbol', { 'text-field': 'Ду {du}' }),
    ]
    // список снизу вверх: здания, участки, узлы
    const groups = [['zd-fill', 'zd-labels'], ['pipes-line', 'pipes-du'], ['uzel-icons', 'uzel-labels']]
    const moves = networkStackMoves(style, groups)
    expect(apply(style, moves)).toEqual([
      'base', 'zd-fill', 'pipes-line', 'uzel-icons', 'zd-labels', 'pipes-du', 'uzel-labels', 'edit-sel-node',
    ])
  })

  it('порядок уже верный — ходов нет; результат не зависит от того, в каком порядке слои догрузились', () => {
    const layers = [
      L('zd-fill', 'fill'), L('pipes-line', 'line'), L('uzel-icons', 'symbol', { 'icon-image': 'us' }),
      L('pipes-du', 'symbol', { 'text-field': 'Ду' }),
    ]
    const groups = [['zd-fill'], ['pipes-line', 'pipes-du'], ['uzel-icons']]
    const ok = [L('base', 'raster'), ...layers, L('top', 'line')]
    expect(networkStackMoves(ok, groups)).toEqual([])
    const want = ok.map(l => l.id)
    for (const shuffled of [[3, 1, 0, 2], [2, 0, 3, 1], [1, 3, 2, 0]]) {
      const style = [L('base', 'raster'), ...shuffled.map(i => layers[i]), L('top', 'line')]
      const result = apply(style, networkStackMoves(style, groups))
      expect(result).toEqual(want)
      // повторное выравнивание ничего не меняет
      const again = result.map(id => ok.find(l => l.id === id)!)
      expect(networkStackMoves(again, groups)).toEqual([])
    }
  })

  it('слоя нет на карте — пропускается', () => {
    expect(networkStackMoves([L('a', 'line')], [['missing']])).toEqual([])
  })
})
