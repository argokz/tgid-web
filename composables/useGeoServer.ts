import type { WorkspaceConfig } from '~/types'
import { useSettings } from './useSettings'

export interface GeoServerFragment {
  id: string
  name: string
}

export interface FeatureProperties {
  [key: string]: any
}

const featureByIdInFlight = new Map<string, Promise<any>>();
const featureByIdCache = new Map<string, { expiresAt: number; value: any }>();
const FEATURE_BY_ID_TTL_MS = 15000;

export const useGeoServer = () => {
  const runtimeConfig = useRuntimeConfig() as any
  const settings = useSettings()
  const { getWorkspaces, getWorkspace } = settings
  
  // Получаем первый активный workspace или используем значения по умолчанию
  const getActiveWorkspace = () => {
    const workspaces = getWorkspaces()
    if (workspaces.length > 0) {
      const ws = workspaces[0]
      return {
        url: ws.url,
        workspace: ws.workspace,
        groupName: ws.groupName
      }
    }
    
    // Fallback на значения из runtimeConfig
    const geoserver = runtimeConfig.public?.geoserver || {}
    return {
      url: geoserver.url || 'https://itwin.kz/geoserver',
      workspace: geoserver.workspace || 'AlmatyGIS',
      groupName: geoserver.groupName || 'AlmatyGIS'
    }
  }

  const config = getActiveWorkspace()

  // Получить конфигурацию для конкретного workspace
  const getWorkspaceConfig = (workspaceId?: string) => {
    if (workspaceId) {
      const ws = getWorkspace(workspaceId) || getWorkspaces().find((candidate) =>
        candidate.workspace === workspaceId
        || candidate.groupName === workspaceId
        || candidate.name === workspaceId
      )
      if (ws) {
        return {
          url: ws.url,
          workspace: ws.workspace,
          groupName: ws.groupName
        }
      }
    }
    return getActiveWorkspace()
  }

  const loadFragments = async (workspaceId?: string): Promise<GeoServerFragment[]> => {
    // ВАЖНО: Только на клиенте, не на сервере
    if (typeof window === 'undefined') return []
    
    const wsConfig = getWorkspaceConfig(workspaceId)
    const wfsUrl = `${wsConfig.url}/${wsConfig.workspace}/ows`
      + '?service=WFS&version=1.1.0&request=GetFeature'
      + `&typeName=${wsConfig.workspace}:fragments`
      + '&outputFormat=application/json'

    console.log('📡 Загрузка фрагментов из:', wfsUrl)

    try {
      const response = await fetch(wfsUrl)
      
      console.log('📊 Ответ сервера:', {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type')
      })

      if (!response.ok) {
        const text = await response.text()
        console.error('❌ Ошибка HTTP:', response.status, text.substring(0, 500))
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const contentType = response.headers.get('content-type')
      if (!contentType?.includes('json')) {
        const text = await response.text()
        console.error('❌ Ожидался JSON, получен:', contentType, text.substring(0, 500))
        throw new Error(`Неверный тип ответа: ${contentType}`)
      }

      const data = await response.json()

      if (!data.features || !Array.isArray(data.features)) {
        console.error('❌ Неверная структура данных:', data)
        throw new Error('Ответ не содержит массив features')
      }

      console.log(`✅ Загружено фрагментов: ${data.features.length}`)

      const fragments: GeoServerFragment[] = data.features.map((f: any) => ({
        id: String(f.properties.id),
        name: f.properties.name || `Фрагмент ${f.properties.id}`
      }))

      console.log('📋 Список фрагментов:', fragments)

      return fragments
    } catch (err: any) {
      console.error('❌ Ошибка загрузки фрагментов:', err)
      const wsConfig = getWorkspaceConfig(workspaceId)
      console.error('🔧 Проверьте:')
      console.error('  1. GeoServer запущен на:', wsConfig.url)
      console.error('  2. Workspace существует:', wsConfig.workspace)
      console.error('  3. Слой "fragments" существует')
      console.error('  4. CORS настроен правильно')
      return []
    }
  }

  const getFeatureInfo = async (
    bbox: number[],
    width: number,
    height: number,
    x: number,
    y: number,
    fragments: string[],
    workspaceId?: string,
    layerNameOverride?: string
  ) => {
    // ВАЖНО: Только на клиенте
    if (typeof window === 'undefined') return null
    
    const wsConfig = getWorkspaceConfig(workspaceId)
    
    // Формируем строку фрагментов как в fr.html
    const fragmentsStr = fragments.join('_')
    console.log('🔍 GetFeatureInfo параметры:', {
      fragments,
      fragmentsStr,
      bbox,
      width,
      height,
      x: Math.floor(x),
      y: Math.floor(y),
      workspace: wsConfig.workspace
    })
    
    const normalizedLayerName = layerNameOverride?.includes(':')
      ? layerNameOverride.split(':')[1]
      : layerNameOverride;
    const layerName = `${wsConfig.workspace}:${normalizedLayerName || wsConfig.groupName}`
    const hasFragments = fragments.length > 0
    const viewparams = hasFragments
      ? `fragments%3A${encodeURIComponent(fragmentsStr)}`
      : ''
    
    const url = `${wsConfig.url}/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo`
      + `&LAYERS=${layerName}`
      + `&QUERY_LAYERS=${layerName}`
      + `&STYLES=`
      + `&BBOX=${bbox.join(',')}`
      + `&WIDTH=${width}`
      + `&HEIGHT=${height}`
      + `&SRS=EPSG:4326`
      + `&FEATURE_COUNT=10`
      + `&X=${Math.floor(x)}`
      + `&Y=${Math.floor(y)}`
      + `&buffer=20`
      + `&INFO_FORMAT=application/json`
      + (hasFragments ? `&viewparams=${viewparams}` : '')

    console.log('📡 GetFeatureInfo URL:', url)
    if (hasFragments) {
      console.log('📋 viewparams:', viewparams)
    }

    try {
      const response = await fetch(url)
      
      console.log('📊 GetFeatureInfo ответ:', {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type')
      })

      if (!response.ok) {
        const text = await response.text()
        console.error('❌ GetFeatureInfo HTTP ошибка:', response.status, text.substring(0, 1000))
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const contentType = response.headers.get('content-type')
      const text = await response.text()
      
      console.log('📄 GetFeatureInfo raw response:', text.substring(0, 500))

      let data
      try {
        data = JSON.parse(text)
      } catch (parseErr) {
        console.error('❌ Ошибка парсинга JSON:', parseErr)
        console.error('📄 Полученный текст:', text.substring(0, 1000))
        return null
      }

      console.log('✅ GetFeatureInfo данные:', data)
      console.log('📊 Найдено features:', data.features?.length || 0)
      
      if (data.features && data.features.length > 0) {
        console.log('📋 Первый feature:', data.features[0])
      }
      
      return data
    } catch (err: any) {
      console.error('❌ Ошибка GetFeatureInfo:', err)
      return null
    }
  }

  const getFeatureById = async (table: string, id: number, workspaceId?: string): Promise<any> => {
    // ВАЖНО: Только на клиенте
    if (typeof window === 'undefined') return null
    
    const wsConfig = getWorkspaceConfig(workspaceId)
    const requestKey = `${wsConfig.workspace}|${table}|${id}`;
    const now = Date.now();

    const cached = featureByIdCache.get(requestKey);
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    const pending = featureByIdInFlight.get(requestKey);
    if (pending) {
      return pending;
    }
    
    console.log('🔍 getFeatureById параметры:', { table, id, workspace: wsConfig.workspace })
    
    // Формируем имя слоя как id_<table>
    const typeName = `${wsConfig.workspace}:id_${table}`
    
    const wfsUrl = `${wsConfig.url}/${wsConfig.workspace}/ows`
      + '?service=WFS&version=1.1.0&request=GetFeature'
      + `&typeName=${typeName}`
      + `&viewparams=id:${id}`
      + '&outputFormat=application/json'

    console.log('📡 WFS GetFeature URL:', wfsUrl)
    console.log('📋 typeName:', typeName)
    console.log('📋 viewparams:', `id:${id}`)

    const request = (async () => {
      try {
        const response = await fetch(wfsUrl)
        
        console.log('📊 WFS GetFeature ответ:', {
          status: response.status,
          statusText: response.statusText,
          contentType: response.headers.get('content-type')
        })
        
        if (!response.ok) {
          const text = await response.text()
          console.error('❌ WFS GetFeature HTTP ошибка:', response.status, text.substring(0, 1000))
          
          // Проверим может быть это XML с ошибкой
          if (text.includes('ServiceException') || text.includes('ExceptionReport')) {
            console.error('❌ GeoServer ServiceException:', text)
          }
          
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const text = await response.text()
        
        console.log('📄 WFS GetFeature raw response:', text.substring(0, 500))

        let data
        try {
          data = JSON.parse(text)
        } catch (parseErr) {
          console.error('❌ Ошибка парсинга JSON:', parseErr)
          console.error('📄 Полученный текст:', text.substring(0, 1000))
          return null
        }

        console.log('✅ WFS GetFeature данные:', data)
        console.log('📊 Тип данных:', data.type)
        console.log('📊 Количество features:', data.features?.length || 0)

        if (data.features && data.features.length > 0) {
          const feature = data.features[0]
          console.log('✅ Объект найден:', {
            id: feature.id,
            properties: Object.keys(feature.properties || {}),
            geometry: feature.geometry?.type
          })
          console.log('📋 Свойства объекта:', feature.properties)

          featureByIdCache.set(requestKey, {
            expiresAt: Date.now() + FEATURE_BY_ID_TTL_MS,
            value: feature
          });

          return feature
        }
        
        console.warn('⚠️ Объект не найден в ответе')
        console.warn('⚠️ Проверьте:', {
          table,
          id,
          expectedTypeName: typeName,
          actualFeatures: data.features?.length || 0
        })
        
        return null
      } catch (err: any) {
        console.error('❌ Ошибка загрузки объекта:', err)
        console.error('📋 Детали:', {
          table,
          id,
          typeName,
          url: wfsUrl
        })
        return null
      } finally {
        featureByIdInFlight.delete(requestKey);
      }
    })();

    featureByIdInFlight.set(requestKey, request);
    return request;
  }

  const getWmsUrl = (viewParams: string, workspaceId?: string) => {
    const wsConfig = getWorkspaceConfig(workspaceId)
    return `${wsConfig.url}/${wsConfig.workspace}/wms?` +
      `service=WMS&version=1.1.1&request=GetMap` +
      `&layers=${wsConfig.workspace}:${wsConfig.groupName}` +
      `&format=image/png&transparent=true` +
      `&viewparams=${viewParams}`
  }

  return {
    config,
    getActiveWorkspace,
    getWorkspaceConfig,
    getWorkspaces,
    loadFragments,
    getFeatureInfo,
    getFeatureById,
    getWmsUrl
  }
}

