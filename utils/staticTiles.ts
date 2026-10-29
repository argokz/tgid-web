/**
 * Статичные слои в PMTiles (itwin-api database/static_tiles.py): тайлы большого редко меняющегося слоя
 * (здания) запечены в архив, API отдаёт их по z/x/y. Слою каталога с таким архивом подменяется адрес
 * тайлов — стиль GeoServer тот же (тайлы — из той же функции martin). Чистые функции; загрузка списка —
 * MapViewer, заголовок авторизации тайлов — mapStore.transformRequest.
 */

export interface StaticTileArchive {
  layer: string;
  minzoom: number;
  maxzoom: number;
  bounds: [number, number, number, number];
  tiles: number;
  size: number;
  built_at: string | null;
  built_by: string | null;
  /** Версия архива в адресе тайлов: новый архив — новые адреса мимо кеша браузера */
  version: number;
}

export interface StaticTileLayer {
  layer: string;
  minzoom: number;
  static: boolean;
  table: string | null;
}

export interface StaticTilesList {
  archives: StaticTileArchive[];
  /** Слои, которые можно запечь (только администратору) */
  layers: StaticTileLayer[];
  can_build: boolean;
}

/** Источник тайлов слоя — архив PMTiles: зумы источника MapLibre (выше maxzoom — растяжение тайлов) */
export interface StaticTilesSource {
  layer: string;
  minzoom: number;
  maxzoom: number;
  version: number;
}

interface LayerLike {
  sourceLayer: string;
  workspace?: string;
  renderFormat?: 'mvt' | 'wms' | 'wmts';
  mvtUrl?: string;
  tileBounds?: [number, number, number, number];
  staticTiles?: StaticTilesSource;
}

export const STATIC_TILES_PATH = '/api/v1/static-tiles/';
/** Слой участков есть в рабочей области базы города — её слои и подменяются */
const NETWORK_LAYER = 'heatpipesections';

export const isStaticTileUrl = (url: string): boolean => url.includes(STATIC_TILES_PATH);

/** Абсолютный адрес API (MapLibre грузит тайлы по полному адресу) */
export function absoluteApiBase(apiBase: string, origin: string): string {
  const base = apiBase.replace(/\/+$/, '');
  if (/^https?:\/\//i.test(base)) return base;
  return `${origin.replace(/\/+$/, '')}${base.startsWith('/') ? '' : '/'}${base}`;
}

export function staticTileUrl(apiBase: string, archive: StaticTileArchive): string {
  return `${apiBase}${STATIC_TILES_PATH}${encodeURIComponent(archive.layer)}/{z}/{x}/{y}.mvt?v=${archive.version}`;
}

/** Рабочая область слоёв базы города: та, где слой участков; нет его — любая (если имя слоя одно) */
const cityWorkspace = (layers: LayerLike[]): string | undefined =>
  layers.find((l) => l.sourceLayer === NETWORK_LAYER)?.workspace;

/**
 * Слои каталога с архивом PMTiles → новые объекты с адресом тайлов API, зумами и охватом архива.
 * Подменяются только MVT-слои рабочей области базы города; остальные — как есть.
 */
export function applyStaticTiles<T extends LayerLike>(layers: T[], archives: StaticTileArchive[], apiBase: string): T[] {
  if (!archives.length) return layers;
  const byLayer = new Map(archives.map((a) => [a.layer, a]));
  const workspace = cityWorkspace(layers);
  return layers.map((layer) => {
    const archive = byLayer.get(layer.sourceLayer);
    if (!archive || !layer.mvtUrl || (layer.renderFormat && layer.renderFormat !== 'mvt')) return layer;
    if (workspace && layer.workspace && layer.workspace !== workspace) return layer;
    return {
      ...layer,
      mvtUrl: staticTileUrl(apiBase, archive),
      tileBounds: archive.bounds,
      staticTiles: { layer: archive.layer, minzoom: archive.minzoom, maxzoom: archive.maxzoom, version: archive.version },
    };
  });
}

/** «22 МБ», «850 КБ» */
export function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} МБ`;
  return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}
