/** Оборудование и режимы: температурные графики, насосы, арматура, регуляторы, байпасы, диафрагмы, элеваторы. Часть fastApiService (services/fastApiService.ts собирает разделы). */
import type { ElevatorDetails, ElevatorFilters, ElevatorLookups, ElevatorSummary, InstalledPumpDetails, InstalledPumpFilters, InstalledPumpSummary, NetworkArmatureDetails, NetworkArmatureFilters, NetworkArmatureLookups, NetworkArmatureSummary, NetworkArmatureType, NetworkBypassDetails, NetworkBypassFilters, NetworkBypassLookups, NetworkBypassSummary, NetworkDiaphragmDetails, NetworkDiaphragmFilters, NetworkDiaphragmLookups, NetworkDiaphragmSummary, NetworkRegulatorDetails, NetworkRegulatorFilters, NetworkRegulatorLookups, NetworkRegulatorSummary, NetworkRegulatorType, PaginatedResponse, PumpCatalogFilters, PumpEquipmentLookups, StandardDamperDetails, StandardDamperFilters, StandardDamperSummary, StandardPumpDetails, StandardPumpSummary, StandardRegulatorDetails, StandardRegulatorFilters, StandardRegulatorSummary, StandardTubeDetails, StandardTubeFilters, StandardTubeSummary, TemperatureGraphFilters, TemperatureGraphLookups, TemperatureGraphMode, TemperatureGraphPreview, TemperatureGraphSourceDetails, TemperatureGraphSourceSummary } from './types';
import { encodePath, mutationOptions, request } from './http';

export const equipmentApi = {
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
  async recalculateTemperatureGraph(
    sourceId: number,
    mode: TemperatureGraphMode = 'otop'
  ): Promise<{ success: boolean; points: number; mode?: string }> {
    return request(
      `api/temperature-graphs/sources/${encodePath(sourceId)}/recalculate?mode=${encodeURIComponent(mode)}`,
      mutationOptions('POST', {})
    );
  },
  async previewTemperatureGraph(
    sourceId: number,
    mode: TemperatureGraphMode = 'auto'
  ): Promise<TemperatureGraphPreview> {
    return request(`api/temperature-graphs/sources/${encodePath(sourceId)}/preview`, { query: { mode } });
  },
  async applyStationaryTemperatureGraph(
    sourceId: number,
    body: { t1: number; t2: number; t3: number; tv: number }
  ): Promise<{ success: boolean; updated_points: number }> {
    return request(
      `api/temperature-graphs/sources/${encodePath(sourceId)}/stationary`,
      mutationOptions('POST', body)
    );
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
};
