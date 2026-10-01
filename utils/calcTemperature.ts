/**
 * Температура наружного воздуха для расчёта sety.
 *
 * sety (w.py) берёт из «Системы теплоснабжения» (heatSystem) расчётную для отопления t_or
 * и температуру конца отопительного периода t_vnew и отказывается считать при Tн вне
 * [t_or; t_vnew] (кроме летнего режима). Десктоп ввод не ограничивает, но sety откажет так же;
 * форма ловит это заранее и берёт t_or умолчанием.
 */
export interface TnRange {
  t_or: number | null;
  t_vnew: number | null;
}

/** Абсолютные границы поля (как у API: -60…50) */
export const TN_MIN = -60;
export const TN_MAX = 50;

export function tnRangeHint(range: TnRange | null): string {
  if (!range || range.t_or === null || range.t_vnew === null) return '';
  return `Допустимо от ${range.t_or} до ${range.t_vnew} °C (система теплоснабжения)`;
}

/** Сообщение об ошибке или null, если Tн можно отправлять */
export function tnValidationError(raw: string, range: TnRange | null, summer = false): string | null {
  const tn = Number(raw);
  if (String(raw).trim() === '' || !Number.isFinite(tn) || tn < TN_MIN || tn > TN_MAX) {
    return `Температура наружного воздуха должна быть числом от ${TN_MIN} до ${TN_MAX} °C`;
  }
  if (summer || !range || range.t_or === null || range.t_vnew === null) return null;
  if (tn < range.t_or || tn > range.t_vnew) {
    return `Температура наружного воздуха должна быть от ${range.t_or} до ${range.t_vnew} °C `
      + '(расчётная для отопления и конца отопительного периода, «Система теплоснабжения»)';
  }
  return null;
}
