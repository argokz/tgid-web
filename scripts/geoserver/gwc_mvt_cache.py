"""Кеш векторных тайлов (GeoWebCache) для слоёв сети ТГИД.

Без кеша веб берёт MVT через WMS GetMap: GeoServer выполняет SQL view на каждый тайл. Скрипт
настраивает тайловый слой GWC: сетку EPSG:900913 (без неё WMTS отвечает «Unable to match
requested TILEMATRIXSET»), формат MVT, параметр VIEWPARAMS (фрагменты, подписи, подсветка ПТС —
у каждого набора свой кеш) и срок жизни тайла. Веб (server/api/geoserver-layers.ts) сам переходит
на тайлы GWC, когда видит у слоя сетку EPSG:900913 в WMTS GetCapabilities.

Срок жизни (--expire, секунды) — сколько тайл может отставать от правок в базе, сделанных не из
веба (десктоп, импорт). Свои правки и расчёт веб показывает сразу: добавляет в VIEWPARAMS
версию данных (rev), и кеш такие тайлы не отдаёт.

    set GEOSERVER_REST_USER / GEOSERVER_REST_PASSWORD
    python scripts/geoserver/gwc_mvt_cache.py --dry-run
    python scripts/geoserver/gwc_mvt_cache.py --backup-dir H:/tgid-backups/2026-10-13_gwc
    python scripts/geoserver/gwc_mvt_cache.py --restore H:/tgid-backups/2026-10-13_gwc

Бэкап — исходный XML тайлового слоя (GET /gwc/rest/layers/<слой>.xml); --restore возвращает его
и очищает кеш слоя.

Границы. Кеш покрывает только границы слоя (их GeoServer считает по данным при публикации слоя);
за ними GWC отвечает 400, и веб туда не ходит — объект, появившийся за границами (новый район после
переконвертации базы, импорт), на карте не виден. Проверка (только чтение, код выхода 2 — есть такие)
и пересчёт границ по данным:

    python scripts/geoserver/gwc_mvt_cache.py --check-bounds
    python scripts/geoserver/gwc_mvt_cache.py --fix-bounds --backup-dir H:/tgid-backups/<дата>_gwc
"""
from __future__ import annotations

import argparse
import os
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

import requests

GRIDSET = 'EPSG:900913'
MVT = 'application/vnd.mapbox-vector-tile'
DEFAULT_LAYERS = [
    'AlmatyGIS:heatpipesections',
    'AlmatyGIS:uzel',
    'AlmatyGIS:zdaniya_2',
    'AstanaGIS:heatpipesections',
    'AstanaGIS:uzel',
]


class Gwc:
    def __init__(self, url: str, user: str, password: str):
        self.url = url.rstrip('/')
        self.s = requests.Session()
        self.s.auth = (user, password)

    def req(self, method: str, path: str, ok=(200, 201), **kw) -> requests.Response:
        r = self.s.request(method, f'{self.url}{path}', timeout=120, **kw)
        if r.status_code not in ok:
            raise RuntimeError(f'{method} {path}: {r.status_code} {r.text[:500]}')
        return r

    def get_layer(self, name: str) -> str:
        return self.req('GET', f'/gwc/rest/layers/{name}.xml').text

    def put_layer(self, name: str, xml: str):
        self.req('PUT', f'/gwc/rest/layers/{name}.xml', data=xml.encode('utf-8'),
                 headers={'Content-Type': 'text/xml; charset=utf-8'})

    def truncate(self, name: str):
        body = f'<truncateLayer><layerName>{name}</layerName></truncateLayer>'
        # masstruncate не принимает charset в Content-Type («Format extension unknown»)
        self.req('POST', '/gwc/rest/masstruncate', data=body.encode('utf-8'), headers={'Content-Type': 'text/xml'})


def child(parent: ET.Element, tag: str) -> ET.Element:
    el = parent.find(tag)
    if el is None:
        el = ET.SubElement(parent, tag)
    return el


def configure(xml: str, expire: int) -> str:
    root = ET.fromstring(xml)

    formats = child(root, 'mimeFormats')
    if MVT not in [s.text for s in formats.findall('string')]:
        ET.SubElement(formats, 'string').text = MVT

    subsets = child(root, 'gridSubsets')
    if GRIDSET not in [g.findtext('gridSetName') for g in subsets.findall('gridSubset')]:
        ET.SubElement(ET.SubElement(subsets, 'gridSubset'), 'gridSetName').text = GRIDSET

    # Векторный тайл — один на запрос: метатайл 4×4 строил бы 16 тайлов на первом обращении
    meta = child(root, 'metaWidthHeight')
    for el in list(meta):
        meta.remove(el)
    ET.SubElement(meta, 'int').text = '1'
    ET.SubElement(meta, 'int').text = '1'

    child(root, 'expireCache').text = str(expire)

    filters = child(root, 'parameterFilters')
    for f in list(filters):
        if (f.findtext('key') or '').upper() == 'VIEWPARAMS':
            filters.remove(f)
    rf = ET.SubElement(filters, 'regexParameterFilter')
    ET.SubElement(rf, 'key').text = 'VIEWPARAMS'
    ET.SubElement(rf, 'defaultValue').text = ''
    ET.SubElement(rf, 'regex').text = '.*'

    return ET.tostring(root, encoding='unicode')


def backup_name(layer: str) -> str:
    return layer.replace(':', '__') + '.xml'


# Запас к границам (единицы системы координат слоя — метры): крайние объекты лежат ровно на границе,
# а WITHIN границу не включает
BOUNDS_EPS = 1.0


def native_bbox(gwc: Gwc, layer: str) -> dict:
    ws, name = layer.split(':', 1)
    return gwc.req('GET', f'/rest/workspaces/{ws}/featuretypes/{name}.json').json()['featureType']['nativeBoundingBox']


def outside_bbox(gwc: Gwc, layer: str, sample: int = 5) -> list:
    """Объекты слоя (все фрагменты, параметры view по умолчанию) хотя бы частично за его границами.

    Кеш GWC покрывает только границы слоя (latLonBoundingBox — их GeoServer считает по данным при
    публикации), за ними отвечает 400 TileOutOfRange, а веб такие тайлы не запрашивает: объект там
    на карте не появится.
    """
    b = native_bbox(gwc, layer)
    x0, y0 = b['minx'] - BOUNDS_EPS, b['miny'] - BOUNDS_EPS
    x1, y1 = b['maxx'] + BOUNDS_EPS, b['maxy'] + BOUNDS_EPS
    cql = f'NOT WITHIN(shape, POLYGON(({x0} {y0}, {x1} {y0}, {x1} {y1}, {x0} {y1}, {x0} {y0})))'
    r = gwc.req('GET', '/wfs', params={
        'SERVICE': 'WFS', 'VERSION': '2.0.0', 'REQUEST': 'GetFeature', 'typeNames': layer,
        'count': sample, 'outputFormat': 'application/json', 'CQL_FILTER': cql,
    })
    if not r.headers.get('content-type', '').startswith('application/json'):
        raise RuntimeError(f'{layer}: WFS ответил не JSON: {r.text[:300]}')
    return r.json().get('features', [])


def describe(feature: dict) -> str:
    props = feature.get('properties') or {}
    name = props.get('name') or props.get('nam') or ''
    fid = feature.get('id') or props.get('id')
    return f'{fid} {name}'.strip()


def check_bounds(gwc: Gwc, layers: list) -> list:
    bad = []
    for layer in layers:
        found = outside_bbox(gwc, layer)
        if found:
            bad.append(layer)
            print(f'{layer}: ЕСТЬ объекты за границами кеша, например: {", ".join(describe(f) for f in found)}')
        else:
            print(f'{layer}: все объекты внутри границ')
    return bad


def fix_bounds(gwc: Gwc, layer: str, backup: Path):
    """Пересчитать границы слоя по данным и перечитать тайловый слой GWC (его сетка — по границам слоя)"""
    ws, name = layer.split(':', 1)
    path = f'/rest/workspaces/{ws}/featuretypes/{name}'
    stamp = time.strftime('%Y%m%d-%H%M%S')
    (backup / f'{layer.replace(":", "__")}.featuretype-{stamp}.xml').write_text(
        gwc.req('GET', f'{path}.xml').text, encoding='utf-8')
    before = native_bbox(gwc, layer)
    gwc.req('PUT', f'{path}?recalculate=nativebbox,latlonbbox',
            data='<featureType><enabled>true</enabled></featureType>'.encode('utf-8'),
            headers={'Content-Type': 'text/xml'})
    gwc.put_layer(layer, gwc.get_layer(layer))
    after = native_bbox(gwc, layer)
    fmt = lambda b: f"{b['minx']:.1f}..{b['maxx']:.1f} x {b['miny']:.1f}..{b['maxy']:.1f}"
    print(f'{layer}: границы {fmt(before)} -> {fmt(after)}')


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--geoserver', default=os.environ.get('GEOSERVER_REST_URL', 'http://127.0.0.1:8085/geoserver'))
    ap.add_argument('--layers', default=','.join(DEFAULT_LAYERS), help='рабочая_область:слой через запятую')
    ap.add_argument('--expire', type=int, default=300, help='срок жизни тайла в кеше, с (по умолчанию 300)')
    ap.add_argument('--backup-dir', help='куда сохранить исходный XML слоёв (обязателен без --dry-run)')
    ap.add_argument('--restore', help='вернуть XML слоёв из каталога бэкапа')
    ap.add_argument('--dry-run', action='store_true', help='только показать изменения')
    ap.add_argument('--check-bounds', action='store_true',
                    help='только проверить, нет ли объектов за границами кеша (код выхода 2 — есть)')
    ap.add_argument('--fix-bounds', action='store_true',
                    help='пересчитать границы слоёв, у которых есть объекты за ними (нужен --backup-dir)')
    args = ap.parse_args()

    gwc = Gwc(args.geoserver, os.environ.get('GEOSERVER_REST_USER', 'admin'), os.environ['GEOSERVER_REST_PASSWORD'])
    layers = [s.strip() for s in args.layers.split(',') if s.strip()]

    if args.check_bounds or args.fix_bounds:
        bad = check_bounds(gwc, layers)
        if not args.fix_bounds or not bad:
            return 2 if bad else 0
        if not args.backup_dir:
            ap.error('для --fix-bounds нужен --backup-dir')
        backup = Path(args.backup_dir)
        backup.mkdir(parents=True, exist_ok=True)
        for layer in bad:
            fix_bounds(gwc, layer, backup)
        still = check_bounds(gwc, bad)
        print('Веб увидит новые границы, когда обновит список слоёв: nginx хранит WMTS GetCapabilities до часа,\n'
              'сервер веба — список слоёв до часа (сразу: перезапуск служб веба или '
              '/tgid/<город>/api/geoserver-layers?refresh=true после истечения кеша nginx).')
        return 2 if still else 0

    if args.restore:
        src = Path(args.restore)
        for layer in layers:
            path = src / backup_name(layer)
            if not path.exists():
                print(f'{layer}: нет бэкапа {path}', file=sys.stderr)
                continue
            gwc.put_layer(layer, path.read_text(encoding='utf-8'))
            gwc.truncate(layer)
            print(f'{layer}: восстановлен, кеш очищен')
        return 0

    if not args.dry_run and not args.backup_dir:
        ap.error('нужен --backup-dir (или --dry-run)')
    backup = Path(args.backup_dir) if args.backup_dir else None
    if backup:
        backup.mkdir(parents=True, exist_ok=True)

    for layer in layers:
        before = gwc.get_layer(layer)
        after = configure(before, args.expire)
        if args.dry_run:
            print(f'== {layer}\n{after}\n')
            continue
        if not (backup / backup_name(layer)).exists():
            (backup / backup_name(layer)).write_text(before, encoding='utf-8')
        gwc.put_layer(layer, after)
        gwc.truncate(layer)
        check = ET.fromstring(gwc.get_layer(layer))
        grids = [g.findtext('gridSetName') for g in check.iter('gridSubset')]
        keys = [f.findtext('key') for f in check.find('parameterFilters') or []]
        print(f'{layer}: сетки {grids}, параметры {keys}, срок {check.findtext("expireCache")} с')
    return 0


if __name__ == '__main__':
    sys.exit(main())
