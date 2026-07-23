import type { FeatureData, Fragment } from '~/types';

export interface ColumnTranslation {
  column: string;
  russian_name: string;
  description: string;
}

export interface TranslationCache {
  [column: string]: ColumnTranslation;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface JournalSummary {
  id: number;
  longitude: number | null;
  latitude: number | null;
  pressure_min: number | null;
  pressure_max: number | null;
  [key: string]: any;
}

export interface JournalDetails extends JournalSummary {
  attributes: Record<string, any>;
  relations: Record<string, Array<Record<string, any>>>;
}

export type JournalFilters = Record<string, string | number | boolean | null | undefined>;
export type JournalLookups = Record<string, any>;

export type DefectSummary = JournalSummary;
export type DefectDetails = JournalDetails;
export type DefectLookups = JournalLookups;
export type ShurfSummary = JournalSummary;
export type ShurfDetails = JournalDetails;
export type ShurfLookups = JournalLookups;
export type InspectionSummary = JournalSummary;
export type InspectionDetails = JournalDetails;
export type InspectionLookups = JournalLookups;
export type RepairSummary = JournalSummary;
export type RepairDetails = JournalDetails;
export type RepairLookups = JournalLookups;
export type PressureTestSummary = JournalSummary;
export type PressureTestDetails = JournalDetails;
export type PressureTestLookups = JournalLookups;
export type TechnicalConditionSummary = JournalSummary;
export type TechnicalConditionDetails = JournalDetails;
export type TechnicalConditionLookups = JournalLookups;
export type CorrosionIndicatorSummary = JournalSummary;
export type CorrosionIndicatorDetails = JournalDetails;
export type CorrosionIndicatorLookups = JournalLookups;
export type AlsekoLoadSummary = JournalSummary;
export type AlsekoLoadDetails = JournalDetails;
export type AlsekoBuildingSummary = JournalSummary;
export type AlsekoBuildingDetails = JournalDetails;
export type AlsekoLookups = JournalLookups;

export type ElectricalObjectType =
  | 'source'
  | 'receiver'
  | 'line'
  | 'channel'
  | 'coupling'
  | 'support'
  | 'sleeve';
export type ElectricalObjectSummary = JournalSummary;
export interface ElectricalObjectDetails extends JournalDetails {
  object_type: ElectricalObjectType;
}
export type ElectricalNetworkLookups = JournalLookups;
export type HeatLossSeasonSummary = JournalSummary;
export type HeatLossSeasonDetails = JournalDetails;
export type HeatLossSourceSummary = JournalSummary;
export type HeatLossSourceDetails = JournalDetails;
export type HeatLossLookups = JournalLookups;

export type ConsumerLoadType = 'generalized' | 'real';
export type ConsumerLoadDiagnosticKind = 'zero_load' | 'closed' | 'disconnected' | 'not_calculated';
export type ConsumerLoadSummary = JournalSummary;
export type ConsumerLoadDetails = JournalDetails;
export type ConsumerLoadLookups = JournalLookups;

export type TemperatureGraphStatus = 'ready' | 'missing' | 'duplicates' | 'incomplete';
export type TemperatureGraphFilters = JournalFilters;
export type TemperatureGraphSourceSummary = JournalSummary;
export interface TemperatureGraphPoint {
  id: number;
  tn: number | null;
  t1: number | null;
  t2: number | null;
  t3: number | null;
  tv: number | null;
  q_otn: number | null;
  t_bn: number | null;
  duplicate_count: number;
  [key: string]: number | null;
}
export interface TemperatureGraphSourceDetails extends JournalDetails {
  points: TemperatureGraphPoint[];
}
export type TemperatureGraphLookups = JournalLookups;

export type PumpConfigurationStatus =
  | 'configured'
  | 'missing_model'
  | 'coefficients_missing'
  | 'line_missing';
export type PumpCatalogStatus = 'ready' | 'non_monotonic' | 'incomplete';
export type InstalledPumpFilters = JournalFilters;
export type PumpCatalogFilters = JournalFilters;
export type InstalledPumpSummary = JournalSummary;
export interface InstalledPumpDetails extends JournalDetails {
  standard_pump: StandardPumpDetails | null;
  latest_output: Record<string, any> | null;
}
export type StandardPumpSummary = JournalSummary;
export interface StandardPumpDetails extends JournalDetails {
  points: PumpCurvePoint[];
  min_flow: number | null;
  max_flow: number | null;
  has_valid_working_zone: boolean;
}
export type PumpEquipmentLookups = JournalLookups;
export interface PumpCurvePoint {
  flow: number | null;
  head?: number | null;
  power?: number | null;
  efficiency?: number | null;
  [key: string]: any;
}

export type NetworkArmatureType = 'damper' | 'regulating';
export type NetworkArmatureQualityStatus =
  | 'ready'
  | 'line_missing'
  | 'line_removed'
  | 'purpose_unknown'
  | 'diameter_suspicious';
export type NetworkArmatureFilters = JournalFilters;
export type StandardDamperFilters = JournalFilters;
export type NetworkArmatureSummary = JournalSummary;
export type NetworkArmatureDetails = JournalDetails;
export type StandardDamperSummary = JournalSummary;
export type StandardDamperDetails = JournalDetails;
export interface NetworkArmatureLookups extends JournalLookups {
  purposes: Array<Record<string, any>>;
}

export type NetworkRegulatorType = 'pressure' | 'flow' | 'differential';
export type NetworkRegulatorQualityStatus =
  | 'ready'
  | 'line_missing'
  | 'line_removed'
  | 'control_node_missing'
  | 'setpoint_missing'
  | 'capacity_missing';
export type NetworkRegulatorFilters = JournalFilters;
export type StandardRegulatorFilters = JournalFilters;
export type NetworkRegulatorSummary = JournalSummary;
export type NetworkRegulatorDetails = JournalDetails;
export type StandardRegulatorSummary = JournalSummary;
export type StandardRegulatorDetails = JournalDetails;
export type NetworkRegulatorLookups = JournalLookups;

export type NetworkBypassQualityStatus =
  | 'ready'
  | 'line_missing'
  | 'line_removed'
  | 'connection_node_missing'
  | 'setpoint_missing'
  | 'geometry_parameters_invalid';
export type NetworkBypassFilters = JournalFilters;
export type StandardTubeFilters = JournalFilters;
export type NetworkBypassSummary = JournalSummary;
export type NetworkBypassDetails = JournalDetails;
export type StandardTubeSummary = JournalSummary;
export type StandardTubeDetails = JournalDetails;
export type NetworkBypassLookups = JournalLookups;

export type NetworkDiaphragmQualityStatus =
  | 'ready'
  | 'line_missing'
  | 'line_removed'
  | 'topology_missing'
  | 'state_missing'
  | 'count_invalid'
  | 'diameter_unresolved';
export type NetworkDiaphragmDiameterMode = 'available' | 'pending_calculation' | 'unresolved';
export type NetworkDiaphragmFilters = JournalFilters;
export type NetworkDiaphragmSummary = JournalSummary;
export type NetworkDiaphragmDetails = JournalDetails;
export type NetworkDiaphragmLookups = JournalLookups;

export type ElevatorQualityStatus =
  | 'ready'
  | 'line_missing'
  | 'line_removed'
  | 'topology_missing'
  | 'state_missing'
  | 'nozzle_unresolved'
  | 'pending_calculation';
export type ElevatorFilters = JournalFilters;
export type ElevatorSummary = JournalSummary;
export type ElevatorDetails = JournalDetails;
export type ElevatorLookups = JournalLookups;

export interface PassportSite {
  id: string;
  name: string;
  ms_rs: 'ms' | 'rs';
  site_id: number;
  is_leaf?: boolean;
}

export interface PassportHierarchyGroup {
  id: string;
  name: string;
  children: any[];
}

export interface TopologyDiagnosticFault {
  lat: number;
  lng: number;
  [key: string]: any;
}

export interface TopologyDiagnosticsResponse {
  faults: TopologyDiagnosticFault[];
  total?: number;
  [key: string]: any;
}

const translationCache: TranslationCache = {};
const pendingTranslationRequests = new Map<string, Promise<ColumnTranslation>>();
const DEFAULT_MAP_API_BASE_URL = 'http://localhost:8000';

const getApiBaseUrl = (): string => {
  try {
    const runtimeConfig = useRuntimeConfig() as any;
    const configured =
      runtimeConfig.public?.mapApiBaseUrl ||
      runtimeConfig.public?.externalApiUrl ||
      DEFAULT_MAP_API_BASE_URL;
    return String(configured).replace(/\/+$/, '');
  } catch {
    return DEFAULT_MAP_API_BASE_URL;
  }
};

const buildApiUrl = (path: string): string => `${getApiBaseUrl()}/${path.replace(/^\/+/, '')}`;

const fetchWithRetry = async <T>(url: string, options: any = {}, retries = 2): Promise<T> => {
  try {
    return await $fetch<T>(url, options);
  } catch (error) {
    if (retries > 0) {
      console.warn(`Retry fetching ${url}, retries left: ${retries}`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return fetchWithRetry<T>(url, options, retries - 1);
    }
    throw error;
  }
};

const request = <T>(path: string, options?: any): Promise<T> => {
  const url = buildApiUrl(path.startsWith('/') ? path.slice(1) : path);
  return options === undefined ? $fetch<T>(url) : $fetch<T>(url, options);
};

const encodePath = (value: string | number): string => encodeURIComponent(String(value));

const mutationOptions = (method: string, body?: any): Record<string, any> => {
  const options: Record<string, any> = { method };
  if (body !== undefined) options.body = body;
  if (typeof localStorage !== 'undefined') {
    const token = localStorage.getItem('itwin_access_token');
    if (token) options.headers = { Authorization: `Bearer ${token}` };
  }
  return options;
};

const mutationWithFallback = async <T>(
  primaryPath: string,
  fallbackPath: string,
  options: Record<string, any>
): Promise<T> => {
  try {
    return await request<T>(primaryPath, options);
  } catch {
    return request<T>(fallbackPath, options);
  }
};

export const fastApiService = {
  request,

  async getObjectData(
    typeObject: string,
    nameObject: string,
    id: string | number
  ): Promise<FeatureData> {
    return fetchWithRetry<FeatureData>(
      buildApiUrl(`${encodePath(typeObject)}/${encodePath(nameObject)}/${encodePath(id)}`)
    );
  },

  async getFragments(): Promise<{ data: Fragment[] }> {
    return fetchWithRetry<{ data: Fragment[] }>(buildApiUrl('fragments'));
  },

  async postRunSetyCmd(params: string): Promise<any> {
    return request('run-sety-cmd', mutationOptions('POST', { params }));
  },

  async login(username: string, password: string, role = 'editor'): Promise<{
    access_token: string;
    token_type: string;
    role: string;
    username: string;
  }> {
    return request('api/v1/auth/login', {
      method: 'POST',
      body: { username, password, role },
    });
  },

  async authMe(): Promise<{
    sub: string;
    username: string;
    role: string;
    mutations_enabled: boolean;
    topology_mutations_enabled: boolean;
    auth_disabled: boolean;
  }> {
    return request('api/v1/auth/me', mutationOptions('GET'));
  },

  async getTaskStatus(taskId: string): Promise<any> {
    return request(`task/${encodePath(taskId)}`);
  },

  async getPiezometerPath(start: number, end: number): Promise<any> {
    return request('piezometer/path', { query: { start, end } });
  },

  async createLine(nodeid1: number, nodeid2: number): Promise<any> {
    return request('api/topology/line', { method: 'POST', body: { nodeid1, nodeid2 } });
  },

  async deleteLine(lineId: number): Promise<any> {
    return request(`api/topology/line/${encodePath(lineId)}`, { method: 'DELETE' });
  },

  async splitLine(lineId: number, lng: number, lat: number): Promise<any> {
    return request('api/topology/split-line', {
      method: 'POST',
      body: { line_id: lineId, lng, lat },
    });
  },

  async moveNode(id: number, lng: number, lat: number): Promise<any> {
    return request(`api/topology/node/${encodePath(id)}/move`, {
      method: 'PUT',
      body: { lng, lat },
    });
  },

  async createNode(lng: number, lat: number): Promise<any> {
    return request('api/topology/node', { method: 'POST', body: { lng, lat } });
  },

  async deleteNode(id: number): Promise<any> {
    return request(`api/topology/node/${encodePath(id)}`, { method: 'DELETE' });
  },

  async getDefects(filters: JournalFilters = {}): Promise<PaginatedResponse<DefectSummary>> {
    return request('api/defects', { query: filters });
  },
  async getDefect(id: number): Promise<DefectDetails> {
    return request(`api/defects/${encodePath(id)}`);
  },
  async getDefectLookups(): Promise<DefectLookups> {
    return request('api/defects/lookups');
  },

  async getShurfs(filters: JournalFilters = {}): Promise<PaginatedResponse<ShurfSummary>> {
    return request('api/shurfs', { query: filters });
  },
  async getShurf(id: number): Promise<ShurfDetails> {
    return request(`api/shurfs/${encodePath(id)}`);
  },
  async getShurfLookups(): Promise<ShurfLookups> {
    return request('api/shurfs/lookups');
  },

  async getInspections(
    filters: JournalFilters = {}
  ): Promise<PaginatedResponse<InspectionSummary>> {
    return request('api/inspections', { query: filters });
  },
  async getInspection(id: number): Promise<InspectionDetails> {
    return request(`api/inspections/${encodePath(id)}`);
  },
  async getInspectionLookups(): Promise<InspectionLookups> {
    return request('api/inspections/lookups');
  },

  async getRepairs(filters: JournalFilters = {}): Promise<PaginatedResponse<RepairSummary>> {
    return request('api/repairs', { query: filters });
  },
  async getRepair(id: number): Promise<RepairDetails> {
    return request(`api/repairs/${encodePath(id)}`);
  },
  async getRepairLookups(): Promise<RepairLookups> {
    return request('api/repairs/lookups');
  },

  async getPressureTests(
    filters: JournalFilters = {}
  ): Promise<PaginatedResponse<PressureTestSummary>> {
    return request('api/pressure-tests', { query: filters });
  },
  async getPressureTest(id: number): Promise<PressureTestDetails> {
    return request(`api/pressure-tests/${encodePath(id)}`);
  },
  async getPressureTestLookups(): Promise<PressureTestLookups> {
    return request('api/pressure-tests/lookups');
  },

  async getTechnicalConditions(
    filters: JournalFilters = {}
  ): Promise<PaginatedResponse<TechnicalConditionSummary>> {
    return request('api/technical-conditions', { query: filters });
  },
  async getTechnicalCondition(id: number): Promise<TechnicalConditionDetails> {
    return request(`api/technical-conditions/${encodePath(id)}`);
  },
  async getTechnicalConditionLookups(): Promise<TechnicalConditionLookups> {
    return request('api/technical-conditions/lookups');
  },

  async getCorrosionIndicators(
    filters: JournalFilters = {}
  ): Promise<PaginatedResponse<CorrosionIndicatorSummary>> {
    return request('api/corrosion-indicators', { query: filters });
  },
  async getCorrosionIndicator(id: number): Promise<CorrosionIndicatorDetails> {
    return request(`api/corrosion-indicators/${encodePath(id)}`);
  },
  async getCorrosionIndicatorLookups(): Promise<CorrosionIndicatorLookups> {
    return request('api/corrosion-indicators/lookups');
  },

  async getAlsekoLoads(
    filters: JournalFilters = {}
  ): Promise<PaginatedResponse<AlsekoLoadSummary>> {
    return request('api/alseko/loads', { query: filters });
  },
  async getAlsekoLoad(id: number): Promise<AlsekoLoadDetails> {
    return request(`api/alseko/loads/${encodePath(id)}`);
  },
  async getAlsekoBuilding(id: number): Promise<AlsekoBuildingDetails> {
    return request(`api/alseko/buildings/${encodePath(id)}`);
  },
  async getAlsekoLookups(): Promise<AlsekoLookups> {
    return request('api/alseko/lookups');
  },
  async getUnassignedAlsekoBuildings(
    filters: JournalFilters = {}
  ): Promise<PaginatedResponse<AlsekoBuildingSummary>> {
    return request('api/alseko/buildings/unassigned', { query: filters });
  },

  async getElectricalObjects(
    filters: JournalFilters = {}
  ): Promise<PaginatedResponse<ElectricalObjectSummary>> {
    return request('api/electrical-network/objects', { query: filters });
  },
  async getElectricalObject(
    type: ElectricalObjectType,
    id: number
  ): Promise<ElectricalObjectDetails> {
    return request(`api/electrical-network/objects/${encodePath(type)}/${encodePath(id)}`);
  },
  async getElectricalNetworkLookups(): Promise<ElectricalNetworkLookups> {
    return request('api/electrical-network/lookups');
  },

  async getHeatLossSeasons(
    filters: JournalFilters = {}
  ): Promise<PaginatedResponse<HeatLossSeasonSummary>> {
    return request('api/heat-losses/seasons', { query: filters });
  },
  async getHeatLossSources(
    filters: JournalFilters = {}
  ): Promise<PaginatedResponse<HeatLossSourceSummary>> {
    return request('api/heat-losses/sources', { query: filters });
  },
  async getHeatLossLookups(): Promise<HeatLossLookups> {
    return request('api/heat-losses/lookups');
  },
  async getHeatLossSeason(id: number): Promise<HeatLossSeasonDetails> {
    return request(`api/heat-losses/seasons/${encodePath(id)}`);
  },
  async getHeatLossSource(id: number): Promise<HeatLossSourceDetails> {
    return request(`api/heat-losses/sources/${encodePath(id)}`);
  },

  async getConsumerLoadDiagnostics(
    filters: JournalFilters = {}
  ): Promise<PaginatedResponse<ConsumerLoadSummary>> {
    return request('api/consumer-load-diagnostics/consumers', { query: filters });
  },
  async getConsumerLoadLookups(): Promise<ConsumerLoadLookups> {
    return request('api/consumer-load-diagnostics/lookups');
  },
  async getConsumerLoadDiagnostic(
    type: ConsumerLoadType,
    id: number
  ): Promise<ConsumerLoadDetails> {
    return request(`api/consumer-load-diagnostics/consumers/${encodePath(type)}/${encodePath(id)}`);
  },

  async getTemperatureGraphSources(
    filters: TemperatureGraphFilters = {}
  ): Promise<PaginatedResponse<TemperatureGraphSourceSummary>> {
    return request('api/temperature-graphs/sources', { query: filters });
  },
  async getTemperatureGraphLookups(): Promise<TemperatureGraphLookups> {
    return request('api/temperature-graphs/lookups');
  },
  async getTemperatureGraphSource(id: number): Promise<TemperatureGraphSourceDetails> {
    return request(`api/temperature-graphs/sources/${encodePath(id)}`);
  },

  async getInstalledPumps(
    filters: InstalledPumpFilters = {}
  ): Promise<PaginatedResponse<InstalledPumpSummary>> {
    return request('api/pump-equipment/pumps', { query: filters });
  },
  async getPumpCatalog(
    filters: PumpCatalogFilters = {}
  ): Promise<PaginatedResponse<StandardPumpSummary>> {
    return request('api/pump-equipment/catalog', { query: filters });
  },
  async getPumpEquipmentLookups(): Promise<PumpEquipmentLookups> {
    return request('api/pump-equipment/lookups');
  },
  async getInstalledPump(id: number): Promise<InstalledPumpDetails> {
    return request(`api/pump-equipment/pumps/${encodePath(id)}`);
  },
  async getStandardPump(id: number): Promise<StandardPumpDetails> {
    return request(`api/pump-equipment/catalog/${encodePath(id)}`);
  },

  async getNetworkArmatures(
    filters: NetworkArmatureFilters = {}
  ): Promise<PaginatedResponse<NetworkArmatureSummary>> {
    return request('api/network-armatures/items', { query: filters });
  },
  async getStandardDampers(
    filters: StandardDamperFilters = {}
  ): Promise<PaginatedResponse<StandardDamperSummary>> {
    return request('api/network-armatures/catalog', { query: filters });
  },
  async getNetworkArmatureLookups(): Promise<NetworkArmatureLookups> {
    return request('api/network-armatures/lookups');
  },
  async getNetworkArmature(type: NetworkArmatureType, id: number): Promise<NetworkArmatureDetails> {
    return request(`api/network-armatures/items/${encodePath(type)}/${encodePath(id)}`);
  },
  async getStandardDamper(id: number): Promise<StandardDamperDetails> {
    return request(`api/network-armatures/catalog/${encodePath(id)}`);
  },

  async getNetworkRegulators(
    filters: NetworkRegulatorFilters = {}
  ): Promise<PaginatedResponse<NetworkRegulatorSummary>> {
    return request('api/network-regulators/items', { query: filters });
  },
  async getRegulatorCatalog(
    filters: StandardRegulatorFilters = {}
  ): Promise<PaginatedResponse<StandardRegulatorSummary>> {
    return request('api/network-regulators/catalog', { query: filters });
  },
  async getNetworkRegulatorLookups(): Promise<NetworkRegulatorLookups> {
    return request('api/network-regulators/lookups');
  },
  async getNetworkRegulator(
    type: NetworkRegulatorType,
    id: number
  ): Promise<NetworkRegulatorDetails> {
    return request(`api/network-regulators/items/${encodePath(type)}/${encodePath(id)}`);
  },
  async getRegulatorCatalogItem(
    type: NetworkRegulatorType,
    id: number
  ): Promise<StandardRegulatorDetails> {
    return request(`api/network-regulators/catalog/${encodePath(type)}/${encodePath(id)}`);
  },

  async getNetworkBypasses(
    filters: NetworkBypassFilters = {}
  ): Promise<PaginatedResponse<NetworkBypassSummary>> {
    return request('api/network-bypasses/items', { query: filters });
  },
  async getStandardTubes(
    filters: StandardTubeFilters = {}
  ): Promise<PaginatedResponse<StandardTubeSummary>> {
    return request('api/network-bypasses/tubes', { query: filters });
  },
  async getNetworkBypassLookups(): Promise<NetworkBypassLookups> {
    return request('api/network-bypasses/lookups');
  },
  async getNetworkBypass(id: number): Promise<NetworkBypassDetails> {
    return request(`api/network-bypasses/items/${encodePath(id)}`);
  },
  async getStandardTube(id: number): Promise<StandardTubeDetails> {
    return request(`api/network-bypasses/tubes/${encodePath(id)}`);
  },

  async getNetworkDiaphragms(
    filters: NetworkDiaphragmFilters = {}
  ): Promise<PaginatedResponse<NetworkDiaphragmSummary>> {
    return request('api/network-diaphragms/items', { query: filters });
  },
  async getNetworkDiaphragmLookups(): Promise<NetworkDiaphragmLookups> {
    return request('api/network-diaphragms/lookups');
  },
  async getNetworkDiaphragm(id: number): Promise<NetworkDiaphragmDetails> {
    return request(`api/network-diaphragms/items/${encodePath(id)}`);
  },

  async getElevators(
    filters: ElevatorFilters = {}
  ): Promise<PaginatedResponse<ElevatorSummary>> {
    return request('api/elevators', { query: filters });
  },
  async getElevatorLookups(): Promise<ElevatorLookups> {
    return request('api/elevators/lookups');
  },
  async getElevator(id: number): Promise<ElevatorDetails> {
    return request(`api/elevators/${encodePath(id)}`);
  },

  async createObject(table: string, fields: Record<string, any>): Promise<any> {
    const safeTable = encodePath(table);
    return mutationWithFallback(
      `api/v1/create/${safeTable}`,
      `create/${safeTable}`,
      mutationOptions('POST', { fields })
    );
  },

  async updateObjectAttributes(
    table: string,
    id: string | number,
    fields: Record<string, any>
  ): Promise<any> {
    const safeTable = encodePath(table);
    const safeId = encodePath(id);
    return mutationWithFallback(
      `api/v1/update/${safeTable}/${safeId}`,
      `update/${safeTable}/${safeId}`,
      mutationOptions('PUT', { fields })
    );
  },

  async deleteObject(table: string, id: string | number): Promise<any> {
    const safeTable = encodePath(table);
    const safeId = encodePath(id);
    return mutationWithFallback(
      `api/v1/delete/${safeTable}/${safeId}`,
      `delete/${safeTable}/${safeId}`,
      mutationOptions('DELETE')
    );
  },

  async getColumnTranslation(column: string): Promise<ColumnTranslation> {
    if (translationCache[column]) return translationCache[column];
    if (pendingTranslationRequests.has(column)) return pendingTranslationRequests.get(column)!;

    const pending = this.fetchColumnTranslation(column);
    pendingTranslationRequests.set(column, pending);
    try {
      const translation = await pending;
      translationCache[column] = translation;
      return translation;
    } finally {
      pendingTranslationRequests.delete(column);
    }
  },

  async fetchColumnTranslation(column: string): Promise<ColumnTranslation> {
    try {
      return await request(`russian-names/column/${encodePath(column)}`);
    } catch (error) {
      console.error(`Error fetching translation for column "${column}":`, error);
      return { column, russian_name: column, description: '' };
    }
  },

  async getMultipleTranslations(columns: string[]): Promise<Record<string, ColumnTranslation>> {
    const results: Record<string, ColumnTranslation> = {};
    const uncached = columns.filter((column) => {
      if (!translationCache[column]) return true;
      results[column] = translationCache[column];
      return false;
    });

    if (!uncached.length) return results;
    try {
      const batch = await $fetch<Record<string, ColumnTranslation>>('/api/translations-batch', {
        method: 'POST',
        body: { columns: uncached },
      });
      for (const [column, translation] of Object.entries(batch)) {
        translationCache[column] = translation;
        results[column] = translation;
      }
    } catch {
      await Promise.all(
        uncached.map(async (column) => {
          results[column] = await this.getColumnTranslation(column);
        })
      );
    }
    return results;
  },

  async getRussianName(column: string): Promise<string> {
    try {
      return (await this.getColumnTranslation(column)).russian_name || column;
    } catch {
      return column;
    }
  },

  async getRussianNames(columns: string[]): Promise<Record<string, string>> {
    const translations = await this.getMultipleTranslations(columns);
    return Object.fromEntries(
      Object.entries(translations).map(([column, translation]) => [
        column,
        translation.russian_name || column,
      ])
    );
  },

  getCachedRussianName(column: string): string {
    return translationCache[column]?.russian_name || column;
  },

  getCachedDescription(column: string): string {
    return translationCache[column]?.description || '';
  },

  isTranslationLoaded(column: string): boolean {
    return Boolean(translationCache[column]);
  },

  clearTranslationCache(): void {
    Object.keys(translationCache).forEach((key) => delete translationCache[key]);
    pendingTranslationRequests.clear();
  },

  getTranslationCacheSize(): number {
    return Object.keys(translationCache).length;
  },

  async preloadCommonTranslations(): Promise<void> {
    const columns = [
      'id',
      'name',
      'type',
      'status',
      'length',
      'diameter',
      'material',
      'pressure',
      'temperature',
      'flow_rate',
      'created_at',
      'updated_at',
      'externalsignlineid',
      'gid',
      'objectid',
      'objecttype',
    ];
    try {
      const batch = await $fetch<Record<string, ColumnTranslation>>('/api/translations-batch', {
        method: 'POST',
        body: { columns },
      });
      Object.assign(translationCache, batch);
    } catch {
      await this.getMultipleTranslations(columns);
    }
  },

  async getDefectsGeoJSON(): Promise<any> {
    return request('api/defects/geojson');
  },

  async getLatestCalculations(limit = 20): Promise<any> {
    return request('api/calculations/latest', { query: { limit } });
  },

  async getCalculationResultsGeoJSON(calculationId: number): Promise<any> {
    return request(`api/calculations/${encodePath(calculationId)}/results/geojson`);
  },

  async getCorrosionIndicatorsGeoJSON(): Promise<any> {
    return request('api/corrosion-indicators/geojson');
  },

  async getTopologyDiagnostics(limit = 100): Promise<TopologyDiagnosticsResponse> {
    return request('api/topology/diagnostics', { query: { limit } });
  },

  getFormReportUrl(formId: string, search?: string): string {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return buildApiUrl(`api/reports/html/${encodePath(formId)}${query}`);
  },

  async downloadWordReport(defectId: number): Promise<{ blob: Blob; filename: string }> {
    const blob = await request<Blob>(`reports/word/defect/${encodePath(defectId)}`, {
      responseType: 'blob',
    });
    return { blob, filename: `defect_${defectId}.docx` };
  },

  async downloadShpExport(): Promise<{ blob: Blob; filename: string }> {
    const blob = await request<Blob>('api/export/shp', { responseType: 'blob' });
    return { blob, filename: 'network_export.zip' };
  },

  async downloadExcelReport(docType: string): Promise<{ blob: Blob; filename: string }> {
    const blob = await request<Blob>(`api/reports/excel/${encodePath(docType)}`, {
      responseType: 'blob',
    });
    return { blob, filename: `report_${docType}.xlsx` };
  },

  async downloadCalculationExcel(calculationId: number): Promise<{ blob: Blob; filename: string }> {
    const blob = await request<Blob>(
      `api/calculations/${encodePath(calculationId)}/results/excel`,
      { responseType: 'blob' }
    );
    return { blob, filename: `calculation_${calculationId}_results.xlsx` };
  },

  async getPassportHierarchy(): Promise<PassportHierarchyGroup[]> {
    return request('api/passports/hierarchy');
  },

  async downloadPassport(
    msRs: PassportSite['ms_rs'],
    id: number
  ): Promise<{ blob: Blob; filename: string }> {
    const blob = await request<Blob>(`api/db/object/uchastok_${msRs}/${encodePath(id)}`, {
      method: 'POST',
      responseType: 'blob',
    });
    return { blob, filename: `Passport_${msRs}_${id}.xlsx` };
  },

  async downloadObjectPassport(
    table: string,
    id: number
  ): Promise<{ blob: Blob; filename: string }> {
    const blob = await request<Blob>(`api/db/object/${encodePath(table)}/${encodePath(id)}`, {
      method: 'POST',
      responseType: 'blob',
    });
    return { blob, filename: `Passport_${table}_${id}.xlsx` };
  },

  formatAttributeValue(value: any): string {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
    return String(value);
  },
};
