/**
 * Протокол расчёта: статус задачи Celery и итог расчёта sety.
 *
 * Celery SUCCESS означает только «задача отработала»: сам расчёт мог завершиться ошибкой
 * (result.status = error/partial). Поэтому в протокол пишется итог по result, а не сырой
 * статус Celery — иначе выходило «Статус: SUCCESS» и следом «Ошибка при выполнении расчёта».
 */

const TASK_STATE_LABELS: Record<string, string> = {
  PENDING: 'в очереди',
  RECEIVED: 'в очереди',
  STARTED: 'выполняется',
  PROGRESS: 'выполняется',
  RETRY: 'повтор',
  FAILURE: 'сбой задачи на сервере',
  REVOKED: 'отменена',
};

/** Подпись промежуточного статуса задачи; null — для SUCCESS (итог пишет calcOutcome). */
export function taskStateLabel(state: string): string | null {
  if (state === 'SUCCESS') return null;
  return TASK_STATE_LABELS[state] ?? state;
}

export interface CalcOutcome {
  label: string;
  type: 'success' | 'error' | 'info';
}

/** Итог расчёта по результату задачи (result.status: success / partial / error). */
export function calcOutcome(result: { status?: string } | null | undefined): CalcOutcome {
  const status = result?.status;
  if (status === 'success') return { label: 'Статус: расчёт выполнен', type: 'success' };
  if (status === 'partial') return { label: 'Статус: расчёт выполнен частично (есть ошибки)', type: 'error' };
  return { label: 'Статус: расчёт завершился ошибкой', type: 'error' };
}
