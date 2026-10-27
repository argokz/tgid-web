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

/** Верх панелей режимов в контейнере карты: под строкой режимов (--shell-inset + --toolbar-row + --shell-gap) */
export function modeDockTopPx(): number {
  return readCssPx('--shell-inset', 12) + readCssPx('--toolbar-row', 46) + readCssPx('--shell-gap', 8)
}

/** Высота шапки (--shell-top): на телефоне 0, на десктопе 48 */
export function shellTopPx(): number {
  return readCssPx('--shell-top', SHELL_TOP_FALLBACK_PX)
}
