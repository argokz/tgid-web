/**
 * Точный ввод следующей точки трассы с клавиатуры (как в QGIS Advanced Digitizing):
 * цифры — длина участка в метрах, Tab — переход к углу (и обратно), Enter — поставить точку.
 * Введённое значение — замок: курсор управляет только тем, что не задано.
 *
 * Чистая функция над состоянием: клавиша → новое состояние и что сделать. Клавиши, которые
 * ввод не обработал (Enter без значений, Backspace в пустом поле, Esc без ввода), остаются
 * трассе: завершить, убрать точку, сбросить.
 */

export type CadInputField = 'length' | 'angle';

export interface CadInputState {
  length: string;
  angle: string;
  /** поле, в которое идёт ввод; null — ввод не начат */
  field: CadInputField | null;
}

export const EMPTY_CAD_INPUT: CadInputState = { length: '', angle: '', field: null };

export interface CadInputKey {
  key: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
}

export interface CadInputStep {
  state: CadInputState;
  /** клавиша обработана вводом (preventDefault, трассе не передавать) */
  handled: boolean;
  /** Enter со значениями — поставить точку по замкам */
  place?: boolean;
}

/** «12,5» / «12.5» / «-90» → число; пусто или мусор — null */
export const parseCadNumber = (s: string): number | null => {
  const t = s.trim().replace(',', '.');
  if (!t || t === '-' || t === '.' || t === '-.') return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
};

/** Замки из ввода: длина > 0, угол — любой конечный */
export const cadInputLocks = (s: CadInputState): { lengthM: number | null; angleDeg: number | null } => {
  const len = parseCadNumber(s.length);
  return { lengthM: len != null && len > 0 ? len : null, angleDeg: parseCadNumber(s.angle) };
};

export const hasCadInput = (s: CadInputState) => s.field != null || s.length !== '' || s.angle !== '';

const MAX_CHARS = 12;

const appendChar = (value: string, ch: string, field: CadInputField): string | null => {
  if (value.length >= MAX_CHARS) return null;
  if (ch === '-') {
    // минус — только у угла и только первым символом: поворот влево
    if (field !== 'angle' || value !== '') return null;
    return '-';
  }
  if (ch === '.' || ch === ',') {
    if (value.includes(',')) return null;
    return `${value === '' || value === '-' ? `${value}0` : value},`;
  }
  return value + ch;
};

export const cadInputKey = (s: CadInputState, ev: CadInputKey): CadInputStep => {
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return { state: s, handled: false };
  const { key } = ev;
  if (/^[0-9]$/.test(key) || key === '.' || key === ',' || key === '-') {
    // ввод с минуса сразу идёт в угол (поворот влево), цифры без поля — в длину
    const field: CadInputField = s.field ?? (key === '-' ? 'angle' : 'length');
    const next = appendChar(s[field], key, field);
    if (next == null) return { state: { ...s, field }, handled: true };
    return { state: { ...s, field, [field]: next }, handled: true };
  }
  if (key === 'Tab') {
    const order: CadInputField[] = ['length', 'angle'];
    const cur = s.field ? order.indexOf(s.field) : -1;
    const field = cur < 0 ? (ev.shiftKey ? 'angle' : 'length') : order[(cur + 1) % order.length];
    return { state: { ...s, field }, handled: true };
  }
  if (key === 'Backspace') {
    if (s.field && s[s.field] !== '') {
      return { state: { ...s, [s.field]: s[s.field].slice(0, -1) }, handled: true };
    }
    if (s.field) {
      // пустое поле: вернуться к другому, если в нём что-то есть, иначе закончить ввод
      const other: CadInputField = s.field === 'length' ? 'angle' : 'length';
      return { state: { ...s, field: s[other] !== '' ? other : null }, handled: true };
    }
    return { state: s, handled: false };
  }
  if (key === 'Delete') {
    if (!s.field) return { state: s, handled: false };
    return { state: { ...s, [s.field]: '' }, handled: true };
  }
  if (key === 'Escape') {
    if (!hasCadInput(s)) return { state: s, handled: false };
    return { state: EMPTY_CAD_INPUT, handled: true };
  }
  if (key === 'Enter') {
    const locks = cadInputLocks(s);
    if (locks.lengthM == null && locks.angleDeg == null) {
      // поле открыто, но пусто — Enter просто закрывает ввод
      if (hasCadInput(s)) return { state: EMPTY_CAD_INPUT, handled: true };
      return { state: s, handled: false };
    }
    return { state: s, handled: true, place: true };
  }
  return { state: s, handled: false };
};
