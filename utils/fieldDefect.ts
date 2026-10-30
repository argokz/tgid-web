/**
 * «Дефект одной кнопкой» с обхода (components/FieldDefectDialog.vue, pages/field.vue): что заполняет бригада
 * и как это становится действием очереди. Сервер пишет дефект в журнал десктопа и заявку по нему
 * (itwin-api work_orders.report_defect).
 */
import type { LonLat } from './fieldPhoto';
import { NEW_ORDER, type FieldAction } from './fieldQueue';

export interface DefectRef {
  id: number;
  name: string;
}

/** Дефект с узла маршрута обхода: наряд на обход и узел (дефект — в контур осмотра, узел — «с дефектом») */
export interface RouteNodeRef {
  orderId: number;
  nodeId: number;
  name: string;
}

export interface FieldDefectDraft {
  pos: LonLat;
  description: string;
  sourceId: number | null;
  categoryId: number | null;
  priority: number;
  photo: Blob | null;
  caption: string;
  takenAt: string | null;
  node?: RouteNodeRef | null;
}

/** Частые находки обхода — одним нажатием в описание */
export const DEFECT_PRESETS = ['Парение', 'Течь', 'Открыт люк', 'Повреждена изоляция', 'Подтопление камеры', 'Просадка грунта'];
/** Источник по умолчанию: обход и есть осмотр */
const DEFAULT_SOURCE = 'осмотр';

export function defaultSourceId(sources: DefectRef[]): number | null {
  return sources.find((s) => s.name.trim().toLowerCase() === DEFAULT_SOURCE)?.id ?? null;
}

/** Фраза к описанию: первая — как есть, следующие — через точку с запятой */
export function appendPreset(text: string, preset: string): string {
  const current = text.trim();
  return current ? `${current}; ${preset.toLowerCase()}` : preset;
}

/** Справочники журнала дефектов (GET /api/defects/lookups) → списки для окна */
export function defectRefs(rows: unknown): DefectRef[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r): r is { id: number; name: string | null } => typeof r?.id === 'number')
    .map((r) => ({ id: r.id, name: (r.name ?? '').trim() || `№${r.id}` }));
}

/** Заполненное окно → действие очереди (место — из окна, а не новый замер GPS при постановке в очередь) */
export function defectAction(draft: FieldDefectDraft, ids: { id: string; photoId: string }, createdAt: string): FieldAction {
  return {
    id: ids.id,
    orderId: NEW_ORDER,
    orderNumber: 'Новый дефект',
    kind: 'defect',
    createdAt,
    lon: draft.pos.lon,
    lat: draft.pos.lat,
    state: 'pending',
    description: draft.description,
    sourceId: draft.sourceId,
    categoryId: draft.categoryId,
    priority: draft.priority,
    ...(draft.node ? { routeOrderId: draft.node.orderId, nodeId: draft.node.nodeId, nodeName: draft.node.name } : {}),
    ...(draft.photo ? { photo: draft.photo, photoId: ids.photoId, caption: draft.caption, takenAt: draft.takenAt ?? createdAt } : {}),
  };
}
