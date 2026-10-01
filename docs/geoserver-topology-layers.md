# Слои сети GeoServer и объекты редактора топологии

Дата: 2026-09-27 (этап 8.8). Меняет GeoServer пользователь; здесь — диагноз и готовый SQL.

## Почему участок, созданный в web, не виден и не кликается

Слой «Участки теплосети» — MVT из GeoServer: `AlmatyGIS:heatpipesections`, SQL view
(JDBC virtual table) в хранилище `AlmatyGIS`. Проверено через REST (только чтение) 27.09.2026.

| Причина | Где | Что сделано / что сделать |
|---|---|---|
| Хранилище `AlmatyGIS` (и `uzel`, и все слои схемы) смотрит в **прод** `almatygid` на `localhost:5440`. Правки на копии `almatygid_copy` на карте не появятся никогда. | GeoServer, datastore | Пользователь: отдельное хранилище на копию для стенда (ниже, шаг 1). |
| View делает `JOIN externalcodes ec1/ec2` по обоим узлам участка. Узлы, созданные web до п. 8.5 (27.09), не имели `externalcodeid` → участок выпадал из view (и из расчёта: sety тоже `JOIN externalCodes`). На копии: узлы 604338, 604339, 604344 (фрагмент 89, участки 388670, 388674); на проде таких узлов основной сети нет (4 узла без кода — внутренняя схема узла 91098 из десктопа, в слой не входят). | данные | API: новый узел получает код от образца (8.5), `create_line` отказывает (400), если у узла нет фрагмента/кода. Данные: `itwin-api/itwin-api/sql/fixes/20260927_nodes_without_externalcode.sql` (копия исправлена; на проде — перед включением, для контроля). |
| View делает `JOIN heatpipesections hps`: участок без паспорта не виден. `create_line` вставлял паспорт в savepoint и **глотал ошибку** — участок мог остаться без паспорта; паспорт по умолчанию давал Ду 1000 мм. | API | Исправлено: паспорт копируется со смежного (или ближайшего в 300 м) участка того же фрагмента и схемы — конструктив, диаметры, изоляция, организация, МС/РС; длина — по геометрии; ошибка вставки больше не глотается. Ответ `POST /topology/line` содержит `passport: {source, template_line_id}`. |
| `n1.internalnodeid IS NULL` | view | Верно: внутренние схемы потребителей в слой не входят. Новый участок получает `internalnodeid` узла и из разных схем не создаётся. |

Кэша тайлов нет: web берёт MVT через `ows?SERVICE=WMS&REQUEST=GetMap&FORMAT=application/vnd.mapbox-vector-tile`
(не через GWC), после операции редактор перезапрашивает источники (`refreshVisibleDataLayers`).
Если для слоя включат GeoWebCache — после правок нужен truncate слоя.

Проверка, что участок попадёт в слой (то же делает приёмка B7):

```sql
SELECT count(*) FROM linesobj l
JOIN heatpipesections hps ON hps.lineid = l.id
JOIN nodes n1 ON n1.id = l.nodeid1 JOIN nodes n2 ON n2.id = l.nodeid2
JOIN externalcodes ec1 ON ec1.id = n1.externalcodeid
JOIN externalcodes ec2 ON ec2.id = n2.externalcodeid
WHERE l.id = :line_id AND l.removed = 0 AND n1.internalnodeid IS NULL;   -- должно быть 1
```

## Шаг 1 (стенд). Слои на копии БД

GeoServer → Stores → Add new Store → PostGIS: имя `AlmatyGIS_copy` (в workspace `AlmatyGIS`
или новом `AlmatyGIS_copy`), те же параметры, что у `AlmatyGIS`, но `database = almatygid_copy`.
Затем для `heatpipesections` и `uzel`: Layers → Add new layer → `AlmatyGIS_copy` →
Configure new SQL view → вставить SQL из существующего слоя (Layer → Edit → SQL view),
те же параметры view (`fragments`, `nach`, `RAS`…), ключ `id`, геометрия `shape`
(LineString / Point, SRID 9998), имя слоя, например, `heatpipesections_copy` / `uzel_copy`.

В web стенда: в `GEOSERVER_LAYER_CATALOG` добавить workspace-запись со слоями `*_copy`
(или указать их `source` вместо боевых) — каталог читается сервером Nuxt при старте.

## Шаг 2 (рекомендуется). Устойчивый view участков

Чтобы участок без паспорта или с узлом без кода всё-таки рисовался (и его можно было
кликнуть и исправить), а не пропадал молча, в SQL view `heatpipesections` заменить
внутренние соединения на внешние (остальной текст view без изменений):

```sql
-- было
ec1.name || ' ' || n1.externalnodename || ' - ' || ec2.name || ' ' || n2.externalnodename as name,
...
join heatpipesections hps on hps.lineid=l.id
join nodes n1 on n1.id=l.nodeid1
join nodes n2 on n2.id=l.nodeid2
join externalcodes ec1 on ec1.id=n1.externalcodeid
join externalcodes ec2 on ec2.id=n2.externalcodeid

-- стало
concat_ws(' ', ec1.name, n1.externalnodename) || ' - ' || concat_ws(' ', ec2.name, n2.externalnodename) as name,
...
left join heatpipesections hps on hps.lineid=l.id
join nodes n1 on n1.id=l.nodeid1
join nodes n2 on n2.id=l.nodeid2
left join externalcodes ec1 on ec1.id=n1.externalcodeid
left join externalcodes ec2 on ec2.id=n2.externalcodeid
```

Последствия: звенья оборудования (задвижки, насосы, регуляторы — участки без паспорта
трубы) тоже попадут в слой участков как линии без диаметра. Если это нежелательно, вместо
`left join heatpipesections` оставить `join`, а внешними сделать только `externalcodes`.
В `uzel` аналогично: `left join externalcodes ec on ec.id=n.externalcodeid`.

## Шаг 3. Данные прода

Перед включением редактора на проде выполнить
`itwin-api/itwin-api/sql/fixes/20260927_nodes_without_externalcode.sql` (сначала выборка;
на 27.09 — пусто) и миграцию журнала отмены
`itwin-api/itwin-api/sql/migrations/20260927_topology_undo_log.sql`.

## Шаг 4 (рекомендуется). Query-слой участков отдаёт `lineid` (QA F12, F54)

Карточку объекта web дополняет свойствами query-слоя `id_<table>` (WFS, `viewparams=id:<ключ>`).
У `AlmatyGIS:id_heatpipesections` ключ — участок (`WHERE L.id=%id%`, linesobj.id), а в `id`
возвращается паспорт трубы `T.id` (heatpipesections.id; на проде ≠ lineid у 98 019 строк,
20 435 таких id совпадают с другими живыми участками). Раньше этот `id` затирал id участка
в карточке: «Анализ отключения» отвечал 400, «История» открывала чужой объект, а «Удалить»
и «Развернуть» в режиме правки попали бы в **другую** трубу. Так же устроены
`id_generalizedconsumers`, `id_realconsumers`, `id_heatsources`, `id_pumpstations`
(`WHERE N.id=%id%`, в `id` — строка своей таблицы).

**Web исправлен и без правки GeoServer** (`utils/networkFeature.ts`, `stores/mapStore.ts`):
id карточки — ключ поиска (linesobj.id / nodes.id), id строки query-слоя хранится отдельно
(`query_row_id`), участку проставляется `lineid`. Если на руках только heatpipesections.id
(например, FID `id_heatpipesections.*`), он переводится в linesobj.id через
`GET /api/v1/topology/line-ref?section_id=…`; не удалось — у карточки нет id, действия недоступны.
Удаление и разворот из карточки передают `expected_section_id` (heatpipesections.id карточки):
сервер сверяет его с паспортом участка и при расхождении отвечает 409 `object_mismatch`.

Чтобы свойства слоя были однозначны и для других клиентов (QGIS, старые страницы),
в SQL view `id_heatpipesections` во внутренний `SELECT` добавить ключ участка
(остальной текст без изменений; `T.id` оставить — это паспорт трубы):

```sql
-- было
SELECT
T.id, ST_Transform(L.shape, 4326) as shape,
-- стало
SELECT
T.id, L.id AS lineid, ST_Transform(L.shape, 4326) as shape,
```

Аналогично в `id_generalizedconsumers`, `id_realconsumers`, `id_heatsources`,
`id_pumpstations`: `T.id, N.id AS nodeid, …`. Web берёт явный `lineid` в приоритете.
