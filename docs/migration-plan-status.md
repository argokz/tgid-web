# Статус реализации плана миграции (2026-07-23)

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

Меню пользователя → «Войти (dev)» сохраняет `itwin_access_token`.
