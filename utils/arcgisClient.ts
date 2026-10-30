/**
 * Подключение ArcGIS Pro, ArcGIS Online и QGIS к слоям сети ТГИД (itwin-api: FeatureServer по GeoServices REST,
 * routers/arcgis.py): адрес сервиса, адреса слоев и ключ (только чтение этих адресов).
 */
import { mcpEndpointUrl } from './mcpClient'

export const FEATURE_SERVER_PATH = '/api/arcgis/rest/services/TGID/FeatureServer'

/** Слои сервиса по номеру — как в database/arcgis_features.LAYERS */
export const ARCGIS_LAYERS = ['Участки теплосети', 'Узлы сети', 'Потребители', 'Источники тепла', 'Задвижки'] as const

export interface ArcgisToken {
  token: string
  expires_at: string
  days: number
  service_url: string
}

/** Абсолютный адрес FeatureServer: база API бывает относительной (`/tgid/almaty/map-api` за nginx) */
export function featureServerUrl(apiBase: string, origin: string): string {
  return mcpEndpointUrl(apiBase, origin, FEATURE_SERVER_PATH)
}

/** Адрес с ключом параметром token — так его принимают ArcGIS Pro и ArcGIS Online */
export function withToken(url: string, token: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
}

/** QGIS, способ проверки подлинности «API Header»: заголовок и значение */
export function qgisHeader(token: string): string {
  return `Authorization: Bearer ${token}`
}
