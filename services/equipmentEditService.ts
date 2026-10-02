/**
 * Правка оборудования сети (этап 9): itwin-api routers/equipment_edit.py — /api/v1/equipment-edit/*.
 * Типизированный allow-list полей (карточки tab/*.txt), версия строки → 409, audit_log.
 *
 * Реестры вызывают beginEquipmentEdit() при входе в правку (запоминается версия и значения)
 * и saveEquipmentEdit() при сохранении: уходят только изменённые поля с версией.
 */
import { fastApiService } from '~/services/fastApiService';
import { formatApiError } from '~/utils/apiError';

export interface EquipmentField {
  name: string;
  label: string;
  kind: 'int' | 'float' | 'str' | 'date' | 'datetime' | 'bool';
  max_length: number | null;
  group: string | null;
  ref: { table: string; id: string; label: string } | null;
}

export interface EquipmentRecord {
  table: string;
  label: string;
  id: number;
  fields: EquipmentField[];
  version: string;
  values: Record<string, unknown>;
}

export interface EquipmentUpdateResult {
  table: string;
  key: number;
  changed: Record<string, { old: unknown; new: unknown }>;
  version: string;
  dry_run: boolean;
}

const req = fastApiService.request;
const enc = (v: string | number) => encodeURIComponent(String(v));

export const equipmentEditService = {
  get(table: string, id: number | string): Promise<EquipmentRecord> {
    return req(`api/v1/equipment-edit/${enc(table)}/${enc(id)}`);
  },

  update(table: string, id: number | string, fields: Record<string, unknown>, version: string | null): Promise<EquipmentUpdateResult> {
    return req(`api/v1/equipment-edit/${enc(table)}/${enc(id)}`, { method: 'PUT', body: { fields, version } });
  },
};

/** Значения равны с точностью до представления формы (строка «5» и число 5, '' и null) */
export function sameValue(a: unknown, b: unknown): boolean {
  const norm = (v: unknown) => (v === '' || v === undefined ? null : v);
  const x = norm(a);
  const y = norm(b);
  if (x === null || y === null) return x === y;
  if (typeof x === 'number' || typeof y === 'number') {
    const nx = Number(String(x).replace(',', '.'));
    const ny = Number(String(y).replace(',', '.'));
    if (Number.isFinite(nx) && Number.isFinite(ny)) return nx === ny;
  }
  return String(x) === String(y);
}

/** Поля формы, отличающиеся от значений строки на момент входа в правку */
export function changedEquipmentFields(
  original: Record<string, unknown>,
  form: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(form)) {
    if (!(key in original) || !sameValue(original[key], value)) out[key] = value === '' ? null : value;
  }
  return out;
}

export const EQUIPMENT_CONFLICT_TEXT =
  'Объект изменён другим пользователем — перезагрузите карточку и повторите правку.';

/** 409: строку изменили после входа в правку (версия xmin не совпала) */
export class EquipmentConflictError extends Error {
  readonly conflict = true;
  constructor(message = EQUIPMENT_CONFLICT_TEXT) {
    super(message);
    this.name = 'EquipmentConflictError';
  }
}

export const isEquipmentConflict = (e: unknown): boolean =>
  e instanceof EquipmentConflictError || (e as { conflict?: unknown } | null)?.conflict === true;

const snapshots = new Map<string, Promise<EquipmentRecord>>();
const snapKey = (table: string, id: number | string) => `${table}:${id}`;

/** Вход в правку: запомнить версию и значения строки (для 409 и отправки только изменений) */
export function beginEquipmentEdit(table: string, id: number | string | undefined | null): void {
  if (id === undefined || id === null) return;
  const promise = equipmentEditService.get(table, id);
  promise.catch(() => undefined);
  snapshots.set(snapKey(table, id), promise);
}

/** Сохранение правки: только изменённые поля, с версией; ошибки — Error с понятным текстом */
export async function saveEquipmentEdit(
  table: string,
  id: number | string,
  form: Record<string, unknown>,
): Promise<EquipmentUpdateResult | null> {
  const key = snapKey(table, id);
  try {
    const snapshot = await (snapshots.get(key) ?? equipmentEditService.get(table, id));
    const fields = changedEquipmentFields(snapshot.values, form);
    if (!Object.keys(fields).length) {
      snapshots.delete(key);
      return null;
    }
    const result = await equipmentEditService.update(table, id, fields, snapshot.version);
    snapshots.delete(key);
    return result;
  } catch (e: any) {
    if (e?.status === 409 || e?.statusCode === 409) {
      snapshots.delete(key);
      throw new EquipmentConflictError();
    }
    throw new Error(formatApiError(e, 'Ошибка при сохранении'));
  }
}
