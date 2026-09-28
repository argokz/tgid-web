import { describe, expect, it } from 'vitest';
import {
  cleanMapping,
  crsOptionsFor,
  defaultCrsFor,
  describeImportAction,
  importApiError,
  importSummary,
  missingRequired,
  type NetworkImportInspect,
  type NetworkImportReport,
} from '~/utils/networkImport';

const inspect = (over: Partial<NetworkImportInspect>): NetworkImportInspect => ({
  kind: 'table',
  columns: [],
  row_count: 0,
  sample: [],
  geometry_type: null,
  crs: null,
  crs_known: false,
  sheet: null,
  sheets: [],
  warnings: [],
  targets: [],
  suggested_mapping: {},
  ...over,
});

const report = (over: Partial<NetworkImportReport>): NetworkImportReport => ({
  mode: 'nodes',
  dry_run: true,
  total_rows: 3,
  ok_rows: 2,
  fileid: 72,
  created_nodes: 0,
  created_lines: 0,
  updated_nodes: 0,
  recalculated_lines: 0,
  built_lines: 0,
  errors: [],
  actions: [],
  actions_truncated: false,
  warnings: [],
  ...over,
});

describe('network import helpers', () => {
  it('offers only file CRS for SHP with .prj and explicit CRS for tables', () => {
    expect(crsOptionsFor(inspect({ kind: 'shp', crs_known: true })).map((o) => o.value)).toEqual(['auto']);
    expect(crsOptionsFor(inspect({ kind: 'shp', crs_known: false })).map((o) => o.value)).toEqual(['wgs84', 'local']);
    expect(crsOptionsFor(inspect({ kind: 'table' })).map((o) => o.value)).toEqual(['wgs84', 'local', 'desktop']);
    expect(defaultCrsFor(inspect({ kind: 'shp', crs_known: true }))).toBe('auto');
    expect(defaultCrsFor(inspect({ kind: 'table' }))).toBe('local');
  });

  it('drops empty mappings and lists missing required fields', () => {
    expect(cleanMapping({ x: 'X', y: '', code: null, name: undefined })).toEqual({ x: 'X' });
    const targets = [
      { key: 'x', label: 'X', required: true },
      { key: 'code', label: 'Код', required: false },
    ];
    expect(missingRequired(targets, { code: 'K' })).toEqual(['X']);
  });

  it('summarizes dry-run and applied reports', () => {
    expect(importSummary(report({ created_nodes: 2, errors: [{ row: 4, message: 'x' }] }))).toBe(
      'Будет: узлов создано: 2, строк с ошибками: 1 (строк: 3)',
    );
    expect(importSummary(report({ dry_run: false, updated_nodes: 1, recalculated_lines: 2 }))).toBe(
      'Готово: узлов перенесено: 1, длин пересчитано: 2 (строк: 3)',
    );
  });

  it('describes actions', () => {
    expect(
      describeImportAction({ row: 1, action: 'create_line', id: 9, nodeid1: 1, nodeid2: 2, length: 39.8, new_nodes: [2] }),
    ).toBe('новый участок 9: 1 → 2, 39.8 м, новые узлы 2');
    expect(describeImportAction({ row: 2, action: 'move_node', id: 5, shift_m: 7, recalculated_lines: 2 })).toBe(
      'перенос узла 5: сдвиг 7 м, длин пересчитано 2',
    );
    expect(describeImportAction({ row: 3, action: 'create_node', id: 6, code: 'A' })).toBe('новый узел 6 (код A)');
  });

  it('extracts row-error report from 422', () => {
    const rep = report({ errors: [{ row: 2, message: 'нет координат' }] });
    const res = importApiError({ data: { detail: { code: 'row_errors', message: 'm', report: rep } } });
    expect(res.report).toBe(rep);
    expect(importApiError({ data: { detail: 'Фрагмент 5 не найден' } }).message).toBe('Фрагмент 5 не найден');
  });
});
