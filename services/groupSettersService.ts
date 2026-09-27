/**
 * Групповые установщики свойств (десктоп aSet*) и редактируемые справочники (этап 9).
 * Сервер: itwin-api routers/group_setters.py — /api/v1/group-setters/*, /api/v1/dictionaries/*.
 * Запись — editor+ и MUTATIONS_ENABLED (сервер проверяет сам); Bearer уходит через request.
 */
import { fastApiService } from '~/services/fastApiService';

export type SetterTarget = 'consumers' | 'pipes' | 'lines' | 'nodes';
export type SetterKind = 'ref' | 'float' | 'int' | 'date' | 'choice' | 'computed';

export interface GroupSetterInfo {
  key: string;
  label: string;
  group: string;
  target: SetterTarget;
  target_label: string;
  kind: SetterKind;
  field_label: string;
  default: number | string | null;
  min: number | null;
  max: number | null;
  choices: Array<{ value: number; label: string }>;
  ref: { table: string; fragment_scoped: boolean } | null;
  writes: string[];
  desktop: string;
  affects_calc: boolean;
  note: string;
}

export interface GroupSettersResponse {
  setters: GroupSetterInfo[];
  targets: Record<SetterTarget, { label: string; filter_fields: string[] }>;
  max_objects: number;
}

export interface SetterOption {
  id: number;
  label: string;
  fileid?: number | null;
}

export type FilterOp = 'eq' | 'null' | 'not_null';

export interface GroupSelection {
  mode: 'ids' | 'fragment' | 'filter';
  ids?: number[];
  fragment_ids?: number[];
  bbox?: [number, number, number, number];
  where?: Array<{ field: string; op: FilterOp; value?: unknown }>;
}

export interface GroupSetterSampleRow {
  table: string;
  row_id: number;
  object_id: number;
  name: string | null;
  old: Record<string, unknown>;
  new: Record<string, unknown>;
}

export interface GroupSetterPreview {
  setter: string;
  label: string;
  value: unknown;
  value_label: string | null;
  selection: Record<string, unknown>;
  objects: number;
  missing_ids: number[];
  changes: number;
  by_table: Record<string, { rows: number; changes: number }>;
  sample?: GroupSetterSampleRow[];
  sample_truncated?: boolean;
  warnings: string[];
}

export interface GroupSetterApplyResult extends GroupSetterPreview {
  applied: Record<string, number>;
  changed: number;
  change_group_id: string;
}

export interface GroupSetterUndoResult {
  setter: string;
  label: string;
  change_group_id: string;
  by_table: Record<string, { rows: number; restorable: number; conflicts: number }>;
  conflicts: Array<{ table: string; row_id: number }>;
  restorable: number;
  already_undone: boolean;
  dry_run: boolean;
  undo_group_id?: string;
}

export type DictFieldKind = 'int' | 'float' | 'str' | 'date' | 'timestamp' | 'bool';

export interface DictFieldInfo {
  column: string;
  kind: DictFieldKind;
  label: string;
  max_length: number | null;
  required: boolean;
  lookup?: string;
}

export interface DictionaryInfo {
  key: string;
  label: string;
  table: string;
  label_column: string;
  fragment_scoped: boolean;
  affects_calc: boolean;
  note: string;
  desktop: string;
  usages: string[];
  fields: DictFieldInfo[];
  lookups: Record<string, Array<{ id: number; name: string }>>;
}

export type DictRow = Record<string, any> & { id: number };

export interface DictUsage {
  total: number;
  by: Array<{ table: string; column: string; label: string; count: number }>;
}

const req = fastApiService.request;
const enc = (v: string | number) => encodeURIComponent(String(v));
const post = (body: unknown) => ({ method: 'POST', body });

export const groupSettersService = {
  list(): Promise<GroupSettersResponse> {
    return req('api/v1/group-setters');
  },

  options(key: string, params: { q?: string; fragmentIds?: number[]; limit?: number } = {}): Promise<{ items: SetterOption[]; total: number }> {
    const query: Record<string, string | number> = {};
    if (params.q) query.q = params.q;
    if (params.fragmentIds?.length) query.fragment_ids = params.fragmentIds.join(',');
    if (params.limit) query.limit = params.limit;
    return req(`api/v1/group-setters/${enc(key)}/options`, { query });
  },

  preview(key: string, selection: GroupSelection, value: unknown): Promise<GroupSetterPreview> {
    return req(`api/v1/group-setters/${enc(key)}/preview`, post({ selection, value }));
  },

  apply(key: string, selection: GroupSelection, value: unknown, expectedChanges: number): Promise<GroupSetterApplyResult> {
    return req(`api/v1/group-setters/${enc(key)}/apply`, post({ selection, value, expected_changes: expectedChanges }));
  },

  undo(changeGroupId: string, dryRun: boolean): Promise<GroupSetterUndoResult> {
    return req('api/v1/group-setters/undo', post({ change_group_id: changeGroupId, dry_run: dryRun }));
  },

  dictionaries(): Promise<{ dictionaries: DictionaryInfo[] }> {
    return req('api/v1/dictionaries');
  },

  dictionaryRows(key: string, params: { q?: string; fragmentId?: number | null; limit?: number; offset?: number } = {}): Promise<{ items: DictRow[]; total: number }> {
    const query: Record<string, string | number> = {};
    if (params.q) query.q = params.q;
    if (params.fragmentId) query.fragment_id = params.fragmentId;
    if (params.limit) query.limit = params.limit;
    if (params.offset) query.offset = params.offset;
    return req(`api/v1/dictionaries/${enc(key)}`, { query });
  },

  dictionaryRow(key: string, id: number): Promise<{ row: DictRow; usage: DictUsage }> {
    return req(`api/v1/dictionaries/${enc(key)}/${enc(id)}`);
  },

  createDictionaryRow(key: string, fields: Record<string, unknown>): Promise<DictRow> {
    return req(`api/v1/dictionaries/${enc(key)}`, post({ fields }));
  },

  updateDictionaryRow(key: string, id: number, fields: Record<string, unknown>): Promise<DictRow> {
    return req(`api/v1/dictionaries/${enc(key)}/${enc(id)}`, { method: 'PUT', body: { fields } });
  },

  deleteDictionaryRow(key: string, id: number): Promise<{ deleted: number }> {
    return req(`api/v1/dictionaries/${enc(key)}/${enc(id)}`, { method: 'DELETE' });
  },
};
