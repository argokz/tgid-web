import { describe, expect, it } from 'vitest'
import {
  insertVertex,
  isEndpoint,
  moveVertex,
  removeVertex,
  sameEndpoints,
  sameLine,
  segmentMidpoints,
  vertexEditCollection,
  type LngLat,
} from '../../utils/lineVertices'
import { networkFeatureKind, pickNetworkSnap } from '../../utils/networkSnap'
import { reviewItemLabel, topologyOperationLabel } from '../../utils/topologyLabels'

const line: LngLat[] = [[0, 0], [1, 0], [2, 0]]

describe('line vertex editing (ends pinned to nodes)', () => {
  it('moves only intermediate vertices', () => {
    expect(moveVertex(line, 1, [1, 1])).toEqual([[0, 0], [1, 1], [2, 0]])
    expect(moveVertex(line, 0, [5, 5])).toBe(line)
    expect(moveVertex(line, 2, [5, 5])).toBe(line)
    expect(line).toEqual([[0, 0], [1, 0], [2, 0]]) // исходный массив не меняется
  })

  it('inserts a vertex inside a segment only', () => {
    expect(insertVertex(line, 0, [0.5, 0.2])).toEqual([[0, 0], [0.5, 0.2], [1, 0], [2, 0]])
    expect(insertVertex(line, 2, [3, 0])).toBe(line) // за концом — нет сегмента
  })

  it('removes intermediate vertices but keeps ends and two-point lines', () => {
    expect(removeVertex(line, 1)).toEqual([[0, 0], [2, 0]])
    expect(removeVertex(line, 0)).toBe(line)
    const two: LngLat[] = [[0, 0], [1, 1]]
    expect(removeVertex(two, 1)).toBe(two)
  })

  it('builds midpoints, endpoint flags and editor features', () => {
    expect(segmentMidpoints(line)).toEqual([
      { afterIndex: 0, coord: [0.5, 0] },
      { afterIndex: 1, coord: [1.5, 0] },
    ])
    expect(isEndpoint(0, 3) && isEndpoint(2, 3) && !isEndpoint(1, 3)).toBe(true)
    const fc = vertexEditCollection(line)
    const roles = fc.features.map((f) => f.properties.role)
    expect(roles.filter((r) => r === 'vertex')).toHaveLength(3)
    expect(roles.filter((r) => r === 'mid')).toHaveLength(2)
    const fixed = fc.features.filter((f: any) => f.properties.fixed).map((f: any) => f.properties.index)
    expect(fixed).toEqual([0, 2])
    expect(sameEndpoints(line, moveVertex(line, 1, [1, 3]))).toBe(true)
    expect(sameLine(line, [[0, 0], [1, 0], [2, 0]])).toBe(true)
  })
})

describe('snap only to network layers', () => {
  const node = (id: number, c: [number, number], layer = 'gid:nodes') => ({
    layer: { id: layer }, sourceLayer: layer, properties: { id }, geometry: { type: 'Point', coordinates: c },
  })
  const pipe = (id: number, cs: [number, number][], layer = 'gid:linesobj') => ({
    layer: { id: layer }, properties: { id }, geometry: { type: 'LineString', coordinates: cs },
  })
  const project = (c: [number, number]) => ({ x: c[0] * 10, y: c[1] * 10 })

  it('recognises network layers by name, not by geometry type', () => {
    expect(networkFeatureKind(node(1, [0, 0]))).toBe('node')
    expect(networkFeatureKind(pipe(2, [[0, 0], [1, 1]]))).toBe('line')
    expect(networkFeatureKind(node(3, [0, 0], 'buildings'))).toBeNull()
    expect(networkFeatureKind(node(4, [0, 0], 'draw-vertex'))).toBeNull()
    expect(networkFeatureKind(node(5, [0, 0], 'topology-vertex-point'))).toBeNull()
  })

  it('prefers nodes, ignores foreign layers and excluded objects', () => {
    const features = [
      node(9, [1, 1], 'poi'), // не сеть — ближе всех, но игнорируется
      pipe(20, [[1.1, 1], [5, 5]]),
      node(7, [1.5, 1]),
    ]
    const snap = pickNetworkSnap(features, { x: 10, y: 10 }, project, 8)
    expect(snap).toEqual({ coord: [1.5, 1], kind: 'node', id: 7 })
    const noNode = pickNetworkSnap(features, { x: 10, y: 10 }, project, 8, { nodes: [7] })
    expect(noNode).toEqual({ coord: [1.1, 1], kind: 'line', id: 20 })
    expect(pickNetworkSnap(features, { x: 10, y: 10 }, project, 8, { nodes: [7], lines: [20] })).toBeNull()
    expect(pickNetworkSnap(features, { x: 100, y: 100 }, project, 8)).toBeNull()
  })
})

describe('topology editor labels', () => {
  it('labels review items and undo operations', () => {
    expect(reviewItemLabel({ id: 22, attrs: { diametercondit: 706, damperarmaturestateid: 1 } }))
      .toBe('№22 · Ду 706 · сост. 1')
    expect(reviewItemLabel({ id: 3, attrs: { name: 'З-1', location: null } })).toBe('№3 · З-1')
    expect(topologyOperationLabel({ operation: 'SPLIT', summary: { line_id: 17 } })).toBe('разрезание участка 17')
    expect(topologyOperationLabel({ operation: 'CREATE_NODE', summary: { id: 5 } })).toBe('создание узла 5')
    expect(topologyOperationLabel(null)).toBe('')
  })
})

describe('snap recognises MVT node layer uzel (QA F83)', () => {
  it('uzel is a network node layer', () => {
    const uzel = { layer: { id: 'AlmatyGIS:uzel-0-uzel' }, sourceLayer: 'uzel', properties: { id: 7 }, geometry: { type: 'Point', coordinates: [0, 0] } }
    expect(networkFeatureKind(uzel)).toBe('node')
  })
})
