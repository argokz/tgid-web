import { createError, getQuery, setHeader } from 'h3'

function resolveGeoserverRestBaseUrl(runtimeConfig: ReturnType<typeof useRuntimeConfig>): string {
  const explicit = String((runtimeConfig as any).geoserverRestUrl || '').trim().replace(/\/$/, '')
  if (explicit) return explicit
  const fallback = String((runtimeConfig.public as any)?.geoserver?.url || '').trim().replace(/\/$/, '')
  if (fallback) return fallback
  throw createError({ statusCode: 503, statusMessage: 'GeoServer URL is not configured' })
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const workspace = String(query.workspace || '').trim()
  const resourcePath = String(query.path || '').trim().replace(/\\/g, '/')
  if (!/^[A-Za-z0-9_.-]+$/.test(workspace)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid workspace' })
  }
  if (!resourcePath.startsWith('styles/') || resourcePath.includes('..') || resourcePath.startsWith('/')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid style resource path' })
  }

  const runtimeConfig = useRuntimeConfig()
  const user = String(process.env.GEOSERVER_REST_USER || (runtimeConfig as any).geoserverRestUser || '').trim()
  const password = String(process.env.GEOSERVER_REST_PASSWORD || (runtimeConfig as any).geoserverRestPassword || '').trim()
  if (!user || !password) {
    throw createError({ statusCode: 503, statusMessage: 'GeoServer REST credentials are not configured' })
  }

  const encodedPath = resourcePath.split('/').map(encodeURIComponent).join('/')
  const url = `${resolveGeoserverRestBaseUrl(runtimeConfig)}/rest/resource/workspaces/${encodeURIComponent(workspace)}/${encodedPath}`
  const response = await $fetch.raw<ArrayBuffer>(url, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`
    },
    responseType: 'arrayBuffer',
    timeout: 7000
  }).catch((error: any) => {
    const statusCode = Number(error?.response?.status || 502)
    throw createError({ statusCode, statusMessage: 'Unable to load GeoServer style resource' })
  })

  setHeader(event, 'Content-Type', response.headers.get('content-type') || 'application/octet-stream')
  setHeader(event, 'Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
  const data = response._data
  if (!data) throw createError({ statusCode: 502, statusMessage: 'GeoServer returned an empty style resource' })
  return new Uint8Array(data)
})
