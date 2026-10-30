/** Баланс расхода по зонам (itwin-api database/flow_balance.py): типы, подписи, слой зоны для карты. */

export type BalanceStatus = 'ok' | 'leak' | 'growth' | 'check' | 'open' | 'no_data';
export type ZoneKind = 'zone' | 'source' | 'open';

export interface BalanceMeter {
  sensor_id: number;
  code: string;
  line_id: number;
  pipe: 'supply' | 'return';
  direction: 'in' | 'out';
  fact: number;
  model: number;
}

export interface NightTrend {
  night: string;
  value: number;
  baseline: number;
  growth: number;
  threshold: number;
  nights: number;
  grew: boolean;
}

export interface BalanceZone {
  key: number;
  kind: ZoneKind;
  status: BalanceStatus;
  text: string;
  nodes: number;
  consumers: number;
  length_km: number;
  feeds: number[];
  boundary: number[];
  internal: number[];
  meters: BalanceMeter[];
  missing: string[];
  fact: number | null;
  model: number | null;
  excess: number | null;
  uncertainty: number | null;
  night: NightTrend | null;
}

export interface BalanceResult {
  zones: BalanceZone[];
  skipped: string[];
  accuracy_pct: number;
  window_min: number;
  night_hours?: [number, number];
}

export interface ZoneGeometry { key: number; lines: number; hull: boolean; geometry: GeoJSON.Geometry | null }

/** Вывод по зоне: подпись и цвет (статусные цвета — не категориальные) */
export const BALANCE_META: Record<BalanceStatus, { label: string; color: string }> = {
  ok: { label: 'сходится', color: '#2E7D32' },
  leak: { label: 'небаланс', color: '#C62828' },
  growth: { label: 'ночной рост', color: '#C62828' },
  check: { label: 'проверить', color: '#6A1B9A' },
  open: { label: 'не закрыта', color: '#616161' },
  no_data: { label: 'нет данных', color: '#616161' },
};

export const ZONE_KIND_LABELS: Record<ZoneKind, string> = {
  zone: 'зона между расходомерами',
  source: 'источник — подпитка',
  open: 'с питающей точкой без расходомера',
};

/** Подпись величины притока: т/ч, со знаком для небаланса */
export function flowText(v: number | null | undefined, signed = false): string {
  if (v == null) return '—';
  const s = Math.abs(v).toLocaleString('ru-RU', { maximumFractionDigits: 0 });
  if (!signed) return `${v < 0 ? '−' : ''}${s}`;
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${s}`;
}

/** Зона на карте: участки (или контур крупной зоны) цвета вывода */
export function zoneFeature(zone: BalanceZone, geom: ZoneGeometry): GeoJSON.FeatureCollection {
  if (!geom.geometry) return { type: 'FeatureCollection', features: [] };
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: geom.geometry,
      properties: { name: `Зона ${zone.key}`, color: BALANCE_META[zone.status].color },
    }],
  };
}
