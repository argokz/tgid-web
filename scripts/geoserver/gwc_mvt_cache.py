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
"""
from __future__ import annotations

import argparse
import os
import sys
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


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--geoserver', default=os.environ.get('GEOSERVER_REST_URL', 'http://127.0.0.1:8085/geoserver'))
    ap.add_argument('--layers', default=','.join(DEFAULT_LAYERS), help='рабочая_область:слой через запятую')
    ap.add_argument('--expire', type=int, default=300, help='срок жизни тайла в кеше, с (по умолчанию 300)')
    ap.add_argument('--backup-dir', help='куда сохранить исходный XML слоёв (обязателен без --dry-run)')
    ap.add_argument('--restore', help='вернуть XML слоёв из каталога бэкапа')
    ap.add_argument('--dry-run', action='store_true', help='только показать изменения')
    args = ap.parse_args()

    gwc = Gwc(args.geoserver, os.environ.get('GEOSERVER_REST_USER', 'admin'), os.environ['GEOSERVER_REST_PASSWORD'])
    layers = [s.strip() for s in args.layers.split(',') if s.strip()]

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
