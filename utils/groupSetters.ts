/**
 * Чистые помощники диалогов «Групповые установщики» и «Справочники» (тестируются без UI).
 */
import type { FilterOp, GroupSelection, GroupSetterInfo, SetterTarget } from '~/services/groupSettersService';

export type SelectionMode = 'fragment' | 'map' | 'filter';

export interface FilterCondition {
  field: string;
  op: FilterOp;
  value: unknown;
}

export interface SelectionDraft {
  mode: SelectionMode;
  fragmentIds: number[];
  pickedIds: number[];
  useBbox: boolean;
  bbox: [number, number, number, number] | null;
  conditions: FilterCondition[];
}

/** Что кликать на карте для цели установщика */
export function pickKindForTarget(target: SetterTarget): 'line' | 'node' {
  return target === 'consumers' || target === 'nodes' ? 'node' : 'line';
}

/** Черновик выбора → тело selection для API; строка — ошибка для пользователя */
export function buildSelection(draft: SelectionDraft): GroupSelection | string {
  if (draft.mode === 'map') {
    if (!draft.pickedIds.length) return 'Выберите объекты на карте';
    return { mode: 'ids', ids: [...draft.pickedIds] };
  }
  if (draft.mode === 'fragment') {
    if (!draft.fragmentIds.length) return 'Выберите фрагмент';
    return { mode: 'fragment', fragment_ids: [...draft.fragmentIds] };
  }
  const where: NonNullable<GroupSelection['where']> = [];
  for (const c of draft.conditions) {
    if (!c.field) continue;
    if (c.op === 'eq') {
      if (c.value === null || c.value === undefined || c.value === '') return 'Укажите значение в условии фильтра';
      where.push({ field: c.field, op: 'eq', value: c.value });
    } else {
      where.push({ field: c.field, op: c.op });
    }
  }
  const selection: GroupSelection = { mode: 'filter' };
  if (draft.fragmentIds.length) selection.fragment_ids = [...draft.fragmentIds];
  if (draft.useBbox) {
    if (!draft.bbox) return 'Не удалось определить видимую область карты';
    selection.bbox = draft.bbox;
  }
  if (where.length) selection.where = where;
  if (!selection.fragment_ids && !selection.bbox && !selection.where) {
    return 'Фильтр должен содержать фрагмент, видимую область или условие';
  }
  return selection;
}

/** Значение из поля ввода → тело value для API (null — ошибка) */
export function parseSetterValue(setter: GroupSetterInfo, raw: unknown): { value: unknown } | { error: string } {
  if (setter.kind === 'computed') return { value: null };
  if (raw === null || raw === undefined || raw === '') return { error: 'Укажите значение' };
  if (setter.kind === 'float') {
    const n = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.').trim());
    if (!Number.isFinite(n)) return { error: 'Ожидается число' };
    if (setter.min !== null && n < setter.min) return { error: `Не меньше ${setter.min}` };
    if (setter.max !== null && n > setter.max) return { error: `Не больше ${setter.max}` };
    return { value: n };
  }
  if (setter.kind === 'date') return { value: String(raw) };
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isInteger(n)) return { error: 'Ожидается целое число' };
  return { value: n };
}

export function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(Math.round(value * 1e6) / 1e6);
  return String(value);
}

/** «a: 2 → 0.5; b: …» для строки образца */
export function describeChange(oldValues: Record<string, unknown>, newValues: Record<string, unknown>): string {
  return Object.keys(newValues)
    .map((k) => `${k}: ${formatCell(oldValues[k])} → ${formatCell(newValues[k])}`)
    .join('; ');
}

/** Группы установщиков в порядке десктопного меню */
export function groupSetters(setters: GroupSetterInfo[]): Array<{ group: string; items: GroupSetterInfo[] }> {
  const out: Array<{ group: string; items: GroupSetterInfo[] }> = [];
  for (const s of setters) {
    let g = out.find((x) => x.group === s.group);
    if (!g) {
      g = { group: s.group, items: [] };
      out.push(g);
    }
    g.items.push(s);
  }
  return out;
}

/** Текст ошибки API: detail.message сервера, ошибки полей, иначе userMessage */
export function apiErrorText(e: any, fallback = 'Ошибка запроса'): string {
  const data = e?.data;
  if (data && typeof data === 'object') {
    const parts: string[] = [];
    if (data.message) parts.push(String(data.message));
    if (data.field_errors) {
      parts.push(Object.entries(data.field_errors).map(([k, v]) => `${k}: ${v}`).join('; '));
    }
    if (data.unknown_fields) parts.push(`неизвестные поля: ${data.unknown_fields.join(', ')}`);
    if (parts.length) return parts.join(' — ');
  }
  return e?.userMessage || e?.message || fallback;
}

/** Поля формы справочника → тело fields (пустые строки → null, только изменённые при правке) */
export function dictionaryPayload(
  form: Record<string, unknown>,
  original: Record<string, unknown> | null,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(form)) {
    const value = v === '' || v === undefined ? null : v;
    if (original && (original[k] ?? null) === value) continue;
    if (!original && value === null) continue;
    out[k] = value;
  }
  return out;
}
