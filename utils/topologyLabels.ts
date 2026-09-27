/** Подписи таблиц и ссылок на узел для превью операций редактора топологии */

export const TOPOLOGY_TABLE_LABELS: Record<string, string> = {
  pressregulators: 'Регуляторы давления',
  consumptregulators: 'Регуляторы расхода',
  pressdropregulators: 'Регуляторы перепада',
  dampers: 'Задвижки',
  diaphragms: 'Диафрагмы',
  elevators: 'Элеваторы',
  systemradiators: 'Радиаторы',
  pumps: 'Насосы',
  heatexchangers: 'Теплообменники',
  airheaters: 'Калориферы',
  reversevalves: 'Обратные клапаны',
  bypass: 'Перемычки',
  regularmatures: 'Регулирующая арматура',
  localhydroresistances2: 'Местные сопротивления',
  realconsumers: 'Потребители',
  generalizedconsumers: 'Обобщённые потребители',
  deployeddirections: 'Направления',
  heatchambers: 'Тепловые камеры',
  heatsources: 'Источники',
  pumpstations: 'Насосные станции',
  setpressnodes: 'Узлы установки давления',
  connectnodes: 'Узлы подключения',
  threewayvalves: 'Трёхходовые клапаны',
  refillnodes: 'Узлы подпитки',
  wdodevices: 'Устройства узла',
  us_out: 'Результаты расчёта по узлам',
  pt_out: 'Результаты расчёта по потребителям',
};

/** Ссылки на узел «таблица.колонка» с особым смыслом колонки */
const REF_LABELS: Record<string, string> = {
  'nodes.internalnodeid': 'Узлы внутренней схемы',
  'linesobj.internalnodeid': 'Участки внутренней схемы',
  'texts.internalnodeid': 'Надписи внутренней схемы',
  'defect.remontnodeid': 'Дефекты (узел ремонта)',
};

export const topologyTableLabel = (table: string): string => TOPOLOGY_TABLE_LABELS[table] || table;

/** «realconsumers.nodeid» → «Потребители»; незнакомое — как есть */
export const topologyRefLabel = (ref: string): string => {
  if (REF_LABELS[ref]) return REF_LABELS[ref];
  const [table, column] = ref.split('.', 2);
  const base = TOPOLOGY_TABLE_LABELS[table];
  if (!base) return ref;
  return column && column !== 'nodeid' ? `${base} (${column})` : base;
};

export const countList = (rec: Record<string, number> | undefined | null) =>
  Object.entries(rec || {})
    .filter(([, n]) => Number(n) > 0)
    .map(([key, count]) => ({ key, count: Number(count) }));

const EXTERNAL_SIGN_LINE_LABELS: Record<number, string> = {
  1: 'общий',
  2: 'подающий',
  3: 'обратный',
  4: 'подающий-обратный',
  5: 'обратный-подающий',
};

export const externalSignLineLabel = (value: number | null | undefined): string =>
  value == null ? '—' : EXTERNAL_SIGN_LINE_LABELS[value] || String(value);

export const endPositionLabel = (pos: string): string =>
  pos === 'start' ? 'начало' : pos === 'end' ? 'конец' : 'не на концах';
