/** Социальные объекты (itwin-api routers/poi.py). Часть fastApiService (services/fastApiService.ts собирает разделы). */
import type { PoiImportResult, PoiItem, PoiSource, PoiSummary } from '~/utils/poi';
import { cleanQuery, encodePath, mutationOptions, request } from './http';

export const poiApi = {
  async getPoiSummary(): Promise<PoiSummary> {
    return request<PoiSummary>('api/v1/poi/summary', mutationOptions('GET'));
  },

  async getPoiList(query: { category?: string; source?: PoiSource | null; q?: string; hidden?: boolean } = {}): Promise<PoiItem[]> {
    return request<PoiItem[]>('api/v1/poi', { ...mutationOptions('GET'), query: cleanQuery(query) });
  },

  async getPoiGeojson(category?: string): Promise<GeoJSON.FeatureCollection> {
    return request('api/v1/poi/geojson', { ...mutationOptions('GET'), query: category ? { category } : {} });
  },

  /** Найти среди потребителей сети по названиям (администратор) */
  async refreshPoiFromConsumers(): Promise<PoiImportResult> {
    return request<PoiImportResult>('api/v1/poi/refresh-consumers', mutationOptions('POST'));
  },

  /** Файл акимата: объекты GeoJSON; category — если в файле нет своей колонки category */
  async importPoiFile(body: { features: GeoJSON.Feature[]; category?: string | null }): Promise<PoiImportResult> {
    return request<PoiImportResult>('api/v1/poi/import', mutationOptions('POST', body));
  },

  async importPoiOsm(): Promise<PoiImportResult> {
    return request<PoiImportResult>('api/v1/poi/import-osm', mutationOptions('POST'));
  },

  async updatePoi(id: number, body: { hidden?: boolean; category?: string; name?: string }): Promise<PoiItem> {
    return request<PoiItem>(`api/v1/poi/${encodePath(id)}`, mutationOptions('PATCH', body));
  },

  async deletePoiSource(source: PoiSource): Promise<{ removed: number }> {
    return request('api/v1/poi', { ...mutationOptions('DELETE'), query: { source } });
  },
};
