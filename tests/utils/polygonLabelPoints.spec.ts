import { describe, expect, it } from 'vitest'
import {
  clipRing,
  computeLabelPoints,
  labelPointOf,
  roundLabelNumbers,
  textFit,
  tileBoundsMerc,
  wallsOf,
} from '../../utils/polygonLabelPoints'

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

  it('дробные значения подписи — три значащих цифры, адреса и целые не трогаются', () => {
    expect(roundLabelNumbers('Qсум=0.0764841')).toBe('Qсум=0.0765')
    expect(roundLabelNumbers('Qот=1.54223')).toBe('Qот=1.54')
    expect(roundLabelNumbers('Qсум= 2.22302')).toBe('Qсум= 2.22')
    expect(roundLabelNumbers('Q=1234.56789')).toBe('Q=1235')
    expect(roundLabelNumbers('Q=0.5')).toBe('Q=0.5')
    expect(roundLabelNumbers('ул.Толе би 226')).toBe('ул.Толе би 226')
    expect(roundLabelNumbers('пр.Абая 34/96')).toBe('пр.Абая 34/96')
  })

  it('подпись нагрузки: варианты и при каком шрифте каждый помещается в доме', () => {
    const fc = computeLabelPoints([{
      id: 1,
      properties: { txt: 'ул.Масанчи 81\r\nQот=0.092128\r\nQгвс=0.030851\r\nQсум=0.122979', otop: 0.09 },
      geometry: polygon(rectMerc(0, 0, 80, 20)),
    }])
    const p = fc.features[0].properties!
    // Значения нагрузок — до трёх значащих цифр (точные — в карточке)
    expect(p.txt__short).toBe('Qсум=0.123')
    expect(p.txt__mid).toBe('ул.Масанчи 81\nQсум=0.123')
    expect(p.txt__wide).toBe('ул.Масанчи 81\nQот=0.0921  Qгвс=0.0309\nQсум=0.123')
    expect(p.otop).toBe(0.09)
    expect(p.otop__short).toBeUndefined()
    // дом 80 × 20 м: короче и шире — помещается крупнее; 4 строки ниже, чем 3 широких
    expect(p.txt__short__fit).toBeGreaterThan(p.txt__mid__fit)
    expect(p.txt__mid__fit).toBeGreaterThan(p.txt__fit)
    expect(p.txt__wide__fit).toBeGreaterThan(p.txt__fit)
    // Qсум (10 знаков) по ширине: 80 / (10 × 0,56) ≈ 14,3; по высоте: 20 / 1,2 ≈ 16,7
    expect(p.txt__short__fit).toBeCloseTo(80 / (10 * 0.56), 1)
    // целиком (4 строки): по высоте 20 / 4,8 ≈ 4,2
    expect(p.txt__fit).toBeCloseTo(20 / (4 * 1.2), 1)
  })

  it('размер подписи — по стенам, разрез по границе тайла стеной не считается', () => {
    const a = tileBoundsMerc(18, 187090, 96080)
    const edge = a[2]
    const midY = (a[1] + a[3]) / 2
    const left = clipRing(rectMerc(edge - 40, midY - 10, edge + 8, midY + 10) as Array<[number, number]>, a)
    const b = tileBoundsMerc(18, 187091, 96080)
    const right = clipRing(rectMerc(edge - 8, midY - 10, edge + 20, midY + 10) as Array<[number, number]>, b)
    const walls = wallsOf([[left], [right]], [a, b])
    expect(walls).toHaveLength(6)
    const p = labelPointOf([[left], [right]], walls)!
    expect(p[0]).toBeCloseTo(edge - 10, 3)
    // одна строка 10 знаков: дом 60 м → шрифт 60 / 5,6 ≈ 10,7
    expect(textFit('0123456789', p, walls)).toBeCloseTo(60 / 5.6, 1)
  })

  it('длинный Г-образный дом: подпись в просторной части, ближе к центру', () => {
    // полка 100 × 20 и тонкая стойка 6 × 60 — центр тяжести в полке у стойки
    const L = [[0, 0], [100, 0], [100, 20], [6, 20], [6, 80], [0, 80], [0, 0]] as Array<[number, number]>
    const p = labelPointOf([[L]])!
    expect(p[1]).toBeGreaterThan(5)
    expect(p[1]).toBeLessThan(15)
    expect(p[0]).toBeGreaterThan(8)
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
