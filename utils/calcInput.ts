/**
 * Ввод и вывод чисел в калькуляторах (QA F31, F67).
 * v-model.number у очищенного поля даёт '' — такое значение нельзя слать в API
 * (pydantic отвечает 422 с сырым списком ошибок), поэтому обязательные поля
 * проверяются до запроса, а необязательные пустые не отправляются.
 */

export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Пустое/нечисловое → undefined (поле не уходит в запрос) */
export const optNum = (v: unknown): number | undefined => (isNum(v) ? v : undefined);

/** Подписи незаполненных обязательных полей: [[значение, подпись], …] */
export function missingFields(fields: Array<[unknown, string]>): string[] {
  return fields.filter(([v]) => !isNum(v)).map(([, label]) => label);
}

/** Текст «заполните поля» для уведомления */
export function missingFieldsText(missing: string[]): string {
  return missing.length === 1 ? `Заполните поле «${missing[0]}»` : `Заполните поля: ${missing.map((m) => `«${m}»`).join(', ')}`;
}

/** Число в ru-формате (десятичная запятая, как в полях ввода), без лишних нулей */
export function fmtNum(v: number | null | undefined, maxDigits = 2): string {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return Number(v).toLocaleString('ru-RU', { maximumFractionDigits: maxDigits, useGrouping: false });
}

/** Число с фиксированным количеством знаков в ru-формате */
export function fmtFixed(v: number | null | undefined, digits: number): string {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return Number(v).toLocaleString('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: false });
}
