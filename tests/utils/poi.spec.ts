import { describe, expect, it } from 'vitest';
import { csvToFeatures, fileFeatures, parseCsv, poiColor, poiLayers } from '~/utils/poi';
import { buildSpec, builderFromSpec, emptyBuilder } from '~/utils/networkSelect';

describe('социальные объекты: файл акимата', () => {
  it('CSV с точкой с запятой, кавычками и BOM', () => {
    const text = '\uFEFFНаименование;lon;lat;category\n"Н-ТЕСТ школа; №1";76,95;43,25;школа\nбез координат;;;\n';
    expect(parseCsv(text)).toEqual([
      ['Наименование', 'lon', 'lat', 'category'],
      ['Н-ТЕСТ школа; №1', '76,95', '43,25', 'школа'],
      ['без координат', '', '', ''],
    ]);
    const { features, skipped } = csvToFeatures(text);
    expect(skipped).toBe(1);
    expect(features).toEqual([{ type: 'Feature', geometry: { type: 'Point', coordinates: [76.95, 43.25] },
      properties: { Наименование: 'Н-ТЕСТ школа; №1', category: 'школа' } }]);
  });

  it('CSV с запятой и колонками x/y; без колонок координат — понятная ошибка', () => {
    expect(csvToFeatures('name,x,y\n"Сад ""Аруана""",71.4,51.1\n').features[0]).toMatchObject({
      geometry: { coordinates: [71.4, 51.1] }, properties: { name: 'Сад "Аруана"' } });
    expect(csvToFeatures('name,адрес\nа,б\n').error).toMatch(/lon и lat/);
  });

  it('GeoJSON — коллекция или один объект; не тот файл — ошибка', () => {
    const fc = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [1, 2] }, properties: {} }] };
    expect(fileFeatures('a.geojson', JSON.stringify(fc)).features).toHaveLength(1);
    expect(fileFeatures('a.json', JSON.stringify(fc.features[0])).features).toHaveLength(1);
    expect(fileFeatures('a.geojson', '<xml/>').error).toMatch(/не GeoJSON/);
    expect(fileFeatures('a.csv', 'lon;lat\n1;2\n').features).toHaveLength(1);
  });

  it('цвет категории и слои карты', () => {
    expect(poiColor('hospital')).toBe('#c62828');
    expect(poiColor('bank')).toBe('#546e7a');
    expect(poiLayers().map((l) => l.id)).toEqual(['poi-points', 'poi-labels']);
  });
});

describe('выборка «рядом с социальными объектами»', () => {
  it('конструктор ↔ запрос', () => {
    const state = { ...emptyBuilder('lines'), poiOn: true, poiCategories: ['school'], poiMeters: 500 };
    const spec = buildSpec(state, [], []);
    expect(spec.near_poi).toEqual({ categories: ['school'], meters: 500 });
    expect(buildSpec(emptyBuilder(), [], []).near_poi).toBeNull();
    const back = builderFromSpec(spec, []);
    expect(back).toMatchObject({ poiOn: true, poiCategories: ['school'], poiMeters: 500 });
  });
});
