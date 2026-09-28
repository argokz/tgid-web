# Выкладка 3D-режима (Cesium) и 3D Tiles сети

## Как устроено

- Кнопка 2D/3D в `MapControls.vue` переключает `cesiumStore.viewMode`; `MapViewer.vue` лениво
  монтирует `CesiumViewer.vue`, камера и выбранный объект синхронизируются с MapLibre.
- Рантайм Cesium (Workers, Assets, Widgets, ThirdParty; ~7,6 МБ) копируется в `public/cesium/`
  скриптом `scripts/copy-cesium-assets.mjs` (`predev`/`prebuild`), в git не хранится.
  `CESIUM_BASE_URL` зашит в `nuxt.config.ts` как `/itwin-map/cesium/` и должен совпадать
  с `app.baseURL` (`/itwin-map/`). Если приложение переезжает на другой путь — поменять оба.
- Подложка 3D — `NaturalEarthII` из локальных ассетов Cesium, интернет не нужен.
  Рельеф Cesium World Terrain включается только при `NUXT_PUBLIC_CESIUM_ION_TOKEN`,
  без токена — эллипсоид.
- Модель сети — **3D Tiles** (`tileset.json` + тайлы `b3dm`/`glb`/`pnts`) по адресу из
  `NUXT_PUBLIC_NETWORK_TILESET_URL` (`runtimeConfig.public.networkTilesetUrl`).
  Nuxt подхватывает переменную и в рантайме, пересборка для смены адреса не нужна.
  Пусто — слой выключен, 3D работает без модели.
- В десктопе (gid6/gid8) 3D-модели сети нет; готового тайлсета в репозиториях и на сервере
  тоже нет — его надо сгенерировать (см. ниже).

## Какой адрес указывать

| Значение | Как понимается |
|---|---|
| `https://cdn.example.kz/tgid/network/tileset.json` | как есть (другой домен — нужен CORS) |
| `/tiles/network/tileset.json` | от корня сайта, тот же домен |
| `tiles/network/tileset.json` | от `app.baseURL`, т.е. `/itwin-map/tiles/network/tileset.json` |

Относительный путь считается от `app.baseURL`, а не от текущей страницы (`utils/cesiumTileset.ts`).

## Деградация

- Ошибка загрузки `tileset.json` (404, 403, CORS, не JSON, смешанный http/https) не ломает 3D:
  карта остаётся с подложкой, сверху показывается закрываемое предупреждение с причиной
  (`cesiumStore.networkTilesetStatus = 'error'`, `networkTilesetError`).
- Отдельные тайлы, не загрузившиеся после успешного `tileset.json`, считаются в
  `cesiumStore.networkTileFailures` (первые три пишутся в консоль), модель показывается частично.

## Хостинг тайлсета (nginx, настраивает администратор)

Тайлсет — статические файлы; удобнее всего положить их рядом с веб-приложением на тот же домен
(CORS не нужен). Пример `location`:

```nginx
location /itwin-map/tiles/ {
    alias /var/www/tgid-tiles/;          # tileset.json и подкаталоги с тайлами
    types {
        application/json         json;
        application/octet-stream b3dm pnts i3dm cmpt subtree;
        model/gltf-binary        glb;
    }
    gzip on;
    gzip_types application/json application/octet-stream model/gltf-binary;
    # при перегенерации класть тайлсет в новый каталог (версия в пути) — тогда можно кэшировать долго
    add_header Cache-Control "public, max-age=86400";
}
```

Если тайлы на другом домене/порту (CDN, отдельный сервер), там нужен CORS:

```nginx
add_header Access-Control-Allow-Origin "https://itwin.kz" always;
add_header Access-Control-Allow-Methods "GET, HEAD, OPTIONS" always;
if ($request_method = OPTIONS) { return 204; }
```

Страница открыта по `https` — тайлсет тоже должен быть по `https` (браузер блокирует
смешанное содержимое). Nuxt для файлов вне `public/` ничего не проксирует — `/itwin-map/tiles/`
должен обслуживать nginx раньше, чем `location /itwin-map/` уходит в Node.

Размер: закладывать сотни мегабайт — единицы гигабайт на город в зависимости от детализации
(трубы как цилиндры, узлы/камеры как боксы). Тайлсет должен быть иерархическим (LOD,
`geometricError`), иначе браузер будет качать всю модель при первом показе.

## Как получить тайлсет

Генерация — отдельная офлайн-задача, в веб-приложении не выполняется:

1. Выгрузить активные участки и узлы (`linesobj`, `nodes`/узлы сети) из PostGIS в геометрию с
   высотами. Внимание: в Алматы геометрия в локальной SRID 9998 — перед генерацией перевести в
   EPSG:4326 (или сразу 4978); отметки узлов в Алматы местами 0/1 м (проблема данных),
   рельеф даст «висящие» трубы.
2. Построить 3D-геометрию (например, трубы — цилиндры по диаметру, глубина заложения из атрибутов)
   и упаковать в 3D Tiles 1.0/1.1 инструментом уровня `pg2b3dm` (PostGIS → 3D Tiles),
   `py3dtiles` или конвейером Cesium ion/FME. Установка инструмента — по согласованию.
3. Скопировать результат в каталог хостинга, проверить `curl -I <url>/tileset.json` (200,
   `application/json`), затем задать `NUXT_PUBLIC_NETWORK_TILESET_URL` и перезапустить Node.
4. Открыть 3D: предупреждения нет, модель на месте; в DevTools нет 404/CORS по тайлам.

## Проверка без тайлсета

`NUXT_PUBLIC_NETWORK_TILESET_URL=/nope/tileset.json` → в 3D появляется предупреждение
«tileset.json не найден (404)», карта работает. Пустая переменная → предупреждения нет.
