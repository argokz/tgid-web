# Модернизация UI/UX — журнал хода работ

Промт и правила: `docs/ui-modernization-prompt.md`. Этот файл — для продолжения работы в новой сессии:
статус этапов, что переведено, метрики, следующий шаг. Обновлять после каждого принятого шага.

## Статус этапов

| Этап | Статус | Примечание |
|---|---|---|
| 0 — замеры и инвентаризация | **сделан 23–24.10.2026**, ждёт подтверждения | цифры в `docs/performance-baseline.md` («Базовые замеры 2026-10-23»), ниже — узкие места и инвентаризация |
| 1 — производительность и надёжность | **шаги 1а–1в сделаны 24.10.2026**, ждёт решения по рельефу 3D | `64dd752`, `a0c98fe`, правки по ревью; цифры «было → стало» в `performance-baseline.md` |
| 2 — токены и примитивы | не начат | |
| 3 — каркас и зоны | не начат | |
| 4 — тулбар и хоткеи | не начат | |
| 5 — поповер, инспектор, журналы | не начат | |
| 6 — графики | не начат | |
| 7 — движение, drag, адаптив | не начат | |
| 8 — логотип, бренд, подсказки | не начат | |
| 9 — тесты и приёмка | не начат | |

## Стенд для замеров (воспроизвести в любой сессии)

1. API копии БД на 8040 (`auth_disabled`, CORS только для `127.0.0.1:3040` / `localhost:3040`).
2. Worktree `H:\projects\tgid-app\web-itwin-perfbuild` (detached; `git -C … checkout --detach <rev>` перед новой сборкой),
   `node_modules` — junction на `web-itwin\node_modules`, `.env` — копия, в которой `https://itwin.kz/geoserver` заменён на
   `http://localhost:8085/geoserver` (локальный GeoServer отдаёт CORS; `itwin.kz/geoserver` закрыт защитой — с ним слоёв нет),
   `GEOSERVER_INTERNAL_URL=http://localhost:8085/geoserver`, API — `http://127.0.0.1:8040`.
3. `NITRO_COMPRESS_PUBLIC_ASSETS=false npm run build` в worktree (≈10 мин), затем `node scripts/perf-budget.mjs` там же.
4. Превью: `MSYS_NO_PATHCONV=1 PORT=3040 HOST=127.0.0.1 node .output/server/index.mjs` (dev-сервер 3040 должен быть выключен).
5. Из `web-itwin`: `node scripts/perf/measure.mjs --runs=2 --out=scripts/perf/results-<дата>.json`,
   `node scripts/perf/summarize.mjs scripts/perf/results-<дата>.json`; Lighthouse —
   `npx --yes lighthouse@12 http://127.0.0.1:3040/itwin-map/ --preset=desktop --output=json --chrome-flags=--headless=new`.
6. Скрипты `scripts/perf/*` — временный инструментарий этапа 0, не входят в прод-код; `npm run lint` их проходит.

## Узкие места по замерам (симптом → причина → цифра → исправление → ожидаемый эффект)

| # | Симптом | Причина (`файл:строка`) | Цифра (×4 CPU) | Исправление | Эффект |
|---|---|---|---|---|---|
| 1 | Панорамирование 4–10 fps даже без панелей; журнал и панель слоёв почти не добавляют | Сама отрисовка MapLibre: 21 слой GeoServer (из них 20 стилевых слоёв участков с фильтрами по `fileid`), рельеф `terrain-rgb` и 3D-здания включены по умолчанию (`335aaee`), подписи; стеки `triggerRepaint` — только `Map._render`/`_fireMoveEvents` | S1a–c: long tasks 8,3–8,6 с из 10; кадр p95 265–464 мс | Этап 1: замерить без рельефа/зданий и с ними (A/B), сократить число стилевых слоёв (один слой с `match`-выражением вместо 17 слоёв-копий с фильтрами), подписи с `minzoom`; на время `movestart…moveend` — отключать тяжёлые украшения. Стекло панелей не виновато — не ограничивать его заранее | FPS при панорамировании ×2–3; цель 60 fps без троттлинга |
| 2 | Ведение линии измерения — 2,5 fps, 420 мс на движение мыши | `composables/useMapDraw.ts:384–389` `refresh()` → два `setData` на каждый `mousemove` (`onMapMove`, строка ~760), плюс 3 `queryRenderedFeatures` на шаг (привязка `useSnapIndex`/`useContextSnap`) и реактивный `hoverPoint` | S6: setData 402, queryRenderedFeatures 603, triggerRepaint 5 682, long tasks 65,6 с на 200 шагов | rAF-троттлинг `onMapMove` (один `setData` на кадр), `hoverPoint` → не реактивный, привязка по индексу без `queryRenderedFeatures` на каждом шаге | ≥ 30 fps при рисовании |
| 3 | Смена фрагмента — 20 с, 4 fps | `stores/layerStore.ts` `applyFragmentFilter`: 45 `setFilter` на одно применение (по стилевому слою) + пересоздание источника (`add/removeSource`) | S8a: setFilter 90, long tasks 16,9 с | Фильтр фрагментов — через `setFeatureState`/один `match`-фильтр на объединённый слой или `viewparams` только там, где нужно; батч в один кадр | смена фрагмента < 2 с |
| 4 | Выключить/включить слой — 9,4 с | `layerStore.applyVisibleLayersSelection` → 20 `setLayoutProperty` + `updateLayerOrder` → 23 `moveLayer` на одно переключение | S8b: setLayoutProperty 40, moveLayer 46 | не трогать порядок, если он не изменился; `visibility` батчем | < 1 с |
| 5 | Изменение ширины панели карточки — 185 мс на шаг, 56 перерисовок карты | `components/objectCard/ObjectCardShell.vue:65,89–107`: ширина пишется в реактивный `layout.panelWidth` на каждый `pointermove` → перерисовка `AttributePanel` (39 064 DOM-узлов на странице) и `watch(deep)` в `useObjectCardLayout.ts:53` (сохранение в `appStorage` на каждый шаг); карту дёргают события `sourcedata` (подсветка выбранного объекта) | S4a: 14,3 с long tasks, layout 883 мс | Этап 7: drag/resize через `transform`/`width` в rAF без записи в реактивное состояние до `pointerup`; сохранение — debounce; перетаскивание окна (S4b, 49 fps) уже приемлемо | 60 fps при resize |
| 6 | Открытие карточки участка — 4,9–5,8 с, кадр до 1,6 с | `mapStore.selectFeature` (`stores/mapStore.ts:968–1240`): запросы данных, `structuredTabs`, добавление 5 слоёв подсветки; затем монтирование `AttributePanel.vue` (2 781 строка, 9 чанков / 155 KiB, DOM +6 000) | S3a: long tasks 3,4 с, 9 чанков 155 KiB | Этап 5: `InspectorPanel` с вкладками, ленивыми секциями и `v-memo`; чанк карточки разбить по вкладкам; подсветку — одним источником | < 1,5 с до интерактивной карточки |
| 7 | Первое открытие журнала — 8–10 с, кадр до 2,6 с | `v-dialog` + таблица 50 строк + 6 `v-select` + фильтры: style 775 мс, layout 494 мс, DOM +6 700 узлов; ленивый чанк всего 29 KiB — узкое место не загрузка, а первый рендер Vuetify-форм | S3b | Этап 5: `DataTable` с фиксированной высотой строки, `AppSelect` ленивый (список рендерится при открытии), `StateView`-скелетон вместо пустого диалога | < 2 с |
| 8 | Открытие `v-select` с 36–57 пунктами — 1,8–2,5 с | Vuetify `VSelect` рендерит все пункты + `v-list-item` каждый с иконками/ripple; style 565–673 мс | S9 | `AppSelect`: `v-autocomplete`/виртуальный список при > 50 пунктов, плотные пункты без ripple | < 300 мс |
| 9 | Курсор по графику пьезометра — 14 fps | ECharts-тултип + DOM-подписи: 338 пересчётов стилей на 150 шагов (1 504 мс), `VChart` c реактивным `option` | S5 | Этап 6: `tooltip` в `renderMode: 'richText'`/canvas, `setOption` только с изменениями, связь с картой через rAF | ≥ 30 fps |
| 10 | Lighthouse Performance 40–42 (desktop), 26 (mobile); TBT 2–2,4 с | `vuetify.*.css` 384 KiB render-blocking (747 мс, 92 % не используется); JS критического пути ≈ 1,8 MB до первого кадра карты (Vuetify 302, MDI 73, maplibre 785, mapStore+index 244, MapViewer 163, layout 82 с пятью статическими диалогами); тайлы рельефа и зданий 4,5 MB при старте; 5 с bootup в документе (inline/eval — установить, что это) | S0 | Этап 1: мёртвые зависимости, ленивые диалоги шапки, рельеф/здания — по требованию или после первого кадра, Vuetify-стили только нужных компонентов (treeshake `vite-plugin-vuetify` уже есть — проверить, почему CSS полный), иконки — только используемые (уже так, но 73 KiB) | Performance ≥ 70 на этапе 1, ≥ 90 к этапу 9 |
| 11 | Ввод в поле журнала и прокрутка страницы журнала — в норме | S2 45 fps без long tasks; S7 53 fps (50 строк) | — | ничего; виртуализация таблиц нужна не ради FPS, а ради «рабочего места» без пагинации | — |

Опровергнутые гипотезы: пять `deep: true`-watcher'ов в `MapSidebarPanel.vue:993–1109` лишь копируют массивы id в черновики
`pending*` и MapLibre не дёргают; `CursorCoords.vue:148` пишет `point` на каждый `mousemove`, но это одна строка текста —
в S1 стоимость не видна (style 0 мс); `useSnapIndex`/`useContextSnap` уже на `shallowRef`; `v-dialog eager` стоит в
четырёх журналах, на копии БД в них 0–1 запись, стоимость — только монтирование формы (проверить в этапе 1 на проде);
`VChart` в трёх диалогах размонтируется с `v-if`, утечки инстансов нет.

## Инвентаризация элементов UI (по коду на 2cbe85c)

| Элемент | Мест | Вариантов реализации | Целевой примитив |
|---|---|---|---|
| Окна `v-dialog` | 70 файлов / 94 тега (журналы 20, расчёты и диагностика 12, редактор топологии и превью 9, справочники и админка 7, карточка и её помощники 4, прочие 18) | ленивые через `openLazyDialog` (42 в `toolDialogs`) + статические в `layouts/default.vue` (5) + в `MapViewer` (14 `Lazy*`) ; 4 с `eager` | `InspectorPanel` для формы записи (а), полноэкранное окно на примитивах (б); ленивые все |
| Таблицы | сырой `<table>` 17 файлов / 35; `v-table` 19 / 23; `v-data-table(-server)` 5 (справочники, аудит, расчёты, пользователи); `v-virtual-scroll` 1 (`FeatureMenu`) | 3 | `DataTable` (над `v-data-table`/`-virtual`) |
| Выпадающие списки | `v-select` 42 файла / 145; `v-autocomplete` 15 / 18; `v-combobox` 2 / 3 | 3, без поиска внутри и виртуализации | `AppSelect` |
| Текстовые поля | `v-text-field` 53 / 188; `v-textarea` 8 / 8 | label сверху/inline вперемешку | `FieldGrid` |
| Переключатели | `v-tabs` 18; `v-btn-toggle` 14; `v-switch` 8 / 12; `v-checkbox` 22 / 48; `v-radio-group` 9 / 12 | 5 | `SegmentedToggle` (режимы), остальное — токены |
| Прогресс/загрузка | `v-progress-circular` 35 файлов / 43; `v-progress-linear` 23 / 39; `v-skeleton-loader` 0 | у каждого диалога свой спиннер | `StateView` (скелетон) |
| Пустые состояния | 8 вариантов текста («Ничего не найдено» 8, «Нет данных» 2, «Записей нет» 2, «Список пуст» 1, …); `v-empty-state` 0 | ≥ 8 | `StateView` (пусто/ошибка/повторить) |
| Ошибки | `v-alert` 62 файла / 166; `v-snackbar` 5; `plugins/errorHandler.ts`; `NuxtErrorBoundary` 0 | 3 | `StateView` + граница ошибок у ленивых диалогов |
| Иконочные кнопки | `v-btn` 644, из них с `icon` 389 (AttributePanel 36, PressureTest 14, MapControls 14, Repair 13, …) ; `v-tooltip` 10 файлов / 71; `aria-label` 73 / 273 | подсказка у ~18 % кнопок | `HintTip` у 100 % |
| Меню | `v-menu` 7 / 10; `EditorContextMenu`, `FeatureMenu` | 3 | стиль примитивов, клавиатура |
| Поиск | `NodeSearch` (debounce через `setTimeout`), поиск в `MapControls` (стекло), поля фильтров журналов | 3 | `SearchField` |
| Графики | `VChart` 3 (пьезометр, насосы, температурные графики) | 1 | тема ECharts из токенов, `Sparkline` inline-SVG |
| Стекло | `backdrop-filter` 2 (`EditorToolbar.vue:615`, `MapControls.vue:1050`) | 2 | `--glass-1` / `--glass-solid` |
| Движение | `prefers-reduced-motion` 0; анимации — локальные `transition` | — | токены длительностей/easing |
| Брейкпоинты | `useMobile` 768/1024; `_variables.scss` 600/768/960 | 2 источника | один |
| Хоткеи | `keydown` в `useMapDraw.ts:777`, `useTopologyEditor.ts:1707`, `CursorCoords.vue:200`, `layouts/default.vue:457`; описание в `EDITOR_HOTKEYS` | 4 обработчика без реестра | один реестр |

Полный список `v-dialog`-компонентов по категориям:
- журналы (20): Alseko, CorrosionIndicator, Defect, ElectricalNetwork, Elevator, HeatLoss, Inspection, NetworkArmature,
  NetworkBypass, NetworkDiaphragm, NetworkRegulator, OcheredOpressovok, PressureTest, PumpEquipment, Repair, Shurf,
  TechnicalCondition, TemperatureGraph + `JournalRecordPanels`, `JournalBatchApprovalDialog`;
- расчёты и диагностика (12): CalculationsDialog, CalculationProtocol, CalculationDiagnosticsModal, ConsumerLoadDiagnostics,
  FaultDiagnosticsModal, TopologyDiagnosticsModal, RegimeAnalysis, HydraulicThematic, ThrottlingCalculator, OutageSimulation,
  PlanningCalculationModal, WearIndex, DataQuality, NetworkQueries, PiezometerModal, PiezometerDirections;
- редактор топологии и превью (9): Chain/Delete/Merge/Reverse/SplitPreview, CoordPoint, LineType, NodeType, BendResistance,
  EditHistoryPanel, FragmentTransfer, GroupSetter, NetworkImport;
- справочники и админка (7): Dictionaries, UsersAdminDialog/Panel, UserPermissions, Account, ChangePassword, Login,
  ActivityLog, AuditHistory;
- карточка (4): `objectCard/ObjectCardEdit`, `CardHelperDialog`, `ConsumerSchemeDialog`, `ai/TuConnectionDialog`;
- прочие: Passport, PtsSites, ExcelReports, PrintLayout, HotkeysHelp, ConfirmDialogHost, NodeSearch, MapSidebarPanel
  (вложенный диалог стиля слоя); плюс `AiAnswerPanel` (не `v-dialog`).

## Чужой WIP в рабочем дереве (на 24.10.2026)

Незакоммиченные правки другой сессии — перевод цветов на токены темы (`#fff` → `rgb(var(--v-theme-surface))`,
`grey-darken-1` → `secondary`): `AttributePanel.vue`, `ElectricalNetworkJournalDialog.vue`, `HeatLossJournalDialog.vue`,
`MapControls.vue`, `MapSidebar.vue`, `MapSidebarPanel.vue`, `MapViewer.vue`, `PiezometerModal.vue`,
`PumpEquipmentJournalDialog.vue`, `TemperatureGraphJournalDialog.vue` (63 строки). `plugins/theme.client.ts` в дереве нет.
Эти файлы не править, пока WIP не закоммичен.

## Этап 1 — ход работ

### Шаг 1а (`64dd752`, 24.10)
- Мёртвые зависимости убраны (`@mapbox/mapbox-gl-draw`, `three`, `threebox-plugin`, `@fontsource-variable/roboto`, `@types/mapbox-gl`) —
  на бандл не влияют (их и не было в манифесте), `package-lock` короче.
- `layouts/default.vue`: протокол расчёта, окно расчёта, вход, кабинет, смена пароля — `Lazy*` при первом открытии.
  Чанк шапки 82 → 16 KiB, его CSS 8 → 1 KiB, в `modulepreload` на 2 файла меньше (12 → 10, 822 KiB).
  `perf:budget` считает «критический путь» только по статическому графу `entry` — 570 KiB не изменились; отложенный
  JS по-прежнему 7 597 > 7 500 (Cesium 4,7 MB) — бюджет надо пересмотреть, а не «починить».
- `useMapDraw`: mousemove → один запрос привязки и один `setData` черновика на кадр.
- `ObjectCardShell`: drag/resize пишут в `style` корня по rAF, в реактивный layout — на `pointerup`; сохранение
  размещения с задержкой 300 мс.
- `errorHandler` + `utils/staleChunk.ts`: устаревший чанк после выкатки → предупреждение с кнопкой «Обновить».
- Приведены в порядок `typecheck` на HEAD (`ToolEvent`, `TuConnectionQuery`) и тест каталога инструментов;
  остающиеся 3 ошибки `useChartTheme` — из чужого WIP.

### A/B рельефа и зданий (та же сборка, CPU ×4, 1 прогон, `--context-off`)

| Сценарий | Как есть (рельеф + здания) | Без рельефа 3D | Без зданий | Без обоих |
|---|---|---|---|---|
| S1a панорамирование, панель слоёв | 6,9 fps, long tasks 11,4 с | 21,9 fps, 4,3 с | 6,7 fps | **34,5 fps, 2,5 с** |
| S1b только карта | 5,6 fps | 25,4 fps | 9,7 fps | **40,1 fps** |
| S1c + журнал | 10,8 fps | 29,4 fps | 9,7 fps | **42,8 fps** |
| S3a карточка | 4,2–6,0 с | — | — | 3,9 с |
| S4a resize панели (после 1а) | 14,5–35,8 с | — | — | **9,5 с, 35,8 fps** |
| S6 ведение линии (после 1а) | 91–101 с, 2,2 fps | — | — | 29,9 с, 6,8 fps |
| S8a смена фрагмента | 20,0 с | — | — | **4,4 с** |
| S8b переключение слоя | 9,4 с | — | — | **3,0 с** |

Вывод: рельеф 3D (`terrain3d`, включён по умолчанию с `335aaee`) — главная цена всего интерфейса: с ним MapLibre
рисует каждый слой через текстуры рельефа, кадр карты ~380 мс при ×4 CPU, и любые правки Vue-слоя тонут в этом.
Здания сами по себе почти бесплатны, но вместе с рельефом дорожают. **Решение нужно от заказчика:** рельеф 3D
выключен по умолчанию (переключатель остаётся в «Слоях контекста») либо включается только в режиме 3D/наклона.
Остальные сценарии после 1а на фоне рельефа статистически не различимы (разброс между прогонами до 2×).

### Механика MapLibre, найденная по стекам (для S8 и этапа 5)
- `setFilter` и `setLayoutProperty` на векторном слое помечают **весь источник** на перезагрузку
  (`style.ts: _updateLayer → _updatedSources[source] = 'reload'`): переключение видимости слоя — это повторный разбор
  всех его тайлов, а не «скрыть». Смена фрагмента вдобавок меняет `viewparams` в адресе тайлов → полная перезагрузка.
  Дешёвого обхода нет: прятать через paint-opacity ломает хит-тест и подписи. Оставлено как есть; снижать — числом
  стилевых слоёв (20 слоёв участков → 1–2 с `match`), это этап 1в после решения по рельефу.
- `moveLayer` источник не перезагружает — 23 перестановки на переключение слоя дёшевы.
- Делегированные `map.on('mouseenter'|'mouseleave'|'mousedown', layerId)` заставляют MapLibre делать
  `queryRenderedFeatures` на каждом mousemove — по одному на подписку. В `useMapDraw` три такие подписки на слой
  вершин давали 2 лишних запроса на движение (S6: 603 на 200 шагов). Убраны в шаге 1б.

### Шаг 1б (`a0c98fe`) и 1в (правки по ревью, 24.10)
- `useMapDraw`: делегированные события слоя вершин заменены одним запросом на кадр (S6: QRF 603 → 201); кеш списка
  слоёв сети до `styledata`; в режиме без инструмента — только хит-тест вершин; курсор «переместить» в радиусе 8 px
  (совпадает с точечным mousedown); последний кадр перетаскивания вершины не теряется; курсор сбрасывается при смене
  режима и очистке.
- `fastApiService.apiHealth.retrying` + баннер «Сервер не ответил — повторяем запрос…» (ретраи только для чтения).
- Ленивые диалоги шапки: `watch(open, …, { immediate: true })` в `LoginDialog`, `AccountDialog`, `ChangePasswordDialog`,
  `PlanningCalculationModal` — ленивый компонент монтируется уже открытым, без `immediate` код «при открытии»
  (конфиг входа, вкладка кабинета, Tн и фрагменты расчёта) не выполнялся (HIGH из ревью `vue-reviewer`).
  Лог расчёта и id протоколов буферизуются в layout до монтирования `CalculationProtocol`.
- `ObjectCardShell`: `pointercancel`, сброс inline-style на `pointerup`, resize окна пишет весь результат `clampFloat`.
- `errorHandler`: флаг «уже показали» ставится после показа, `catch` логирует; `app:chunkError` всегда ведёт к
  «Обновить». `useObjectCardLayout`: сохранение на `pagehide`.
- `browserslist`: `iOS >= 16`, `last 2 ChromeAndroid versions`.
- Ревью: `vue-reviewer` (1 HIGH, 5 MEDIUM, 8 LOW — все закрыты), `silent-failure-hunter` (1 HIGH, 2 MEDIUM, 5 LOW — закрыты).

### Шаг 1г–1д (24.10): рельеф выключен, объединение подслоёв — без выигрыша
- Решение заказчика: «Рельеф и 3D» выключен по умолчанию (`DEFAULT_CONTEXT_LAYERS = ['buildings']`), переключатель
  остаётся; `utils/mapDefaults` версия 3 стирает только сохранённые слои контекста, подложку не трогает.
- `utils/mergeStyleLayers`: 16 линейных подслоёв участков → 8 (сливаются только доказуемо непересекающиеся классы:
  первая версия теряла подачу, потому что участок с `pod=1` и `obr=1` стиль рисует дважды). Замер на одной сборке,
  рельеф выключен, CPU ×4: 20 слоёв — S1 27,3 / 30,9 / 28,8 fps, S8a 5,1 с, S8b 1,2 с; 12 слоёв — S1 25,7 / 27,6 / 28,2 fps,
  S8a 4,8 с, S8b 1,8–1,9 с. **Выигрыша нет**: цена MapLibre здесь на объект и тайл, а не на слой. Оставлено как
  опция `GEOSERVER_MERGE_STYLE_LAYERS=true` (по умолчанию выключено), снимки до/после совпадают.
- Итог этапа 1 при умолчаниях (рельеф выключен, здания включены): S1 27–31 fps (было 4–10), S4a 9,2 с (22,4),
  S6 27–28 с (84,5), S8a 4,8–5,1 с (20,0), S8b 1,2–1,9 с (9,4). Lighthouse — повторить в этапе 9, после `vuetify.css`.

### Не сделано в этапе 1 и почему
- Граница ошибок вокруг ленивых диалогов — `openLazyDialog` и `Lazy*` живут в `MapViewer.vue`, занятом чужим WIP.
- ECharts (`notMerge`, `autoresize`) — `PiezometerModal` в чужом WIP (там же появился `useChartTheme`).
- Декомпозиция `AttributePanel`/`MapViewer` — оба в чужом WIP; S3a показывает 3,2–4,8 с long tasks при открытии карточки.
- Vuetify CSS 384 KiB render-blocking (92 % не используется): утилиты Vuetify отключаются через SASS-конфиг
  (`styles: { configFile }`), который в этом проекте раньше ломал стили (см. комментарий в `nuxt.config.ts`) — этап 2.
- Виртуализация журналов — не нужна для FPS (S7: 53 fps на странице 50 строк), остаётся задачей этапа 5 («рабочее место»).

## Следующий шаг

**Нужно решение заказчика по рельефу 3D** (см. A/B выше): (а) `terrain3d` выключен по умолчанию, переключатель остаётся
в «Слоях контекста»; (б) включён, но только при наклоне карты / в режиме 3D; (в) оставить как есть и принять 5–10 fps
на слабых машинах. После решения — шаг 1г: число стилевых слоёв участков (20 → 1–2 с `match`-выражениями, это и S1, и
S8), затем повторный полный замер S0–S9 и закрытие этапа 1. Пункты, заблокированные чужим WIP (`MapViewer`,
`AttributePanel`, `PiezometerModal`), — после его коммита.

Ранее: ждать подтверждения этапа 0. Этап 1 начать с безрисковых пунктов: мёртвые зависимости → ленивые диалоги `layouts/default.vue`
→ A/B-замер рельефа и зданий → rAF в `useMapDraw` → фильтры фрагментов и переключение слоёв батчем.
