// https://nuxt.com/docs/api/configuration/nuxt-config
import vuetify from 'vite-plugin-vuetify'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Загружаем переменные окружения явно из .env файла
const env: Record<string, string> = {}
try {
  const envPath = resolve(process.cwd(), '.env')
  const envFile = readFileSync(envPath, 'utf-8')
  envFile.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...values] = trimmed.split('=')
      if (key && values.length > 0) {
        const value = values.join('=').trim()
        env[key.trim()] = value
      }
    }
  })
  console.log('[nuxt.config.ts] Загружены переменные из .env:', Object.keys(env).length)
} catch (e) {
  console.warn('[nuxt.config.ts] Не удалось загрузить .env:', e)
}

export default defineNuxtConfig({
  runtimeConfig: {
    geoserverCapabilitiesUrl:
      process.env.GEOSERVER_CAPABILITIES_URL ||
      env.GEOSERVER_CAPABILITIES_URL ||
      'http://145.249.247.138:8085/geoserver/almaty/gwc/service/wmts?REQUEST=GetCapabilities',
    geoserverMvtTemplateUrl:
      process.env.GEOSERVER_MVT_TEMPLATE_URL ||
      env.GEOSERVER_MVT_TEMPLATE_URL ||
      'https://itwin.kz/geoserver/ows?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS={layerName}&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&SRS=EPSG:3857&FORMAT=application/vnd.mapbox-vector-tile',
    geoserverDescribeFeatureUrl:
      process.env.GEOSERVER_DESCRIBE_FEATURE_URL ||
      env.GEOSERVER_DESCRIBE_FEATURE_URL ||
      'http://145.249.247.138:8085/geoserver/almaty/ows',
    geoserverLayerNamespace:
      process.env.GEOSERVER_LAYER_NAMESPACE ||
      env.GEOSERVER_LAYER_NAMESPACE ||
      'almaty',
    public: {
      externalApiUrl: process.env.EXTERNAL_API_URL || env.EXTERNAL_API_URL || 'http://localhost:8000',
      mapApiBaseUrl:
        process.env.NUXT_PUBLIC_MAP_API_BASE_URL ||
        env.NUXT_PUBLIC_MAP_API_BASE_URL ||
        process.env.EXTERNAL_API_URL ||
        env.EXTERNAL_API_URL ||
        'http://localhost:8000',
      maptilerKey: process.env.NUXT_PUBLIC_MAPTILER_KEY || env.NUXT_PUBLIC_MAPTILER_KEY || '',
      geoserver: {
        url: process.env.NUXT_PUBLIC_GEOSERVER_URL || env.NUXT_PUBLIC_GEOSERVER_URL || 'https://itwin.kz/geoserver',
        workspace: process.env.NUXT_PUBLIC_GEOSERVER_WORKSPACE || env.NUXT_PUBLIC_GEOSERVER_WORKSPACE || 'AlmatyGIS',
        groupName: process.env.NUXT_PUBLIC_GEOSERVER_GROUP_NAME || env.NUXT_PUBLIC_GEOSERVER_GROUP_NAME || 'AlmatyGIS',
        workspaces: (() => {
          const workspacesEnv = env.NUXT_PUBLIC_GEOSERVER_WORKSPACES || process.env.NUXT_PUBLIC_GEOSERVER_WORKSPACES
          if (!workspacesEnv) return undefined
          try {
            let cleaned = workspacesEnv.trim()
            if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
              cleaned = cleaned.slice(1, -1)
            }
            const parsed = JSON.parse(cleaned)
            return Array.isArray(parsed) ? parsed as any : undefined
          } catch (e) {
            return undefined
          }
        })() as any
      }
    }
  },
  pages: true,
  compatibilityDate: '2024-11-01',
  devtools: {
    enabled: false,
    timeline: {
      enabled:false
    }
  },
  modules: ['@pinia/nuxt'],
  app: {
    baseURL: '/itwin-map/',
    head: {
      title: 'ITwin Map - Интерактивная карта',
      htmlAttrs: {
        lang: 'ru'
      },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Геоинформационная система ITwin Map для визуализации и управления пространственными данными.' },
        { name: 'format-detection', content: 'telephone=no' }
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/itwin-map/favicon.ico' },
        { rel: 'dns-prefetch', href: '//itwin.kz' },
        { rel: 'preconnect', href: 'https://itwin.kz', crossorigin: '' },
      ]
    }
  },
  build: {
    transpile: ['vuetify'],
  },
  css: [
    '~/assets/styles/roboto.css',
    'vuetify/styles',
    '~/assets/styles/main.scss',
    '~/assets/styles/popup.scss',
  ],

  nitro: {
    compressPublicAssets: true,
    prerender: {
      failOnError: false
    },
    /**
     * Не отдаём document с Cache-Control: no-store — иначе Chrome чаще блокирует back/forward cache.
     * (Lighthouse «Internal error / Not actionable» часто остаётся из‑за WebGL; см. pagehide в MapViewer.)
     */
    routeRules: {
      '/itwin-map': { headers: { 'Cache-Control': 'private, max-age=0, must-revalidate' } },
      '/itwin-map/**': { headers: { 'Cache-Control': 'private, max-age=0, must-revalidate' } },
    },
  },

  /**
   * Vuetify 3 + vite-plugin-vuetify: стили компонентов резолвятся не как обычный `.css` для `?inline&used`.
   * Nuxt тогда сыплет WARN «Cannot extract styles…» при SSR-сборке — это не баг приложения.
   * Стили по-прежнему подключаются клиентским чанком `vuetify.*.css`.
   */
  features: {
    inlineStyles: false,
  },

  experimental: {
    payloadExtraction: true,
    renderJsonPayloads: true
  },

  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          /**
           * Не инжектить variables в SCSS из node_modules (Vuetify и др.):
           * ломает порядок @use / компиляцию стилей компонентов → «нет» цветов, отступов, шрифтов.
           */
          additionalData(source: string, filename: string) {
            const f = filename.replace(/\\/g, '/')
            if (f.includes('node_modules') || f.includes('plugin-vuetify') || f.includes('/.nuxt/')) {
              return source
            }
            return `@use "~/assets/styles/variables" as *;\n${source}`
          },
        },
      },
    },
    plugins: [
      /**
       * Без `styles: { configFile }` — иначе стили компонентов идут через sass-цепочку и часто
       * выглядят «сломано» (нет размеров/цветов). Дефолт `styles: true` + `css: ['vuetify/styles']` — надёжно.
       */
      vuetify({ autoImport: true }),
    ],
    build: {
      /** Меньше legacy-полифиллов (в т.ч. Math.hypot) в отчётах Lighthouse */
      target: 'es2022',
      /**
       * Rollup ругается на чанки >500kB по умолчанию. У Nuxt + mapStore + тяжёлый entry
       * типично ~2.5–3MB один async-чанк — это ожидаемо, пока maplibre не грузится лениво из стора.
       */
      chunkSizeWarningLimit: 3000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return

            // Карта и обвязка — отдельно от entry
            if (
              id.includes('maplibre-gl') &&
              !id.includes('maplibre-gl-draw') &&
              !id.includes('maplibre-gl-geocoder')
            ) {
              return 'maplibre'
            }
            if (id.includes('@maplibre')) return 'maplibre-misc'
            if (id.includes('maplibre-gl-geocoder') || id.includes('@maplibre/maplibre-gl-geocoder')) {
              return 'maplibre-geocoder'
            }
            if (id.includes('@birkskyum') || id.includes('birkskyum__maplibre-gl-draw')) {
              return 'maplibre-draw'
            }
            if (id.includes('mapbox-gl-draw')) return 'mapbox-draw'

            if (id.includes('vuetify')) return 'vuetify'
            if (id.includes('@mdi')) return 'mdi'

            if (id.includes('fast-xml-parser')) return 'fast-xml-parser'
            if (id.includes('/pinia/') || id.includes('\\pinia\\')) return 'pinia'
          }
        }
      }
    }
  }
})