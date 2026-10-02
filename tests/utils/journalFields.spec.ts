import { describe, expect, it } from 'vitest';
import { hasLonLat, localToday, toDateInput, withDateInputs } from '~/utils/journalFields';

describe('journalFields', () => {
  it('localToday — локальная дата, не UTC (QA F81)', () => {
    // 1 октября 02:30 по местному времени: в UTC+5 это ещё 30 сентября
    expect(localToday(new Date(2026, 9, 1, 2, 30))).toBe('2026-10-01');
    expect(localToday(new Date(2026, 0, 9, 23, 59))).toBe('2026-01-09');
  });

  it('toDateInput — timestamp из API в формат поля date (QA F80)', () => {
    expect(toDateInput('2024-05-01T00:00:00')).toBe('2024-05-01');
    expect(toDateInput('2024-05-01 13:45:00')).toBe('2024-05-01');
    expect(toDateInput('2024-05-01')).toBe('2024-05-01');
    expect(toDateInput(null)).toBeNull();
    expect(toDateInput('')).toBeNull();
    expect(toDateInput('мусор')).toBeNull();
    expect(withDateInputs({ a: '2024-05-01T00:00:00', b: 'x' }, ['a', 'c'])).toEqual({ a: '2024-05-01', b: 'x' });
  });

  it('hasLonLat — null и пустые строки не координаты (QA F82)', () => {
    expect(hasLonLat({ longitude: null, latitude: null })).toBe(false);
    expect(hasLonLat({ longitude: '', latitude: 43.2 })).toBe(false);
    expect(hasLonLat({})).toBe(false);
    expect(hasLonLat(null)).toBe(false);
    expect(hasLonLat({ longitude: 76.9, latitude: '43.25' })).toBe(true);
    expect(hasLonLat({ longitude: 0, latitude: 0 })).toBe(true);
  });
});
