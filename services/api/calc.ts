/** Расчёты, протоколы, анализ и калькуляторы. Часть fastApiService (services/fastApiService.ts собирает разделы). */
import type { CalcProtocolRecord, ProtocolLocateResult, ProtocolObject } from '~/utils/calcProtocol';
import type { CalculationDeleteResponse, CalculationGeoJsonResponse, CalculationListFilter, CalculationListResponse, CalculationSummaryItem, CalculationTemperatureRange, ElevatorEngineParams, ElevatorEngineResult, ElevatorNozzleParams, ElevatorNozzleResult, GvsCirculationParams, GvsCirculationResult, OrificePlateParams, OrificePlateResult, OutageSimulationResponse, RegimeAnalysisKind, RegimeAnalysisResult, SetyRunRequest, SetyRunResponse, ThrottlingSheetParams } from './types';
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
  }): Promise<OutageSimulationResponse> {
    return request<OutageSimulationResponse>('api/analysis/valve-isolation', {
      method: 'POST',
      body: params,
    });
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
