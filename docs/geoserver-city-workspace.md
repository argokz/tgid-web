# Другой город: GeoServer, веб и API (Астана, 09.10.2026)

Один экземпляр веба и API обслуживает одну базу TGID. Для Астаны нужны своя база API (`DB_NAME`),
свои рабочие области GeoServer и настройки веба. Код один и тот же.

## База `astanagid_2026_09_22`

Выполнено 09.10, скрипты и бэкап: `H:\tgid-backups\2026-10-09_astana\`.

| Что | Зачем |
|---|---|
| `spatial_ref_sys` 9998 → система Астаны (`01_srid_9998_astana.sql`, было: `spatial_ref_sys_before.csv`) | 9998 — местная система базы (схема десктопа `sety/1/full_tgid.sql`). В базе Астаны 9998 был описан как Алматы, хотя координаты `nodes`/`linesobj` астанинские: `ST_Transform(…, 4326)` в API (редактор топологии, импорт сети, выгрузки) уводил объекты под Алматы |
| функции `tg_format*` (`02_tg_format_functions.sql`, из `almatygid`) | подписи слоёв `uzel`/`heatpipesections` (`NAPOR`, `DLINA`…) |
| `sql/migrations/20260927_topology_undo_log.sql`, `20260928_heat_losses_report_out.sql` | отмена в редакторе топологии, листы нормативных теплопотерь |

**После переконвертации базы из десктопа** все правки пропадают (12.10 база пересоздана, слои `uzel` и
`heatpipesections` падали без `tg_format*` — карта пустая). Возвращает их скрипт API
`scripts/astana_after_reconvert.py --db <база>` (`sql/astana/*.sql` + миграции, одна транзакция;
`--check` — только проверить). На сервере он запускается сам: задача планировщика
`tgid-astana-db-watch` раз в 10 минут (`H:\deploy\install-astana-db-watch.ps1`, ставится от
администратора), пока идёт конвертация — ждёт. Журнал `H:\deploy\logs\astana-db-watch.log`.
Перезапуск служб не нужен.

В остальном схема совпадает с `almatygid`. В Астане нет `zdaniya_2` (здания с нагрузками), поэтому
и слоя такого нет.

### Внутренние схемы и фрагменты-варианты (10.10)

**Внутренние схемы узлов** (`nodes.internalnodeid` / `linesobj.internalnodeid` = узел-владелец)
нарисованы в условных координатах схемы, а не на местности. В Астане их много: 255 тыс. узлов и
226 тыс. участков. Почти все задвижки, диафрагмы и элеваторы стоят на участках схем. Геометрия схем
сложена стопками в ~12 км от своих узлов (71.54/51.24, 71.48/51.21, 72.58/51.89). Поэтому:
- слои GeoServer `heatpipesections`/`uzel` их отсекают (`internalnodeid IS NULL`);
- API ставит объект схемы в точку узла-владельца: журналы оборудования, режим отключений, анализ
  режима, точка новой записи журнала;
- результаты расчёта на карте и охват фрагмента идут без объектов схем.

**Фрагменты-варианты.** В базе 70 фрагментов:
- `тм-*` — распределительные сети;
- 11 копий магистралей («Магистрали 2021-2022» … «2026-2027 c приростом», «КазНИПИ», «Вариант 6»),
  они лежат друг на друге;
- «Энергетик_только для расчета сопел»;
- 4 пустых.

Без выбора карта показывала все копии сразу. `NUXT_PUBLIC_DEFAULT_FRAGMENTS` задаёт фрагменты,
видимые при открытии карты. У Астаны это всё, кроме вариантов, «Энергетика» и пустых; из магистралей
оставлен 3179 «Магистрали 2026-2027 c приростом», по нему был расчёт. Новый фрагмент в список не
попадает, пока его не добавят в переменную.

## GeoServer

| Workspace | База | Что | Как создан |
|---|---|---|---|
| `AstanaGIS` | `astanagid_2026_09_22` | сеть ТГИД: `heatpipesections`, `uzel`, `zdaniya_tu`, карточки `id_*`, `find_node`, `fragments`, `city_center`, `nachalniki_uchastkov` | `scripts/geoserver/clone_city_workspace.py` — копия `AlmatyGIS` (SQL-view те же) с SRS `EPSG:9995` |
| `Astana1` | `astana` | карта города: здания, улицы, реки, мосты, ж/д, названия улиц | `scripts/geoserver/publish_table_layers.py scripts/geoserver/astana_basemap.json` |
| `Astana2` | `astana` | схема тепловых сетей ArcGIS: трубопроводы, камеры, источники, насосные, ЦТП, колодцы, надписи | то же |

```
set GEOSERVER_REST_USER / GEOSERVER_REST_PASSWORD / DB_PASSWORD
python scripts/geoserver/clone_city_workspace.py --dst AstanaGIS --database astanagid_2026_09_22 --srid 9995 --skip zdaniya_2,id_zdaniya_2 --replace
python scripts/geoserver/publish_table_layers.py scripts/geoserver/astana_basemap.json --replace
```

Как устроено:
- **Система координат.** В GeoServer местные системы заведены в `user_projections/epsg.properties`:
  9998 — Алматы, 9995 — Астана. Политика `FORCE_DECLARED`. Таблицы базы `astana` выгружены из
  ArcGIS с SRID 0, координаты в той же системе Астаны.
- **Не копируются:** `login` (MD5-пароли без ограничения попыток), `read_file`/`get_file`/`file`
  (чтение файлов сервера). Новый веб их не использует.
- **Карточки подложки.** У каждой таблицы Astana1/2 есть `id_<таблица>`: поля строки, одна вкладка
  с названием слоя, `tg_names` — подписи полей из десктопа `gid6/gidr/kls/Astana.txt2` (часть подписей
  там — имена полей ArcGIS). Геометрия в WGS84 нужна GWC: без колонки геометрии он не заводит тайловый
  слой («has no geometry»), и веб не видит `id_*` в WMTS GetCapabilities.
- **Охват `zdaniya_tu`** задан охватом сети: в таблице есть мусорная координата 21474836.

### Отображение как в программе (10.10)

```
python scripts/geoserver/clone_city_workspace.py --dst AstanaGIS --styles-only
python scripts/geoserver/gid_desktop_style.py --workspace AstanaGIS
```

- **Значки узлов.** Первый клон взял стили через `GET /rest/workspaces/…/styles/uzel.sld`. Этот
  запрос отдаёт ссылки на SVG уже разрешёнными (`file:/…/workspaces/AlmatyGIS/styles/svg/us.svg`).
  Веб берёт иконки только из рабочей области слоя (`utils/sldToMapLibre.ts`), поэтому рисовал узлы
  кружками. Теперь стили копируются исходными файлами через `/rest/resource`, и стили AstanaGIS
  совпадают с AlmatyGIS байт в байт.
- **Участки** (`heatpipesections_gid`, стиль по умолчанию; прежний `AlmatyGIS_heatpipesections`
  остался в списке стилей слоя) рисуются как в gid8 (`gidr_draw.cpp`, `colorgtd.cpp`):
  - две линии: подача слева тёмно-красная, обратка справа тёмно-синяя;
  - участок только с подачей или только с обраткой — одной линией (`externalsignlineid`);
  - магистраль (Ø внутр. ≥ 400) толщиной 3, остальные 1;
  - надземные пунктиром, закрытая труба оливковая.

  В view добавлены поля `pod`, `obr`, `zakr_p`, `zakr_o`, `mag_gid`, `nadz_gid` и `du` (Ду, мм).
  Подписи участков (`pipe_labels`):
  - диаметр «Ду 150» вдоль трубы: магистрали с 14-го зума жирным, остальные с 16-го;
  - значения, выбранные в «Подписях» (поле `text`), синим посередине участка с 15-го.

  На коротких участках MapLibre подпись вдоль линии не ставит: она не помещается.
- **По зуму** (константы в начале `gid_desktop_style.py`):
  - **Участки.** Ширина и разнос подачи/обратки растут плавно (функции `stops` в MBStyle).
    Магистрали видны с 9-го зума, распределительные сети — с 12-го, до 14-го они полупрозрачные.
  - **Узлы.** Стиль `uzel` генерируется заново: правило на каждый зум, размер значка растёт
    примерно на 2 px за уровень. С какого зума видна категория:

    | Категория | Зум |
    |---|---|
    | источники, насосные | с обзора города |
    | узлы со схемой | 13 |
    | потребители | 14 |
    | проходные узлы | 15 |

    Подписи по важности: источники с 12-го, насосные и узлы со схемой с 14-го, потребители и
    узлы с 16-го, как в Алматы (1:7000). Узлы с признаком «подписывать» десктопа (`displaySign`) —
    с 14-го. Название — над значком. Цвет названия: источники тёмно-красные, насосные тёмно-синие,
    узлы со схемой жирные. С 17-го под значком синим — значения, выбранные в «Подписях»
    (поле `text`), у узлов всех видов.
    Подпись берётся из поля `label` view: это название без технических имён «#…». В Астане так
    названы 27 тыс. проходных узлов из 56 тыс. (импорт ArcGIS). Поле `name` не меняется.
    Значения расчёта (напор, расход) есть только во фрагментах, по которым сделан расчёт
    (`calculation.fileid`, в Астане — 3179).
  - **Значки** перерисованы в квадрате 100×100 с толстой обводкой, чтобы при 8–12 px контур читался.
    Веб растрирует SVG по `width`/`height` файла, поэтому размер в SLD равен размеру в пикселях.

    Значки веб отдаёт с `Cache-Control: max-age=3600`: браузеры подхватят новые в течение часа.
- **Узлы с внутренней схемой** (камеры, ЦТРП, павильоны; в Астане 209) получают `code = 'TK'` и знак
  камеры десктопа `svg/tk.svg` (`picKAM`). Для этого в базе создан индекс
  `nodes_internalnodeid_idx` (`H:\tgid-backups\2026-10-09_astana\05_nodes_internalnodeid_idx.sql`).
- **Бэкапы до изменений:** `H:\tgid-backups\2026-10-09_astana\astanagis_*_before_2026-10-10`.
  Откат участков: `gid_desktop_style.py --workspace AstanaGIS --restore-style AlmatyGIS_heatpipesections`.
- **Вспомогательные участки расчётной схемы скрыты.** Это узлы с кодом (`externalcodes`) П1 или П2
  и участки, у которых такой код хотя бы у одного из узлов. Так же делает десктоп при выключенном
  «Отображать вспомогательные участки» (`gidview/geodraw.cpp`, `GidWidget::isRezhim`).
  - В view `heatpipesections` и `uzel` добавлен параметр `rezhim`: 0 (по умолчанию) — скрыть,
    1 — показать (`viewparams=…;rezhim:1;`).
  - На магистралях 3179 скрыто 1613 участков из 4590 и 1454 узла из 4237.
  - В Алматы узлов П1/П2 нет.
  - На карте остаются копии тех же камер и труб из районных фрагментов (например, «40(4)К10» во
    фрагментах 7 и 30 с кодами Р4/Р29). Это не П1/П2, десктоп их тоже показывает.
  - Бэкап view до правки: `H:\tgid-backups\2026-10-10_astana_labels\featuretype_*_before_rezhim.xml`.
- **Бэкап до подписей диаметра и нового стиля подписей узлов:** `H:\tgid-backups\2026-10-10_astana_labels2`.
- **Подсветка участков ПТС** (как «Перейти к участку» в доке ПТС десктопа: жёлтая подложка,
  слой стиля «Выделенные (warning=1)»). Параметры view: `nach` — начальник участка (все его участки
  МС и РС), `ms` / `rs` — один участок; 0 — без подсветки. Веб выбирает их на вкладке «ПТС» боковой
  панели (`components/PtsHighlightPanel.vue`), охват и фрагменты даёт API `GET /api/v1/pts/highlight`.
  Раньше веб всегда передавал `nach:2`, и участки начальника №2 были жёлтыми постоянно. Заодно убран
  join `ue.id = ms… or ue.id = rs…`, который дублировал трубы. Только view, без стилей:
  `gid_desktop_style.py --workspace AstanaGIS --view-only`; бэкап —
  `H:	gid-backups6-10-09_astanastanagis_heatpipesections_before_highlight_2026-10-10`.
  В AlmatyGIS view не менялся: там к участкам не привязано ни одной трубы.
- **После правки стилей** кэш слоёв веба сбрасывает `GET <путь веба>/api/geoserver-layers?refresh=true`.

## Веб

| Переменная | Астана | По умолчанию |
|---|---|---|
| `GEOSERVER_LAYER_CATALOG` (dev) / `NUXT_PUBLIC_GEOSERVER_LAYER_CATALOG` (сборка) | первый workspace `AstanaGIS` (слои как у Алматы, без `zdaniya_2`) | каталог из `.env` сборки |
| `NUXT_PUBLIC_GEOSERVER_WORKSPACE`, `NUXT_PUBLIC_GEOSERVER_GROUP_NAME` (сборка) | `AstanaGIS` | из каталога сборки |
| `GEOSERVER_DISCOVER_WORKSPACES` | `AstanaGIS,Astana1,Astana2` | — |
| `NUXT_PUBLIC_CITY_BBOX` | `71.05,50.94,71.79,51.37` | охват Алматы |
| `NUXT_PUBLIC_MAP_CENTER` | `71.43,51.13` | центр Алматы |
| `NUXT_APP_BASE_URL` | `/tgid/astana/` | `/itwin-map/` |
| `NUXT_PUBLIC_STORAGE_PREFIX` | `astana` | пусто |
| `NUXT_PUBLIC_DEFAULT_FRAGMENTS` | `2-46,48-52,54,55,801,3179,3181` | пусто (все фрагменты) |

В собранном приложении (`node .output/server/index.mjs`) `.env` не читается: значения из
`nuxt.config.ts` запечены при сборке и перекрываются только переменными `NUXT_*` /
`NUXT_PUBLIC_*` по пути ключа. Поэтому каталог для сборки передаётся как
`NUXT_PUBLIC_GEOSERVER_LAYER_CATALOG`, а не `GEOSERVER_LAYER_CATALOG`.

**Путь приложения при запуске.** `NUXT_APP_BASE_URL` переопределяет `app.baseURL`, и одна сборка
обслуживает оба города. Поэтому в сборке нет других путей с `/itwin-map/`: иконка задаётся в
`app.vue`, `CESIUM_BASE_URL` — в `stores/cesiumStore.ts` перед загрузкой Cesium.

**localStorage.** Он общий на домен, а оба города открываются с `itwin.kz`. Все ключи идут через
`utils/appStorage.ts` с префиксом `NUXT_PUBLIC_STORAGE_PREFIX`. У Астаны префикс `astana:`, у Алматы
его нет, и сохранённые настройки пользователей остаются на месте. Без префикса города делили бы
видимые слои и фрагменты, стили, положение карты и вход.

`utils/cityConfig.ts`: стартовый центр карты, кнопка «Домой», поиск адреса (Nominatim в охвате
города), пробный запрос 3D, workspace поиска узлов и списка фрагментов. Раньше всё это было
зашито под Алматы. `NUXT_PUBLIC_*` читаются при запуске сервера, пересборка не нужна.

Клик по объекту подложки (Almaty2, Astana1/2) открывает карточку из `id_<таблица>` своего
workspace (`queryLayerName` слоя). Раньше таблица угадывалась по имени слоя, и карточка
строилась из полей тайла.

**Кэш nginx.** `https://itwin.kz/geoserver/gwc/service/wmts?REQUEST=GetCapabilities` кэшируется
nginx на час. Новые слои GeoServer веб увидит не раньше, чем через час, или после
`/api/geoserver-layers?refresh=true` при `GEOSERVER_CAPABILITIES_URL` на локальный GeoServer
(`http://127.0.0.1:8085/geoserver/gwc/service/wmts?REQUEST=GetCapabilities`). Так сделано на стенде.

## API

Код не меняется: `DB_NAME=astanagid_2026_09_22`, свой `REDIS_DB` (у Celery своя очередь на базу),
`CORS_ALLOWED_ORIGINS` — адрес веба Астаны.

## Стенд (09.10)

- API `127.0.0.1:8042`: `.env` + `.env.copy`, переопределены `DB_NAME`, `REDIS_DB=3`,
  `MUTATIONS_ENABLED=false`, `TOPOLOGY_MUTATIONS_ENABLED=false`. Результат: `/health` — 269 маршрутов,
  `verify_prod_routes.py` failed 0.
- Веб `localhost:3042`: конфигурация `web-astana` в `.claude/launch.json`. Кириллица каталога там
  записана как `\uXXXX`: PowerShell 5.1 теряет байт 0x98 («И») в переменных окружения.
- **Проверено:**
  - карта открывается на Астане, сеть совпадает с подложкой MapTiler и со зданиями и трубами из `astana`;
  - 70 фрагментов;
  - поиск узла;
  - карточки участка (4 вкладки), потребителя (5), узла, источника, трубопровода подложки;
  - окно выбора из нескольких объектов.

## Прод: два города на itwin.kz (09.10)

| | Алматы | Астана |
|---|---|---|
| адрес | https://itwin.kz/tgid/almaty/ | https://itwin.kz/tgid/astana/ |
| веб | `tgid-web` :3007, `NUXT_APP_BASE_URL=/tgid/almaty/` | `tgid-web-astana` :3010 (127.0.0.1), `/tgid/astana/`, переменные Астаны из таблицы выше |
| API | `tgid-api` :8011, `/tgid/almaty/map-api/` (и прежний `/map-api/`) | `tgid-api-astana` :8021, `/tgid/astana/map-api/` |
| воркер | `tgid-worker`, `REDIS_DB=1` | `tgid-worker-astana`, `REDIS_DB=4`, `tgid-astana@%h` |
| база | `almatygid` | `astanagid_2026_09_22` |

Сборка веба одна (`H:\deploy	gid-web\.output`), код API один (`H:\deploy	gid-server`). API Астаны берёт
`.env` Алматы, служба перекрывает только `DB_NAME` и `REDIS_DB`: `load_dotenv` не трогает уже заданные
переменные. Переменные служб записаны в реестр (`AppEnvironmentExtra`, REG_MULTI_SZ): через аргументы
nssm PowerShell 5.1 теряет кавычки JSON каталога.

nginx: `C:
ginx\conf	gid-cities.conf` подключён в `server 443`. У API и у `/itwin-map/` стоит `^~`, чтобы
регулярные location статики не перехватывали их запросы. API лежит под `map-api/`, а не `api/`: путь
`<путь веба>/api/…` занят серверными маршрутами самого Nuxt (`server/api`). Старый `https://itwin.kz/itwin-map/…` отвечает
302 на `/tgid/almaty/…`.

Установка: `H:\deploy\install-tgid-cities.ps1` (от администратора, после `npm run build`). Сначала
предпроверки: сборка новая, база Астаны с миграциями и SRID, порты свободны, `nginx.conf` не менялся,
`nginx -t`. Затем ставятся службы Астаны, Алматы переводится на `/tgid/almaty/`, заменяется `nginx.conf`
и выполняется reload. Откат — `H:\deploy
ollback-tgid-cities.ps1`.

## Кеш векторных тайлов (GeoWebCache)

Без кеша MVT идут через WMS GetMap, и GeoServer выполняет SQL view на каждый тайл. Скрипт
`scripts/geoserver/gwc_mvt_cache.py` настраивает тайловые слои GWC (по умолчанию `heatpipesections`,
`uzel` обеих схем и `AlmatyGIS:zdaniya_2`):
- сетка `EPSG:900913` и формат MVT;
- параметр `VIEWPARAMS` (для каждого набора фрагментов и подписей свой кеш);
- срок жизни тайла `--expire` (по умолчанию 300 с).

Перед изменением скрипт сохраняет исходный XML слоёв в `--backup-dir`, откат — `--restore <каталог>`.
Веб переходит на тайлы GWC сам, как только видит у слоя сетку `EPSG:900913` в WMTS GetCapabilities
(`GEOSERVER_MVT_GWC=false` отключает это). Тайлы берутся через WMTS рабочей области
`/geoserver/<ws>/gwc/service/wmts`: общий `/geoserver/gwc/` nginx кеширует на час. Сервер веба
кеширует список слоёв на час, сброс — `?refresh=true`.

Правки из десктопа видны в вебе не позже срока жизни тайла. Свои правки и результаты расчёта веб
показывает сразу: добавляет в `VIEWPARAMS` версию данных (`rev:<время>`), а такого ключа в кеше
ещё нет. Неизвестный параметр SQL view GeoServer не использует.

Кеш покрывает только границы слоя, которые GeoServer посчитал по данным при публикации. За ними GWC
отвечает 400, и веб туда не ходит (границы берёт из GetCapabilities). Если объекты вышли за границы
(новый район после переконвертации базы, импорт), на карте их не будет. После таких изменений —
`gwc_mvt_cache.py --check-bounds`, при находке — `--fix-bounds --backup-dir …` (на проде:
`H:\deploy\check-gwc-bounds.cmd` / `fix-gwc-bounds.cmd`). 13.10 так нашлись 429 зданий
`AlmatyGIS:zdaniya_2` на окраинах.

Все слои узлов (`uzel`, источники, НС, потребители, обобщённые) берут одни и те же тайлы `uzel`
из одного источника карты, а вид узла отделяет фильтр MapLibre по `code`.

## Тараз, Актобе, Шымкент (21.10.2026)

Базы `tarazgid`, `aktobegid`, `shymkentgid`. Конвертер записал сеть сразу в Web Mercator:
`nodes.shape`/`linesobj.shape` — SRID 3857. Своя система координат (9998) не нужна, длины API считает
по эллипсоиду (`topology.ground_length_sql`). Таблицы API, `tg_format*` и индекс узлов API создаёт сам
(`database/city_schema.py`). В базе Шымкента (старая версия конвертера) не было
`generalizedconsumers.name` — её добавляет общий пункт схемы (без неё падают `find_node`,
`id_generalizedconsumers`).

```
python scripts/geoserver/clone_city_workspace.py --dst TarazGIS --database tarazgid --srid 3857 --skip zdaniya_2,id_zdaniya_2
python scripts/geoserver/gid_desktop_style.py --workspace TarazGIS --backup-dir H:/tgid-backups/2026-10-21_kz_cities/style_TarazGIS
python scripts/geoserver/gwc_mvt_cache.py --layers TarazGIS:heatpipesections,TarazGIS:uzel --backup-dir H:/tgid-backups/2026-10-21_kz_cities/gwc
```
(то же для `AktobeGIS`/`aktobegid` и `ShymkentGIS`/`shymkentgid`). SQL-view общие с Алматы: в них нет
номеров SRID, слои объявлены `EPSG:3857` и совпадают с колонками — WFS `within` работает (в Шатуре нет).

Фрагменты по умолчанию (`NUXT_PUBLIC_DEFAULT_FRAGMENTS`), расчётов в базах нет:
- **Тараз** — всё, кроме копий магистрали 3106 «летний», 3109, 3110 «первоначальный», 4114 «на 2022-2023»
  (лежат на 7 «Магистраль_Тараз отопительный»): `1-3105,3111-4113,4115-14114`;
- **Актобе** — всё, кроме 1 «Исходная Актобе» (импорт без единого источника; на ней лежат расчётные 16 «АТЭЦ» и районные котельные, у каждой свои источники): `2-1001`;
- **Шымкент** — всё, кроме 329 «Шымкент Магистраль 2021-22» (копия 2): `1-328,330-10329`.

Данные: в Шымкенте у 9,4 тыс. из 10,7 тыс. узлов основной сети и 10,2 тыс. участков нет геометрии
(и x/y) — на карте только магистраль и часть сети. В Таразе и Шымкенте нет таблиц журналов
дефектов/шурфов/опрессовки Алматы — эти разделы там пустые.

### Караганда (21.10.2026)

База `karagandagid` — как у трёх городов выше: сеть в SRID 3857, пункты схемы API создаёт сам
(`generalizedconsumers.name` в базе есть). Рабочая область `KaragandaGIS` — тем же клоном
(`--dst KaragandaGIS --database karagandagid --srid 3857 --skip zdaniya_2,id_zdaniya_2`), стили и кеш —
`gid_desktop_style.py`, `gwc_mvt_cache.py` (бэкапы `H:/tgid-backups/2026-10-21_karaganda`).

188 фрагментов: 12 «Магистрали Караганда» (источники ТЭЦ-1 и ТЭЦ-3) и распредсети по районам. По умолчанию — всё,
кроме 87 «Копия для примера\TK302-копия» (копия 30 «TK302»): `12-86,88-203`. 134 «29m КАР» и 135 «29m»
пересекаются наполовину (90 узлов) — оба включены. У 516 из 15,3 тыс. узлов основной сети нет геометрии.
