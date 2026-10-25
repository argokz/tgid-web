/**
 * Связь графика маршрута (пьезометр) с картой: какой узел маршрута ближе всего к курсору на карте. Чистая функция —
 * координаты узлов уже переведены в пиксели экрана (`map.project`), без запросов к слоям карты.
 */

export interface ScreenPoint {
  x: number;
  y: number;
}

/** Допуск попадания курсора в узел маршрута, px */
export const ROUTE_FOCUS_TOLERANCE_PX = 14;

/** Индекс ближайшей к курсору точки в пределах допуска; точки без координат (null) пропускаются */
export const nearestPointIndex = (
  points: ReadonlyArray<ScreenPoint | null>,
  cursor: ScreenPoint,
  tolerance = ROUTE_FOCUS_TOLERANCE_PX,
): number | null => {
  let best: number | null = null;
  let bestDistance = tolerance * tolerance;
  points.forEach((point, index) => {
    if (!point) return;
    const dx = point.x - cursor.x;
    const dy = point.y - cursor.y;
    const distance = dx * dx + dy * dy;
    if (distance <= bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
};
