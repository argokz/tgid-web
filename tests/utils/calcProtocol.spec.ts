import { describe, expect, it } from 'vitest';
import {
  calcOutcome,
  taskStateLabel,
  categoryChips,
  compareSummaries,
  filterEntries,
  geometryView,
  mergeEntries,
  mergeSummaries,
  objectFromAnchor,
  primaryObject,
  protocolTarget,
  type CalcProtocolRecord,
  type ProtocolEntry,
  type ProtocolLocateResult,
} from '~/utils/calcProtocol';

describe('calcProtocol (QA F30)', () => {
  it('SUCCESS задачи не печатается как статус расчёта', () => {
    expect(taskStateLabel('SUCCESS')).toBeNull();
    expect(taskStateLabel('PENDING')).toBe('в очереди');
    expect(taskStateLabel('PROGRESS')).toBe('выполняется');
    expect(taskStateLabel('WEIRD')).toBe('WEIRD');
  });

  it('итог берётся из result.status, а не из статуса Celery', () => {
    expect(calcOutcome({ status: 'success' }).type).toBe('success');
    expect(calcOutcome({ status: 'error' })).toEqual({ label: 'Статус: расчёт завершился ошибкой', type: 'error' });
    expect(calcOutcome({ status: 'partial' }).type).toBe('error');
    expect(calcOutcome(undefined).type).toBe('error');
  });
});


const entry = (over: Partial<ProtocolEntry>): ProtocolEntry => ({
  seq: 1, severity: 'warning', text: '', objects: [], fragment_id: null, component: null,
  category: 'other', fix: null, count: 1, ...over,
});

const pt = { type: 'Point', coordinates: [76.9, 43.2] };
const ln = { type: 'LineString', coordinates: [[76.9, 43.2], [77.0, 43.3]] };
const located: ProtocolLocateResult = {
  nodes: { 5: { geometry: pt, shown_id: 100 }, 7: { geometry: pt, shown_id: 7 }, 3: { geometry: pt, shown_id: 3 } },
  lines: { 900: { geometry: ln, owner_id: null }, 901: { geometry: pt, owner_id: 50 } },
  pairs: { '1-2': { line_id: 900 }, '3-4': { node_id: 3 } },
};

describe('разобранный протокол расчёта', () => {
  it('фильтр по важности, категории и тексту (включая подписи объектов)', () => {
    const list = [
      entry({ seq: 1, severity: 'error', category: 'pump', text: 'Насос не обеспечивает' }),
      entry({ seq: 2, category: 'regulator', text: 'Регулятор', objects: [{ kind: 'node', id: 1, label: 'ТК-15' }] }),
    ];
    expect(filterEntries(list, { severity: 'error' }).map((e) => e.seq)).toEqual([1]);
    expect(filterEntries(list, { category: 'regulator' }).map((e) => e.seq)).toEqual([2]);
    expect(filterEntries(list, { query: 'тк-15' }).map((e) => e.seq)).toEqual([2]);
    expect(filterEntries(list, {})).toHaveLength(2);
  });

  it('сводка и записи нескольких фрагментов; чипы — сначала с ошибками', () => {
    const rec = (id: number, fileid: number, s: any, entries: ProtocolEntry[]): CalcProtocolRecord => ({
      id, request_id: 'r', task_id: null, calculationid: null, fileid, fragment_name: null, created_at: null,
      author: null, mode: 'plan', params: null, status: 'success', errors: s.errors, warnings: s.warnings,
      summary: s, entries,
    });
    const s1 = { errors: 0, warnings: 3, by_category: { regulator: { error: 0, warning: 3 } }, category_labels: { regulator: 'Регуляторы' }, header: ['БД'], duration_s: 1 };
    const s2 = { errors: 1, warnings: 0, by_category: { rs: { error: 1, warning: 0 } }, category_labels: { rs: 'РС' }, header: [], duration_s: 2 };
    const records = [rec(1, 74, s1, [entry({})]), rec(2, 41, s2, [entry({ fragment_id: 99 })])];
    const sum = mergeSummaries(records);
    expect([sum.errors, sum.warnings, sum.duration_s]).toEqual([1, 3, 3]);
    expect(categoryChips(sum).map((c) => c.code)).toEqual(['rs', 'regulator']);
    const merged = mergeEntries(records);
    expect(merged.map((e) => [e.seq, e.fragment_id])).toEqual([[1, 74], [2, 99]]);
  });

  it('сравнение до/после пересчёта', () => {
    expect(compareSummaries(null, { errors: 1, warnings: 0 })).toBeNull();
    expect(compareSummaries({ errors: 3, warnings: 2 }, { errors: 1, warnings: 2 }))
      .toBe('ошибки 3 → 1, предупреждения 2 (без изменений)');
  });

  it('цель перехода: узел-владелец, участок пары, внутренний участок — узел', () => {
    expect(protocolTarget({ kind: 'node', id: 5, label: '' }, located)).toMatchObject({ table: 'nodes', id: 100 });
    expect(protocolTarget({ kind: 'line2', id1: 1, id2: 2, label: '' }, located)).toMatchObject({ table: 'heatpipesections', id: 900 });
    expect(protocolTarget({ kind: 'line2', id1: 7, id2: 7, label: '' }, located)).toMatchObject({ table: 'nodes', id: 7 });
    expect(protocolTarget({ kind: 'line2', id1: 3, id2: 4, label: '' }, located)).toMatchObject({ table: 'nodes', id: 3 });
    expect(protocolTarget({ kind: 'line', id: 901, label: '' }, located)).toMatchObject({ table: 'nodes', id: 50 });
    expect(protocolTarget({ kind: 'node', id: 404, label: '' }, located)).toBeNull();
    expect(protocolTarget({ kind: 'node', id: 5, label: '' }, null)).toBeNull();
  });

  it('основной объект — не контекстный', () => {
    const e = entry({ objects: [{ kind: 'node', id: 1, label: 'a', context: true }, { kind: 'node', id: 2, label: 'b' }] });
    expect(primaryObject(e)).toMatchObject({ id: 2 });
    expect(primaryObject(entry({}))).toBeNull();
  });

  it('ссылки HTML-вывода sety', () => {
    const div = document.createElement('div');
    div.innerHTML = "<a name='line2' id1='10' id2='11' href='x'>[ТК1 - ТК2]</a><a name='node' id='-1'>[?]</a>";
    const [a, b] = Array.from(div.querySelectorAll('a'));
    expect(objectFromAnchor(a)).toEqual({ kind: 'line2', id1: 10, id2: 11, label: 'ТК1 - ТК2' });
    expect(objectFromAnchor(b)).toBeNull();
  });

  it('вид геометрии: точка — центр, линия — охват', () => {
    expect(geometryView(pt)).toEqual({ center: [76.9, 43.2], bounds: null });
    expect(geometryView(ln)?.bounds).toEqual([[76.9, 43.2], [77.0, 43.3]]);
    expect(geometryView({ type: 'Point', coordinates: [] })).toBeNull();
  });
});
