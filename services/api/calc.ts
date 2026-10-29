/** Расчёты, протоколы, анализ и калькуляторы. Часть fastApiService (services/fastApiService.ts собирает разделы). */
import type { CalcProtocolRecord, ProtocolLocateResult, ProtocolObject } from '~/utils/calcProtocol';
import type { CalculationDeleteResponse, CalculationGeoJsonResponse, CalculationListFilter, CalculationListResponse, CalculationSummaryItem, CalculationTemperatureRange, ElevatorEngineParams, ElevatorEngineResult, ElevatorNozzleParams, ElevatorNozzleResult, GvsCirculationParams, NetworkTraceRequest, NetworkTraceResponse, NetworkZonesResponse, TraceConfig, TraceConfigList, LayerStyle, LayerStyleList, SelectFields, SelectResult, SelectSpec, ThematicPipesResponse, GvsCirculationResult, OrificePlateParams, OrificePlateResult, OutageSimulationResponse, RegimeAnalysisKind, RegimeAnalysisResult, SetyRunRequest, SetyRunResponse, ThrottlingSheetParams } from './types';
import type { ThematicStyle, ThematicTheme } from '~/utils/thematicStyle';
import { encodePath, mutationOptions, request } from './http';

export const calcApi = {
  async getLatestCalculations(limit = 20): Promise<CalculationSummaryItem[]> {
    return request<CalculationSummaryItem[]>('api/calculations/latest', { query: { limit } });
  },

  /** Расчёт в режиме десктопа: плановый / аварийный, один фрагмент или по списку */
  async runSetyMode(body: SetyRunRequest): Promise<SetyRunResponse> {
    return request<SetyRunResponse>('api/v1/calculations/run', mutationOptions('POST', body));
  },

  /** Допустимая Tн расчёта (heatSystem: t_or … t_vnew); вне диапазона sety откажет */
  async getCalculationTemperatureRange(): Promise<CalculationTemperatureRange> {
    return request<CalculationTemperatureRange>('api/v1/calculations/temperature-range');
  },

  async listCalculations(filter: CalculationListFilter = {}): Promise<CalculationListResponse> {
    const query: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(filter)) {
      if (value !== null && value !== undefined && value !== '') query[key] = value as string | number;
    }
    return request<CalculationListResponse>('api/v1/calculations', { query });
  },

  /** Протоколы расчётов (разобранный вывод sety): список, по запросу, по расчёту */
  async listCalcProtocols(fileId?: number | null, limit = 50): Promise<{ items: CalcProtocolRecord[] }> {
    return request('api/v1/calculations/protocols', { query: fileId ? { file_id: fileId, limit } : { limit } });
  },

  async getCalcProtocol(id: number, output = false): Promise<CalcProtocolRecord> {
    return request(`api/v1/calculations/protocols/${id}`, output ? { query: { output: true } } : undefined);
  },

  async getCalcProtocolsByRequest(requestId: string, output = false): Promise<{ items: CalcProtocolRecord[] }> {
    return request(`api/v1/calculations/protocols/by-request/${encodePath(requestId)}`,
      output ? { query: { output: true } } : undefined);
  },

  async getCalculationProtocol(calculationId: number, output = false): Promise<CalcProtocolRecord> {
    return request(`api/v1/calculations/${calculationId}/protocol`, output ? { query: { output: true } } : undefined);
  },

  /** Геометрия (WGS84) объектов протокола для перехода на карте */
  async locateProtocolObjects(objects: ProtocolObject[]): Promise<ProtocolLocateResult> {
    return request('api/v1/calculations/protocols/locate', { method: 'POST', body: { objects } });
  },

  /** Удаляет расчёт и его *_out-строки (только при MUTATIONS_ENABLED) */
  async deleteCalculation(calculationId: number): Promise<CalculationDeleteResponse> {
    return request<CalculationDeleteResponse>(
      `api/v1/calculations/${encodePath(calculationId)}`,
      mutationOptions('DELETE'),
    );
  },

  async getCalculationResultsGeoJSON(calculationId: number): Promise<CalculationGeoJsonResponse> {
    return request<CalculationGeoJsonResponse>(`api/calculations/${encodePath(calculationId)}/results/geojson`);
  },

  async getCalculationResultsGeoJson(calculationId: number): Promise<CalculationGeoJsonResponse> {
    return this.getCalculationResultsGeoJSON(calculationId);
  },

  /** Анализ режима по последнему расчёту фрагмента (десктоп «Анализ»). */
  async getRegimeAnalysis(
    kind: RegimeAnalysisKind,
    fragmentId: number,
    options: { calculationId?: number; includeUncalculated?: boolean } = {},
  ): Promise<RegimeAnalysisResult> {
    return request<RegimeAnalysisResult>(`api/analysis/regime/${kind}`, {
      query: {
        fragment_id: fragmentId,
        ...(options.calculationId ? { calculation_id: options.calculationId } : {}),
        ...(options.includeUncalculated ? { include_uncalculated: true } : {}),
      },
    });
  },
  async downloadCalculationExcel(calculationId: number): Promise<{ blob: Blob; filename: string }> {
    const blob = await request<Blob>(
      `api/calculations/${encodePath(calculationId)}/results/excel`,
      { responseType: 'blob' }
    );
    return { blob, filename: `calculation_${calculationId}_results.xlsx` };
  },

  async simulateValveIsolation(params: {
    line_id?: number | null;
    node_id?: number | null;
    /** Задвижки «не держит» — зона расширяется до следующих */
    failed_valve_ids?: number[];
  }): Promise<OutageSimulationResponse> {
    return request<OutageSimulationResponse>('api/analysis/valve-isolation', {
      method: 'POST',
      body: params,
    });
  },

  /** Трассировка сети: связность, путь к источникам, ниже по потоку, зона */
  async traceNetwork(body: NetworkTraceRequest): Promise<NetworkTraceResponse> {
    return request<NetworkTraceResponse>('api/analysis/trace', { method: 'POST', body });
  },

  /** Именованные настройки трассировки: встроенные, общие и свои */
  async getTraceConfigs(): Promise<TraceConfigList> {
    return request<TraceConfigList>('api/v1/trace-configs', mutationOptions('GET'));
  },

  async createTraceConfig(body: { name: string; params: TraceConfig['params']; shared: boolean }): Promise<TraceConfig> {
    return request<TraceConfig>('api/v1/trace-configs', mutationOptions('POST', body));
  },

  async deleteTraceConfig(id: string): Promise<void> {
    await request(`api/v1/trace-configs/${encodePath(id)}`, mutationOptions('DELETE'));
  },

  /** Тематические карты (Smart Mapping): темы и значения темы у участков фрагментов */
  async getThematicThemes(): Promise<{ themes: ThematicTheme[]; max_features: number }> {
    return request('api/v1/thematic/themes');
  },

  async getThematicPipes(theme: string, fragmentIds: number[], bbox?: [number, number, number, number] | null):
    Promise<ThematicPipesResponse> {
    const query: Record<string, string> = { theme, fragment_ids: fragmentIds.join(',') };
    if (bbox) query.bbox = bbox.map((v) => v.toFixed(5)).join(',');
    return request<ThematicPipesResponse>('api/v1/thematic/pipes', { query });
  },

  /** Выборка объектов сети по условиям: поля конструктора и выполнение запроса */
  async getNetworkSelectFields(): Promise<SelectFields> {
    return request<SelectFields>('api/v1/network-select/fields');
  },

  async runNetworkSelect(spec: SelectSpec, bbox?: [number, number, number, number] | null): Promise<SelectResult> {
    const body = { spec, bbox: bbox ? bbox.map((v) => v.toFixed(5)).join(',') : null };
    return request<SelectResult>('api/v1/network-select', { method: 'POST', body });
  },

  async getLayerStyles(): Promise<LayerStyleList> {
    return request<LayerStyleList>('api/v1/layer-styles', mutationOptions('GET'));
  },

  async createLayerStyle(body: { name: string; style: ThematicStyle; shared: boolean }): Promise<LayerStyle> {
    return request<LayerStyle>('api/v1/layer-styles', mutationOptions('POST', body));
  },

  async updateLayerStyle(id: string, body: { name?: string; style?: ThematicStyle; shared?: boolean; revision?: number }):
    Promise<LayerStyle> {
    return request<LayerStyle>(`api/v1/layer-styles/${encodePath(id)}`, mutationOptions('PUT', body));
  },

  async deleteLayerStyle(id: string): Promise<void> {
    await request(`api/v1/layer-styles/${encodePath(id)}`, mutationOptions('DELETE'));
  },

  /** Зоны сети (компоненты связности) и «острова» без питания */
  async getNetworkZones(minNodes = 1): Promise<NetworkZonesResponse> {
    return request<NetworkZonesResponse>('api/analysis/subnetworks', { query: { min_nodes: minNodes } });
  },

  async calculateOrificePlate(params: OrificePlateParams): Promise<OrificePlateResult> {
    return request<OrificePlateResult>('api/calc/orifice-plate', {
      method: 'POST',
      body: params,
    });
  },

  async calculateElevatorNozzle(params: ElevatorNozzleParams): Promise<ElevatorNozzleResult> {
    return request<ElevatorNozzleResult>('api/calc/elevator-nozzle', {
      method: 'POST',
      body: params,
    });
  },

  async calculateGvsCirculationDiaphragm(params: GvsCirculationParams): Promise<GvsCirculationResult> {
    return request<GvsCirculationResult>('api/calc/gvs-circulation-diaphragm', { method: 'POST', body: params });
  },

  async calculateElevatorEngine(params: ElevatorEngineParams): Promise<ElevatorEngineResult> {
    return request<ElevatorEngineResult>('api/calc/elevator-engine', { method: 'POST', body: params });
  },

  async downloadThrottlingSheet(params: ThrottlingSheetParams): Promise<{ blob: Blob; filename: string }> {
    const blob = await request<Blob>('api/calc/throttling-sheet', {
      method: 'POST',
      body: params,
      responseType: 'blob',
    });
    return { blob, filename: `Расчёт_дросселирования_${Date.now()}.xlsx` };
  },
};
