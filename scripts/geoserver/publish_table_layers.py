"""Публикация таблиц PostGIS (подложка города: здания, улицы, трубопроводы из ArcGIS) в GeoServer.

Описание слоёв — JSON (пример: astana_basemap.json): рабочая область, база, схема, местная система
координат, охват и список таблиц с заголовком и оформлением. Стиль генерируется простым SLD
(полигон / линия / точка / подпись) — его же веб переводит в стиль MapLibre (utils/sldToMapLibre.ts).
Каждому слою включается тайловый кэш GWC с MVT: без него веб показывает слой только как WMS.
Для карточки объекта создаётся парный SQL-view id_<таблица> (как у Almaty2 из генератора десктопа
gid8/python/qgis/qgz/geoserver): поля строки + tg_names — русские подписи полей из файла kls
(namesFile в описании, формат "таблица","поле","Подпись", cp1251).

    set GEOSERVER_REST_USER / GEOSERVER_REST_PASSWORD / DB_PASSWORD
    python scripts/geoserver/publish_table_layers.py scripts/geoserver/astana_basemap.json [--replace]
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from pathlib import Path
from xml.sax.saxutils import escape

from clone_city_workspace import Gs

MVT_FORMATS = ['application/vnd.mapbox-vector-tile', 'image/png', 'image/vnd.jpeg-png', 'image/jpeg',
               'application/json;type=geojson']


def scale_rule(body: str, max_scale: float | None, title: str) -> str:
    scale = f'<MaxScaleDenominator>{max_scale}</MaxScaleDenominator>' if max_scale else ''
    return f'<Rule><Name>{escape(title)}</Name><Title>{escape(title)}</Title>{scale}{body}</Rule>'


def stroke(color: str, width: float, dash: str | None = None, opacity: float = 1) -> str:
    dash_xml = f'<CssParameter name="stroke-dasharray">{dash}</CssParameter>' if dash else ''
    return (f'<Stroke><CssParameter name="stroke">{color}</CssParameter>'
            f'<CssParameter name="stroke-width">{width}</CssParameter>'
            f'<CssParameter name="stroke-opacity">{opacity}</CssParameter>{dash_xml}</Stroke>')


def make_sld(name: str, title: str, st: dict) -> str:
    kind = st['kind']
    max_scale = st.get('maxScale')
    if kind == 'polygon':
        body = (f'<PolygonSymbolizer><Fill><CssParameter name="fill">{st["fill"]}</CssParameter>'
                f'<CssParameter name="fill-opacity">{st.get("fillOpacity", 1)}</CssParameter></Fill>'
                f'{stroke(st["stroke"], st.get("width", 0.5))}</PolygonSymbolizer>')
    elif kind == 'line':
        body = f'<LineSymbolizer>{stroke(st["stroke"], st.get("width", 1), st.get("dash"))}</LineSymbolizer>'
    elif kind == 'point':
        body = (f'<PointSymbolizer><Graphic><Mark><WellKnownName>{st.get("mark", "circle")}</WellKnownName>'
                f'<Fill><CssParameter name="fill">{st["fill"]}</CssParameter></Fill>'
                f'{stroke(st.get("stroke", "#ffffff"), st.get("width", 0.5))}</Mark>'
                f'<Size>{st.get("size", 6)}</Size></Graphic></PointSymbolizer>')
    elif kind == 'label':
        placement = ('<LabelPlacement><LinePlacement/></LabelPlacement>' if st.get('placement') == 'line'
                     else '<LabelPlacement><PointPlacement><AnchorPoint><AnchorPointX>0.5</AnchorPointX>'
                          '<AnchorPointY>0.5</AnchorPointY></AnchorPoint></PointPlacement></LabelPlacement>')
        body = (f'<TextSymbolizer><Label><ogc:PropertyName>{st["field"]}</ogc:PropertyName></Label>'
                f'<Font><CssParameter name="font-family">Arial</CssParameter>'
                f'<CssParameter name="font-size">{st.get("size", 11)}</CssParameter></Font>'
                f'{placement}<Halo><Radius>1.5</Radius><Fill><CssParameter name="fill">#ffffff</CssParameter></Fill></Halo>'
                f'<Fill><CssParameter name="fill">{st.get("color", "#333333")}</CssParameter></Fill>'
                f'<VendorOption name="followLine">{"true" if st.get("placement") == "line" else "false"}</VendorOption>'
                f'<VendorOption name="group">yes</VendorOption></TextSymbolizer>')
    else:
        raise ValueError(f'{name}: неизвестный вид оформления {kind}')
    return ('<?xml version="1.0" encoding="UTF-8"?>'
            '<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld" '
            'xmlns:ogc="http://www.opengis.net/ogc" xmlns:xlink="http://www.w3.org/1999/xlink" '
            'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
            f'<NamedLayer><Name>{escape(name)}</Name><UserStyle><Title>{escape(title)}</Title>'
            f'<FeatureTypeStyle>{scale_rule(body, max_scale, title)}</FeatureTypeStyle>'
            '</UserStyle></NamedLayer></StyledLayerDescriptor>')


# Сетки для слоя без геометрии (id_*): сам GWC такой слой не заводит («has no geometry»),
# а с явными сетками, как у id_* Алматы, заводит и показывает в WMTS GetCapabilities
NO_GEOMETRY_GRIDS = ''.join(
    f'<gridSubset><gridSetName>{g}</gridSetName><extent><coords><double>-1.0</double><double>-1.0</double>'
    '<double>0.0</double><double>0.0</double></coords></extent></gridSubset>'
    for g in ('EPSG:4326', 'EPSG:900913'))


def gwc_layer(gs: Gs, qualified: str, no_geometry: bool = False):
    """Тайловый слой GWC с MVT (без него слой не попадает в WMTS GetCapabilities)."""
    formats = ''.join(f'<string>{f}</string>' for f in MVT_FORMATS)
    grids = f'<gridSubsets>{NO_GEOMETRY_GRIDS}</gridSubsets>' if no_geometry else '<gridSubsets/>'
    gs.post_xml(f'/gwc/rest/layers/{qualified}.xml',
                f'<GeoServerLayer><enabled>true</enabled><inMemoryCached>false</inMemoryCached>'
                f'<name>{qualified}</name><mimeFormats>{formats}</mimeFormats>{grids}'
                f'<metaWidthHeight><int>0</int><int>0</int></metaWidthHeight><expireCache>0</expireCache>'
                f'<expireClients>0</expireClients><parameterFilters/><gutter>0</gutter></GeoServerLayer>',
                method='PUT')


def read_names(path: Path | None) -> dict[str, dict[str, str]]:
    """Подписи полей из kls десктопа: {таблица: {поле: подпись}}."""
    names: dict[str, dict[str, str]] = {}
    if not path or not path.exists():
        return names
    with path.open(encoding='cp1251', newline='') as f:
        for row in csv.reader(f):
            if len(row) >= 3:
                names.setdefault(row[0].strip().lower(), {})[row[1].strip().lower()] = row[2].strip()
    return names


def id_view_xml(table: str, title: str, schema: str, columns: list[str], names: dict[str, str],
                geom: str | None, proj4: str | None) -> str:
    """SQL-view карточки: строка по id, tg_tabs — одна вкладка с полями таблицы, tg_names — подписи.

    Геометрия — в WGS84, как у id_* Almaty2 (ST_Transform(T.geometry, 4326)). У таблиц выгрузки
    ArcGIS SRID 0, поэтому исходная система задаётся строкой proj4. Без колонки геометрии GWC
    не заводит тайловый слой («has no geometry»), и веб не находит id_* в WMTS."""
    cols = ', '.join(f'T.{c}' for c in columns)
    if geom:
        src = f"'{proj4}', " if proj4 else ''
        cols += f', ST_Transform(T.{geom}, {src}4326) AS shape'
    labels = json.dumps({c: names[c] for c in columns if c in names}, ensure_ascii=False, indent=1)
    fields = [c for c in columns if c != 'id']
    tabs = json.dumps([{title: [{title: fields}]}], ensure_ascii=False)
    sql = (f'select t.*, $${tabs}$$ as tg_tabs, $${labels}$$ as tg_names '
           f'from (SELECT {cols} FROM {schema}.{table} T WHERE T.id=%id%) t')
    # SRS-заглушка и пустая геометрия, как у id_* генератора: без них GWC не заводит тайловый слой
    return (f'<featureType><name>id_{table}</name><nativeName>id_{table}</nativeName><title>id_{table}</title>'
            '<srs>EPSG:404000</srs><projectionPolicy>FORCE_DECLARED</projectionPolicy>'
            f'{bbox_xml("nativeBoundingBox", [0, 0, 0, 0], "EPSG:404000")}'
            f'{bbox_xml("latLonBoundingBox", [-1, -1, 0, 0], "EPSG:4326")}'
            '<metadata><entry key="JDBC_VIRTUAL_TABLE"><virtualTable>'
            f'<name>id_{table}</name><sql>{escape(sql)}</sql><escapeSql>false</escapeSql>'
            '<keyColumn>id</keyColumn><geometry><name>shape</name><type>Geometry</type><srid>-1</srid></geometry>'
            '<parameter><name>id</name><defaultValue>12345678</defaultValue>'
            '<regexpValidator>^[0-9]+$</regexpValidator></parameter>'
            '</virtualTable></entry></metadata></featureType>')


def bbox_xml(tag: str, b: list[float], crs: str) -> str:
    return (f'<{tag}><minx>{b[0]}</minx><maxx>{b[2]}</maxx><miny>{b[1]}</miny><maxy>{b[3]}</maxy>'
            f'<crs>{crs}</crs></{tag}>')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('spec')
    ap.add_argument('--geoserver', default=os.environ.get('GEOSERVER_REST_URL', 'http://127.0.0.1:8085/geoserver'))
    ap.add_argument('--replace', action='store_true', help='Удалить рабочие области из описания, если уже есть')
    args = ap.parse_args()

    spec = json.loads(Path(args.spec).read_text(encoding='utf-8'))
    gs = Gs(args.geoserver, os.environ.get('GEOSERVER_REST_USER', 'admin'), os.environ['GEOSERVER_REST_PASSWORD'])
    db = spec['postgres']
    srs = f'EPSG:{spec["srid"]}'
    native = spec['nativeBoundingBox']
    latlon = spec['latLonBoundingBox']
    names_file = spec.get('namesFile')
    all_names = read_names((Path(args.spec).parent / names_file).resolve() if names_file else None)
    if names_file and not all_names:
        print(f'подписи полей не найдены: {names_file} — карточки покажут имена колонок')

    for ws in spec['workspaces']:
        name = ws['name']
        if gs.req('GET', f'/rest/workspaces/{name}.xml', ok=(200, 404)).status_code == 200:
            if not args.replace:
                sys.exit(f'Рабочая область {name} уже есть (--replace — пересоздать)')
            gs.req('DELETE', f'/rest/workspaces/{name}?recurse=true')
        gs.post_xml('/rest/namespaces', f'<namespace><prefix>{name}</prefix><uri>http://{name}</uri></namespace>')
        store = ws.get('store', db.get('schema', 'public'))
        params = {'host': db.get('host', 'localhost'), 'port': str(db.get('port', 5440)), 'database': db['database'],
                  'schema': db.get('schema', 'public'), 'user': db.get('user', 'postgres'),
                  'passwd': os.environ['DB_PASSWORD'], 'dbtype': 'postgis', 'Expose primary keys': 'true',
                  'Loose bbox': 'true', 'Estimated extends': 'true', 'max connections': '10',
                  'min connections': '1', 'fetch size': '1000', 'Connection timeout': '20'}
        cp = ''.join(f'<entry key="{escape(k)}">{escape(v)}</entry>' for k, v in params.items())
        gs.post_xml(f'/rest/workspaces/{name}/datastores',
                    f'<dataStore><name>{escape(store)}</name><type>PostGIS</type><enabled>true</enabled>'
                    f'<connectionParameters>{cp}</connectionParameters></dataStore>')
        print(f'{name}: хранилище {store} → {db["database"]}.{params["schema"]}')

        published = []
        for layer in ws['layers']:
            table, title = layer['table'], layer['title']
            gs.post_xml(f'/rest/workspaces/{name}/datastores/{store}/featuretypes',
                        f'<featureType><name>{table}</name><nativeName>{table}</nativeName>'
                        f'<title>{escape(title)}</title><srs>{srs}</srs>'
                        f'<projectionPolicy>FORCE_DECLARED</projectionPolicy>'
                        f'{bbox_xml("nativeBoundingBox", native, srs)}{bbox_xml("latLonBoundingBox", latlon, "EPSG:4326")}'
                        f'<enabled>true</enabled></featureType>')
            gs.req('POST', f'/rest/workspaces/{name}/styles', params={'name': table},
                   data=make_sld(table, title, layer['style']).encode('utf-8'),
                   headers={'Content-Type': 'application/vnd.ogc.sld+xml'})
            gs.post_xml(f'/rest/layers/{name}:{table}',
                        f'<layer><defaultStyle><name>{table}</name><workspace>{name}</workspace></defaultStyle></layer>',
                        method='PUT')
            gwc_layer(gs, f'{name}:{table}')
            # Карточка: колонки таблицы без геометрии (по атрибутам, которые вычислил GeoServer)
            ft = gs.get_xml(f'/rest/workspaces/{name}/datastores/{store}/featuretypes/{table}.xml')
            attrs = [(a.findtext('name'), (a.findtext('binding') or '').lower()) for a in ft.iter('attribute')]
            columns = [n for n, b in attrs if 'geom' not in b]
            geom = next((n for n, b in attrs if 'geom' in b), None)
            if 'id' in columns:
                gs.post_xml(f'/rest/workspaces/{name}/datastores/{store}/featuretypes',
                            id_view_xml(table, title, params['schema'], columns, all_names.get(table, {}),
                                        geom, spec.get('proj4')))
                # веб находит карточку слоя по id_<таблица> в WMTS GetCapabilities (geoserver-layers.ts)
                gwc_layer(gs, f'{name}:id_{table}', no_geometry=True)
            published.append(table)
            print(f'  {name}:{table} — {title}' + ('' if 'id' in columns else ' (без карточки: нет колонки id)'))

        pubs = ''.join(f'<published type="layer"><name>{name}:{t}</name></published>' for t in published)
        styles = ''.join('<style/>' for _ in published)
        gs.post_xml(f'/rest/workspaces/{name}/layergroups',
                    f'<layerGroup><name>{name}</name><mode>SINGLE</mode><title>{escape(ws.get("title", name))}</title>'
                    f'<publishables>{pubs}</publishables><styles>{styles}</styles>'
                    f'{bbox_xml("bounds", native, srs)}</layerGroup>')
        print(f'{name}: группа, {len(published)} слоёв')


if __name__ == '__main__':
    main()
