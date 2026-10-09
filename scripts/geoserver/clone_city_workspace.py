"""Клон рабочей области GeoServer схемы ТГИД (AlmatyGIS) для базы другого города.

Слои AlmatyGIS — SQL-view над схемой TGID (одинаковой во всех базах городов), поэтому для
нового города достаточно: своё хранилище на базу города, те же featuretype с местной системой
координат города (EPSG GeoServer: 9998 — Алматы, 9995 — Астана; см. user_projections/epsg.properties),
те же стили, форматы тайлов (MVT) и группа слоёв.

Опасные служебные слои (login — MD5-пароли, read_file/get_file/file — чтение файлов сервера)
не копируются: новый веб их не использует (docs/geoserver-city-workspace.md).

    set GEOSERVER_REST_USER / GEOSERVER_REST_PASSWORD / DB_PASSWORD
    python scripts/geoserver/clone_city_workspace.py --dst AstanaGIS --database astanagid_2026_09_22 --srid 9995

Повторный запуск с --replace удаляет рабочую область --dst целиком и создаёт заново.
--styles-only перезаливает только стили (SVG уже скопированы):

    python scripts/geoserver/clone_city_workspace.py --dst AstanaGIS --styles-only
"""
from __future__ import annotations

import argparse
import os
import sys
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape

import requests

SKIP_ALWAYS = {'login', 'read_file', 'get_file', 'file'}


class Gs:
    def __init__(self, url: str, user: str, password: str):
        self.url = url.rstrip('/')
        self.s = requests.Session()
        self.s.auth = (user, password)

    def req(self, method: str, path: str, ok=(200, 201), **kw) -> requests.Response:
        r = self.s.request(method, f'{self.url}{path}', timeout=600, **kw)
        if r.status_code not in ok:
            raise RuntimeError(f'{method} {path}: {r.status_code} {r.text[:500]}')
        return r

    def get_xml(self, path: str) -> ET.Element:
        return strip_atom(ET.fromstring(self.req('GET', path).content))

    def post_xml(self, path: str, el: ET.Element | str, method='POST'):
        body = el if isinstance(el, str) else ET.tostring(el, encoding='unicode')
        return self.req(method, path, data=body.encode('utf-8'),
                        headers={'Content-Type': 'application/xml; charset=utf-8'})


def copy_style(gs: Gs, src: str, dst: str, name: str, create: bool):
    """Стиль workspace src → dst исходным файлом.

    Файл берётся через /rest/resource: GET /rest/workspaces/…/styles/x.sld отдаёт SLD с уже
    разрешёнными ссылками (file:/…/workspaces/src/styles/svg/is.svg). Скопированный так стиль
    ссылался бы на SVG исходной рабочей области, и веб рисовал бы узлы кружками
    (utils/sldToMapLibre.ts берёт иконки только из рабочей области слоя).
    """
    info = gs.get_xml(f'/rest/workspaces/{src}/styles/{name}.xml')
    fmt = info.findtext('format') or 'sld'
    version = info.findtext('languageVersion/version') or '1.0.0'
    if fmt == 'sld':
        filename = info.findtext('filename') or f'{name}.sld'
        body = gs.req('GET', f'/rest/resource/workspaces/{src}/styles/{filename}').content
    else:
        # .json через /rest/resource GeoServer отдаёт ошибкой 500 (путь с .json считает запросом JSON);
        # ссылок на файлы в MBStyle нет, поэтому берём как раньше
        body = gs.req('GET', f'/rest/workspaces/{src}/styles/{name}.{fmt}').content
    ctype = 'application/vnd.ogc.se+xml' if version.startswith('1.1') else 'application/vnd.ogc.sld+xml'
    if fmt != 'sld':
        ctype = 'application/vnd.geoserver.mbstyle+json' if fmt == 'mbstyle' else 'application/octet-stream'
    if create:
        gs.req('POST', f'/rest/workspaces/{dst}/styles', params={'name': name}, data=body,
               headers={'Content-Type': ctype})
    else:
        gs.req('PUT', f'/rest/workspaces/{dst}/styles/{name}', data=body, headers={'Content-Type': ctype})


ATOM = '{http://www.w3.org/2005/Atom}'


def drop(el: ET.Element, *tags: str):
    for tag in tags:
        for child in el.findall(tag):
            el.remove(child)


def strip_atom(el: ET.Element) -> ET.Element:
    """Убрать ссылки atom:link, которые REST добавляет в ответы GET."""
    for parent in el.iter():
        for child in list(parent):
            if child.tag.startswith(ATOM):
                parent.remove(child)
    return el


def featuretype_for(src: ET.Element, srid: int, src_srid: int) -> ET.Element:
    """featuretype для POST в новое хранилище: без вычисленных атрибутов/охватов и ссылок на старый workspace.

    <attributes> из GET нельзя отправлять обратно: GeoServer заморозит схему SQL-view
    (ловушка, docs/geoserver-topology-layers.md)."""
    ft = src
    drop(ft, 'id', 'namespace', 'store', 'attributes', 'nativeBoundingBox', 'latLonBoundingBox', 'nativeCRS')
    srs = ft.find('srs')
    if srs is not None and srs.text == f'EPSG:{src_srid}':
        srs.text = f'EPSG:{srid}'
    for g in ft.iter('geometry'):
        s = g.find('srid')
        if s is not None and s.text == str(src_srid):
            s.text = str(srid)
    return ft


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--geoserver', default=os.environ.get('GEOSERVER_REST_URL', 'http://127.0.0.1:8085/geoserver'))
    ap.add_argument('--src', default='AlmatyGIS')
    ap.add_argument('--dst', required=True)
    ap.add_argument('--database', help='База города (не нужна с --styles-only)')
    ap.add_argument('--srid', type=int, help='EPSG местной системы города в GeoServer (не нужен с --styles-only)')
    ap.add_argument('--src-srid', type=int, default=9998)
    ap.add_argument('--db-host', default=os.environ.get('DB_HOST', 'localhost'))
    ap.add_argument('--db-port', default=os.environ.get('DB_PORT', '5440'))
    ap.add_argument('--db-user', default=os.environ.get('DB_USER', 'postgres'))
    ap.add_argument('--skip', default='', help='Ещё слои, которые не копировать (через запятую)')
    ap.add_argument('--replace', action='store_true', help='Удалить --dst, если уже есть')
    ap.add_argument('--styles-only', action='store_true',
                    help='Только перезалить стили src в уже созданную --dst (исходными файлами)')
    args = ap.parse_args()
    if not args.styles_only and (not args.database or not args.srid):
        ap.error('нужны --database и --srid')

    gs = Gs(args.geoserver, os.environ.get('GEOSERVER_REST_USER', 'admin'), os.environ['GEOSERVER_REST_PASSWORD'])
    src, dst = args.src, args.dst

    if args.styles_only:
        names = [s.findtext('name') for s in gs.get_xml(f'/rest/workspaces/{src}/styles.xml').findall('style')]
        have = {s.findtext('name') for s in gs.get_xml(f'/rest/workspaces/{dst}/styles.xml').findall('style')}
        for name in names:
            copy_style(gs, src, dst, name, create=name not in have)
        print(f'стили {dst} перезалиты: {", ".join(names)}')
        return
    skip = SKIP_ALWAYS | {s.strip() for s in args.skip.split(',') if s.strip()}

    exists = gs.req('GET', f'/rest/workspaces/{dst}.xml', ok=(200, 404)).status_code == 200
    if exists:
        if not args.replace:
            sys.exit(f'Рабочая область {dst} уже есть (--replace — пересоздать)')
        gs.req('DELETE', f'/rest/workspaces/{dst}?recurse=true')
        print(f'удалена {dst}')

    uri = gs.get_xml(f'/rest/namespaces/{src}.xml').findtext('uri') or f'http://{src}'
    gs.post_xml('/rest/namespaces', f'<namespace><prefix>{dst}</prefix><uri>{escape(uri.replace(src, dst))}</uri></namespace>')
    print(f'рабочая область {dst}')

    # Стили workspace и их SVG (ссылки в SLD относительные: svg/is.svg)
    styles = [s.findtext('name') for s in gs.get_xml(f'/rest/workspaces/{src}/styles.xml').findall('style')]
    svg_dir = gs.req('GET', f'/rest/resource/workspaces/{src}/styles/svg?format=json', ok=(200, 404))
    if svg_dir.status_code == 200:
        for child in (svg_dir.json().get('ResourceDirectory', {}).get('children', {}).get('child') or []):
            name = str(child['name'])
            if not name.lower().endswith('.svg'):
                continue
            data = gs.req('GET', f'/rest/resource/workspaces/{src}/styles/svg/{name}').content
            gs.req('PUT', f'/rest/resource/workspaces/{dst}/styles/svg/{name}', data=data,
                   headers={'Content-Type': 'image/svg+xml'})
    for name in styles:
        copy_style(gs, src, dst, name, create=True)
    print(f'стили: {", ".join(styles)}')

    # Хранилища: те же параметры, другая база; пароль — из окружения (в GET он зашифрован)
    stores = [s.findtext('name') for s in gs.get_xml(f'/rest/workspaces/{src}/datastores.xml').findall('dataStore')]
    copied: list[str] = []
    for store in stores:
        ds = gs.get_xml(f'/rest/workspaces/{src}/datastores/{store}.xml')
        params = {e.get('key'): (e.text or '') for e in ds.find('connectionParameters')}
        params.update({'database': args.database, 'host': args.db_host, 'port': str(args.db_port),
                       'user': args.db_user, 'passwd': os.environ['DB_PASSWORD']})
        params.pop('namespace', None)
        cp = ''.join(f'<entry key="{escape(k)}">{escape(v)}</entry>' for k, v in params.items())
        # хранилище, названное как workspace (генератор десктопа), получает имя нового workspace
        new_store = dst if store == src else store
        gs.post_xml(f'/rest/workspaces/{dst}/datastores',
                    f'<dataStore><name>{escape(new_store)}</name><type>{escape(ds.findtext("type") or "PostGIS")}</type>'
                    f'<enabled>true</enabled><connectionParameters>{cp}</connectionParameters></dataStore>')

        fts = [f.findtext('name') for f in gs.get_xml(
            f'/rest/workspaces/{src}/datastores/{store}/featuretypes.xml').findall('featureType')]
        for name in fts:
            if name in skip:
                print(f'  пропуск {name}')
                continue
            ft = featuretype_for(gs.get_xml(f'/rest/workspaces/{src}/datastores/{store}/featuretypes/{name}.xml'),
                                 args.srid, args.src_srid)
            try:
                gs.post_xml(f'/rest/workspaces/{dst}/datastores/{new_store}/featuretypes', ft)
            except RuntimeError as e:
                print(f'  ОШИБКА {name}: {e}')
                continue
            lay = gs.get_xml(f'/rest/layers/{src}:{name}.xml')
            st = lay.find('defaultStyle')
            if st is not None and st.findtext('workspace') == src:
                gs.post_xml(f'/rest/layers/{dst}:{name}',
                            f'<layer><defaultStyle><name>{escape(st.findtext("name").split(":")[-1])}</name>'
                            f'<workspace>{dst}</workspace></defaultStyle></layer>', method='PUT')
            # Форматы тайлового слоя GWC (MVT для веба)
            gwc = gs.req('GET', f'/gwc/rest/layers/{src}:{name}.xml', ok=(200, 404))
            if gwc.status_code == 200:
                g = ET.fromstring(gwc.content)
                drop(g, 'id')
                g.find('name').text = f'{dst}:{name}'
                gs.post_xml(f'/gwc/rest/layers/{dst}:{name}.xml', g, method='PUT')
            copied.append(name)
            print(f'  {new_store}:{name}')

    # Группа слоёв workspace (heatpipesections + uzel)
    for grp in gs.get_xml(f'/rest/workspaces/{src}/layergroups.xml').findall('layerGroup'):
        gname = grp.findtext('name')
        g = gs.get_xml(f'/rest/workspaces/{src}/layergroups/{gname}.xml')
        drop(g, 'id', 'workspace', 'bounds')
        if gname == src:
            g.find('name').text = dst
            gname = dst
        pubs = g.find('publishables')
        styles_el = g.find('styles')
        keep = []
        for i, p in enumerate(list(pubs)):
            lname = (p.findtext('name') or '').split(':')[-1]
            if lname not in copied:
                pubs.remove(p)
                continue
            drop(p, 'id')
            p.find('name').text = f'{dst}:{lname}'
            keep.append(i)
        if styles_el is not None:
            ss = list(styles_el)
            for i, s in enumerate(ss):
                if i not in keep:
                    styles_el.remove(s)
                else:
                    if s.findtext('workspace') == src:
                        s.find('workspace').text = dst
                        s.find('name').text = s.findtext('name').split(':')[-1]
        gs.post_xml(f'/rest/workspaces/{dst}/layergroups', g)
        print(f'группа {gname}')

    print(f'готово: {len(copied)} слоёв в {dst}')


if __name__ == '__main__':
    main()
