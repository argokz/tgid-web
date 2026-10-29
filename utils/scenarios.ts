/**
 * Сценарии «что если» (GET api/v1/scenarios/{id}/diff): подписи видов отличий, таблиц и полей,
 * текст «поле: было → стало». Иконки — из utils/mdiSvgPaths.ts / mdiSvgPathsLazy.ts.
 */
import type { ScenarioChangeKind, ScenarioDiffItem } from '~/services/api/types'

export interface ScenarioKindMeta {
  label: string
  color: string
  icon: string
}

/** Порядок — как на сервере: правки сценария, конфликты, затем изменения основы */
export const SCENARIO_KIND_META: Record<ScenarioChangeKind, ScenarioKindMeta> = {
  changed: { label: 'Изменено', color: 'primary', icon: 'mdi-pencil' },
  added: { label: 'Добавлено', color: 'success', icon: 'mdi-plus-circle-outline' },
  removed: { label: 'Удалено', color: 'error', icon: 'mdi-minus-circle-outline' },
  conflict: { label: 'Конфликт', color: 'deep-orange-darken-2', icon: 'mdi-alert-octagon' },
  base_changed: { label: 'Изменено в основе', color: 'grey-darken-1', icon: 'mdi-source-branch' },
  base_added: { label: 'Добавлено в основе', color: 'grey-darken-1', icon: 'mdi-source-branch' },
  base_removed: { label: 'Удалено из основы', color: 'grey-darken-1', icon: 'mdi-source-branch' },
}

/** Правка, сделанная в сценарии (её можно будет перенести в основу); остальное — изменения основы */
export const isScenarioEdit = (kind: ScenarioChangeKind): boolean =>
  kind === 'changed' || kind === 'added' || kind === 'removed' || kind === 'conflict'

const TABLE_LABELS: Record<string, string> = {
  nodes: 'Узел',
  linesobj: 'Участок',
  heatpipesections: 'Паспорт участка',
  pipesections: 'Типовой участок',
  realconsumers: 'Потребитель',
  generalizedconsumers: 'Обобщённый потребитель',
  heatsources: 'Источник',
  pumpstations: 'Насосная',
  pumps: 'Насос',
  dampers: 'Задвижка',
  setpressnodes: 'Заданный напор',
  refillnodes: 'Подпитка',
  connectnodes: 'Связь узлов',
  heatchambers: 'Камера',
  pressregulators: 'Регулятор давления',
  pressdropregulators: 'Регулятор перепада',
  consumptregulators: 'Регулятор расхода',
  diaphragms: 'Диафрагма',
  elevators: 'Элеватор',
  bypass: 'Байпас',
  heatexchangers: 'Теплообменник',
  externalcodes: 'Код',
  directions: 'Направление',
  deployeddirections: 'Направление объекта',
  deployedtempgraphs: 'Температурный график',
  calctemperatures: 'Расчётная температура',
  specexpends: 'Удельный расход',
  varcoefficients: 'Коэффициент',
}

const FIELD_LABELS: Record<string, string> = {
  name: 'название',
  nodename: 'название',
  nodeid: 'узел',
  nodeid1: 'узел начала',
  nodeid2: 'узел конца',
  lineid: 'участок',
  internalnodeid: 'схема узла',
  nodetypeid: 'вид узла',
  externalsignlineid: 'признак',
  x: 'X',
  y: 'Y',
  coords: 'вершины',
  diametercondit: 'Ду',
  diameterinternal: 'Dвн',
  pipesectlength: 'длина',
  pipesectstateidflow: 'состояние подачи',
  pipesectstateidret: 'состояние обратки',
  damperarmaturestateid: 'состояние задвижки',
}

export const scenarioTableLabel = (table: string): string => TABLE_LABELS[table] ?? table

export const scenarioFieldLabel = (column: string): string => FIELD_LABELS[column] ?? column

export const formatScenarioValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)))
  return String(value)
}

/** «Ду: 300 → 400; узел конца: 2 → новый #150» */
export const scenarioFieldsText = (fields: ScenarioDiffItem['fields']): string =>
  Object.entries(fields || {})
    .map(([column, [base, copy]]) => `${scenarioFieldLabel(column)}: ${formatScenarioValue(base)} → ${formatScenarioValue(copy)}`)
    .join('; ')

/** «Участок №324074 (в сценарии №397216)»: номер основы, а у нового объекта — номер в сценарии */
export const scenarioObjectTitle = (item: Pick<ScenarioDiffItem, 'table' | 'base_id' | 'copy_id' | 'name'>): string => {
  const what = scenarioTableLabel(item.table)
  const id = item.base_id != null ? `№${item.base_id}` : `№${item.copy_id} (новый)`
  return item.name ? `${what} ${id} «${item.name}»` : `${what} ${id}`
}

/** Непустые счётчики по видам в порядке SCENARIO_KIND_META */
export const scenarioKindCounts = (byKind: Partial<Record<ScenarioChangeKind, number>> | null | undefined) =>
  (Object.keys(SCENARIO_KIND_META) as ScenarioChangeKind[])
    .filter((kind) => (byKind?.[kind] ?? 0) > 0)
    .map((kind) => ({ kind, count: byKind![kind]!, ...SCENARIO_KIND_META[kind] }))
