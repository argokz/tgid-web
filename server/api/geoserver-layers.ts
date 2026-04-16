import { XMLParser } from 'fast-xml-parser';
import type { LayerConfig } from '~/types';
import { determineLayerType, getDefaultPaint, getLayerType } from '~/server/config/layer-types';

const GLOBAL_KEY = '__geoserverLayersPending__';
const pendingRequests: Map<string, Promise<LayerConfig[]>> = (globalThis as any)[GLOBAL_KEY] || new Map();
(globalThis as any)[GLOBAL_KEY] = pendingRequests;

export default defineEventHandler(async (event) => {
  if (import.meta.dev) {
    console.debug(`[API HIT] /api/geoserver-layers:`, event.node.req.url, 'from', event.node.req.headers['referer'] || 'SSR');
  }
  const runtimeConfig = useRuntimeConfig();

  // Вспомогательная функция для ослабления строгой типизации MapLibre GL JS
  // Превращает ["==", "mag", "1"] в ["any", ["==", "mag", "1"], ["==", "mag", 1], ["==", "mag", true]]
  // Это решает проблему несовпадения типов, когда в БД (WFS) приходит boolean/integer, 
  // а GeoServer MBStyle генерирует проверку на строку.
  const sanitizeFilterTypeCoercion = (f: any): any => {
    if (!Array.isArray(f)) return f;
    
    // Обработка операторов сравнения (legacy и expression syntax)
    if (['==', '!='].includes(f[0]) && f.length === 3) {
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
    
    // Рекурсивный обход всех элементов (например, для "all", "any", "none")
    return f.map((k: any) => sanitizeFilterTypeCoercion(k));
  };
  const cacheKey = 'geoServerLayers';
  const cache = useStorage();

  // Разрешённые workspace берём из NUXT_PUBLIC_GEOSERVER_WORKSPACES,
  // чтобы не тянуть демо-слои (sf, topp, tiger, ne, nurc и т.п.)
  const geoserverPublic = (runtimeConfig.public as any)?.geoserver || {};
  const envWorkspaces = Array.isArray(geoserverPublic.workspaces)
    ? geoserverPublic.workspaces
    : [];
  const allowedWorkspaces = envWorkspaces
    .map((ws: any) => ws.workspace || ws.id)
    .filter((v: any) => typeof v === 'string' && v.length > 0);

  // Проверяем кэш на сервере
  const query = getQuery(event);
  const refresh = query.refresh === 'true';
  
  if (!refresh) {
    const cached = await cache.getItem(cacheKey) as LayerConfig[] | null;
    if (cached) return cached;
    const pending = pendingRequests.get(cacheKey);
    if (pending) return await pending;
  }
  const loadLayers = async (): Promise<LayerConfig[]> => {
    const geoserverUrl = runtimeConfig.public?.geoserver?.url || 'https://itwin.kz/geoserver';
    const capabilitiesUrl =
      runtimeConfig.geoserverCapabilitiesUrl ||
      `${geoserverUrl}/gwc/service/wmts?REQUEST=GetCapabilities`;
    
    const mvtTemplateUrl =
      runtimeConfig.geoserverMvtTemplateUrl ||
      `${geoserverUrl}/gwc/service/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&LAYER={layerName}&STYLE=&TILEMATRIXSET=EPSG:900913&TILEMATRIX=EPSG:900913:{z}&TILEROW={y}&TILECOL={x}&FORMAT=application/vnd.mapbox-vector-tile`;
    const response = await $fetch(capabilitiesUrl);
    const xmlText = response as string;
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      parseAttributeValue: true
    });
    const result = parser.parse(xmlText);
    
    // Получаем слои из XML
    const wmtsLayers = result?.Capabilities?.Contents?.Layer || [];
    const layersArray = Array.isArray(wmtsLayers) ? wmtsLayers : [wmtsLayers];

    const processedLayerNames = new Set<string>();
    const layers: LayerConfig[] = [];
    for (const layer of layersArray) {
    // Получаем идентификатор слоя
    const layerName = layer?.['ows:Identifier'] || '';
    if (!layerName || processedLayerNames.has(layerName)) continue;
    processedLayerNames.add(layerName);

     // Фильтруем по workspace: берем только те, что входят в NUXT_PUBLIC_GEOSERVER_WORKSPACES
    const nameParts = String(layerName).split(':');
    const workspaceName = nameParts[0];
    if (allowedWorkspaces.length && !allowedWorkspaces.includes(workspaceName)) {
      continue;
    }

    // Получаем название слоя
    const title = layer?.['ows:Title'] || layerName;
    
    // Получаем границы слоя
    const bounds = layer?.['ows:WGS84BoundingBox'] || {};
    const lowerCorner = bounds?.['ows:LowerCorner'] || '';
    const upperCorner = bounds?.['ows:UpperCorner'] || '';
    
    // Получаем стиль слоя
    const style = layer?.Style || {};
    const styleIdentifier = style?.['ows:Identifier'] || '';
    const styleNameParts = String(styleIdentifier).split(':');
    let cleanStyleName = styleNameParts.length > 1 ? styleNameParts[1] : styleNameParts[0];
    
    // Определяем sourceLayer (обычно это имя слоя в GeoServer)
    const sourceLayer = nameParts.length > 1 ? nameParts[1] : nameParts[0];
    
    // ВРЕМЕННЫЙ ФИЛЬТР ДЛЯ ТЕСТИРОВАНИЯ (по просьбе пользователя)
    const isTestLayer = (workspaceName === 'AlmatyGIS' && (sourceLayer === 'heatpipesections' || sourceLayer === 'uzel'));
    if (!isTestLayer) {
       continue; // Оставляем только два нужных слоя
    }
    
    // Формируем URL для MVT
    const mvtUrl = mvtTemplateUrl.replace('{layerName}', layerName);
    
    // Определяем тип и стили Maplibre
    let type: any;
    let paint: Record<string, any> = {};
    let layout: Record<string, any> = {};
    let mbLayers: any[] = [];
    let hasMapboxStyle = false;
    let sprite: string | undefined = undefined;

    const auth = Buffer.from('admin:geoserver').toString('base64');
    const authHeaders = { 'Authorization': `Basic ${auth}` };

    try {
      // Ищем настоящий стиль слоя, так как WMTS часто отдает 'generic'
      if (!cleanStyleName || cleanStyleName === 'generic') {
        const layerInfoUrl = `${geoserverUrl}/rest/workspaces/${workspaceName}/layers/${sourceLayer}.json`;
        const layerInfo: any = await $fetch(layerInfoUrl, { headers: authHeaders, timeout: 5000 }).catch(() => null);
        if (layerInfo?.layer?.defaultStyle?.name) {
          const rawName = layerInfo.layer.defaultStyle.name;
          cleanStyleName = rawName.includes(':') ? rawName.split(':')[1] : rawName;
        }
      }

      // Явно используем созданный стиль heatpipesections_mvt для слоя heatpipesections
      if (sourceLayer === 'heatpipesections') {
         cleanStyleName = 'heatpipesections_mvt';
      }

      if (cleanStyleName && cleanStyleName !== 'generic') {
        let mbStyle: any = null;
        
        try {
          // 1. Сначала пробуем запросить нативный файл .mbstyle (если пользователь создал именно его)
          const mbUrl = `${geoserverUrl}/rest/workspaces/${workspaceName}/styles/${cleanStyleName}.mbstyle`;
          mbStyle = await $fetch(mbUrl, {
            headers: authHeaders,
            timeout: 1000
          });
        } catch (eNative) {
          // 2. Если нативного .mbstyle нет, просим GeoServer динамически конвертировать SLD -> MBStyle
          const sldUrl = `${geoserverUrl}/rest/workspaces/${workspaceName}/styles/${cleanStyleName}`;
          mbStyle = await $fetch(sldUrl, {
            headers: {
              'Accept': 'application/vnd.mapbox.style+json',
              ...authHeaders
            },
            timeout: 1500
          });
        }

        if (mbStyle && Array.isArray(mbStyle.layers) && mbStyle.layers.length > 0) {
          // Исключаем фоновые слои, так как MVT - это оверлей, а не база
          let rawMbLayers = mbStyle.layers.filter((l: any) => l.type !== 'background');
          
          // Применяем преобразование типов к фильтрам всех слоев
          mbLayers = rawMbLayers.map((l: any) => {
            if (l.filter) {
              l.filter = sanitizeFilterTypeCoercion(l.filter);
            }
            return l;
          });
          
          if (mbLayers.length > 0) {
            hasMapboxStyle = true;
            paint = mbLayers[0].paint || {};
            paint = mbLayers[0].paint || {};
            layout = mbLayers[0].layout || {};
            type = mbLayers[0].type || 'circle';
            console.log(`[GEO-STYLE] Loaded native MBStyle for ${layerName} with ${mbLayers.length} layers.`);
          }
        }
        
        if (mbStyle && mbStyle.sprite) {
          // Resolve relative sprite path
          if (typeof mbStyle.sprite === 'string' && !mbStyle.sprite.startsWith('http')) {
             // For itwin.kz geoserver, sprites are typically here:
             sprite = `${geoserverUrl}/www/sprites/sprite`;
          } else {
            sprite = mbStyle.sprite;
          }
        }
      }
    } catch (e: any) {
      console.warn(`[GEO-STYLE] MBStyle fallback for ${layerName} (style: ${cleanStyleName}): ${e.message}`);
    }

    if (!hasMapboxStyle) {
      const styleName = styleIdentifier.toLowerCase();
      if (styleName.includes('point') || styleName.includes('circle')) {
        type = 'circle';
        paint = getDefaultPaint(type);
      } else if (styleName.includes('line') || styleName.includes('linestring')) {
        type = 'line';
        paint = getDefaultPaint(type);
      } else if (styleName.includes('polygon') || styleName.includes('fill')) {
        type = 'fill';
        paint = getDefaultPaint(type);
      } else {
        const layerConfig = getLayerType(layerName);
        if (layerConfig) {
          type = layerConfig.type;
          paint = layerConfig.paint || getDefaultPaint(type);
        } else {
          type = determineLayerType(layerName, sourceLayer);
          paint = getDefaultPaint(type);
        }
      }
    }
    
    // Очищаем префикс id_ для красоты отображения, если он есть
    const cleanSourceLayer = sourceLayer.startsWith('id_') ? sourceLayer.substring(3) : sourceLayer;
    
    layers.push({ 
      id: `mvt-almaty-${cleanSourceLayer}`,
      label: title, 
      displayName: title,
      sourceId: `mvt-almaty-source-${cleanSourceLayer}`, 
      layerId: `mvt-almaty-${cleanSourceLayer}`, 
      sourceLayer, 
      workspace: workspaceName,
      type, 
      mvtUrl, 
      paint,
      layout,
      mbLayers,
      sprite,
      attributes: [],
      visible: false
    });
    }

    await cache.setItem(cacheKey, layers, { ttl: 3600 }); // Кэш на 1 час
    return layers;
  };

  const pending = loadLayers();
  pendingRequests.set(cacheKey, pending);
  try {
    return await pending;
  } finally {
    pendingRequests.delete(cacheKey);
  }
});