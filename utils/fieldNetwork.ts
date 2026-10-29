/**
 * Сеть вокруг наряда для полевого приложения: участки и узлы в радиусе от места работ — выборкой по условиям
 * (itwin-api POST /api/v1/network-select, «в N м от точки»), с сохранением на телефоне, чтобы карта места работ
 * открывалась без связи. Только фрагмент наряда: сценарии — копии фрагментов с той же геометрией.
 */
import type { SelectResult, SelectSpec } from '~/services/api/types';
import type { WorkOrder } from './workOrders';

/** Радиус: камеры и задвижки, которыми отключают участок, обычно в пределах квартала */
export const NETWORK_RADIUS_M = 300;
/** Сохранённое старше — обновить при связи (сеть правят, но не каждый час) */
export const NETWORK_MAX_AGE_MS = 12 * 3600_000;
const LIMIT = 2000;

export interface FieldNetwork {
  orderId: number;
  savedAt: string;
  lines: GeoJSON.FeatureCollection;
  nodes: GeoJSON.FeatureCollection;
  /** не всё вошло (густая сеть) — подпись на карте */
  truncated: boolean;
}

export function networkSpec(order: Pick<WorkOrder, 'lon' | 'lat' | 'fileid'>, target: 'lines' | 'nodes'): SelectSpec {
  return {
    target,
    conditions: [],
    match: 'all',
    near: { lon: order.lon, lat: order.lat, meters: NETWORK_RADIUS_M },
    in_view: false,
    fragment_ids: order.fileid ? [order.fileid] : null,
    order_by: null,
    order_desc: false,
    limit: LIMIT,
  };
}

/** Геометрия выборки с подписями из строк результата (у объектов GeoJSON — только id и фрагмент) */
export function resultToFeatures(res: SelectResult): GeoJSON.FeatureCollection {
  const items = new Map(res.items.map((i) => [i.id, i]));
  return {
    type: 'FeatureCollection',
    features: (res.geojson?.features ?? []).map((f) => {
      const item = items.get(Number(f.id ?? f.properties?.id));
      return {
        ...f,
        properties: {
          ...f.properties,
          title: item?.title ?? '',
          node_type: item?.node_type ?? null,
          card_type: item?.card_type ?? null,
        },
      };
    }),
  };
}

export function isFresh(net: Pick<FieldNetwork, 'savedAt'> | null | undefined, now = Date.now()): boolean {
  if (!net) return false;
  const t = Date.parse(net.savedAt);
  return Number.isFinite(t) && now - t < NETWORK_MAX_AGE_MS;
}

