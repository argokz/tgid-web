/**
 * Общие мелочи журналов: даты для <input type="date"> и проверка координат (QA F80, F81, F82).
 */

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Сегодня в локальной зоне, YYYY-MM-DD. toISOString() даёт дату по UTC: до 05:00 в Алматы — вчера */
export function localToday(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/**
 * Значение даты/timestamp из API → YYYY-MM-DD для <input type="date">.
 * Поле type="date" не показывает '2024-05-01T00:00:00' или '2024-05-01 00:00:00' — остаётся пустым.
 */
export function toDateInput(v: unknown): string | null {
  if (v == null || v === '') return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v));
  return m ? m[1] : null;
}

/** Даты записи (ключи type 'date') → формат поля ввода; прочие поля без изменений */
export function withDateInputs<T extends Record<string, any>>(record: T, dateKeys: string[]): T {
  const out: Record<string, any> = { ...record };
  for (const k of dateKeys) if (k in out) out[k] = toDateInput(out[k]);
  return out as T;
}

const finiteCoord = (v: unknown): boolean =>
  v != null && v !== '' && typeof v !== 'boolean' && Number.isFinite(Number(v));

/** Есть ли у записи координаты. Number(null) === 0 и Number('') === 0 — конечные, их отсекаем явно */
export function hasLonLat(item: { longitude?: unknown; latitude?: unknown } | null | undefined): boolean {
  return !!item && finiteCoord(item.longitude) && finiteCoord(item.latitude);
}
