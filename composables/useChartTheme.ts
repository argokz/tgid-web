import { computed } from 'vue';
import { useTheme } from 'vuetify';

/**
 * Тема ECharts из токенов приложения (docs/ui-primitives.md, этап 6): цвета — из темы Vuetify
 * (primary, accent, secondary, success, warning, error, info), шрифт — Roboto 12–14 px, тонкая сетка,
 * тултип на светлой поверхности с табличными цифрами. Передаётся в `<v-chart :theme="chartTheme">`
 * объектом — регистрировать глобально не нужно, SSR-безопасно (объект без DOM).
 *
 * Цвет — не единственный носитель смысла: серии различаются ещё и подписью/маркером (настраивает график).
 */
/** `#RRGGBB` → `rgba(r, g, b, a)`; не hex — как есть */
const withAlpha = (hex: string, alpha: number): string => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return hex;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
};

export function useChartTheme() {
  const theme = useTheme();

  const chartTheme = computed(() => {
    const c = theme.current.value.colors;
    const onSurface = c['on-surface'] || '#1F2933';
    // от цвета текста темы: в тёмной теме сетка и подписи светлые, а не тёмные на тёмном
    const border = withAlpha(onSurface, 0.12);
    const muted = withAlpha(onSurface, 0.6);
    return {
      color: [c.primary, c.accent || '#D97706', c.success || '#2E7D32', c.secondary, c.warning || '#ED6C02', c.error || '#C62828', c.info || '#0288D1'],
      backgroundColor: 'transparent',
      textStyle: { fontFamily: 'Roboto, "Segoe UI", Arial, sans-serif', fontSize: 12, color: onSurface },
      title: { textStyle: { fontSize: 14, fontWeight: 600, color: onSurface } },
      legend: { textStyle: { color: onSurface, fontSize: 12 }, itemWidth: 14, itemHeight: 8 },
      tooltip: {
        backgroundColor: c.surface || '#FFFFFF',
        borderColor: border,
        borderWidth: 1,
        textStyle: { color: onSurface, fontSize: 12, fontFamily: 'Roboto, "Segoe UI", Arial, sans-serif', fontFeatureSettings: '"tnum"' },
        extraCssText: 'box-shadow: 0 4px 16px rgba(0,0,0,.14); font-variant-numeric: tabular-nums; border-radius: 8px;',
        axisPointer: { lineStyle: { color: muted, width: 1 }, crossStyle: { color: muted } },
      },
      categoryAxis: {
        axisLine: { lineStyle: { color: border } },
        axisTick: { show: false },
        axisLabel: { color: muted, fontSize: 11 },
        splitLine: { show: false },
      },
      valueAxis: {
        axisLine: { show: false },
        axisTick: { show: false },
        // подписи чисел русской записью («1 000», «0,5»), а не по умолчанию ECharts «1,000»
        axisLabel: { color: muted, fontSize: 11, formatter: (value: number) => value.toLocaleString('ru-RU', { maximumFractionDigits: 3 }) },
        splitLine: { lineStyle: { color: border, width: 1 } },
        nameTextStyle: { color: muted, fontSize: 11 },
      },
      line: { smooth: false, symbolSize: 5, lineStyle: { width: 2 } },
      scatter: { symbolSize: 7 },
      bar: { barMaxWidth: 28, itemStyle: { borderRadius: [3, 3, 0, 0] } },
      dataZoom: { borderColor: border, fillerColor: withAlpha(c.primary, 0.08), handleStyle: { color: c.primary }, textStyle: { color: muted } },
    };
  });

  return { chartTheme };
}
