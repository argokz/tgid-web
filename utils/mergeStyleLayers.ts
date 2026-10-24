/**
 * Объединение линейных подслоёв MBStyle с одинаковой геометрией оформления в один слой с выражениями.
 *
 * Стиль участков из GeoServer — 16 слоёв-копий (подача/обратка × магистраль/распределительная ×
 * надземная × закрытая), которые различаются только фильтром, цветом, шириной, смещением и прозрачностью.
 * Каждый слой MapLibre — отдельный проход отрисовки по всем тайлам и отдельный `setFilter` при смене
 * фрагмента (замер S1/S8, docs/performance-baseline.md). Здесь слои с одинаковыми `type`, `source-layer`,
 * `minzoom`/`maxzoom`, `layout` и не data-driven paint-свойствами (`line-dasharray`, `line-pattern`) сливаются:
 * фильтр — `["any", …]`, paint — `["case", f1, v1, …]`, зависимость от зума — `["interpolate", …, ["zoom"], z, ["case", …]]`
 * (MapLibre разрешает `zoom` только на верхнем уровне interpolate/step).
 *
 * Что не сливается (остаётся как есть): не-линии, слои без фильтра, legacy-фильтры с неизвестными операторами,
 * paint в виде выражений (кроме полностью одинаковых), функции stops с `base`, цвет через stops.
 * Сливаются только слои с доказуемо непересекающимися фильтрами (одно свойство — разные значения): участок
 * с pod=1 и obr=1 исходный стиль рисует дважды (подача и обратка со смещением в разные стороны), и в один
 * слой их класть нельзя. Объединённый слой встаёт на место первого из группы.
 */

export interface StyleLayerLike {
  id: string;
  type: string;
  filter?: unknown;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  minzoom?: number;
  maxzoom?: number;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Paint-свойства линий, которые MapLibre не умеет считать по объекту — по ним слои нельзя сливать */
const LINE_NON_DATA_DRIVEN = ['line-dasharray', 'line-pattern', 'line-gradient', 'line-translate', 'line-translate-anchor'];

/** Значения по умолчанию для отсутствующих у части слоёв paint-свойств (спецификация стиля) */
const LINE_PAINT_DEFAULTS: Record<string, number> = {
  'line-opacity': 1,
  'line-width': 1,
  'line-offset': 0,
  'line-gap-width': 0,
  'line-blur': 0,
};

/** Цвет нельзя интерполировать между классами через case внутри interpolate — не сливаем, если он зависит от зума */
const COLOR_KEYS = new Set(['line-color']);

type LegacyStops = { stops: Array<[number, number]>; base?: number };

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isStopsFunction = (v: unknown): v is LegacyStops =>
  isPlainObject(v) && Array.isArray((v as LegacyStops).stops) && (v as LegacyStops).stops.length > 0
  && (v as LegacyStops).stops.every((s) => Array.isArray(s) && s.length === 2 && typeof s[0] === 'number' && typeof s[1] === 'number');

const stableKey = (v: unknown): string => JSON.stringify(v ?? null);

/** Legacy-фильтр MapLibre → выражение; null, если оператор неизвестен */
export function legacyFilterToExpression(filter: unknown): unknown[] | null {
  if (filter === true) return ['literal', true];
  if (filter === false) return ['literal', false];
  if (!Array.isArray(filter) || !filter.length) return null;
  const [op, ...rest] = filter as unknown[];
  const prop = (key: unknown): unknown[] | null => {
    if (typeof key !== 'string') return null;
    if (key === '$type') return ['geometry-type'];
    if (key === '$id') return ['id'];
    return ['get', key];
  };
  switch (op) {
    case 'all':
    case 'any': {
      const parts = rest.map((f) => (isExpressionFilterLike(f) ? f : legacyFilterToExpression(f)));
      if (parts.some((p) => p == null)) return null;
      return [op, ...(parts as unknown[])];
    }
    case 'none': {
      const parts = rest.map((f) => (isExpressionFilterLike(f) ? f : legacyFilterToExpression(f)));
      if (parts.some((p) => p == null)) return null;
      return ['all', ...parts.map((p) => ['!', p])];
    }
    case '==':
    case '!=':
    case '<':
    case '<=':
    case '>':
    case '>=': {
      if (rest.length !== 2) return null;
      const key = prop(rest[0]);
      if (!key) return null;
      // в legacy-синтаксисе сравнение с отсутствующим свойством даёт false, в выражениях `==` с null — тоже false,
      // а `<`/`>` с null бросают ошибку типов — защищаем coalesce'ом на тип значения
      const value = rest[1];
      if (op === '==' || op === '!=') return [op, key, value];
      if (String(rest[0]).startsWith('$')) return null;
      const typed = typeof value === 'number' ? ['to-number', key] : ['to-string', key];
      return ['all', ['has', String(rest[0])], [op, typed, value]];
    }
    case 'in':
    case '!in': {
      if (rest.length < 1) return null;
      const key = prop(rest[0]);
      if (!key) return null;
      const values = rest.slice(1);
      const inExpr = ['in', key, ['literal', values]];
      return op === 'in' ? inExpr : ['!', inExpr];
    }
    case 'has':
    case '!has': {
      if (rest.length !== 1 || typeof rest[0] !== 'string') return null;
      const hasExpr = ['has', rest[0]];
      return op === 'has' ? hasExpr : ['!', hasExpr];
    }
    default:
      return null;
  }
}

/** Фильтр уже в синтаксисе выражений (порт isExpressionFilter из style-spec, укороченный) */
export function isExpressionFilterLike(filter: unknown): boolean {
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
      return filter.slice(1).every((f: unknown) => typeof f === 'boolean' || isExpressionFilterLike(f));
    default:
      return true;
  }
}

const toExpressionFilter = (filter: unknown): unknown[] | null => {
  if (filter == null) return null;
  if (isExpressionFilterLike(filter)) return filter === true ? ['literal', true] : filter === false ? ['literal', false] : (filter as unknown[]);
  return legacyFilterToExpression(filter);
};

/** Значение функции stops (линейной) на зуме z: за пределами — крайние значения */
export function stopsValueAt(fn: LegacyStops, z: number): number {
  const stops = fn.stops;
  if (z <= stops[0][0]) return stops[0][1];
  const last = stops[stops.length - 1];
  if (z >= last[0]) return last[1];
  for (let i = 1; i < stops.length; i += 1) {
    const [z0, v0] = stops[i - 1];
    const [z1, v1] = stops[i];
    if (z <= z1) {
      const t = z1 === z0 ? 1 : (z - z0) / (z1 - z0);
      return v0 + (v1 - v0) * t;
    }
  }
  return last[1];
}

const round = (v: number): number => Math.round(v * 1000) / 1000;

/** Ключ группы: всё, что должно совпадать у сливаемых слоёв */
function groupKey(layer: StyleLayerLike): string | null {
  if (layer.type !== 'line' || layer.filter == null) return null;
  const paint = layer.paint || {};
  for (const key of Object.keys(paint)) {
    if (!key.startsWith('line-')) return null;
  }
  const fixed: Record<string, unknown> = {};
  for (const key of LINE_NON_DATA_DRIVEN) if (key in paint) fixed[key] = paint[key];
  const { id: _id, filter: _filter, paint: _paint, metadata: _metadata, ...rest } = layer;
  return stableKey({ rest, fixed });
}

/** Объединить paint-свойство по классам; null — слить нельзя */
function mergePaintProperty(
  key: string,
  values: unknown[],
  filters: unknown[][],
): unknown | null {
  const first = values[0];
  if (values.every((v) => stableKey(v) === stableKey(first))) return first;
  const normalized = values.map((v) => (v === undefined ? LINE_PAINT_DEFAULTS[key] : v));
  if (normalized.some((v) => v === undefined)) return null;
  const allConst = normalized.every((v) => typeof v === 'number' || typeof v === 'string');
  if (allConst) {
    const out: unknown[] = ['case'];
    for (let i = 0; i < normalized.length - 1; i += 1) out.push(filters[i], normalized[i]);
    out.push(normalized[normalized.length - 1]);
    return out;
  }
  if (COLOR_KEYS.has(key)) return null;
  if (!normalized.every((v) => typeof v === 'number' || (isStopsFunction(v) && (v.base == null || v.base === 1)))) return null;
  const zooms = [...new Set(normalized.flatMap((v) => (isStopsFunction(v) ? v.stops.map((s) => s[0]) : [])))].sort((a, b) => a - b);
  const valueAt = (v: unknown, z: number): number => (typeof v === 'number' ? v : stopsValueAt(v as LegacyStops, z));
  const out: unknown[] = ['interpolate', ['linear'], ['zoom']];
  for (const z of zooms) {
    const caseExpr: unknown[] = ['case'];
    for (let i = 0; i < normalized.length - 1; i += 1) caseExpr.push(filters[i], round(valueAt(normalized[i], z)));
    caseExpr.push(round(valueAt(normalized[normalized.length - 1], z)));
    out.push(z, caseExpr);
  }
  return out;
}

/**
 * Ограничения равенства из фильтра: свойство → допустимые значения (строками). `all` пересекает множества,
 * `any` объединяет (только если все ветви про одно свойство). Остальные операторы не дают ограничений.
 */
export function equalityConstraints(filter: unknown): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  if (!Array.isArray(filter) || !filter.length) return out;
  const [op, ...rest] = filter as unknown[];
  const propName = (key: unknown): string | null => {
    if (typeof key === 'string') return key;
    if (Array.isArray(key) && key[0] === 'get' && typeof key[1] === 'string') return key[1];
    return null;
  };
  if (op === '==' && rest.length === 2) {
    const name = propName(rest[0]);
    if (name && (typeof rest[1] === 'string' || typeof rest[1] === 'number' || typeof rest[1] === 'boolean')) {
      out.set(name, new Set([String(rest[1])]));
    }
    return out;
  }
  if (op === 'all') {
    for (const part of rest) {
      for (const [name, values] of equalityConstraints(part)) {
        const prev = out.get(name);
        out.set(name, prev ? new Set([...prev].filter((v) => values.has(v))) : values);
      }
    }
    return out;
  }
  if (op === 'any') {
    const parts = rest.map(equalityConstraints);
    if (!parts.length || parts.some((p) => p.size !== 1)) return out;
    const names = new Set(parts.map((p) => [...p.keys()][0]));
    if (names.size !== 1) return out;
    const name = [...names][0];
    out.set(name, new Set(parts.flatMap((p) => [...p.get(name)!])));
  }
  return out;
}

/** Доказуемо непересекающиеся фильтры: есть свойство, у которого допустимые значения не пересекаются */
export function filtersDisjoint(a: unknown, b: unknown): boolean {
  const ca = equalityConstraints(a);
  const cb = equalityConstraints(b);
  for (const [name, va] of ca) {
    const vb = cb.get(name);
    if (!vb) continue;
    if (![...va].some((v) => vb.has(v))) return true;
  }
  return false;
}

/**
 * Разбить слои на подгруппы попарно непересекающихся фильтров (жадно, порядок сохраняется).
 * Иначе объект, подходящий под два слоя (участок с pod=1 и obr=1 рисуется и как подача, и как обратка),
 * после слияния был бы нарисован один раз — первой ветвью case.
 */
function splitDisjoint(layers: StyleLayerLike[]): StyleLayerLike[][] {
  const groups: StyleLayerLike[][] = [];
  for (const layer of layers) {
    const fits = groups.find((g) => g.every((other) => filtersDisjoint(other.filter, layer.filter)));
    if (fits) fits.push(layer);
    else groups.push([layer]);
  }
  return groups;
}

function mergeGroup(layers: StyleLayerLike[]): StyleLayerLike | null {
  const filters = layers.map((l) => toExpressionFilter(l.filter));
  if (filters.some((f) => f == null)) return null;
  const exprFilters = filters as unknown[][];
  const paintKeys = [...new Set(layers.flatMap((l) => Object.keys(l.paint || {})))];
  const paint: Record<string, unknown> = {};
  for (const key of paintKeys) {
    const merged = mergePaintProperty(key, layers.map((l) => l.paint?.[key]), exprFilters);
    if (merged == null) return null;
    paint[key] = merged;
  }
  const [first, ...others] = layers;
  return {
    ...first,
    id: `${first.id} +${others.length}`,
    filter: ['any', ...exprFilters],
    paint,
    metadata: { ...(first.metadata || {}), mergedFrom: layers.map((l) => l.id) },
  };
}

/**
 * Слить одинаково оформленные линейные подслои. Порядок остальных слоёв сохраняется; объединённый слой
 * занимает место первого из своей группы.
 */
export function mergeLineLayers(layers: StyleLayerLike[]): StyleLayerLike[] {
  const groups = new Map<string, number[]>();
  layers.forEach((layer, index) => {
    const key = groupKey(layer);
    if (!key) return;
    const list = groups.get(key) || [];
    list.push(index);
    groups.set(key, list);
  });
  const replacement = new Map<number, StyleLayerLike>();
  const dropped = new Set<number>();
  const indexOf = new Map(layers.map((l, i) => [l, i]));
  for (const indexes of groups.values()) {
    if (indexes.length < 2) continue;
    for (const part of splitDisjoint(indexes.map((i) => layers[i]))) {
      if (part.length < 2) continue;
      const merged = mergeGroup(part);
      if (!merged) continue;
      const partIndexes = part.map((l) => indexOf.get(l)!);
      replacement.set(partIndexes[0], merged);
      partIndexes.slice(1).forEach((i) => dropped.add(i));
    }
  }
  return layers.flatMap((layer, index) => {
    if (dropped.has(index)) return [];
    return [replacement.get(index) || layer];
  });
}
