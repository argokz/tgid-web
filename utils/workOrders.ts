/**
 * Наряды и заявки (itwin-api database/work_orders.py): статусы, переходы и их подписи, цвета, даты для
 * полей ввода. Чистые функции — окно WorkOrdersDialog.vue и слой карты пользуются одними правилами.
 */

export type WorkOrderStatus = 'new' | 'assigned' | 'in_progress' | 'done' | 'closed' | 'cancelled';
export type WorkOrderKind = 'repair' | 'inspection' | 'pressure_test' | 'excavation' | 'maintenance' | 'other';

export interface WorkOrderEvent {
  at: string;
  by_user: string;
  from_status: WorkOrderStatus | null;
  to_status: WorkOrderStatus | null;
  to_label: string | null;
  note: string;
  /** где был телефон при действии из полевого приложения */
  lon?: number | null;
  lat?: number | null;
}

/** Фото с места работ (само фото — GET api/v1/work-orders/photos/{id}) */
export interface WorkOrderPhoto {
  id: number;
  caption: string;
  content_type: string;
  size: number;
  lon: number | null;
  lat: number | null;
  taken_at: string | null;
  by_user: string;
  created_at: string;
}

export interface WorkOrder {
  id: number;
  number: string;
  title: string;
  kind: WorkOrderKind;
  kind_label: string;
  priority: number;
  priority_label: string;
  status: WorkOrderStatus;
  status_label: string;
  next: WorkOrderStatus[];
  defect_id: number | null;
  defect_name: string | null;
  line_id: number | null;
  node_id: number | null;
  fileid: number | null;
  lon: number | null;
  lat: number | null;
  brigade_id: number | null;
  brigade_name: string | null;
  responsible_id: number | null;
  responsible_name: string | null;
  planned_start: string | null;
  planned_finish: string | null;
  started_at: string | null;
  finished_at: string | null;
  closed_at: string | null;
  description: string;
  result: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  revision: number;
  overdue: boolean;
  events?: WorkOrderEvent[];
  photos?: WorkOrderPhoto[];
}

export interface WorkOrderList {
  items: WorkOrder[];
  counts: Record<WorkOrderStatus, number>;
  overdue: number;
}

export interface WorkOrderLookups {
  brigades: Array<{ id: number; name: string }>;
  responsibles: Array<{ id: number; name: string }>;
  kinds: Array<{ value: WorkOrderKind; label: string }>;
  priorities: Array<{ value: number; label: string }>;
  statuses: Array<{ value: WorkOrderStatus; label: string }>;
  transitions: Record<WorkOrderStatus, WorkOrderStatus[]>;
}

export interface WorkOrderInput {
  title: string;
  kind: WorkOrderKind;
  priority: number;
  defect_id?: number | null;
  line_id?: number | null;
  node_id?: number | null;
  brigade_id?: number | null;
  responsible_id?: number | null;
  planned_start?: string | null;
  planned_finish?: string | null;
  description: string;
}

export const STATUS_ORDER: WorkOrderStatus[] = ['new', 'assigned', 'in_progress', 'done', 'closed', 'cancelled'];
export const OPEN_STATUSES: WorkOrderStatus[] = ['new', 'assigned', 'in_progress'];

/** Цвета статусов (значки — в WorkOrdersDialog.vue: они из ленивого набора иконок окон) */
export const STATUS_META: Record<WorkOrderStatus, { color: string; mapColor: string }> = {
  new: { color: 'blue-grey', mapColor: '#607D8B' },
  assigned: { color: 'indigo', mapColor: '#3949AB' },
  in_progress: { color: 'orange-darken-2', mapColor: '#F57C00' },
  done: { color: 'teal', mapColor: '#00897B' },
  closed: { color: 'success', mapColor: '#2E7D32' },
  cancelled: { color: 'grey', mapColor: '#9E9E9E' },
};

export const PRIORITY_COLORS: Record<number, string> = { 1: 'error', 2: 'warning', 3: 'default' };

/** Подпись кнопки перехода: из статуса from в статус to */
export function transitionLabel(from: WorkOrderStatus, to: WorkOrderStatus): string {
  if (to === 'cancelled') return 'Отменить';
  if (to === 'assigned') return from === 'new' ? 'Назначить' : 'Вернуть в назначенные';
  if (to === 'in_progress') return from === 'done' ? 'Вернуть в работу' : 'Начать работу';
  if (to === 'done') return 'Выполнено';
  if (to === 'closed') return 'Принять и закрыть';
  if (to === 'new') return from === 'cancelled' ? 'Открыть снова' : 'Вернуть в заявки';
  return to;
}

/** Переход вперёд по цепочке (основная кнопка), остальные — второстепенные */
export function isForward(from: WorkOrderStatus, to: WorkOrderStatus): boolean {
  if (to === 'cancelled') return false;
  return STATUS_ORDER.indexOf(to) > STATUS_ORDER.indexOf(from) || (from === 'cancelled' && to === 'new');
}

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO из API → значение <input type="datetime-local"> (местное время) */
export function toInputDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Значение datetime-local (местное время) → ISO с часовым поясом; пусто — null */
export function fromInputDateTime(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** «01.11.2026 18:00» */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Где работы: дефект, участок, узел */
export function placeText(o: Pick<WorkOrder, 'defect_id' | 'line_id' | 'node_id' | 'fileid'>): string {
  const parts = [
    o.defect_id ? `дефект №${o.defect_id}` : '',
    o.line_id ? `участок ${o.line_id}` : '',
    o.node_id ? `узел ${o.node_id}` : '',
    o.fileid ? `фр. ${o.fileid}` : '',
  ];
  return parts.filter(Boolean).join(' · ') || 'место не указано';
}

/** Открытые наряды точками для слоя карты (цвет — по статусу) */
export function mapFeatures(fc: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: fc.features.map((f) => {
      const status = (f.properties?.status ?? 'new') as WorkOrderStatus;
      return { ...f, properties: { ...f.properties, color: STATUS_META[status]?.mapColor ?? '#607D8B' } };
    }),
  };
}
