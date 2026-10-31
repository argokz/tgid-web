/** Журналы эксплуатации: дефекты, шурфы, осмотры, ремонты, ТУ, Алсеко, электросети, теплопотери, нагрузки. Часть fastApiService (services/fastApiService.ts собирает разделы). */
import type { AlsekoAddressBindResult, AlsekoAddressCandidates, AlsekoBuildingDetails, AlsekoBuildingSummary, AlsekoConsumerBindResult, AlsekoLoadDetails, AlsekoLoadSummary, AlsekoLookups, AlsekoReconciliationIssues, AlsekoReconciliationSummary, ConsumerLoadDetails, ConsumerLoadLookups, ConsumerLoadSummary, ConsumerLoadType, CorrosionIndicatorDetails, CorrosionIndicatorLookups, CorrosionIndicatorSummary, DefectDetails, DefectLookups, DefectSummary, ElectricalBindObjectType, ElectricalBindResult, ElectricalNetworkLookups, ElectricalObjectDetails, ElectricalObjectSummary, ElectricalObjectType, ElectricalReconciliation, HeatLossLookups, HeatLossLosesType, HeatLossNormRun, HeatLossNormRunSummary, HeatLossNormScope, HeatLossNormSeason, HeatLossNormSection, HeatLossSeasonDetails, HeatLossSeasonSummary, HeatLossSourceDetails, HeatLossSourceSummary, InspectionDetails, InspectionLookups, InspectionSummary, JournalFilters, PaginatedResponse, PressureTestDetails, PressureTestLookups, PressureTestSummary, RepairDetails, RepairLookups, RepairSummary, ShurfDetails, ShurfLookups, ShurfSummary, TechnicalConditionDetails, TechnicalConditionLookups, TechnicalConditionSummary } from './types';
import { REPORT_TIMEOUT_MS, encodePath, mutationOptions, request, runFileJob } from './http';
import type { FileJobOptions } from './http';
import type { HotspotResult, SimilarResult } from '~/utils/defectSimilarity';

export const journalsApi = {
  async getDefects(filters: JournalFilters = {}): Promise<PaginatedResponse<DefectSummary>> {
    return request('api/defects', { query: filters });
  },
  async getDefect(id: number): Promise<DefectDetails> {
    return request(`api/defects/${encodePath(id)}`);
  },
  /** Похожие аварии рядом: вид, труба, Ду, место, общие слова */
  async getSimilarDefects(id: number, radiusM = 1000, limit = 10): Promise<SimilarResult> {
    return request(`api/v1/defects/${encodePath(id)}/similar`, { query: { radius_m: radiusM, limit } });
  },
  /** Похожие аварии, пересортированные ИИ (Claude читает тексты); без ИИ — порядок по признакам и ai_error */
  async getSimilarDefectsAi(id: number, radiusM = 1000, limit = 10): Promise<SimilarResult> {
    return request(`api/v1/ai/defects/${encodePath(id)}/similar`,
      mutationOptions('POST', { radius_m: radiusM, limit }));
  },
  /** Места повторных отказов (порывы, свищи, утечки) — кандидаты на перекладку */
  async getFailureHotspots(years = 5): Promise<HotspotResult> {
    return request('api/v1/defects/hotspots', { query: { years } });
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
  async getTechnicalConditionBalance(year?: number): Promise<{
    year: number | null;
    capacity_year?: number | null;
    notes?: string | null;
    items: Array<Record<string, number | string>>;
    totals: Record<string, number>;
  }> {
    return request('api/technical-conditions/balance', {
      query: year ? { year } : {},
    });
  },
  async createTechnicalCondition(fields: Record<string, any>): Promise<{ id: number }> {
    return request(
      'api/v1/technical-conditions',
      mutationOptions('POST', { fields })
    );
  },
  async updateTechnicalCondition(
    id: number,
    fields: Record<string, any>
  ): Promise<{ success: boolean }> {
    return request(
      `api/v1/technical-conditions/${encodePath(id)}`,
      mutationOptions('PUT', { fields })
    );
  },
  async deleteTechnicalCondition(id: number): Promise<{ success: boolean }> {
    return request(
      `api/v1/technical-conditions/${encodePath(id)}`,
      mutationOptions('DELETE')
    );
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

  /** Сверка АЛСЕКО: количество несоответствий по видам (десктоп nenaid1–3 и др.) */
  async getAlsekoReconciliation(): Promise<AlsekoReconciliationSummary> {
    return request('api/alseko/reconciliation');
  },
  async getAlsekoReconciliationIssues(kind: string, limit = 50, offset = 0): Promise<AlsekoReconciliationIssues> {
    return request('api/alseko/reconciliation/issues', { query: { kind, limit, offset } });
  },
  async downloadAlsekoReconciliationReport(kinds?: string[], options: FileJobOptions = {}): Promise<Blob> {
    const sync = async () => ({
      blob: await request<Blob>('api/alseko/reconciliation/report.xlsx', {
        ...mutationOptions('GET'),
        query: kinds?.length ? { kinds: kinds.join(',') } : undefined,
        responseType: 'blob',
        timeout: REPORT_TIMEOUT_MS,
      }),
      filename: 'alseko_reconciliation.xlsx',
    });
    return (await runFileJob('alseko_reconciliation', { kinds: kinds?.length ? kinds : null }, sync, options)).blob;
  },
  async getAlsekoAddresses(params: { q?: string; building_id?: number; limit?: number }): Promise<AlsekoAddressCandidates> {
    return request('api/alseko/addresses', { query: params });
  },
  /** Привязка здания к адресу АЛСЕКО; house пустой — снять привязку; dry_run — предпросмотр */
  async bindAlsekoBuildingAddress(
    buildingId: number,
    body: { microdistrict?: string | null; street?: string | null; house?: string | null; dry_run: boolean }
  ): Promise<AlsekoAddressBindResult> {
    return request(`api/alseko/buildings/${encodePath(buildingId)}/address`, mutationOptions('POST', body));
  },
  /** Назначить зданиям потребителя (zdaniya_2.potrebitel = «код узел») */
  async bindAlsekoConsumerBuildings(
    nodeId: number,
    body: { building_ids: number[]; dry_run: boolean }
  ): Promise<AlsekoConsumerBindResult> {
    return request(`api/alseko/consumers/${encodePath(nodeId)}/buildings`, mutationOptions('POST', body));
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
  /** Сверка привязки электросети: концы ЛЭП ↔ источник/приёмник, точечные объекты ↔ ЛЭП */
  async getElectricalReconciliation(params: { tolerance?: number; kind?: string; object_type?: string; limit?: number; offset?: number } = {}): Promise<ElectricalReconciliation> {
    return request('api/electrical-network/reconciliation', { query: params });
  },
  async downloadElectricalReconciliationReport(tolerance?: number, options: FileJobOptions = {}): Promise<Blob> {
    const sync = async () => ({
      blob: await request<Blob>('api/electrical-network/reconciliation/report.xlsx', {
        ...mutationOptions('GET'),
        query: tolerance ? { tolerance } : undefined,
        responseType: 'blob',
        timeout: REPORT_TIMEOUT_MS,
      }),
      filename: 'electrical_reconciliation.xlsx',
    });
    return (await runFileJob('electrical_reconciliation', tolerance ? { tolerance } : {}, sync, options)).blob;
  },
  /** Привязка по правилам десктопа (editor+, запись — MUTATIONS_ENABLED); dry_run — план «было → станет» */
  async bindElectricalNetwork(body: {
    tolerance?: number; overwrite?: boolean; snap_points?: boolean;
    items?: { object_type: ElectricalBindObjectType; id: number }[] | null; dry_run: boolean
  }): Promise<ElectricalBindResult> {
    return request('api/electrical-network/binding', mutationOptions('POST', body));
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
  async runHeatLosses(
    fragmentId: number,
    extraParams = ''
  ): Promise<{ task_id: string; params: string; success: boolean }> {
    return request(
      'api/v1/heat-losses/run',
      mutationOptions('POST', {
        fragment_id: fragmentId,
        extra_params: extraParams,
      })
    );
  },

  async getHeatLossNormScope(
    seasonId: number,
    fragmentId?: number | null,
    losesType: HeatLossLosesType = 'norm'
  ): Promise<HeatLossNormScope> {
    return request('api/v1/heat-losses/norm/scope', {
      query: { season_id: seasonId, loses_type: losesType, ...(fragmentId ? { fragment_id: fragmentId } : {}) },
    });
  },
  async getHeatLossNormSeasons(
    losesType: HeatLossLosesType = 'norm'
  ): Promise<{ loses_type: HeatLossLosesType; items: HeatLossNormSeason[] }> {
    return request('api/v1/heat-losses/norm/seasons', { query: { loses_type: losesType } });
  },
  async prepareHeatLossWorkConditions(
    sourceId: number,
    body: { season_id: number; tx?: Record<number, number>; t_percent?: number; dry_run?: boolean }
  ): Promise<{ months: Record<string, any>[]; creates_source_parameters: boolean; dry_run: boolean }> {
    return request(
      `api/v1/heat-losses/sources/${encodePath(sourceId)}/work-conditions`,
      mutationOptions('POST', body)
    );
  },
  async runHeatLossNorm(body: {
    season_id: number;
    loses_type?: HeatLossLosesType;
    fragment_id?: number | null;
    heat_source_ids?: number[] | null;
  }): Promise<{ success: boolean; task_id: string }> {
    return request('api/v1/heat-losses/norm/run', mutationOptions('POST', body));
  },
  async getHeatLossNormResults(
    filters: { fragment_id?: number | null; limit?: number; offset?: number } = {}
  ): Promise<{ total: number; items: HeatLossNormRunSummary[] }> {
    const query: Record<string, number> = {};
    if (filters.fragment_id) query.fragment_id = filters.fragment_id;
    if (filters.limit) query.limit = filters.limit;
    if (filters.offset) query.offset = filters.offset;
    return request('api/v1/heat-losses/norm/results', { query });
  },
  async getHeatLossNormResult(id: number, includeSheets = true): Promise<HeatLossNormRun> {
    return request(`api/v1/heat-losses/norm/results/${encodePath(id)}`, {
      query: { include_sheets: includeSheets },
    });
  },
  async getHeatLossNormSections(
    id: number,
    filters: { heat_source_id?: number | null; line_id?: number | null; page?: number; page_size?: number } = {}
  ): Promise<{ total: number; page: number; page_size: number; items: HeatLossNormSection[] }> {
    const query: Record<string, number> = {};
    for (const [key, value] of Object.entries(filters)) if (value) query[key] = Number(value);
    return request(`api/v1/heat-losses/norm/results/${encodePath(id)}/sections`, { query });
  },
  async downloadHeatLossNormExcel(id: number): Promise<{ blob: Blob; filename: string }> {
    const blob = await request<Blob>(`api/v1/heat-losses/norm/results/${encodePath(id)}/excel`, {
      responseType: 'blob',
    });
    return { blob, filename: `heat_losses_${id}.xlsx` };
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

  async getDefectsGeoJSON(): Promise<any> {
    return request('api/defects/geojson');
  },

  async getCorrosionIndicatorsGeoJSON(): Promise<any> {
    return request('api/corrosion-indicators/geojson');
  },
};
