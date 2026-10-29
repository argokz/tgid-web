import { describe, expect, it } from 'vitest';
import {
  absoluteApiBase,
  applyStaticTiles,
  formatSize,
  isStaticTileUrl,
  staticTileUrl,
  type StaticTileArchive,
} from '~/utils/staticTiles';

const ARCHIVE: StaticTileArchive = {
  layer: 'zdaniya_2', minzoom: 14, maxzoom: 16, bounds: [76.6, 42.9, 77.2, 43.5], tiles: 3120, size: 22_036_678,
  built_at: '2026-10-29T15:22:30+00:00', built_by: 'admin', version: 1793287350,
};

interface TestLayer {
  sourceLayer: string;
  workspace: string;
  renderFormat?: 'mvt' | 'wms' | 'wmts';
  mvtUrl?: string;
  tileBounds?: [number, number, number, number];
  staticTiles?: { layer: string; minzoom: number; maxzoom: number; version: number };
}

const layer = (sourceLayer: string, workspace: string, extra: Partial<TestLayer> = {}): TestLayer => ({
  sourceLayer, workspace, renderFormat: 'mvt', mvtUrl: `https://gs/${workspace}/${sourceLayer}/{z}/{x}/{y}`, ...extra,
});

describe('staticTiles: слои из архивов PMTiles', () => {
  it('адрес тайлов — абсолютный, с версией архива', () => {
    const base = absoluteApiBase('/tgid/almaty/map-api/', 'https://gis.example.kz/');
    expect(base).toBe('https://gis.example.kz/tgid/almaty/map-api');
    expect(absoluteApiBase('http://localhost:8049', 'http://x')).toBe('http://localhost:8049');
    const url = staticTileUrl(base, ARCHIVE);
    expect(url).toBe('https://gis.example.kz/tgid/almaty/map-api/api/v1/static-tiles/zdaniya_2/{z}/{x}/{y}.mvt?v=1793287350');
    expect(isStaticTileUrl(url)).toBe(true);
    expect(isStaticTileUrl('https://gs/tiles/zdaniya_2/1/1/1')).toBe(false);
  });

  it('подменяет только MVT-слой рабочей области базы города', () => {
    const layers = [
      layer('heatpipesections', 'AlmatyGIS'),
      layer('zdaniya_2', 'AlmatyGIS'),
      layer('zdaniya_2', 'Almaty2'),
      layer('zdaniya_2', 'AlmatyGIS', { renderFormat: 'wms' }),
      layer('zdaniya_tu', 'AlmatyGIS'),
    ];
    const out = applyStaticTiles(layers, [ARCHIVE], 'http://api');
    expect(out[1]!.mvtUrl).toBe('http://api/api/v1/static-tiles/zdaniya_2/{z}/{x}/{y}.mvt?v=1793287350');
    expect(out[1]!.staticTiles).toEqual({ layer: 'zdaniya_2', minzoom: 14, maxzoom: 16, version: 1793287350 });
    expect(out[1]!.tileBounds).toEqual(ARCHIVE.bounds);
    expect(out[2]).toBe(layers[2]); // другая рабочая область — из своего сервера
    expect(out[3]).toBe(layers[3]); // WMS не трогаем
    expect(out[4]).toBe(layers[4]); // архива нет
    expect(layers[1]!.mvtUrl).toContain('https://gs/'); // исходные объекты не меняются
    expect(applyStaticTiles(layers, [], 'http://api')).toBe(layers);
  });

  it('без слоя участков — по имени слоя в любой рабочей области', () => {
    const out = applyStaticTiles([layer('zdaniya_2', 'Shatura')], [ARCHIVE], 'http://api');
    expect(out[0]!.staticTiles?.maxzoom).toBe(16);
  });

  it('размер архива', () => {
    expect(formatSize(22_036_678)).toBe('21 МБ');
    expect(formatSize(850 * 1024)).toBe('850 КБ');
    expect(formatSize(10)).toBe('1 КБ');
  });
});
