import { XMLParser } from 'fast-xml-parser';
import type { LayerConfig } from '~/types';
import {
  buildMvtLayerIdentifiers,
  buildWmsOnlyLayerIdentifiers,
  buildWmsRasterSourceId
} from '~/utils/geoserverMvtIds';
import type { GeoCatalogLayerEntry, GeoWorkspaceCatalogEntry } from '~/utils/geoserverLayerCatalog';
import { convertSldToMapLibre } from '~/utils/sldToMapLibre';

/** Тестовый BBOX Web Mercator (Алматы), чтобы подставить вместо {bbox-epsg-3857}. */
const MVT_PROBE_BBOX_3857 = '8500000,5280000,8580000,5360000';

async function verifyMvtTileUrl(urlTemplate: string): Promise<boolean> {
  let url = urlTemplate;
  if (url.includes('{bbox-epsg-3857}')) {
    url = url.replace('{bbox-epsg-3857}', MVT_PROBE_BBOX_3857);
  }
  try {
    const buf = await $fetch<ArrayBuffer>(url, {
      responseType: 'arrayBuffer',
      timeout: 12000,
      headers: { Accept: '*/*' }
    });
    return buf.byteLength > 24;
  } catch {
    return false;
  }
}

const GLOBAL_KEY = '__geoserverLayersPending__';
const pendingRequests: Map<string, Promise<LayerConfig[]>> = (globalThis as any)[GLOBAL_KEY] || new Map();
(globalThis as any)[GLOBAL_KEY] = pendingRequests;

function resolveGeoserverRestBaseUrl(runtimeConfig: ReturnType<typeof useRuntimeConfig>): string {
  const fallback =
    String(runtimeConfig.public?.geoserver?.url || 'https://itwin.kz/geoserver').replace(/\/$/, '');
  const explicit = String((runtimeConfig as any).geoserverRestUrl || '').trim().replace(/\/$/, '');
  if (explicit) return explicit;

  const capUrl = String(runtimeConfig.geoserverCapabilitiesUrl || '');
  if (!capUrl) return fallback;
  try {
    const u = new URL(capUrl);
    const marker = '/geoserver';
    const idx = u.pathname.indexOf(marker);
    if (idx !== -1) {
      const basePath = u.pathname.slice(0, idx + marker.length);
      return `${u.origin}${basePath}`;
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

function geoserverRestAuthHeaders(runtimeConfig: ReturnType<typeof useRuntimeConfig>): Record<string, string> {
  const user = String(process.env.GEOSERVER_REST_USER || (runtimeConfig as any).geoserverRestUser || '').trim();
  const pass = String(process.env.GEOSERVER_REST_PASSWORD || (runtimeConfig as any).geoserverRestPassword || '').trim();
  if (user && pass) {
    return { Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` };
  }
  return {};
}

function pickWmtsStyleIdentifier(styleRaw: unknown): string {
  if (styleRaw == null) return '';
  const styles = Array.isArray(styleRaw) ? styleRaw : [styleRaw];
  const chosen =
    styles.find((s: any) => s?.['@_isDefault'] === true || s?.['@_isDefault'] === 'true') || styles[0];
  const id = (chosen as any)?.['ows:Identifier'] ?? (chosen as any)?.Identifier ?? '';
  return String(id || '');
}

function normalizeCatalogFromRuntime(geoserverPublic: any): GeoWorkspaceCatalogEntry[] | null {
  const raw = geoserverPublic?.layerCatalog;
  if (Array.isArray(raw) && raw.length) return raw as GeoWorkspaceCatalogEntry[];
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as GeoWorkspaceCatalogEntry[]) : null;
    } catch {
      return null;
    }
  }
  return null;
}

export default defineEventHandler(async (event) => {
  if (import.meta.dev) {
    console.debug(`[API HIT] /api/geoserver-layers:`, event.node.req.url, 'from', event.node.req.headers['referer'] || 'SSR');
  }
  const runtimeConfig = useRuntimeConfig();
  const geoserverPublic = (runtimeConfig.public as any)?.geoserver || {};

  const sanitizeFilterTypeCoercion = (f: any): any => {
    if (!Array.isArray(f) || f.length === 0) return f;
    if (['==', '!='].includes(f[0]) && f.length === 3) {
      const left = f[1];
      const right = f[2];
      if (right === null || right === 'null' || right === 'NULL') {
        const propName = typeof left === 'string' ? left : (Array.isArray(left) && left[0] === 'get' ? left[1] : null);
        if (propName) {
          return f[0] === '==' ? ['!', ['has', propName]] : ['has', propName];
        }
      }
      if (left === null || left === 'null' || left === 'NULL') {
        const propName = typeof right === 'string' ? right : (Array.isArray(right) && right[0] === 'get' ? right[1] : null);
        if (propName) {
          return f[0] === '==' ? ['!', ['has', propName]] : ['has', propName];
        }
      }
      const val = f[2];
      if (val === '1' || val === '0') {
        const numVal = parseInt(val, 10);
        const boolVal = val === '1';
        return ['any', [...f], [f[0], f[1], numVal], [f[0], f[1], boolVal]];
      }
      if (val === 1 || val === 0) {
        const strVal = val.toString();
        const boolVal = val === 1;
        return ['any', [...f], [f[0], f[1], strVal], [f[0], f[1], boolVal]];
      }
      if (val === true || val === false) {
        const numVal = val ? 1 : 0;
        const strVal = numVal.toString();
        return ['any', [...f], [f[0], f[1], numVal], [f[0], f[1], strVal]];
      }
    }
    return f.map((k: any) => sanitizeFilterTypeCoercion(k));
  };

  const cacheKey = 'geoServerLayers';
  const cache = useStorage();
  const mvtProbeTiles = Boolean((runtimeConfig as any).geoserverMvtProbeTiles);

  const query = getQuery(event);
  const refresh = query.refresh === 'true';

  if (!refresh) {
    const cached = await cache.getItem(cacheKey) as LayerConfig[] | null;
    if (cached) return cached;
    const pending = pendingRequests.get(cacheKey);
    if (pending) return await pending;
  }

  const loadLayers = async (): Promise<LayerConfig[]> => {
    const catalog = normalizeCatalogFromRuntime(geoserverPublic);
    if (!catalog?.length) {
      console.error('[GEO] Укажите GEOSERVER_LAYER_CATALOG в env (JSON-массив workspace с полем layers).');
      return [];
    }

    const defaultPublicUrl = String(geoserverPublic.url || 'https://itwin.kz/geoserver').replace(/\/$/, '');
    const geoserverRestBaseUrl = resolveGeoserverRestBaseUrl(runtimeConfig);
    const capabilitiesUrl =
      runtimeConfig.geoserverCapabilitiesUrl || `${defaultPublicUrl}/gwc/service/wmts?REQUEST=GetCapabilities`;

    const mvtTemplateUrl =
      runtimeConfig.geoserverMvtTemplateUrl ||
      `${defaultPublicUrl}/gwc/service/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&LAYER={layerName}&STYLE=&TILEMATRIXSET=EPSG:900913&TILEMATRIX=EPSG:900913:{z}&TILEROW={y}&TILECOL={x}&FORMAT=application/vnd.mapbox-vector-tile`;

    // Явная сигнатура вместо типизированного $fetch: динамический URL заставляет TS
    // перебирать все nitro-маршруты и падать с "Excessive stack depth".
    const fetchText = $fetch as unknown as (url: string) => Promise<string>;
    const xmlText = await fetchText(capabilitiesUrl);
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseAttributeValue: true
    });
    const result = parser.parse(xmlText);
    const wmtsLayers = result?.Capabilities?.Contents?.Layer || [];
    const layersArray = Array.isArray(wmtsLayers) ? wmtsLayers : [wmtsLayers];

    const wmtsByQualified = new Map<string, any>();
    for (const layer of layersArray) {
      const id = layer?.['ows:Identifier'];
      if (id) wmtsByQualified.set(String(id), layer);
    }

    const authHeaders = geoserverRestAuthHeaders(runtimeConfig);
    const appBaseUrl = String((runtimeConfig as any).app?.baseURL || '/').replace(/\/$/, '');
    const styleResourceUrl = (workspace: string, resourcePath: string) =>
      `${appBaseUrl}/api/geoserver-style-resource?workspace=${encodeURIComponent(workspace)}&path=${encodeURIComponent(resourcePath)}`;

    async function fetchMvtStylePack(
      workspaceName: string,
      sourceLayer: string,
      layerXml: any,
      sanitize: (x: any) => any
    ): Promise<{
      type: string;
      paint: Record<string, any>;
      layout: Record<string, any>;
      mbLayers: any[];
      sprite?: string;
    } | null> {
      const styleIdentifier = pickWmtsStyleIdentifier(layerXml?.Style);
      const styleNameParts = String(styleIdentifier).split(':');
      let cleanStyleName = styleNameParts.length > 1 ? styleNameParts[1] : styleNameParts[0];

      let type: any = 'circle';
      let paint: Record<string, any> = {};
      let layout: Record<string, any> = {};
      let mbLayers: any[] = [];
      let sprite: string | undefined;

      try {
        const layerInfoUrl = `${geoserverRestBaseUrl}/rest/workspaces/${workspaceName}/layers/${encodeURIComponent(sourceLayer)}.json`;
        const layerInfo: any = await $fetch(layerInfoUrl, { headers: authHeaders, timeout: 5000 }).catch(() => null);
        if (layerInfo?.layer?.defaultStyle?.name) {
          const rawName = layerInfo.layer.defaultStyle.name;
          cleanStyleName = rawName.includes(':') ? rawName.split(':')[1] : rawName;
        }

        if (!cleanStyleName || cleanStyleName === 'generic') return null;

        let mbStyle: any = null;
        try {
          const mbUrl = `${geoserverRestBaseUrl}/rest/workspaces/${workspaceName}/styles/${encodeURIComponent(cleanStyleName)}.mbstyle`;
          mbStyle = await $fetch(mbUrl, { headers: authHeaders, timeout: 5000 });
        } catch {
          const styleUrl = `${geoserverRestBaseUrl}/rest/workspaces/${workspaceName}/styles/${encodeURIComponent(cleanStyleName)}`;
          mbStyle = await $fetch(styleUrl, {
            headers: { Accept: 'application/vnd.mapbox.style+json', ...authHeaders },
            timeout: 5000
          }).catch(() => null);
        }

        if (mbStyle && Array.isArray(mbStyle.layers) && mbStyle.layers.length > 0) {
          const rawMbLayers = mbStyle.layers.filter((l: any) => l.type !== 'background');
          mbLayers = rawMbLayers.map((l: any) => {
            if (l.filter) l.filter = sanitize(l.filter);
            return l;
          });
          if (mbLayers.length > 0) {
            paint = mbLayers[0].paint || {};
            layout = mbLayers[0].layout || {};
            type = mbLayers[0].type || 'circle';
          }
        }

        if (mbStyle?.sprite) {
          sprite =
            typeof mbStyle.sprite === 'string' && !mbStyle.sprite.startsWith('http')
              ? `${geoserverRestBaseUrl}/www/sprites/sprite`
              : mbStyle.sprite;
        }

        if (!mbLayers.length) {
          const sldUrl = `${geoserverRestBaseUrl}/rest/workspaces/${workspaceName}/styles/${encodeURIComponent(cleanStyleName)}.sld`;
          const sldText = await $fetch<string>(sldUrl, {
            headers: { Accept: 'application/vnd.ogc.sld+xml', ...authHeaders },
            responseType: 'text',
            timeout: 7000
          });
          const converted = convertSldToMapLibre(sldText, {
            workspace: workspaceName,
            resourceUrl: styleResourceUrl
          });
          mbLayers = converted.layers.map((layer: any) => {
            if (layer.filter) layer.filter = sanitize(layer.filter);
            return layer;
          });
          if (mbLayers.length > 0) {
            paint = mbLayers[0].paint || {};
            layout = mbLayers[0].layout || {};
            type = mbLayers[0].type || 'circle';
          }
        }

        if (!mbLayers.length) return null;
        return { type, paint, layout, mbLayers, sprite };
      } catch (e: any) {
        console.warn(`[GEO-STYLE] MBStyle ${workspaceName}:${sourceLayer}: ${e.message}`);
        return null;
      }
    }

    function resolveRenderFormat(le: GeoCatalogLayerEntry, hasMvt: boolean): 'mvt' | 'wms' {
      const def = le.defaultRenderFormat;
      if (def === 'mvt' && hasMvt && le.mvt) return 'mvt';
      if (def === 'wms' && le.wms) return 'wms';
      if (hasMvt && le.mvt) return 'mvt';
      return 'wms';
    }

    const out: LayerConfig[] = [];

    for (const wsEntry of catalog) {
      if (wsEntry.enabled === false) continue;
      const baseUrl = (wsEntry.url || defaultPublicUrl).replace(/\/$/, '');
      const workspaceBaseUrl = wsEntry.url ? baseUrl : undefined;

      for (const le of wsEntry.layers) {
        const qualified = `${wsEntry.workspace}:${le.source}`;
        const wmtsXml = wmtsByQualified.get(qualified);
        const titleFallback = wmtsXml?.['ows:Title'] || qualified;
        const label = le.label?.trim() ? le.label : titleFallback;

        let mvtPack: Awaited<ReturnType<typeof fetchMvtStylePack>> = null;
        let mvtUrl = '';

        if (le.mvt && wmtsXml) {
          mvtUrl = mvtTemplateUrl.replace('{layerName}', qualified);
          mvtPack = await fetchMvtStylePack(wsEntry.workspace, le.source, wmtsXml, sanitizeFilterTypeCoercion);
          if (mvtPack && mvtProbeTiles) {
            const ok = await verifyMvtTileUrl(mvtUrl);
            if (!ok) {
              console.warn(`[GEO] MVT probe failed for ${qualified}, откат к WMS если доступен`);
              mvtPack = null;
            }
          }
        }

        const hasMvt = Boolean(mvtPack && mvtPack.mbLayers?.length);
        const canWms = le.wms === true;

        if (!hasMvt && !canWms) {
          console.warn(`[GEO] Пропуск ${qualified}: нет ни MVT (MBStyle), ни WMS в каталоге`);
          continue;
        }

        const cleanSource = le.source.startsWith('id_') ? le.source.substring(3) : le.source;
        const supportedFormats = { mvt: hasMvt && le.mvt === true, wms: canWms };

        if (!hasMvt && canWms) {
          const ids = buildWmsOnlyLayerIdentifiers(wsEntry.workspace, cleanSource);
          const rId = buildWmsRasterSourceId(wsEntry.workspace, cleanSource);
          out.push({
            id: ids.id,
            label,
            displayName: label,
            sourceId: ids.sourceId,
            layerId: ids.layerId,
            sourceLayer: le.source,
            workspace: wsEntry.workspace,
            workspaceBaseUrl,
            type: 'line',
            paint: {},
            mvtUrl: undefined,
            attributes: [],
            visible: false,
            renderFormat: 'wms',
            supportedFormats: { mvt: false, wms: true },
            wmsRasterSourceId: rId
          } as LayerConfig);
          continue;
        }

        const ids = buildMvtLayerIdentifiers(wsEntry.workspace, cleanSource);
        const rf = resolveRenderFormat(le, true);
        if (!mvtPack) continue;

        out.push({
          id: ids.id,
          label,
          displayName: label,
          sourceId: ids.sourceId,
          layerId: ids.layerId,
          sourceLayer: le.source,
          workspace: wsEntry.workspace,
          workspaceBaseUrl,
          type: mvtPack.type,
          mvtUrl,
          paint: mvtPack.paint,
          layout: mvtPack.layout,
          mbLayers: mvtPack.mbLayers,
          sprite: mvtPack.sprite,
          wmsRasterSourceId: buildWmsRasterSourceId(wsEntry.workspace, cleanSource),
          attributes: [],
          visible: false,
          renderFormat: rf,
          supportedFormats
        } as LayerConfig);
      }
    }

    await cache.setItem(cacheKey, out, { ttl: 3600 });
    return out;
  };

  const pending = loadLayers();
  pendingRequests.set(cacheKey, pending);
  try {
    return await pending;
  } finally {
    pendingRequests.delete(cacheKey);
  }
});
