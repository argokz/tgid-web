export interface LayerConfig {
  id: string;
  displayName?: string;
  label: string;
  sourceId: string;
  layerId: string;
  sourceLayer: string;
  layerName?: string;
  type: 'symbol' | 'line' | 'circle' | 'fill' | 'image';
  url?: string;
  styleUrl?: string;
  mvtUrl?: string;
  paint: Record<string, any>;
  layout?: Record<string, any>;
  filter?: any[];
  attributes: string[];
  selectedAttributes?: string[];
  visible?: boolean;
  zIndex?: number;
  category?: string;
  renderFormat?: 'mvt' | 'wms' | 'wmts';
  workspace?: string;
  /** Из GEOSERVER_LAYER_CATALOG — URL workspace для WMS/MVT */
  workspaceBaseUrl?: string;
  /** Что разрешено переключать в UI */
  supportedFormats?: { mvt?: boolean; wms?: boolean };
  /** Источник растра WMS (совпадает с buildWmsRasterSourceId), если слой поддерживает WMS */
  wmsRasterSourceId?: string;
  mbLayers?: any[];
  bounds?: {
    lowerCorner: [number, number];
    upperCorner: [number, number];
  };
}

export interface ServerLayer {
  layerId: string;
  displayName: string;
  sourceLayer: string;
  layerName?: string;
  url: string;
  styleUrl: string;
  visible: boolean;
  style: any;
  fragmentFilter: any;
  id?: string;
  label?: string;
  sourceId?: string;
  type?: 'line' | 'circle' | 'fill' | 'symbol' | 'image';
  mvtUrl?: string;
  paint?: Record<string, any>;
  layout?: Record<string, any>;
  filter?: any[];
  attributes?: string[];
  selectedAttributes?: string[];
  zIndex?: number;
  category?: string;
  bounds?: {
    lowerCorner: [number, number];
    upperCorner: [number, number];
  };
}

export interface LayerStyle {
  id: number;
  name: string;
  layerId: string;
  style: {
    paint: Record<string, any>;
    layout?: Record<string, any>;
    filter?: any[];
  };
  isDefault: boolean;
}

export interface LayerAttributes {
  fields: string[];
  selected: string[];
}

export interface LayersObject {
  [key: string]: ServerLayer;
}

export interface Field {
  table: string;
  field: string;
  label: string;
  value: string | number | null;
  id: number;
  code?: number | null;
  type: 'text' | 'select';
  select?: string;
}

export interface Subsection {
  title: string;
  fields: Field[];
}

export interface Tab {
  title: string;
  subsections: Subsection[];
}

export interface FeatureData {
  id: string;
  properties: Record<string, any>;
  geometry?: {
    type: string;
    coordinates: any[];
  };
  workspace?: string;
  data?: {
    tabs: Tab[];
  };
}

export interface Fragment {
  id: number;
  name: string;
  description?: string;
  bounds?: {
    lowerCorner: [number, number];
    upperCorner: [number, number];
  };
}

export interface ExtendedLayerConfig extends Omit<LayerConfig, 'type'> {
  type: 'symbol' | 'line' | 'circle' | 'fill' | 'image';
  layout?: Record<string, any>;
  filter?: any[];
  style?: any;
  fragmentFilter?: any;
  sprite?: string;
}

export interface WorkspaceConfig {
  id: string
  name: string
  url: string
  workspace: string
  groupName: string
  enabled: boolean
  order: number
  // Центр карты и зум для данного workspace
  center?: [number, number] // [longitude, latitude]
  zoom?: number
}

export interface WmsLayerConfig {
  id: string
  name: string
  url?: string // Если не указан, используется из workspace
  workspace: string
  layerName: string
  enabled: boolean
  opacity: number
  minZoom?: number
  maxZoom?: number
  viewParams?: Record<string, string | string[]>
  order: number
}

export interface AppSettings {
  geoserverUrl: string
  workspaces: WorkspaceConfig[]
  wmsLayers: WmsLayerConfig[]
  defaultWorkspace: string
  lastUpdated: string
}