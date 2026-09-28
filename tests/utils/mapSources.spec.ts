import { describe, expect, it } from 'vitest';
import { describeTilesetError, resolveTilesetUrl } from '~/utils/cesiumTileset';
import { buildVisicomSource, buildVisicomTiles, isVisicomEnabled, readVisicomConfig } from '~/utils/visicom';

describe('3D tileset url', () => {
  it('keeps absolute and root paths, resolves relative against app base', () => {
    expect(resolveTilesetUrl('')).toBe('');
    expect(resolveTilesetUrl('  ')).toBe('');
    expect(resolveTilesetUrl('https://cdn.example/net/tileset.json', '/itwin-map/')).toBe('https://cdn.example/net/tileset.json');
    expect(resolveTilesetUrl('/tiles/network/tileset.json', '/itwin-map/')).toBe('/tiles/network/tileset.json');
    expect(resolveTilesetUrl('tiles/network/tileset.json', '/itwin-map/')).toBe('/itwin-map/tiles/network/tileset.json');
    expect(resolveTilesetUrl('./t/tileset.json', '/itwin-map')).toBe('/itwin-map/t/tileset.json');
  });

  it('explains typical failures', () => {
    expect(describeTilesetError({ statusCode: 404 })).toMatch(/404/);
    expect(describeTilesetError({ statusCode: 403 })).toMatch(/403/);
    expect(describeTilesetError(new Error('Request has failed.'))).toMatch(/CORS/);
    expect(describeTilesetError(new SyntaxError('Unexpected token < in JSON'))).toMatch(/не JSON/);
  });
});

describe('VISICOM base layer', () => {
  const template = 'https://tms{s}.example/base/{z}/{x}/{y}.png';

  it('is hidden without key or url', () => {
    expect(isVisicomEnabled(readVisicomConfig({ visicomTilesUrl: template }))).toBe(false);
    expect(isVisicomEnabled(readVisicomConfig({ visicomKey: 'k' }))).toBe(false);
    expect(buildVisicomTiles(readVisicomConfig({ visicomTilesUrl: template }))).toEqual([]);
    expect(buildVisicomSource(readVisicomConfig({}))).toBeNull();
  });

  it('expands subdomains and key, TMS by default', () => {
    const cfg = readVisicomConfig({ visicomTilesUrl: template, visicomKey: 'a b' });
    expect(cfg.scheme).toBe('tms');
    const tiles = buildVisicomTiles(cfg);
    expect(tiles).toHaveLength(4);
    expect(tiles[0]).toBe('https://tms1.example/base/{z}/{x}/{y}.png?key=a%20b');
    expect(tiles[3]).toContain('tms4.');
    const withKey = buildVisicomTiles(readVisicomConfig({ visicomTilesUrl: 'https://t/{z}/{x}/{y}?api={key}&l=1', visicomKey: 'K', visicomScheme: 'XYZ' }));
    expect(withKey).toEqual(['https://t/{z}/{x}/{y}?api=K&l=1']);
    const source = buildVisicomSource(readVisicomConfig({ visicomTilesUrl: template, visicomKey: 'K', visicomScheme: 'xyz', visicomMaxZoom: '17' }));
    expect(source?.scheme).toBe('xyz');
    expect(source?.maxzoom).toBe(17);
  });
});
