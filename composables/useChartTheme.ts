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
export function useChartTheme() {
  const theme = useTheme();

  const chartTheme = computed(() => {
    const c = theme.current.value.colors;
    const onSurface = c['on-surface'] || '#1F2933';
    const border = 'rgba(31, 41, 51, 0.12)';
    const muted = 'rgba(31, 41, 51, 0.6)';
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
        extraCssText: 'box-shadow: 0 4px 16px rgba(0,0,0,.14); font-variant-numeric: tabular-nums;',
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
        axisLabel: { color: muted, fontSize: 11 },
        splitLine: { lineStyle: { color: border, width: 1 } },
        nameTextStyle: { color: muted, fontSize: 11 },
      },
      line: { smooth: false, symbolSize: 5, lineStyle: { width: 2 } },
      scatter: { symbolSize: 7 },
      bar: { barMaxWidth: 28, itemStyle: { borderRadius: [3, 3, 0, 0] } },
      dataZoom: { borderColor: border, fillerColor: 'rgba(21, 101, 192, 0.08)', handleStyle: { color: c.primary }, textStyle: { color: muted } },
    };
  });

  return { chartTheme };
}
