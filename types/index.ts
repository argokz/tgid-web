export interface LayerConfig {
  id: string;
  displayName?: string;
  label: string;
  sourceId: string;
  layerId: string;
  sourceLayer: string;
  /**
   * Имя для идентификаторов источника, если слой — фильтр другого слоя GeoServer
   * (heatsources → тайлы uzel с кодом IS, utils/nodeKindLayers.ts); иначе — sourceLayer.
   */
  idSource?: string;
  /** Постоянный CQL_FILTER слоя для WMS (тип узла), объединяется с фильтром фрагментов */
  cqlFilter?: string;
  layerName?: string;
  type: 'symbol' | 'line' | 'circle' | 'fill' | 'image';
  url?: string;
  styleUrl?: string;
  mvtUrl?: string;
  /** Границы тайлов [west, south, east, north] (кеш GWC: за ними 400 TileOutOfRange) */
  tileBounds?: [number, number, number, number];
  /** Тайлы из архива PMTiles API (utils/staticTiles.ts): зумы источника и версия архива */
  staticTiles?: { layer: string; minzoom: number; maxzoom: number; version: number };
  /**
   * У слоя есть поле фрагмента (fileid): клиентский фильтр фрагментов применим. false — поля нет
   * (здания zdaniya_2, zdaniya_tu): фильтр по fileid скрыл бы все объекты слоя. Не задано — неизвестно.
   */
  hasFragmentField?: boolean;
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
  /**
   * Роль слоя: data — рабочий слой схемы; service — вспомогательный
   * (city_center, file, find_node, fragments…), показывается в отдельной группе.
   * Слои id_* в панель не попадают — они подключаются через queryLayerName.
   */
  role?: 'data' | 'service';
  /** Имя парного слоя id_* в GeoServer — используется для GetFeatureInfo/запросов вместо основного */
  queryLayerName?: string;
  /** false — слой доступен в панели, но не включается по умолчанию (автообнаруженные) */
  defaultVisible?: boolean;
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
  /** Участок-пара (подача и обратка): значение второй колонки */
  value2?: string | number | null;
  code2?: number | null;
  id2?: number | null;
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
    /** Заголовки колонок карточки участка-пары («Подача», «Обратка») */
    columns?: string[];
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