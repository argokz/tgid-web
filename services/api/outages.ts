/** Плановые и аварийные отключения (itwin-api routers/outages.py). Часть fastApiService (services/fastApiService.ts). */
import type { Outage, OutageInput, OutageList, OutageStatus } from '~/utils/outages';
import { encodePath, filenameFromDisposition, mutationOptions, request } from './http';

export const outagesApi = {
  async getOutages(filters: { status?: OutageStatus | null; q?: string | null; open_only?: boolean } = {}): Promise<OutageList> {
    const query: Record<string, string | boolean> = {};
    if (filters.status) query.status = filters.status;
    if (filters.q?.trim()) query.q = filters.q.trim();
    if (filters.open_only) query.open_only = true;
    return request<OutageList>('api/v1/outages', { ...mutationOptions('GET'), query });
  },

  async getOutage(id: number): Promise<Outage> {
    return request<Outage>(`api/v1/outages/${encodePath(id)}`, mutationOptions('GET'));
  },

  async getOutageZones(): Promise<GeoJSON.FeatureCollection> {
    return request<GeoJSON.FeatureCollection>('api/v1/outages/geojson', mutationOptions('GET'));
  },

  async createOutage(body: OutageInput): Promise<Outage> {
    return request<Outage>('api/v1/outages', mutationOptions('POST', body));
  },

  async updateOutage(id: number, body: Partial<OutageInput> & { revision: number }): Promise<Outage> {
    return request<Outage>(`api/v1/outages/${encodePath(id)}`, mutationOptions('PATCH', body));
  },

  async recomputeOutage(id: number, revision: number): Promise<Outage> {
    return request<Outage>(`api/v1/outages/${encodePath(id)}/recompute`, mutationOptions('POST', { revision }));
  },

  async transitionOutage(id: number, body: { to: OutageStatus; revision: number; note?: string }): Promise<Outage> {
    return request<Outage>(`api/v1/outages/${encodePath(id)}/transition`, mutationOptions('POST', body));
  },

  async getOutageAnnouncement(id: number): Promise<string> {
    return (await request<{ text: string }>(`api/v1/outages/${encodePath(id)}/announcement`, mutationOptions('GET'))).text;
  },

  async downloadOutageNotification(id: number): Promise<{ blob: Blob; filename: string }> {
    let filename = '';
    const blob = await request<Blob>(`api/v1/outages/${encodePath(id)}/notification.xlsx`, {
      ...mutationOptions('GET'),
      responseType: 'blob',
      onResponse({ response }: any) {
        filename = filenameFromDisposition(response?.headers?.get?.('content-disposition')) ?? '';
      },
    });
    return { blob, filename: filename || `outage_${id}.xlsx` };
  },
};
