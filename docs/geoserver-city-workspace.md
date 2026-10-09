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

В остальном схема совпадает с `almatygid`. В Астане нет `zdaniya_2` (здания с нагрузками), поэтому
и слоя такого нет.

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
и выполняется reload. Откат — `H:\deployollback-tgid-cities.ps1`.
