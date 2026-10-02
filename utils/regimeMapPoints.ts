/**
 * «Показать все на карте» для результатов анализа режима (как gid6: все найденные объекты
 * подсвечиваются разом). Строки с latitude/longitude → GeoJSON-точки и охват для fitBounds.
 */
export interface RegimePointsResult {
  data: { type: 'FeatureCollection'; features: Array<{ type: 'Feature'; geometry: { type: 'Point'; coordinates: [number, number] }; properties: Record<string, unknown> }> };
  bounds: [[number, number], [number, number]] | null;
}

export function regimePoints(rows: Array<Record<string, any>>): RegimePointsResult {
  const features: RegimePointsResult['data']['features'] = [];
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const row of rows) {
    const lng = Number(row.longitude);
    const lat = Number(row.latitude);
    if (row.longitude == null || row.latitude == null || !Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: {} });
    minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
  }
  return {
    data: { type: 'FeatureCollection', features },
    bounds: features.length ? [[minLng, minLat], [maxLng, maxLat]] : null,
  };
}
