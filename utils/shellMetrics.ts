/**
 * Размеры каркаса из CSS-токенов (assets/styles/_tokens.scss): один источник для стилей и для расчётов в коде,
 * без дублирования чисел вроде «56 px шапки». Только на клиенте; на сервере и при непонятном значении — запасное.
 */

/** Высота шапки по умолчанию — значение --shell-top на десктопе */
export const SHELL_TOP_FALLBACK_PX = 48

/** Значение CSS-переменной в пикселях; `fallback`, если переменной нет или она не в px */
export function readCssPx(name: string, fallback: number, el?: Element): number {
  if (typeof window === 'undefined') return fallback
  const raw = getComputedStyle(el ?? document.documentElement).getPropertyValue(name).trim()
  const value = Number.parseFloat(raw)
  return raw.endsWith('px') && Number.isFinite(value) ? value : fallback
}

/** Высота шапки (--shell-top): на телефоне 0, на десктопе 48 */
export function shellTopPx(): number {
  return readCssPx('--shell-top', SHELL_TOP_FALLBACK_PX)
}
