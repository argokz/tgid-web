"""Участки и узлы теплосети «как в программе» (десктоп gid8) для рабочей области GeoServer города.

Участки (слой heatpipesections). Десктоп рисует участок двумя параллельными линиями
(gidview/gidr_draw.cpp, colorgtd.cpp):
  - подача — слева по ходу участка, тёмно-красная #7f0000; обратка — справа, тёмно-синяя #00007f;
    участок только с подачей или только с обраткой — одной линией (linesobj.externalsignlineid:
    1 — обе, 2 и 4 — подача, 3 и 5 — обратка; cxema/read_lines.cpp);
  - магистраль (Ø внутр. ≥ 400 вне внутренних схем, colorgtd.h MagRasPar) — толщина 3, остальные — 1;
  - надземная прокладка (tubingtypeid = 4) — пунктир;
  - закрытая труба (pipesectstateidflow / pipesectstateidret = 2) — оливковая #808000.
Скрипт дописывает в SQL-view поля pod, obr, zakr_p, zakr_o, mag_gid, nadz_gid (0/1, без NULL —
фильтры MBStyle сравнивают с "0"/"1"), создаёт MBStyle heatpipesections_gid (подписи участков —
из прежнего стиля слоя) и делает его стилем по умолчанию; прежний остаётся в списке стилей слоя.

Узлы (слой uzel). Обычный узел с внутренней схемой (камера, ЦТРП, павильон) десктоп рисует знаком
камеры (gidr_draw.cpp drawNode0: isP && TIP_US → picKAM). В view такой узел получает code = 'TK',
в стиль uzel добавляются правила TK со значком svg/tk.svg. Нужен индекс nodes(internalnodeid)
в базе города, иначе каждый тайл перебирает все узлы.

    set GEOSERVER_REST_USER / GEOSERVER_REST_PASSWORD
    python scripts/geoserver/gid_desktop_style.py --workspace AstanaGIS

Откат участков: --restore-style AlmatyGIS_heatpipesections (стиль по умолчанию); узлов — перезалить
стили из AlmatyGIS (clone_city_workspace.py --styles-only). Новые поля view ничему не мешают.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(__file__))
from clone_city_workspace import Gs  # noqa: E402

STYLE_NAME = 'heatpipesections_gid'
MARKER = '-- gid_desktop_style.py'
COLUMNS = f"""
{MARKER}: отрисовка как в десктопе (gid8 cxema/read_lines.cpp, gidview/colorgtd.h)
case when l.externalsignlineid in (1, 2, 4) then 1 else 0 end as pod,
case when l.externalsignlineid in (1, 3, 5) then 1 else 0 end as obr,
case when hps.pipeSectStateIDflow = 2 then 1 else 0 end as zakr_p,
case when hps.pipeSectStateIDret = 2 then 1 else 0 end as zakr_o,
case when hps.diameterInternal >= 400 then 1 else 0 end as mag_gid,
case when hps.tubingTypeID = 4 then 1 else 0 end as nadz_gid,
"""
ANCHOR = 'l.shape\nfrom linesobj l'

SUPPLY, RETURN, CLOSED = '#7f0000', '#00007f', '#808000'


def eq(field: str, value: int) -> list:
    return ['==', field, str(value)]


def build_style(label_layers: list[dict]) -> dict:
    layers: list[dict] = [{
        'id': 'Выделенные (warning=1)',
        'type': 'line',
        'source': 'pipelines',
        'source-layer': 'heatpipesections',
        'minzoom': 9,
        'filter': eq('warning', 1),
        'layout': {'line-cap': 'round', 'line-join': 'round'},
        'paint': {'line-color': '#ffff00', 'line-width': 7},
    }]
    for side, closed, name, color, sign in (('obr', 'zakr_o', 'Обратка', RETURN, 1),
                                            ('pod', 'zakr_p', 'Подача', SUPPLY, -1)):
        for mag in (0, 1):
            for nadz in (0, 1):
                for zakr in (0, 1):
                    width = 3 if mag else 1
                    paint: dict = {
                        'line-color': CLOSED if zakr else color,
                        'line-width': width,
                        'line-offset': sign * (2 if mag else 1.5),
                    }
                    if nadz:
                        paint['line-dasharray'] = [2, 1] if mag else [3, 2]
                    title = ' '.join(filter(None, [
                        name,
                        'магистраль' if mag else 'распределительная',
                        'надземная' if nadz else '',
                        'закрытая' if zakr else '',
                    ]))
                    layers.append({
                        'id': title,
                        'type': 'line',
                        'source': 'pipelines',
                        'source-layer': 'heatpipesections',
                        'minzoom': 9,
                        'filter': ['all', eq(side, 1), eq('mag_gid', mag), eq('nadz_gid', nadz), eq(closed, zakr)],
                        'layout': {'line-cap': 'butt', 'line-join': 'round'},
                        'paint': paint,
                    })
    layers.extend(label_layers)
    return {
        'version': 8,
        'name': 'Участки теплосети как в программе (gid8)',
        'sources': {'pipelines': {'type': 'vector', 'url': 'mapbox://heatpipesections'}},
        'layers': layers,
    }


def put_featuretype(gs: Gs, path: str, ft: ET.Element):
    # Без attributes GeoServer заново читает поля из SQL
    for parent in ft.iter():
        for child in list(parent):
            if child.tag == 'attributes':
                parent.remove(child)
    gs.post_xml(path, ft, method='PUT')


TK_SVG = """<?xml version="1.0" encoding="UTF-8"?>
<!-- Узел с внутренней схемой: квадрат, круг и задвижка (gid8 gidview/primdrawnode.h picKAM) -->
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="-50 -50 100 100">
  <rect x="-33" y="-33" width="66" height="66" fill="white" stroke="black" stroke-width="4"/>
  <circle cx="0" cy="0" r="33" fill="white" stroke="black" stroke-width="4"/>
  <polygon points="27,20 27,-20 -27,20 -27,-20" fill="black"/>
</svg>
"""
NODE_SQL_EDITS = [
    ("   ELSE 'US'",
     "   WHEN sch.id is not null then 'TK'  -- узел с внутренней схемой: знак камеры десктопа (gid_desktop_style.py)\n"
     "   ELSE 'US'"),
    ("ELSE 'Узел'\nEND AS code2",
     "WHEN sch.id is not null then 'Узел с внутренней схемой'\nELSE 'Узел'\nEND AS code2"),
    ("left join pumpstations pc on pc.nodeid = n.id",
     "left join pumpstations pc on pc.nodeid = n.id\n"
     "left join lateral (select c.internalnodeid as id from nodes c\n"
     "                   where c.internalnodeid = n.id and c.removed = 0 limit 1) sch on true"),
]


def patch_uzel(gs: Gs, ws: str, store: str, layer: str = 'uzel') -> list[str]:
    done = []
    path = f'/rest/workspaces/{ws}/datastores/{store}/featuretypes/{layer}.xml'
    ft = gs.get_xml(path)
    sql_el = ft.find('.//virtualTable/sql')
    sql = sql_el.text or ''
    if "then 'TK'" not in sql:
        for old, new in NODE_SQL_EDITS:
            if sql.count(old) != 1:
                sys.exit(f'{ws}:{layer}: не найдено место правки ({old!r})')
            sql = sql.replace(old, new)
        sql_el.text = sql
        put_featuretype(gs, path, ft)
        done.append('view: code TK')

    gs.req('PUT', f'/rest/resource/workspaces/{ws}/styles/svg/tk.svg', data=TK_SVG.encode('utf-8'),
           headers={'Content-Type': 'image/svg+xml'})

    style = bare(gs.get_xml(f'/rest/layers/{ws}:{layer}.xml').findtext('defaultStyle/name'))
    info = gs.get_xml(f'/rest/workspaces/{ws}/styles/{style}.xml')
    filename = info.findtext('filename') or f'{style}.sld'
    sld = gs.req('GET', f'/rest/resource/workspaces/{ws}/styles/{filename}').content.decode('utf-8')
    if 'svg/tk.svg' not in sld:
        rules = re.findall(r'<se:Rule>(?:(?!</se:Rule>).)*?<ogc:Literal>US</ogc:Literal>.*?</se:Rule>', sld, re.S)
        if not rules:
            sys.exit(f'{ws}:{style}: нет правил code = US')
        for rule in rules:
            tk = (rule.replace('<ogc:Literal>US</ogc:Literal>', '<ogc:Literal>TK</ogc:Literal>')
                      .replace('svg/us.svg', 'svg/tk.svg'))
            # Знак камеры в десктопе крупнее точки узла: ±5 против r=3
            tk = re.sub(r'<Size>(\d+(?:\.\d+)?)</Size>', lambda m: f'<Size>{round(float(m.group(1)) * 1.6)}</Size>', tk)
            sld = sld.replace(rule, rule + '\n<!-- узел с внутренней схемой (gid_desktop_style.py) -->\n' + tk, 1)
        version = info.findtext('languageVersion/version') or '1.0.0'
        ctype = 'application/vnd.ogc.se+xml' if version.startswith('1.1') else 'application/vnd.ogc.sld+xml'
        gs.req('PUT', f'/rest/workspaces/{ws}/styles/{style}', params={'raw': 'true'},
               data=sld.encode('utf-8'), headers={'Content-Type': ctype})
        done.append(f'стиль {style}: {len(rules)} правил TK')
    return done


def bare(name: str | None) -> str:
    """REST отдаёт имя стиля с префиксом workspace"""
    return (name or '').split(':')[-1]


def patch_view(gs: Gs, ws: str, store: str, layer: str) -> bool:
    path = f'/rest/workspaces/{ws}/datastores/{store}/featuretypes/{layer}.xml'
    ft = gs.get_xml(path)
    sql_el = ft.find('.//virtualTable/sql')
    sql = sql_el.text or ''
    if 'отрисовка как в десктопе' in sql:
        return False
    if sql.count(ANCHOR) != 1:
        sys.exit(f'{ws}:{layer}: не найдено место вставки полей ({ANCHOR!r})')
    sql_el.text = sql.replace(ANCHOR, COLUMNS.strip('\n') + '\n\n' + ANCHOR)
    # Без attributes GeoServer заново читает поля из SQL
    for parent in ft.iter():
        for child in list(parent):
            if child.tag == 'attributes':
                parent.remove(child)
    gs.post_xml(path, ft, method='PUT')
    return True


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--geoserver', default=os.environ.get('GEOSERVER_REST_URL', 'http://127.0.0.1:8085/geoserver'))
    ap.add_argument('--workspace', required=True)
    ap.add_argument('--layer', default='heatpipesections')
    ap.add_argument('--restore-style', help='Вернуть стиль по умолчанию (откат) и выйти')
    args = ap.parse_args()

    gs = Gs(args.geoserver, os.environ.get('GEOSERVER_REST_USER', 'admin'), os.environ['GEOSERVER_REST_PASSWORD'])
    ws, layer = args.workspace, args.layer
    layer_path = f'/rest/layers/{ws}:{layer}.xml'

    if args.restore_style:
        gs.post_xml(layer_path, f'<layer><defaultStyle><name>{args.restore_style}</name>'
                                f'<workspace>{ws}</workspace></defaultStyle></layer>', method='PUT')
        print(f'{ws}:{layer}: стиль по умолчанию {args.restore_style}')
        return

    info = gs.get_xml(layer_path)
    current = bare(info.findtext('defaultStyle/name'))
    styles = info.find('styles')
    others = [bare(s.findtext('name')) for s in styles.findall('style')] if styles is not None else []
    previous = current if current != STYLE_NAME else next((n for n in others if n != STYLE_NAME), '')
    store = gs.get_xml(f'/rest/workspaces/{ws}/featuretypes/{layer}.xml').findtext('store/name').split(':')[-1]

    print(f'{ws}:{layer}: поля view', 'добавлены' if patch_view(gs, ws, store, layer) else 'уже есть')

    # Подписи участков — из прежнего стиля (MBStyle), чтобы не разошлись с Алматы
    labels: list[dict] = []
    if previous:
        prev = gs.req('GET', f'/rest/workspaces/{ws}/styles/{previous}.mbstyle', ok=(200, 404))
        if prev.status_code == 200:
            labels = [l for l in prev.json().get('layers', []) if l.get('type') == 'symbol']

    body = json.dumps(build_style(labels), ensure_ascii=False, indent=2).encode('utf-8')
    exists = gs.req('GET', f'/rest/workspaces/{ws}/styles/{STYLE_NAME}.xml', ok=(200, 404)).status_code == 200
    ctype = {'Content-Type': 'application/vnd.geoserver.mbstyle+json'}
    if not exists:
        stub = json.dumps(build_style([]), ensure_ascii=False).encode('utf-8')
        gs.req('POST', f'/rest/workspaces/{ws}/styles', params={'name': STYLE_NAME}, data=stub, headers=ctype)
    # raw=true: без него GeoServer перечитывает стиль и отвечает 400 на слой подписей
    # (тот же слой лежит в стиле Алматы и работает)
    gs.req('PUT', f'/rest/workspaces/{ws}/styles/{STYLE_NAME}', params={'raw': 'true'}, data=body, headers=ctype)
    print(f'стиль {ws}:{STYLE_NAME}', 'обновлён' if exists else 'создан', f'({len(labels)} слоя подписей)')

    if current != STYLE_NAME:
        extra = ''.join(f'<style><name>{n}</name><workspace>{ws}</workspace></style>'
                        for n in sorted((set(others) | {current}) - {STYLE_NAME, ''}))
        gs.post_xml(layer_path, f'<layer><defaultStyle><name>{STYLE_NAME}</name><workspace>{ws}</workspace>'
                                f'</defaultStyle><styles>{extra}</styles></layer>', method='PUT')
        print(f'{ws}:{layer}: стиль по умолчанию {STYLE_NAME} (был {current}, остался в списке стилей)')

    print(f'{ws}:uzel:', ', '.join(patch_uzel(gs, ws, store)) or 'уже настроен')


if __name__ == '__main__':
    main()
