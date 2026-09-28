import { describe, expect, it } from 'vitest';
import { ALSEKO_BUILDING_KINDS, ALSEKO_LOAD_KINDS, alsekoColumnTitle, parseIdList } from '~/utils/alsekoReconciliation';

describe('ALSECO reconciliation helpers', () => {
  it('parses building id lists', () => {
    expect(parseIdList('1, 2 3;4,,2 x -5 0 7.5')).toEqual([1, 2, 3, 4]);
    expect(parseIdList('')).toEqual([]);
  });

  it('titles columns and splits kinds', () => {
    expect(alsekoColumnTitle('heating_load')).toBe('Отопление');
    expect(alsekoColumnTitle('unknown_col')).toBe('unknown_col');
    expect(ALSEKO_LOAD_KINDS.has('unmatched_apartment')).toBe(true);
    expect(ALSEKO_BUILDING_KINDS.has('unassigned_building')).toBe(true);
    expect(ALSEKO_BUILDING_KINDS.has('ambiguous_address')).toBe(false);
  });
});
