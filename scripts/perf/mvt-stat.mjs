/**
 * Разбор тайла MVT GeoServer (кеш GWC): объекты, точки геометрии, атрибуты, размер с gzip.
 * Временный инструмент этапа 11 (docs/map-visual-audit.md).
 *
 *   node scripts/perf/mvt-stat.mjs --layer zdaniya_2 [--workspace AlmatyGIS] [--center 76.93,43.24]
 *        [--zooms 11,13,15,17] [--gs http://localhost:8085/geoserver] [--viewparams 'fragments:74;nach:0;']
 */
import { VectorTile } from '@mapbox/vector-tile';
import Pbf from 'pbf';
import { gzipSync } from 'node:zlib';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  }),
);
const GS = String(args.gs || 'http://localhost:8085/geoserver');
const WS = String(args.workspace || 'AlmatyGIS');
const LAYER = String(args.layer || 'zdaniya_2');
const [LNG, LAT] = String(args.center || '76.93,43.24').split(',').map(Number);
const ZOOMS = String(args.zooms || '11,13,15,17').split(',').map(Number);
const VIEWPARAMS = String(args.viewparams ?? 'fragments:74;nach:0;');

/** Номер тайла XYZ (сетка EPSG:900913 GWC совпадает с XYZ) */
function tileAt(lng, lat, z) {
  const n = 2 ** z;
  const r = (lat * Math.PI) / 180;
  return [Math.floor(((lng + 180) / 360) * n), Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n)];
}

for (const z of ZOOMS) {
  const [x, y] = tileAt(LNG, LAT, z);
  const url = `${GS}/${WS}/gwc/service/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&LAYER=${LAYER}&STYLE=`
    + `&TILEMATRIXSET=EPSG:900913&TILEMATRIX=EPSG:900913:${z}&TILEROW=${y}&TILECOL=${x}`
    + `&FORMAT=application/vnd.mapbox-vector-tile&viewparams=${encodeURIComponent(VIEWPARAMS)}`;
  const t0 = performance.now();
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  const ms = Math.round(performance.now() - t0);
  if (!res.ok) {
    console.log(`${LAYER} z${z}: HTTP ${res.status}`);
    continue;
  }
  const tile = new VectorTile(new Pbf(buf));
  for (const [name, layer] of Object.entries(tile.layers)) {
    let points = 0;
    let propChars = 0;
    for (let i = 0; i < layer.length; i++) {
      const f = layer.feature(i);
      for (const ring of f.loadGeometry()) points += ring.length;
      for (const v of Object.values(f.properties)) propChars += String(v).length;
    }
    console.log(`${name} z${z} ${x}/${y}: ${(buf.length / 1024).toFixed(1)} КиБ (gzip ${(gzipSync(buf).length / 1024).toFixed(1)}), `
      + `${layer.length} объектов, ${points} точек, атрибуты ${(propChars / 1024).toFixed(1)} КиБ текста, `
      + `${ms} мс, GWC ${res.headers.get('geowebcache-cache-result') || '-'}`);
    console.log(`  поля (${layer._keys.length}): ${layer._keys.join(', ')}`);
  }
  if (!Object.keys(tile.layers).length) console.log(`${LAYER} z${z}: пустой тайл (${buf.length} Б)`);
}
