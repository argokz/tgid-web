/**
 * Протокол расчёта: статус задачи Celery и итог расчёта sety.
 *
 * Celery SUCCESS означает только «задача отработала»: сам расчёт мог завершиться ошибкой
 * (result.status = error/partial). Поэтому в протокол пишется итог по result, а не сырой
 * статус Celery — иначе выходило «Статус: SUCCESS» и следом «Ошибка при выполнении расчёта».
 */

const TASK_STATE_LABELS: Record<string, string> = {
  PENDING: 'в очереди',
  RECEIVED: 'в очереди',
  STARTED: 'выполняется',
  PROGRESS: 'выполняется',
  RETRY: 'повтор',
  FAILURE: 'сбой задачи на сервере',
  REVOKED: 'отменена',
};

/** Подпись промежуточного статуса задачи; null — для SUCCESS (итог пишет calcOutcome). */
export function taskStateLabel(state: string): string | null {
  if (state === 'SUCCESS') return null;
  return TASK_STATE_LABELS[state] ?? state;
}

export interface CalcOutcome {
  label: string;
  type: 'success' | 'error' | 'info';
}

/** Итог расчёта по результату задачи (result.status: success / partial / error). */
export function calcOutcome(result: { status?: string } | null | undefined): CalcOutcome {
  const status = result?.status;
  if (status === 'success') return { label: 'Статус: расчёт выполнен', type: 'success' };
  if (status === 'partial') return { label: 'Статус: расчёт выполнен частично (есть ошибки)', type: 'error' };
  return { label: 'Статус: расчёт завершился ошибкой', type: 'error' };
}

// --- Разобранный протокол (API: /api/v1/calculations/protocols…, разбор — itwin-api utils/calc_protocol.py) ---

export type ProtocolSeverity = 'error' | 'warning';

/** Объект сообщения: узел, участок (linesobj.id) или участок/устройство между двумя узлами */
export type ProtocolObject =
  | { kind: 'node'; id: number; label: string; context?: boolean }
  | { kind: 'line'; id: number; label: string; context?: boolean }
  | { kind: 'line2'; id1: number; id2: number; label: string; context?: boolean };

/** Что открыть, чтобы исправить исходные данные */
export type ProtocolFix = 'calc_params' | 'fixed_head' | 'temp_graph' | 'rs' | 'object';

export interface ProtocolEntry {
  seq: number;
  severity: ProtocolSeverity;
  text: string;
  objects: ProtocolObject[];
  fragment_id: number | null;
  component: { index: number; total: number; object: ProtocolObject | null } | null;
  category: string;
  fix: ProtocolFix | null;
  count: number;
}

export interface ProtocolSummary {
  errors: number;
  warnings: number;
  by_category: Record<string, { error: number; warning: number }>;
  category_labels: Record<string, string>;
  header: string[];
  duration_s: number | null;
}

export interface CalcProtocolRecord {
  id: number;
  request_id: string;
  task_id: string | null;
  calculationid: number | null;
  fileid: number | null;
  fragment_name: string | null;
  created_at: string | null;
  author: string | null;
  mode: string | null;
  params: string | null;
  status: string;
  errors: number;
  warnings: number;
  summary?: ProtocolSummary;
  entries?: ProtocolEntry[];
  output?: string;
}

export interface GeoJsonGeometry {
  type: string;
  coordinates: any;
}

/** Ответ POST …/protocols/locate: геометрия WGS84 */
export interface ProtocolLocateResult {
  nodes: Record<string, { geometry: GeoJsonGeometry; shown_id: number }>;
  lines: Record<string, { geometry: GeoJsonGeometry; owner_id: number | null }>;
  pairs: Record<string, { line_id?: number; node_id?: number }>;
}

/** Куда перейти на карте: таблица карточки (nodes / heatpipesections), id объекта сети, геометрия */
export interface ProtocolTarget {
  table: 'nodes' | 'heatpipesections';
  id: number;
  geometry: GeoJsonGeometry;
  /**
   * Участок (linesobj) объекта сообщения. У участка внутренней схемы узла на карте показывается
   * узел-владелец (table 'nodes'), но регулятор/байпас/насос стоят именно на этом участке
   */
  lineId?: number;
}

export const FIX_LABELS: Record<ProtocolFix, string> = {
  calc_params: 'Параметры расчёта',
  fixed_head: 'Узел с заданным напором',
  temp_graph: 'Температурный график',
  rs: 'Расчётная схема',
  object: 'Карточка объекта',
};

export const FIX_HINTS: Record<ProtocolFix, string> = {
  calc_params: 'Открыть установки расчёта',
  fixed_head: 'Подсети нужен узел с заданным напором: открыть карточку её узла',
  temp_graph: 'Открыть журнал температурных графиков источника',
  rs: 'Открыть карточку узла расчётной схемы',
  object: 'Открыть карточку объекта',
};

export const objectKey = (o: ProtocolObject): string =>
  (o.kind === 'line2' ? `line2:${o.id1}-${o.id2}` : `${o.kind}:${o.id}`);

export interface ProtocolFilter {
  severity?: ProtocolSeverity | null;
  category?: string | null;
  query?: string;
}

/** Фильтр записей: важность, категория, текст (и подписи объектов) без учёта регистра */
export function filterEntries(entries: ProtocolEntry[], filter: ProtocolFilter): ProtocolEntry[] {
  const q = (filter.query || '').trim().toLowerCase();
  return entries.filter((e) => {
    if (filter.severity && e.severity !== filter.severity) return false;
    if (filter.category && e.category !== filter.category) return false;
    if (q) {
      const hay = `${e.text}\n${e.objects.map((o) => o.label).join('\n')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export interface CategoryChip {
  code: string;
  label: string;
  error: number;
  warning: number;
}

/** Категории для чипов: сначала с ошибками, затем по числу записей */
export function categoryChips(summary: ProtocolSummary | null | undefined): CategoryChip[] {
  if (!summary) return [];
  return Object.entries(summary.by_category || {})
    .map(([code, n]) => ({ code, label: summary.category_labels?.[code] || code, error: n.error, warning: n.warning }))
    .sort((a, b) => (b.error - a.error)
      || ((b.error + b.warning) - (a.error + a.warning))
      || a.label.localeCompare(b.label));
}

/** Сводка нескольких протоколов (расчёт по списку фрагментов) */
export function mergeSummaries(records: CalcProtocolRecord[]): ProtocolSummary {
  const out: ProtocolSummary = { errors: 0, warnings: 0, by_category: {}, category_labels: {}, header: [], duration_s: null };
  for (const r of records) {
    const s = r.summary;
    if (!s) continue;
    out.errors += s.errors;
    out.warnings += s.warnings;
    for (const [code, n] of Object.entries(s.by_category || {})) {
      const c = (out.by_category[code] ??= { error: 0, warning: 0 });
      c.error += n.error;
      c.warning += n.warning;
    }
    Object.assign(out.category_labels, s.category_labels || {});
    if (!out.header.length) out.header = s.header || [];
    if (s.duration_s != null) out.duration_s = (out.duration_s ?? 0) + s.duration_s;
  }
  return out;
}

/** Записи нескольких протоколов подряд; фрагмент — из протокола, если sety его не напечатал */
export function mergeEntries(records: CalcProtocolRecord[]): ProtocolEntry[] {
  const out: ProtocolEntry[] = [];
  for (const r of records) {
    for (const e of r.entries || []) {
      out.push({ ...e, fragment_id: e.fragment_id ?? r.fileid ?? null, seq: out.length + 1 });
    }
  }
  return out;
}

/** «Было N → стало M» после пересчёта; null — сравнивать не с чем */
export function compareSummaries(
  prev: { errors: number; warnings: number } | null | undefined,
  next: { errors: number; warnings: number },
): string | null {
  if (!prev) return null;
  const part = (label: string, a: number, b: number) => (a === b ? `${label} ${b} (без изменений)` : `${label} ${a} → ${b}`);
  return `${part('ошибки', prev.errors, next.errors)}, ${part('предупреждения', prev.warnings, next.warnings)}`;
}

/** Ключ pairs ответа locate для line2 с одинаковыми концами (= same_node_pair_key в itwin-api) */
export const sameNodePairKey = (nodeId: number, label: string): string => `${nodeId}-${nodeId}|${label}`;

/** Цель перехода для объекта сообщения по ответу locate; null — геометрии нет */
export function protocolTarget(o: ProtocolObject, located: ProtocolLocateResult | null | undefined): ProtocolTarget | null {
  if (!located) return null;
  const node = (id: number | undefined): ProtocolTarget | null => {
    const n = id != null ? located.nodes[String(id)] : undefined;
    return n ? { table: 'nodes', id: n.shown_id ?? id!, geometry: n.geometry } : null;
  };
  const line = (id: number | undefined): ProtocolTarget | null => {
    const l = id != null ? located.lines[String(id)] : undefined;
    if (!l) return null;
    // участок внутренней схемы узла — показываем узел-владелец
    return l.owner_id
      ? { table: 'nodes', id: l.owner_id, geometry: l.geometry, lineId: id! }
      : { table: 'heatpipesections', id: id!, geometry: l.geometry, lineId: id! };
  };
  if (o.kind === 'node') return node(o.id);
  if (o.kind === 'line') return line(o.id);
  if (o.id1 === o.id2) {
    // устройство внутренней схемы камеры: sety пишет оба конца узлом-владельцем, участок сервер нашёл по подписи
    const inner = located.pairs[sameNodePairKey(o.id1, o.label)];
    return inner?.line_id != null ? line(inner.line_id) : node(o.id1);
  }
  const pair = located.pairs[`${o.id1}-${o.id2}`];
  if (!pair) return null;
  return pair.line_id != null ? line(pair.line_id) : node(pair.node_id);
}

/** Объект для перехода по записи: первый собственный, иначе контекст (узел подсети) */
export function primaryObject(e: ProtocolEntry): ProtocolObject | null {
  return e.objects.find((o) => !o.context) ?? e.objects[0] ?? null;
}

/** Ссылка HTML-вывода sety (<a name='node' id=…>) → объект протокола */
export function objectFromAnchor(a: Element): ProtocolObject | null {
  const name = a.getAttribute('name');
  const label = (a.textContent || '').replace(/^\[|\]$/g, '');
  const int = (attr: string) => {
    const v = Number(a.getAttribute(attr));
    return Number.isInteger(v) && v > 0 ? v : null;
  };
  if (name === 'node' || name === 'line') {
    const id = int('id');
    return id ? { kind: name, id, label } : null;
  }
  if (name === 'line2') {
    const id1 = int('id1');
    const id2 = int('id2');
    return id1 && id2 ? { kind: 'line2', id1, id2, label } : null;
  }
  return null;
}

/** Центр и охват геометрии для перелёта: точка — центр, линия — bbox */
export function geometryView(g: GeoJsonGeometry | null | undefined):
  { center: [number, number]; bounds: [[number, number], [number, number]] | null } | null {
  const pts: Array<[number, number]> = [];
  const walk = (c: any) => {
    if (Array.isArray(c) && typeof c[0] === 'number') pts.push([c[0], c[1]]);
    else if (Array.isArray(c)) c.forEach(walk);
  };
  walk(g?.coordinates);
  if (!pts.length) return null;
  let [minX, minY] = pts[0];
  let [maxX, maxY] = pts[0];
  for (const [x, y] of pts) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return {
    center: [(minX + maxX) / 2, (minY + maxY) / 2],
    bounds: maxX > minX || maxY > minY ? [[minX, minY], [maxX, maxY]] : null,
  };
}

/** Журнал устройства на участке (ключ диалога инструментов MapViewer): там правятся его настройки */
export interface DeviceJournal {
  key: 'networkRegulator' | 'networkBypass' | 'pumpEquipment';
  label: string;
}

/**
 * Регулятор, байпас, насос — отдельный linesobj без карточки участка: исправляют в журнале,
 * отфильтрованном по линии. null — сообщение не про устройство.
 */
/**
 * Поле карточки регулятора (журнал регуляторов), которое исправляет сообщение протокола: подпись поля
 * в NetworkRegulatorJournalDialog. null — поле не определить (откроется список регуляторов участка)
 */
export function regulatorFixField(text: string): string | null {
  if (/не может обеспечить|Задано\s+[\d.]+/i.test(text)) return 'Заданная величина';
  if (/протечк|утечк|макс\.?\s*сопр/i.test(text)) return 'Относительная утечка';
  if (/узел с регулируем/i.test(text)) return 'Регулируемый узел';
  if (/реверс|направлени/i.test(text)) return 'Начальный узел';
  return null;
}

export function deviceJournal(e: Pick<ProtocolEntry, 'category' | 'text'>): DeviceJournal | null {
  if (e.category === 'regulator') {
    return /байпас/i.test(e.text)
      ? { key: 'networkBypass', label: 'Журнал байпасов' }
      : { key: 'networkRegulator', label: 'Журнал регуляторов' };
  }
  if (e.category === 'pump') return { key: 'pumpEquipment', label: 'Насосное оборудование' };
  return null;
}
