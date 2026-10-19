import { describe, expect, it } from 'vitest';
import {
  coordCopyText, coordRangeError, copyFormatFor, describeConverted, formatCursorCoords, parseCoord, parseCoordPair,
  type CursorPoint,
} from '~/utils/pointCrs';

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

describe('координаты курсора', () => {
  const p: CursorPoint = {
    lng: 76.99839326, lat: 43.37722303,
    converted: { lng: 76.99839326, lat: 43.37722303, local: { x: 3652.8964, y: 13155.3921 }, desktop: { x: 365289.64, y: -1315539.21 } },
  };

  it('подпись в выбранной системе; без пересчёта — null', () => {
    expect(formatCursorCoords('wgs84', p)).toBe('43,377223° с. ш.  76,998393° в. д.');
    expect(formatCursorCoords('local', p)).toBe('X 3652,896  Y 13155,392 м');
    expect(formatCursorCoords('desktop', p)).toBe('x 365289,6  y -1315539,2 см');
    expect(formatCursorCoords('local', { ...p, converted: null })).toBeNull();
  });

  it('текст для буфера читается обратно вводом «По координатам»', () => {
    expect(coordCopyText('latlng', p)).toBe('43.377223, 76.998393');
    expect(coordCopyText('lnglat', p)).toBe('76.998393 43.377223');
    expect(coordCopyText('local', p)).toBe('3652.896 13155.392');
    expect(parseCoordPair(coordCopyText('desktop', p)!)).toEqual([365289.6, -1315539.2]);
    expect(coordCopyText('desktop', { ...p, converted: null })).toBeNull();
    expect(copyFormatFor('wgs84')).toBe('latlng');
    expect(copyFormatFor('local')).toBe('local');
  });
});
