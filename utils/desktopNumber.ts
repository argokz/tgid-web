/**
 * Число как в карточке десктопа gid8: `QLocale("ru_RU").toString(double)` (property/variantdelegate.cpp,
 * displayText) — формат 'g' с 6 значащими цифрами, запятая, без разделителя тысяч (десктоп его вырезает),
 * незначащие нули отброшены: 3.1461942190349745 → «3,14619», 106.80047 → «106,8», 0.0000123 → «1,23e-05».
 *
 * Целые выводятся как есть: десктоп показывает int-колонки через toString, а в JSON целое
 * double-значение от целого int не отличить (id, коды, номера не должны уходить в экспоненту).
 */
const SIGNIFICANT = 6

const trimZeros = (s: string): string => (s.includes('.') ? s.replace(/\.?0+$/, '') : s)

export function formatDesktopNumber(value: number): string {
  if (!Number.isFinite(value) || Number.isInteger(value)) return String(value)
  // Порядок после округления до 6 знаков (9.999995 → 10, порядок 1)
  const rounded = Number(value.toPrecision(SIGNIFICANT))
  const exp = rounded === 0 ? 0 : Math.floor(Math.log10(Math.abs(rounded)))
  let text: string
  if (exp < -4 || exp >= SIGNIFICANT) {
    const [mantissa, e] = rounded.toExponential(SIGNIFICANT - 1).split('e')
    const n = Number(e)
    text = `${trimZeros(mantissa)}e${n < 0 ? '-' : '+'}${String(Math.abs(n)).padStart(2, '0')}`
  } else {
    text = trimZeros(rounded.toFixed(Math.max(0, SIGNIFICANT - 1 - exp)))
  }
  return text.replace('.', ',')
}
