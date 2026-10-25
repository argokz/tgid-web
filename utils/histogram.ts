/**
 * Распределение значений для мини-гистограммы (этап 6, инфографика расчётов): равные интервалы от минимума до
 * максимума, число значений в каждом, медиана. Чистые функции без DOM.
 */

export interface HistogramBin {
  from: number;
  to: number;
  count: number;
}

export interface Histogram {
  bins: HistogramBin[];
  min: number;
  max: number;
  median: number;
  /** Сколько значений учтено (числа; пустые и нечисловые отброшены) */
  total: number;
  /** Самый высокий столбец — для масштаба */
  peak: number;
}

/** Числа ряда: пустые, нечисловые и бесконечности отброшены */
export const finiteValues = (values: ReadonlyArray<unknown>): number[] =>
  values
    .filter((v) => v !== null && v !== undefined && v !== '' && typeof v !== 'boolean')
    .map(Number)
    .filter((v) => Number.isFinite(v));

/** Медиана отсортированного ряда */
const medianOf = (sorted: number[]): number => {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/**
 * Гистограмма ряда: `binCount` равных интервалов; все значения одинаковые — один столбец. Пустой ряд — null.
 * Последний интервал включает максимум.
 */
export const buildHistogram = (values: ReadonlyArray<unknown>, binCount = 12): Histogram | null => {
  const numbers = finiteValues(values);
  if (!numbers.length) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const count = max === min ? 1 : Math.max(1, Math.min(binCount, sorted.length));
  const width = (max - min) / count || 1;
  const bins: HistogramBin[] = Array.from({ length: count }, (_, i) => ({
    from: min + i * width,
    to: i === count - 1 ? max : min + (i + 1) * width,
    count: 0,
  }));
  for (const value of sorted) {
    const index = max === min ? 0 : Math.min(count - 1, Math.floor((value - min) / width));
    bins[index].count += 1;
  }
  return { bins, min, max, median: medianOf(sorted), total: sorted.length, peak: Math.max(...bins.map((b) => b.count)) };
};
