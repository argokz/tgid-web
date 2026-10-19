import type maplibregl from 'maplibre-gl';

/**
 * Подсветка выделенного объекта редактора сети (узел — кольцо, участок — обводка).
 * Свой GeoJSON-источник поверх слоёв данных; после смены подложки слои добавляются заново.
 */
export const EDIT_SELECTION_SOURCE = 'edit-sel';
const LINE_LAYER = 'edit-sel-line';
const NODE_LAYER = 'edit-sel-node';
const COLOR = '#ff6d00';

export function useEditSelection(getMap: () => maplibregl.Map | null | undefined) {
  let data: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

  const ensure = (map: maplibregl.Map) => {
    if (!map.getSource(EDIT_SELECTION_SOURCE)) {
      map.addSource(EDIT_SELECTION_SOURCE, { type: 'geojson', data });
    }
    if (!map.getLayer(LINE_LAYER)) {
      map.addLayer({
        id: LINE_LAYER,
        type: 'line',
        source: EDIT_SELECTION_SOURCE,
        filter: ['==', ['geometry-type'], 'LineString'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': COLOR, 'line-width': 8, 'line-opacity': 0.5 },
      });
    }
    if (!map.getLayer(NODE_LAYER)) {
      map.addLayer({
        id: NODE_LAYER,
        type: 'circle',
        source: EDIT_SELECTION_SOURCE,
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': 10,
          'circle-color': 'rgba(0,0,0,0)',
          'circle-stroke-color': COLOR,
          'circle-stroke-width': 3,
        },
      });
    }
  };

  const render = () => {
    const map = getMap();
    if (!map) return;
    try {
      ensure(map);
      (map.getSource(EDIT_SELECTION_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(data);
    } catch {
      // стиль ещё грузится — подсветка появится при следующем выделении
    }
  };

  const show = (geometry: GeoJSON.Geometry | null | undefined) => {
    data = {
      type: 'FeatureCollection',
      features: geometry ? [{ type: 'Feature', properties: {}, geometry }] : [],
    };
    render();
  };

  const clear = () => show(null);

  const remove = () => {
    const map = getMap();
    if (!map) return;
    for (const id of [NODE_LAYER, LINE_LAYER]) if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(EDIT_SELECTION_SOURCE)) map.removeSource(EDIT_SELECTION_SOURCE);
  };

  return { show, clear, render, remove };
}
