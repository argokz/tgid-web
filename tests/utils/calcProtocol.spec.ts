import { describe, expect, it } from 'vitest';
import { calcOutcome, taskStateLabel } from '~/utils/calcProtocol';

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
