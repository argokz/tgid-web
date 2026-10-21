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

Насовсем, без пересчётов (22.10): охват сетки EPSG:900913 — весь мир. Тогда кеш отдаёт тайлы везде,
а веб берёт пределы сетки из WMTS (utils/mvtTileUrl.ts wmtsLayerGridBounds) — новые фрагменты и районы
видны сразу. Основной режим (настройка слоёв) ставит его сам; для уже настроенных слоёв:

    python scripts/geoserver/gwc_mvt_cache.py --world-extent --backup-dir H:/tgid-backups/<дата>_gwc

Где проверка через WFS не работает (ShaturaGIS: фильтр WITHIN падает на смешанных SRID view и
слоя), — пересчёт границ слоёв по данным без проверки (SQL view: экстент всего запроса):

    python scripts/geoserver/gwc_mvt_cache.py --recalc-bounds --layers ShaturaGIS:uzel,ShaturaGIS:heatpipesections         --backup-dir H:/tgid-backups/<дата>_gwc
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
    'ShaturaGIS:heatpipesections',
    'ShaturaGIS:uzel',
    'TarazGIS:heatpipesections',
    'TarazGIS:uzel',
    'AktobeGIS:heatpipesections',
    'AktobeGIS:uzel',
    'ShymkentGIS:heatpipesections',
    'ShymkentGIS:uzel',
]
# Охват сетки EPSG:900913 «весь мир»: кеш отдаёт тайлы везде, где есть объекты, — новый фрагмент или
# район за прежними границами слоя виден сразу, без пересчёта границ (веб берёт пределы сетки из WMTS)
WORLD_900913 = (-20037508.34, -20037508.34, 20037508.34, 20037508.34)


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
    set_world_extent(root)

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


def outside_bbox(gwc: Gwc, layer: str, sample: int = 5, bbox: dict | None = None) -> list:
    """Объекты слоя (все фрагменты, параметры view по умолчанию) хотя бы частично за его границами.

    Кеш GWC покрывает только границы слоя (latLonBoundingBox — их GeoServer считает по данным при
    публикации), за ними отвечает 400 TileOutOfRange, а веб такие тайлы не запрашивает: объект там
    на карте не появится.
    """
    b = bbox or native_bbox(gwc, layer)
    x0, y0 = b['minx'] - BOUNDS_EPS, b['miny'] - BOUNDS_EPS
    x1, y1 = b['maxx'] + BOUNDS_EPS, b['maxy'] + BOUNDS_EPS
    cql = f'NOT WITHIN(shape, POLYGON(({x0} {y0}, {x1} {y0}, {x1} {y1}, {x0} {y1}, {x0} {y0})))'
    r = gwc.req('GET', '/wfs', params={
        'SERVICE': 'WFS', 'VERSION': '2.0.0', 'REQUEST': 'GetFeature', 'typeNames': layer,
        'count': sample, 'outputFormat': 'application/json', 'CQL_FILTER': cql,
        **({'propertyName': 'shape'} if sample > 5 else {}),
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


# Запас при расширении границ по объектам за ними (метры): чтобы соседние новые здания не выпадали сразу
BOUNDS_MARGIN = 200.0


def coords(geom) -> list:
    """Все точки GeoJSON-геометрии [[x, y], ...]"""
    out = []

    def walk(c):
        if c and isinstance(c[0], (int, float)):
            out.append(c)
        else:
            for item in c or []:
                walk(item)

    if geom:
        walk(geom.get('coordinates'))
    return out


def expanded_bbox(gwc: Gwc, layer: str) -> dict:
    """Границы слоя, расширенные по всем объектам за ними (координаты WFS — в системе слоя)"""
    b = dict(native_bbox(gwc, layer))
    for _ in range(5):
        found = outside_bbox(gwc, layer, sample=100000, bbox=b)
        if not found:
            return b
        pts = [pt for f in found for pt in coords(f.get('geometry'))]
        if not pts:
            raise RuntimeError(f'{layer}: объекты за границами без геометрии')
        b['minx'] = min(b['minx'], min(p[0] for p in pts) - BOUNDS_MARGIN)
        b['maxx'] = max(b['maxx'], max(p[0] for p in pts) + BOUNDS_MARGIN)
        b['miny'] = min(b['miny'], min(p[1] for p in pts) - BOUNDS_MARGIN)
        b['maxy'] = max(b['maxy'], max(p[1] for p in pts) + BOUNDS_MARGIN)
    raise RuntimeError(f'{layer}: границы не сходятся за 5 шагов')


def set_world_extent(root: ET.Element) -> bool:
    """Охват сетки EPSG:900913 — весь мир; у других сеток явный охват снимается (границы слоя).

    Явный охват сетки остаётся от клонирования рабочей области (охват исходного города) или от
    прежних границ слоя — тогда объекты за ним на карте не видны (22.10: фрагменты Шатуры в Москве и
    Петербурге). → True — что-то изменилось.
    """
    changed = False
    for gs in root.iter('gridSubset'):
        exts = gs.findall('extent')
        if gs.findtext('gridSetName') != GRIDSET:
            for ext in exts:
                gs.remove(ext)
                changed = True
            continue
        want = [f'{v:.2f}' for v in WORLD_900913]
        have = [d.text for ext in exts for d in ext.iter('double')]
        if [f'{float(v):.2f}' for v in have if v] == want:
            continue
        for ext in exts:
            gs.remove(ext)
        coords = ET.SubElement(ET.SubElement(gs, 'extent'), 'coords')
        for v in want:
            ET.SubElement(coords, 'double').text = v
        changed = True
    return changed


def world_grid_extent(xml: str) -> str:
    root = ET.fromstring(xml)
    return ET.tostring(root, encoding='unicode') if set_world_extent(root) else xml


def fmt_bbox(b: dict) -> str:
    return f"{b['minx']:.1f}..{b['maxx']:.1f} x {b['miny']:.1f}..{b['maxy']:.1f}"


def fix_bounds(gwc: Gwc, layer: str, backup: Path | None, dry_run: bool = False, expand: bool = True):
    """Границы слоя — по данным, затем перечитать тайловый слой GWC (его сетка — по границам слоя).

    Сначала пересчёт GeoServer (recalculate). У обычной таблицы PostGIS он берёт ST_EstimatedExtent —
    оценку по выборке статистики, отдельные объекты на окраинах в неё не попадают (13.10: 429 зданий
    AlmatyGIS:zdaniya_2). Тогда границы расширяются по объектам за ними (WFS) и задаются явно
    (expand=False — без этого шага: там, где WFS-фильтр по слою не работает).
    """
    ws, name = layer.split(':', 1)
    path = f'/rest/workspaces/{ws}/featuretypes/{name}'
    before = native_bbox(gwc, layer)
    if dry_run:
        after = fmt_bbox(expanded_bbox(gwc, layer)) if expand else 'пересчёт по данным'
        print(f'{layer}: границы {fmt_bbox(before)} -> {after} (пробный прогон)')
        return
    stamp = time.strftime('%Y%m%d-%H%M%S')
    (backup / f'{layer.replace(":", "__")}.featuretype-{stamp}.xml').write_text(
        gwc.req('GET', f'{path}.xml').text, encoding='utf-8')
    # PUT принимается только по пути через хранилище (без него — 404 «No such feature type»)
    ft = gwc.req('GET', f'{path}.json').json()['featureType']
    store = ft['store']['name'].split(':', 1)[-1]
    put_path = f'/rest/workspaces/{ws}/datastores/{store}/featuretypes/{name}'
    xml_headers = {'Content-Type': 'text/xml'}
    gwc.req('PUT', f'{put_path}?recalculate=nativebbox,latlonbbox',
            data='<featureType><enabled>true</enabled></featureType>'.encode('utf-8'), headers=xml_headers)
    if expand and outside_bbox(gwc, layer, sample=1):
        b = expanded_bbox(gwc, layer)
        body = ('<featureType><nativeBoundingBox>'
                f"<minx>{b['minx']}</minx><maxx>{b['maxx']}</maxx><miny>{b['miny']}</miny><maxy>{b['maxy']}</maxy>"
                f"<crs>{ft['srs']}</crs></nativeBoundingBox></featureType>")
        gwc.req('PUT', f'{put_path}?recalculate=latlonbbox', data=body.encode('utf-8'), headers=xml_headers)
    gwc.put_layer(layer, world_grid_extent(gwc.get_layer(layer)))
    print(f'{layer}: границы {fmt_bbox(before)} -> {fmt_bbox(native_bbox(gwc, layer))}')


# тайл далеко за любым городом (уровень 12, юг Тихого океана, 150° з. д., 40° ю. ш.) — сетка «весь мир» отдаёт
# его (пустой, 200/204), ограниченная — 400 TileOutOfRange
PROBE_TILE = (12, 341, 2545)


def probe_world_tile(gwc: Gwc, layer: str) -> int:
    ws, name = layer.split(':', 1)
    z, x, y = PROBE_TILE
    r = gwc.s.get(f'{gwc.url}/{ws}/gwc/service/wmts', timeout=120, params={
        'SERVICE': 'WMTS', 'VERSION': '1.0.0', 'REQUEST': 'GetTile', 'LAYER': name, 'STYLE': '',
        'TILEMATRIXSET': GRIDSET, 'TILEMATRIX': f'{GRIDSET}:{z}', 'TILEROW': y, 'TILECOL': x, 'FORMAT': MVT,
    })
    return r.status_code


def world_extent(gwc: Gwc, layer: str, backup: Path | None, dry_run: bool) -> bool:
    """Охват сетки «весь мир» с проверкой тайлом за границами; не прошла — слой из бэкапа. → успех"""
    before = gwc.get_layer(layer)
    after = world_grid_extent(before)
    if dry_run:
        print(f'{layer}: {"уже весь мир" if after == before else "охват сетки -> весь мир"} (пробный прогон)')
        return True
    if after == before:
        code = probe_world_tile(gwc, layer)
        print(f'{layer}: охват уже весь мир, тайл за границами — HTTP {code}')
        return code in (200, 204)
    stamp = time.strftime('%Y%m%d-%H%M%S')
    (backup / f'{layer.replace(":", "__")}.gwc-{stamp}.xml').write_text(before, encoding='utf-8')
    gwc.put_layer(layer, after)
    code = probe_world_tile(gwc, layer)
    if code in (200, 204):
        print(f'{layer}: охват сетки — весь мир, тайл за прежними границами — HTTP {code}')
        return True
    gwc.put_layer(layer, before)
    print(f'{layer}: тайл за границами — HTTP {code}, охват возвращён как был', file=sys.stderr)
    return False


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
    ap.add_argument('--world-extent', action='store_true',
                    help='охват сетки EPSG:900913 слоёв --layers — весь мир (нужен --backup-dir); проверка тайлом')
    ap.add_argument('--recalc-bounds', action='store_true',
                    help='пересчитать границы слоёв --layers по данным без проверки WFS (нужен --backup-dir)')
    ap.add_argument('--fix-bounds', action='store_true',
                    help='пересчитать границы слоёв, у которых есть объекты за ними (нужен --backup-dir)')
    args = ap.parse_args()

    gwc = Gwc(args.geoserver, os.environ.get('GEOSERVER_REST_USER', 'admin'), os.environ['GEOSERVER_REST_PASSWORD'])
    layers = [s.strip() for s in args.layers.split(',') if s.strip()]

    if args.world_extent:
        if not args.dry_run and not args.backup_dir:
            ap.error('для --world-extent нужен --backup-dir (или --dry-run)')
        backup = Path(args.backup_dir) if args.backup_dir else None
        if backup:
            backup.mkdir(parents=True, exist_ok=True)
        failed = 0
        for layer in layers:
            failed += 0 if world_extent(gwc, layer, backup, args.dry_run) else 1
        return 2 if failed else 0

    if args.recalc_bounds:
        if not args.dry_run and not args.backup_dir:
            ap.error('для --recalc-bounds нужен --backup-dir (или --dry-run)')
        backup = Path(args.backup_dir) if args.backup_dir else None
        if backup:
            backup.mkdir(parents=True, exist_ok=True)
        for layer in layers:
            fix_bounds(gwc, layer, backup, dry_run=args.dry_run, expand=False)
        return 0

    if args.check_bounds or args.fix_bounds:
        bad = check_bounds(gwc, layers)
        if not args.fix_bounds or not bad:
            return 2 if bad else 0
        if args.dry_run:
            for layer in bad:
                fix_bounds(gwc, layer, None, dry_run=True)
            return 2
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
