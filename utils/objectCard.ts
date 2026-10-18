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
  /** у поля окно-помощник десктопа (сортамент, справочная таблица, местные сопротивления) */
  helper?: boolean
  /** после выбора значения меняются зависимые поля (ms_rs: магистраль / участок МС / участок РС) */
  after?: boolean
  not_null: boolean
  readonly: boolean[]
  raw: unknown[]
  /** карточка нескольких объектов: в колонке значения различаются («разные») */
  mixed?: boolean[]
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
  /** карточка нескольких участков (id полей — колонка: 1 подача/одиночные, 2 обратка) */
  batch?: boolean
  selection?: {
    columns: { title: string; line_ids: number[] }[]
    lines: number
    rows: Record<string, number[]>
  }
}

/** Предпросмотр правки нескольких объектов */
export interface CardBatchPreview {
  lines: number
  changes: number
  cells: number
  fields: {
    table: string
    field: string
    label: string
    column: number
    column_title: string
    new: unknown
    new_title: unknown
    rows: number
    changes: number
    was: { value: unknown; title: unknown; count: number }[]
  }[]
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
        fieldColumns(f).forEach((c, ci) => {
          if (c.readonly) return
          const key = draftKey(f.table, c.id, f.field)
          const v = normalizeValue(draft[key])
          if (v === null) {
            // несколько объектов: «разные» без значения — поле не меняется, обязательность не нарушена
            if (e.not_null && !e.mixed?.[ci]) errors[key] = 'Обязательное поле'
            return
          }
          if ((e.kind === 'int' || e.kind === 'float') && !e.list) {
            const n = Number(String(v).replace(',', '.'))
            if (!Number.isFinite(n)) errors[key] = 'Ожидается число'
            else if (e.kind === 'int' && !Number.isInteger(n)) errors[key] = 'Ожидается целое число'
          }
          if (e.kind === 'str' && e.max_length && String(v).length > e.max_length) {
            errors[key] = `Не длиннее ${e.max_length} символов`
          }
        })
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

/** Окно-помощник поля (GET card-edit/helper) */
export interface CardHelperPick {
  type: 'pick'
  title: string
  subtitle?: string
  columns: { key: string; title: string }[]
  rows: Record<string, unknown>[]
  /** поле карточки → колонка выбранной строки */
  set: Record<string, string>
  /** можно взять значение любой числовой ячейки строки (min/max диапазона) */
  cell_pick?: boolean
}

export interface CardHelperMestn {
  type: 'mestn'
  title: string
  items: { id: number; name: string; min: number; max: number }[]
  /** sum — поле суммы коэффициентов, list — поле списка «id|k|v …» */
  set: { sum: string; list: string }
}

export type CardHelper = CardHelperPick | CardHelperMestn

/**
 * Значения полей одной колонки (0 — подача/единственная, 1 — обратка) из помощника → новый черновик.
 * Поля ищутся по имени без учёта регистра; только правимые в этой колонке. → {draft, applied: ключи}
 */
export function applyFieldValues(
  card: Pick<CardEditData, 'tabs'>, draft: Record<string, unknown>, table: string, column: number,
  values: Record<string, unknown>,
): { draft: Record<string, unknown>; applied: string[] } {
  const want = new Map(Object.entries(values).map(([k, v]) => [k.toLowerCase(), v]))
  const next = { ...draft }
  const applied: string[] = []
  const t = table.toLowerCase()
  for (const tab of card.tabs) {
    if (tab.readonly) continue
    for (const sub of tab.subsections) {
      for (const f of sub.fields) {
        const name = f.field.toLowerCase()
        if (f.table.toLowerCase() !== t || !want.has(name)) continue
        const c = fieldColumns(f)[column]
        if (!c || c.readonly) continue
        const key = draftKey(f.table, c.id, f.field)
        if (applied.includes(key)) continue
        next[key] = normalizeValue(want.get(name))
        applied.push(key)
      }
    }
  }
  return { draft: next, applied }
}

/** Местные сопротивления участка «id|k|v id|k|v» (поле mestn, MestSopr3::parse) → id → {k, v} */
export function parseMestn(text: unknown): Map<number, { k: number; v: number }> {
  const out = new Map<number, { k: number; v: number }>()
  for (const part of String(text ?? '').split(' ')) {
    const kv = part.split('|')
    if (kv.length !== 3) continue
    const id = Number(kv[0])
    const k = Number(kv[1])
    const v = Number(kv[2])
    if (Number.isFinite(id) && Number.isFinite(k) && Number.isFinite(v)) out.set(id, { k, v })
  }
  return out
}

/** Сумма коэффициентов и строка списка (MestSopr3::calcSum): только виды с количеством > 0 */
export function mestnResult(rows: { id: number; k: number; v: number }[]): { sum: number; list: string } {
  let sum = 0
  const parts: string[] = []
  for (const r of rows) {
    if (!(r.k > 0)) continue
    sum += r.v * r.k
    parts.push(`${r.id}|${r.k}|${r.v}`)
  }
  return { sum: Math.round(sum * 1e6) / 1e6, list: parts.join(' ') }
}

/** Вид карточки: участок или узел */
export type CardKind = 'line' | 'node'

/** Значения полей по таблицам: {таблица: {поле: значение}} */
export type CardValues = Record<string, Record<string, unknown>>

/** Шаблон свойств (GET /api/v1/card-templates) */
export interface CardTemplate {
  id: number
  kind: CardKind
  name: string
  values: CardValues
  /** подписи значений списков */
  titles?: CardValues
  author: string | null
  shared: boolean
}

/** «Как у соседнего»: по колонке карточки — участок-сосед и его значения */
export interface CardNeighbor {
  columns: {
    line_id?: number; node_id?: number
    /** участок/узел-сосед; null — не найден */
    neighbor_id: number | null
    values: CardValues; titles: CardValues
  }[]
}

/** Поля, которые не переносятся в шаблон по умолчанию: свои у каждого участка */
export const TEMPLATE_SKIP_FIELDS: ReadonlySet<string> = new Set([
  'pipesectlength', 'inventnumber', 'mestn', 'localressum', 'externalsignlineid',
  // узел: имя, номера, признак П/О и отметки — свои у каждого узла
  'externalnodename', 'nodename', 'registnumber', 'externalsignid', 'geomarktoptube', 'geomarknodearea',
])

/**
 * Значения одной колонки черновика для шаблона: правимые поля с значением → {таблица: {поле: значение}}.
 * skip — поля (lower), которые не берутся (длина, инвентарный номер и т.п.).
 */
export function columnValues(
  card: Pick<CardEditData, 'tabs'>, draft: Record<string, unknown>, column: number,
  skip: ReadonlySet<string> = TEMPLATE_SKIP_FIELDS,
): { table: string; field: string; label: string; value: unknown; text: unknown }[] {
  const out: { table: string; field: string; label: string; value: unknown; text: unknown }[] = []
  const seen = new Set<string>()
  for (const tab of card.tabs) {
    if (tab.readonly) continue
    for (const sub of tab.subsections) {
      for (const f of sub.fields) {
        const c = fieldColumns(f)[column]
        if (!c || c.readonly || skip.has(f.field.toLowerCase())) continue
        const key = draftKey(f.table, c.id, f.field)
        if (seen.has(key)) continue
        seen.add(key)
        const value = normalizeValue(key in draft ? draft[key] : c.raw)
        if (value === null) continue
        out.push({ table: f.table.toLowerCase(), field: f.field, label: f.label, value, text: column === 0 ? f.value : f.value2 })
      }
    }
  }
  return out
}
