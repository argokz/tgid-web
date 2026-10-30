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

/** Дефект с обхода: точка, что нашли; участок сервер берёт ближайший (до 30 м), если не указан */
export interface FieldDefectInput {
  lon: number;
  lat: number;
  description: string;
  line_id?: number | null;
  source_id?: number | null;
  category_id?: number | null;
  priority?: number;
  found_at?: string | null;
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

  /** «Дефект одной кнопкой» с обхода: дефект в журнал десктопа и заявка по нему (ответ — заявка) */
  async reportFieldDefect(body: FieldDefectInput & FieldStamp): Promise<WorkOrder> {
    return request<WorkOrder>('api/v1/work-orders/field-defect', mutationOptions('POST', body));
  },

  /** Пачка точек трека бригады; повтор той же пачки сервер не дублирует */
  async sendFieldTrack(body: {
    brigade_id: number | null;
    points: Array<{ t: string; lon: number; lat: number; accuracy: number | null }>;
  }): Promise<{ accepted: number; skipped: number }> {
    return request('api/v1/field/track', mutationOptions('POST', body));
  },

  /** Где бригады сейчас: последняя точка каждого за hours часов (право «Журналы») */
  async getFieldPositions(hours = 12): Promise<GeoJSON.FeatureCollection> {
    return request<GeoJSON.FeatureCollection>('api/v1/field/positions', { ...mutationOptions('GET'), query: { hours } });
  },

  /** Трек бригады за период (по умолчанию — последние сутки) */
  async getFieldTrack(params: { brigade_id?: number; user?: string; since?: string; until?: string }): Promise<GeoJSON.FeatureCollection> {
    const query = Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== '')) as Record<string, string | number>;
    return request<GeoJSON.FeatureCollection>('api/v1/field/track', { ...mutationOptions('GET'), query });
  },

  /** Само фото (с токеном — поэтому blob, а не ссылка в <img>) */
  async getWorkOrderPhoto(photoId: number): Promise<Blob> {
    return request<Blob>(`api/v1/work-orders/photos/${encodePath(photoId)}`, { responseType: 'blob' });
  },
};
