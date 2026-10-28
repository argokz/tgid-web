import { describe, expect, it } from 'vitest';
import type { ValveToClose } from '~/services/api/types';
import { VALVE_REASON_LABELS, isRequiredValve, sortValvesForCrew } from '~/utils/valveIsolation';

const valve = (id: number, extra: Partial<ValveToClose> = {}): ValveToClose => ({
  id,
  lineid: id * 10,
  display_name: `Задвижка №${id}`,
  nominal_diameter: 100,
  state_id: 1,
  state_name: 'Открыта',
  lng: null,
  lat: null,
  ...extra,
});

describe('valveIsolation', () => {
  it('ответ без разметки (старый API) — задвижка обязательна', () => {
    expect(isRequiredValve(valve(1))).toBe(true);
    expect(isRequiredValve(valve(1, { required: false, reason: 'no_supply' }))).toBe(false);
  });

  it('бригаде сначала обязательные, внутри — по id', () => {
    const sorted = sortValvesForCrew([
      valve(5, { required: false, reason: 'no_supply' }),
      valve(9, { required: true, reason: 'supply' }),
      valve(2, { required: true, reason: 'supply' }),
      valve(1, { required: false, reason: 'inside_zone' }),
    ]);
    expect(sorted.map((v) => v.id)).toEqual([2, 9, 1, 5]);
  });

  it('у каждой причины API есть подпись и подсказка', () => {
    for (const reason of ['supply', 'no_supply', 'inside_zone'] as const) {
      expect(VALVE_REASON_LABELS[reason].label).toBeTruthy();
      expect(VALVE_REASON_LABELS[reason].hint.length).toBeGreaterThan(20);
    }
  });
});
