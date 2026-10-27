# Дизайн-токены и примитивы UI

Этап 2 модернизации UI (`docs/ui-modernization-prompt.md`). Здесь — что есть, когда применять, пропсы.
Правило: новый интерфейс собирается из этих примитивов; локальные цвета, тени и длительности в компонентах не заводятся.

## Решения

- **Тема одна — светлая.** Описание `dark` из `plugins/vuetify.ts` убрано, переключателя и `prefers-color-scheme` нет.
  Цвета — тема Vuetify (`rgb(var(--v-theme-primary))` и т. д.), primary `#1565C0`.
- **Акцент «живой сети»** — тёплый янтарный `#D97706` (`--accent`, в теме Vuetify `accent`). Только активный инструмент,
  выделенный объект и прогресс. Для текста по белому — `--accent-text` `#B45309` (контраст 5,0:1); сам `#D97706`
  на белом даёт 3,4:1 и для текста не годится.
- **Шрифт** — Roboto variable из `assets/fonts`; шкала 12 / 14 / 16 / 20 / 24, основной 14 px, подписи 12 px, не меньше.
  Числа, координаты, давления, расходы — класс `.num` (`font-variant-numeric: tabular-nums`).
- **Движение** — только `transform` и `opacity`; 120 / 200 / 280 мс; вход `--ease-out`, панели — `--ease-spring`
  (критически демпфированная `linear()`, в старых браузерах — `ease-out`); выход быстрее входа.
  `prefers-reduced-motion` обнуляет длительности — анимации сводятся к мгновенной смене состояния.
- **Стекло** — два уровня: `.glass-1` (тулбары, поповеры: `blur(20px) saturate(180%)`, поверхность 78 %) и
  `.glass-solid` (инспектор, формы: 96 %, без blur). Без `backdrop-filter`, при `prefers-reduced-transparency`
  и `prefers-contrast: more` стекло становится плотным. Класс `.map-moving` на корне карты на время
  `movestart…moveend` снимает blur (стоимость стекла при панорамировании — S1 в `performance-baseline.md`).
  Контраст текста на стекле проверять над светлой, спутниковой и тёмной подложкой.

## Токены (`assets/styles/_tokens.scss`, зеркало в `_variables.scss`)

| Группа | Токены | Значения |
|---|---|---|
| Отступы | `--space-1 … --space-6` | 4 / 8 / 12 / 16 / 24 px |
| Радиусы | `--radius-sm / -md / -lg` | 6 / 8 / 12 px (поля и кнопки / плавающие карточки, группы кнопок, меню / окна, шторка) — этап 10, как у Felt |
| Тени | `--shadow-1 / -2 / -3`, `--shadow-ink` | шапка / группы кнопок и меню / карточки и окна; многослойные, «чернильного» оттенка `rgb(24 39 75)`, первый слой — волосяной контур вместо границы |
| Поверхности и текст | `--surface-hover / -pressed / -selected`, `--border-subtle`, `--text-strong / -muted / -faint` | ховер, нажатие, выбранное (primary 8 %); 17,7 / 7,7 / 5,9 : 1 на белом |
| Каркас | `--shell-top`, `--shell-inset`, `--shell-gap`, `--controls-w`, `--toolbar-row`, `--modes-offset`, `--hud-top`, `--corner-btn` | линии плавающих элементов; значения и телефон — `docs/ui-zones.md` |
| Связный текст | `--measure` | 65ch — подсказки, пустые состояния, протокол |
| Z-слои | `--z-map 0 < --z-hud 100 < --z-controls 200 < --z-toolbar 300 < --z-inspector 1010 < --z-popover 2000 < --z-overlay 2400 (= Vuetify v-overlay) < --z-toast 10000 (= v-snackbar)` | свои оверлеи не выше `--z-overlay` |
| Движение | `--duration-fast / -base / -slow`, `--ease-out`, `--ease-in`, `--ease-spring` | 120 / 200 / 280 мс |
| Акцент | `--accent`, `--accent-rgb`, `--accent-text`, `--accent-soft` | `#D97706`, `217 119 6`, `#B45309`, 12 % |
| Стекло | `--glass-1-bg / -filter`, `--glass-solid-bg / -filter`, `--glass-border` | см. выше |
| Текст | `--text-xs … --text-xl`, `--leading` | 12 / 14 / 16 / 20 / 24, 1,45 |

Брейкпоинты — один источник `utils/breakpoints.ts` (600 / 960 / 1280), см. `docs/ui-zones.md`.

Правила кнопок и цвета этапа 10 (`docs/ui-felt-audit.md`): одна залитая синяя кнопка на область; `tonal` без цвета —
второстепенное, `text` — третье, иконки нейтральные (синий только у активного или выбранного); `outlined` — полям и
сегментам. Без капса и разрядки. Стекло — только у шапки; группы контролов и карточки — плотные (`GlassSurface level="solid"`).

## Примитивы

Появляются по мере этапа 2; у каждого — строка здесь, unit-тест в `tests/components` и хотя бы одно реальное место.

| Примитив | Что | Когда применять | Из чего обобщён | Статус |
|---|---|---|---|---|
| `StateView` | загрузка-скелетон / пусто / ошибка с «Повторить» / данные | любой список, таблица, график, форма | 48 локальных спиннеров, 8 текстов «нет данных» | есть: `components/StateView.vue`, тест, применён в `NetworkDiaphragmJournalDialog` |
| `HintTip` | тултип: название, хоткей, одна строка «что сделает» | каждая иконочная кнопка (389) | `v-tooltip` (10 файлов) | есть: `components/HintTip.vue`, тест, применён в `DrawPanel` |
| `SearchField` | debounce, очистка, Esc, счётчик результатов | поиск узлов, фильтры журналов | `NodeSearch`, поле в `MapControls` | есть: тест, применён в `NodeSearch` и фильтрах арматуры |
| `AppSelect` | плотный `v-select`/`v-autocomplete`: поиск при > 50 пунктов (включившись, остаётся), виртуальный список Vuetify, единицы, «создать?» | все 166 списков | `v-select` ×145, `v-autocomplete` ×18 | есть: тест; все списки приложения, кроме `CardFieldEditor` и `SetterValueInput` (серверный поиск) |
| `SegmentedToggle` | переключение режимов с иконкой и подписью, обязательный выбор | режимы, вкладки-фильтры | `v-btn-toggle` ×14, `v-switch` ×12 | есть: тест, применён в `OutageSimulationDialog` |
| `FieldGrid` + `FieldCell` | сетка полей и ячейка: видимая подпись сверху/inline, обязательность, подсказка, единицы, ошибка, readonly / dirty | формы журналов и карточки | `CardFieldEditor`, `SetterValueInput`, `v-row/v-col` форм | есть: тест, применён в форме утверждения плана (`JournalRecordPanels`) |
| `DataTable` | липкая шапка, сортировка, числа вправо, зебра по токенам, выбор строки, виртуализация от 200 строк | журналы, протоколы, диагностика | сырой `<table>` ×35, `v-table` ×23 | есть: тест, применён в «Очереди опрессовок» |
| `KpiTile`, `Sparkline` | плитка числа (подпись · значение · дельта · тренд · состояние) и мини-график inline SVG | шапки журналов, итоги расчётов | чипы качества в журналах (по `dataviz`) | есть: тесты; `KpiTile` — счётчики качества арматуры; `Sparkline` — внутри `KpiTile`, первое реальное место с рядом данных — этап 6 |
| `GlassSurface`, `FloatingToolbar` | стеклянная поверхность по токенам; группа кнопок-инструментов с `HintTip`, активный — акцентом | тулбар, поповеры, панели над картой | `EditorToolbar`, `DrawPanel`, `MapControls` | есть: тесты; `FloatingToolbar` — инструменты редактора топологии, `GlassSurface` — панель измерений; тулбар редактора на токенах стекла |
| `InspectorPanel` | панель справа / окно, вкладки, секции, поиск по полям | карточка объекта, формы записей | `ObjectCardShell` + `useObjectCardLayout` | есть: `components/InspectorPanel.vue`, тест, применён в `AttributePanel` (шапка, действия в слоте `#actions`, поиск и вкладки со счётчиками только в режиме просмотра) |
| `MapPopover` | поповер у точки карты, следует за ней при pan | клик по объекту | `popupStore` + popup MapLibre | есть: `components/MapPopover.vue`, тест; сводка объекта в `AttributePanel` (клик при закрытой карточке). `popupStore` и `mapStore.showPopup` (мёртвый код) удалены |
| `BottomSheet` | 3 положения, свайп | инспектор и графики на телефоне | `useSwipe` | есть: `components/BottomSheet.vue` + `utils/sheetSnap.ts`, тесты; карточка объекта на телефоне (`ObjectCardShell`). Перетаскивание — pointer events (`useSwipe` только горизонтальный тач) |
| `ChartFrame` + `utils/chartOptions` | рамка графика: тема из токенов (светлая/тёмная, числа «1 000»), тултип по оси с единицами и экранированием, кроссхэйр, зум колесом/ползунком/выделением, «сбросить масштаб», PNG, подпись-описание для чтения с экрана | любой график ECharts | `v-chart` с локальными тултипами и `dataZoom` в 3 диалогах | есть: тесты; температурный график, характеристики насоса, пьезометр. Типы серий регистрирует владелец (`use([LineChart])`) |
| `MiniHistogram` + `utils/histogram` | распределение значений столбиками без осей: подпись с медианой и размахом, пустые и нечисловые значения отбрасываются | итог таблицы с числовым показателем | — | есть: тест; анализ режима |
| `MapLegend` + `utils/calculationScale` | легенда цветовой шкалы на карте внизу слева: название, подзаголовок, градиент по долям порогов, подписи с единицами у последнего («≥ 3 м/с»), слот действий; правее открытой панели слоёв (`uiStore.leftInset`). Шкала одна у слоя MapLibre и у легенды | раскраска карты по показателю | пороги в диалоге и в `mapStore` порознь | есть: тест; результаты расчёта |
| `ChartDock` | панель графиков у нижнего края: сворачивается до шапки, карта остаётся видимой и рабочей; справа не заходит на контролы карты и карточку (`rightInset`), свою высоту отдаёт в `uiStore.bottomInset` (перелёт к объекту — над панелью); Esc — стек панелей; на телефоне — `BottomSheet` | графики, которые сверяют с картой | `v-dialog` пьезометра со скримом | есть: тест; пьезометрический график |

### StateView

Пропсы: `loading`, `error` (строка; ошибка важнее загрузки), `empty`, `variant` (`table` | `list` | `form` | `chart` | `card` | `inline`
— форма скелетона), `rows`, `emptyTitle` / `emptyText` / `emptyIcon`, `actionLabel` (событие `action`), `errorTitle`, `retry`
(событие `retry`, по умолчанию есть), `retrying`, `loadingLabel`. Слоты: `default` (данные), `illustration-empty`,
`illustration-error` (иллюстрации этапа 8). Скелетон показывать только при первой загрузке (`loading && !items.length`),
при перезагрузке таблицы с данными — тонкий `v-progress-linear` внутри слота, чтобы не мигать.

```vue
<StateView variant="table" :rows="12" :loading="loading && !items.length" :error="error" :empty="!items.length"
  empty-title="Диафрагмы по выбранным условиям не найдены" action-label="Сбросить фильтры"
  @retry="reload" @action="resetFilters">
  <table class="journal-table">…</table>
</StateView>
```

### HintTip

Пропсы: `text` (название действия в повелительном наклонении), `hotkey` («Esc», «Ctrl+K»), `hint` (одна строка),
`location`, `disabled`, `openDelay` (400 мс). Активатор — слот по умолчанию с `props`, которые надо повесить на кнопку;
`aria-label` у кнопки остаётся. Открывается по наведению и фокусу (клавиатура), закрывается по Esc; на содержимое
можно навести курсор и выделить текст (WCAG 1.4.13, пауза 80 мс на переход). Тач-эквивалент — этап 7.

```vue
<HintTip text="Закрыть панель измерений" hotkey="Esc" location="bottom">
  <template #default="{ props: tip }"><v-btn v-bind="tip" icon aria-label="Закрыть панель измерений" … /></template>
</HintTip>
```

### SearchField

Пропсы: `modelValue`, `label`, `placeholder`, `icon`, `debounce` (200 мс), `loading`, `disabled`, `autofocus`, `density`,
`resultCount` (число → показывается справа, 0 → «ничего», null → не показывать), `ariaLabel`. События: `update:modelValue`
(сразу), `search` (обрезанный текст после паузы; пустая строка — сброс), `clear`, `escape` (Esc на пустом поле),
`enter` (искать сейчас). `type="search"`, очистка крестиком.

### AppSelect

Пропсы: как у `v-select` (`modelValue`, `items`, `itemTitle`, `itemValue`, `label`, `placeholder`, `multiple`,
`errorMessages`, `loading`, `disabled`, `readonly`, `clearable`), плюс `hint`, `units` (suffix), `searchThreshold` (50),
`searchable` (принудительно), `allowCreate` → событие `create(text)` из пункта «Нет варианта … — создать?» или Enter без
совпадения, `search(text)`. При `items.length > searchThreshold` рендерится `v-autocomplete`; длинные списки
виртуализирует сам Vuetify (`VVirtualScroll` в меню), высота меню 320 px. `readonly` показывает значение серым полем без очистки.

### SegmentedToggle

Пропсы: `modelValue`, `items: { value, label, icon?, disabled?, hint? }[]`, `mandatory` (true), `disabled`, `wrap` (true),
`iconOnly`, `ariaLabel`. Семантика — группа кнопок-переключателей (`role="group"` + `aria-pressed`), не radio: у
`v-btn-toggle` нет стрелочной навигации; недоступный пункт виден, с `title` из `hint`.

### KpiTile и Sparkline

`KpiTile`: `label`, `value` (число → `14,9 тыс.`, полное в title; строка — как есть), `units`, `compact`, `digits`, `delta`
(со знаком, тон = направление × `upIsGood`; `deltaLabel` — «за неделю»), `trend` (ряд чисел → `Sparkline`), `status`
(`good` / `warning` / `serious` / `critical` — иконка + цвет, подпись остаётся), `selectable` + `active` → кнопка-фильтр
(`aria-pressed`, событие `select`). Крупное число — пропорциональные цифры, `tabular-nums` только в колонках (`dataviz`).

`Sparkline`: `values` (null — пропуск), `width` / `height` (72×20), `area`, `label` (иначе подпись строится сама:
«12 значений, от 0,8 до 1,4, сейчас 1,2: рост»), `min` / `max` (по умолчанию — диапазон ряда). Линия в приглушённом тоне,
последняя точка — акцент. Без ECharts: десятки экземпляров в виртуальном списке стоят как SVG-пути.

### DataTable

Пропсы: `columns: { key, title, type?: text | number | date | actions, width?, sortable?, align? }[]` (порядок и набор —
как в десктопе), `items`, `itemKey` (`id`), `loading`, `density` (`compact`), `virtual` (null → от `virtualFrom` = 200 строк),
`height` (480, для виртуальной), `selectable` + `selectedKey` → событие `select(item)` мышью и с клавиатуры (строки в табе, Enter / пробел), подсветка
акцентом; сортировка по заголовкам работает сама, `sortBy` + `update:sortBy` — для внешнего/серверного управления
(при серверной пагинации колонкам ставить `sortable: false`), `noDataText`, `loadingText`. Слоты `v-data-table` (`item.<key>`, `top`, `bottom`) проходят
насквозь. Числовые колонки — вправо и `tabular-nums`; длинный текст обрезается (полный — в title/инспекторе);
высота строки одна строка — иначе виртуальная прокрутка Vuetify считает неверно.

### GlassSurface и FloatingToolbar

`GlassSurface`: `level` (`1` — тулбары и поповеры с blur; `solid` — инспектор и формы без blur), `rounded`
(`sm` / `md` / `lg` / `pill`), `padded`, `tag`. Всё оформление — из токенов `--glass-*`; на время движения карты
корень карты получает `.map-moving`, и blur снимается у всех поверхностей уровня 1. Группы контролов карты
(`MapControls`: строка режимов, «вид», зум) — `GlassSurface level="solid" rounded="md"`, кнопки 40 px (тач — 44)
вплотную, активный режим — `--surface-selected` и `aria-pressed`. Режимы — независимые переключатели, поэтому не
`FloatingToolbar` (тот моделирует один выбор).

Масштабная линейка — `utils/mapScaleControl.ts` (`MapScaleControl`, IControl MapLibre): обновляется по `moveend`, без
чтения вёрстки; встроенный `ScaleControl` писал в DOM на каждом кадре движения (замер S1, `performance-baseline.md`).

`FloatingToolbar<T>`: `modelValue: T | null`, `items: { value: T, title, icon, hotkey?, hint?, disabled? }[]`, `mandatory` (true),
`disabled`, `showActiveLabel` (подпись у активного), `tipLocation`, `ariaLabel`. Семантика `toolbar` + `aria-pressed`,
один tab-stop и стрелки / Home / End между кнопками; недоступные — `aria-disabled`, чтобы подсказка объясняла причину;
у каждой кнопки `HintTip` (название · хоткей · строка «что сделает»). Активный инструмент — акцент `--accent-soft` /
`--accent-text`, единственное место акцента на тулбаре.

### FieldGrid и FieldCell

`FieldGrid`: `columns` (`auto` — по `minWidth`, или 1–3; на телефоне всегда одна), `minWidth` (220), `labelPosition`
(`top` / `inline` — наследуют ячейки). `FieldCell`: `label`, `required` (звёздочка), `hint` (иконка «?» с `HintTip`,
доступна с клавиатуры), `units` (справа от поля), `error` (под полем, `role="alert"`), `readonly`, `dirty`
(точка акцента + «изменено, не сохранено»), `span` (на всю ширину), `labelPosition`. Слот по умолчанию получает `id` (повесить на поле, чтобы `label for`
работал), `errorId` (в `aria-describedby`) и `invalid` (в `aria-invalid`); само поле — `v-text-field`/`AppSelect`/`CardFieldEditor` с `hide-details`
(ошибку показывает ячейка). Порядок Tab — порядок ячеек в сетке, как в десктопе.
