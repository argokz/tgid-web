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
в базе города, иначе каждый тайл перебирает все узлы. Подписи узлов — поле label (название без
технических «#…») и podp (displaySign десктопа), см. NODE_LABELS.

    set GEOSERVER_REST_USER / GEOSERVER_REST_PASSWORD
    python scripts/geoserver/gid_desktop_style.py --workspace AstanaGIS

Подсветка участков ПТС: параметры view nach / ms / rs (0 — без подсветки) → поле warning,
жёлтая подложка стиля. Только view, стили не трогать: --view-only.

Откат участков: --restore-style AlmatyGIS_heatpipesections (стиль по умолчанию); узлов — перезалить
стили из AlmatyGIS (clone_city_workspace.py --styles-only). Новые поля view ничему не мешают.
"""
from __future__ import annotations

import argparse
import json
import os
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


def stops(*pairs: tuple[float, float], k: float = 1) -> dict:
    """Значение по зуму (функция MBStyle с stops — её понимают и MapLibre, и GeoServer)"""
    return {'stops': [[z, round(v * k, 2)] for z, v in pairs]}


# Ширина и разнос подачи/обратки по зуму. Магистрали видны с обзора города (9), распределительные
# сети — с 12: на обзоре они сливаются в сплошную заливку. До 12–13 разноса нет, линии одна поверх
# другой (сверху подача), дальше расходятся, как в программе.
MAG_MINZOOM, DIST_MINZOOM = 9, 12
MAG_WIDTH = ((9, 1), (12, 1.6), (14, 2.4), (16, 3), (18, 4), (20, 5))
MAG_OFFSET = ((9, 0), (12, 0.4), (14, 1.4), (16, 2), (18, 2.6), (20, 3.2))
DIST_WIDTH = ((12, 0.5), (14, 0.9), (16, 1.2), (18, 1.7), (20, 2.4))
DIST_OFFSET = ((12, 0), (13, 0.3), (15, 0.9), (17, 1.3), (20, 1.9))
DIST_OPACITY = ((12, 0.55), (14, 0.9), (15, 1))


def build_style(label_layers: list[dict]) -> dict:
    layers: list[dict] = [{
        'id': 'Выделенные (warning=1)',
        'type': 'line',
        'source': 'pipelines',
        'source-layer': 'heatpipesections',
        'minzoom': MAG_MINZOOM,
        'filter': eq('warning', 1),
        'layout': {'line-cap': 'round', 'line-join': 'round'},
        'paint': {'line-color': '#ffff00', 'line-width': stops((9, 3), (14, 6), (18, 9))},
    }]
    for side, closed, name, color, sign in (('obr', 'zakr_o', 'Обратка', RETURN, 1),
                                            ('pod', 'zakr_p', 'Подача', SUPPLY, -1)):
        for mag in (0, 1):
            for nadz in (0, 1):
                for zakr in (0, 1):
                    paint: dict = {
                        'line-color': CLOSED if zakr else color,
                        'line-width': stops(*(MAG_WIDTH if mag else DIST_WIDTH)),
                        'line-offset': stops(*(MAG_OFFSET if mag else DIST_OFFSET), k=sign),
                    }
                    if not mag:
                        paint['line-opacity'] = stops(*DIST_OPACITY)
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
                        'minzoom': MAG_MINZOOM if mag else DIST_MINZOOM,
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


# Значки узлов: квадрат 100×100 без пустых полей, обводка толще — при 8–12 px контур ещё читается.
# Форма — как у знаков десктопа (gid8 gidview/primdrawnode.h). Растр веба — по width/height файла,
# поэтому у всех файлов 100×100: тогда размер в SLD = размер значка в пикселях.
def _svg(body: str, comment: str) -> str:
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            f'<!-- {comment} (gid_desktop_style.py) -->\n'
            '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="-50 -50 100 100">\n'
            f'{body}\n</svg>\n')


NODE_SVGS = {
    'us.svg': _svg('  <circle r="38" fill="white" stroke="black" stroke-width="12"/>', 'Узел'),
    'pr.svg': _svg('  <circle r="40" fill="white" stroke="black" stroke-width="10"/>\n'
                   '  <circle r="17" fill="black"/>', 'Потребитель (зависимая схема)'),
    'el.svg': _svg('  <polygon points="-6,0 46,-30 46,30" fill="white" stroke="black" stroke-width="8"'
                   ' stroke-linejoin="round"/>\n'
                   '  <circle cx="-14" r="30" fill="white" stroke="black" stroke-width="10"/>\n'
                   '  <circle cx="-14" r="11" fill="black"/>', 'Потребитель с элеватором'),
    'nz.svg': _svg('  <rect x="-38" y="-38" width="76" height="76" fill="white" stroke="black" stroke-width="10"/>\n'
                   '  <circle r="14" fill="black"/>', 'Потребитель (независимая схема)'),
    'po.svg': _svg('  <circle r="40" fill="white" stroke="black" stroke-width="9"/>\n'
                   '  <circle r="18" fill="white" stroke="black" stroke-width="9"/>', 'Обобщённый потребитель'),
    'is.svg': _svg('  <polygon points="44,44 44,-6 30,-6 16,-26 2,-26 -10,-6 -18,-6 -18,-46 -34,-46 -34,-6 -44,-6 -44,44"'
                   ' fill="#ffe0e0" stroke="#7f0000" stroke-width="7" stroke-linejoin="round"/>\n'
                   '  <circle cx="0" cy="20" r="10" fill="#7f0000"/>', 'Источник тепла'),
    'ns.svg': _svg('  <rect x="-42" y="-42" width="84" height="84" fill="white" stroke="black" stroke-width="8"/>\n'
                   '  <circle r="36" fill="white" stroke="black" stroke-width="8"/>\n'
                   '  <polygon points="34,0 -18,-30 -18,30" fill="black"/>', 'Насосная станция'),
    'tk.svg': _svg('  <rect x="-42" y="-42" width="84" height="84" fill="white" stroke="black" stroke-width="8"/>\n'
                   '  <circle r="40" fill="white" stroke="black" stroke-width="7"/>\n'
                   '  <polygon points="32,24 32,-24 -32,24 -32,-24" fill="black"/>',
                   'Узел с внутренней схемой: камера, ЦТРП, павильон (picKAM)'),
}

# Размер значка (px) по зуму: с какого зума категория видна и как растёт (шаг ~2 px на уровень,
# без скачков). Источники и насосные видны на обзоре города, камеры/ЦТРП — с района, потребители —
# с квартала, проходные узлы — с улицы. Последнее значение действует и дальше.
NODE_ZOOMS = list(range(11, 20))
NODE_MINZOOM = 9
NODE_SIZES = {
    #     11  12  13  14  15  16  17  18  19+
    'IS': (16, 18, 20, 22, 24, 26, 28, 30, 32),
    'NS': (12, 14, 16, 18, 20, 22, 24, 26, 28),
    'TK': (0, 0, 10, 12, 14, 16, 18, 21, 24),
    'PR': (0, 0, 0, 8, 10, 12, 14, 17, 20),
    'EL': (0, 0, 0, 8, 10, 12, 14, 17, 20),
    'NZ': (0, 0, 0, 8, 10, 12, 14, 17, 20),
    'PO': (0, 0, 0, 8, 10, 12, 14, 17, 20),
    'US': (0, 0, 0, 0, 6, 7, 9, 12, 15),
}
NODE_ICONS = {'IS': 'is', 'NS': 'ns', 'TK': 'tk', 'PR': 'pr', 'EL': 'el', 'NZ': 'nz', 'PO': 'po', 'US': 'us'}
CONSUMERS = ('PR', 'EL', 'NZ', 'PO', 'US')
# Подписи: (коды, с какого зума, до какого, шрифт, жирный, поле, только «подписывать»). Подпись —
# поле label view (название без технических «#…»). Все узлы подписаны с 16, как в Алматы (1:7000);
# узлы с признаком «подписывать» десктопа (nodes.displaySign → podp) — раньше. С TEXT_ZOOM под
# названием — выбранные в «Подписях» значения (поле text) у узлов всех видов. Веб уменьшает шрифт
# стилей на 20% (services/mapService.ts), на экране 15 → 12 px, 13 → 10,4 px.
TEXT_ZOOM = 17
NODE_LABELS = [
    (('IS',), 12, TEXT_ZOOM, 15, True, 'label', False),
    (('IS',), TEXT_ZOOM, None, 15, True, 'label+text', False),
    (('NS',), 14, TEXT_ZOOM, 14, True, 'label', False),
    (('NS',), TEXT_ZOOM, None, 14, True, 'label+text', False),
    (('TK',), 14, TEXT_ZOOM, 13, False, 'label', False),
    (('TK',), TEXT_ZOOM, None, 13, False, 'label+text', False),
    (CONSUMERS, 14, 16, 12, False, 'label', True),
    (CONSUMERS, 16, TEXT_ZOOM, 12, False, 'label', False),
    (CONSUMERS, TEXT_ZOOM, None, 13, False, 'label+text', False),
]
SCALE_AT_ZOOM_ZERO = 559082264.0287178  # как в utils/sldToMapLibre.ts: правила SLD → minzoom/maxzoom


def _scale(zoom: float) -> str:
    return f'{SCALE_AT_ZOOM_ZERO / 2 ** zoom:.2f}'


def _scale_range(zmin: float, zmax: float | None) -> str:
    out = f'<se:MaxScaleDenominator>{_scale(zmin)}</se:MaxScaleDenominator>'
    if zmax is not None:
        out = f'<se:MinScaleDenominator>{_scale(zmax)}</se:MinScaleDenominator>' + out
    return out


def _eq(field: str, value: str | int) -> str:
    return (f'<ogc:PropertyIsEqualTo><ogc:PropertyName>{field}</ogc:PropertyName>'
            f'<ogc:Literal>{value}</ogc:Literal></ogc:PropertyIsEqualTo>')


def _code_filter(codes: tuple[str, ...], podp: bool = False) -> str:
    eqs = ''.join(_eq('code', c) for c in codes)
    cond = eqs if len(codes) == 1 else f'<ogc:Or>{eqs}</ogc:Or>'
    if podp:
        cond = f'<ogc:And>{cond}{_eq("podp", 1)}</ogc:And>'
    return f'<ogc:Filter>{cond}</ogc:Filter>'


NEWLINE_LITERAL = '<ogc:Literal><![CDATA[\n]]></ogc:Literal>'


def build_uzel_sld() -> str:
    rules: list[str] = []
    for code, sizes in NODE_SIZES.items():
        # соседние зумы с одинаковым размером — одно правило
        spans: list[list] = []
        for zoom, size in zip(NODE_ZOOMS, sizes):
            if spans and spans[-1][2] == size:
                spans[-1][1] = zoom + 1
            else:
                spans.append([zoom, zoom + 1, size])
        spans[-1][1] = None
        if spans[0][2]:
            spans[0][0] = NODE_MINZOOM  # видна с обзора города — и при отдалении
        for zmin, zmax, size in spans:
            if not size:
                continue
            rules.append(
                f'<se:Rule><se:Name>{code} {zmin}</se:Name>{_code_filter((code,))}{_scale_range(zmin, zmax)}'
                '<se:PointSymbolizer uom="http://www.opengeospatial.org/se/units/pixel"><se:Graphic>'
                f'<se:ExternalGraphic><se:OnlineResource xlink:type="simple" xlink:href="svg/{NODE_ICONS[code]}.svg"/>'
                f'<se:Format>image/svg+xml</se:Format></se:ExternalGraphic><se:Size>{size}</se:Size>'
                '</se:Graphic></se:PointSymbolizer></se:Rule>')
    for codes, zmin, zmax, font, bold, field, podp in NODE_LABELS:
        size = max(NODE_SIZES[c][min(zmin, 19) - 11] for c in codes) or 10
        if field == 'label':
            label = '<ogc:PropertyName>label</ogc:PropertyName>'
        else:
            label = ('<ogc:Function name="Concatenate"><ogc:PropertyName>label</ogc:PropertyName>'
                     f'{NEWLINE_LITERAL}<ogc:PropertyName>text</ogc:PropertyName></ogc:Function>')
        weight = '<se:SvgParameter name="font-weight">bold</se:SvgParameter>' if bold else ''
        title = f'Подпись {",".join(codes)} {zmin}' + (' (подписывать)' if podp else '')
        rules.append(
            f'<se:Rule><se:Name>{title}</se:Name>{_code_filter(codes, podp)}{_scale_range(zmin, zmax)}'
            f'<se:TextSymbolizer uom="http://www.opengeospatial.org/se/units/pixel"><se:Label>{label}</se:Label>'
            f'<se:Font><se:SvgParameter name="font-family">Arial, sans-serif</se:SvgParameter>'
            f'<se:SvgParameter name="font-size">{font}</se:SvgParameter>{weight}</se:Font>'
            '<se:LabelPlacement><se:PointPlacement><se:AnchorPoint><se:AnchorPointX>0.5</se:AnchorPointX>'
            '<se:AnchorPointY>1.0</se:AnchorPointY></se:AnchorPoint><se:Displacement>'
            f'<se:DisplacementX>0</se:DisplacementX><se:DisplacementY>-{size // 2 + 3}</se:DisplacementY>'
            '</se:Displacement></se:PointPlacement></se:LabelPlacement>'
            '<se:Halo><se:Radius>2</se:Radius><se:Fill><se:SvgParameter name="fill">#ffffff</se:SvgParameter>'
            '</se:Fill></se:Halo>'
            '<se:Fill><se:SvgParameter name="fill">#000000</se:SvgParameter></se:Fill>'
            '<se:VendorOption name="partials">true</se:VendorOption>'
            '<se:VendorOption name="spaceAround">10</se:VendorOption>'
            '<se:VendorOption name="conflictResolution">true</se:VendorOption>'
            '</se:TextSymbolizer></se:Rule>')
    body = '\n'.join(rules)
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<!-- Сгенерирован scripts/geoserver/gid_desktop_style.py: размеры значков и подписи по зуму -->\n'
            '<StyledLayerDescriptor xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc"'
            ' xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:se="http://www.opengis.net/se"'
            ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="1.1.0"'
            ' xsi:schemaLocation="http://www.opengis.net/sld'
            ' http://schemas.opengis.net/sld/1.1.0/StyledLayerDescriptor.xsd">\n'
            '<NamedLayer><se:Name>uzel</se:Name><UserStyle><se:Name>uzel</se:Name><se:FeatureTypeStyle>\n'
            f'{body}\n'
            '</se:FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>\n')


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
# Поля подписи: label — название без технических имён «#…» (в Астане так названа половина проходных
# узлов, импорт ArcGIS); podp — признак «подписывать» десктопа (gidr_draw.cpp drawNode: node.isPodp).
# «%» в SQL-view GeoServer — параметры, поэтому left(…, 1), а не like '#%'.
NODE_LABEL_EDIT = (
    "n.externalnodename as name,",
    "n.externalnodename as name,\n"
    "-- gid_desktop_style.py: подпись на карте\n"
    "case when left(n.externalnodename, 1) = '#' then '' else n.externalnodename end as label,\n"
    "coalesce(n.displaysign, 0) as podp,",
)


def patch_uzel(gs: Gs, ws: str, store: str, layer: str = 'uzel') -> list[str]:
    done = []
    path = f'/rest/workspaces/{ws}/datastores/{store}/featuretypes/{layer}.xml'
    ft = gs.get_xml(path)
    sql_el = ft.find('.//virtualTable/sql')
    sql = sql_el.text or ''
    edits = []
    if "then 'TK'" not in sql:
        edits += NODE_SQL_EDITS
        done.append('view: code TK')
    if ' as label,' not in sql:
        edits.append(NODE_LABEL_EDIT)
        done.append('view: label, podp')
    if edits:
        for old, new in edits:
            if sql.count(old) != 1:
                sys.exit(f'{ws}:{layer}: не найдено место правки ({old!r})')
            sql = sql.replace(old, new)
        sql_el.text = sql
        put_featuretype(gs, path, ft)

    for name, svg in NODE_SVGS.items():
        gs.req('PUT', f'/rest/resource/workspaces/{ws}/styles/svg/{name}', data=svg.encode('utf-8'),
               headers={'Content-Type': 'image/svg+xml'})
    done.append(f'значки: {len(NODE_SVGS)}')

    style = bare(gs.get_xml(f'/rest/layers/{ws}:{layer}.xml').findtext('defaultStyle/name'))
    sld = build_uzel_sld()
    gs.req('PUT', f'/rest/workspaces/{ws}/styles/{style}', params={'raw': 'true'},
           data=sld.encode('utf-8'), headers={'Content-Type': 'application/vnd.ogc.se+xml'})
    done.append(f'стиль {style}: {sld.count("<se:Rule>")} правил')
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
    put_featuretype(gs, path, ft)
    return True


# Подсветка участков ПТС (жёлтая подложка, слой «Выделенные (warning=1)») — как «Перейти к участку»
# в доке ПТС десктопа (docks/DockPTS.cpp → CGraph2::vydMS/vydRS, isPjezo). Параметры view:
# nach — начальник участка (все его участки МС и РС), ms / rs — один участок; 0 — без подсветки.
# Раньше warning = начальник nach через join «ue.id = ms… or ue.id = rs…», который дублировал трубы
# с участками МС и РС разных участков эксплуатации.
HIGHLIGHT_SQL_EDITS = [
    ('ue.nachalnik_uchastka = %nach%  as warning,',
     f'{MARKER}: подсветка участков ПТС — начальник участка (nach), участок МС (ms) или РС (rs)\n'
     'case when (%nach% > 0 and %nach% in (uem.nachalnik_uchastka, uer.nachalnik_uchastka))\n'
     '       or (%ms% > 0 and hps.magistralSite = %ms%)\n'
     '       or (%rs% > 0 and hps.distSite = %rs%) then 1 else 0 end as warning,'),
    ('left join uchastki_ekspluatatsii ue on (ue.id=ms.nomer_uchastka or ue.id=rs.nomer_uchastka)',
     'left join uchastki_ekspluatatsii uem on uem.id=ms.nomer_uchastka\n'
     'left join uchastki_ekspluatatsii uer on uer.id=rs.nomer_uchastka'),
]
HIGHLIGHT_PARAMS = ('ms', 'rs')


def patch_highlight(gs: Gs, ws: str, store: str, layer: str) -> bool:
    path = f'/rest/workspaces/{ws}/datastores/{store}/featuretypes/{layer}.xml'
    ft = gs.get_xml(path)
    vt = ft.find('.//virtualTable')
    sql_el = vt.find('sql')
    sql = sql_el.text or ''
    if 'подсветка участков ПТС' in sql:
        return False
    for old, new in HIGHLIGHT_SQL_EDITS:
        if sql.count(old) != 1:
            sys.exit(f'{ws}:{layer}: не найдено место правки ({old!r})')
        sql = sql.replace(old, new)
    sql_el.text = sql
    have = {p.findtext('name') for p in vt.findall('parameter')}
    for name in HIGHLIGHT_PARAMS:
        if name not in have:
            p = ET.SubElement(vt, 'parameter')
            ET.SubElement(p, 'name').text = name
            ET.SubElement(p, 'defaultValue').text = '0'
            ET.SubElement(p, 'regexpValidator').text = '^[0-9]+$'
    put_featuretype(gs, path, ft)
    return True


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--geoserver', default=os.environ.get('GEOSERVER_REST_URL', 'http://127.0.0.1:8085/geoserver'))
    ap.add_argument('--workspace', required=True)
    ap.add_argument('--layer', default='heatpipesections')
    ap.add_argument('--restore-style', help='Вернуть стиль по умолчанию (откат) и выйти')
    ap.add_argument('--view-only', action='store_true', help='Только поля и подсветка в SQL-view, стили не трогать')
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
    print(f'{ws}:{layer}: подсветка nach/ms/rs', 'добавлена' if patch_highlight(gs, ws, store, layer) else 'уже есть')
    if args.view_only:
        return

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
