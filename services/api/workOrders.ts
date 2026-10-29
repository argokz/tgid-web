/** Наряды и заявки (itwin-api routers/work_orders.py). Часть fastApiService (services/fastApiService.ts собирает разделы). */
import type {
  WorkOrder,
  WorkOrderInput,
  WorkOrderList,
  WorkOrderLookups,
  WorkOrderStatus,
} from '~/utils/workOrders';
import { encodePath, mutationOptions, request } from './http';

export interface WorkOrderFilters {
  status?: WorkOrderStatus | null;
  brigade_id?: number | null;
  q?: string | null;
  open_only?: boolean;
}

export const workOrdersApi = {
  async getWorkOrderLookups(): Promise<WorkOrderLookups> {
    return request<WorkOrderLookups>('api/v1/work-orders/lookups');
  },

  async getWorkOrders(filters: WorkOrderFilters = {}): Promise<WorkOrderList> {
    const query: Record<string, string | number | boolean> = {};
    if (filters.status) query.status = filters.status;
    if (filters.brigade_id) query.brigade_id = filters.brigade_id;
    if (filters.q?.trim()) query.q = filters.q.trim();
    if (filters.open_only) query.open_only = true;
    return request<WorkOrderList>('api/v1/work-orders', { ...mutationOptions('GET'), query });
  },

  async getWorkOrder(id: number): Promise<WorkOrder> {
    return request<WorkOrder>(`api/v1/work-orders/${encodePath(id)}`, mutationOptions('GET'));
  },

  async getWorkOrdersGeoJson(): Promise<GeoJSON.FeatureCollection> {
    return request<GeoJSON.FeatureCollection>('api/v1/work-orders/geojson', mutationOptions('GET'));
  },

  async createWorkOrder(body: WorkOrderInput): Promise<WorkOrder> {
    return request<WorkOrder>('api/v1/work-orders', mutationOptions('POST', body));
  },

  async updateWorkOrder(id: number, body: Partial<WorkOrderInput> & { revision: number; result?: string }): Promise<WorkOrder> {
    return request<WorkOrder>(`api/v1/work-orders/${encodePath(id)}`, mutationOptions('PATCH', body));
  },

  async transitionWorkOrder(
    id: number,
    body: { to: WorkOrderStatus; revision: number; note?: string; result?: string | null },
  ): Promise<WorkOrder> {
    return request<WorkOrder>(`api/v1/work-orders/${encodePath(id)}/transition`, mutationOptions('POST', body));
  },

  async commentWorkOrder(id: number, note: string): Promise<WorkOrder> {
    return request<WorkOrder>(`api/v1/work-orders/${encodePath(id)}/comments`, mutationOptions('POST', { note }));
  },
};
