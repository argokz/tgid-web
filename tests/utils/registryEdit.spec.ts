import { describe, expect, it } from 'vitest';
import {
  CORROSION_COLUMN_BY_KEY,
  changedColumns,
  corrosionEditableKey,
  emptyToNull,
  filledColumns,
  identityColumns,
} from '../../utils/registryEdit';

describe('registryEdit (QA F42/F43)', () => {
  it('переводит ключи API индикатора в колонки indikator_korrozii', () => {
    const original = { id: 3, installation_place: 'Старое', planned_on: '2026-01-01', address: 'ул. 1', diameter: 500 };
    const edited = { ...original, installation_place: 'QA-3009', planned_on: '', address: 'другой', diameter: 600 };
    expect(changedColumns(original, edited, CORROSION_COLUMN_BY_KEY)).toEqual({
      mesto_ustanovki: 'QA-3009',
      data_planirovaniya: null,
    });
  });

  it('новая запись: только заполненные поля и только колонки таблицы', () => {
    expect(filledColumns({ line_id: 12, node_id: undefined, note: '', number: 'QA', address: 'x' }, CORROSION_COLUMN_BY_KEY))
      .toEqual({ lineid: 12, nomer_indikatora_korrozii: 'QA' });
  });

  it('ключи API, которых нет в карте, не уходят на сервер', () => {
    for (const column of Object.values(CORROSION_COLUMN_BY_KEY)) expect(column).toMatch(/^[a-z0-9_]+$/);
    expect(CORROSION_COLUMN_BY_KEY).not.toHaveProperty('address');
    expect(CORROSION_COLUMN_BY_KEY).not.toHaveProperty('diameter');
  });

  it('поля сезона правятся в карточке только без истории сезонов', () => {
    expect(corrosionEditableKey('installed_on', 0)).toBe('installed_on');
    expect(corrosionEditableKey('installed_on', 2)).toBeUndefined();
    expect(corrosionEditableKey('installation_place', 2)).toBe('installation_place');
    expect(corrosionEditableKey('address', 0)).toBeUndefined();
  });

  it('ТУ: тождественная карта ключей формы', () => {
    const map = identityColumns(['number', 'issued_on']);
    expect(changedColumns({ number: '1', issued_on: '2026-01-01' }, { number: '2', issued_on: '2026-01-01', state_name: 'x' }, map))
      .toEqual({ number: '2' });
    expect(emptyToNull(undefined)).toBeNull();
    expect(emptyToNull(0)).toBe(0);
  });
});
