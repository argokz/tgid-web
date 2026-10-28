/**
 * Ссылка на вид карты: центр, масштаб, поворот, наклон, видимые фрагменты и слои — в части
 * адреса после «#», чтобы открыть у коллеги то же место. Пример:
 *   #map=16.5/43.37722/76.99839/0/0&fr=42,74&ly=AlmatyGIS:uzel,AlmatyGIS:heatpipesections
 * Разбор строгий: неверные части отбрасываются, остальное применяется.
 */

export interface MapView {
  center: [number, number]; // [lng, lat]
  zoom: number;
  bearing: number;
  pitch: number;
}

export interface PermalinkState {
  view?: MapView;
  fragments?: number[];
  layers?: string[];
}

const MAX_ZOOM = 24;
const MAX_PITCH = 85;
const MAX_ITEMS = 200;
// id слоя GeoServer/карты: рабочая область:имя и служебные символы, без пробелов и «&,#»
const LAYER_ID_RE = /^[\w.:-]{1,120}$/;

const round = (value: number, digits: number): string => {
  const s = value.toFixed(digits);
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
};

export function formatPermalinkHash(state: PermalinkState): string {
  const parts: string[] = [];
  if (state.view) {
    const { center, zoom, bearing, pitch } = state.view;
    // 5 знаков широты/долготы — около 1 м, этого хватает, чтобы попасть в тот же узел
    parts.push(`map=${round(zoom, 2)}/${round(center[1], 5)}/${round(center[0], 5)}/${round(bearing, 1)}/${round(pitch, 1)}`);
  }
  if (state.fragments?.length) parts.push(`fr=${state.fragments.join(',')}`);
  if (state.layers?.length) parts.push(`ly=${state.layers.map(encodeURIComponent).join(',')}`);
  return parts.length ? `#${parts.join('&')}` : '';
}

function parseView(raw: string): MapView | undefined {
  const nums = raw.split('/').map(Number);
  if (nums.length < 3 || nums.length > 5 || nums.some((n) => !Number.isFinite(n))) return undefined;
  const [zoom, lat, lng, bearing = 0, pitch = 0] = nums;
  if (zoom < 0 || zoom > MAX_ZOOM || lat < -90 || lat > 90 || lng < -180 || lng > 180) return undefined;
  if (pitch < 0 || pitch > MAX_PITCH) return undefined;
  const normBearing = bearing >= 0 && bearing < 360 ? bearing : ((bearing % 360) + 360) % 360;
  return { center: [lng, lat], zoom, bearing: normBearing, pitch };
}

function parseFragments(raw: string): number[] | undefined {
  const ids = raw.split(',').map((s) => Number(s));
  if (!ids.length || ids.length > MAX_ITEMS || ids.some((id) => !Number.isInteger(id) || id <= 0)) return undefined;
  return [...new Set(ids)];
}

function parseLayers(raw: string): string[] | undefined {
  let ids: string[];
  try {
    ids = raw.split(',').map((s) => decodeURIComponent(s));
  } catch {
    return undefined;
  }
  if (!ids.length || ids.length > MAX_ITEMS || ids.some((id) => !LAYER_ID_RE.test(id))) return undefined;
  return [...new Set(ids)];
}

/** Разобрать «#map=…&fr=…&ly=…»; null — в адресе нет ссылки на вид карты. */
export function parsePermalinkHash(hash: string): PermalinkState | null {
  const body = hash.replace(/^#/, '');
  if (!body) return null;
  const state: PermalinkState = {};
  for (const part of body.split('&')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const key = part.slice(0, eq);
    const value = part.slice(eq + 1);
    if (key === 'map') state.view = parseView(value);
    else if (key === 'fr') state.fragments = parseFragments(value);
    else if (key === 'ly') state.layers = parseLayers(value);
  }
  if (!state.view) delete state.view;
  if (!state.fragments) delete state.fragments;
  if (!state.layers) delete state.layers;
  return Object.keys(state).length ? state : null;
}
