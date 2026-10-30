/**
 * Формы обходов (itwin-api database/forms.py): типы, условия показа и проверка ответов — те же правила, что на
 * сервере (сервер проверяет ещё раз при отправке). Конструктор — components/FormsDialog.vue, заполнение —
 * components/forms/FormRenderer.vue (полевое приложение, карточка наряда, предпросмотр).
 */

export type FormFieldType = 'text' | 'integer' | 'decimal' | 'select_one' | 'select_multiple' | 'date'
  | 'acknowledge' | 'note' | 'image';
export type FormScope = 'order' | 'point';

export interface FormChoice {
  value: string;
  label: string;
}

export interface FormRelevant {
  field: string;
  op: '=' | '!=' | 'selected';
  value: string;
}

export interface FormField {
  name: string;
  type: FormFieldType;
  label: string;
  hint?: string;
  required?: boolean;
  choices?: FormChoice[] | null;
  min?: number | null;
  max?: number | null;
  relevant?: FormRelevant | null;
}

export interface FormSchema {
  fields: FormField[];
}

export interface FormRow {
  id: number;
  name: string;
  description: string;
  scope: FormScope;
  current_version: number;
  version?: number;
  active: boolean;
  schema: FormSchema;
  submissions?: number;
  updated_at?: string;
  updated_by?: string | null;
}

export interface FormInput {
  name: string;
  description: string;
  scope: FormScope;
  schema: FormSchema;
}

export interface FormSubmission {
  id: number;
  form_id: number;
  version: number;
  work_order_id: number;
  node_id: number | null;
  node_name?: string | null;
  form_name?: string;
  answers: FormAnswers;
  schema: FormSchema;
  /** client_id фото поля → id фото наряда (null — ещё не дошло с телефона) */
  photos?: Record<string, number | null>;
  submitted_by: string;
  filled_at: string | null;
  created_at: string;
}

export type FormAnswer = string | number | boolean | string[] | null | undefined;
export type FormAnswers = Record<string, FormAnswer>;

export const FIELD_TYPES: { value: FormFieldType; title: string }[] = [
  { value: 'text', title: 'Текст' },
  { value: 'integer', title: 'Целое число' },
  { value: 'decimal', title: 'Число' },
  { value: 'select_one', title: 'Выбор одного' },
  { value: 'select_multiple', title: 'Выбор нескольких' },
  { value: 'date', title: 'Дата' },
  { value: 'acknowledge', title: 'Да / отметка' },
  { value: 'note', title: 'Пояснение' },
  { value: 'image', title: 'Фото' },
];
export const SCOPES: { value: FormScope; title: string }[] = [
  { value: 'order', title: 'Раз на наряд' },
  { value: 'point', title: 'На каждом узле обхода' },
];
export const MAX_PHOTOS = 5;
const NAME_RE = /^[a-z][a-z0-9_]{0,39}$/;

const empty = (v: FormAnswer): boolean => v === undefined || v === null || v === '' || v === false
  || (Array.isArray(v) && v.length === 0);

/** Показывать ли поле: условие по ответу поля выше; пока на него не ответили — скрыто */
export function isRelevant(field: FormField, answers: FormAnswers): boolean {
  const r = field.relevant;
  if (!r) return true;
  const got = answers[r.field];
  if (empty(got)) return false;
  if (r.op === 'selected') return Array.isArray(got) && got.includes(r.value);
  const text = got === true ? '1' : String(got);
  return r.op === '=' ? text === r.value : text !== r.value;
}

const toNumber = (v: FormAnswer): number | null => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/** Проверка ответов: ошибки по именам полей (пусто — можно отправлять) и ответы без скрытых полей */
export function validateAnswers(schema: FormSchema, answers: FormAnswers): { clean: FormAnswers; errors: Record<string, string> } {
  const clean: FormAnswers = {};
  const errors: Record<string, string> = {};
  for (const f of schema.fields) {
    if (f.type === 'note' || !isRelevant(f, clean)) continue;
    const v = answers[f.name];
    if (empty(v)) {
      if (f.required) errors[f.name] = f.type === 'acknowledge' ? 'отметьте' : 'обязательное поле';
      continue;
    }
    if (f.type === 'integer' || f.type === 'decimal') {
      const n = toNumber(v);
      if (n === null) errors[f.name] = 'нужно число';
      else if (f.type === 'integer' && !Number.isInteger(n)) errors[f.name] = 'нужно целое число';
      else if (f.min != null && n < f.min) errors[f.name] = `не меньше ${f.min}`;
      else if (f.max != null && n > f.max) errors[f.name] = `не больше ${f.max}`;
      else clean[f.name] = n;
    } else if (f.type === 'select_one') {
      if (!f.choices?.some((c) => c.value === v)) errors[f.name] = 'нет такого варианта';
      else clean[f.name] = v;
    } else if (f.type === 'select_multiple') {
      const picked = Array.isArray(v) ? v : [];
      const values = (f.choices ?? []).map((c) => c.value);
      if (picked.some((x) => !values.includes(x))) errors[f.name] = 'нет такого варианта';
      else clean[f.name] = values.filter((x) => picked.includes(x));
    } else if (f.type === 'image') {
      const ids = Array.isArray(v) ? v : [];
      if (ids.length > MAX_PHOTOS) errors[f.name] = `фото — до ${MAX_PHOTOS}`;
      else clean[f.name] = ids;
    } else if (f.type === 'acknowledge') {
      clean[f.name] = true;
    } else {
      clean[f.name] = typeof v === 'string' ? v.trim() : v;
    }
  }
  return { clean, errors };
}

/** Ответ для показа: подписи вариантов, «да», числа как есть */
export function displayAnswer(field: FormField, value: FormAnswer): string {
  if (empty(value)) return '—';
  const label = (v: string) => field.choices?.find((c) => c.value === v)?.label ?? v;
  if (field.type === 'select_one') return label(String(value));
  if (field.type === 'select_multiple' && Array.isArray(value)) return value.map(label).join(', ');
  if (field.type === 'acknowledge') return 'да';
  if (field.type === 'image' && Array.isArray(value)) return `фото: ${value.length}`;
  if (field.type === 'date') return new Date(`${String(value)}T00:00:00`).toLocaleDateString('ru-RU');
  return String(value);
}

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', ә: 'a', ғ: 'g', қ: 'k', ң: 'n', ө: 'o', ұ: 'u', ү: 'u', һ: 'h',
  і: 'i',
};

/** Имя поля из подписи: «Уровень воды» → uroven_vody; занятые имена — с номером */
export function fieldName(label: string, used: Iterable<string>): string {
  const taken = new Set(used);
  const base0 = [...label.toLowerCase()].map((ch) => TRANSLIT[ch] ?? ch).join('')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 36) || 'pole';
  const base = /^[a-z]/.test(base0) ? base0 : `f_${base0}`.slice(0, 36);
  let name = base;
  for (let n = 2; taken.has(name); n += 1) name = `${base}_${n}`;
  return name;
}

/** Варианты из текста конструктора: строка — вариант, «значение = подпись» или просто подпись */
export function parseChoices(text: string): FormChoice[] {
  const used: string[] = [];
  return text.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const eq = line.indexOf('=');
    const label = (eq > 0 ? line.slice(eq + 1) : line).trim();
    const raw = eq > 0 ? line.slice(0, eq).trim() : '';
    const value = NAME_RE.test(raw) && !used.includes(raw) ? raw : fieldName(label, used);
    used.push(value);
    return { value, label: label || value };
  });
}

export function choicesText(choices: FormChoice[] | null | undefined): string {
  return (choices ?? []).map((c) => `${c.value} = ${c.label}`).join('\n');
}

/** Ошибки описания формы до сохранения (сервер проверяет то же) */
export function schemaProblems(schema: FormSchema): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  if (!schema.fields.length) out.push('Добавьте хотя бы одно поле');
  for (const f of schema.fields) {
    const name = f.label || f.name;
    if (!NAME_RE.test(f.name)) out.push(`«${name}»: имя поля — латиница, цифры и _, с буквы`);
    if (seen.has(f.name)) out.push(`«${name}»: имя «${f.name}» уже есть`);
    if (!f.label.trim()) out.push(`Поле «${f.name}»: нет подписи`);
    if ((f.type === 'select_one' || f.type === 'select_multiple') && !f.choices?.length) out.push(`«${name}»: нет вариантов`);
    if (f.relevant && !seen.has(f.relevant.field)) out.push(`«${name}»: условие — по полю выше`);
    if (f.min != null && f.max != null && f.min > f.max) out.push(`«${name}»: минимум больше максимума`);
    seen.add(f.name);
  }
  if (schema.fields.length && schema.fields.every((f) => f.type === 'note')) out.push('Нет ни одного поля для ответа');
  return out;
}
