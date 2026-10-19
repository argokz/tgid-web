import { describe, expect, it } from 'vitest';
import { coordRangeError, describeConverted, parseCoord, parseCoordPair } from '~/utils/pointCrs';

describe('pointCrs: ввод точки по координатам', () => {
  it('числа из ведомости: запятая, пробелы тысяч, знак', () => {
    expect(parseCoord('3652,896')).toBe(3652.896);
    expect(parseCoord('1 315 539,2')).toBe(1315539.2);
    expect(parseCoord('-1315539.2')).toBe(-1315539.2);
    expect(parseCoord('1,234.5')).toBe(1234.5);
    expect(parseCoord('12a')).toBeNull();
    expect(parseCoord('')).toBeNull();
  });

  it('пара «X Y» одной строкой', () => {
    expect(parseCoordPair('3652,896 13155,392')).toEqual([3652.896, 13155.392]);
    expect(parseCoordPair('365289.6;-1315539.2')).toEqual([365289.6, -1315539.2]);
    expect(parseCoordPair('76.998\t43.377')).toEqual([76.998, 43.377]);
    expect(parseCoordPair('1 2 3')).toBeNull();
  });

  it('диапазон WGS84 и подпись пересчёта', () => {
    expect(coordRangeError('wgs84', 3652, 13155)).toMatch(/Долгота/);
    expect(coordRangeError('local', 3652, 13155)).toBeNull();
    expect(describeConverted({
      lng: 76.99839326, lat: 43.37722303, local: { x: 3652.896, y: 13155.392 }, desktop: { x: 365289.6, y: -1315539.2 },
    })).toBe('43,377223°, 76,998393° · местн. X 3652,896 Y 13155,392 · десктоп x 365289,6 y -1315539,2');
  });
});
