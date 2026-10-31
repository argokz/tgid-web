/**
 * Теплосеть под землёй в 3D (itwin-api database/network3d.py): высоты точек трубы и цвет по глубине.
 * Глубина — до верха трубы у начала и конца участка; ось трубы ниже на радиус. Участок без глубины — на поверхности.
 */

/** [id, Ду мм, глубина у начала, у конца, участков в трубе, [lon, lat, …]] */
export type Network3dItem = [number, number | null, number | null, number | null, number, number[]];

export interface Network3dResponse {
  bbox: number[];
  truncated: boolean;
  lines: number;
  pipes: number;
  with_depth: number;
  items: Network3dItem[];
}

export interface DepthClass {
  key: string;
  label: string;
  color: string;
  max: number;
}

/** Классы глубины до верха трубы, м: один тон, светлее — мельче */
export const DEPTH_CLASSES: DepthClass[] = [
  { key: 'd1', label: 'до 1 м', color: '#9ecae1', max: 1 },
  { key: 'd2', label: '1–2 м', color: '#4292c6', max: 2 },
  { key: 'd3', label: '2–3 м', color: '#2171b5', max: 3 },
  { key: 'd4', label: 'глубже 3 м', color: '#08306b', max: Infinity },
];
export const NO_DEPTH = { key: 'none', label: 'глубина неизвестна (на поверхности)', color: '#9e9e9e' };
export const ABOVE_GROUND = { key: 'above', label: 'надземная прокладка', color: '#e6550d' };

const M_PER_DEG = 111_320;

/** Цвет трубы по средней глубине (минус — над землёй) */
export function depthColor(d0: number | null, d1: number | null): string {
  if (d0 == null || d1 == null) return NO_DEPTH.color;
  const mean = (d0 + d1) / 2;
  if (mean < 0) return ABOVE_GROUND.color;
  return (DEPTH_CLASSES.find((c) => mean < c.max) ?? DEPTH_CLASSES[DEPTH_CLASSES.length - 1]).color;
}

/**
 * Плоский массив [lon, lat, высота, …] оси трубы: глубина линейно по длине от начала к концу, ось ниже верха на
 * радиус; ground0/ground1 — высота поверхности у начала и конца (0 — эллипсоид, рельефа нет).
 */
export function pipePositions(item: Network3dItem, ground0 = 0, ground1 = ground0): number[] {
  const [, dn, d0, d1, , xy] = item;
  const n = xy.length / 2;
  const cum = [0];
  for (let i = 1; i < n; i++) {
    const lat = xy[i * 2 + 1] * Math.PI / 180;
    const dx = (xy[i * 2] - xy[i * 2 - 2]) * Math.cos(lat) * M_PER_DEG;
    const dy = (xy[i * 2 + 1] - xy[i * 2 - 1]) * M_PER_DEG;
    cum.push(cum[i - 1] + Math.hypot(dx, dy));
  }
  const total = cum[n - 1] || 1;
  const radius = (dn ?? 0) / 2000;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const f = cum[i] / total;
    const ground = ground0 + (ground1 - ground0) * f;
    const depth = d0 == null || d1 == null ? null : d0 + (d1 - d0) * f;
    out.push(xy[i * 2], xy[i * 2 + 1], depth == null ? ground : ground - depth - radius);
  }
  return out;
}

/** Толщина линии на экране, px: по Ду, чтобы магистрали читались */
export function pipeWidth(dn: number | null): number {
  if (!dn) return 2;
  return Math.min(8, Math.max(2, Math.round(dn / 150) + 1));
}
