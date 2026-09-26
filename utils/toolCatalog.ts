/**
 * Каталог инструментов, не относящихся к карте: журналы, реестры,
 * диагностика и отчёты. Живёт отдельно от компонентов, чтобы панель
 * инструментов и любые другие точки входа использовали один источник.
 */

export type ToolEvent =
  | 'open-topology-diagnostics'
  | 'open-fault-diagnostics'
  | 'open-calculation-diagnostics'
  | 'open-passport-dialog'
  | 'open-defect-journal'
  | 'open-shurf-journal'
  | 'open-inspection-journal'
  | 'open-repair-journal'
  | 'open-pressure-test-journal'
  | 'open-ochered-opressovok'
  | 'open-technical-condition-journal'
  | 'open-corrosion-indicator-journal'
  | 'open-outage-simulation'
  | 'open-alseko-journal'
  | 'open-electrical-network-journal'
  | 'open-heat-loss-journal'
  | 'open-temperature-graph-journal'
  | 'open-consumer-load-diagnostics'
  | 'open-network-queries'
  | 'open-pump-equipment'
  | 'open-network-armatures'
  | 'open-network-regulators'
  | 'open-network-bypasses'
  | 'open-network-diaphragms'
  | 'open-elevators'
  | 'open-throttling-calculator'
  | 'open-hydraulic-thematic'

export interface ToolDescriptor {
  label: string
  icon: string
  color: string
  event: ToolEvent
  /** Короткое пояснение под названием */
  hint?: string
}

export interface ToolGroupDescriptor {
  title: string
  icon: string
  color: string
  items: ToolDescriptor[]
}

export const TOOL_GROUPS: ToolGroupDescriptor[] = [
  {
    title: 'Эксплуатация',
    icon: 'mdi-clipboard-text-outline',
    color: 'deep-orange-darken-2',
    items: [
      { label: 'Локализация аварий', hint: 'Отсекающие задвижки и отключенные потребители', icon: 'mdi-valve-closed', color: 'error', event: 'open-outage-simulation' },
      { label: 'Нарушения', hint: 'Журнал дефектов и повреждений', icon: 'mdi-alert-decagram-outline', color: 'deep-orange-darken-2', event: 'open-defect-journal' },
      { label: 'Шурфовки', hint: 'План, предписания, выполнение', icon: 'mdi-shovel', color: 'brown-darken-2', event: 'open-shurf-journal' },
      { label: 'Осмотры', hint: 'Контуры осмотра и результаты', icon: 'mdi-clipboard-search-outline', color: 'teal-darken-2', event: 'open-inspection-journal' },
      { label: 'Ремонты', hint: 'План и факт по контурам', icon: 'mdi-hammer-wrench', color: 'deep-purple-darken-2', event: 'open-repair-journal' },
      { label: 'Опрессовки', hint: 'Испытания и акты', icon: 'mdi-gauge', color: 'blue-darken-2', event: 'open-pressure-test-journal' },
      { label: 'Очередь опрессовок', hint: 'Отдельный legacy-реестр очередей', icon: 'mdi-format-list-numbered', color: 'indigo-darken-2', event: 'open-ochered-opressovok' },
      { label: 'Индикаторы коррозии', hint: 'Сезонная история и оценки', icon: 'mdi-test-tube', color: 'orange-darken-3', event: 'open-corrosion-indicator-journal' },
    ],
  },
  {
    title: 'Оборудование сети',
    icon: 'mdi-pipe-valve',
    color: 'blue-grey-darken-3',
    items: [
      { label: 'Насосное оборудование', hint: 'Агрегаты и характеристики H(Q)', icon: 'mdi-pump', color: 'blue-grey-darken-3', event: 'open-pump-equipment' },
      { label: 'Запорная арматура', hint: 'Задвижки и каталог типоразмеров', icon: 'mdi-valve', color: 'deep-purple-darken-3', event: 'open-network-armatures' },
      { label: 'Сетевые регуляторы', hint: 'Давления, расхода, перепада', icon: 'mdi-tune-vertical', color: 'indigo-darken-3', event: 'open-network-regulators' },
      { label: 'Байпасы', hint: 'Обводные линии и трубы', icon: 'mdi-pipe-valve', color: 'cyan-darken-4', event: 'open-network-bypasses' },
      { label: 'Диафрагмы', hint: 'Дроссельные устройства', icon: 'mdi-circle-slice-8', color: 'teal-darken-4', event: 'open-network-diaphragms' },
      { label: 'Элеваторы', hint: 'Сопла и камеры смешения', icon: 'mdi-elevator', color: 'blue-grey-darken-4', event: 'open-elevators' },
    ],
  },
  {
    title: 'Расчёты и диагностика',
    icon: 'mdi-calculator-variant',
    color: 'primary',
    items: [
      { label: 'Гидравлический режим на карте', hint: 'Стрелки потоков, hуд > 80 Па/м, скорости и напоры', icon: 'mdi-map-clock-outline', color: 'indigo-darken-2', event: 'open-hydraulic-thematic' },
      { label: 'Калькулятор дросселирования', hint: 'Расчет шайб и сопел элеваторов', icon: 'mdi-calculator', color: 'teal-darken-3', event: 'open-throttling-calculator' },
      { label: 'Диагностика расчётов', hint: 'Готовность исходных данных', icon: 'mdi-calculator-variant', color: 'primary', event: 'open-calculation-diagnostics' },
      { label: 'Диагностика топологии', hint: 'Разрывы и висячие узлы', icon: 'mdi-stethoscope', color: 'deep-purple-darken-2', event: 'open-topology-diagnostics' },
      { label: 'Поиск неисправностей', hint: 'Дефекты и коррозия на карте', icon: 'mdi-alert-octagon', color: 'error', event: 'open-fault-diagnostics' },
      { label: 'Тепловые нагрузки', hint: 'Нулевые, закрытые, отключённые', icon: 'mdi-home-lightning-bolt-outline', color: 'teal-darken-3', event: 'open-consumer-load-diagnostics' },
      { label: 'Запросы по сети', hint: 'Объём, длина, диаметры, теплопотребление (Zap)', icon: 'mdi-sigma', color: 'blue-grey-darken-2', event: 'open-network-queries' },
      { label: 'Тепловые потери', hint: 'Сезоны и готовность источников', icon: 'mdi-heat-wave', color: 'deep-orange-darken-3', event: 'open-heat-loss-journal' },
      { label: 'Температурные графики', hint: 'Кривые t1/t2/t3 источников', icon: 'mdi-chart-bell-curve-cumulative', color: 'purple-darken-3', event: 'open-temperature-graph-journal' },
    ],
  },
  {
    title: 'Реестры и отчёты',
    icon: 'mdi-file-tree',
    color: 'success',
    items: [
      { label: 'Отчёты и паспорта', hint: 'Паспорта участков в Excel', icon: 'mdi-file-tree', color: 'success', event: 'open-passport-dialog' },
      { label: 'Технические условия', hint: 'Реестр ТУ и нагрузки', icon: 'mdi-file-certificate-outline', color: 'cyan-darken-3', event: 'open-technical-condition-journal' },
      { label: 'Объекты АЛСЕКО', hint: 'Договорные нагрузки и здания', icon: 'mdi-office-building-marker', color: 'indigo-darken-2', event: 'open-alseko-journal' },
      { label: 'Электрическая сеть', hint: 'Источники, ЛЭП, приёмники', icon: 'mdi-transmission-tower', color: 'amber-darken-4', event: 'open-electrical-network-journal' },
    ],
  },
]

/** Плоский список — для поиска и телеметрии */
export const ALL_TOOLS: ToolDescriptor[] = TOOL_GROUPS.flatMap((g) => g.items)
