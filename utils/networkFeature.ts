/** Классификация объектов сети по отрисованному feature (слой, source-layer, таблица, геометрия) */
export const getFeatureKind = (feature: any): 'node' | 'line' | null => {
  const signature = [
    feature?.layer?.id,
    feature?.sourceLayer,
    feature?.layer?.['source-layer'],
    feature?.properties?.table,
    feature?.properties?.type
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (signature.includes('node') || signature.includes('узел')) return 'node';
  if (
    signature.includes('line')
    || signature.includes('pipe')
    || signature.includes('heatpipesection')
    || signature.includes('труб')
  ) return 'line';

  const geometryType = feature?.geometry?.type;
  if (geometryType === 'Point' || geometryType === 'MultiPoint') return 'node';
  if (geometryType === 'LineString' || geometryType === 'MultiLineString') return 'line';
  return null;
};

export const getFeatureId = (feature: any): number | null => {
  const rawId = feature?.properties?.id ?? feature?.properties?.Id ?? feature?.id;
  const id = Number(rawId);
  return Number.isFinite(id) && id > 0 ? id : null;
};
