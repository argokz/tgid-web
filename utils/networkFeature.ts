/** Классификация объектов сети по отрисованному feature (слой, source-layer, таблица, геометрия) */
export const getFeatureKind = (feature: any): 'node' | 'line' | null => {
  const signature = [
    feature?.layer?.id,
    feature?.sourceLayer,
    feature?.layer?.['source-layer'],
    feature?.properties?.table,
    feature?.properties?.type
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (signature.includes('node') || signature.includes('узел')) return 'node';
  if (
    signature.includes('line')
    || signature.includes('pipe')
    || signature.includes('heatpipesection')
    || signature.includes('труб')
  ) return 'line';

  const geometryType = feature?.geometry?.type;
  if (geometryType === 'Point' || geometryType === 'MultiPoint') return 'node';
  if (geometryType === 'LineString' || geometryType === 'MultiLineString') return 'line';
  return null;
};

const toPositiveId = (raw: unknown): number | null => {
  if (raw === null || raw === undefined || raw === '') return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

/**
 * Query-слои GeoServer `id_<table>` ищут объект по ключу сети (`viewparams=id:<ключ>`),
 * а в свойстве `id` возвращают первичный ключ своей таблицы. Для этих таблиц ключ — id
 * другой таблицы: `id_heatpipesections` — `WHERE L.id=%id%` (linesobj.id), но `SELECT T.id`
 * (heatpipesections.id ≠ lineid почти у всех строк); потребители/источники/насосные —
 * `WHERE N.id=%id%` (nodes.id). Такой `id` нельзя использовать как id участка/узла (QA F12, F54).
 */
/** Слои зданий GeoServer: id объекта слоя = id строки таблицы (журналы АЛСЕКО и ТУ по зданию) */
export const BUILDING_CARD_TABLES: ReadonlySet<string> = new Set(['zdaniya_2', 'zdaniya_tu']);

export const QUERY_LAYER_KEY_TABLE: Readonly<Record<string, 'linesobj' | 'nodes'>> = {
  heatpipesections: 'linesobj',
  generalizedconsumers: 'nodes',
  realconsumers: 'nodes',
  heatsources: 'nodes',
  pumpstations: 'nodes',
};

/** Источник feature — query-слой `id_*` (его `id` — строка таблицы, а не объект сети) */
const isQueryLayerFeature = (feature: any): boolean => {
  const signature = [
    feature?.sourceLayer,
    feature?.layer?.['source-layer'],
    feature?.layer?.id,
    typeof feature?._sourceId === 'string' ? feature._sourceId : null,
    typeof feature?.id === 'string' ? feature.id : null,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return Object.keys(QUERY_LAYER_KEY_TABLE).some((table) => signature.includes(`id_${table}`));
};

/** Явный id участка (linesobj.id) в свойствах: lineid / line_id */
export const getExplicitLineId = (properties: any): number | null =>
  toPositiveId(properties?.lineid ?? properties?.lineId ?? properties?.line_id);

/**
 * id объекта сети из отрисованного feature. Для участка — linesobj.id: явный `lineid`,
 * иначе `id` слоя участков (MVT `heatpipesections` отдаёт `l.id`). Feature из query-слоя
 * `id_*` без явного ключа даёт null — его `id` принадлежит другой таблице.
 */
export const getFeatureId = (feature: any): number | null => {
  if (getFeatureKind(feature) === 'line') {
    const explicit = getExplicitLineId(feature?.properties);
    if (explicit) return explicit;
  }
  if (isQueryLayerFeature(feature)) return null;
  return toPositiveId(feature?.properties?.id ?? feature?.properties?.Id ?? feature?.id);
};

/**
 * Свойства карточки = свойства слоя + свойства query-слоя (WFS `id_<table>`, viewparams id:lookupId).
 * Для таблиц из QUERY_LAYER_KEY_TABLE `id` карточки — ключ поиска (объект сети), а id строки
 * query-слоя сохраняется в `query_row_id`; для участка явно проставляется `lineid`.
 */
export const mergeQueryLayerProperties = (
  base: Record<string, any>,
  queried: Record<string, any> | null | undefined,
  table: string,
  lookupId: number
): Record<string, any> => {
  const merged: Record<string, any> = { ...base, ...(queried || {}) };
  const keyTable = QUERY_LAYER_KEY_TABLE[String(table || '').toLowerCase()];
  if (!keyTable) {
    // Прочие таблицы (здания zdaniya_2, zdaniya_tu…): id карточки — id строки query-слоя. Слой
    // не несёт tab/gistable, поэтому таблицу запоминаем — иначе resolveCardObject не узнаёт
    // объект и журнал АЛСЕКО / ТУ по зданию из карточки не открыть (QA F79)
    const name = String(table || '').toLowerCase();
    if (toPositiveId(queried?.id) && name !== 'nodes' && name !== 'linesobj') merged.query_table = name;
    return merged;
  }
  const rowId = toPositiveId(queried?.id);
  merged.id = lookupId;
  merged.query_table = String(table).toLowerCase();
  if (rowId) merged.query_row_id = rowId;
  else delete merged.query_row_id;
  if (keyTable === 'linesobj') merged.lineid = lookupId;
  else merged.nodeid = lookupId;
  return merged;
};

/** heatpipesections.id карточки участка (для серверной сверки «участок ↔ паспорт») */
export const getSectionRowId = (properties: any): number | null =>
  String(properties?.query_table || '').toLowerCase() === 'heatpipesections'
    ? toPositiveId(properties?.query_row_id)
    : null;

/**
 * id участка (linesobj.id) карточки. Явный `lineid` приоритетнее `id`; если карточка
 * собрана из query-слоя участков, но `lineid` не определён — null (не действовать наугад).
 */
export const getCardLineId = (properties: any): number | null => {
  const explicit = getExplicitLineId(properties);
  if (explicit) return explicit;
  if (String(properties?.query_table || '').toLowerCase() === 'heatpipesections') return null;
  return toPositiveId(properties?.id);
};

/**
 * Таблицы «ролей» узла: потребитель, источник, насосная лежат в своей таблице, но на карте
 * (MVT `uzel`, свойство `tab`) это узел nodes.id. Журналы и паспорт работают по узлу,
 * диагностика нагрузки / журналы источника — по строке своей таблицы.
 */
export const NODE_ROLE_TABLES = ['generalizedconsumers', 'realconsumers', 'heatsources', 'pumpstations'] as const;
export type NodeRoleTable = typeof NODE_ROLE_TABLES[number];
const isNodeRoleTable = (table: string): table is NodeRoleTable =>
  (NODE_ROLE_TABLES as readonly string[]).includes(table);

/** Коды слоёв GeoServer (MVT `code`): участок — UT; узлы — US, потребители PO/PR/EL/NZ, NS, IS */
const LINE_CODES = new Set(['ut']);
const NODE_CODES = new Set(['us', 'po', 'pr', 'el', 'nz', 'ns', 'is']);

export interface CardObject {
  /**
   * Таблица объекта карточки (смысл `gistable`): linesobj, nodes, generalizedconsumers, …,
   * либо прочая (zdaniya_tu, defects…); '' — не определена.
   */
  table: string;
  /** Объект сети: участок (linesobj), узел (nodes, в т.ч. потребитель/источник/насосная) или не сеть */
  network: 'line' | 'node' | null;
  /** linesobj.id участка или nodes.id узла; null — не определён */
  networkId: number | null;
  /** id строки в `table` (для linesobj/nodes = networkId); null — не определён */
  rowId: number | null;
}

const lower = (value: unknown): string => String(value ?? '').trim().toLowerCase();

/** Таблица по имени слоя/таблицы GeoServer (`tab`, `query_table`) */
const tableFromLayerName = (name: string): string => {
  if (!name) return '';
  if (name === 'heatpipesections' || name === 'linesobj') return 'linesobj';
  if (name === 'nodes' || name === 'uzel') return 'nodes';
  return name;
};

/**
 * Вид объекта карточки (QA F11). Слои GeoServer не несут `gistable` (в nodes колонка пуста),
 * поэтому порядок признаков: явный `gistable` → `query_table` (карточка дополнена query-слоем
 * `id_<table>`) → `tab` (MVT `uzel`: nodes / generalizedconsumers / realconsumers / heatsources /
 * pumpstations) → поля записи (externalsignlineid, nodeid1+nodeid2 — участок; nodetypeid — узел)
 * → код слоя (`code`: UT — участок, US/PO/PR/EL/NZ/NS/IS — узел).
 */
export const resolveCardObject = (properties: any): CardObject => {
  const p = properties || {};
  const gistable = lower(p.gistable);
  const queryTable = lower(p.query_table);
  let table = gistable || tableFromLayerName(queryTable) || tableFromLayerName(lower(p.tab));
  if (!table) {
    const code = lower(p.code);
    if ('externalsignlineid' in p || ('nodeid1' in p && 'nodeid2' in p) || LINE_CODES.has(code)) table = 'linesobj';
    else if (('nodetypeid' in p && !('nodeid1' in p)) || NODE_CODES.has(code)) table = 'nodes';
  }

  if (table === 'linesobj') {
    const lineId = getCardLineId(p);
    return { table, network: 'line', networkId: lineId, rowId: lineId };
  }
  if (table === 'nodes') {
    const nodeId = toPositiveId(p.id);
    return { table, network: 'node', networkId: nodeId, rowId: nodeId };
  }
  if (isNodeRoleTable(table)) {
    // С карты: id/nodeid — nodes.id, строка роли — query_row_id. Явный gistable: id — строка роли,
    // nodeid — её узел. Только `tab` без query-слоя: происхождение id неизвестно — строку не берём.
    const fromQueryLayer = queryTable === table;
    const nodeId = toPositiveId(p.nodeid ?? p.nodeId ?? (fromQueryLayer ? p.id : null));
    const rowId = fromQueryLayer
      ? toPositiveId(p.query_row_id)
      : gistable === table ? toPositiveId(p.id) : null;
    return { table, network: 'node', networkId: nodeId, rowId };
  }
  return { table, network: null, networkId: null, rowId: toPositiveId(p.id) };
};


/** Фрагмент (fileid) отрисованного объекта; null — не указан */
export const getFeatureFragmentId = (feature: any): number | null => {
  const p = feature?.properties || {};
  return toPositiveId(p.fileid ?? p.fileID ?? p.fileId ?? p.FILEID ?? p.file_id);
};

/** Оверлеи редактора, рисования, трассировки — не объекты сети */
const PICK_OVERLAY_PREFIXES = ['draw-', 'topology-vertex-', 'trace-', 'route-', 'piezo-', 'outage-', 'hydraulic-', 'measure-'];
const NODE_LAYER_RE = /uzel|node|узел|узл/;
const LINE_LAYER_RE = /heatpipesection|linesobj|line|pipe|труб|участ/;

/**
 * Вид объекта сети для операций редактора/пьезометра — только по слою сети (MVT `uzel`,
 * `heatpipesections`, слои с node/line в имени) и типу геометрии. Точки и линии прочих
 * слоёв (Almaty2, здания, оверлеи) объектами сети не считаются (QA F53).
 */
export const getNetworkFeatureKind = (feature: any): 'node' | 'line' | null => {
  const layerId = lower(feature?.layer?.id);
  if (PICK_OVERLAY_PREFIXES.some((prefix) => layerId.startsWith(prefix))) return null;
  const signature = [layerId, feature?.sourceLayer, feature?.layer?.['source-layer'], feature?.properties?.table]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  // Без геометрии (identify хранит feature без неё) — по типу стилевого слоя
  const layerType = lower(feature?.layer?.type);
  const type = feature?.geometry?.type
    ?? (layerType === 'line' ? 'LineString' : layerType === 'circle' || layerType === 'symbol' ? 'Point' : undefined);
  if ((type === 'Point' || type === 'MultiPoint') && NODE_LAYER_RE.test(signature)) return 'node';
  if ((type === 'LineString' || type === 'MultiLineString') && LINE_LAYER_RE.test(signature)) return 'line';
  return null;
};

export interface PickCandidate {
  /** Первый отрисованный feature объекта (геометрия, свойства) */
  feature: any;
  kind: 'node' | 'line';
  /** nodes.id / linesobj.id */
  id: number;
  /** fileid; null — не указан */
  fragmentId: number | null;
  /** Роль узла по MVT `tab` (nodes, generalizedconsumers, …); '' — нет */
  tab: string;
}

export interface PickOptions {
  kind: 'node' | 'line';
  /**
   * Фрагменты контекста (активный/выбранный фрагмент, фрагмент начального узла операции):
   * если под курсором есть их объекты, остальные отбрасываются.
   */
  fragmentIds?: readonly number[] | null;
  /** Объекты вне fragmentIds не брать вовсе (деструктивные операции): лучше отказ, чем чужой объект */
  strictFragment?: boolean;
  /** Узлы с этими ролями (`tab`) не кандидаты (например, обобщённые потребители) */
  excludeTabs?: readonly string[];
}

export type PickResult =
  | { status: 'single'; candidate: PickCandidate; candidates: PickCandidate[] }
  | { status: 'ambiguous'; candidate: null; candidates: PickCandidate[] }
  /** reason: 'empty' — объектов нужного вида нет; 'other-fragment' — есть, но только чужих фрагментов */
  | { status: 'none'; candidate: null; candidates: PickCandidate[]; reason: 'empty' | 'other-fragment'; others: PickCandidate[] };

/**
 * Объекты сети нужного вида под курсором — по одному на объект (MVT рисует объект
 * несколькими слоями: точка, подпись), в порядке отрисовки. Feature без id сети
 * (query-слои `id_*`, оверлеи) не кандидаты.
 */
export const collectNetworkCandidates = (
  features: readonly any[] | null | undefined,
  kind: 'node' | 'line',
): PickCandidate[] => {
  const seen = new Set<number>();
  const out: PickCandidate[] = [];
  for (const feature of features || []) {
    if (getNetworkFeatureKind(feature) !== kind) continue;
    const id = getFeatureId(feature);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({ feature, kind, id, fragmentId: getFeatureFragmentId(feature), tab: lower(feature?.properties?.tab) });
  }
  return out;
};

/**
 * Единый выбор объекта сети под курсором с учётом контекста (QA F53, F28). Участки и узлы
 * фрагментов лежат друг на друге (копии сети в 1/74/89/99), поэтому «первый под курсором»
 * — случайный фрагмент. Порядок: вид объекта → роль узла → фрагменты контекста.
 * Один кандидат — single; несколько — ambiguous (спросить пользователя); ни одного — none.
 */
export const pickNetworkFeature = (features: readonly any[] | null | undefined, options: PickOptions): PickResult => {
  const exclude = new Set((options.excludeTabs || []).map((tab) => lower(tab)));
  let candidates = collectNetworkCandidates(features, options.kind).filter((c) => !exclude.has(c.tab));
  if (!candidates.length) return { status: 'none', candidate: null, candidates: [], reason: 'empty', others: [] };

  const context = (options.fragmentIds || []).filter((id) => Number.isInteger(id) && id > 0);
  if (context.length) {
    const inContext = candidates.filter((c) => c.fragmentId !== null && context.includes(c.fragmentId));
    if (inContext.length) candidates = inContext;
    else if (options.strictFragment) {
      return { status: 'none', candidate: null, candidates: [], reason: 'other-fragment', others: candidates };
    }
  }
  if (candidates.length === 1) return { status: 'single', candidate: candidates[0], candidates };
  return { status: 'ambiguous', candidate: null, candidates };
};

/**
 * Подзаголовок объекта в меню «Выберите объект» (QA F69): копии участка в разных фрагментах
 * различаются фрагментом и id сети. Для MVT id объекта — исходный id тайла (`_sourceId`), а не
 * `id` нормализованного feature (там fileid). WMS/query-слои (`таблица.id`) — «Таблица: … • ID: …».
 */
export const describeMenuFeature = (feature: any): string[] => {
  const parts: string[] = [];
  const fragment = getFeatureFragmentId(feature);
  if (fragment) parts.push(`Фрагмент ${fragment}`);
  const raw = String(feature?._sourceId ?? feature?.id ?? '');
  const dot = raw.indexOf('.');
  const tableName = dot > 0 ? raw.slice(0, dot) : '';
  const id = toPositiveId(dot > 0 ? raw.slice(dot + 1) : raw);
  const kind = tableName ? null : getNetworkFeatureKind(feature);
  if (kind === 'line') {
    const lineId = getExplicitLineId(feature?.properties) ?? id;
    if (lineId) parts.push(`участок ${lineId}`);
  } else if (kind === 'node' && id) {
    parts.push(`узел ${id}`);
  } else {
    if (tableName) parts.push(`Таблица: ${tableName}`);
    if (id) parts.push(`ID: ${id}`);
  }
  return parts;
};
