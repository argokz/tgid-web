import { describe, expect, it } from 'vitest';
import type { JournalSchema } from '~/services/journalWriteService';
import {
  describeRejection,
  formatJournalError,
  missingRequired,
  normalizeFieldValue,
  parseLineIds,
  writableChanges,
  writableValues,
} from '~/utils/journalWrite';
import { useJournalMapBridge } from '~/composables/useJournalMapBridge';

const schema: JournalSchema = {
  key: 'repairs',
  title: 'Контур ремонта',
  fields: {
    name: { kind: 'str', label: 'Наименование/адрес', ref: null },
    planned_start: { kind: 'date', label: 'Начало по плану', ref: null },
    planned_budget: { kind: 'float', label: 'Средства, план', ref: null },
    state_id: { kind: 'int', label: 'Состояние', ref: 'stateremont2' },
  },
  required_on_create: ['name'],
  unique_fields: ['name'],
  create_modes: ['current', 'plan'],
  has_contour: true,
  has_documents: true,
  has_point_geometry: false,
  approval: {
    signers: { approver_name: { kind: 'str', label: 'ФИО утверждающего', ref: null } },
    required_fields: ['name'],
    require_contour: true,
    sets_state: 2,
  },
};

describe('journal write helpers', () => {
  it('normalizes values by field kind', () => {
    expect(normalizeFieldValue(schema.fields.planned_start, '2026-05-01T00:00:00')).toBe('2026-05-01');
    expect(normalizeFieldValue(schema.fields.planned_budget, '12,5')).toBe(12.5);
    expect(normalizeFieldValue(schema.fields.name, '   ')).toBeNull();
    expect(normalizeFieldValue(schema.fields.state_id, 2)).toBe(2);
  });

  it('sends only writable filled fields on create', () => {
    const values = writableValues(schema, {
      name: 'Контур', planned_budget: '100', approval_name: 'Утверждено', state_name: 'План', planned_start: '',
    });
    expect(values).toEqual({ name: 'Контур', planned_budget: 100 });
  });

  it('diffs only changed writable fields, clearing as null', () => {
    const original = { id: 1, name: 'Контур', planned_start: '2026-05-01', planned_budget: 100, state_name: 'План' };
    const edited = { ...original, planned_start: '2026-05-01T00:00:00', planned_budget: '', state_name: 'Иное', name: 'Контур 2' };
    expect(writableChanges(schema, original, edited)).toEqual({ name: 'Контур 2', planned_budget: null });
  });

  it('reports missing required fields by label', () => {
    expect(missingRequired(schema, { name: ' ' })).toEqual(['Наименование/адрес']);
    expect(missingRequired(schema, { name: 'x' })).toEqual([]);
  });

  it('parses line ids from free text', () => {
    expect(parseLineIds('452, 453 365978;452 x -1 0')).toEqual([452, 453, 365978]);
    expect(parseLineIds('')).toEqual([]);
  });

  it('formats server 422/409 details with field labels', () => {
    const apiError = { status: 422, data: { message: 'Запись не прошла проверку', field_errors: { planned_start: 'ожидается дата' } } };
    expect(formatJournalError(apiError, schema)).toBe('Запись не прошла проверку — Начало по плану: ожидается дата');
    const contourError = { data: { detail: { message: 'Участки нельзя включить в контур', missing_lines: [7], removed_lines: [] } } };
    expect(formatJournalError(contourError, schema)).toContain('нет в сети: 7');
    const approveError = { data: { message: 'План не утверждён', reason: { message: 'не заполнены поля плана', labels: ['Категория'] } } };
    expect(formatJournalError(approveError, schema)).toBe('План не утверждён — не заполнены поля плана — Категория');
    expect(formatJournalError({ userMessage: 'Недостаточно прав для этой операции.' }, schema)).toBe('Недостаточно прав для этой операции.');
    expect(describeRejection({ message: 'не заполнены поля плана', labels: ['Категория'] })).toBe('не заполнены поля плана: Категория');
    expect(describeRejection('уже утверждено')).toBe('уже утверждено');
  });
});

describe('journal map bridge', () => {
  it('collects picked lines and resolves on finish', async () => {
    const bridge = useJournalMapBridge();
    const pending = bridge.startPick([1], 'Контур 1');
    expect(bridge.state.pick.active).toBe(true);
    bridge.togglePicked(2, { geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } });
    bridge.togglePicked(1);
    bridge.finishPick(true);
    await expect(pending).resolves.toEqual([2]);
    expect(bridge.state.pick.active).toBe(false);
  });

  it('cancel resolves null and overlay can be cleared', async () => {
    const bridge = useJournalMapBridge();
    const pending = bridge.startPick([5], 'x');
    bridge.finishPick(false);
    await expect(pending).resolves.toBeNull();
    const version = bridge.state.overlayVersion;
    bridge.showContour({ label: 'К', geojson: { type: 'FeatureCollection', features: [] }, bbox: [0, 0, 1, 1] });
    expect(bridge.state.overlay?.label).toBe('К');
    bridge.clearContour();
    expect(bridge.state.overlay).toBeNull();
    expect(bridge.state.overlayVersion).toBe(version + 2);
  });
});
