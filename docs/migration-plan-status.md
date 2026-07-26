# Статус реализации плана миграции (2026-07-24)

## Backlog переноса gid6/gid8/potr5 → web (2026-07-24)

- **Deploy:** `itwin-api/Dockerfile`, `docker-compose.yml`, [docs/deploy-map-api.md](../../docs/deploy-map-api.md), `scripts/verify_prod_routes.py`, workflow `.github/workflows/api-deploy.yml` (manual; нужны `DEPLOY_SSH_*` secrets).
- **P0 auth:** passlib/bcrypt, UsersDB login, `AUTH_REQUIRED_GET`, `STRICT_AUTH`, LoginDialog (вместо prompt), UsersDB pool в lifespan.
- **P1:** passport `belong*Site` fallback + SQL backfill; расширен `p1_smoke.py`.
- **P2 ТУ:** dedicated CRUD `/api/technical-conditions`, field allow-list, Excel `tu` + `tu-balance` (gid6).
- **P2 ops:** field allow-list на defect/shurf/osmotr/remont2/opres + Word acts с русскими полями.
- **P3:** `POST /api/heat-losses/run` (+ poll в UI), TG stationary UI + recalculate, armature `dampers`/`regularmatures`.
- **P4:** DXF export, ochered RO, `NUXT_PUBLIC_NETWORK_TILESET_URL`.
- **Auth:** `STRICT_AUTH` запрещает `DEV_LOGIN`; публичный `/api/v1/auth/config` для LoginDialog.
- **Анализ:** RO Zap1/2/3/7 (`/api/network-queries/*` + NetworkQueriesDialog); DXF/SHP по выбранному фрагменту.

# Статус реализации плана миграции (2026-07-24)

## Этап B: move-node и safe-delete (2026-07-24)

- **B4 — баг длины исправлен**: `move_node` теперь пересчитывает `heatpipesections.pipesectlength` у всех инцидентных участков (раньше двигал точку, но длина трубы оставалась устаревшей → неверный гидравлический расчёт).
- **B3 — safe-delete**: `delete_node` отказывает (409 с отчётом блокеров), если на узле висят инцидентные линии или ссылки `nodeid` в зависимых таблицах; `cascade=true` — удалить с линиями и паспортами. `delete_line` снимает паспорт `heatpipesections` (1:1) и возвращает отчёт по зависимому оборудованию.
- Отчёты зависимостей (`node_dependency_report`/`line_dependency_report`) проверены на живой БД: узел 594738 → блокер `realconsumers`, линия 2159 → `{dampers:1}`. Пересчёт длин прошёл PREPARE. 13 unit-тестов, smoke 68/68.

## Этап B (редактор топологии): перенос зависимых при разрезании (2026-07-24)

- План: [stage-b-topology-editor-plan.md](stage-b-topology-editor-plan.md).
- Реализованы B1/B2 (за флагом): декларативная карта `SPLIT_TRANSFER_RULES`, перенос оборудования по узлу (регуляторы) и пометка «на ручную проверку» для оборудования без узла/позиции (задвижки, диафрагмы, элеваторы, насосы…), dry-run превью «что перенесётся» без записи.
- **Находка ревью**: у геом.таблиц (углы/люки/опоры/вводы) `lineid` всегда NULL — привязка пространственная, перенос по lineid не нужен. Карта сведена к 3 NODE + 7 REVIEW; все 10 SQL проходят PREPARE на боевой схеме.
- API: `POST /api/topology/split-line` принимает `dry_run` (превью не требует флага записи, только admin). 11 unit-тестов на карту правил, smoke API 68/68.

# Статус реализации плана миграции (2026-07-24)

## Пьезометр: маршрут через несколько узлов + профиль (2026-07-24)

- Выбор направления как в десктопе: клик по узлам по порядку → маршрут через waypoints (`POST /piezometer/route`), подсветка трассы на карте, панель управления (список точек, отмена, очистка).
- График достроен: метки узлов, вкладка «Таблица узлов», экспорт CSV, температуры на второй оси (когда появятся данные), явный статус «расчёта нет».
- Укреплены слои рисования и подсветки маршрута: `addSource` больше не падает на не готовом стиле (повтор по idle). Подробности: [piezometer-route.md](piezometer-route.md).

# Статус реализации плана миграции (2026-07-23)

## Каталог desktop и web-parity (2026-07-24)

- Полный каталог возможностей `gid6` / `gid8` / `potr5`: [docs/desktop-capability-catalog.md](../../docs/desktop-capability-catalog.md)
- Каталог `web-itwin` + `itwin-api`: [docs/web-itwin-api-capability-catalog.md](../../docs/web-itwin-api-capability-catalog.md)
- Gap-матрица desktop → web: [docs/desktop-web-parity-matrix.md](../../docs/desktop-web-parity-matrix.md)

## Панели, устойчивость и полная проверка (2026-07-23, четвёртая итерация)

- **Разделение панелей**: некартографические инструменты (22 журнала/реестра/отчёта) вынесены в выдвижную панель «Инструменты» уровня приложения; рисование и измерения — в отдельную панель на карте; на карте остались только картографические функции. Панели взаимно исключаются.
- **Рисование**: точка/линия/полигон, измерение расстояния и площади, выгрузка GeoJSON — нативно на MapLibre, без mapbox-gl-draw. 9 unit-тестов на геометрию.
- **Отказоустойчивость**: единый API-клиент с таймаутом 30 с, ретраями только на сетевых сбоях/5xx (мутации не повторяются), классом `ApiError` с человеческими сообщениями; баннер деградации API в layout.
- **Масштабируемость API**: настраиваемый пул (`DB_POOL_MAX_SIZE`, `DB_COMMAND_TIMEOUT`), эндпоинт `/health`.
- **Смоук-проверка всех маршрутов** ([scripts/smoke_all.py](../../itwin-api/itwin-api/scripts/smoke_all.py)): 68 OK, 0 ошибок. Найдены и исправлены 3 бага: потерянный параметр `LIMIT` в `/api/calculations/latest`, несуществующая колонка в geojson индикаторов коррозии, 500 вместо 400 на `/line/` с точечной таблицей.

Подробности: [panels-and-reliability.md](panels-and-reliability.md).

## Панель инструментов и отчёты (2026-07-23, третья итерация)

- Панель карты: 25 кнопок → 10; журналы/реестры/диагностика/отчёты собраны в меню «Журналы, реестры и отчёты» (4 группы, 22 пункта с иконками и подписями, поиск). Убран дубль «Диагностика расчётов».
- Исправлены ведомости Excel (падали 500 на несуществующих колонках `nodes.name`/`networkarmatures`/`heatpipesections.diameter`; типы bp/ns/pt не обрабатывались) — теперь данные берутся из тех же функций, что и журналы.
- Исправлены HTML-формы (неверные имена полей), добавлены f13/f14, значения экранируются.
- Паспорт участка: починены импорты `passport_module`, опциональный PyHyphen, psycopg2-подключение вместо ODBC, эндпоинт строит граф участка (`sort_graph.make_graph`). Блокер данных: `nodes.belongMagistralSite/belongDistSite` = NULL у всех узлов.
- **Главная причина «ничего не работает» в production: на `itwin.kz/map-api` развёрнута старая версия API (7 маршрутов из 120). Требуется деплой tgid-server.**

Подробности: [ui-toolbar-and-reports.md](ui-toolbar-and-reports.md).

## Гибкие слои GeoServer (2026-07-23, вторая итерация)

- Автообнаружение всех опубликованных слоёв (WMTS + WMS GetCapabilities) поверх каталога; русские названия из `ows:Title`; слои `id_*` привязаны к базовым как query-слои для GetFeatureInfo; вспомогательные слои — отдельной свёрнутой группой; поиск по слоям в панели; параллельная загрузка стилей. Подробности: [geoserver-layer-discovery.md](geoserver-layer-discovery.md).

## Производительность и стабильность (2026-07-23)

- **Ленивая загрузка диалогов**: 20+ журнальных диалогов, AttributePanel, NodeSearch и PiezometerModal в `MapViewer.vue` переведены на `Lazy*`-компоненты с `v-if`-монтированием. Чанк каждого журнала (включая ECharts) загружается при первом открытии через хелпер `openLazyDialog`, а не в составе бандла карты.
- **Исправлены рантайм-баги WIP**: в `DefectJournalDialog` и `RepairJournalDialog` не была объявлена `visible` (журналы падали при открытии); вызовы несуществующих `mapStore.flyToCoordinates` и `cesiumStore.setCustomData` заменены/убраны; `CalculationProtocol` подключён через `v-model:show`; исправлен мойибейк «Источник».
- **`npm run typecheck` снова зелёный** (было 29 ошибок), unit-тесты проходят.
- **itwin-api разбит на роутеры**: `main.py` (1 918 строк, 116 маршрутов) разнесён по модулям `routers/{core,auth_routes,crud,calc,piezometer,topology,operations,registries,equipment,heat,reports}`. Пути сохранены 1:1 (проверено сравнением таблицы маршрутов), tests/test_auth.py проходят. Логирование вынесено в `app_logging.py`.
- **Excel/Word больше не блокируют event loop**: паспортный Excel-эндпоинт стал sync-функцией (FastAPI выполняет её в thread pool), Word-генерация обёрнута в `run_in_threadpool`. Полная очередь Celery для отчётов — следующий шаг вместе с UX прогресса.

# Статус реализации плана миграции (2026-07-22)

Краткий статус по TODO плана «Анализ переноса TGID Desktop → Web».

| ID | Статус | Что сделано |
|----|--------|-------------|
| P0 | Готово в коде | JWT/RBAC (`auth.py`), allow-list таблиц, `MUTATIONS_ENABLED`, audit helper, `/api/v1` aliases для CRUD/topology/auth, CI [`.github/workflows/api-ci.yml`](../../.github/workflows/api-ci.yml), unit-тесты `tests/test_auth.py` |
| UI drift | Готово | `NUXT_PUBLIC_MUTATIONS_ENABLED` + `useMutationsEnabled`, кнопки записи скрыты в 15 журналах |
| P1 | Чеклист + smoke | [p1-core-acceptance.md](p1-core-acceptance.md), [scripts/acceptance/p1_smoke.py](../scripts/acceptance/p1_smoke.py) — численная приёмка на тестовой БД остаётся за предметником |
| P2 | Каркас CRUD | Gated API + клиент `/api/v1/create|update|delete` + [p2-journal-crud.md](p2-journal-crud.md); полный CRUD ТУ на стенде — после включения флагов |
| P3 | Элеваторы RO | `/api/elevators*`, `ElevatorJournalDialog`, кнопка на карте |
| P4 | Синхрон 2D/3D | `syncedSelection`, `flyToSelection`, `loadNetworkTileset`, [p4-3d-sync.md](p4-3d-sync.md) |

## Включение записи (стенд)

```
# API
AUTH_DISABLED=false
DEV_LOGIN_ENABLED=true   # только стенд
MUTATIONS_ENABLED=true
JWT_SECRET=...

# Web
NUXT_PUBLIC_MUTATIONS_ENABLED=true
```

Меню пользователя → «Войти» открывает LoginDialog; JWT в `itwin_access_token`.
На стенде: `AUTH_DISABLED=false`, `AUTH_REQUIRED_GET=true`, `STRICT_AUTH=true`.
Деплой map-api: [docs/deploy-map-api.md](../../docs/deploy-map-api.md).
