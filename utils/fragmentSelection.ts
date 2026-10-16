/**
 * Какие фрагменты показывать на карте.
 *
 * Карта всегда показывает выбранные фрагменты. Если ничего не выбрано (первое открытие, «Сбросить»,
 * сохранённые фрагменты удалены), берётся фрагмент по умолчанию:
 *   1) фрагменты города из NUXT_PUBLIC_DEFAULT_FRAGMENTS, если они ещё существуют;
 *   2) фрагмент последнего расчёта с результатами (как в десктопе — сеть, которую считали);
 *   3) фрагмент последнего расчёта вообще;
 *   4) первый фрагмент списка.
 */

export interface CalcForFragment {
  fileid: number | null
  has_results?: boolean
}

const toIds = (raw: unknown): number[] =>
  Array.isArray(raw)
    ? [...new Set(raw.map(Number).filter((id) => Number.isInteger(id) && id > 0))].sort((a, b) => a - b)
    : []

/** Только существующие фрагменты, без повторов, по возрастанию */
export function keepExistingFragments(ids: unknown, existing: Iterable<number>): number[] {
  const live = new Set([...existing].map(Number))
  return toIds(ids).filter((id) => live.has(id))
}

/** Сохранённый выбор из localStorage (JSON-массив id); испорченный — пусто */
export function parseSavedFragments(raw: string | null | undefined): number[] {
  if (!raw) return []
  try {
    return toIds(JSON.parse(raw))
  } catch {
    return []
  }
}

/**
 * Фрагмент по умолчанию. existing — id фрагментов в порядке списка, calculations — расчёты,
 * новые первыми (GET api/v1/calculations). Пустой список фрагментов — пусто.
 */
export function defaultFragments(
  existing: number[],
  cityDefaults: number[],
  calculations: CalcForFragment[] = [],
): number[] {
  if (!existing.length) return []
  const fromCity = keepExistingFragments(cityDefaults, existing)
  if (fromCity.length) return fromCity
  const live = new Set(existing)
  const withResults = calculations.find((c) => c.has_results && c.fileid != null && live.has(Number(c.fileid)))
  if (withResults) return [Number(withResults.fileid)]
  const anyCalc = calculations.find((c) => c.fileid != null && live.has(Number(c.fileid)))
  if (anyCalc) return [Number(anyCalc.fileid)]
  return [existing[0]]
}
