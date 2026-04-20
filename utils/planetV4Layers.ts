import type { LayerSpecification, Map } from 'maplibre-gl'

export interface PlanetLayerDef {
  sourceLayer: string
  label: string
  group: PlanetLayerGroup
  defaultVisible: boolean
  minzoom: number
  maxzoom: number
  buildLayers: (sourceId: string) => Omit<LayerSpecification, 'source'>[]
}

export type PlanetLayerGroup =
  | 'nature'
  | 'landuse'
  | 'water'
  | 'borders'
  | 'transport'
  | 'buildings'
  | 'poi'
  | 'labels'

export const PLANET_GROUP_LABELS: Record<PlanetLayerGroup, string> = {
  nature: 'Природа и покров',
  landuse: 'Землепользование',
  water: 'Вода',
  borders: 'Границы',
  transport: 'Транспорт',
  buildings: 'Здания',
  poi: 'Объекты (POI)',
  labels: 'Подписи',
}

export const PLANET_GROUP_ICONS: Record<PlanetLayerGroup, string> = {
  nature: 'mdi-tree',
  landuse: 'mdi-texture-box',
  water: 'mdi-water',
  borders: 'mdi-flag-variant-outline',
  transport: 'mdi-road-variant',
  buildings: 'mdi-office-building',
  poi: 'mdi-map-marker',
  labels: 'mdi-format-text',
}

export const PLANET_GROUP_ORDER: PlanetLayerGroup[] = [
  'nature', 'landuse', 'water', 'borders', 'transport', 'buildings', 'poi', 'labels',
]

const FONT_REGULAR = ['Open Sans Regular', 'Arial Unicode MS Regular']
const FONT_BOLD = ['Open Sans Bold', 'Arial Unicode MS Regular']
const FONT_SEMIBOLD = ['Open Sans Semibold', 'Arial Unicode MS Regular']

function planetLayerId(sourceLayer: string, suffix?: string): string {
  return `base-planet-${sourceLayer}${suffix ? `-${suffix}` : ''}`
}

function nameField(): any {
  return ['coalesce', ['get', 'name:ru'], ['get', 'name']]
}

export const PLANET_V4_LAYERS: PlanetLayerDef[] = [
  // ═══════════════════════ ПРИРОДА И ПОКРОВ ═══════════════════════
  {
    sourceLayer: 'vegetation', label: 'Растительность', group: 'nature',
    defaultVisible: false, minzoom: 0, maxzoom: 9,
    buildLayers: (s) => [{
      id: planetLayerId('vegetation'), type: 'fill', 'source-layer': 'vegetation',
      paint: { 'fill-color': '#c8e6a0', 'fill-opacity': 0.6 },
    }],
  },
  {
    sourceLayer: 'scrub', label: 'Кустарники', group: 'nature',
    defaultVisible: false, minzoom: 0, maxzoom: 9,
    buildLayers: (s) => [{
      id: planetLayerId('scrub'), type: 'fill', 'source-layer': 'scrub',
      paint: { 'fill-color': '#d2e4b0', 'fill-opacity': 0.6 },
    }],
  },
  {
    sourceLayer: 'wood', label: 'Лес (wood)', group: 'nature',
    defaultVisible: false, minzoom: 0, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('wood'), type: 'fill', 'source-layer': 'wood',
      paint: { 'fill-color': '#a0d468', 'fill-opacity': 0.5 },
    }],
  },
  {
    sourceLayer: 'forest', label: 'Лес (forest)', group: 'nature',
    defaultVisible: false, minzoom: 0, maxzoom: 9,
    buildLayers: (s) => [{
      id: planetLayerId('forest'), type: 'fill', 'source-layer': 'forest',
      paint: { 'fill-color': '#8cc152', 'fill-opacity': 0.45 },
    }],
  },
  {
    sourceLayer: 'grass', label: 'Трава / Газоны', group: 'nature',
    defaultVisible: false, minzoom: 7, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('grass'), type: 'fill', 'source-layer': 'grass', minzoom: 7,
      paint: { 'fill-color': '#cdebb0', 'fill-opacity': 0.6 },
    }],
  },
  {
    sourceLayer: 'wetland', label: 'Болота', group: 'nature',
    defaultVisible: false, minzoom: 7, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('wetland'), type: 'fill', 'source-layer': 'wetland', minzoom: 7,
      paint: { 'fill-color': '#b8ddd0', 'fill-opacity': 0.5 },
    }],
  },
  {
    sourceLayer: 'farmland', label: 'Сельхозугодья', group: 'nature',
    defaultVisible: false, minzoom: 8, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('farmland'), type: 'fill', 'source-layer': 'farmland', minzoom: 8,
      paint: { 'fill-color': '#eef0d5', 'fill-opacity': 0.6 },
    }],
  },
  {
    sourceLayer: 'ice', label: 'Лёд / Ледники', group: 'nature',
    defaultVisible: false, minzoom: 0, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('ice'), type: 'fill', 'source-layer': 'ice',
      paint: { 'fill-color': '#e8f4fc' },
    }],
  },
  {
    sourceLayer: 'rock', label: 'Скалы', group: 'nature',
    defaultVisible: false, minzoom: 7, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('rock'), type: 'fill', 'source-layer': 'rock', minzoom: 7,
      paint: { 'fill-color': '#d8d0c8', 'fill-opacity': 0.6 },
    }],
  },
  {
    sourceLayer: 'sand', label: 'Песок / Пляжи', group: 'nature',
    defaultVisible: false, minzoom: 7, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('sand'), type: 'fill', 'source-layer': 'sand', minzoom: 7,
      paint: { 'fill-color': '#f5e8c8', 'fill-opacity': 0.7 },
    }],
  },

  // ═══════════════════════ ЗЕМЛЕПОЛЬЗОВАНИЕ ═══════════════════════
  {
    sourceLayer: 'protected_area', label: 'Охраняемые территории', group: 'landuse',
    defaultVisible: false, minzoom: 4, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('protected_area'), type: 'fill', 'source-layer': 'protected_area', minzoom: 4,
      paint: { 'fill-color': '#b8e6a8', 'fill-opacity': 0.25 },
    }, {
      id: planetLayerId('protected_area', 'outline'), type: 'line', 'source-layer': 'protected_area', minzoom: 4,
      paint: { 'line-color': '#5a9e46', 'line-width': 1, 'line-dasharray': [3, 2], 'line-opacity': 0.6 },
    }],
  },
  {
    sourceLayer: 'residential', label: 'Жилые зоны', group: 'landuse',
    defaultVisible: false, minzoom: 4, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('residential'), type: 'fill', 'source-layer': 'residential', minzoom: 4,
      paint: { 'fill-color': '#e8e0d8', 'fill-opacity': 0.5 },
    }],
  },
  {
    sourceLayer: 'cemetery', label: 'Кладбища', group: 'landuse',
    defaultVisible: false, minzoom: 7, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('cemetery'), type: 'fill', 'source-layer': 'cemetery', minzoom: 7,
      paint: { 'fill-color': '#aacbaf', 'fill-opacity': 0.6 },
    }],
  },
  {
    sourceLayer: 'commercial', label: 'Коммерческие зоны', group: 'landuse',
    defaultVisible: false, minzoom: 10, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('commercial'), type: 'fill', 'source-layer': 'commercial', minzoom: 10,
      paint: { 'fill-color': '#f0dece', 'fill-opacity': 0.5 },
    }],
  },
  {
    sourceLayer: 'dam', label: 'Дамбы', group: 'landuse',
    defaultVisible: false, minzoom: 10, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('dam'), type: 'fill', 'source-layer': 'dam', minzoom: 10,
      paint: { 'fill-color': '#b8b8b8', 'fill-opacity': 0.6 },
    }],
  },
  {
    sourceLayer: 'education', label: 'Образование', group: 'landuse',
    defaultVisible: false, minzoom: 10, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('education'), type: 'fill', 'source-layer': 'education', minzoom: 10,
      paint: { 'fill-color': '#e8d8f0', 'fill-opacity': 0.5 },
    }],
  },
  {
    sourceLayer: 'hospital', label: 'Больницы', group: 'landuse',
    defaultVisible: false, minzoom: 10, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('hospital'), type: 'fill', 'source-layer': 'hospital', minzoom: 10,
      paint: { 'fill-color': '#fce0e0', 'fill-opacity': 0.5 },
    }],
  },
  {
    sourceLayer: 'industrial', label: 'Промзоны', group: 'landuse',
    defaultVisible: false, minzoom: 8, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('industrial'), type: 'fill', 'source-layer': 'industrial', minzoom: 8,
      paint: { 'fill-color': '#e0d8e0', 'fill-opacity': 0.5 },
    }],
  },
  {
    sourceLayer: 'leisure', label: 'Досуг / Отдых', group: 'landuse',
    defaultVisible: false, minzoom: 10, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('leisure'), type: 'fill', 'source-layer': 'leisure', minzoom: 10,
      paint: { 'fill-color': '#d0f0c0', 'fill-opacity': 0.5 },
    }],
  },
  {
    sourceLayer: 'military', label: 'Военные объекты', group: 'landuse',
    defaultVisible: false, minzoom: 8, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('military'), type: 'fill', 'source-layer': 'military', minzoom: 8,
      paint: { 'fill-color': '#e0cece', 'fill-opacity': 0.4 },
    }],
  },
  {
    sourceLayer: 'parking', label: 'Парковки', group: 'landuse',
    defaultVisible: false, minzoom: 15, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('parking'), type: 'fill', 'source-layer': 'parking', minzoom: 15,
      paint: { 'fill-color': '#eeeeee', 'fill-opacity': 0.7 },
    }],
  },
  {
    sourceLayer: 'construction', label: 'Стройплощадки', group: 'landuse',
    defaultVisible: false, minzoom: 8, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('construction'), type: 'fill', 'source-layer': 'construction', minzoom: 8,
      paint: { 'fill-color': '#e0d8c0', 'fill-opacity': 0.45 },
    }],
  },

  // ═══════════════════════ ВОДА ═══════════════════════
  {
    sourceLayer: 'water', label: 'Водоёмы', group: 'water',
    defaultVisible: true, minzoom: 0, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('water'), type: 'fill', 'source-layer': 'water',
      paint: { 'fill-color': '#a0c8f0' },
    }],
  },
  {
    sourceLayer: 'waterway', label: 'Водотоки', group: 'water',
    defaultVisible: false, minzoom: 3, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('waterway'), type: 'line', 'source-layer': 'waterway', minzoom: 3,
      paint: {
        'line-color': '#7bbce8',
        'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.4, 12, 1.5, 15, 2.4],
      },
    }],
  },
  {
    sourceLayer: 'water_label', label: 'Подписи водоёмов', group: 'water',
    defaultVisible: false, minzoom: 0, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('water_label'), type: 'symbol', 'source-layer': 'water_label', minzoom: 3,
      layout: {
        'symbol-placement': 'line',
        'text-field': nameField(), 'text-size': ['interpolate', ['linear'], ['zoom'], 3, 10, 12, 13],
        'text-font': FONT_REGULAR, 'text-letter-spacing': 0.1,
      },
      paint: { 'text-color': '#4a80b0', 'text-halo-color': '#ffffff', 'text-halo-width': 1.2 },
    }],
  },
  {
    sourceLayer: 'water_centroid', label: 'Центроиды воды', group: 'water',
    defaultVisible: false, minzoom: 0, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('water_centroid'), type: 'symbol', 'source-layer': 'water_centroid', minzoom: 4,
      layout: {
        'text-field': nameField(), 'text-size': ['interpolate', ['linear'], ['zoom'], 4, 9, 12, 12],
        'text-font': FONT_REGULAR,
      },
      paint: { 'text-color': '#4a80b0', 'text-halo-color': '#ffffff', 'text-halo-width': 1 },
    }],
  },

  // ═══════════════════════ ГРАНИЦЫ ═══════════════════════
  {
    sourceLayer: 'country_border', label: 'Границы стран', group: 'borders',
    defaultVisible: true, minzoom: 0, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('country_border'), type: 'line', 'source-layer': 'country_border',
      paint: {
        'line-color': '#8b7eaa', 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.6, 4, 1.2, 10, 2],
      },
    }],
  },
  {
    sourceLayer: 'country_border_disputed', label: 'Спорные границы', group: 'borders',
    defaultVisible: false, minzoom: 0, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('country_border_disputed'), type: 'line', 'source-layer': 'country_border_disputed',
      paint: {
        'line-color': '#a08080', 'line-dasharray': [4, 2],
        'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.4, 8, 1],
      },
    }],
  },
  {
    sourceLayer: 'sub_border', label: 'Региональные границы', group: 'borders',
    defaultVisible: false, minzoom: 2, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('sub_border'), type: 'line', 'source-layer': 'sub_border', minzoom: 2,
      paint: {
        'line-color': '#b2b2b2', 'line-dasharray': [3, 1],
        'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.2, 10, 0.8],
      },
    }],
  },

  // ═══════════════════════ ТРАНСПОРТ ═══════════════════════
  {
    sourceLayer: 'road', label: 'Дороги', group: 'transport',
    defaultVisible: true, minzoom: 4, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('road', 'casing'), type: 'line', 'source-layer': 'road', minzoom: 7,
      paint: {
        'line-color': '#c0b8a8',
        'line-width': ['interpolate', ['linear'], ['zoom'],
          7, 0,
          10, ['match', ['get', 'class'], ['motorway', 'trunk'], 3.5, ['primary'], 2.5, 1.8],
          15, ['match', ['get', 'class'], ['motorway', 'trunk'], 10, ['primary'], 7, 5],
        ],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0, 8, 0.5],
      },
    }, {
      id: planetLayerId('road'), type: 'line', 'source-layer': 'road', minzoom: 4,
      paint: {
        'line-color': ['match', ['get', 'class'],
          'motorway', '#ffa35c',
          'trunk', '#ffcc80',
          'primary', '#fce390',
          'secondary', '#ffffff',
          '#ffffff',
        ],
        'line-width': ['interpolate', ['linear'], ['zoom'],
          4, 0.3,
          8, ['match', ['get', 'class'], ['motorway', 'trunk'], 1.8, ['primary'], 1.2, 0.8],
          12, ['match', ['get', 'class'], ['motorway', 'trunk'], 4, ['primary'], 2.8, 2],
          15, ['match', ['get', 'class'], ['motorway', 'trunk'], 8, ['primary'], 5.5, 4],
        ],
      },
    }],
  },
  {
    sourceLayer: 'road_label', label: 'Подписи дорог', group: 'transport',
    defaultVisible: true, minzoom: 6, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('road_label'), type: 'symbol', 'source-layer': 'road_label', minzoom: 10,
      layout: {
        'symbol-placement': 'line', 'text-field': ['coalesce', ['get', 'name'], ['get', 'ref']],
        'text-size': ['interpolate', ['linear'], ['zoom'], 10, 9, 15, 12],
        'text-font': FONT_REGULAR, 'text-max-angle': 30,
      },
      paint: { 'text-color': '#6b6b6b', 'text-halo-color': '#ffffff', 'text-halo-width': 1.2 },
    }],
  },
  {
    sourceLayer: 'road_exit', label: 'Съезды', group: 'transport',
    defaultVisible: false, minzoom: 10, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('road_exit'), type: 'symbol', 'source-layer': 'road_exit', minzoom: 12,
      layout: {
        'text-field': ['get', 'ref'], 'text-size': 9, 'text-font': FONT_SEMIBOLD,
      },
      paint: { 'text-color': '#ffffff', 'text-halo-color': '#4a7da8', 'text-halo-width': 1.8 },
    }],
  },
  {
    sourceLayer: 'railway', label: 'Железные дороги', group: 'transport',
    defaultVisible: false, minzoom: 6, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('railway'), type: 'line', 'source-layer': 'railway', minzoom: 6,
      paint: {
        'line-color': '#8c7e7e',
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.4, 14, 1.6],
        'line-dasharray': [3, 2],
      },
    }],
  },
  {
    sourceLayer: 'railway_label', label: 'Подписи ж/д', group: 'transport',
    defaultVisible: false, minzoom: 10, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('railway_label'), type: 'symbol', 'source-layer': 'railway_label', minzoom: 12,
      layout: {
        'symbol-placement': 'line', 'text-field': nameField(), 'text-size': 9,
        'text-font': FONT_REGULAR,
      },
      paint: { 'text-color': '#706060', 'text-halo-color': '#ffffff', 'text-halo-width': 1 },
    }],
  },
  {
    sourceLayer: 'aerialway', label: 'Канатные дороги', group: 'transport',
    defaultVisible: false, minzoom: 7, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('aerialway'), type: 'line', 'source-layer': 'aerialway', minzoom: 10,
      paint: { 'line-color': '#808080', 'line-width': 1.2, 'line-dasharray': [6, 2] },
    }],
  },
  {
    sourceLayer: 'aerialway_label', label: 'Подписи канатных', group: 'transport',
    defaultVisible: false, minzoom: 7, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('aerialway_label'), type: 'symbol', 'source-layer': 'aerialway_label', minzoom: 12,
      layout: {
        'symbol-placement': 'line', 'text-field': nameField(), 'text-size': 9,
        'text-font': FONT_REGULAR,
      },
      paint: { 'text-color': '#606060', 'text-halo-color': '#ffffff', 'text-halo-width': 1 },
    }],
  },
  {
    sourceLayer: 'aviation', label: 'Авиация (зоны)', group: 'transport',
    defaultVisible: false, minzoom: 7, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('aviation'), type: 'fill', 'source-layer': 'aviation', minzoom: 8,
      paint: { 'fill-color': '#e0daf0', 'fill-opacity': 0.4 },
    }],
  },
  {
    sourceLayer: 'aviation_line', label: 'Авиация (ВПП)', group: 'transport',
    defaultVisible: false, minzoom: 8, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('aviation_line'), type: 'line', 'source-layer': 'aviation_line', minzoom: 8,
      paint: { 'line-color': '#9090a8', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 14, 4] },
    }],
  },
  {
    sourceLayer: 'bridge', label: 'Мосты', group: 'transport',
    defaultVisible: false, minzoom: 8, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('bridge'), type: 'fill', 'source-layer': 'bridge', minzoom: 12,
      paint: { 'fill-color': '#d8d0c8', 'fill-opacity': 0.5 },
    }],
  },
  {
    sourceLayer: 'bridge_label', label: 'Подписи мостов', group: 'transport',
    defaultVisible: false, minzoom: 10, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('bridge_label'), type: 'symbol', 'source-layer': 'bridge_label', minzoom: 13,
      layout: { 'text-field': nameField(), 'text-size': 10, 'text-font': FONT_REGULAR },
      paint: { 'text-color': '#606060', 'text-halo-color': '#ffffff', 'text-halo-width': 1 },
    }],
  },
  {
    sourceLayer: 'ferry', label: 'Паромы', group: 'transport',
    defaultVisible: false, minzoom: 4, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('ferry'), type: 'line', 'source-layer': 'ferry', minzoom: 5,
      paint: { 'line-color': '#80a0c0', 'line-width': 1.2, 'line-dasharray': [6, 3] },
    }],
  },
  {
    sourceLayer: 'ferry_label', label: 'Подписи паромов', group: 'transport',
    defaultVisible: false, minzoom: 4, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('ferry_label'), type: 'symbol', 'source-layer': 'ferry_label', minzoom: 8,
      layout: {
        'symbol-placement': 'line', 'text-field': nameField(), 'text-size': 10,
        'text-font': FONT_REGULAR,
      },
      paint: { 'text-color': '#4a80b0', 'text-halo-color': '#ffffff', 'text-halo-width': 1 },
    }],
  },
  {
    sourceLayer: 'pedestrian', label: 'Пешеходные зоны', group: 'transport',
    defaultVisible: false, minzoom: 12, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('pedestrian'), type: 'fill', 'source-layer': 'pedestrian', minzoom: 13,
      paint: { 'fill-color': '#f0e8d8', 'fill-opacity': 0.6 },
    }],
  },
  {
    sourceLayer: 'pedestrian_label', label: 'Подписи пешеходных', group: 'transport',
    defaultVisible: false, minzoom: 12, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('pedestrian_label'), type: 'symbol', 'source-layer': 'pedestrian_label', minzoom: 14,
      layout: { 'text-field': nameField(), 'text-size': 9, 'text-font': FONT_REGULAR },
      paint: { 'text-color': '#7a6a58', 'text-halo-color': '#ffffff', 'text-halo-width': 1 },
    }],
  },
  {
    sourceLayer: 'pathway', label: 'Тропинки', group: 'transport',
    defaultVisible: false, minzoom: 12, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('pathway'), type: 'line', 'source-layer': 'pathway', minzoom: 13,
      paint: { 'line-color': '#c0b098', 'line-width': 0.8, 'line-dasharray': [4, 2] },
    }],
  },
  {
    sourceLayer: 'pathway_label', label: 'Подписи тропинок', group: 'transport',
    defaultVisible: false, minzoom: 12, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('pathway_label'), type: 'symbol', 'source-layer': 'pathway_label', minzoom: 14,
      layout: {
        'symbol-placement': 'line', 'text-field': nameField(), 'text-size': 9,
        'text-font': FONT_REGULAR,
      },
      paint: { 'text-color': '#8a7a68', 'text-halo-color': '#ffffff', 'text-halo-width': 1 },
    }],
  },
  {
    sourceLayer: 'pier', label: 'Причалы', group: 'transport',
    defaultVisible: false, minzoom: 9, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('pier'), type: 'fill', 'source-layer': 'pier', minzoom: 11,
      paint: { 'fill-color': '#d8d0c0', 'fill-opacity': 0.7 },
    }],
  },
  {
    sourceLayer: 'traffic_control', label: 'Ограждения / барьеры', group: 'transport',
    defaultVisible: false, minzoom: 15, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('traffic_control'), type: 'line', 'source-layer': 'traffic_control', minzoom: 15,
      paint: { 'line-color': '#a0a0a0', 'line-width': 0.8 },
    }],
  },

  // ═══════════════════════ ЗДАНИЯ ═══════════════════════
  {
    sourceLayer: 'building', label: 'Здания', group: 'buildings',
    defaultVisible: true, minzoom: 12, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('building'), type: 'fill', 'source-layer': 'building', minzoom: 13,
      paint: { 'fill-color': '#d4ccc4', 'fill-outline-color': '#bab2aa', 'fill-opacity': 0.75 },
    }],
  },
  {
    sourceLayer: 'building_number', label: 'Номера домов', group: 'buildings',
    defaultVisible: false, minzoom: 15, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('building_number'), type: 'symbol', 'source-layer': 'building_number', minzoom: 15,
      layout: {
        'text-field': ['get', 'number'], 'text-size': 9, 'text-font': FONT_REGULAR,
      },
      paint: { 'text-color': '#8a7a6a', 'text-halo-color': '#ffffff', 'text-halo-width': 0.8 },
    }],
  },

  // ═══════════════════════ ОБЪЕКТЫ (POI) ═══════════════════════
  {
    sourceLayer: 'poi_accommodation', label: 'Гостиницы', group: 'poi',
    defaultVisible: false, minzoom: 15, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('poi_accommodation'), type: 'circle', 'source-layer': 'poi_accommodation', minzoom: 15,
      paint: { 'circle-radius': 3.5, 'circle-color': '#0070b8', 'circle-stroke-width': 1, 'circle-stroke-color': '#ffffff' },
    }, {
      id: planetLayerId('poi_accommodation', 'label'), type: 'symbol', 'source-layer': 'poi_accommodation', minzoom: 15,
      layout: {
        'text-field': nameField(), 'text-size': 10, 'text-font': FONT_REGULAR,
        'text-offset': [0, 1.2], 'text-anchor': 'top',
      },
      paint: { 'text-color': '#0070b8', 'text-halo-color': '#ffffff', 'text-halo-width': 1 },
    }],
  },
  {
    sourceLayer: 'poi_culture', label: 'Культура', group: 'poi',
    defaultVisible: false, minzoom: 13, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('poi_culture'), type: 'circle', 'source-layer': 'poi_culture', minzoom: 14,
      paint: { 'circle-radius': 3.5, 'circle-color': '#9c27b0', 'circle-stroke-width': 1, 'circle-stroke-color': '#ffffff' },
    }, {
      id: planetLayerId('poi_culture', 'label'), type: 'symbol', 'source-layer': 'poi_culture', minzoom: 15,
      layout: {
        'text-field': nameField(), 'text-size': 10, 'text-font': FONT_REGULAR,
        'text-offset': [0, 1.2], 'text-anchor': 'top',
      },
      paint: { 'text-color': '#9c27b0', 'text-halo-color': '#ffffff', 'text-halo-width': 1 },
    }],
  },
  {
    sourceLayer: 'poi_education', label: 'Образование (POI)', group: 'poi',
    defaultVisible: false, minzoom: 12, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('poi_education'), type: 'circle', 'source-layer': 'poi_education', minzoom: 14,
      paint: { 'circle-radius': 3.5, 'circle-color': '#7b1fa2', 'circle-stroke-width': 1, 'circle-stroke-color': '#ffffff' },
    }, {
      id: planetLayerId('poi_education', 'label'), type: 'symbol', 'source-layer': 'poi_education', minzoom: 15,
      layout: {
        'text-field': nameField(), 'text-size': 10, 'text-font': FONT_REGULAR,
        'text-offset': [0, 1.2], 'text-anchor': 'top',
      },
      paint: { 'text-color': '#7b1fa2', 'text-halo-color': '#ffffff', 'text-halo-width': 1 },
    }],
  },
  {
    sourceLayer: 'poi_food', label: 'Еда и напитки', group: 'poi',
    defaultVisible: false, minzoom: 15, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('poi_food'), type: 'circle', 'source-layer': 'poi_food', minzoom: 15,
      paint: { 'circle-radius': 3.5, 'circle-color': '#e65100', 'circle-stroke-width': 1, 'circle-stroke-color': '#ffffff' },
    }, {
      id: planetLayerId('poi_food', 'label'), type: 'symbol', 'source-layer': 'poi_food', minzoom: 15,
      layout: {
        'text-field': nameField(), 'text-size': 10, 'text-font': FONT_REGULAR,
        'text-offset': [0, 1.2], 'text-anchor': 'top',
      },
      paint: { 'text-color': '#e65100', 'text-halo-color': '#ffffff', 'text-halo-width': 1 },
    }],
  },
  {
    sourceLayer: 'poi_healthcare', label: 'Медицина', group: 'poi',
    defaultVisible: false, minzoom: 12, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('poi_healthcare'), type: 'circle', 'source-layer': 'poi_healthcare', minzoom: 14,
      paint: { 'circle-radius': 3.5, 'circle-color': '#d32f2f', 'circle-stroke-width': 1, 'circle-stroke-color': '#ffffff' },
    }, {
      id: planetLayerId('poi_healthcare', 'label'), type: 'symbol', 'source-layer': 'poi_healthcare', minzoom: 15,
      layout: {
        'text-field': nameField(), 'text-size': 10, 'text-font': FONT_REGULAR,
        'text-offset': [0, 1.2], 'text-anchor': 'top',
      },
      paint: { 'text-color': '#d32f2f', 'text-halo-color': '#ffffff', 'text-halo-width': 1 },
    }],
  },
  {
    sourceLayer: 'poi_public', label: 'Общественные объекты', group: 'poi',
    defaultVisible: false, minzoom: 13, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('poi_public'), type: 'circle', 'source-layer': 'poi_public', minzoom: 14,
      paint: { 'circle-radius': 3.5, 'circle-color': '#455a64', 'circle-stroke-width': 1, 'circle-stroke-color': '#ffffff' },
    }, {
      id: planetLayerId('poi_public', 'label'), type: 'symbol', 'source-layer': 'poi_public', minzoom: 15,
      layout: {
        'text-field': nameField(), 'text-size': 10, 'text-font': FONT_REGULAR,
        'text-offset': [0, 1.2], 'text-anchor': 'top',
      },
      paint: { 'text-color': '#455a64', 'text-halo-color': '#ffffff', 'text-halo-width': 1 },
    }],
  },
  {
    sourceLayer: 'poi_shopping', label: 'Магазины', group: 'poi',
    defaultVisible: false, minzoom: 12, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('poi_shopping'), type: 'circle', 'source-layer': 'poi_shopping', minzoom: 14,
      paint: { 'circle-radius': 3.5, 'circle-color': '#bf360c', 'circle-stroke-width': 1, 'circle-stroke-color': '#ffffff' },
    }, {
      id: planetLayerId('poi_shopping', 'label'), type: 'symbol', 'source-layer': 'poi_shopping', minzoom: 15,
      layout: {
        'text-field': nameField(), 'text-size': 10, 'text-font': FONT_REGULAR,
        'text-offset': [0, 1.2], 'text-anchor': 'top',
      },
      paint: { 'text-color': '#bf360c', 'text-halo-color': '#ffffff', 'text-halo-width': 1 },
    }],
  },
  {
    sourceLayer: 'poi_sport', label: 'Спорт', group: 'poi',
    defaultVisible: false, minzoom: 12, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('poi_sport'), type: 'circle', 'source-layer': 'poi_sport', minzoom: 14,
      paint: { 'circle-radius': 3.5, 'circle-color': '#00897b', 'circle-stroke-width': 1, 'circle-stroke-color': '#ffffff' },
    }, {
      id: planetLayerId('poi_sport', 'label'), type: 'symbol', 'source-layer': 'poi_sport', minzoom: 15,
      layout: {
        'text-field': nameField(), 'text-size': 10, 'text-font': FONT_REGULAR,
        'text-offset': [0, 1.2], 'text-anchor': 'top',
      },
      paint: { 'text-color': '#00897b', 'text-halo-color': '#ffffff', 'text-halo-width': 1 },
    }],
  },
  {
    sourceLayer: 'poi_station', label: 'Станции / Вокзалы', group: 'poi',
    defaultVisible: false, minzoom: 5, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('poi_station'), type: 'circle', 'source-layer': 'poi_station', minzoom: 10,
      paint: { 'circle-radius': 3, 'circle-color': '#1565c0', 'circle-stroke-width': 1, 'circle-stroke-color': '#ffffff' },
    }, {
      id: planetLayerId('poi_station', 'label'), type: 'symbol', 'source-layer': 'poi_station', minzoom: 12,
      layout: {
        'text-field': nameField(), 'text-size': 10, 'text-font': FONT_SEMIBOLD,
        'text-offset': [0, 1.2], 'text-anchor': 'top',
      },
      paint: { 'text-color': '#1565c0', 'text-halo-color': '#ffffff', 'text-halo-width': 1.2 },
    }],
  },
  {
    sourceLayer: 'poi_tourism', label: 'Туризм', group: 'poi',
    defaultVisible: false, minzoom: 12, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('poi_tourism'), type: 'circle', 'source-layer': 'poi_tourism', minzoom: 14,
      paint: { 'circle-radius': 3.5, 'circle-color': '#2e7d32', 'circle-stroke-width': 1, 'circle-stroke-color': '#ffffff' },
    }, {
      id: planetLayerId('poi_tourism', 'label'), type: 'symbol', 'source-layer': 'poi_tourism', minzoom: 15,
      layout: {
        'text-field': nameField(), 'text-size': 10, 'text-font': FONT_REGULAR,
        'text-offset': [0, 1.2], 'text-anchor': 'top',
      },
      paint: { 'text-color': '#2e7d32', 'text-halo-color': '#ffffff', 'text-halo-width': 1 },
    }],
  },
  {
    sourceLayer: 'poi_transport', label: 'Транспорт (POI)', group: 'poi',
    defaultVisible: false, minzoom: 13, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('poi_transport'), type: 'circle', 'source-layer': 'poi_transport', minzoom: 14,
      paint: { 'circle-radius': 3, 'circle-color': '#546e7a', 'circle-stroke-width': 1, 'circle-stroke-color': '#ffffff' },
    }, {
      id: planetLayerId('poi_transport', 'label'), type: 'symbol', 'source-layer': 'poi_transport', minzoom: 15,
      layout: {
        'text-field': nameField(), 'text-size': 9, 'text-font': FONT_REGULAR,
        'text-offset': [0, 1.2], 'text-anchor': 'top',
      },
      paint: { 'text-color': '#546e7a', 'text-halo-color': '#ffffff', 'text-halo-width': 1 },
    }],
  },
  {
    sourceLayer: 'street_furniture', label: 'Уличная мебель', group: 'poi',
    defaultVisible: false, minzoom: 15, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('street_furniture'), type: 'circle', 'source-layer': 'street_furniture', minzoom: 15,
      paint: { 'circle-radius': 2, 'circle-color': '#9e9e9e' },
    }],
  },
  {
    sourceLayer: 'tree', label: 'Деревья', group: 'poi',
    defaultVisible: false, minzoom: 15, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('tree'), type: 'circle', 'source-layer': 'tree', minzoom: 15,
      paint: { 'circle-radius': 2.5, 'circle-color': '#66bb6a', 'circle-opacity': 0.7 },
    }],
  },

  // ═══════════════════════ ПОДПИСИ ═══════════════════════
  {
    sourceLayer: 'place_label', label: 'Населённые пункты', group: 'labels',
    defaultVisible: false, minzoom: 9, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('place_label'), type: 'symbol', 'source-layer': 'place_label', minzoom: 9,
      layout: {
        'text-field': nameField(),
        'text-size': ['interpolate', ['linear'], ['zoom'], 9, 10, 15, 14],
        'text-font': FONT_REGULAR,
      },
      paint: { 'text-color': '#4f4f4f', 'text-halo-color': '#ffffff', 'text-halo-width': 1.2 },
    }],
  },
  {
    sourceLayer: 'town_label', label: 'Города (малые)', group: 'labels',
    defaultVisible: true, minzoom: 5, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('town_label'), type: 'symbol', 'source-layer': 'town_label', minzoom: 5,
      layout: {
        'text-field': nameField(),
        'text-size': ['interpolate', ['linear'], ['zoom'], 5, 10, 12, 14],
        'text-font': FONT_SEMIBOLD,
      },
      paint: { 'text-color': '#4a4a4a', 'text-halo-color': '#ffffff', 'text-halo-width': 1.4 },
    }],
  },
  {
    sourceLayer: 'city_label', label: 'Города (крупные)', group: 'labels',
    defaultVisible: true, minzoom: 3, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('city_label'), type: 'symbol', 'source-layer': 'city_label', minzoom: 3,
      layout: {
        'text-field': nameField(),
        'text-size': ['interpolate', ['linear'], ['zoom'], 3, 11, 10, 18],
        'text-font': FONT_BOLD,
      },
      paint: { 'text-color': '#333333', 'text-halo-color': '#ffffff', 'text-halo-width': 1.6 },
    }],
  },
  {
    sourceLayer: 'island_label', label: 'Острова', group: 'labels',
    defaultVisible: false, minzoom: 5, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('island_label'), type: 'symbol', 'source-layer': 'island_label', minzoom: 5,
      layout: {
        'text-field': nameField(), 'text-size': 11, 'text-font': FONT_REGULAR,
      },
      paint: { 'text-color': '#5a5a5a', 'text-halo-color': '#ffffff', 'text-halo-width': 1.2 },
    }],
  },
  {
    sourceLayer: 'archipelago_label', label: 'Архипелаги', group: 'labels',
    defaultVisible: false, minzoom: 3, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('archipelago_label'), type: 'symbol', 'source-layer': 'archipelago_label', minzoom: 3,
      layout: {
        'symbol-placement': 'line', 'text-field': nameField(), 'text-size': 11,
        'text-font': FONT_REGULAR, 'text-letter-spacing': 0.15,
      },
      paint: { 'text-color': '#5a5a5a', 'text-halo-color': '#ffffff', 'text-halo-width': 1.2 },
    }],
  },
  {
    sourceLayer: 'protected_area_major_label', label: 'Крупные заповедники', group: 'labels',
    defaultVisible: false, minzoom: 4, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('protected_area_major_label'), type: 'symbol', 'source-layer': 'protected_area_major_label', minzoom: 6,
      layout: {
        'symbol-placement': 'line', 'text-field': nameField(), 'text-size': 11,
        'text-font': FONT_REGULAR, 'text-letter-spacing': 0.1,
      },
      paint: { 'text-color': '#3d7a2a', 'text-halo-color': '#ffffff', 'text-halo-width': 1.2 },
    }],
  },
  {
    sourceLayer: 'protected_area_minor_label', label: 'Малые заповедники', group: 'labels',
    defaultVisible: false, minzoom: 4, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('protected_area_minor_label'), type: 'symbol', 'source-layer': 'protected_area_minor_label', minzoom: 8,
      layout: {
        'text-field': nameField(), 'text-size': 10, 'text-font': FONT_REGULAR,
      },
      paint: { 'text-color': '#4a8a3a', 'text-halo-color': '#ffffff', 'text-halo-width': 1 },
    }],
  },
  {
    sourceLayer: 'state_label', label: 'Регионы / Области', group: 'labels',
    defaultVisible: false, minzoom: 2, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('state_label'), type: 'symbol', 'source-layer': 'state_label', minzoom: 4,
      layout: {
        'text-field': nameField(),
        'text-size': ['interpolate', ['linear'], ['zoom'], 4, 10, 8, 13],
        'text-font': FONT_REGULAR, 'text-transform': 'uppercase', 'text-letter-spacing': 0.15,
      },
      paint: { 'text-color': '#888888', 'text-halo-color': '#ffffff', 'text-halo-width': 1.4 },
    }],
  },
  {
    sourceLayer: 'country_disputed_label', label: 'Спорные территории', group: 'labels',
    defaultVisible: false, minzoom: 3, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('country_disputed_label'), type: 'symbol', 'source-layer': 'country_disputed_label', minzoom: 3,
      layout: {
        'text-field': nameField(), 'text-size': 11, 'text-font': FONT_REGULAR,
      },
      paint: { 'text-color': '#a08080', 'text-halo-color': '#ffffff', 'text-halo-width': 1.2 },
    }],
  },
  {
    sourceLayer: 'country_label', label: 'Страны', group: 'labels',
    defaultVisible: true, minzoom: 0, maxzoom: 15,
    buildLayers: (s) => [{
      id: planetLayerId('country_label'), type: 'symbol', 'source-layer': 'country_label',
      layout: {
        'text-field': nameField(),
        'text-size': ['interpolate', ['linear'], ['zoom'], 1, 11, 6, 20],
        'text-font': FONT_BOLD, 'text-letter-spacing': 0.1,
      },
      paint: { 'text-color': '#303030', 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
    }],
  },
  {
    sourceLayer: 'continent_label', label: 'Континенты', group: 'labels',
    defaultVisible: false, minzoom: 0, maxzoom: 3,
    buildLayers: (s) => [{
      id: planetLayerId('continent_label'), type: 'symbol', 'source-layer': 'continent_label',
      maxzoom: 4,
      layout: {
        'text-field': nameField(), 'text-size': 14,
        'text-font': FONT_BOLD, 'text-letter-spacing': 0.3, 'text-transform': 'uppercase',
      },
      paint: { 'text-color': '#606060', 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
    }],
  },
]

/**
 * Порядок source-layer снизу вверх (как в классической картографии):
 * заливки поверхности → вода → границы → линейный транспорт → здания → POI → подписи.
 */
export const PLANET_V4_SOURCE_PAINT_ORDER: readonly string[] = [
  'vegetation', 'scrub', 'wood', 'forest', 'grass', 'wetland', 'farmland', 'ice', 'rock', 'sand',
  'protected_area', 'residential', 'cemetery', 'commercial', 'dam', 'education', 'hospital',
  'industrial', 'leisure', 'military', 'construction', 'parking',
  'water', 'waterway',
  'country_border', 'country_border_disputed', 'sub_border',
  'aviation', 'aviation_line', 'pier', 'ferry',
  'railway',
  'road',
  'aerialway',
  'pedestrian', 'pathway', 'bridge',
  'traffic_control',
  'building', 'building_number',
  'poi_accommodation', 'poi_culture', 'poi_education', 'poi_food', 'poi_healthcare', 'poi_public',
  'poi_shopping', 'poi_sport', 'poi_station', 'poi_tourism', 'poi_transport', 'street_furniture', 'tree',
  'water_label', 'water_centroid',
  'road_label', 'road_exit',
  'railway_label', 'aerialway_label', 'ferry_label', 'bridge_label', 'pedestrian_label', 'pathway_label',
  'place_label', 'town_label', 'city_label',
  'island_label', 'archipelago_label', 'protected_area_major_label', 'protected_area_minor_label',
  'state_label', 'country_disputed_label', 'country_label', 'continent_label',
]

const planetDefBySource = new Map(PLANET_V4_LAYERS.map((d) => [d.sourceLayer, d]))

export function getPlanetLayerDef(sourceLayer: string): PlanetLayerDef | undefined {
  return planetDefBySource.get(sourceLayer)
}

export function getPlanetV4PaintOrderMapLayerIds(): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  for (const sl of PLANET_V4_SOURCE_PAINT_ORDER) {
    const d = planetDefBySource.get(sl)
    if (!d) continue
    for (const spec of d.buildLayers('')) {
      ids.push(spec.id!)
      seen.add(spec.id!)
    }
  }
  for (const d of PLANET_V4_LAYERS) {
    for (const spec of d.buildLayers('')) {
      if (!seen.has(spec.id!)) ids.push(spec.id!)
    }
  }
  return ids
}

/** Id первого слоя на карте, который должен быть ВЫШЕ `mapLayerId` в стеке (аргумент beforeId для addLayer). */
export function getPlanetMapLayerInsertBeforeId(map: Map, mapLayerId: string): string | undefined {
  const order = getPlanetV4PaintOrderMapLayerIds()
  const idx = order.indexOf(mapLayerId)
  if (idx < 0) return undefined
  for (let j = idx + 1; j < order.length; j += 1) {
    if (map.getLayer(order[j])) return order[j]
  }
  return undefined
}

/** Переставляет все base-planet-* строго в порядке PLANET_V4_SOURCE_PAINT_ORDER, блок сразу под insertBefore. */
export function reorderPlanetBaseLayersOnMap(map: Map, insertBefore?: string): void {
  const order = getPlanetV4PaintOrderMapLayerIds().filter((id) => map.getLayer(id))
  if (order.length === 0) return
  const top = order[order.length - 1]
  try {
    if (insertBefore) map.moveLayer(top, insertBefore)
  } catch {
    /* ignore */
  }
  for (let i = order.length - 2; i >= 0; i -= 1) {
    try {
      map.moveLayer(order[i], order[i + 1])
    } catch {
      /* ignore */
    }
  }
}

export interface PlanetLayerStyleOverride {
  color?: string
  opacity?: number
  textSize?: number
}

export interface PlanetLayerUiCaps {
  hasColor: boolean
  hasOpacity: boolean
  hasTextSize: boolean
}

export function getPlanetLayerUiCaps(def: PlanetLayerDef): PlanetLayerUiCaps {
  let hasColor = false
  let hasOpacity = false
  let hasTextSize = false
  for (const spec of def.buildLayers('')) {
    const t = spec.type
    if (t === 'fill' || t === 'line' || t === 'circle' || t === 'symbol') hasColor = true
    if (t === 'fill' || t === 'line' || t === 'circle' || t === 'symbol') hasOpacity = true
    if (t === 'symbol' && (spec as any).layout?.['text-field']) hasTextSize = true
  }
  return { hasColor, hasOpacity, hasTextSize }
}

export function applyPlanetLayerStyleOverride(
  map: Map,
  planetBaseSourceId: string,
  def: PlanetLayerDef,
  override: PlanetLayerStyleOverride | null | undefined,
): void {
  if (!map.getSource(planetBaseSourceId)) return
  const specs = def.buildLayers(planetBaseSourceId)
  for (const spec of specs) {
    const id = spec.id!
    if (!map.getLayer(id)) continue
    const t = spec.type as string
    if (override?.opacity != null && override.opacity >= 0 && override.opacity <= 1) {
      if (t === 'fill') map.setPaintProperty(id, 'fill-opacity', override.opacity)
      if (t === 'line') map.setPaintProperty(id, 'line-opacity', override.opacity)
      if (t === 'circle') map.setPaintProperty(id, 'circle-opacity', override.opacity)
      if (t === 'symbol') map.setPaintProperty(id, 'text-opacity', override.opacity)
    }
    if (override?.color) {
      const c = override.color
      if (t === 'fill') map.setPaintProperty(id, 'fill-color', c)
      if (t === 'line') map.setPaintProperty(id, 'line-color', c)
      if (t === 'circle') map.setPaintProperty(id, 'circle-color', c)
      if (t === 'symbol') map.setPaintProperty(id, 'text-color', c)
    }
    if (override?.textSize != null && override.textSize >= 6 && override.textSize <= 32 && t === 'symbol') {
      map.setLayoutProperty(id, 'text-size', override.textSize)
    }
  }
}

export function getAllPlanetMapLayerIds(): string[] {
  const ids: string[] = []
  for (const def of PLANET_V4_LAYERS) {
    for (const layer of def.buildLayers('')) {
      ids.push(layer.id!)
    }
  }
  return ids
}

export function getPlanetLayersByGroup(): { group: PlanetLayerGroup; label: string; icon: string; layers: PlanetLayerDef[] }[] {
  return PLANET_GROUP_ORDER.map((g) => ({
    group: g,
    label: PLANET_GROUP_LABELS[g],
    icon: PLANET_GROUP_ICONS[g],
    layers: PLANET_V4_LAYERS.filter((l) => l.group === g),
  }))
}
