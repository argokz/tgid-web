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
  if (!keyTable) return merged;
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
