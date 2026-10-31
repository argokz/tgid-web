/** Общая карта коммуникаций (itwin-api routers/utilities.py). Часть fastApiService (services/fastApiService.ts собирает разделы). */
import type { HeatDepthStatus, UtilityConflicts, UtilityExcavation, UtilityNorm } from '~/utils/utilities';
import { mutationOptions, request } from './http';

export const utilitiesApi = {
  async getUtilityNorms(): Promise<UtilityNorm[]> {
    return request<UtilityNorm[]>('api/v1/utilities/norms', mutationOptions('GET'));
  },
  /** Изменить норму расстояния между видами сетей (право «Справочники») */
  async setUtilityNorm(norm: Pick<UtilityNorm, 'kind_a' | 'kind_b' | 'horizontal_m' | 'vertical_m' | 'source'>): Promise<UtilityNorm> {
    return request<UtilityNorm>('api/v1/utilities/norms', mutationOptions('PUT', norm));
  },
  /** Сближения и пересечения: модель водопровода × теплосеть города */
  async getUtilityConflicts(waterModel: number): Promise<UtilityConflicts> {
    return request<UtilityConflicts>('api/v1/utilities/conflicts', { ...mutationOptions('GET'), query: { water_model: waterModel } });
  },
  /** Сети в зоне работ: геометрия (WGS84) + отступ */
  async checkExcavation(geometry: GeoJSON.Geometry, bufferM: number): Promise<UtilityExcavation> {
    return request<UtilityExcavation>('api/v1/utilities/excavation', mutationOptions('POST', { geometry, buffer_m: bufferM }));
  },
  /** Глубина теплосети из отметок узлов: последний пересчёт и точность оценки */
  async getHeatDepthStatus(): Promise<HeatDepthStatus> {
    return request<HeatDepthStatus>('api/v1/utilities/depths', mutationOptions('GET'));
  },
  async refreshHeatDepth(): Promise<HeatDepthStatus['report']> {
    return request('api/v1/utilities/depths/refresh', mutationOptions('POST'));
  },
};
