/**
 * Чистые помощники инструмента «Участки ПТС» (components/PtsSitesDialog.vue).
 */
import type { CardField, PtsSiteItem } from '~/services/ptsService';

export interface SiteGroup {
  key: string;
  title: string;
  items: PtsSiteItem[];
  pipes: number;
}

/** Дерево дока ПТС десктопа: начальник участка → участки (порядок сервера сохраняется) */
export function groupSitesByChief(items: PtsSiteItem[], query = ''): SiteGroup[] {
  const q = query.trim().toLowerCase();
  const groups = new Map<string, SiteGroup>();
  for (const item of items) {
    if (q) {
      const hay = `${item.id} ${item.name || ''} ${item.magistral_name || ''} ${item.nach_name || ''}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }
    const key = item.nach_id ? `n${item.nach_id}` : 'none';
    let group = groups.get(key);
    if (!group) {
      group = { key, title: item.nach_name || 'Без начальника участка', items: [], pipes: 0 };
      groups.set(key, group);
    }
    group.items.push(item);
    group.pipes += item.pipes || 0;
  }
  return [...groups.values()];
}

export function siteTitle(item: Pick<PtsSiteItem, 'id' | 'name'>, kind: 'ms' | 'rs'): string {
  return `${kind === 'ms' ? 'МС' : 'РС'} ${item.id}${item.name ? ` — ${item.name}` : ''}`;
}

/** Тип поля ввода карточки */
export function inputType(field: CardField): 'number' | 'date' | 'datetime-local' | 'text' {
  if (field.ref) return 'text';
  if (field.kind === 'int' || field.kind === 'float') return 'number';
  if (field.kind === 'date') return 'date';
  if (field.kind === 'datetime') return 'datetime-local';
  return 'text';
}

/** Значение из БД → значение формы (даты — в формат input) */
export function toFormValue(field: CardField, value: unknown): unknown {
  if (value === null || value === undefined) return field.kind === 'bool' ? false : null;
  if (field.kind === 'date') return String(value).slice(0, 10);
  if (field.kind === 'datetime') return String(value).slice(0, 16);
  return value;
}

function normalized(field: CardField, value: unknown): unknown {
  if (value === '' || value === undefined) return null;
  if ((field.kind === 'int' || field.kind === 'float' || field.ref) && typeof value === 'string') {
    const n = Number(value.replace(',', '.'));
    return Number.isFinite(n) ? n : value;
  }
  return value;
}

/**
 * Тело fields для PUT/POST: только изменённые поля (при создании — только заполненные).
 * Пустые строки → null; числа из строк приводятся (сервер всё равно проверит тип).
 */
export function cardPayload(
  fields: CardField[],
  form: Record<string, unknown>,
  original: Record<string, unknown> | null,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    const value = normalized(field, form[field.name]);
    if (original) {
      const before = normalized(field, toFormValue(field, original[field.name]));
      if (value === before || (value === null && (before === null || before === false))) continue;
    } else if (value === null) {
      continue;
    }
    out[field.name] = value;
  }
  return out;
}

/** Текст подтверждения привязки */
export function describePipesChange(action: 'assign' | 'unassign', changes: number, objects: number, site: string): string {
  if (action === 'assign') return `Привязать к участку ${site}: труб ${objects}, изменится строк ${changes}.`;
  return `Снять привязку к участку ${site}: труб ${objects}, изменится строк ${changes}.`;
}
