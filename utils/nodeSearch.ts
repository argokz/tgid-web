/**
 * Поиск узлов через WFS GeoServer (представления `find_node` и `id_nodes` схемы города) и подписи
 * результатов. Общее для окна «Поиск узлов» (`NodeSearch.vue`) и палитры команд (`CommandPalette.vue`).
 */

export type NodeRecord = Record<string, unknown> & { id?: number | string | null };

export interface GeoJsonGeometry {
  type: string;
  coordinates: unknown;
}

const wfsBase = (baseUrl: string, workspace: string) =>
  `${baseUrl.replace(/\/$/, '')}/${workspace}/ows?service=WFS&version=1.1.0&request=GetFeature&outputFormat=application/json`;

/** URL поиска узлов по тексту (viewparams `text:`) */
export const findNodesUrl = (baseUrl: string, workspace: string, text: string): string =>
  `${wfsBase(baseUrl, workspace)}&typeName=${workspace}:find_node&viewparams=${encodeURIComponent(`text:${text.trim()}`)}`;

/** URL геометрии узла по id */
export const nodeGeometryUrl = (baseUrl: string, workspace: string, id: number | string): string =>
  `${wfsBase(baseUrl, workspace)}&typeName=${workspace}:id_nodes&viewparams=id:${encodeURIComponent(String(id))}`;

/** Непустая строка после trim (пробелы и пустые значения не считаем) */
export const meaningfulStr = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
};

/** Первое непустое значение по списку ключей (WFS часто отдаёт русские имена полей) */
export const pickProp = (node: Record<string, unknown>, ...keys: string[]): string | null => {
  for (const k of keys) {
    const m = meaningfulStr(node[k]);
    if (m) return m;
  }
  return null;
};

export const getNodeType = (node: NodeRecord) => pickProp(node, 'Тип', 'tip', 'type', 'node_type');
export const getNodeRsCode = (node: NodeRecord) => pickProp(node, 'Код РС', 'Kod_RS', 'kod_rs', 'rs_code');
export const getNodeFragment = (node: NodeRecord) => pickProp(node, 'Фрагмент', 'fragment', 'Fragment');

export const getNodeTitle = (node: NodeRecord): string =>
  pickProp(node, 'Наименование узла', 'naimenovanie_uzla', 'naimenovanie', 'name', 'Наименование')
  || pickProp(node, 'adres', 'Адрес')
  || (meaningfulStr(node.nomer) ? `Узел № ${node.nomer}` : null)
  || (meaningfulStr(node.number) ? `Узел № ${node.number}` : null)
  || (node.id != null ? `Узел #${node.id}` : 'Узел');

const SUBTITLE_USED = new Set([
  'id', 'Тип', 'Код РС', 'Фрагмент', 'Наименование узла', 'Наименование', 'Описание', 'Код',
  'Признак', 'naimenovanie', 'naimenovanie_uzla', 'name', 'adres', 'nomer', 'number', 'tip', 'type',
]);

export const getNodeSubtitle = (node: NodeRecord): string | null => {
  const opis = pickProp(node, 'Описание', 'description', 'opisanie');
  const kod = pickProp(node, 'Код', 'kod', 'code');
  const priznak = pickProp(node, 'Признак', 'priznak');
  const parts: string[] = [];
  if (node.id != null) parts.push(`id: ${node.id}`);
  if (kod) parts.push(`Код: ${kod}`);
  if (opis) parts.push(opis);
  if (priznak) parts.push(`Признак: ${priznak}`);
  if (parts.length) return parts.join(' · ');
  const keys = Object.keys(node).filter((k) => !SUBTITLE_USED.has(k) && meaningfulStr(node[k]));
  if (keys.length > 0) return `${keys[0]}: ${meaningfulStr(node[keys[0]])}`;
  return null;
};

/** Центр геометрии для перелёта: точка, середина линии, среднее кольца полигона */
export const geometryCenter = (geometry: GeoJsonGeometry | null | undefined): [number, number] | null => {
  if (!geometry) return null;
  const pair = (c: unknown): [number, number] | null =>
    Array.isArray(c) && c.length >= 2 && Number.isFinite(Number(c[0])) && Number.isFinite(Number(c[1]))
      ? [Number(c[0]), Number(c[1])]
      : null;
  if (geometry.type === 'Point') return pair(geometry.coordinates);
  if (geometry.type === 'LineString') {
    const coords = geometry.coordinates as unknown[];
    return coords.length ? pair(coords[Math.floor(coords.length / 2)]) : null;
  }
  if (geometry.type === 'Polygon') {
    const ring = ((geometry.coordinates as unknown[])[0] ?? []) as unknown[];
    const pts = ring.map(pair).filter((p): p is [number, number] => p !== null);
    if (!pts.length) return null;
    return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
  }
  return null;
};
