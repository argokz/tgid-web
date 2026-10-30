/** Показатели эксплуатации (itwin-api routers/kpi.py). Часть fastApiService (services/fastApiService.ts собирает разделы). */
import type { KpiDashboard } from '~/utils/kpi';
import { mutationOptions, request } from './http';

export interface KpiFilters {
  date_from?: string;
  date_to?: string;
  fileid?: number | null;
  bbox?: string | null;
}

const clean = (q: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(q).filter(([, v]) => v != null && v !== '')) as Record<string, string | number>;

export const kpiApi = {
  async getKpiDashboard(filters: KpiFilters = {}): Promise<KpiDashboard> {
    return request<KpiDashboard>('api/v1/kpi/dashboard', { ...mutationOptions('GET'), query: clean({ ...filters }) });
  },

  /** Дефекты периода точками: месяц, категория (0 — без категории) или состояние с графика */
  async getKpiDefectPoints(
    filters: KpiFilters & { month?: string; category_id?: number | null; state_id?: number | null },
  ): Promise<GeoJSON.FeatureCollection & { truncated?: boolean }> {
    return request('api/v1/kpi/defects/geojson', { ...mutationOptions('GET'), query: clean({ ...filters }) });
  },
};
