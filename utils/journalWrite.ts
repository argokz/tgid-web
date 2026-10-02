import { formatApiError } from '~/utils/apiError';
/**
 * Чистые помощники форм журналов: какие поля отправлять, как показать ошибку сервера.
 * Сервер (routers/journals.py) отвечает 422/409 с detail-объектом:
 *   {message, field_errors?, unknown_fields?, missing_lines?, removed_lines?, reason?}
 */
import type { JournalFieldInfo, JournalSchema } from '~/services/journalWriteService';

type Values = Record<string, unknown>;

const isEmpty = (value: unknown) => value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

/** Значение поля к виду для сравнения и отправки: '' → null, дата → ГГГГ-ММ-ДД, число → number */
export function normalizeFieldValue(field: JournalFieldInfo | undefined, value: unknown): unknown {
  if (isEmpty(value)) return null;
  if (!field) return value;
  if (field.kind === 'date') {
    const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : String(value);
  }
  if (field.kind === 'timestamp') {
    const text = String(value);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : text.replace(' ', 'T').slice(0, 19);
  }
  if (field.kind === 'int' || field.kind === 'float' || field.kind === 'money') {
    const number = typeof value === 'number' ? value : Number(String(value).replace(',', '.').replace(/\s/g, ''));
    return Number.isFinite(number) ? number : value;
  }
  return typeof value === 'string' ? value : String(value);
}

/** Поля для создания: только записываемые и заполненные */
export function writableValues(schema: JournalSchema, values: Values): Values {
  const result: Values = {};
  for (const [key, value] of Object.entries(values)) {
    const field = schema.fields[key];
    if (!field || isEmpty(value)) continue;
    result[key] = normalizeFieldValue(field, value);
  }
  return result;
}

/** Изменённые записываемые поля (для PATCH); очищенное поле уходит как null */
export function writableChanges(schema: JournalSchema, original: Values | null | undefined, edited: Values): Values {
  const result: Values = {};
  for (const [key, value] of Object.entries(edited)) {
    const field = schema.fields[key];
    if (!field) continue;
    const next = normalizeFieldValue(field, value);
    const prev = normalizeFieldValue(field, original?.[key]);
    if (next !== prev) result[key] = next;
  }
  return result;
}

/** Обязательные при создании поля, которые не заполнены (подписи для сообщения) */
export function missingRequired(schema: JournalSchema, values: Values): string[] {
  return schema.required_on_create
    .filter((key) => isEmpty(values[key]))
    .map((key) => schema.fields[key]?.label || key);
}

/** «1, 2 3;4» → [1, 2, 3, 4] без повторов; мусор отбрасывается */
export function parseLineIds(text: string): number[] {
  const ids: number[] = [];
  for (const part of String(text || '').split(/[\s,;]+/)) {
    const id = Number(part);
    if (Number.isInteger(id) && id > 0 && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

const labelOf = (schema: JournalSchema | null | undefined, key: string) =>
  schema?.fields[key]?.label || schema?.approval?.signers[key]?.label || key;

/** Понятный текст ошибки записи: подписи полей вместо ключей */
export function formatJournalError(error: any, schema?: JournalSchema | null, fallback = 'Не удалось сохранить'): string {
  // ApiError.data — сам detail-объект; у «сырой» ошибки $fetch — {detail: …}
  const raw = error?.data;
  const detail = raw && typeof raw === 'object' && 'detail' in raw ? raw.detail : raw;
  if (detail && typeof detail === 'object') {
    const parts: string[] = [];
    if (detail.message) parts.push(String(detail.message));
    if (detail.field_errors && typeof detail.field_errors === 'object') {
      parts.push(
        Object.entries(detail.field_errors)
          .map(([key, text]) => `${labelOf(schema, key)}: ${text}`)
          .join('; '),
      );
    }
    if (Array.isArray(detail.unknown_fields) && detail.unknown_fields.length) {
      parts.push(`не записываются: ${detail.unknown_fields.join(', ')}`);
    }
    if (Array.isArray(detail.missing_lines) && detail.missing_lines.length) {
      parts.push(`нет в сети: ${detail.missing_lines.join(', ')}`);
    }
    if (Array.isArray(detail.removed_lines) && detail.removed_lines.length) {
      parts.push(`удалены из сети: ${detail.removed_lines.join(', ')}`);
    }
    const reason = detail.reason;
    if (typeof reason === 'string') parts.push(reason);
    else if (reason && typeof reason === 'object') {
      if (reason.message) parts.push(String(reason.message));
      if (Array.isArray(reason.labels) && reason.labels.length) parts.push(reason.labels.join(', '));
    }
    const text = parts.filter(Boolean).join(' — ');
    if (text) return text;
  }
  return formatApiError(error, fallback);
}

/** Причина отказа в пакетном утверждении → строка */
export function describeRejection(reason: unknown): string {
  if (typeof reason === 'string') return reason;
  if (reason && typeof reason === 'object') {
    const r = reason as { message?: string; labels?: string[] };
    return [r.message, r.labels?.join(', ')].filter(Boolean).join(': ');
  }
  return 'не утверждено';
}
