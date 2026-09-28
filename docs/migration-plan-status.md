# Сводный статус переноса (2026-09-28)

Документ заменяет версии от 25.09 («все фазы 100 %») и 26.09 — обе были недостоверны.
План этапов 0–11: `C:\Users\Danko\.claude\plans\whimsical-humming-castle.md`.
Тот же текст лежит в корне монорепо `H:\projects\tgid-app\MIGRATION_ROADMAP.md` (корень не в git).
Ниже — журналы отдельных итераций; где они расходятся со сводкой, верна сводка.

### Где что

- `itwin-api/` → github.com/argokz/tgid-server: FastAPI + asyncpg + Celery/Redis, движок sety.
- `web-itwin/` → github.com/argokz/tgid-web: Nuxt 3 + Vuetify + MapLibre + Cesium.
- Эталоны (только чтение): `gid8/` (Qt), `gid6/` (SQL, формы, excel2), `potr5/`.
- Проверки ведутся на копии `almatygid_copy` / `usersdb_copy` (дамп `H:\tgid-backups\2026-09-25`),
  паспорта — на `astanagid_2026_03_17` (только чтение). **Прод (itwin.kz/map-api) не обновлён**:
  там старая версия API.

### Этапы 0–11: что сделано

Хеши: A — tgid-server, W — tgid-web.

| Этап | Статус | Коммиты / документы |
|---|---|---|
| 0. Секреты | код — готово; смена паролей БД/GeoServer, приватность репо, чистка истории — за админом, не подтверждено | A 7b233f1, 9937c1e; W 67ed5ae |
| 1. Бэкап и копия | готово: дамп прода, `almatygid_copy` с маркером `_this_is_copy`, `.env.copy` | — |
| 2. Стабилизация 24–25.09 | готово: колонки `ut_out`, калькулятор шайб/элеваторов, ТГ ОТОП, merge/reverse/geometry с проверками, JWT на всех `/api` | A 6ed77cd, 697bc47, 1f680d3, 70f2a59, 6558f3b, 4838dd9, dddc7c0; W 3197493, eaa8e34 |
| 3. Гигиена репо | готово: мусор удалён, `files/kls`/`tab` в репо, CI на все тесты | A 7a32672, c613234; W 386564b |
| 4. Выкатка read-only на прод | **не сделано** (нужен доступ к серверу) — см. чек-лист ниже | `docs/deploy-map-api.md` |
| 5. Численная приёмка sety | веб = исходники десктопа (0 расхождений); с расчётом десктопа №1 совпадение при `-no_kv` у 936 из 955 потребителей, остаток — испорченные на копии входные данные | A 9645d5b, e276d97, ba9f161, d6b3604; `itwin-api/docs/acceptance-numeric.md` |
| 6. Паспорта и анализ | паспорт f1–f15 на PostgreSQL (строится на Астане, в Алматы пуст по данным); запросы «Анализ», Zap4/5/6/7_1, время доезда; режимы sety (список, аварийный), список/удаление расчётов | A d11ed4d, 4b661dd, 91402a5, 40171ff, fafe001, 2042ead, e3572a3; W 1ac8258, 2699b2b, 63995e5; `itwin-api/docs/passport.md` |
| 7. Безопасность и роли | готово: роли viewer/editor/calculator/admin, allow-list SQL-имён, админка пользователей, история правок (`audit_log`) | A 41238d8, 1d1ee1d, efecce7, 5d66389; W b9d0012, 3eb1b7a, 2696f59 |
| 8. Редактор топологии (Stage B) | готово на копии: оптимистичные блокировки, полный merge, reverse dry-run, журнал отмены, golden B7 | A 9e67c42, 6c71178, dba42a7; W 584c95c, 670aef6, 4d7c64e, 36aa725; `web-itwin/docs/stage-b-acceptance.md` |
| 9. Паритет P1 | журналы с записью (контуры, утверждение планов, документы), групповые установщики `aSet*` и справочники, Excel-отчёты gid6 excel2, теплопотери poteriNewPg (норм./факт.), ТГ ПОВ/СКК, диафрагмы, правка оборудования, участки ПТС | A 72710c1, 93dbe97, fb7f21d, b599950, a3b3233, 6abe1fc, b507b2a, c430586, 66e71c5, 78f7898, 8cd4828; W b3f1e2d, 99e1fa6, 0ff95d6, 3d88b0e, 3faad82, 49b6fdd, 6337c6a, ad5427c; `web-itwin/docs/journals-parity.md`, `group-setters-parity.md`, `reports-parity.md` |
| 10. Паритет P2 | печать A4/A3, экспорт GeoJSON (+атрибуты, бывш. «Zulu»), импорт SHP/Excel/координат, фрагменты .tgid (экспорт/импорт/слияние), двойной/статический пьезометр, 3D-тайлсет и VISICOM из env, сверка/привязка АЛСЕКО и электросети | A 04a38de, 23a5ee2, f3a313f, 8ca7967, 42d5eb2, d391439, 5680967; W bb516e9, 58a8ea0, 4f89973, a9df1b3, ba80960, f0a886f, 49895cb, 66649d3 |
| 11. Техдолг | MapViewer разрезан (useLocateMarkers, useOverlayLayer, useTopologyEditor, каталог инструментов); мойибейк и «только пробелы»; lint 0 ошибок; компонентные тесты; e2e-smoke Playwright; `declarative_base` из `sqlalchemy.orm`; тяжёлые выгрузки через Celery (file-jobs); единицы нагрузок | W 89b15c1, 8982f3e, 38519c6, d2267e2, 863d074, 889f30c, 9cd8d5d, 1e4cd98, 85071ac, 6051545; A a3f68b5, 7f3075c, de19478; W 515f4df, 5056359, 2be248e; `itwin-api/docs/consumer-loads.md` |

Фоновые выгрузки (этап 11): `POST /api/v1/file-jobs {kind, params}` → `GET /api/v1/file-jobs/{id}` →
`GET …/download`; виды: `passport`, `report_excel`, `catalog_report`, `alseko_reconciliation`,
`electrical_reconciliation`. Файл хранится в Redis `FILE_JOBS_TTL` (1 ч), очередь — `FILE_JOBS_QUEUE`.
Веб (`fastApiService.runFileJob`) показывает прогресс и, если API старый, нет Redis или воркер 30 с не
берёт задачу, переходит на прежний синхронный эндпоинт. Синхронные эндпоинты сохранены.

### Как проверено

- **API**: pytest 715 (полный прогон ~10 мин, включая golden теплопотерь), `app.openapi()` — 255 путей.
- **Web**: `npm run typecheck` 0 ошибок, vitest 204, lint 0 ошибок (≈2300 форматных предупреждений),
  e2e-smoke Playwright 5/5 (`npm run e2e`, локальный стенд dev 3040 + API 8040 на копии; не в CI).
- **Численная приёмка sety** (`docs/acceptance-numeric.md`, `scripts/golden/compare_calc.py`): веб ↔
  исходники десктопа — 0; отображение карта/Excel/пьезометр = `ut_out`/`us_out`, расхождений 0;
  формулы калькулятора, ТГ, теплопотерь — golden-тесты против Python-кода десктопа.
- **Топология** — golden B7 split/merge/delete/move/reverse на копии (`stage-b-acceptance.md`).
- **Паспорт** — все 15 форм на `astanagid_2026_03_17` (участок МС 19: 124 КБ, ~15 с; через Celery то же).
- **Фоновые выгрузки** — временный воркер на отдельной очереди: паспорт (Астана) 14 с, отчёт out_ut
  фр. 74 8,6 с (1,5 МБ), сверка АЛСЕКО 12,7 с (1,5 МБ), ТУ-баланс и электросеть < 1 с, ошибки
  («Узел не найден», «Нет отчёта») доходят до UI.
- **Не подписано экспертом**: результаты расчёта (нужен окончательный прогон «ноль в ноль», см. ниже),
  содержимое паспортов (нужны образцы десктопа), отчёты excel2 на реальных данных.

### Известные проблемы данных

- **Паспорта Алматы пусты**: трубы не привязаны к участкам ПТС (0 из 98 019 `heatpipesections`);
  в Астане привязано 77 230 из 191 068. Привязка — инструмент «Участки ПТС» (`passport.md`).
- **Копия, фрагмент 74**: проверка `-save_po` 27.09 обнулила нагрузки 24 обобщённых потребителей
  (так работает движок десктопа); SQL восстановления — в `acceptance-numeric.md`. Расчёт десктопа №1
  считался без Kv, флаг `-no_kv` в `calc_params` не пишется.
- **Теплопотери**: результатов десктопного модуля в БД нет (сверять не с чем); на копии нет баков,
  обвязки, сливов САРЗ и данных `*Fact`.
- **Гидростатические зоны Алматы** — мусор: отметки узлов 0/1 м.
- **Нагрузки** (`consumer-loads.md`): единицы Гкал/ч, ошибки единиц нет; фрагменты — копии одной сети
  (91/93/95/97 совпадают), суммы по всей базе завышены; выбросы 711 Гкал/ч (~10 фрагментов) и
  456 565 Гкал/ч (удалённый узел) — проверить эксперту. `nagruzki` АЛСЕКО — ккал/ч. Исправлено:
  модель отключения и диагностика нагрузок считали технологию как ГВС и не учитывали ГВС.
- **Excel-отчёты** (`reports-parity.md`): на фр. 74 данные в 19 из 26 книг; пусты `dr_out`,
  `bypass`, `bp_out`, `nst_out`, регулирующая арматура.
- **Справочники** (`group-setters-parity.md`): пусты `responsibles`, `gvsloadgraphs`, `districts`,
  `administrativedistricts`, `heatpoint`.
- **Журналы** (`journals-parity.md`): журнал ремонтов gid6 пуст — эталоном не служит; факторы риска
  требуют привязки труб к участкам.
- **Узлы без `externalcodeid`**, созданные веб-редактором до 27.09, не видны на карте и в расчёте —
  `sql/fixes/20260927_nodes_without_externalcode.sql`.
- **Электросеть** в Алматы пуста (данные есть в Астане).

### Чек-лист выкатки на прод

Порядок: свежий бэкап → миграции → API → воркер → веб → проверка. Точка отката — бэкап и прежний контейнер.

1. **Бэкап**: `pg_dump -Fc` сетевой БД (`almatygid`) и `usersdb` перед любыми миграциями.
2. **Миграции**
   - UsersDB (alembic, `itwin-api/itwin-api/migrations`): `alembic upgrade head` — ревизии
     `60f9094f81af` (таблицы), `fd215dfad484` (`is_admin`), **`b7c1e2d3f4a5` (`users.role`)**.
   - Сетевая БД (psql, вручную, идемпотентно):
     `sql/migrations/20260927_topology_undo_log.sql` (журнал отмены топологии; без неё отмена недоступна),
     `sql/migrations/20260928_heat_losses_report_out.sql` (листы теплопотерь; без неё запуск → 503).
   - Исправление данных (по решению, сначала посмотреть выборку первого SELECT):
     `sql/fixes/20260927_nodes_without_externalcode.sql`.
   - На 28.09 других миграций в `sql/migrations` и alembic нет.
3. **Env API** (`itwin-api/itwin-api/.env` на сервере)
   - БД: `DB_HOST/PORT/NAME/USER/PASSWORD` (новый пароль из этапа 0), `USERS_DB_*`, `SPRAV_DB_*`;
     пул `DB_POOL_MIN_SIZE/MAX_SIZE`, `DB_COMMAND_TIMEOUT`.
   - Авторизация: `AUTH_DISABLED=false`, `STRICT_AUTH=true`, `AUTH_REQUIRED_GET=true`,
     `DEV_LOGIN_ENABLED=false`, `JWT_SECRET` ≥ 32 байт, `JWT_EXPIRE_MINUTES`, `AUTH_LIVE_USER_CHECK`.
   - Флаги записи: на первой выкатке `MUTATIONS_ENABLED=false`, `TOPOLOGY_MUTATIONS_ENABLED=false`;
     включать только после приёмки на копии.
   - Redis/Celery: `REDIS_ADDR`, `REDIS_PASSWORD`; очереди `HEAT_LOSSES_QUEUE`, `FILE_JOBS_QUEUE`
     (пусто — основная), `FILE_JOBS_TTL` (с, по умолчанию 3600).
   - **CORS**: `CORS_ALLOWED_ORIGINS` — список через запятую; по умолчанию
     `https://itwin.kz,http://localhost:3000,http://localhost:3007`; для прода оставить только прод-домены.
   - `FILES_DIR` (Word/файлы), `PYTHONUTF8` (кодировка вывода sety).
4. **Воркер Celery**: перезапустить на новом коде (иначе нет задач `build_file_job`, `run_heat_losses_norm`);
   если заданы отдельные очереди — воркер с `-Q celery,<очереди>`. Redis обязателен для расчётов,
   теплопотерь и фоновых выгрузок (без него веб переходит на синхронные эндпоинты).
5. **Env web** (сборка Nuxt): `NUXT_PUBLIC_MAP_API_BASE_URL`, `NUXT_PUBLIC_GEOSERVER_URL`,
   `NUXT_PUBLIC_MAPTILER_KEY`, `NUXT_PUBLIC_VISICOM_TILES_URL` / `_KEY` / `_SCHEME` / `_ATTRIBUTION` /
   `_MAX_ZOOM` (без ключа подложки VISICOM нет), `NUXT_PUBLIC_NETWORK_TILESET_URL` (3D-тайлсет, `deploy-3d.md`),
   `NUXT_PUBLIC_CESIUM_ION_TOKEN`, флаги `NUXT_PUBLIC_MUTATIONS_ENABLED`, `NUXT_PUBLIC_TOPOLOGY_EDITING_ENABLED`
   (UI всё равно сверяется с `/auth/config` сервера).
6. **GeoServer** (`web-itwin/docs/geoserver-topology-layers.md`): SQL view `heatpipesections` и слои
   топологии должны видеть новые узлы/участки (JOIN `externalcodes`), проверить кеш тайлов после правок.
   Пароль admin — сменить (этап 0).
7. **nginx**: upstream `/map-api` → новый контейнер (`docs/deploy-map-api.md`, `docs/nginx-server.conf`).
8. **Проверка после выкатки**: `GET /health` (routes = 259 уникальных путей на 28.09, database ok, redis ok), баннер «устаревший API»
   в вебе исчез, вход по JWT, карта/карточка/пьезометр/отчёт/паспорт (Астана или участок с трубами),
   расчёт на тестовом фрагменте — только при включённом `MUTATIONS_ENABLED`.

### Что осталось

- Выкатка (этап 4) и включение записи на проде после приёмки.
- Подпись эксперта: прогон «ноль в ноль» после восстановления 24 потребителей фр. 74, паспорта против
  образцов десктопа, выбросы нагрузок.
- Привязка труб Алматы к участкам ПТС (данные), наполнение пустых справочников.
- CI: e2e не запускается в CI (нужен стенд с БД).

---

# Журнал итерации 2026-09-28

## Этап 10 (часть 1): печать, экспорт GeoJSON, импорт SHP/Excel/координат (2026-09-28)

- **Печать карты** (`PrintLayoutDialog`, `utils/printLayout.ts`, `utils/printRender.ts`, `utils/pdfImage.ts`).
  Десктоп (gid8 `GidWidget::onPrintFr`): A4–A0, масштабы 1:500…1:10000, книжная/альбомная, фрагмент режется
  на страницы; рамки, штампа и легенды нет. Веб: один лист A4/A3, «вписать текущий вид» или 1:N, 150/200/300 dpi,
  рамка (поля ГОСТ 2.301), заголовок, легенда видимых слоёв, линейка масштаба, стрелка севера, штамп
  (организация, наименование, масштаб, лист, исполнитель, дата). Карта рисуется во внеэкранном MapLibre
  со стилем основной (`preserveDrawingBuffer`); PNG — `canvas.toBlob`, PDF — свой минимальный PDF с JPEG
  (без npm-пакетов), печать — скрытый iframe с `@page`. Снимок текущего экрана в PNG. Многостраничной
  нарезки, как в десктопе, нет. Карта печатается без поворота (север вверху).
- **Экспорт GeoJSON** — меню «Экспорт» в шапке: SHP, DXF, GeoJSON, GeoJSON с атрибутами.
  API: `GET /api/export/geojson-attrs` (Sys, Name, Node1, Node2, L м, D м, K_E) — честное имя;
  `/api/export/zulugis` оставлен устаревшим алиасом (это не собственный формат ZuluGIS).
  Без паспорта трубы L/D/K_E = null (раньше подставлялись выдуманные 10 м / 200 мм). Оба экспорта
  принимают `fragments=1,2,3`.
- **Импорт сети** (`NetworkImportDialog`, API `POST /api/v1/import/inspect|run`, `database/network_import.py`).
  Эталона в десктопе нет: gid8 `python/convertor/shape_pg/shp_ms.py` грузит SHP в «сырую» таблицу MS SQL,
  `dialog/geof.cpp` закрыт `#if 0`, импорта координат узлов нет ни в gid8, ни в gid6. Режимы:
  узлы (SHP-точки или Excel/CSV с X/Y; код → `externalnodename`, наименование, рег. номер, отметка),
  участки (SHP-линии; концы привязываются к узлам фрагмента в допуске, иначе создаются узлы; паспорт — от
  участка-образца, Ду и длина из полей), координаты узлов (id или код → X/Y; перенос как B4 move:
  концы участков и длины паспорта пересчитываются; по флагу — геометрия участков без линии).
  Системы координат: из .prj, WGS84, местная (SRID 9998, м), координаты десктопа (x/y узлов, см, −Y).
  Мастер: файл → сопоставление полей (предложено по именам колонок) → dry-run (ошибки по строкам) →
  применение одной транзакцией с audit_log и журналом отмены (IMPORT_NODES/LINES/COORDS, «Отменить импорт»).
  Права: разбор — editor+; превью — editor+ при `TOPOLOGY_MUTATIONS_ENABLED`; применение — admin.
  Лимиты: 20 МБ, 5000 строк; `.xls` не поддерживается (нужен .xlsx/CSV).
- **Проверено на `almatygid_copy`**: импорт 2 узлов из Excel (3 строки с ошибками: нет координат, дубль кода,
  код уже есть), 2 участков из SHP (привязка к узлу 524075 в 0,3 м и к узлу, созданному этим же импортом;
  третья линия короче допуска — ошибка), перенос узла на 7 м (2 длины пересчитаны) — затем отмена всех
  операций; тестовых объектов не осталось. Лист A4 сформирован в браузере.

# Статус реализации плана миграции (2026-09-26)

## Новые функции 2026-09-25/26 (оценка, не паритет)

Добавлены 24–25.09, исправлены и проверены на копии БД (`almatygid_copy`) 25–26.09.

- **Локализация аварии** (`POST /api/analysis/valve-isolation`, `OutageSimulationDialog`): аналога в gid8 нет.
  Граница зоны — задвижки на участках и во внутренних схемах камер/ТРП; отключённые трубы
  и потребители учитываются. Потребители ниже по течению за закрытыми задвижками — не считаются.
  Открывается из карточки участка (кнопка задвижки). Линии ГИС без nodeid (≈40 тыс.) не рассчитываются.
- **Калькулятор шайб и элеваторов** (`/api/calc/*`, `ThrottlingCalculatorDialog`): формулы сверены
  с `gid8/python/dross/dross.py` и `sety/dross/drsh2.py` тестами (горловина, номер элеватора,
  расход ГВС, все 7 диафрагм бланка).
- **Гидравлический режим на карте** (`HydraulicThematicDialog`): результаты читаются по смыслу колонок
  `ut_out` (a13 расход, a10 скорость, a14 удельные потери); стрелки потока — иконкой.
- **CAD-операции**: слияние узлов и разворот участка с проверкой зависимостей (409 с блокерами);
  правка вершин — только API, без UI. Стадия B (undo, блокировки, golden-приёмка) не закрыта.
- **Экспорт пьезометрии в Excel**, GeoJSON-экспорт (UI — меню «Экспорт» в шапке, с 28.09; бывший «Zulu»-экспорт — это GeoJSON с атрибутами, см. этап 10).
- **Проверки**: pytest 85, vitest 61, typecheck без ошибок. Численная сверка расчётов с десктопом — этап 5.

# Статус реализации плана миграции (2026-07-24)

## Backlog переноса gid6/gid8/potr5 → web (2026-07-24)

- **Deploy:** `itwin-api/Dockerfile`, `docker-compose.yml`, [docs/deploy-map-api.md](../../docs/deploy-map-api.md), `scripts/verify_prod_routes.py`, workflow `.github/workflows/api-deploy.yml` (manual; нужны `DEPLOY_SSH_*` secrets).
- **P0 auth:** passlib/bcrypt, UsersDB login, `AUTH_REQUIRED_GET`, `STRICT_AUTH`, LoginDialog (вместо prompt), UsersDB pool в lifespan.
- **P1:** passport `belong*Site` fallback + SQL backfill; расширен `p1_smoke.py`.
- **P2 ТУ:** dedicated CRUD `/api/technical-conditions`, field allow-list, Excel `tu` + `tu-balance` (gid6).
- **P2 ops:** field allow-list на defect/shurf/osmotr/remont2/opres + Word acts с русскими полями.
- **P3:** `POST /api/heat-losses/run` (+ poll в UI), TG stationary + **OTOP recalculate**, armature `dampers`/`regularmatures`.
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

## Этап 10: 3D, VISICOM, АЛСЕКО, электросеть

- 3D Tiles сети — `NUXT_PUBLIC_NETWORK_TILESET_URL`, деградация и выкладка: [deploy-3d.md](deploy-3d.md). Готового тайлсета нет.
- VISICOM — `NUXT_PUBLIC_VISICOM_TILES_URL`/`_KEY`/`_SCHEME` (`utils/visicom.ts`); без ключа подложки нет.
- АЛСЕКО — вкладка «Сверка и привязка» журнала: API `/api/alseko/reconciliation*`, `/addresses`,
  `POST /api/alseko/buildings/{id}/address`, `POST /api/alseko/consumers/{node_id}/buildings`
  (editor+, MUTATIONS_ENABLED, dry-run, audit_log). Перенос нагрузок в карточку потребителя — вручную.
- Электросеть — в вебе только чтение. Сценарии десктопа (gid6 `GeoFile.cpp` createObj/createObjElPoint):
  при создании ЛЭП её концы ищутся среди источников/приёмников и пишутся `naimenovanie_istochnika`/
  `naimenovanie_priemnika`; точечные объекты (муфта, опора, гильза, канал, концевые источник/приёмник)
  ставятся на ЛЭП (привязка к концу или проекция) и получают `naimenovanie_lep` = id ЛЭП.
  Отчёт «ЛЭП» (OnElectroRemont) в gid6 выключен (`#if 0`). В Алматы таблицы пусты, данные есть в Астане
  (35 источников, 40 ЛЭП, 26 приёмников, 45 каналов, 35 муфт, 40 опор, 93 гильзы).
  Сверка и привязка — вкладка «Сверка и привязка» диалога электросети (`ElectricalReconciliationPanel.vue`):
  `GET /api/electrical-network/reconciliation` (допуск, по умолчанию 8 м = D5; для площадных ×10),
  `GET .../reconciliation/report.xlsx`, `POST /api/electrical-network/binding` (editor+, MUTATIONS_ENABLED,
  dry-run, одна транзакция, audit_log, опционально замена неверных привязок и проекция муфт/опор на ЛЭП).
  Астана (только чтение, 8 м): ЛЭП без источника 12, конец не у источника 3, без приёмника 7, не у приёмника 2;
  объектов без ЛЭП 85 (опоры 39 из 40), ближе к другой ЛЭП 1; автопривязка заполнит 81 объект.
  `naimenovanie_lep` у источников/приёмников десктоп не пишет (в Астане у приёмников почти везде 57 — мусор), не сверяется.
