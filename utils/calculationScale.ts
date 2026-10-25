/**
 * Цветовая шкала результатов расчёта на карте (этап 6, «состояния — цветовой шкалой с легендой на карте»): одна
 * таблица и для выражения слоя MapLibre, и для легенды — раньше первая загрузка красила по одним порогам, смена
 * режима — по другим, а легенда в диалоге рисовала третьи.
 */

export type CalculationColorMode = 'pressure_drop' | 'velocity';

export interface CalculationScale {
  mode: CalculationColorMode;
  /** Что раскрашено — подпись легенды */
  title: string;
  units: string;
  /** Пороги и цвета по возрастанию: зелёный — норма, тёмно-красный — максимум и выше */
  stops: ReadonlyArray<readonly [number, string]>;
}

const COLORS = ['#2e7d32', '#f9a825', '#e53935', '#7f0000'] as const;

/** Доли максимума для порогов: 0, 20 %, 60 %, 100 % */
const FRACTIONS = [0, 0.2, 0.6, 1] as const;

const SCALES: Record<CalculationColorMode, { title: string; units: string; max: number }> = {
  pressure_drop: { title: 'Падение давления', units: 'атм', max: 5 },
  velocity: { title: 'Скорость воды', units: 'м/с', max: 3 },
};

export const calculationScale = (mode: CalculationColorMode): CalculationScale => {
  const def = SCALES[mode];
  return {
    mode,
    title: def.title,
    units: def.units,
    stops: FRACTIONS.map((fraction, index) => [Number((def.max * fraction).toFixed(3)), COLORS[index]] as const),
  };
};

/** Выражение `line-color` MapLibre: линейная интерполяция по свойству режима */
export const calculationColorExpression = (mode: CalculationColorMode): unknown[] => [
  'interpolate',
  ['linear'],
  ['to-number', ['get', mode], 0],
  ...calculationScale(mode).stops.flatMap(([value, color]) => [value, color]),
];
