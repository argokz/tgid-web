/** Водопровод (itwin-api routers/water.py). Часть fastApiService (services/fastApiService.ts собирает разделы). */
import type { WaterModel, WaterRun, WaterStatus, WaterStep } from '~/utils/water';
import { encodePath, mutationOptions, request } from './http';

export const waterApi = {
  async getWaterStatus(): Promise<WaterStatus> {
    return request<WaterStatus>('api/v1/water/status', mutationOptions('GET'));
  },
  async getWaterLibrary(): Promise<{ name: string; file: string }[]> {
    return request('api/v1/water/library', mutationOptions('GET'));
  },
  async getWaterModels(): Promise<WaterModel[]> {
    return request<WaterModel[]>('api/v1/water/models', mutationOptions('GET'));
  },
  /** Учебная сеть движка (Net1, Net3, Net6, ky4…) — размещается схемой у центра города */
  async importWaterLibrary(library: string): Promise<{ id: number; nodes: number; links: number }> {
    return request('api/v1/water/models', mutationOptions('POST', { library }));
  },
  async deleteWaterModel(id: number): Promise<unknown> {
    return request(`api/v1/water/models/${encodePath(id)}`, mutationOptions('DELETE'));
  },
  async runWaterModel(id: number, durationH = 24, reportStepH = 1): Promise<{ id: number }> {
    return request(`api/v1/water/models/${encodePath(id)}/runs`,
      mutationOptions('POST', { duration_h: durationH, report_step_h: reportStepH }));
  },
  async getWaterRuns(id: number): Promise<WaterRun[]> {
    return request<WaterRun[]>(`api/v1/water/models/${encodePath(id)}/runs`, mutationOptions('GET'));
  },
  /** Сеть модели для карты (без значений расчёта) */
  async getWaterNetwork(id: number): Promise<GeoJSON.FeatureCollection> {
    return request(`api/v1/water/models/${encodePath(id)}/geojson`, mutationOptions('GET'));
  },
  /** Значения шага расчёта: давление узлов, расход и скорость участков */
  async getWaterStep(id: number, runId: number, step: number): Promise<WaterStep> {
    return request<WaterStep>(`api/v1/water/models/${encodePath(id)}/runs/${encodePath(runId)}/step`,
      { ...mutationOptions('GET'), query: { step } });
  },
};
