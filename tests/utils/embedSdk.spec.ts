import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** SDK встраиваемой карты (public/tgid-embed.js) — тот же файл, что получают сайты */
const SDK = readFileSync(resolve(__dirname, '../../public/tgid-embed.js'), 'utf-8');
const EMBED = 'https://itwin.kz/itwin-map/embed';

interface Sdk {
  create: (el: HTMLElement, opts: Record<string, unknown>) => any;
}

const load = (): Sdk => {
  new Function(SDK)();
  return (window as any).TGIDEmbed as Sdk;
};

/** Карта с подменённым окном iframe (страница в тесте не грузится): его postMessage — шпион */
const create = (sdk: Sdk, opts: Record<string, unknown>) => {
  const map = sdk.create(el, opts);
  Object.defineProperty(map.iframe, 'contentWindow', { value: { postMessage: vi.fn() } });
  return map;
};

/** Сообщение «из iframe карты»: источник и адрес — как у настоящего */
const fromMap = (map: any, data: Record<string, unknown>, origin = 'https://itwin.kz') => {
  window.dispatchEvent(new MessageEvent('message', { data: { source: 'tgid-embed', v: 1, ...data }, origin, source: map.iframe.contentWindow }));
};

let el: HTMLElement;

describe('JS SDK встраиваемой карты', () => {
  beforeEach(() => {
    // страницу карты в iframe не загружать: тест проверяет только SDK
    (window as any).happyDOM.settings.navigation.disableChildFrameNavigation = true;
    el = document.createElement('div');
    document.body.appendChild(el);
  });

  afterEach(() => {
    el.remove();
    delete (window as any).TGIDEmbed;
  });

  it('строит iframe с параметрами и требует url и ключ', () => {
    const sdk = load();
    expect(() => sdk.create(el, { url: EMBED })).toThrow(/key/);
    const map = create(sdk, { url: EMBED, key: 'tge_a', layers: ['pipes', 'valves'], center: [76.9, 43.2], zoom: 14, ui: false, height: 300 });
    const src = new URL(map.iframe.src);
    expect(src.origin + src.pathname).toBe(EMBED);
    expect(Object.fromEntries(src.searchParams)).toEqual({ key: 'tge_a', layers: 'pipes,valves', center: '76.9,43.2', zoom: '14', ui: '0' });
    expect(map.iframe.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin');
    expect(map.iframe.style.height).toBe('300px');
    map.destroy();
    expect(el.querySelector('iframe')).toBeNull();
  });

  it('команды ждут ready и уходят только адресу карты; чужие сообщения не принимаются', async () => {
    const map = create(load(), { url: EMBED, key: 'tge_a' });
    const post = map.iframe.contentWindow.postMessage;
    map.setView({ zoom: 16 });
    expect(post).not.toHaveBeenCalled();

    const selected: unknown[] = [];
    map.on('select', (e: unknown) => selected.push(e));
    fromMap(map, { type: 'select', layer: 'pipes', id: 1 }, 'https://evil.example'); // чужой адрес
    window.dispatchEvent(new MessageEvent('message', { data: { source: 'tgid-embed', v: 1, type: 'select' }, origin: 'https://itwin.kz' }));
    expect(selected).toEqual([]);

    fromMap(map, { type: 'ready', layers: ['pipes'], view: { center: [0, 0], zoom: 3 } });
    await expect(map.ready).resolves.toMatchObject({ type: 'ready' });
    expect(post).toHaveBeenCalledWith({ source: 'tgid-embed', v: 1, type: 'setView', center: undefined, zoom: 16 }, 'https://itwin.kz');

    fromMap(map, { type: 'select', layer: 'pipes', id: 604, properties: { name: 'x' } });
    expect(selected).toEqual([expect.objectContaining({ layer: 'pipes', id: 604 })]);
    map.destroy();
  });

  it('getView отвечает по номеру запроса; отписка работает', async () => {
    const map = create(load(), { url: EMBED, key: 'tge_a' });
    const post = map.iframe.contentWindow.postMessage;
    fromMap(map, { type: 'ready', layers: [], view: { center: [0, 0], zoom: 1 } });
    const pending = map.getView();
    const sent = post.mock.calls.at(-1)[0] as { id: string; type: string };
    expect(sent.type).toBe('getView');
    fromMap(map, { type: 'view', id: sent.id, view: { center: [1, 2], zoom: 5 }, bounds: [0, 1, 2, 3] });
    await expect(pending).resolves.toEqual({ view: { center: [1, 2], zoom: 5 }, bounds: [0, 1, 2, 3] });

    const moves: unknown[] = [];
    const off = map.on('moveend', (e: unknown) => moves.push(e));
    off();
    fromMap(map, { type: 'moveend', view: { center: [0, 0], zoom: 1 }, bounds: [0, 0, 0, 0] });
    expect(moves).toEqual([]);
    map.destroy();
  });
});
