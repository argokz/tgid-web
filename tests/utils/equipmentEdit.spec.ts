import { describe, expect, it } from 'vitest';
import { changedEquipmentFields, sameValue } from '~/services/equipmentEditService';

describe('equipment edit', () => {
  it('compares form values with db values loosely', () => {
    expect(sameValue(5, '5')).toBe(true);
    expect(sameValue('1,5', 1.5)).toBe(true);
    expect(sameValue('', null)).toBe(true);
    expect(sameValue(0, null)).toBe(false);
    expect(sameValue('a', 'b')).toBe(false);
  });

  it('sends only changed fields; unknown keys are sent for server validation', () => {
    const original = { turncount: 0, gatecontrol: 1, name: 'Вход ТП' };
    expect(changedEquipmentFields(original, { turncount: '0', gatecontrol: 1, name: 'Вход ТП' })).toEqual({});
    expect(changedEquipmentFields(original, { turncount: '7', name: '' })).toEqual({ turncount: '7', name: null });
    expect(changedEquipmentFields(original, { g: 1 })).toEqual({ g: 1 });
  });
});
