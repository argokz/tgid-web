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
| `GEOSERVER_LAYER_CATALOG` | первый workspace `AstanaGIS` (слои как у Алматы, без `zdaniya_2`) | — |
| `GEOSERVER_DISCOVER_WORKSPACES` | `AstanaGIS,Astana1,Astana2` | — |
| `NUXT_PUBLIC_CITY_BBOX` | `71.05,50.94,71.79,51.37` | охват Алматы |
| `NUXT_PUBLIC_MAP_CENTER` | `71.43,51.13` | центр Алматы |

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
