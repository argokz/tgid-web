/** Водопровод (itwin-api routers/water.py). Часть fastApiService (services/fastApiService.ts собирает разделы). */
import type {
  WaterBalance, WaterIsolation, WaterModel, WaterRun, WaterStatus, WaterStep, WaterValves, WaterZones,
} from '~/utils/water';
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
  /** Расчёт модели; leaks — сценарий утечек: истечение из отверстия площадью area_cm2 в узле */
  async runWaterModel(id: number, durationH = 24, reportStepH = 1,
    leaks: { node: string; area_cm2: number }[] = []): Promise<{ id: number }> {
    return request(`api/v1/water/models/${encodePath(id)}/runs`,
      mutationOptions('POST', { duration_h: durationH, report_step_h: reportStepH, leaks }));
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
  /** Зоны водоучёта (DMA) между насосами, арматурой, закрытыми трубами и расходомерами */
  async getWaterZones(id: number): Promise<WaterZones> {
    return request<WaterZones>(`api/v1/water/models/${encodePath(id)}/zones`, mutationOptions('GET'));
  },
  /** Расходомеры модели — трубы-вводы зон */
  async setWaterMeters(id: number, links: string[]): Promise<WaterZones> {
    return request<WaterZones>(`api/v1/water/models/${encodePath(id)}/meters`, mutationOptions('PUT', { links }));
  },
  /** Баланс по зонам расчёта; сценарий утечки — против базового расчёта (baseline — свой выбор) */
  async getWaterBalance(id: number, runId: number, baseline?: number): Promise<WaterBalance> {
    return request<WaterBalance>(`api/v1/water/models/${encodePath(id)}/runs/${encodePath(runId)}/balance`,
      { ...mutationOptions('GET'), query: baseline ? { baseline } : {} });
  },
  /** Задвижки модели точками */
  async getWaterValves(id: number): Promise<WaterValves> {
    return request<WaterValves>(`api/v1/water/models/${encodePath(id)}/valves`, mutationOptions('GET'));
  },
  /** Расставить задвижки «N−1» (у узла с N трубами — на N−1 из них) */
  async generateWaterValves(id: number): Promise<WaterValves> {
    return request<WaterValves>(`api/v1/water/models/${encodePath(id)}/valves/generate`, mutationOptions('POST'));
  },
  /** Отключение трубы: задвижки, узлы без воды; run — ещё и расчёт EPANET с отбором по давлению */
  async waterIsolation(id: number, linkId: string, run = false): Promise<WaterIsolation> {
    return request<WaterIsolation>(`api/v1/water/models/${encodePath(id)}/isolation${run ? '/run' : ''}`,
      mutationOptions('POST', { link_id: linkId }));
  },
};
