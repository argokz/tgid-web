import { describe, expect, it } from 'vitest';
import { electricalCandidateText, electricalCurrentText, ELECTRICAL_TYPE_TITLES } from '~/utils/electricalReconciliation';

describe('electrical reconciliation helpers', () => {
  it('describes line ends binding', () => {
    const line = { object_type: 'line', source_id: 3, source_distance: 1492, receiver_id: null, candidate_source_id: null, candidate_receiver_id: 21, candidate_receiver_distance: 0.5 };
    expect(electricalCurrentText(line)).toBe('ист. 3 (1 492 м); пр. —');
    expect(electricalCandidateText(line)).toBe('ист. —; пр. 21 (0,5 м)');
  });

  it('describes point objects and nearest line', () => {
    const point = { object_type: 'support', line_id: null, candidate_line_id: null, nearest_line_id: 7, nearest_line_distance: 12.345 };
    expect(electricalCurrentText(point)).toBe('ЛЭП —');
    expect(electricalCandidateText(point)).toBe('ЛЭП —; ближайшая ЛЭП 7 (12,35 м)');
    expect(electricalCandidateText({ object_type: 'coupling', candidate_line_id: 7, candidate_line_distance: 0 })).toBe('ЛЭП 7 (0 м)');
    expect(ELECTRICAL_TYPE_TITLES.sleeve).toBe('Гильза');
  });
});
