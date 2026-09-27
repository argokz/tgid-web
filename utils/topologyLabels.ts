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

/** Опознавательные атрибуты оборудования «на ручную проверку» (превью разрезания) */
const REVIEW_ATTR_LABELS: Record<string, string> = {
  name: '',
  diametercondit: 'Ду',
  diameterinternal: 'Dвн',
  throtdiaphloc: 'место',
  location: 'место',
  entrymark: 'отм.',
  elevatortype: 'тип',
  diameternozzle: 'сопло',
  type: 'тип',
  count: 'кол-во',
  number: '№',
  thrust: 'напор',
  pumpstationid: 'НС',
  heatexchtype: 'тип',
  heatexchcode: 'код',
  airheatertype: 'тип',
  damperarmaturestateid: 'сост.',
};

/** «№22 · Ду 706 · сост. 1» */
export const reviewItemLabel = (item: { id: number; attrs?: Record<string, unknown> }): string => {
  const parts = Object.entries(item.attrs || {})
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => {
      const label = REVIEW_ATTR_LABELS[k] ?? k;
      return label ? `${label} ${v}` : String(v);
    });
  return [`№${item.id}`, ...parts].join(' · ');
};

const OPERATION_LABELS: Record<string, string> = {
  CREATE_NODE: 'создание узла',
  CREATE_LINE: 'создание участка',
  MOVE: 'перемещение узла',
  DELETE_NODE: 'удаление узла',
  DELETE_LINE: 'удаление участка',
  SPLIT: 'разрезание участка',
  MERGE: 'слияние узлов',
  REVERSE: 'разворот участка',
  GEOMETRY: 'правка вершин участка',
};

/** Подпись кнопки «Отменить»: «разрезание участка 17» */
export const topologyOperationLabel = (entry: { operation: string; summary?: Record<string, any> } | null): string => {
  if (!entry) return '';
  const s = entry.summary || {};
  const base = OPERATION_LABELS[entry.operation] || entry.operation.toLowerCase();
  const id = s.line_id ?? s.node_id ?? s.target_node_id ?? s.id;
  return id != null ? `${base} ${id}` : base;
};
