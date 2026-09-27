/**
 * Правка вершин участка (этап 8.5): чистые операции над полилинией.
 *
 * Концы участка прибиты к его узлам — их нельзя сдвинуть или удалить здесь (сервер
 * тоже требует совпадения концов с узлами); чтобы перенести конец, перемещают узел.
 */

export type LngLat = [number, number];

export const isEndpoint = (index: number, length: number): boolean => index === 0 || index === length - 1;

/** Сдвиг промежуточной вершины; конец не двигается (возвращается исходный массив) */
export const moveVertex = (coords: LngLat[], index: number, point: LngLat): LngLat[] => {
  if (index < 0 || index >= coords.length || isEndpoint(index, coords.length)) return coords;
  const next = coords.slice();
  next[index] = [point[0], point[1]];
  return next;
};

/** Новая вершина после вершины afterIndex (между afterIndex и afterIndex + 1) */
export const insertVertex = (coords: LngLat[], afterIndex: number, point: LngLat): LngLat[] => {
  if (afterIndex < 0 || afterIndex >= coords.length - 1) return coords;
  const next = coords.slice();
  next.splice(afterIndex + 1, 0, [point[0], point[1]]);
  return next;
};

/** Удаление промежуточной вершины; концы и двухточечный участок не меняются */
export const removeVertex = (coords: LngLat[], index: number): LngLat[] => {
  if (coords.length <= 2 || index < 0 || index >= coords.length || isEndpoint(index, coords.length)) return coords;
  const next = coords.slice();
  next.splice(index, 1);
  return next;
};

/** Середины сегментов — «ручки» для вставки вершины: {afterIndex, coord} */
export const segmentMidpoints = (coords: LngLat[]): { afterIndex: number; coord: LngLat }[] =>
  coords.slice(0, -1).map((a, i) => {
    const b = coords[i + 1];
    return { afterIndex: i, coord: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as LngLat };
  });

/** Концы на месте узлов: правка сохраняет их как есть (сервер прижмёт к узлам) */
export const sameEndpoints = (a: LngLat[], b: LngLat[]): boolean =>
  a.length >= 2 && b.length >= 2
  && a[0][0] === b[0][0] && a[0][1] === b[0][1]
  && a[a.length - 1][0] === b[b.length - 1][0] && a[a.length - 1][1] === b[b.length - 1][1];

export const sameLine = (a: LngLat[], b: LngLat[]): boolean =>
  a.length === b.length && a.every((p, i) => p[0] === b[i][0] && p[1] === b[i][1]);

/** GeoJSON для слоя редактора: линия, вершины (fixed — концы) и середины сегментов */
export const vertexEditCollection = (coords: LngLat[]) => ({
  type: 'FeatureCollection' as const,
  features: [
    ...(coords.length >= 2
      ? [{
          type: 'Feature' as const,
          properties: { role: 'line' },
          geometry: { type: 'LineString' as const, coordinates: coords },
        }]
      : []),
    ...segmentMidpoints(coords).map((m) => ({
      type: 'Feature' as const,
      properties: { role: 'mid', index: m.afterIndex },
      geometry: { type: 'Point' as const, coordinates: m.coord },
    })),
    ...coords.map((c, i) => ({
      type: 'Feature' as const,
      properties: { role: 'vertex', index: i, fixed: isEndpoint(i, coords.length) },
      geometry: { type: 'Point' as const, coordinates: c },
    })),
  ],
});
