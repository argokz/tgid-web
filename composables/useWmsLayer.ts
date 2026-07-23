/**
 * Composable для работы с WMS слоями GeoServer
 * Best practices для MapLibre GL
 */

import type { Map } from 'maplibre-gl'
import { useGeoServer } from './useGeoServer'

export interface WmsLayerOptions {
  workspace: string
  layerName: string
  url?: string  // URL GeoServer (опционально, если не указан - берется из активного workspace)
  viewParams?: Record<string, string | string[]>
  opacity?: number
  minZoom?: number
  maxZoom?: number
  cqlFilter?: string // Поддержка GeoServer CQL_FILTER
}

export const useWmsLayer = () => {
  const { config } = useGeoServer()

  /**
   * Создает URL для WMS тайлов
   * ВАЖНО: НЕ используем URLSearchParams т.к. он кодирует {bbox-epsg-3857}
   */
  const createWmsTileUrl = (options: WmsLayerOptions): string => {
    const {
      workspace,
      layerName,
      url: providedUrl,
      viewParams = {},
    } = options
    
    // Получаем базовый URL: из опций или из config
    const baseUrl = providedUrl || config.url

    // GeoServer GetMap: значение VIEWPARAMS — одна строка key:value;key:value (как в MVT).
    // layerStore передаёт уже готовую строку в { viewparams: "fragments:...;NAPOR:on;nach:2;" }.
    const entries = Object.entries(viewParams)
    let viewParamsQueryValue = ''
    if (
      entries.length === 1 &&
      entries[0][0] === 'viewparams' &&
      typeof entries[0][1] === 'string'
    ) {
      viewParamsQueryValue = encodeURIComponent(entries[0][1])
    } else if (entries.length > 0) {
      // Пример: param1:value1;param2:value2_value3 (устаревший формат с несколькими ключами)
      viewParamsQueryValue = entries
        .map(([key, value]) => {
          const val = Array.isArray(value) ? value.join('_') : value
          return `${key}:${encodeURIComponent(String(val))}`
        })
        .join(';')
    }

    // КРИТИЧНО: Строим URL вручную, БЕЗ URLSearchParams
    // URLSearchParams кодирует {} и ломает placeholder {bbox-epsg-3857}
    const queryParams: string[] = [
      'SERVICE=WMS',
      'VERSION=1.1.1',
      'REQUEST=GetMap',
      `LAYERS=${workspace}:${layerName}`,
      'STYLES=',
      'BBOX={bbox-epsg-3857}', // НЕ КОДИРУЕМ этот placeholder!
      'WIDTH=256',
      'HEIGHT=256',
      'SRS=EPSG:3857',
      'FORMAT=image/png',
      'TRANSPARENT=TRUE',
    ]

    if (viewParamsQueryValue) {
      queryParams.push(`VIEWPARAMS=${viewParamsQueryValue}`)
    }

    // Добавляем CQL_FILTER
    if (options.cqlFilter) {
      queryParams.push(`CQL_FILTER=${encodeURIComponent(options.cqlFilter)}`)
    }

    return `${baseUrl}/${workspace}/wms?${queryParams.join('&')}`
  }

  /**
   * Добавляет WMS слой на карту
   */
  const addWmsLayer = (
    map: Map,
    sourceId: string,
    layerId: string,
    options: WmsLayerOptions,
    beforeId?: string // ID слоя, перед которым нужно вставить новый слой
  ) => {
    // Удаляем старый слой если есть
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId)
    }
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId)
    }

    const tileUrl = createWmsTileUrl(options)

    console.log('🗺️ Добавление WMS слоя:', {
      sourceId,
      layerId,
      workspace: options.workspace,
      layer: options.layerName,
      viewParams: options.viewParams,
      beforeId: beforeId || 'none (на верх)',
      tileUrl: tileUrl.replace('{bbox-epsg-3857}', '[BBOX]')
    })

    // Добавляем источник
    map.addSource(sourceId, {
      type: 'raster',
      tiles: [tileUrl],
      tileSize: 256,
      scheme: 'xyz',
      minzoom: options.minZoom ?? 0,
      maxzoom: options.maxZoom ?? 21,
    })

    // Добавляем слой с указанием позиции
    map.addLayer({
      id: layerId,
      type: 'raster',
      source: sourceId,
      paint: {
        'raster-opacity': options.opacity ?? 1,
        'raster-resampling': 'linear', // Лучшее качество
      },
    }, beforeId) // Вставляем перед указанным слоем
  }

  /**
   * Обновляет viewparams существующего слоя
   */
  const updateWmsLayer = (
    map: Map,
    sourceId: string,
    layerId: string,
    options: WmsLayerOptions
  ) => {
    // В MapLibre GL нельзя обновить tiles URL
    // Нужно пересоздать источник
    addWmsLayer(map, sourceId, layerId, options)
  }

  /**
   * Удаляет WMS слой
   */
  const removeWmsLayer = (map: Map, sourceId: string, layerId: string) => {
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId)
    }
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId)
    }
  }

  /**
   * Создает тестовый URL для проверки WMS
   */
  const createTestUrl = (
    map: Map,
    options: WmsLayerOptions
  ): string => {
    const bounds = map.getBounds()
    const sw = bounds.getSouthWest()
    const ne = bounds.getNorthEast()

    // Конвертируем в EPSG:3857
    const [minX, minY] = lonLatToWebMercator(sw.lng, sw.lat)
    const [maxX, maxY] = lonLatToWebMercator(ne.lng, ne.lat)

    const bbox = [
      Math.round(minX),
      Math.round(minY),
      Math.round(maxX),
      Math.round(maxY)
    ].join(',')

    const tileUrl = createWmsTileUrl(options)
    return tileUrl.replace('{bbox-epsg-3857}', bbox)
  }

  return {
    createWmsTileUrl,
    addWmsLayer,
    updateWmsLayer,
    removeWmsLayer,
    createTestUrl,
  }
}

/**
 * Helper: конвертация координат
 */
function lonLatToWebMercator(lon: number, lat: number): [number, number] {
  const x = (lon * 20037508.34) / 180
  const y = (Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180)) * (20037508.34 / 180)
  return [x, y]
}

