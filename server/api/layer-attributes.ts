import { parseMvtLayerId } from '~/utils/geoserverMvtIds';

const GLOBAL_KEY = '__layerAttributesPending__';
const pendingRequests: Map<string, Promise<any>> = (globalThis as any)[GLOBAL_KEY] || new Map();
(globalThis as any)[GLOBAL_KEY] = pendingRequests;

export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig();
  // Получаем параметры запроса
  const query = getQuery(event);
  const layerId = query.layerId as string;
  
  if (!layerId) {
    throw createError({
      statusCode: 400,
      message: 'Layer ID is required'
    });
  }

  // Проверяем кэш
  const cache = useStorage();
  const cacheKey = `layer-attributes-${layerId}`;
  const cached = await cache.getItem(cacheKey);
  if (cached) {
    return cached;
  }
  const pending = pendingRequests.get(cacheKey);
  if (pending) {
    return await pending;
  }

  const loader = (async () => {
    const geoserverBase =
      String((runtimeConfig.public as any)?.geoserver?.url || 'https://itwin.kz/geoserver').replace(/\/$/, '');
    const fallbackWs =
      String((runtimeConfig.public as any)?.geoserver?.workspace || 'AlmatyGIS');
    const { workspace, sourceLayer } = parseMvtLayerId(layerId, fallbackWs);
    const geoserverUrl = `${geoserverBase}/${encodeURIComponent(workspace)}/ows`;

    const params = new URLSearchParams({
      service: 'WFS',
      version: '1.0.0',
      request: 'DescribeFeatureType',
      typeName: `${workspace}:${sourceLayer}`,
      outputFormat: 'application/json'
    });

    const response = await $fetch(`${geoserverUrl}?${params.toString()}`);

    // Парсим ответ и извлекаем атрибуты
    const attributes = parseAttributes(response);
    
    const result = {
      layerId,
      attributes
    };

    // Сохраняем в кэш на 1 час
    await cache.setItem(cacheKey, result, { ttl: 3600 });
    return result;
  })();

  pendingRequests.set(cacheKey, loader);
  try {
    return await loader;
  } catch (error) {
    console.error('Error fetching layer attributes:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch layer attributes'
    });
  } finally {
    pendingRequests.delete(cacheKey);
  }
});

function parseAttributes(response: any): string[] {
  try {
    // Извлекаем свойства из ответа GeoServer
    const properties = response.featureTypes[0].properties || [];
    
    // Фильтруем и форматируем атрибуты
    return properties
      .map((prop: any) => prop.name)
      .filter((name: string) => !['id', 'fileID', 'fileid', 'fileId'].includes(name));
  } catch (error) {
    console.error('Error parsing attributes:', error);
    return [];
  }
} 