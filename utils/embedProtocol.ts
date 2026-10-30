/**
 * Встраиваемая карта ТГИД (фаза 2, п. 14): параметры страницы /embed, проверка сайта-родителя, протокол
 * postMessage с SDK (public/tgid-embed.js), стили слоёв и фрагменты кода для сайта.
 *
 * Ключ встраивания (itwin-api routers/embed.py) публичный по природе — он виден в коде сайта. Поэтому страница
 * показывает только слои ключа и только сайтам ключа: родитель берётся из location.ancestorOrigins (Chrome,
 * Safari), иначе из document.referrer; неизвестный родитель — карта не показывается. Сообщения — только этому
 * родителю и только от него.
 */

export const EMBED_SOURCE = 'tgid-embed';
export const EMBED_VERSION = 1;
/** Порядок отрисовки снизу вверх: потребитель и источник стоят в точке узла — они поверх узлов */
export const EMBED_LAYER_IDS = ['pipes', 'nodes', 'valves', 'consumers', 'heat_sources'] as const;
export type EmbedLayerId = (typeof EMBED_LAYER_IDS)[number];
export const EMBED_TILES_PATH = '/api/v1/embed/tiles/';

export interface EmbedLayerInfo {
  id: EmbedLayerId;
  title: string;
  geometry: 'LineString' | 'Point';
  minzoom: number;
  fields: string[];
}

export interface EmbedView {
  center: [number, number];
  zoom: number;
}

export interface EmbedConfig {
  name: string;
  city_label: string;
  origins: string[];
  layers: EmbedLayerInfo[];
  fragments: number[] | null;
  outages: boolean;
  view: EmbedView | null;
  extent: [number, number, number, number];
}

/** Ключ встраивания в списке администратора (сам ключ — только в ответе на создание) */
export interface EmbedKeyRow {
  id: number;
  name: string;
  key_prefix: string;
  origins: string[];
  layers: EmbedLayerId[];
  fragments: number[] | null;
  outages: boolean;
  view: EmbedView | null;
  created_by: string;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  last_used_at: string | null;
  active: boolean;
  key?: string;
}

export interface EmbedKeyInput {
  name: string;
  origins: string[];
  layers: EmbedLayerId[];
  fragments?: number[] | null;
  outages?: boolean;
  view?: EmbedView | null;
  days?: number | null;
}

export const EMBED_LAYER_TITLES: Record<EmbedLayerId, string> = {
  pipes: 'Участки теплосети',
  nodes: 'Узлы сети',
  valves: 'Задвижки',
  consumers: 'Потребители',
  heat_sources: 'Источники тепла',
};

// --- параметры страницы ----------------------------------------------------------------------

export interface EmbedOptions {
  key: string;
  /** Подмножество слоёв ключа; null — все слои ключа */
  layers: EmbedLayerId[] | null;
  center: [number, number] | null;
  zoom: number | null;
  /** false — без легенды и карточки объекта: сайт показывает своё по событиям */
  ui: boolean;
}

const first = (v: unknown): string => String(Array.isArray(v) ? v[0] ?? '' : v ?? '').trim();

const isLayer = (v: string): v is EmbedLayerId => (EMBED_LAYER_IDS as readonly string[]).includes(v);

export function parseLonLat(raw: string): [number, number] | null {
  const parts = raw.split(',').map((p) => Number(p.trim()));
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) return null;
  const [lon, lat] = parts as [number, number];
  return Math.abs(lon) <= 180 && Math.abs(lat) <= 90 ? [lon, lat] : null;
}

/** ?key=…&layers=pipes,valves&center=lon,lat&zoom=14&ui=0 */
export function parseEmbedQuery(query: Record<string, unknown>): EmbedOptions {
  const layersRaw = first(query.layers);
  const layers = layersRaw ? layersRaw.split(',').map((s) => s.trim()).filter(isLayer) : null;
  const zoom = Number(first(query.zoom));
  return {
    key: first(query.key),
    layers: layers && layers.length ? layers : null,
    center: parseLonLat(first(query.center)),
    zoom: first(query.zoom) && Number.isFinite(zoom) ? Math.min(22, Math.max(0, zoom)) : null,
    ui: first(query.ui) !== '0',
  };
}

// --- сайт-родитель ---------------------------------------------------------------------------

export interface FrameContext {
  framed: boolean;
  ancestorOrigins?: ArrayLike<string> | null;
  referrer: string;
}

const originOf = (url: string): string => {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.origin : '';
  } catch {
    return '';
  }
};

/** Сайт, в iframe которого открыта карта: null — открыта сама по себе, '' — родителя узнать нельзя */
export function parentOrigin(ctx: FrameContext): string | null {
  if (!ctx.framed) return null;
  const direct = ctx.ancestorOrigins && ctx.ancestorOrigins.length ? ctx.ancestorOrigins[0] : '';
  if (direct) return originOf(direct);
  return originOf(ctx.referrer);
}

/** Можно ли показывать карту: сама по себе или у себя (предпросмотр в ТГИД) — да; в iframe — только сайтам ключа */
export function frameAllowed(parent: string | null, allowed: string[], selfOrigin: string): boolean {
  if (parent === null || parent === selfOrigin) return true;
  return parent !== '' && allowed.includes(parent);
}

// --- сообщения -------------------------------------------------------------------------------

export type EmbedCommand =
  | { type: 'setView'; center?: [number, number]; zoom?: number }
  | { type: 'fitBounds'; bounds: [number, number, number, number]; padding?: number }
  | { type: 'setLayers'; layers: EmbedLayerId[] }
  | { type: 'highlight'; layer: EmbedLayerId; ids: number[] }
  | { type: 'getView'; id: string };

export type EmbedEvent =
  | { type: 'ready'; layers: EmbedLayerId[]; view: EmbedView }
  | { type: 'select'; layer: EmbedLayerId; id: number; properties: Record<string, unknown>; lngLat: [number, number] }
  | { type: 'moveend'; view: EmbedView; bounds: [number, number, number, number] }
  | { type: 'view'; id: string; view: EmbedView; bounds: [number, number, number, number] }
  | { type: 'error'; message: string };

const MAX_IDS = 500;

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Команда от сайта-родителя; всё, что не по протоколу, — null (не исполняется) */
export function parseCommand(data: unknown): EmbedCommand | null {
  if (!data || typeof data !== 'object') return null;
  const m = data as Record<string, unknown>;
  if (m.source !== EMBED_SOURCE || m.v !== EMBED_VERSION) return null;
  switch (m.type) {
    case 'setView': {
      const center = Array.isArray(m.center) ? parseLonLat(m.center.join(',')) : null;
      const zoom = finite(m.zoom) ? Math.min(22, Math.max(0, m.zoom)) : undefined;
      if (!center && zoom === undefined) return null;
      return { type: 'setView', ...(center ? { center } : {}), ...(zoom !== undefined ? { zoom } : {}) };
    }
    case 'fitBounds': {
      const b = m.bounds;
      if (!Array.isArray(b) || b.length !== 4 || !b.every(finite)) return null;
      const [w, s, e, n] = b as [number, number, number, number];
      if (!(w <= e && s <= n && Math.abs(w) <= 180 && Math.abs(e) <= 180 && Math.abs(s) <= 90 && Math.abs(n) <= 90)) return null;
      return { type: 'fitBounds', bounds: [w, s, e, n], ...(finite(m.padding) ? { padding: Math.min(200, Math.max(0, m.padding)) } : {}) };
    }
    case 'setLayers':
      if (!Array.isArray(m.layers)) return null;
      return { type: 'setLayers', layers: m.layers.filter((l): l is EmbedLayerId => typeof l === 'string' && isLayer(l)) };
    case 'highlight': {
      if (typeof m.layer !== 'string' || !isLayer(m.layer) || !Array.isArray(m.ids)) return null;
      const ids = m.ids.filter((i): i is number => Number.isInteger(i) && (i as number) > 0).slice(0, MAX_IDS);
      return { type: 'highlight', layer: m.layer, ids };
    }
    case 'getView':
      return typeof m.id === 'string' && m.id.length <= 64 ? { type: 'getView', id: m.id } : null;
    default:
      return null;
  }
}

export const eventMessage = (event: EmbedEvent) => ({ source: EMBED_SOURCE, v: EMBED_VERSION, ...event });

// --- карта -----------------------------------------------------------------------------------

export function embedTileUrl(apiBase: string, key: string, layer: EmbedLayerId): string {
  return `${apiBase.replace(/\/+$/, '')}${EMBED_TILES_PATH}${layer}/{z}/{x}/{y}?key=${encodeURIComponent(key)}`;
}

export const embedSourceId = (layer: EmbedLayerId) => `tgid-embed-${layer}`;

export const EMBED_COLORS = {
  supply: '#c62828',
  return: '#1565c0',
  both: '#6a1b9a',
  closed: '#757575',
  highlight: '#ff8f00',
  source: '#b71c1c',
  consumer: '#2e7d32',
  node: '#455a64',
} as const;

const HL = ['boolean', ['feature-state', 'hl'], false];

/** Слои MapLibre одного слоя ключа (подсветка — feature-state hl: id признака тайла = id объекта) */
export function embedMapLayers(layer: EmbedLayerInfo): Record<string, unknown>[] {
  const source = embedSourceId(layer.id);
  const base = { source, 'source-layer': layer.id, minzoom: layer.minzoom };
  if (layer.id === 'pipes') {
    return [{
      ...base, id: `${source}-line`, type: 'line',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['case', HL, EMBED_COLORS.highlight,
          ['any', ['==', ['get', 'state_supply'], 2], ['==', ['get', 'state_return'], 2]], EMBED_COLORS.closed,
          ['match', ['get', 'sign'], [2, 4], EMBED_COLORS.supply, [3, 5], EMBED_COLORS.return, EMBED_COLORS.both]],
        'line-width': ['interpolate', ['linear'], ['zoom'],
          10, ['case', HL, 4, ['interpolate', ['linear'], ['coalesce', ['get', 'diameter_mm'], 100], 100, 0.6, 1000, 2.5]],
          16, ['case', HL, 8, ['interpolate', ['linear'], ['coalesce', ['get', 'diameter_mm'], 100], 50, 1.5, 1000, 6]]],
      },
    }];
  }
  const circle = (color: unknown, radius: number, stroke = '#ffffff') => [{
    ...base, id: `${source}-circle`, type: 'circle',
    paint: {
      'circle-color': ['case', HL, EMBED_COLORS.highlight, color],
      'circle-radius': ['case', HL, radius + 3, radius],
      'circle-stroke-color': stroke,
      'circle-stroke-width': 1.5,
    },
  }];
  if (layer.id === 'heat_sources') return circle(EMBED_COLORS.source, 7);
  if (layer.id === 'consumers') return circle(EMBED_COLORS.consumer, 4);
  if (layer.id === 'nodes') return circle(EMBED_COLORS.node, 3);
  // задвижка: закрытая — тёмная, открытая — белая с тёмной обводкой
  return circle(['case', ['==', ['get', 'state'], 2], '#212121', '#ffffff'], 4, '#212121');
}

/** Слой MapLibre → слой ключа */
export function layerOfMapLayer(mapLayerId: string): EmbedLayerId | null {
  const m = /^tgid-embed-([a-z_]+)-(line|circle)$/.exec(mapLayerId);
  return m && isLayer(m[1]!) ? m[1] : null;
}

// --- карточка объекта ------------------------------------------------------------------------

const FIELD_LABELS: Record<string, string> = {
  name: 'Название',
  sign: 'Трубопровод',
  diameter_mm: 'Ду, мм',
  length_m: 'Длина, м',
  state_supply: 'Подача',
  state_return: 'Обратка',
  kind: 'Вид',
  load_gcal_h: 'Нагрузка, Гкал/ч',
  state: 'Состояние',
};

const STATE = (v: unknown) => (v === 2 ? 'закрыта' : v === 1 ? 'открыта' : '');
const SIGN: Record<number, string> = { 1: 'подача и обратка', 2: 'подача', 3: 'обратка', 4: 'подача', 5: 'обратка' };

function fieldText(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (field === 'state' || field === 'state_supply' || field === 'state_return') return STATE(value);
  if (field === 'sign') return SIGN[Number(value)] ?? '';
  if (field === 'kind') return value === 'generalized' ? 'обобщённый потребитель' : 'потребитель';
  if (typeof value === 'number') return value.toLocaleString('ru-RU', { maximumFractionDigits: field === 'load_gcal_h' ? 3 : 1 });
  return String(value).trim();
}

/** Строки карточки выбранного объекта: подпись и значение, пустые не показываются */
export function featureRows(properties: Record<string, unknown>): { label: string; value: string }[] {
  return Object.keys(FIELD_LABELS)
    .map((f) => ({ label: FIELD_LABELS[f]!, value: fieldText(f, properties[f]) }))
    .filter((r) => r.value !== '');
}

// --- код для сайта ---------------------------------------------------------------------------

export interface SnippetOptions {
  embedUrl: string;
  key: string;
  layers?: EmbedLayerId[] | null;
  height?: number;
}

export function embedPageUrl(opts: SnippetOptions): string {
  const q = new URLSearchParams({ key: opts.key });
  if (opts.layers && opts.layers.length) q.set('layers', opts.layers.join(','));
  return `${opts.embedUrl}?${q.toString()}`;
}

const attr = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Простейшее встраивание: iframe без JS */
export function iframeSnippet(opts: SnippetOptions): string {
  return `<iframe src="${attr(embedPageUrl(opts))}" title="Карта тепловой сети" width="100%" height="${opts.height ?? 480}"`
    + ' style="border:0" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>';
}

/** Встраивание через SDK: события выбора объекта и команды карте */
export function sdkSnippet(opts: SnippetOptions & { sdkUrl: string }): string {
  const layers = opts.layers && opts.layers.length ? `\n    layers: ${JSON.stringify(opts.layers)},` : '';
  return [
    '<div id="tgid-map" style="height:480px"></div>',
    `<script src="${attr(opts.sdkUrl)}"></script>`,
    '<script>',
    '  const map = TGIDEmbed.create(document.getElementById(\'tgid-map\'), {',
    `    url: ${JSON.stringify(opts.embedUrl)},`,
    `    key: ${JSON.stringify(opts.key)},${layers}`,
    '  });',
    '  map.on(\'select\', (e) => console.log(e.layer, e.id, e.properties));',
    '</script>',
  ].join('\n');
}
