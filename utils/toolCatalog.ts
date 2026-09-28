import type { Role } from '~/utils/permissions'

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
  | 'open-regime-analysis'
  | 'open-excel-reports'
  | 'open-pump-equipment'
  | 'open-network-armatures'
  | 'open-network-regulators'
  | 'open-network-bypasses'
  | 'open-network-diaphragms'
  | 'open-elevators'
  | 'open-throttling-calculator'
  | 'open-hydraulic-thematic'
  | 'open-users-admin'
  | 'open-audit-history'
  | 'open-group-setters'
  | 'open-pts-sites'
  | 'open-dictionaries'
  | 'open-print-layout'
  | 'open-network-import'

/** Ключ диалога инструмента: MapViewer монтирует диалог лениво при первом открытии */
export type ToolDialogKey =
  | 'topologyDiagnostics'
  | 'faultDiagnostics'
  | 'calculationDiagnostics'
  | 'passport'
  | 'defect'
  | 'shurf'
  | 'inspection'
  | 'repair'
  | 'pressureTest'
  | 'ocheredOpressovok'
  | 'technicalCondition'
  | 'corrosionIndicator'
  | 'outageSimulation'
  | 'throttlingCalculator'
  | 'hydraulicThematic'
  | 'alseko'
  | 'electricalNetwork'
  | 'heatLoss'
  | 'temperatureGraph'
  | 'consumerLoad'
  | 'pumpEquipment'
  | 'networkArmature'
  | 'networkRegulator'
  | 'networkBypass'
  | 'networkDiaphragm'
  | 'elevator'
  | 'networkQueries'
  | 'regimeAnalysis'
  | 'excelReports'
  | 'usersAdmin'
  | 'auditHistory'
  | 'groupSetters'
  | 'ptsSites'
  | 'dictionaries'
  | 'printLayout'
  | 'networkImport'

export interface ToolDescriptor {
  label: string
  /** Минимальная роль: пункт скрыт, если у пользователя роль ниже (utils/permissions.ts) */
  requires?: Role
  icon: string
  color: string
  event: ToolEvent
  /** Какой диалог открывает событие (регистрация диалогов в MapViewer) */
  dialog: ToolDialogKey
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
      { label: 'Локализация аварий', hint: 'Отсекающие задвижки и отключенные потребители', icon: 'mdi-valve-closed', color: 'error', event: 'open-outage-simulation', dialog: 'outageSimulation' },
      { label: 'Нарушения', hint: 'Журнал дефектов и повреждений', icon: 'mdi-alert-decagram-outline', color: 'deep-orange-darken-2', event: 'open-defect-journal', dialog: 'defect' },
      { label: 'Шурфовки', hint: 'План, предписания, выполнение', icon: 'mdi-shovel', color: 'brown-darken-2', event: 'open-shurf-journal', dialog: 'shurf' },
      { label: 'Осмотры', hint: 'Контуры осмотра и результаты', icon: 'mdi-clipboard-search-outline', color: 'teal-darken-2', event: 'open-inspection-journal', dialog: 'inspection' },
      { label: 'Ремонты', hint: 'План и факт по контурам', icon: 'mdi-hammer-wrench', color: 'deep-purple-darken-2', event: 'open-repair-journal', dialog: 'repair' },
      { label: 'Опрессовки', hint: 'Испытания и акты', icon: 'mdi-gauge', color: 'blue-darken-2', event: 'open-pressure-test-journal', dialog: 'pressureTest' },
      { label: 'Очередь опрессовок', hint: 'Отдельный legacy-реестр очередей', icon: 'mdi-format-list-numbered', color: 'indigo-darken-2', event: 'open-ochered-opressovok', dialog: 'ocheredOpressovok' },
      { label: 'Индикаторы коррозии', hint: 'Сезонная история и оценки', icon: 'mdi-test-tube', color: 'orange-darken-3', event: 'open-corrosion-indicator-journal', dialog: 'corrosionIndicator' },
    ],
  },
  {
    title: 'Оборудование сети',
    icon: 'mdi-pipe-valve',
    color: 'blue-grey-darken-3',
    items: [
      { label: 'Насосное оборудование', hint: 'Агрегаты и характеристики H(Q)', icon: 'mdi-pump', color: 'blue-grey-darken-3', event: 'open-pump-equipment', dialog: 'pumpEquipment' },
      { label: 'Запорная арматура', hint: 'Задвижки и каталог типоразмеров', icon: 'mdi-valve', color: 'deep-purple-darken-3', event: 'open-network-armatures', dialog: 'networkArmature' },
      { label: 'Сетевые регуляторы', hint: 'Давления, расхода, перепада', icon: 'mdi-tune-vertical', color: 'indigo-darken-3', event: 'open-network-regulators', dialog: 'networkRegulator' },
      { label: 'Байпасы', hint: 'Обводные линии и трубы', icon: 'mdi-pipe-valve', color: 'cyan-darken-4', event: 'open-network-bypasses', dialog: 'networkBypass' },
      { label: 'Диафрагмы', hint: 'Дроссельные устройства', icon: 'mdi-circle-slice-8', color: 'teal-darken-4', event: 'open-network-diaphragms', dialog: 'networkDiaphragm' },
      { label: 'Элеваторы', hint: 'Сопла и камеры смешения', icon: 'mdi-elevator', color: 'blue-grey-darken-4', event: 'open-elevators', dialog: 'elevator' },
    ],
  },
  {
    title: 'Расчёты и диагностика',
    icon: 'mdi-calculator-variant',
    color: 'primary',
    items: [
      { label: 'Гидравлический режим на карте', hint: 'Стрелки потоков, hуд > 80 Па/м, скорости и напоры', icon: 'mdi-map-clock-outline', color: 'indigo-darken-2', event: 'open-hydraulic-thematic', dialog: 'hydraulicThematic' },
      { label: 'Калькулятор дросселирования', hint: 'Расчет шайб и сопел элеваторов', icon: 'mdi-calculator', color: 'teal-darken-3', event: 'open-throttling-calculator', dialog: 'throttlingCalculator' },
      { label: 'Диагностика расчётов', hint: 'Готовность исходных данных', icon: 'mdi-calculator-variant', color: 'primary', event: 'open-calculation-diagnostics', dialog: 'calculationDiagnostics' },
      { label: 'Диагностика топологии', hint: 'Разрывы и висячие узлы', icon: 'mdi-stethoscope', color: 'deep-purple-darken-2', event: 'open-topology-diagnostics', dialog: 'topologyDiagnostics' },
      { label: 'Поиск неисправностей', hint: 'Дефекты и коррозия на карте', icon: 'mdi-alert-octagon', color: 'error', event: 'open-fault-diagnostics', dialog: 'faultDiagnostics' },
      { label: 'Тепловые нагрузки', hint: 'Нулевые, закрытые, отключённые', icon: 'mdi-home-lightning-bolt-outline', color: 'teal-darken-3', event: 'open-consumer-load-diagnostics', dialog: 'consumerLoad' },
      { label: 'Запросы по сети', hint: 'Объём, длина, диаметры, теплопотребление (Zap)', icon: 'mdi-sigma', color: 'blue-grey-darken-2', event: 'open-network-queries', dialog: 'networkQueries' },
      { label: 'Анализ режима', hint: 'Перепады, завоздушивание, температуры, допустимость, зоны', icon: 'mdi-gauge', color: 'indigo-darken-3', event: 'open-regime-analysis', dialog: 'regimeAnalysis' },
      { label: 'Тепловые потери', hint: 'Сезоны и готовность источников', icon: 'mdi-heat-wave', color: 'deep-orange-darken-3', event: 'open-heat-loss-journal', dialog: 'heatLoss' },
      { label: 'Температурные графики', hint: 'Кривые t1/t2/t3 источников', icon: 'mdi-chart-bell-curve-cumulative', color: 'purple-darken-3', event: 'open-temperature-graph-journal', dialog: 'temperatureGraph' },
    ],
  },
  {
    title: 'Реестры и отчёты',
    icon: 'mdi-file-tree',
    color: 'success',
    items: [
      { label: 'Отчёты и паспорта', hint: 'Паспорта участков в Excel', icon: 'mdi-file-tree', color: 'success', event: 'open-passport-dialog', dialog: 'passport' },
      { label: 'Участки ПТС', hint: 'Участки МС/РС: характеристика, привязка труб (карта, цепочка узлов), паспорт', icon: 'mdi-map-marker-path', color: 'green-darken-2', event: 'open-pts-sites', dialog: 'ptsSites' },
      { label: 'Печать карты', hint: 'Макет A4/A3: масштаб, легенда, штамп; PNG и PDF', icon: 'mdi-printer', color: 'blue-grey-darken-2', event: 'open-print-layout', dialog: 'printLayout' },
      { label: 'Отчёты Excel', hint: 'Таблицы десктопа: участки, потребители, задвижки, результаты расчёта', icon: 'mdi-file-excel', color: 'green-darken-3', event: 'open-excel-reports', dialog: 'excelReports' },
      { label: 'Технические условия', hint: 'Реестр ТУ и нагрузки', icon: 'mdi-file-certificate-outline', color: 'cyan-darken-3', event: 'open-technical-condition-journal', dialog: 'technicalCondition' },
      { label: 'Объекты АЛСЕКО', hint: 'Договорные нагрузки и здания', icon: 'mdi-office-building-marker', color: 'indigo-darken-2', event: 'open-alseko-journal', dialog: 'alseko' },
      { label: 'Электрическая сеть', hint: 'Источники, ЛЭП, приёмники', icon: 'mdi-transmission-tower', color: 'amber-darken-4', event: 'open-electrical-network-journal', dialog: 'electricalNetwork' },
    ],
  },
  {
    title: 'Исходные данные',
    icon: 'mdi-book-open-page-variant-outline',
    color: 'teal-darken-3',
    items: [
      { label: 'Групповые установщики', hint: 'Поле = значение для фрагмента, выделения или фильтра (aSet*)', icon: 'mdi-select-group', color: 'deep-orange-darken-2', event: 'open-group-setters', dialog: 'groupSetters', requires: 'editor' },
      { label: 'Импорт SHP / Excel / координат', hint: 'Узлы, участки из SHP, координаты узлов: сопоставление полей, превью, отмена', icon: 'mdi-database-import', color: 'indigo-darken-2', event: 'open-network-import', dialog: 'networkImport', requires: 'editor' },
      { label: 'Справочники', hint: 'Удельные расходы, Kv, температуры, ГВС, организации, районы', icon: 'mdi-book-open-page-variant-outline', color: 'teal-darken-3', event: 'open-dictionaries', dialog: 'dictionaries', requires: 'editor' },
    ],
  },
  {
    title: 'Администрирование',
    icon: 'mdi-shield-account',
    color: 'blue-grey-darken-2',
    items: [
      { label: 'История правок', hint: 'Журнал изменений audit_log', icon: 'mdi-history', color: 'blue-grey-darken-2', event: 'open-audit-history', dialog: 'auditHistory', requires: 'viewer' },
      { label: 'Пользователи', hint: 'Роли, блокировка, пароли', icon: 'mdi-account-cog', color: 'blue-grey-darken-3', event: 'open-users-admin', dialog: 'usersAdmin', requires: 'admin' },
    ],
  },
]

/** Плоский список — для поиска и телеметрии */
export const ALL_TOOLS: ToolDescriptor[] = TOOL_GROUPS.flatMap((g) => g.items)

/** Событие панели инструментов → ключ ленивого диалога (из самого каталога) */
export const TOOL_EVENT_TO_DIALOG = Object.fromEntries(
  ALL_TOOLS.map((tool) => [tool.event, tool.dialog]),
) as Record<ToolEvent, ToolDialogKey>
