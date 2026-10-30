import { describe, expect, it } from 'vitest';
import {
  EMBED_SOURCE,
  embedMapLayers,
  embedPageUrl,
  embedTileUrl,
  eventMessage,
  featureRows,
  frameAllowed,
  iframeSnippet,
  layerOfMapLayer,
  parentOrigin,
  parseCommand,
  parseEmbedQuery,
  sdkSnippet,
  type EmbedLayerInfo,
} from '~/utils/embedProtocol';

const cmd = (body: Record<string, unknown>) => ({ source: EMBED_SOURCE, v: 1, ...body });

describe('встраиваемая карта: параметры страницы', () => {
  it('ключ, слои, вид и режим без интерфейса', () => {
    expect(parseEmbedQuery({ key: 'tge_x', layers: 'valves,bogus,pipes', center: '76.9,43.24', zoom: '30', ui: '0' }))
      .toEqual({ key: 'tge_x', layers: ['valves', 'pipes'], center: [76.9, 43.24], zoom: 22, ui: false });
    expect(parseEmbedQuery({ key: ['tge_y'], center: '200,10', layers: 'bogus' }))
      .toEqual({ key: 'tge_y', layers: null, center: null, zoom: null, ui: true });
  });
});

describe('сайт-родитель', () => {
  const allowed = ['https://akimat.kz'];
  it('берётся из ancestorOrigins, иначе из referrer', () => {
    expect(parentOrigin({ framed: false, referrer: 'https://evil.example/' })).toBeNull();
    expect(parentOrigin({ framed: true, ancestorOrigins: ['https://akimat.kz'], referrer: 'https://evil.example/' }))
      .toBe('https://akimat.kz');
    expect(parentOrigin({ framed: true, ancestorOrigins: [], referrer: 'https://akimat.kz/portal/map?x=1' }))
      .toBe('https://akimat.kz');
    expect(parentOrigin({ framed: true, referrer: '' })).toBe('');
    expect(parentOrigin({ framed: true, referrer: 'javascript:alert(1)' })).toBe('');
  });

  it('карта — сама по себе, у себя или на сайтах ключа', () => {
    expect(frameAllowed(null, allowed, 'https://itwin.kz')).toBe(true);
    expect(frameAllowed('https://itwin.kz', allowed, 'https://itwin.kz')).toBe(true);
    expect(frameAllowed('https://akimat.kz', allowed, 'https://itwin.kz')).toBe(true);
    expect(frameAllowed('https://evil.example', allowed, 'https://itwin.kz')).toBe(false);
    expect(frameAllowed('', allowed, 'https://itwin.kz')).toBe(false); // родителя не узнать — не показывать
  });
});

describe('команды сайта-родителя', () => {
  it('исполняются только по протоколу', () => {
    expect(parseCommand(cmd({ type: 'setView', center: [76.9, 43.2], zoom: 14 })))
      .toEqual({ type: 'setView', center: [76.9, 43.2], zoom: 14 });
    expect(parseCommand(cmd({ type: 'setView', zoom: 99 }))).toEqual({ type: 'setView', zoom: 22 });
    expect(parseCommand(cmd({ type: 'setView' }))).toBeNull();
    expect(parseCommand({ type: 'setView', zoom: 3 })).toBeNull(); // без метки протокола
    expect(parseCommand(cmd({ v: 2, type: 'setView', zoom: 3 }))).toBeNull();
    expect(parseCommand(cmd({ type: 'eval', code: 'x' }))).toBeNull();
    expect(parseCommand('setView')).toBeNull();
  });

  it('границы, слои, подсветка и запрос вида проверяются', () => {
    expect(parseCommand(cmd({ type: 'fitBounds', bounds: [76, 43, 77, 44], padding: 999 })))
      .toEqual({ type: 'fitBounds', bounds: [76, 43, 77, 44], padding: 200 });
    expect(parseCommand(cmd({ type: 'fitBounds', bounds: [77, 43, 76, 44] }))).toBeNull();
    expect(parseCommand(cmd({ type: 'setLayers', layers: ['pipes', 'x', 5] }))).toEqual({ type: 'setLayers', layers: ['pipes'] });
    expect(parseCommand(cmd({ type: 'highlight', layer: 'pipes', ids: [1, -2, 3.5, '4', 5] })))
      .toEqual({ type: 'highlight', layer: 'pipes', ids: [1, 5] });
    expect(parseCommand(cmd({ type: 'highlight', layer: 'buildings', ids: [1] }))).toBeNull();
    expect(parseCommand(cmd({ type: 'getView', id: 'v1' }))).toEqual({ type: 'getView', id: 'v1' });
    expect(parseCommand(cmd({ type: 'getView', id: 7 }))).toBeNull();
  });

  it('события помечены протоколом', () => {
    expect(eventMessage({ type: 'error', message: 'x' })).toEqual({ source: EMBED_SOURCE, v: 1, type: 'error', message: 'x' });
  });
});

describe('слои карты и карточка', () => {
  const pipes: EmbedLayerInfo = { id: 'pipes', title: 'Участки', geometry: 'LineString', minzoom: 10, fields: [] };

  it('тайлы по ключу, слои MapLibre и обратное соответствие', () => {
    expect(embedTileUrl('https://itwin.kz/api/', 'tge_a+b', 'pipes'))
      .toBe('https://itwin.kz/api/api/v1/embed/tiles/pipes/{z}/{x}/{y}?key=tge_a%2Bb');
    const [line] = embedMapLayers(pipes);
    expect(line).toMatchObject({ id: 'tgid-embed-pipes-line', type: 'line', 'source-layer': 'pipes', minzoom: 10 });
    const [valve] = embedMapLayers({ ...pipes, id: 'valves', geometry: 'Point', minzoom: 15 });
    expect(valve).toMatchObject({ id: 'tgid-embed-valves-circle', type: 'circle' });
    expect(layerOfMapLayer('tgid-embed-heat_sources-circle')).toBe('heat_sources');
    expect(layerOfMapLayer('tgid-embed-outages-fill')).toBeNull();
  });

  it('карточка объекта — по-русски, пустые поля скрыты', () => {
    expect(featureRows({ name: ' 3-47 ', sign: 2, diameter_mm: 400, state_supply: 2, state_return: null, extra: 1 }))
      .toEqual([
        { label: 'Название', value: '3-47' },
        { label: 'Трубопровод', value: 'подача' },
        { label: 'Ду, мм', value: '400' },
        { label: 'Подача', value: 'закрыта' },
      ]);
    expect(featureRows({ kind: 'generalized', load_gcal_h: 1.23456 }))
      .toEqual([{ label: 'Вид', value: 'обобщённый потребитель' }, { label: 'Нагрузка, Гкал/ч', value: '1,235' }]);
  });
});

describe('код для сайта', () => {
  const opts = { embedUrl: 'https://itwin.kz/itwin-map/embed', key: 'tge_k"1', layers: ['pipes' as const] };

  it('iframe — с экранированными атрибутами и referrer для проверки сайта', () => {
    expect(embedPageUrl(opts)).toBe('https://itwin.kz/itwin-map/embed?key=tge_k%221&layers=pipes');
    const html = iframeSnippet(opts);
    expect(html).toContain('src="https://itwin.kz/itwin-map/embed?key=tge_k%221&amp;layers=pipes"');
    expect(html).toContain('referrerpolicy="strict-origin-when-cross-origin"');
  });

  it('SDK — адрес скрипта, ключ и слои', () => {
    const code = sdkSnippet({ ...opts, sdkUrl: 'https://itwin.kz/itwin-map/tgid-embed.js' });
    expect(code).toContain('<script src="https://itwin.kz/itwin-map/tgid-embed.js"></script>');
    expect(code).toContain('key: "tge_k\\"1",');
    expect(code).toContain('layers: ["pipes"],');
  });
});
