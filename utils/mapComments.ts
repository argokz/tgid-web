/**
 * Комментарии на карте (фаза 2, п. 4 плана, по образцу Felt): ветка обсуждения в точке карты, @упоминания,
 * «решено», ссылка на вид. Сервер — itwin-api database/map_comments.py; здесь типы и чистые правила
 * (разбор упоминаний для показа, ссылка на ветку, точки для слоя карты).
 */

export type CommentStatus = 'open' | 'resolved' | 'all';
export type CommentScope = 'all' | 'mine';

export interface MapComment {
  id: number;
  body: string;
  mentions: string[];
  author: string;
  created_at: string;
  edited_at: string | null;
  deleted: boolean;
}

export interface MapThread {
  id: number;
  lon: number;
  lat: number;
  zoom: number | null;
  object_kind: 'line' | 'node' | null;
  object_id: number | null;
  created_by: string;
  created_at: string;
  last_at: string;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  comment_count: number;
  snippet: string;
  unread: boolean;
  mentions_me: boolean;
  comments?: MapComment[];
}

export interface MapThreadList {
  items: MapThread[];
  counts: { open: number; resolved: number };
  unread: number;
}

export interface MapThreadInput {
  lon: number;
  lat: number;
  zoom?: number | null;
  object_kind?: 'line' | 'node' | null;
  object_id?: number | null;
  body: string;
}

export interface CommentPerson {
  login: string;
  role: string;
}

export const COMMENT_COLORS = { open: '#1E88E5', resolved: '#90A4AE', unread: '#F4511E' } as const;
/** Слой точек веток: клик по нему открывает ветку, а не выбирает объект сети */
export const COMMENT_PIN_LAYER = 'map-comments-pins';

interface PinHitMap {
  getLayer: (id: string) => unknown;
  queryRenderedFeatures: (point: { x: number; y: number }, options: { layers: string[] }) => unknown[];
}

/** Клик пришёлся на точку ветки комментариев (обычный выбор объекта сети его пропускает) */
export function hitsCommentPin(map: PinHitMap | null | undefined, point: { x: number; y: number }): boolean {
  if (!map?.getLayer(COMMENT_PIN_LAYER)) return false;
  return map.queryRenderedFeatures(point, { layers: [COMMENT_PIN_LAYER] }).length > 0;
}
/** Ветка в адресе: …#map=…&c=12 — открыть ветку у коллеги */
export const COMMENT_HASH_KEY = 'c';

const MENTION_RE = /(^|[^\p{L}\p{N}_.@])@([\p{L}\p{N}_.-]{2,100})/gu;

export interface BodySegment {
  text: string;
  mention: boolean;
}

/** Текст сообщения на куски для показа: упоминания известных логинов — отдельно (подсветка без v-html) */
export function splitMentions(body: string, mentions: string[]): BodySegment[] {
  const known = new Set(mentions.map((m) => m.toLowerCase()));
  const out: BodySegment[] = [];
  let last = 0;
  for (const m of body.matchAll(MENTION_RE)) {
    const login = m[2].replace(/[.-]+$/, '');
    if (!known.has(login.toLowerCase())) continue;
    const start = (m.index ?? 0) + m[1].length;
    if (start > last) out.push({ text: body.slice(last, start), mention: false });
    out.push({ text: `@${login}`, mention: true });
    last = start + login.length + 1;
  }
  if (last < body.length) out.push({ text: body.slice(last), mention: false });
  return out;
}

/** Вставить «@логин » в текст (в конец, с пробелом-разделителем) */
export function addMention(body: string, login: string): string {
  const tag = `@${login}`;
  if (body.split(/\s+/).includes(tag)) return body;
  return body && !/\s$/.test(body) ? `${body} ${tag} ` : `${body}${tag} `;
}

/** «только что», «5 мин назад», «3 ч назад», иначе дата */
export function timeAgo(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const min = Math.floor((now - t) / 60_000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  if (min < 24 * 60) return `${Math.floor(min / 60)} ч назад`;
  return new Date(t).toLocaleDateString('ru-RU');
}

/** Номер ветки из «#…&c=12»; нет или не число — null */
export function threadFromHash(hash: string): number | null {
  for (const part of hash.replace(/^#/, '').split('&')) {
    const [key, value] = part.split('=');
    if (key === COMMENT_HASH_KEY && /^\d{1,9}$/.test(value ?? '')) return Number(value);
  }
  return null;
}

/** Ссылка на ветку: адрес страницы с видом карты на точке ветки и её номером */
export function threadLink(baseUrl: string, t: Pick<MapThread, 'id' | 'lon' | 'lat' | 'zoom'>): string {
  const zoom = Math.round((t.zoom ?? 17) * 100) / 100;
  return `${baseUrl.split('#')[0]}#map=${zoom}/${t.lat.toFixed(6)}/${t.lon.toFixed(6)}/0/0&${COMMENT_HASH_KEY}=${t.id}`;
}

/** Ветки (GET /api/v1/map-comments/geojson) → точки слоя: цвет — решено / есть новое / открыта */
export function threadMapFeatures(fc: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: fc.features.map((f) => {
      const p = f.properties ?? {};
      const color = p.resolved ? COMMENT_COLORS.resolved : p.unread ? COMMENT_COLORS.unread : COMMENT_COLORS.open;
      return { ...f, properties: { ...p, color, label: String(p.count ?? '') } };
    }),
  };
}
