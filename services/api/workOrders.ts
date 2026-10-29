/** Наряды и заявки (itwin-api routers/work_orders.py). Часть fastApiService (services/fastApiService.ts собирает разделы). */
import type {
  WorkOrder,
  WorkOrderInput,
  WorkOrderList,
  WorkOrderLookups,
  WorkOrderStatus,
} from '~/utils/workOrders';
import { encodePath, mutationOptions, request } from './http';

/** Действие с устройства в поле: ключ (повтор отправки без дублей) и где был телефон */
export interface FieldStamp {
  client_id?: string;
  lon?: number | null;
  lat?: number | null;
}

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
    body: { to: WorkOrderStatus; revision: number; note?: string; result?: string | null } & FieldStamp,
  ): Promise<WorkOrder> {
    return request<WorkOrder>(`api/v1/work-orders/${encodePath(id)}/transition`, mutationOptions('POST', body));
  },

  async commentWorkOrder(id: number, note: string, stamp: FieldStamp = {}): Promise<WorkOrder> {
    return request<WorkOrder>(`api/v1/work-orders/${encodePath(id)}/comments`, mutationOptions('POST', { note, ...stamp }));
  },

  /** Фото с места работ: JPEG/PNG/WebP до 2 МБ (на телефоне уменьшается заранее, utils/fieldPhoto.ts) */
  async addWorkOrderPhoto(
    id: number,
    photo: Blob,
    opts: { caption?: string; takenAt?: string | null } & FieldStamp = {},
  ): Promise<WorkOrder> {
    const form = new FormData();
    form.append('file', photo, 'photo.jpg');
    if (opts.caption) form.append('caption', opts.caption);
    if (opts.takenAt) form.append('taken_at', opts.takenAt);
    if (opts.client_id) form.append('client_id', opts.client_id);
    if (opts.lon != null && opts.lat != null) {
      form.append('lon', String(opts.lon));
      form.append('lat', String(opts.lat));
    }
    return request<WorkOrder>(`api/v1/work-orders/${encodePath(id)}/photos`, mutationOptions('POST', form));
  },

  /** Само фото (с токеном — поэтому blob, а не ссылка в <img>) */
  async getWorkOrderPhoto(photoId: number): Promise<Blob> {
    return request<Blob>(`api/v1/work-orders/photos/${encodePath(photoId)}`, { responseType: 'blob' });
  },
};
