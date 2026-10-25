/**
 * Общие части опций ECharts (docs/ui-modernization-prompt.md, этап 6): тултип по оси с единицами и табличными
 * цифрами, кроссхэйр, зум колесом и ползунком, выделение диапазона кистью → зум. Чистые функции без DOM —
 * тема цветов отдельно (`useChartTheme`), рамка с кнопками — `ChartFrame.vue`.
 */

/** Параметр серии в тултипе ECharts (то, что нужно формату) */
export interface TooltipParam {
  seriesName?: string;
  marker?: string;
  value?: unknown;
  data?: unknown;
  axisValue?: unknown;
  axisValueLabel?: string;
  dataIndex?: number;
}

export interface AxisTooltipOptions {
  /** Единицы по имени серии (или функция); пусто — без единиц */
  units?: Record<string, string> | ((seriesName: string) => string);
  /** Знаков после запятой */
  digits?: number;
  /** Заголовок тултипа (по умолчанию — подпись оси) */
  title?: (params: TooltipParam[]) => string;
  /** Дополнительные строки под заголовком (например «Расстояние: 120 м») */
  subtitle?: (params: TooltipParam[]) => string;
  /** Кроссхэйр: 'cross' — обе оси, 'line' — вертикальная линия */
  pointer?: 'cross' | 'line';
}

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Текст в HTML тултипа: подписи узлов и серий приходят из базы — экранировать всегда */
export const escapeHtml = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);

/** Число для графика: русская запись, пусто или не число — «—» */
export const formatChartNumber = (value: unknown, digits = 2): string => {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString('ru-RU', { maximumFractionDigits: digits }) : '—';
};

/** Значение точки: число или последний элемент пары [x, y] */
export const pointValue = (param: TooltipParam): unknown => {
  const raw = param.value ?? param.data;
  if (Array.isArray(raw)) return raw[raw.length - 1];
  if (raw && typeof raw === 'object' && 'value' in raw) {
    const inner = (raw as { value: unknown }).value;
    return Array.isArray(inner) ? inner[inner.length - 1] : inner;
  }
  return raw;
};

const unitOf = (units: AxisTooltipOptions['units'], seriesName: string) =>
  (typeof units === 'function' ? units(seriesName) : units?.[seriesName]) || '';

/** HTML тултипа по оси: заголовок, строки «маркер · серия · значение единицы»; всё из данных экранировано */
export const formatAxisTooltip = (params: TooltipParam[] | TooltipParam, options: AxisTooltipOptions = {}): string => {
  const list = Array.isArray(params) ? params : [params];
  if (!list.length) return '';
  const digits = options.digits ?? 2;
  const title = options.title ? options.title(list) : String(list[0].axisValueLabel ?? list[0].axisValue ?? '');
  const head = title ? `<div class="chart-tip__title">${escapeHtml(title)}</div>` : '';
  const sub = options.subtitle ? `<div class="chart-tip__sub">${escapeHtml(options.subtitle(list))}</div>` : '';
  const rows = list.map((param) => {
    const name = String(param.seriesName ?? '');
    const unit = unitOf(options.units, name);
    const value = formatChartNumber(pointValue(param), digits);
    // marker — HTML кружка от самого ECharts (цвет серии), не из данных
    return `<div class="chart-tip__row">${param.marker ?? ''}<span class="chart-tip__name">${escapeHtml(name)}</span>`
      + `<b class="chart-tip__value">${escapeHtml(value)}${value !== '—' && unit ? ` ${escapeHtml(unit)}` : ''}</b></div>`;
  });
  return head + sub + rows.join('');
};

/** Тултип по оси с кроссхэйром и форматом из `formatAxisTooltip` */
export const axisTooltip = (options: AxisTooltipOptions = {}) => ({
  trigger: 'axis' as const,
  confine: true,
  axisPointer: {
    type: options.pointer ?? 'cross',
    // подписи кроссхэйра на осях — тоже русской записью (по умолчанию ECharts пишет «1,400.00»)
    label: {
      show: options.pointer !== 'line',
      formatter: (param: { value?: unknown }) => (typeof param.value === 'number' ? formatChartNumber(param.value, options.digits ?? 2) : String(param.value ?? '')),
    },
  },
  formatter: (params: TooltipParam[] | TooltipParam) => formatAxisTooltip(params, options),
});

export interface ZoomOptions {
  /** Индекс оси X (по умолчанию 0) */
  xAxisIndex?: number | number[];
  /** Ползунок под графиком */
  slider?: boolean;
  /** Отступ ползунка снизу, px */
  sliderBottom?: number;
  /** 'none' — точки вне окна не выкидываются (линии не рвутся у края) */
  filterMode?: 'none' | 'filter' | 'weakFilter' | 'empty';
}

/** Зум колесом / жестом и ползунком по оси X */
export const zoomControls = (options: ZoomOptions = {}) => {
  const xAxisIndex = options.xAxisIndex ?? 0;
  const filterMode = options.filterMode ?? 'none';
  const zoom: Array<Record<string, unknown>> = [{ type: 'inside', xAxisIndex, filterMode }];
  if (options.slider !== false) zoom.push({ type: 'slider', xAxisIndex, filterMode, bottom: options.sliderBottom ?? 16, height: 18 });
  return zoom;
};

/** Кисть для «масштаба выделением»: включается программно (`takeGlobalCursor`), сама не рисует кнопок */
export const brushForZoom = () => ({
  xAxisIndex: 'all',
  brushLink: 'none',
  throttleType: 'debounce',
  throttleDelay: 0,
  brushStyle: { borderWidth: 1, color: 'rgba(21, 101, 192, 0.12)', borderColor: 'rgba(21, 101, 192, 0.5)' },
  outOfBrush: { colorAlpha: 1 },
});

/** Ось X графика для перевода выделения: тип и число категорий */
export interface ZoomAxis {
  type?: string;
  data?: readonly unknown[];
}

/**
 * Диапазон выделения кистью → параметры `dataZoom` по оси X. У оси значений — `startValue` / `endValue`;
 * у оси категорий кисть отдаёт индексы, а `startValue` с числом ищет категорию с таким значением (у графика
 * температур категории — сами числа −25…8) — поэтому индексы переводятся в проценты. null — выделения нет.
 */
export const brushRangeToZoom = (
  areas: Array<{ coordRange?: unknown }> | undefined,
  axis: ZoomAxis = {},
): { startValue: number; endValue: number } | { start: number; end: number } | null => {
  const range = areas?.[0]?.coordRange;
  if (!Array.isArray(range) || range.length < 2) return null;
  const [a, b] = range.map(Number);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return null;
  const from = Math.min(a, b);
  const to = Math.max(a, b);
  if (axis.type === 'category') {
    const last = (axis.data?.length ?? 0) - 1;
    if (last <= 0) return null;
    const percent = (index: number) => Math.min(100, Math.max(0, (index / last) * 100));
    return { start: percent(from), end: percent(to) };
  }
  return { startValue: from, endValue: to };
};
