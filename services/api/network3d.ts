/** Теплосеть под землёй в 3D (itwin-api routers/network3d.py). Часть fastApiService. */
import type { Network3dResponse } from '~/utils/network3d';
import { mutationOptions, request } from './http';

export const network3dApi = {
  /** Участки в прямоугольнике [минДолгота, минШирота, максДолгота, максШирота] с глубиной заложения */
  async getNetwork3dLines(bbox: [number, number, number, number], fileids: number[] = []): Promise<Network3dResponse> {
    const query: Record<string, string> = { bbox: bbox.map((v) => v.toFixed(6)).join(',') };
    if (fileids.length) query.fileids = fileids.join(',');
    return request<Network3dResponse>('api/v1/network3d/lines', { ...mutationOptions('GET'), query, timeout: 120_000 });
  },
};
