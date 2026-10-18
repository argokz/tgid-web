/**
 * Ограничения следующей точки трассы (CAD), как Advanced Digitizing в QGIS и полярное
 * отслеживание в AutoCAD — только поведение, без чужого кода:
 *
 * - замок длины и угла (ввод с клавиатуры): точка ровно на заданном расстоянии / направлении;
 * - полярная привязка: направление прилипает к шагу (15/30/45/90°) от предыдущего участка
 *   трассы (для первого — от севера), если курсор близко к лучу;
 * - направляющие ∥ и ⊥ к соседней трубе: трубы у последней точки и ближайшая к курсору;
 * - Shift — «орто»: направление жёстко по шагу 90° (или по ближайшей направляющей).
 *
 * Угол в замке — поворот относительно предыдущего участка (+ вправо, − влево), а для первого
 * участка трассы — азимут от севера. Всё в метрах на земле (cadGeometry).
 */
import { bearingDeg, destination, localFrame, normalizeDeg180, normalizeDeg360, signedTurnDeg } from '~/utils/cadGeometry';
import type { LngLat } from '~/utils/lineVertices';

export type GuideKind = 'polar' | 'parallel' | 'perpendicular';

/** Шаги полярной привязки, градусы (0 — выкл) */
export const POLAR_STEPS = [0, 15, 30, 45, 90];
export const DEFAULT_POLAR_STEP = 45;
export const POLAR_STEP_ITEMS = POLAR_STEPS.map((v) => ({ value: v, title: v ? `${v}°` : 'выкл' }));

export interface ConstraintInput {
  /** последняя точка трассы */
  last: LngLat;
  /** предпоследняя точка — от её направления считается поворот; null — первый участок */
  prev: LngLat | null;
  cursor: LngLat;
  /** замок длины, м */
  lengthM?: number | null;
  /** замок угла: поворот (есть prev) или азимут (первый участок), градусы */
  angleDeg?: number | null;
  /** шаг полярной привязки, градусы; null/0 — выкл */
  polarStepDeg?: number | null;
  /** Shift: направление строго по шагу 90° или направляющей, без допуска */
  ortho?: boolean;
  /** азимуты соседних труб — направляющие ∥ и ⊥ */
  guideBearings?: readonly number[];
  /** допуск прилипания к лучу (поперёк, м) — радиус привязки на текущем масштабе */
  toleranceM: number;
}

export interface ConstraintResult {
  coord: LngLat;
  bearing: number;
  lengthM: number;
  /** поворот относительно предыдущего участка, null — первый участок */
  turnDeg: number | null;
  /** по какой направляющей легла точка (для пунктира и подписи) */
  guide: GuideKind | null;
  lockedLength: boolean;
  lockedAngle: boolean;
}

interface Candidate {
  bearing: number;
  kind: GuideKind;
}

const DEG = Math.PI / 180;

const candidates = (ref: number, step: number | null, guides: readonly number[]): Candidate[] => {
  const out: Candidate[] = [];
  if (step && step > 0) {
    for (let a = 0; a < 360 - 1e-9; a += step) out.push({ bearing: normalizeDeg360(ref + a), kind: 'polar' });
  }
  for (const g of guides) {
    out.push({ bearing: normalizeDeg360(g), kind: 'parallel' });
    out.push({ bearing: normalizeDeg360(g + 180), kind: 'parallel' });
    out.push({ bearing: normalizeDeg360(g + 90), kind: 'perpendicular' });
    out.push({ bearing: normalizeDeg360(g - 90), kind: 'perpendicular' });
  }
  return out;
};

/** Точка трассы с учётом замков и направляющих */
export const constrainPoint = (inp: ConstraintInput): ConstraintResult => {
  const f = localFrame(inp.last);
  const [x, y] = f.toXY(inp.cursor);
  const dist = Math.hypot(x, y);
  const cursorBearing = dist > 0 ? normalizeDeg360(Math.atan2(x, y) / DEG) : 0;
  const prevBearing = inp.prev ? bearingDeg(inp.prev, inp.last) : null;
  const lockedAngle = inp.angleDeg != null && Number.isFinite(inp.angleDeg);
  const lockedLength = inp.lengthM != null && Number.isFinite(inp.lengthM) && inp.lengthM > 0;

  let bearing = cursorBearing;
  let guide: GuideKind | null = null;
  if (lockedAngle) {
    bearing = normalizeDeg360((prevBearing ?? 0) + (inp.angleDeg as number));
  } else if (dist > 0) {
    const step = inp.ortho ? 90 : inp.polarStepDeg ?? null;
    const cands = candidates(prevBearing ?? 0, step, step ? (inp.guideBearings ?? []) : []);
    let best: Candidate | null = null;
    let bestDev = Infinity;
    for (const c of cands) {
      const dev = Math.abs(normalizeDeg180(cursorBearing - c.bearing));
      // направляющая сзади курсора не годится
      if (dev >= 90) continue;
      // при равенстве — шаг полярной привязки, а не труба (они идут первыми)
      if (dev < bestDev - 1e-9) {
        best = c;
        bestDev = dev;
      }
    }
    if (best && (inp.ortho || dist * Math.sin(bestDev * DEG) <= inp.toleranceM)) {
      bearing = best.bearing;
      guide = best.kind;
    }
  }

  let lengthM: number;
  if (lockedLength) {
    lengthM = inp.lengthM as number;
  } else if (lockedAngle || guide) {
    // курсор проецируется на луч направления
    lengthM = Math.max(0, dist * Math.cos(normalizeDeg180(cursorBearing - bearing) * DEG));
  } else {
    lengthM = dist;
  }

  const free = !lockedAngle && !lockedLength && !guide;
  return {
    coord: free ? inp.cursor : destination(inp.last, lengthM, bearing),
    bearing,
    lengthM,
    turnDeg: prevBearing == null ? null : signedTurnDeg(prevBearing, bearing),
    guide,
    lockedLength,
    lockedAngle,
  };
};
