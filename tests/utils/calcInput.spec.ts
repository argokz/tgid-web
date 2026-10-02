import { describe, expect, it } from 'vitest';
import { fmtFixed, fmtNum, missingFields, missingFieldsText, optNum } from '~/utils/calcInput';

describe('calcInput (QA F31, F67)', () => {
  it('пустое поле v-model.number ("") — не число', () => {
    expect(missingFields([['', 'G'], [null, 'H'], [0, 'Q'], [12.5, 'T']])).toEqual(['G', 'H']);
    expect(optNum('')).toBeUndefined();
    expect(optNum(0)).toBe(0);
  });

  it('текст уведомления', () => {
    expect(missingFieldsText(['Расход G'])).toBe('Заполните поле «Расход G»');
    expect(missingFieldsText(['A', 'B'])).toBe('Заполните поля: «A», «B»');
  });

  it('единый десятичный разделитель — запятая', () => {
    expect(fmtNum(12.345)).toBe('12,35');
    expect(fmtNum(37.6, 1)).toBe('37,6');
    expect(fmtNum(1500)).toBe('1500');
    expect(fmtNum(null)).toBe('—');
    expect(fmtFixed(9.08, 1)).toBe('9,1');
    expect(fmtFixed(45, 2)).toBe('45,00');
  });
});
