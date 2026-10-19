/**
 * Тип линии — участок трубопровода или оборудование, как «Изменить тип объекта» десктопа gid8
 * (itwin-api database/line_types).
 *
 * Тип — таблица карточки по lineID (heatPipeSections, dampers, pumps…). При смене карточка старой
 * таблицы удаляется, новая создаётся с умолчаниями; у пары подачи и обратки тип меняется у обеих.
 * Элеватор, радиатор, теплообменник и калорифер только распознаются — в меню десктопа их нет.
 */
import { EQUIPMENT_KINDS, isEquipmentKind, type CardKind } from '~/utils/objectCard'

export type LineType = 'line' | 'pump' | 'pressregulator' | 'consregulator' | 'damper' | 'regarmature'
  | 'bypass' | 'diaphragm' | 'pressdropregulator' | 'reversevalve'

export const LINE_TYPE_ITEMS: readonly { value: LineType; title: string; icon: string }[] = [
  { value: 'line', title: 'Участок трубопровода', icon: 'mdi-pipe' },
  { value: 'pump', title: 'Насос', icon: 'mdi-pump' },
  { value: 'pressregulator', title: 'Регулятор давления', icon: 'mdi-gauge' },
  { value: 'consregulator', title: 'Регулятор расхода', icon: 'mdi-speedometer' },
  { value: 'damper', title: 'Задвижка', icon: 'mdi-valve' },
  { value: 'regarmature', title: 'Регулирующая арматура', icon: 'mdi-pipe-valve' },
  { value: 'bypass', title: 'Байпас', icon: 'mdi-swap-horizontal' },
  { value: 'diaphragm', title: 'Диафрагма', icon: 'mdi-circle-slice-8' },
  { value: 'pressdropregulator', title: 'Регулятор перепада давления', icon: 'mdi-tune-vertical' },
  { value: 'reversevalve', title: 'Обратный клапан', icon: 'mdi-valve-closed' },
]

const DETECT_ONLY_TITLES: Record<string, string> = {
  elevator: 'Элеватор',
  radiator: 'Радиатор',
  heatexchanger: 'Теплообменник',
  airheater: 'Калориферная установка',
  none: 'Без карточки',
}

export const lineTypeTitle = (t: string | null | undefined): string =>
  LINE_TYPE_ITEMS.find((i) => i.value === t)?.title ?? DETECT_ONLY_TITLES[String(t)] ?? String(t ?? '')

interface LineCard { table: string; kind: string; id: number }

/** GET api/v1/topology/line/{id}/type */
export interface LineTypeInfo {
  line_id: number
  kind: string
  label: string
  cards: LineCard[]
  conflict: boolean
  /** линия внутренней схемы узла */
  inner: boolean
  sign: number | null
  pair_line_id: number | null
  version: string | null
}

/** POST api/v1/topology/line/{id}/type (в том числе dry_run) */
export interface LineTypeChangeResult {
  dry_run?: boolean
  line_id: number
  pair_line_id: number | null
  old_type: string
  new_type: LineType
  old_label: string
  new_label: string
  lines: { line_id: number; old_kind: string; removed_cards: LineCard[]; created_card: (LineCard & { line_id: number }) | null }[]
  versions?: Record<string, string>
  operation_id?: number | null
}

/** «карточка «Участок трубопровода» уч. 20 (паспорт №5) со всеми её значениями» */
export const lineTypeLosses = (r: LineTypeChangeResult): string[] =>
  r.lines.flatMap((l) => l.removed_cards.map((c) =>
    `карточка «${lineTypeTitle(c.kind)}» уч. ${l.line_id} (№${c.id}) со всеми её значениями`))

/** Карточка нового типа для окна свойств: участок или оборудование; у диафрагмы карточки нет (реестр) */
export const lineTypeCard = (kind: string, lineId: number): { kind: CardKind; table: string; id: number; title: string } | null => {
  if (kind === 'line') return { kind: 'line', table: 'heatPipeSections', id: lineId, title: `Участок трубопровода: уч. ${lineId}` }
  if (isEquipmentKind(kind)) {
    const info = EQUIPMENT_KINDS[kind]
    return { kind, table: info.table, id: lineId, title: `${info.label}: уч. ${lineId}` }
  }
  return null
}
