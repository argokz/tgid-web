"""Не показывать на карте объекты удалённых фрагментов.

Десктоп при удалении фрагмента убирает запись из fragments, а узлы и участки фрагмента остаются
в базе с nodes.fileid удалённого фрагмента (Шатура 16.10: 26 удалённых загрузок одной и той же сети —
460 тыс. узлов поверх оставшегося фрагмента; Алматы — копии фрагментов 86, 89–97). Десктоп такие
объекты не показывает (грузит сеть по фрагментам), а SQL-view GeoServer брали все узлы.

Скрипт дописывает в SQL-view слоёв uzel и heatpipesections (участок — по фрагменту узла 1) и в поиск
find_node условие «фрагмент существует». Узлы без фрагмента (fileid NULL) остаются как были.

    set GEOSERVER_REST_USER / GEOSERVER_REST_PASSWORD
    python scripts/geoserver/hide_deleted_fragments.py --workspace ShaturaGIS --backup-dir H:/tgid-backups/x
    python scripts/geoserver/hide_deleted_fragments.py --workspace ShaturaGIS --restore H:/tgid-backups/x

Повторный запуск ничего не меняет. До первой записи проверяются места правки во всех слоях.
После правки нужно сбросить кеш тайлов GWC (--truncate) и nginx.
"""
from __future__ import annotations

import argparse
import os
import sys
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(__file__))
from clone_city_workspace import Gs  # noqa: E402
from gid_desktop_style import ft_path, put_featuretype  # noqa: E402

MARK = '-- hide_deleted_fragments.py: объекты удалённых фрагментов не показывать'
LIVE = '(fileid is null or fileid in (select id from fragments))'
OUTER = "where (CASE WHEN '%fragments%' = '' THEN true"
FIND = "ELSE n.fileid = ANY(string_to_array('%fragments%', '_')::int[]) END)"
EDITS = {
    'uzel': (OUTER, f'{MARK}\nwhere {LIVE}\nand (CASE WHEN \'%fragments%\' = \'\' THEN true'),
    'heatpipesections': (OUTER, f'{MARK}\nwhere {LIVE}\nand (CASE WHEN \'%fragments%\' = \'\' THEN true'),
    'find_node': (FIND, f'{FIND}\n{MARK}\nAND {LIVE.replace("fileid", "n.fileid")}'),
}
CACHED = ('uzel', 'heatpipesections')


def view_sql(ft: ET.Element) -> ET.Element:
    el = ft.find('.//virtualTable/sql')
    if el is None:
        raise RuntimeError('слой не SQL-view')
    return el


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--geoserver', default=os.environ.get('GEOSERVER_REST_URL', 'http://127.0.0.1:8085/geoserver'))
    ap.add_argument('--workspace', required=True)
    ap.add_argument('--backup-dir', help='сохранить featuretype слоёв перед правкой (каталог)')
    ap.add_argument('--restore', metavar='DIR', help='вернуть featuretype из бэкапа и выйти')
    ap.add_argument('--check', action='store_true', help='только проверить места правки')
    ap.add_argument('--truncate', action='store_true', help='сбросить кеш GWC слоёв uzel и heatpipesections')
    args = ap.parse_args()

    gs = Gs(args.geoserver, os.environ.get('GEOSERVER_REST_USER', 'admin'), os.environ['GEOSERVER_REST_PASSWORD'])
    ws = args.workspace

    if args.restore:
        for layer in EDITS:
            src = os.path.join(args.restore, ws, f'{layer}.xml')
            with open(src, 'rb') as f:
                gs.req('PUT', ft_path(gs, ws, layer), data=f.read(), headers={'Content-Type': 'application/xml'})
            print(f'{ws}:{layer}: возвращён из {src}')
        return

    fts, todo, missing = {}, [], []
    for layer, (old, _) in EDITS.items():
        path = ft_path(gs, ws, layer)
        ft = gs.get_xml(path)
        sql = view_sql(ft).text or ''
        fts[layer] = (path, ft)
        if MARK in sql:
            continue
        if sql.count(old) != 1:
            missing.append(f'{ws}:{layer}: {old!r} (найдено {sql.count(old)})')
        todo.append(layer)
    if missing:
        sys.exit('View разошлись с ожидаемыми, ничего не изменено:\n  ' + '\n  '.join(missing))
    print(f'{ws}: править', ', '.join(todo) if todo else 'нечего — уже настроено')
    if args.check:
        return

    if args.backup_dir and todo:
        folder = os.path.join(args.backup_dir, ws)
        os.makedirs(folder, exist_ok=True)
        for layer in EDITS:
            with open(os.path.join(folder, f'{layer}.xml'), 'wb') as f:
                f.write(gs.req('GET', fts[layer][0]).content)
        print(f'{ws}: бэкап в {folder}')

    for layer in todo:
        path, ft = fts[layer]
        old, new = EDITS[layer]
        el = view_sql(ft)
        el.text = el.text.replace(old, new)
        put_featuretype(gs, path, ft)
        print(f'{ws}:{layer}: объекты удалённых фрагментов скрыты')

    if args.truncate:
        for layer in CACHED:
            body = f'<truncateLayer><layerName>{ws}:{layer}</layerName></truncateLayer>'
            gs.req('POST', '/gwc/rest/masstruncate', data=body.encode('utf-8'), headers={'Content-Type': 'text/xml'})
        print(f'{ws}: кеш GWC сброшен ({", ".join(CACHED)})')


if __name__ == '__main__':
    main()
