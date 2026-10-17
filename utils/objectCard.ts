/**
 * Окно свойств: правка карточки объекта сети как в десктопе (itwin-api routers/card_edit.py).
 *
 * Карточка — вкладки → разделы → поля; у участка-пары П/О в поле два значения (колонки «Подача»,
 * «Обратка»): id/id2, raw[0]/raw[1]. Черновик — значения по ключу «таблица:id:поле».
 * Видимость полей — правила tab/<table>.vis десктопа (init_map_b): поля ключа скрыты, кроме полей
 * ветки текущего значения ключа (пусто → «1»).
 */

export type FieldKind = 'int' | 'float' | 'str' | 'date' | 'datetime' | 'bool'

export interface CardFieldEdit {
  kind: FieldKind | null
  max_length: number | null
  /** inline — встроенный список gid.lookup2, table — справочник gid.lookup */
  list: 'inline' | 'table' | null
  fun: string | null
  fun_name: string | null
  not_null: boolean
  readonly: boolean[]
  raw: unknown[]
}

export interface CardField {
  table: string
  field: string
  label: string
  value: unknown
  value2?: unknown
  id: number
  id2?: number
  code?: unknown
  code2?: unknown
  type: 'select' | 'text'
  hidden?: boolean
  edit?: CardFieldEdit
}

export interface CardSubsection {
  title: string
  fields: CardField[]
}

export interface CardTab {
  title: string
  subsections: CardSubsection[]
  readonly?: boolean
}

export type VisRules = Record<string, Record<string, string[]>>

export interface CardEditData {
  kind: 'line' | 'node'
  table: string
  id: number
  fileid: number | null
  tabs: CardTab[]
  columns?: string[]
  versions: Record<string, string>
  rules: Record<string, { vis: VisRules; disable: VisRules }>
  edit_tables: string[]
}

export interface CardChange {
  table: string
  id: number
  field: string
  value: unknown
}

export interface CardOption {
  value: unknown
  title: string
}

export const draftKey = (table: string, id: number, field: string): string =>
  `${String(table).toLowerCase()}:${id}:${String(field).toLowerCase()}`

/** Колонки поля: [{id, raw, readonly}] (у пары — подача и обратка) */
export function fieldColumns(f: CardField): { id: number; raw: unknown; readonly: boolean }[] {
  const ids = f.id2 !== undefined ? [f.id, f.id2] : [f.id]
  return ids.map((id, i) => ({
    id: Number(id),
    raw: f.edit?.raw?.[i] ?? null,
    readonly: !f.edit || !f.edit.kind || Boolean(f.edit.readonly?.[i] ?? true) || !(Number(id) > 0),
  }))
}

export function isFieldEditable(f: CardField): boolean {
  return fieldColumns(f).some((c) => !c.readonly)
}

/** Начальные значения всех правимых полей → черновик */
export function initialDraft(card: Pick<CardEditData, 'tabs'>): Record<string, unknown> {
  const draft: Record<string, unknown> = {}
  for (const tab of card.tabs) {
    if (tab.readonly) continue
    for (const sub of tab.subsections) {
      for (const f of sub.fields) {
        for (const c of fieldColumns(f)) {
          if (!c.readonly) draft[draftKey(f.table, c.id, f.field)] = normalizeValue(c.raw)
        }
      }
    }
  }
  return draft
}

/** null/'' — пусто; числа и строки как есть (для сравнения «изменилось ли») */
export function normalizeValue(v: unknown): unknown {
  if (v === undefined || v === '') return null
  return v
}

const same = (a: unknown, b: unknown): boolean => {
  const x = normalizeValue(a)
  const y = normalizeValue(b)
  if (x === null || y === null) return x === y
  if (typeof x === 'number' || typeof y === 'number') {
    const nx = Number(String(x).replace(',', '.'))
    const ny = Number(String(y).replace(',', '.'))
    if (Number.isFinite(nx) && Number.isFinite(ny)) return nx === ny
  }
  return String(x) === String(y)
}

/** Изменения черновика относительно исходных значений → тело PUT card-edit */
export function draftChanges(card: Pick<CardEditData, 'tabs'>, draft: Record<string, unknown>): CardChange[] {
  const out: CardChange[] = []
  const seen = new Set<string>()
  for (const tab of card.tabs) {
    if (tab.readonly) continue
    for (const sub of tab.subsections) {
      for (const f of sub.fields) {
        for (const c of fieldColumns(f)) {
          if (c.readonly) continue
          const key = draftKey(f.table, c.id, f.field)
          if (seen.has(key) || !(key in draft)) continue
          seen.add(key)
          if (!same(draft[key], c.raw)) out.push({ table: f.table, id: c.id, field: f.field, value: normalizeValue(draft[key]) })
        }
      }
    }
  }
  return out
}

/** Строковое значение для правил видимости, как QVariant::toString десктопа (1.0 → «1») */
export function visText(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number' && Number.isInteger(v)) return String(v)
  const n = Number(v)
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(n) && Number.isInteger(n)) return String(n)
  return String(v)
}

/**
 * Скрытые поля (lower) таблицы по правилам .vis и значениям ключей одной колонки.
 * values — lower-поле → значение (у списков — код).
 */
export function hiddenByVis(rules: VisRules | undefined, values: Record<string, unknown>): Set<string> {
  const shown: Record<string, boolean> = {}
  for (const [key, branches] of Object.entries(rules || {})) {
    if (!(key in values)) continue
    for (const cols of Object.values(branches)) for (const c of cols) shown[c] = false
    const val = (visText(values[key]) || '1').toLowerCase()
    for (const c of branches[val] || []) shown[c] = true
  }
  return new Set(Object.entries(shown).filter(([, on]) => !on).map(([c]) => c))
}

/** Значения ключей правил одной колонки (0 — подача/единственная, 1 — обратка) из черновика */
export function ruleValues(
  card: Pick<CardEditData, 'tabs'>, draft: Record<string, unknown>, table: string, column: number,
): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  const t = table.toLowerCase()
  for (const tab of card.tabs) {
    if (tab.readonly) continue
    for (const sub of tab.subsections) {
      for (const f of sub.fields) {
        if (f.table.toLowerCase() !== t) continue
        const c = fieldColumns(f)[column] ?? fieldColumns(f)[0]
        if (!c) continue
        const key = draftKey(f.table, c.id, f.field)
        values[f.field.toLowerCase()] = key in draft ? draft[key] : c.raw
      }
    }
  }
  return values
}

/** Ошибки черновика (ключ → текст): обязательные поля, числа, длина строки */
export function validateDraft(card: Pick<CardEditData, 'tabs'>, draft: Record<string, unknown>): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const tab of card.tabs) {
    if (tab.readonly) continue
    for (const sub of tab.subsections) {
      for (const f of sub.fields) {
        const e = f.edit
        if (!e) continue
        for (const c of fieldColumns(f)) {
          if (c.readonly) continue
          const key = draftKey(f.table, c.id, f.field)
          const v = normalizeValue(draft[key])
          if (v === null) {
            if (e.not_null) errors[key] = 'Обязательное поле'
            continue
          }
          if ((e.kind === 'int' || e.kind === 'float') && !e.list) {
            const n = Number(String(v).replace(',', '.'))
            if (!Number.isFinite(n)) errors[key] = 'Ожидается число'
            else if (e.kind === 'int' && !Number.isInteger(n)) errors[key] = 'Ожидается целое число'
          }
          if (e.kind === 'str' && e.max_length && String(v).length > e.max_length) {
            errors[key] = `Не длиннее ${e.max_length} символов`
          }
        }
      }
    }
  }
  return errors
}

/** Значение поля ввода → значение для API (числа с запятой → точка) */
export function parseInput(kind: FieldKind | null, text: unknown): unknown {
  if (text === null || text === undefined) return null
  const s = String(text).trim()
  if (s === '') return null
  if (kind === 'int' || kind === 'float') {
    const n = Number(s.replace(',', '.'))
    return Number.isFinite(n) ? n : s
  }
  return s
}
