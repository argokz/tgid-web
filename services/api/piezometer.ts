/** Пьезометрические графики. Часть fastApiService (services/fastApiService.ts собирает разделы). */
import type { PiezometerDirection, PiezometerDirectionDetail, PiezometerRouteResponse, TravelTimeResponse } from './types';
import { encodePath, mutationOptions, request } from './http';

export const piezometerApi = {
  async getPiezometerPath(start: number, end: number): Promise<any> {
    return request('piezometer/path', { query: { start, end } });
  },

  /** Маршрут пьезометра через последовательность узлов (waypoints) */
  async buildPiezometerRoute(nodes: number[], calculationId2?: number | null): Promise<PiezometerRouteResponse> {
    return request<PiezometerRouteResponse>('piezometer/route', {
      method: 'POST',
      body: calculationId2 ? { nodes, calculation_id_2: calculationId2 } : { nodes },
    });
  },

  /** Сохранённые направления пьезометра (десктоп «Список направлений») */
  async listPiezometerDirections(fileIds?: number[]): Promise<{ items: PiezometerDirection[]; count: number }> {
    return request('piezometer/directions', fileIds?.length ? { query: { fileid: fileIds } } : {});
  },

  async getPiezometerDirection(id: number): Promise<PiezometerDirectionDetail> {
    return request(`piezometer/directions/${encodePath(id)}`);
  },

  async savePiezometerDirection(body: { name: string; nodes: number[]; fileid?: number | null; replace?: boolean }): Promise<PiezometerDirectionDetail & { replaced: number[] }> {
    return request('piezometer/directions', mutationOptions('POST', body));
  },

  async deletePiezometerDirection(id: number): Promise<{ deleted: number }> {
    return request(`piezometer/directions/${encodePath(id)}`, mutationOptions('DELETE'));
  },

  /** Время прохождения потока по маршруту (десктоп OnTimePr) — те же waypoints, что у пьезометра */
  async getTravelTime(nodes: number[], calculationId?: number): Promise<TravelTimeResponse> {
    return request<TravelTimeResponse>('api/analysis/travel-time', {
      method: 'POST',
      body: { nodes, ...(calculationId ? { calculation_id: calculationId } : {}) },
    });
  },

  async downloadPiezometerExcel(
    waypoints: number[],
    opts: { calculationId2?: number | null; includeStatic?: boolean } = {}
  ): Promise<{ blob: Blob; filename: string }> {
    const body: Record<string, any> = { waypoints };
    if (opts.calculationId2) body.calculation_id_2 = opts.calculationId2;
    if (opts.includeStatic === false) body.include_static = false;
    const blob = await request<Blob>('api/piezometer/excel', {
      method: 'POST',
      body,
      responseType: 'blob',
    });
    return { blob, filename: `Piezometer_Profile_${Date.now()}.xlsx` };
  },
};
