/**
 * Социальные объекты (POI, фаза 2): школы, детские сады, больницы, поликлиники, соцучреждения — для выборок
 * «в 500 м от школ» и списка социальных объектов в зоне отключения. API — itwin-api routers/poi.py.
 * Здесь: категории и цвета, разбор CSV акимата в GeoJSON (точки), слой MapLibre.
 */

import type { OverlayLayerSpec } from '~/composables/useOverlayLayer';

export type PoiCategory = 'school' | 'kindergarten' | 'hospital' | 'clinic' | 'social';
export type PoiSource = 'consumers' | 'file' | 'osm';

export const POI_CATEGORIES: { id: PoiCategory; title: string; one: string; color: string }[] = [
  { id: 'school', title: 'Школы', one: 'школа', color: '#1565c0' },
  { id: 'kindergarten', title: 'Детские сады', one: 'детский сад', color: '#00897b' },
  { id: 'hospital', title: 'Больницы', one: 'больница', color: '#c62828' },
  { id: 'clinic', title: 'Поликлиники', one: 'поликлиника', color: '#ef6c00' },
  { id: 'social', title: 'Соцучреждения', one: 'соцучреждение', color: '#6a1b9a' },
];

export const POI_SOURCE_LABELS: Record<PoiSource, string> = {
  consumers: 'потребители сети',
  file: 'файл',
  osm: 'OpenStreetMap',
};

export const poiColor = (category: string): string =>
  POI_CATEGORIES.find((c) => c.id === category)?.color ?? '#546e7a';

export interface PoiItem {
  id: number;
  category: PoiCategory;
  category_label: string;
  name: string;
  address: string | null;
  source: PoiSource;
  hidden: boolean;
  lon: number;
  lat: number;
  consumers_count?: number | null;
}

export interface PoiSummary {
  categories: { id: PoiCategory; title: string; count: number; hidden: number; by_source: Partial<Record<PoiSource, number>> }[];
  sources: Record<PoiSource, string>;
  overpass: string;
}

export interface PoiImportResult {
  saved: number;
  removed: number;
  notes?: string[];
  outside?: number;
}

// --- CSV акимата → GeoJSON ------------------------------------------------------------------

const LON_KEYS = ['lon', 'lng', 'long', 'longitude', 'x', 'долгота'];
const LAT_KEYS = ['lat', 'latitude', 'y', 'широта'];

/** Строки CSV с кавычками («"Школа, №5"») и разделителем ; или , (какой чаще в заголовке) */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '');
  const header = clean.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = (header.match(/;/g)?.length ?? 0) >= (header.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]!;
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const toNumber = (s: string | undefined): number | null => {
  const n = Number(String(s ?? '').trim().replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && String(s ?? '').trim() !== '' ? n : null;
};

/** CSV с колонками долготы и широты (lon/lat, x/y, долгота/широта) → точки; остальные колонки — свойства */
export function csvToFeatures(text: string): { features: GeoJSON.Feature[]; skipped: number; error?: string } {
  const rows = parseCsv(text);
  if (rows.length < 2) return { features: [], skipped: 0, error: 'В файле нет строк с данными' };
  const header = rows[0]!.map((h) => h.trim());
  const lower = header.map((h) => h.toLowerCase());
  const lonIdx = lower.findIndex((h) => LON_KEYS.includes(h));
  const latIdx = lower.findIndex((h) => LAT_KEYS.includes(h));
  if (lonIdx < 0 || latIdx < 0) {
    return { features: [], skipped: 0, error: 'Нужны колонки долготы и широты: lon и lat (или x и y, долгота и широта)' };
  }
  const features: GeoJSON.Feature[] = [];
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const lon = toNumber(r[lonIdx]);
    const lat = toNumber(r[latIdx]);
    if (lon === null || lat === null) {
      skipped++;
      continue;
    }
    const properties: Record<string, string> = {};
    header.forEach((h, i) => {
      if (i !== lonIdx && i !== latIdx && h) properties[h] = (r[i] ?? '').trim();
    });
    features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties });
  }
  return { features, skipped };
}

/** Файл → объекты для загрузки: GeoJSON (FeatureCollection) или CSV */
export function fileFeatures(name: string, text: string): { features: GeoJSON.Feature[]; skipped: number; error?: string } {
  if (/\.csv$|\.txt$/i.test(name)) return csvToFeatures(text);
  try {
    const data = JSON.parse(text) as GeoJSON.FeatureCollection | GeoJSON.Feature;
    const features = data.type === 'FeatureCollection' ? data.features : data.type === 'Feature' ? [data] : [];
    return features.length ? { features, skipped: 0 } : { features: [], skipped: 0, error: 'В GeoJSON нет объектов' };
  } catch {
    return { features: [], skipped: 0, error: 'Файл — не GeoJSON и не CSV' };
  }
}

// --- карта ----------------------------------------------------------------------------------

export const POI_LAYER_IDS = ['poi-points', 'poi-labels'];

/** Точки с цветом категории; подписи — с 15-го зума */
export function poiLayers(): OverlayLayerSpec[] {
  const color: unknown[] = ['match', ['get', 'category']];
  for (const c of POI_CATEGORIES) color.push(c.id, c.color);
  color.push('#546e7a');
  return [
    {
      id: 'poi-points', type: 'circle',
      paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 16, 8], 'circle-color': color,
        'circle-stroke-width': 2, 'circle-stroke-color': '#fff' },
    },
    {
      id: 'poi-labels', type: 'symbol', minzoom: 15,
      layout: { 'text-field': ['get', 'name'], 'text-size': 11, 'text-offset': [0, 1.2], 'text-anchor': 'top',
        'text-max-width': 10 },
      paint: { 'text-color': color, 'text-halo-color': '#fff', 'text-halo-width': 1.5 },
    },
  ];
}
