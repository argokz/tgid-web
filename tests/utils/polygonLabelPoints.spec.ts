import { describe, expect, it } from 'vitest'
import { clipRing, computeLabelPoints, labelPointOf, tileBoundsMerc } from '../../utils/polygonLabelPoints'

const R = 6378137
const toLonLat = ([x, y]: number[]) => [x / R * 180 / Math.PI, (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180 / Math.PI]
const rectMerc = (x0: number, y0: number, x1: number, y1: number) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]
const polygon = (ringMerc: number[][]) => ({ type: 'Polygon', coordinates: [ringMerc.map(toLonLat)] })

describe('точка подписи полигона', () => {
  it('дом на стыке двух тайлов: одна подпись в середине целого дома', () => {
    // тайл 18/187090/96080 (Алматы) и сосед справа; дом 60 × 20 м поперёк границы
    const a = tileBoundsMerc(18, 187090, 96080)
    const edge = a[2]
    const midY = (a[1] + a[3]) / 2
    const house = rectMerc(edge - 40, midY - 10, edge + 20, midY + 10)
    // куски из тайлов — с запасом за границу тайла (как режет GeoServer)
    const buf = 8
    const left = rectMerc(edge - 40, midY - 10, edge + buf, midY + 10)
    const right = rectMerc(edge - buf, midY - 10, edge + 20, midY + 10)
    const fc = computeLabelPoints([
      { id: 65028, properties: { txt: 'ул.Шевченко 110\r\nQот=0.13' }, geometry: polygon(left), tile: { z: 18, x: 187090, y: 96080 } },
      { id: 65028, properties: { txt: 'ул.Шевченко 110\r\nQот=0.13' }, geometry: polygon(right), tile: { z: 18, x: 187091, y: 96080 } },
    ])
    expect(fc.features).toHaveLength(1)
    const f = fc.features[0]
    expect(f.id).toBe(65028)
    expect(f.properties!.txt).toBe('ул.Шевченко 110\nQот=0.13')
    expect(f.properties!.txt__short).toBe('Qот=0.13')
    expect(f.properties!.txt__mid).toBe('ул.Шевченко 110\nQот=0.13')
    expect(f.properties!.__area).toBeGreaterThan(0)
    const [cx, cy] = toLonLat([(house[0][0] + house[1][0]) / 2, midY])
    expect(f.geometry.coordinates[0]).toBeCloseTo(cx, 7)
    expect(f.geometry.coordinates[1]).toBeCloseTo(cy, 7)
  })

  it('куски двух зумов: берётся зум, где дом собран целиком', () => {
    const a = tileBoundsMerc(17, 93545, 48040)
    const cx = (a[0] + a[2]) / 2
    const cy = (a[1] + a[3]) / 2
    const house = rectMerc(cx - 30, cy - 10, cx + 30, cy + 10)
    // на 18-м зуме загружен только тайл с левой частью дома
    const fc = computeLabelPoints([
      { id: 1, properties: {}, geometry: polygon(house), tile: { z: 17, x: 93545, y: 48040 } },
      { id: 1, properties: {}, geometry: polygon(rectMerc(cx - 30, cy - 10, cx + 4, cy + 10)), tile: { z: 18, x: 187090, y: 96080 } },
    ])
    expect(fc.features).toHaveLength(1)
    const [lon] = toLonLat([cx, cy])
    expect(fc.features[0].geometry.coordinates[0]).toBeCloseTo(lon, 7)
  })

  it('Г-образный дом: точка внутри, а не в центре тяжести снаружи', () => {
    // Г: широкая полка снизу и стойка слева — центр тяжести у угла, вне дома
    const L = [[0, 0], [100, 0], [100, 10], [10, 10], [10, 100], [0, 100], [0, 0]] as Array<[number, number]>
    const p = labelPointOf([[L]])!
    const inside = (p[0] >= 0 && p[0] <= 100 && p[1] >= 0 && p[1] <= 10) || (p[0] >= 0 && p[0] <= 10 && p[1] >= 0 && p[1] <= 100)
    expect(inside).toBe(true)
  })

  it('дом с двором (дыра): точка не во дворе', () => {
    const outer = [[0, 0], [30, 0], [30, 30], [0, 30], [0, 0]] as Array<[number, number]>
    const hole = [[10, 10], [10, 20], [20, 20], [20, 10], [10, 10]] as Array<[number, number]>
    const p = labelPointOf([[outer, hole]])!
    expect(p[0] > 10 && p[0] < 20 && p[1] > 10 && p[1] < 20).toBe(false)
    expect(p[0] >= 0 && p[0] <= 30 && p[1] >= 0 && p[1] <= 30).toBe(true)
  })

  it('подпись нагрузки: издали — Qсум, ближе — адрес и Qсум', () => {
    const fc = computeLabelPoints([{
      id: 1,
      properties: { txt: 'ул.Масанчи 81\r\nQот=0.092128\r\nQгвс=0.030851\r\nQсум=0.122979', otop: 0.09 },
      geometry: polygon(rectMerc(0, 0, 10, 10)),
    }])
    const p = fc.features[0].properties!
    expect(p.txt__short).toBe('Qсум=0.122979')
    expect(p.txt__mid).toBe('ул.Масанчи 81\nQсум=0.122979')
    expect(p.otop).toBe(0.09)
    expect(p.otop__short).toBeUndefined()
  })

  it('объекты без id — каждый своей подписью', () => {
    const fc = computeLabelPoints([
      { properties: {}, geometry: polygon(rectMerc(0, 0, 10, 10)) },
      { properties: {}, geometry: polygon(rectMerc(20, 0, 30, 10)) },
      { properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } },
    ])
    expect(fc.features).toHaveLength(2)
  })

  it('обрезка кольца прямоугольником', () => {
    const r = clipRing([[-5, 0], [5, 0], [5, 4], [-5, 4], [-5, 0]], [0, -1, 10, 10])
    const xs = r.map(p => p[0])
    expect(Math.min(...xs)).toBe(0)
    expect(Math.max(...xs)).toBe(5)
  })
})
