/**
 * Плановые и аварийные отключения (itwin-api database/outages.py): статусы, переходы, подписи и слой карты.
 * Чистые функции — окно OutagesDialog.vue и оверлей MapViewer пользуются одними правилами.
 */

import type { PoiItem } from '~/utils/poi';

export type OutageStatus = 'planned' | 'announced' | 'active' | 'finished' | 'cancelled';
export type OutageKind = 'planned' | 'emergency';

export interface OutageValve {
  id: number;
  name: string | null;
  line_id: number | null;
  required: boolean;
  diameter: number | null;
  state: string | null;
  lng: number | null;
  lat: number | null;
}

export interface OutageConsumer {
  id: number;
  type: 'real' | 'generalized' | string;
  node_id: number | null;
  name: string | null;
  load: number;
  lng: number | null;
  lat: number | null;
  downstream: boolean;
}

export interface OutageConflict {
  id: number;
  number: string;
  title: string;
  status: OutageStatus;
  planned_start: string;
  planned_end: string;
  shared_consumers: number;
}

export interface OutageEvent {
  at: string;
  by_user: string;
  from_status: OutageStatus | null;
  to_status: OutageStatus | null;
  to_label: string | null;
  note: string;
}

export interface Outage {
  id: number;
  number: string;
  title: string;
  kind: OutageKind;
  kind_label: string;
  status: OutageStatus;
  status_label: string;
  next: OutageStatus[];
  recomputable: boolean;
  line_id: number | null;
  node_id: number | null;
  work_order_id: number | null;
  fileid: number | null;
  lon: number | null;
  lat: number | null;
  planned_start: string;
  planned_end: string;
  actual_start: string | null;
  actual_end: string | null;
  reason: string;
  public: boolean;
  public_note: string;
  consumers_count: number;
  load_gcal_h: number;
  computed_at: string | null;
  revision: number;
  valves?: OutageValve[];
  consumers?: OutageConsumer[];
  area?: GeoJSON.Geometry | null;
  events?: OutageEvent[];
  conflicts?: OutageConflict[];
  /** Школы, больницы и другие социальные объекты в зоне (itwin-api database/poi.py) */
  social?: PoiItem[];
}

export interface OutageList {
  items: Outage[];
  counts: Record<OutageStatus, number>;
}

export interface OutageInput {
  title: string;
  kind: OutageKind;
  line_id?: number | null;
  node_id?: number | null;
  work_order_id?: number | null;
  planned_start: string;
  planned_end: string;
  reason: string;
  public: boolean;
  public_note: string;
}

export const OUTAGE_STATUS_ORDER: OutageStatus[] = ['planned', 'announced', 'active', 'finished', 'cancelled'];
export const OUTAGE_STATUS_LABELS: Record<OutageStatus, string> = {
  planned: 'Запланировано', announced: 'Объявлено', active: 'Идёт', finished: 'Завершено', cancelled: 'Отменено',
};
export const OUTAGE_STATUS_COLORS: Record<OutageStatus, string> = {
  planned: 'blue-grey', announced: 'indigo', active: 'error', finished: 'success', cancelled: 'grey',
};
/** Цвет зоны на карте: идёт — красный, объявлено — оранжевый, запланировано — серо-синий */
export const OUTAGE_ZONE_COLORS: Record<OutageStatus, string> = {
  planned: '#546E7A', announced: '#EF6C00', active: '#D32F2F', finished: '#2E7D32', cancelled: '#9E9E9E',
};

export function outageTransitionLabel(from: OutageStatus, to: OutageStatus): string {
  if (to === 'announced') return 'Объявлено потребителям';
  if (to === 'active') return 'Отключили';
  if (to === 'finished') return 'Включили — завершить';
  if (to === 'cancelled') return 'Отменить';
  if (to === 'planned') return from === 'cancelled' ? 'Запланировать снова' : 'Вернуть в план';
  return to;
}

export function isOutageForward(from: OutageStatus, to: OutageStatus): boolean {
  if (to === 'cancelled') return false;
  if (from === 'cancelled') return to === 'planned';
  return OUTAGE_STATUS_ORDER.indexOf(to) > OUTAGE_STATUS_ORDER.indexOf(from);
}

/** Длительность отключения: «9 ч», «1 сут 3 ч», «45 мин» */
export function durationText(startIso: string, endIso: string): string {
  const minutes = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000);
  if (!Number.isFinite(minutes) || minutes <= 0) return '—';
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days) return hours ? `${days} сут ${hours} ч` : `${days} сут`;
  if (hours) return mins ? `${hours} ч ${mins} мин` : `${hours} ч`;
  return `${mins} мин`;
}

/**
 * Слой карты отключения: зона (полигон), задвижки (обязательные отдельно) и потребители (ниже по сети —
 * отдельно). kind в свойствах — по нему фильтруют слои оверлея.
 */
export function outageMapData(outage: Outage): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  if (outage.area) {
    features.push({ type: 'Feature', geometry: outage.area,
      properties: { kind: 'zone', color: OUTAGE_ZONE_COLORS[outage.status] } });
  }
  for (const v of outage.valves ?? []) {
    if (v.lng == null || v.lat == null) continue;
    features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [v.lng, v.lat] },
      properties: { kind: 'valve', required: v.required, name: v.name ?? `Задвижка ${v.id}` } });
  }
  for (const c of outage.consumers ?? []) {
    if (c.lng == null || c.lat == null) continue;
    features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
      properties: { kind: 'consumer', downstream: c.downstream, name: c.name ?? '' } });
  }
  return { type: 'FeatureCollection', features };
}

/** Зоны нескольких отключений (GET /api/v1/outages/geojson) — цвет по статусу */
export function zonesMapData(fc: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: fc.features.map((f) => ({
      ...f,
      properties: { ...f.properties, kind: 'zone',
        color: OUTAGE_ZONE_COLORS[(f.properties?.status ?? 'planned') as OutageStatus] ?? '#546E7A' },
    })),
  };
}
