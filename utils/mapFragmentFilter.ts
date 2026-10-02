/**
 * Фильтр фрагмента для MVT-слоёв (QA F23).
 *
 * Раньше к исходному фильтру MBStyle всегда приклеивался фильтр в старом (legacy) синтаксисе
 * ["in", "fileID", ...]. Если исходный фильтр слоя записан выражением (например, у зданий
 * zdaniya_2), смесь ["all", <выражение>, <legacy>] MapLibre отвергает как невалидную.
 * Теперь синтаксис фильтра фрагмента подбирается под исходный фильтр слоя.
 */

export const FILE_ID_PROPERTIES = ['fileID', 'fileid', 'fileId', 'FILEID', 'FileId', 'file_id', 'FILE_ID'];

/** Порт isExpressionFilter из @maplibre/maplibre-gl-style-spec (прямой зависимости на него нет) */
export function isExpressionFilter(filter: unknown): boolean {
  if (filter === true || filter === false) return true;
  if (!Array.isArray(filter) || filter.length === 0) return false;
  switch (filter[0]) {
    case 'has':
      return filter.length >= 2 && filter[1] !== '$id' && filter[1] !== '$type';
    case 'in':
      return filter.length >= 3 && (typeof filter[1] !== 'string' || Array.isArray(filter[2]));
    case '!in':
    case '!has':
    case 'none':
      return false;
    case '==':
    case '!=':
    case '>':
    case '>=':
    case '<':
    case '<=':
      return filter.length !== 3 || Array.isArray(filter[1]) || Array.isArray(filter[2]);
    case 'any':
    case 'all':
      return filter.slice(1).every((f) => typeof f === 'boolean' || isExpressionFilter(f));
    default:
      return true;
  }
}

/** Фильтр «объект в одном из фрагментов»: legacy или выражение; null — фрагменты не выбраны */
export function fragmentFilterFor(ids: Array<number | string>, expression: boolean): any[] | null {
  if (!ids.length) return null;
  if (expression) {
    const strIds = [...new Set(ids.map((id) => String(id)))];
    return ['any', ...FILE_ID_PROPERTIES.map((p) => ['in', ['to-string', ['get', p]], ['literal', strIds]])];
  }
  const allIds = [...new Set([...ids.map((id) => Number(id)), ...ids.map((id) => String(id))])];
  return ['any', ...FILE_ID_PROPERTIES.map((p) => ['in', p, ...allIds])];
}

/** Итоговый фильтр подслоя: исходный фильтр MBStyle + фильтр фрагмента в том же синтаксисе */
export function combineWithFragmentFilter(original: unknown, ids: Array<number | string>): any {
  const expression = original != null && isExpressionFilter(original);
  const fragment = fragmentFilterFor(ids, expression);
  if (!fragment) return original ?? null;
  return original != null ? ['all', original, fragment] : fragment;
}
