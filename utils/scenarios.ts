/**
 * Сценарии «что если» (GET api/v1/scenarios/{id}/diff): подписи видов отличий, таблиц и полей,
 * текст «поле: было → стало». Иконки — из utils/mdiSvgPaths.ts / mdiSvgPathsLazy.ts.
 */
import type { ScenarioChangeKind, ScenarioDiffItem, ScenarioRegimeItem, ScenarioRegimeKind, ScenarioValuePair } from '~/services/api/types'

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

// --- Режим сценария против основы (GET api/v1/scenarios/{id}/compare) ---

/** Порядок — как на сервере: сначала последствия для потребителей */
export const SCENARIO_REGIME_META: Record<ScenarioRegimeKind, ScenarioKindMeta> = {
  became_underheated: { label: 'Стал недотоп', color: 'error', icon: 'mdi-thermometer' },
  lost: { label: 'Не рассчитан (отключён)', color: 'error', icon: 'mdi-power-plug-off' },
  became_overloaded: { label: 'Перегрузка участка', color: 'deep-orange-darken-2', icon: 'mdi-alert-octagon' },
  became_fast: { label: 'Скорость выше нормы', color: 'deep-orange-darken-2', icon: 'mdi-speedometer' },
  recovered: { label: 'Недотоп устранён', color: 'success', icon: 'mdi-check-circle' },
  relieved: { label: 'Перегрузка снята', color: 'success', icon: 'mdi-check-circle' },
  new: { label: 'Новый в сценарии', color: 'primary', icon: 'mdi-plus-circle-outline' },
  changed: { label: 'Изменился режим', color: 'primary', icon: 'mdi-pencil' },
}

const fmt = (value: number | null | undefined, digits: number): string =>
  value === null || value === undefined ? '—' : value.toLocaleString('ru-RU', { maximumFractionDigits: digits })

const pairText = (label: string, pair: ScenarioValuePair | undefined, unit: string, digits = 1): string | null =>
  pair ? `${label} ${fmt(pair[0], digits)} → ${fmt(pair[1], digits)} ${unit}` : null

/** «Потребитель, узел №536426 «ТК-5»» / «Участок №325765»; у нового объекта — номер в сценарии */
export const scenarioRegimeTitle = (item: Pick<ScenarioRegimeItem, 'object' | 'base_id' | 'copy_id' | 'name'>): string => {
  const id = item.base_id != null ? `№${item.base_id}` : `№${item.copy_id} (новый)`
  if (item.object === 'line') return `Участок ${id}`
  return item.name ? `Потребитель, узел ${id} «${item.name}»` : `Потребитель, узел ${id}`
}

/** «напор 30 → 28 м · обеспеченность 105 → 80 % · расход 10 → 0 т/ч» */
export const scenarioRegimeText = (item: ScenarioRegimeItem): string =>
  (item.object === 'consumer'
    ? [pairText('напор', item.head, 'м'), pairText('обеспеченность', item.supply, '%', 0), pairText('расход', item.flow, 'т/ч')]
    : [pairText('расход', item.flow, 'т/ч'), pairText('скорость', item.velocity, 'м/с', 2), pairText('потери', item.loss, 'Па/м')])
    .filter(Boolean)
    .join(' · ')
