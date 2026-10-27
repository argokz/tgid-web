"""Стили зданий для веб-карты (этап 11, docs/map-visual-audit.md) в рабочей области GeoServer города.

Здания с нагрузкой (zdaniya_2) — спокойная тёплая заливка вместо розовой #ffc0cb с серым контуром,
с 14-го зума (на мелком масштабе здания — шум, а тайл z11 весил 2,4 МБ). Правило подписей (txt в доме,
размер в метрах) — то же, что в прежнем стиле «Здания 2019»: по нему веб строит подписи внутри дома.

Здания и трассы по техусловиям (zdaniya_tu) — прежде стиль generic: веб брал WMS-растр без кеша, серые
дома с чёрной обводкой. Теперь — свой стиль: полупрозрачная янтарная заливка и янтарный контур/трасса,
с 14-го зума; веб берёт векторные тайлы из кеша GWC.

GeoServer включает в векторный тайл только объекты, подходящие под правила стиля по умолчанию (фильтр и
масштаб), поэтому после смены стиля кеш GWC слоя очищается.

Стиль по умолчанию ставится новый, прежний остаётся в списке стилей слоя. Бэкап и откат:

    set GEOSERVER_REST_USER / GEOSERVER_REST_PASSWORD
    python scripts/geoserver/web_map_styles.py --workspace AlmatyGIS_test --backup-dir H:/tgid-backups/x
    python scripts/geoserver/web_map_styles.py --workspace AlmatyGIS_test --restore H:/tgid-backups/x

--check — только показать, что будет сделано (слои, текущие стили), ничего не меняя.

--slim-attributes — в векторный тайл зданий только нужные карте и «Подписям» поля (SLIM_ATTRIBUTES):
служебные и дублирующие (shape_area, shape_leng, street2, house2, коды районов и схем) не нужны —
карточка здания читает все поля по WFS из id_zdaniya_2. Бэкап хранит featuretype, откат его возвращает.
"""
from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from clone_city_workspace import Gs  # noqa: E402

SLD_TYPE = {'Content-Type': 'application/vnd.ogc.sld+xml; charset=utf-8'}

# Палитра — в тон подложке веба (utils/planetV4Layers.ts PLANET_PALETTE) и акценту интерфейса (#D97706)
BUILDING_FILL = '#ecdcd5'
BUILDING_STROKE = '#b39c94'
TU_COLOR = '#d97706'

# Масштаб ↔ зум веба (utils/sldToMapLibre.ts scaleDenominatorToZoom): 559082264 / 2^z
BUILDINGS_MAX_SCALE = 36000    # ≈ z14
TU_MAX_SCALE = 36000           # ≈ z14, как здания: на z13 обзор сети без ТУ
LABELS_MAX_SCALE = 5000        # ≈ z16.8 — как в прежнем стиле

SLD_HEAD = ('<?xml version="1.0" encoding="UTF-8"?>'
            '<sld:StyledLayerDescriptor xmlns:sld="http://www.opengis.net/sld" xmlns="http://www.opengis.net/sld" '
            'xmlns:gml="http://www.opengis.net/gml" xmlns:ogc="http://www.opengis.net/ogc" version="1.0.0">')

OTOP_NOT_NULL = ('<ogc:Filter><ogc:Not><ogc:PropertyIsNull><ogc:PropertyName>otop</ogc:PropertyName>'
                 '</ogc:PropertyIsNull></ogc:Not></ogc:Filter>')


def zdaniya2_sld() -> str:
    return (
        f'{SLD_HEAD}<sld:NamedLayer><sld:Name>zdaniya_2</sld:Name><sld:UserStyle>'
        '<sld:Name>zdaniya_2_web</sld:Name><sld:Title>Здания с нагрузкой (веб)</sld:Title>'
        '<sld:FeatureTypeStyle><sld:Rule><sld:Name>building</sld:Name><sld:Title>Здание с нагрузкой</sld:Title>'
        f'{OTOP_NOT_NULL}<sld:MaxScaleDenominator>{BUILDINGS_MAX_SCALE}</sld:MaxScaleDenominator>'
        '<sld:PolygonSymbolizer><sld:Fill>'
        f'<sld:CssParameter name="fill">{BUILDING_FILL}</sld:CssParameter>'
        '<sld:CssParameter name="fill-opacity">0.9</sld:CssParameter></sld:Fill><sld:Stroke>'
        f'<sld:CssParameter name="stroke">{BUILDING_STROKE}</sld:CssParameter>'
        '<sld:CssParameter name="stroke-width">0.5</sld:CssParameter></sld:Stroke></sld:PolygonSymbolizer></sld:Rule>'
        # Подписи — как в «Здания 2019»: txt в доме (interiorPoint), размер в метрах
        f'<sld:Rule><sld:Name>label</sld:Name>{OTOP_NOT_NULL}'
        f'<sld:MinScaleDenominator>1.0</sld:MinScaleDenominator><sld:MaxScaleDenominator>{LABELS_MAX_SCALE}'
        '</sld:MaxScaleDenominator><sld:TextSymbolizer uom="http://www.opengeospatial.org/se/units/metre">'
        '<sld:Geometry><ogc:Function name="interiorPoint"><ogc:PropertyName>shape</ogc:PropertyName></ogc:Function>'
        '</sld:Geometry><sld:Label><ogc:PropertyName>txt</ogc:PropertyName></sld:Label><sld:Font>'
        '<sld:CssParameter name="font-family">Arial</sld:CssParameter>'
        '<sld:CssParameter name="font-size">6</sld:CssParameter>'
        '<sld:CssParameter name="font-style">normal</sld:CssParameter>'
        '<sld:CssParameter name="font-weight">normal</sld:CssParameter></sld:Font><sld:LabelPlacement>'
        '<sld:PointPlacement><sld:AnchorPoint><sld:AnchorPointX>0.5</sld:AnchorPointX>'
        '<sld:AnchorPointY>0.5</sld:AnchorPointY></sld:AnchorPoint></sld:PointPlacement></sld:LabelPlacement>'
        '<sld:Halo><sld:Radius>0.4</sld:Radius><sld:Fill><sld:CssParameter name="fill">#ffffff</sld:CssParameter>'
        '</sld:Fill></sld:Halo><sld:Fill><sld:CssParameter name="fill">#3a3530</sld:CssParameter></sld:Fill>'
        '<sld:VendorOption name="conflictResolution">false</sld:VendorOption>'
        '<sld:VendorOption name="partials">true</sld:VendorOption></sld:TextSymbolizer></sld:Rule>'
        '</sld:FeatureTypeStyle></sld:UserStyle></sld:NamedLayer></sld:StyledLayerDescriptor>'
    )


def zdaniya_tu_sld() -> str:
    # Заливка рисуется только у полигонов, линия — контуром у полигонов и трассой у линий
    return (
        f'{SLD_HEAD}<sld:NamedLayer><sld:Name>zdaniya_tu</sld:Name><sld:UserStyle>'
        '<sld:Name>zdaniya_tu_web</sld:Name><sld:Title>Техусловия (веб)</sld:Title><sld:FeatureTypeStyle>'
        '<sld:Rule><sld:Name>tu_fill</sld:Name><sld:Title>Здание по ТУ</sld:Title>'
        f'<sld:MaxScaleDenominator>{TU_MAX_SCALE}</sld:MaxScaleDenominator><sld:PolygonSymbolizer><sld:Fill>'
        f'<sld:CssParameter name="fill">{TU_COLOR}</sld:CssParameter>'
        '<sld:CssParameter name="fill-opacity">0.1</sld:CssParameter></sld:Fill><sld:Stroke>'
        f'<sld:CssParameter name="stroke">{TU_COLOR}</sld:CssParameter></sld:Stroke></sld:PolygonSymbolizer>'
        '</sld:Rule><sld:Rule><sld:Name>tu_line</sld:Name><sld:Title>Контур и трасса по ТУ</sld:Title>'
        f'<sld:MaxScaleDenominator>{TU_MAX_SCALE}</sld:MaxScaleDenominator><sld:LineSymbolizer><sld:Stroke>'
        f'<sld:CssParameter name="stroke">{TU_COLOR}</sld:CssParameter>'
        '<sld:CssParameter name="stroke-width">1</sld:CssParameter>'
        '<sld:CssParameter name="stroke-opacity">0.75</sld:CssParameter></sld:Stroke></sld:LineSymbolizer>'
        '</sld:Rule></sld:FeatureTypeStyle></sld:UserStyle></sld:NamedLayer></sld:StyledLayerDescriptor>'
    )


STYLES = {
    'zdaniya_2': ('zdaniya_2_web', zdaniya2_sld),
    'zdaniya_tu': ('zdaniya_tu_web', zdaniya_tu_sld),
}

# Поля, на которые ссылаются правила стилей (фильтр и подпись)
STYLE_FIELDS = {'zdaniya_2': {'otop', 'txt'}}

# Поля слоя, которые остаются в тайле: геометрия, ключ, фильтр стиля (otop), подпись (txt),
# нагрузки и адрес — для вкладки «Подписи». Регистр имён — как в базе
SLIM_ATTRIBUTES = {
    'zdaniya_2': {'shape', 'objectid', 'otop', 'gvs', 'vent', 'par', 'nagr', 'txt',
                  'floor', 'number_1', 'street_nam', 'year_of_fo', 'potrebitel'},
}


def ft_path(gs: Gs, ws: str, layer: str) -> str:
    store = gs.get_xml(f'/rest/workspaces/{ws}/featuretypes/{layer}.xml').findtext('store/name').split(':')[-1]
    return f'/rest/workspaces/{ws}/datastores/{store}/featuretypes/{layer}.xml'


def slim_attributes(gs: Gs, ws: str, layer: str, keep: set[str], check: bool) -> list[str]:
    """Оставить в featuretype только поля keep (геометрию — всегда). → список убранных полей"""
    path = ft_path(gs, ws, layer)
    ft = gs.get_xml(path)
    attrs = ft.find('attributes')
    if attrs is None or not attrs.findall('attribute'):
        sys.exit(f'{ws}:{layer}: у featuretype нет списка атрибутов — урезать нечего, ничего не изменено')
    removed = []
    for a in list(attrs.findall('attribute')):
        name = a.findtext('name') or ''
        is_geometry = 'jts.geom' in (a.findtext('binding') or '')
        if name.lower() not in keep and not is_geometry:
            removed.append(name)
            if not check:
                attrs.remove(a)
    if removed and not check:
        gs.post_xml(path, ft, method='PUT')
    return removed


def bare(name: str | None) -> str:
    """REST отдаёт имя стиля с префиксом workspace"""
    return (name or '').split(':')[-1]


def layer_styles(gs: Gs, ws: str, layer: str) -> tuple[str, list[str]] | None:
    """(стиль по умолчанию, прочие стили) слоя; None — слоя в рабочей области нет"""
    r = gs.req('GET', f'/rest/layers/{ws}:{layer}.xml', ok=(200, 404))
    if r.status_code == 404:
        return None
    info = gs.get_xml(f'/rest/layers/{ws}:{layer}.xml')
    styles = info.find('styles')
    others = [bare(s.findtext('name')) for s in styles.findall('style')] if styles is not None else []
    return bare(info.findtext('defaultStyle/name')), others


def put_layer_styles(gs: Gs, ws: str, layer: str, default: str, others: list[str]):
    """Стиль по умолчанию и список стилей слоя. Глобальные стили (generic) — без рабочей области"""
    def ref(name: str) -> str:
        local = gs.req('GET', f'/rest/workspaces/{ws}/styles/{name}.xml', ok=(200, 404)).status_code == 200
        return f'<name>{name}</name>' + (f'<workspace>{ws}</workspace>' if local else '')
    extra = ''.join(f'<style>{ref(n)}</style>' for n in others if n and n != default)
    gs.post_xml(f'/rest/layers/{ws}:{layer}.xml',
                f'<layer><defaultStyle>{ref(default)}</defaultStyle><styles>{extra}</styles></layer>', method='PUT')


def truncate_gwc(gs: Gs, ws: str, layer: str):
    """Очистить кеш GWC слоя: в векторный тайл попадают объекты по правилам стиля по умолчанию"""
    gs.req('POST', '/gwc/rest/masstruncate', ok=(200, 201),
           data=f'<truncateLayer><layerName>{ws}:{layer}</layerName></truncateLayer>'.encode('utf-8'),
           headers={'Content-Type': 'text/xml'})


def backup(gs: Gs, ws: str, folder: str):
    """Стили слоёв (по умолчанию и список) → folder/manifest.json"""
    os.makedirs(folder, exist_ok=True)
    manifest: dict = {'workspace': ws, 'layers': {}}
    for layer in STYLES:
        current = layer_styles(gs, ws, layer)
        if current is None:
            continue
        default, others = current
        manifest['layers'][layer] = {'default': default, 'styles': others}
        with open(os.path.join(folder, f'layer_{layer}.xml'), 'wb') as f:
            f.write(gs.req('GET', f'/rest/layers/{ws}:{layer}.xml').content)
        if layer in SLIM_ATTRIBUTES:
            path = ft_path(gs, ws, layer)
            with open(os.path.join(folder, f'featuretype_{layer}.xml'), 'wb') as f:
                f.write(gs.req('GET', path).content)
            manifest['layers'][layer]['featuretype'] = path
    with open(os.path.join(folder, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f'бэкап {ws}: {folder}')


def restore(gs: Gs, ws: str, folder: str):
    """Вернуть прежние стили слоёв и очистить их кеш GWC (стили *_web остаются в рабочей области)"""
    with open(os.path.join(folder, 'manifest.json'), encoding='utf-8') as f:
        manifest = json.load(f)
    if manifest['workspace'] != ws:
        sys.exit(f'бэкап сделан для {manifest["workspace"]}, а не для {ws}')
    for layer, item in manifest['layers'].items():
        if item.get('featuretype'):
            with open(os.path.join(folder, f'featuretype_{layer}.xml'), encoding='utf-8') as f:
                gs.post_xml(item['featuretype'], f.read(), method='PUT')
            print(f'{ws}:{layer}: поля featuretype из бэкапа')
        put_layer_styles(gs, ws, layer, item['default'], item['styles'])
        truncate_gwc(gs, ws, layer)
        print(f'{ws}:{layer}: стиль по умолчанию {item["default"]} (из бэкапа), кеш GWC очищен')


def missing_style_fields(gs: Gs, ws: str, layer: str) -> list[str]:
    """Поля, на которые ссылается стиль, но которых нет у слоя: GeoServer ответил бы 400 на любой тайл"""
    need = STYLE_FIELDS.get(layer, set())
    if not need:
        return []
    names = {(a.text or '').lower() for a in gs.get_xml(ft_path(gs, ws, layer)).iter('name')}
    return sorted(need - names)


def apply(gs: Gs, ws: str, check: bool):
    for layer, (style, build) in STYLES.items():
        current = layer_styles(gs, ws, layer)
        if current is None:
            print(f'{ws}:{layer}: слоя нет — пропуск')
            continue
        missing = missing_style_fields(gs, ws, layer)
        if missing:
            print(f'{ws}:{layer}: нет полей {", ".join(missing)} — стиль не ставлю, пропуск')
            continue
        default, others = current
        print(f'{ws}:{layer}: сейчас {default}, станет {style}')
        if check:
            continue
        sld = build().encode('utf-8')
        exists = gs.req('GET', f'/rest/workspaces/{ws}/styles/{style}.xml', ok=(200, 404)).status_code == 200
        if not exists:
            gs.req('POST', f'/rest/workspaces/{ws}/styles', params={'name': style, 'raw': 'true'},
                   data=sld, headers=SLD_TYPE)
        gs.req('PUT', f'/rest/workspaces/{ws}/styles/{style}', params={'raw': 'true'}, data=sld, headers=SLD_TYPE)
        if default != style:
            put_layer_styles(gs, ws, layer, style, [*others, default])
        truncate_gwc(gs, ws, layer)
        previous = f' (прежний {default} — в списке стилей)' if default != style else ''
        print(f'{ws}:{layer}: стиль {style}', 'обновлён' if exists else 'создан',
              f'и по умолчанию{previous}, кеш GWC очищен')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--geoserver', default=os.environ.get('GEOSERVER_REST_URL', 'http://127.0.0.1:8085/geoserver'))
    ap.add_argument('--workspace', required=True)
    ap.add_argument('--backup-dir', help='Сохранить стили слоёв перед правкой (каталог)')
    ap.add_argument('--restore', metavar='DIR', help='Вернуть стили из каталога бэкапа и выйти')
    ap.add_argument('--check', action='store_true', help='Только показать, что будет сделано')
    ap.add_argument('--slim-attributes', action='store_true',
                    help='Оставить в тайлах зданий только нужные карте поля (SLIM_ATTRIBUTES)')
    args = ap.parse_args()

    gs = Gs(args.geoserver, os.environ.get('GEOSERVER_REST_USER', 'admin'), os.environ['GEOSERVER_REST_PASSWORD'])
    ws = args.workspace
    if args.restore:
        restore(gs, ws, args.restore)
        gs.req('POST', '/rest/reset', ok=(200, 201))
        return
    if args.backup_dir and not args.check:
        backup(gs, ws, args.backup_dir)
    apply(gs, ws, args.check)
    if not args.slim_attributes:
        return
    for layer, keep in SLIM_ATTRIBUTES.items():
        if layer_styles(gs, ws, layer) is None:
            continue
        removed = slim_attributes(gs, ws, layer, keep, args.check)
        verb = 'будут убраны' if args.check else 'убраны'
        print(f'{ws}:{layer}: поля тайла {verb}: {", ".join(removed) or "—"}')
        if removed and not args.check:
            truncate_gwc(gs, ws, layer)
    if not args.check:
        gs.req('POST', '/rest/reset', ok=(200, 201))


if __name__ == '__main__':
    main()
