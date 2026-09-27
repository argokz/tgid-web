/**
 * Запись эксплуатационных журналов (этап 9): карточки, контуры, утверждение планов, документы.
 * Сервер: /api/v1/journals/{journal} (itwin-api routers/journals.py). Права — editor+ и
 * MUTATIONS_ENABLED; сервер проверяет их сам, Bearer уходит через fastApiService.request.
 */
import { fastApiService } from '~/services/fastApiService';

export type JournalKey = 'defects' | 'shurfs' | 'inspections' | 'repairs' | 'pressure-tests';

export type JournalFieldKind = 'int' | 'float' | 'str' | 'date' | 'timestamp' | 'money' | 'time';

export interface JournalFieldInfo {
  kind: JournalFieldKind;
  label: string;
  ref: string | null;
}

export interface JournalSchema {
  key: JournalKey;
  title: string;
  fields: Record<string, JournalFieldInfo>;
  required_on_create: string[];
  unique_fields: string[];
  create_modes: string[];
  has_contour: boolean;
  has_documents: boolean;
  has_point_geometry: boolean;
  approval: null | {
    signers: Record<string, JournalFieldInfo>;
    required_fields: string[];
    require_contour: boolean;
    sets_state: number | null;
  };
  document_types?: Array<{ id: number; name: string }>;
  positions?: Array<{ id: number; name: string }>;
  subdivisions?: Array<{ id: number; name: string }>;
}

export interface ContourLine {
  line_id: number;
  exists: boolean;
  removed: boolean;
  nodeid1: number | null;
  nodeid2: number | null;
  external_sign: number | null;
  start_node_name: string | null;
  end_node_name: string | null;
  diameter: number | null;
  length: number | null;
  has_heat_pipe_section: boolean;
  has_pipe_section: boolean;
}

export interface ContourResponse {
  id: number;
  total: number;
  lines: ContourLine[];
  warnings: string[];
  geojson: { type: 'FeatureCollection'; features: any[] };
  bbox: [number, number, number, number] | null;
}

export interface ContourSaveResponse {
  id: number;
  total: number;
  added: number[];
  removed: number[];
  pairs_added: number[];
  warnings: string[];
  bbox: [number, number, number, number] | null;
}

export interface ApprovalInfo {
  id: number;
  approved: boolean;
  approval_flag: number | null;
  not_applicable: boolean;
  approved_on: string | null;
  signers: Record<string, unknown>;
  last_action: { operation: string; by: string; at: string } | null;
  missing_fields: string[];
  contour_size: number | null;
}

export interface ApproveResult {
  approved: number[];
  rejected: Record<string, unknown>;
  approved_on: string;
}

export interface JournalDocument {
  id: number;
  objid: number;
  document_type_id: number | null;
  document_type_name: string | null;
  date_doc: string | null;
  path: string | null;
}

export interface RecordWriteBody {
  fields: Record<string, unknown>;
  mode?: string;
  line_ids?: number[];
  include_pairs?: boolean;
  longitude?: number;
  latitude?: number;
}

const base = (journal: JournalKey) => `api/v1/journals/${encodeURIComponent(journal)}`;
const post = <T>(path: string, body?: unknown) => fastApiService.request<T>(path, { method: 'POST', body: body ?? {} });
const patch = <T>(path: string, body: unknown) => fastApiService.request<T>(path, { method: 'PATCH', body });
const put = <T>(path: string, body: unknown) => fastApiService.request<T>(path, { method: 'PUT', body });
const del = <T>(path: string) => fastApiService.request<T>(path, { method: 'DELETE' });

const schemaCache = new Map<JournalKey, Promise<JournalSchema>>();

export const journalWriteService = {
  getSchema(journal: JournalKey, refresh = false): Promise<JournalSchema> {
    if (refresh || !schemaCache.has(journal)) {
      const pending = fastApiService.request<JournalSchema>(`${base(journal)}/schema`);
      pending.catch(() => schemaCache.delete(journal));
      schemaCache.set(journal, pending);
    }
    return schemaCache.get(journal)!;
  },

  create(journal: JournalKey, body: RecordWriteBody) {
    return post<{ id: number; warnings: string[]; record: Record<string, unknown>; has_geometry?: boolean }>(base(journal), body);
  },
  update(journal: JournalKey, id: number, body: RecordWriteBody) {
    return patch<{ id: number; changed: Record<string, unknown>; geometry_changed: boolean }>(`${base(journal)}/${id}`, body);
  },
  remove(journal: JournalKey, id: number) {
    return del<{ id: number; cascade: Record<string, number>; detached: Record<string, number> }>(`${base(journal)}/${id}`);
  },

  getContour(journal: JournalKey, id: number) {
    return fastApiService.request<ContourResponse>(`${base(journal)}/${id}/contour`);
  },
  saveContour(journal: JournalKey, id: number, lineIds: number[], includePairs = true) {
    return put<ContourSaveResponse>(`${base(journal)}/${id}/contour`, { line_ids: lineIds, include_pairs: includePairs });
  },

  getApproval(journal: JournalKey, id: number) {
    return fastApiService.request<ApprovalInfo>(`${base(journal)}/${id}/approval`);
  },
  approve(journal: JournalKey, id: number, approvedOn: string | null, signers: Record<string, unknown> = {}) {
    return post<ApproveResult>(`${base(journal)}/${id}/approve`, { approved_on: approvedOn || null, signers });
  },
  approveBatch(journal: JournalKey, ids: number[], approvedOn: string | null, signers: Record<string, unknown> = {}) {
    return post<ApproveResult>(`${base(journal)}/approve`, { ids, approved_on: approvedOn || null, signers });
  },
  unapprove(journal: JournalKey, id: number) {
    return post<{ id: number }>(`${base(journal)}/${id}/unapprove`);
  },
  approvalCandidates(journal: JournalKey, dateFrom?: string, dateTo?: string) {
    return fastApiService.request<{ items: Array<{ id: number; name: string | null; planned_start: string | null }> }>(
      `${base(journal)}/approval/candidates`,
      { query: { date_from: dateFrom || undefined, date_to: dateTo || undefined } },
    );
  },

  listDocuments(journal: JournalKey, id: number) {
    return fastApiService.request<{ items: JournalDocument[] }>(`${base(journal)}/${id}/documents`);
  },
  addDocument(journal: JournalKey, id: number, fields: Record<string, unknown>) {
    return post<JournalDocument>(`${base(journal)}/${id}/documents`, { fields });
  },
  updateDocument(journal: JournalKey, id: number, docId: number, fields: Record<string, unknown>) {
    return patch<{ id: number }>(`${base(journal)}/${id}/documents/${docId}`, { fields });
  },
  deleteDocument(journal: JournalKey, id: number, docId: number) {
    return del<{ id: number }>(`${base(journal)}/${id}/documents/${docId}`);
  },
};
