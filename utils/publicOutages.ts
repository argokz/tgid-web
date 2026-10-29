/**
 * Публичная карта отключений (страница pages/outages.vue): лента /api/v1/public/outages — только зона, сроки,
 * число потребителей и текст для жителей. Чистые функции порядка, подписей и цвета.
 */
import { formatDateTime } from '~/utils/workOrders';

export interface PublicOutageProps {
  id: number;
  number: string;
  kind: 'planned' | 'emergency';
  kind_label: string;
  status: 'announced' | 'active';
  status_label: string;
  planned_start: string;
  planned_end: string;
  consumers_count: number;
  note: string;
}

export type PublicOutageFeature = GeoJSON.Feature<GeoJSON.Geometry, PublicOutageProps>;

export const PUBLIC_COLORS: Record<PublicOutageProps['status'], string> = {
  active: '#D32F2F',
  announced: '#EF6C00',
};

/** Сначала идущие, затем объявленные; внутри — по началу */
export function sortOutages(features: PublicOutageFeature[]): PublicOutageFeature[] {
  const rank = (f: PublicOutageFeature) => (f.properties.status === 'active' ? 0 : 1);
  return [...features].sort((a, b) => rank(a) - rank(b)
    || a.properties.planned_start.localeCompare(b.properties.planned_start));
}

/** «Идёт сейчас» / «Плановое, объявлено» / «Аварийное» */
export function statusText(p: PublicOutageProps): string {
  if (p.status === 'active') return p.kind === 'emergency' ? 'Аварийное — идёт сейчас' : 'Идёт сейчас';
  return p.kind === 'emergency' ? 'Аварийное, объявлено' : 'Плановое, объявлено';
}

/** «с 02.11.2026 09:00 до 02.11.2026 18:00»; в один день — «02.11.2026 с 09:00 до 18:00» */
export function periodText(p: Pick<PublicOutageProps, 'planned_start' | 'planned_end'>): string {
  const start = formatDateTime(p.planned_start);
  const end = formatDateTime(p.planned_end);
  const [sd, st] = start.split(' ');
  const [ed, et] = end.split(' ');
  if (sd && sd === ed) return `${sd} с ${st} до ${et}`;
  return `с ${start} до ${end}`;
}

/** «12 зданий и абонентов» — склонение по числу */
export function consumersText(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  const word = mod10 === 1 && mod100 !== 11 ? 'потребитель'
    : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'потребителя' : 'потребителей';
  return `${n} ${word}`;
}

/** Слой карты: цвет зоны по статусу */
export function zonesForMap(features: PublicOutageFeature[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: features.map((f) => ({ ...f, properties: { ...f.properties, color: PUBLIC_COLORS[f.properties.status] } })),
  };
}
