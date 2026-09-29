import { defineStore } from 'pinia'
import { markRaw } from 'vue'
import type { Cesium3DTileset, ImageryLayer, ImageryLayerCollection, TerrainProvider, Viewer } from 'cesium'
import { describeTilesetError, type TilesetStatus } from '~/utils/cesiumTileset'

import { probeWmsOverlay, type Cesium3dBaseImagery, type Cesium3dWmsOverlay } from '~/utils/cesiumImagery'

type CesiumModule = typeof import('cesium')

// Слои Cesium вне реактивного state: подложка 2D и WMS-оверлеи сети
let baseImageryLayer: ImageryLayer | null = null
let baseImageryUrl = ''
let overlayLayers = new Map<string, ImageryLayer>()
let hasNaturalEarth = false
let lastOverlays: Cesium3dWmsOverlay[] = []
let overlayGeneration = 0
// Результат проверки слоя GeoServer (url|layers|cql) — один запрос на слой за сессию
const overlayProbe = new Map<string, Promise<boolean>>()
// Фотореалистичные 3D Tiles (Google через Cesium ion); оверлеи сети в этом режиме драпируются на них
let photoTileset: Cesium3DTileset | null = null
let photoAssetId = 0

const PHOTOREALISTIC_KEY = 'cesiumPhotorealistic'

export type PhotorealisticStatus = 'off' | 'loading' | 'ready' | 'error'

export type SyncedSelection = {
  id: string | number
  layerId?: string
  longitude: number
  latitude: number
  label?: string
} | null

export const useCesiumStore = defineStore('cesium', {
  state: () => ({
    viewer: null as Viewer | null,
    cesium: null as any,
    isInitialized: false,
    viewMode: '2D' as '2D' | '3D',
    /** Shared selection between MapLibre and Cesium (P4). */
    syncedSelection: null as SyncedSelection,
    /** 3D Tiles сети: адрес из runtimeConfig (NUXT_PUBLIC_NETWORK_TILESET_URL), см. docs/deploy-3d.md. */
    networkTilesetUrl: '' as string,
    networkTilesetLoaded: false,
    networkTilesetStatus: 'disabled' as TilesetStatus,
    networkTilesetError: '' as string,
    /** Тайлы, которые не загрузились после успешного tileset.json (частичная деградация). */
    networkTileFailures: 0,
    /** Фотореалистичные здания и рельеф (Cesium ion, по умолчанию Google Photorealistic 3D Tiles) */
    photorealistic: false,
    photorealisticStatus: 'off' as PhotorealisticStatus,
    photorealisticError: '' as string
  }),

  actions: {
    async initializeViewer(container: HTMLElement, ionToken = '', baseImagery?: Cesium3dBaseImagery) {
      if (import.meta.server) {
        throw new Error('Cesium Viewer can only be initialized in the browser')
      }
      if (this.viewer) {
        this.cleanup()
      }

      const Cesium = await import('cesium')
      this.cesium = markRaw(Cesium)

      let terrainProvider: TerrainProvider = new Cesium.EllipsoidTerrainProvider()
      if (ionToken) {
        Cesium.Ion.defaultAccessToken = ionToken
        try {
          terrainProvider = await Cesium.createWorldTerrainAsync()
        } catch (error) {
          console.warn('Cesium World Terrain недоступен, используется эллипсоид:', error)
        }
      }

      let baseLayer: ImageryLayer | false = false
      try {
        const imageryProvider = await Cesium.TileMapServiceImageryProvider.fromUrl(
          Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII')
        )
        baseLayer = new Cesium.ImageryLayer(imageryProvider)
      } catch (error) {
        console.warn('Не удалось загрузить базовую подложку Cesium:', error)
      }

      this.viewer = markRaw(new Cesium.Viewer(container, {
        terrainProvider,
        baseLayer,
        animation: false,
        timeline: false,
        infoBox: false,
        selectionIndicator: false,
        baseLayerPicker: false,
        navigationHelpButton: false,
        geocoder: false,
        homeButton: false,
        fullscreenButton: false,
        sceneModePicker: false,
        requestRenderMode: true,
        maximumRenderTimeChange: Number.POSITIVE_INFINITY
      }))

      this.isInitialized = true
      hasNaturalEarth = baseLayer !== false
      if (baseImagery) {
        this.setBaseImagery(baseImagery)
      }

      if (this.syncedSelection) {
        this.flyToSelection(this.syncedSelection)
      }
      if (this.networkTilesetUrl) {
        await this.loadNetworkTileset(this.networkTilesetUrl)
      } else {
        this.networkTilesetStatus = 'disabled'
      }
    },

    /** Подложка 3D = растр подложки 2D; NaturalEarthII остаётся под ней на случай отказа тайлов */
    setBaseImagery(imagery: Cesium3dBaseImagery) {
      const Cesium = this.cesium as CesiumModule | null
      if (!this.viewer || !Cesium || imagery.url === baseImageryUrl) return
      if (baseImageryLayer) {
        this.viewer.imageryLayers.remove(baseImageryLayer, true)
        baseImageryLayer = null
      }
      const provider = new Cesium.UrlTemplateImageryProvider({
        url: imagery.url,
        maximumLevel: imagery.maximumLevel
      })
      baseImageryLayer = new Cesium.ImageryLayer(provider)
      // Сразу над NaturalEarthII (если он есть), под оверлеями сети
      this.viewer.imageryLayers.add(baseImageryLayer, hasNaturalEarth ? 1 : 0)
      baseImageryUrl = imagery.url
      this.viewer.scene.requestRender()
    },

    /**
     * Слои сети в 3D: WMS GeoServer поверх рельефа; лишние снимаются, новые добавляются сверху.
     * Слои, на которые GeoServer отвечает ошибкой, пропускаются (см. probeWmsOverlay).
     */
    async setNetworkOverlays(overlays: Cesium3dWmsOverlay[]) {
      const Cesium = this.cesium as CesiumModule | null
      lastOverlays = overlays
      if (!this.viewer || !Cesium) return
      const generation = ++overlayGeneration
      const wanted = new Set(overlays.map((o) => o.key))
      for (const [key, layer] of overlayLayers) {
        if (!wanted.has(key)) {
          this.overlayCollection().remove(layer, true)
          overlayLayers.delete(key)
        }
      }
      const usable = await Promise.all(overlays.map((overlay) => {
        const probeKey = `${overlay.url}|${overlay.layers}|${overlay.cqlFilter || ''}`
        let probe = overlayProbe.get(probeKey)
        if (!probe) {
          probe = probeWmsOverlay(overlay)
          overlayProbe.set(probeKey, probe)
        }
        return probe
      }))
      // Пока шла проверка, набор слоёв или режим сменились — применит следующий вызов
      if (generation !== overlayGeneration || !this.viewer) return
      const collection = this.overlayCollection()
      overlays.forEach((overlay, index) => {
        if (!usable[index]) console.warn('3D: слой GeoServer недоступен, пропущен:', overlay.layers)
      })
      for (const overlay of overlays.filter((_, index) => usable[index])) {
        let layer = overlayLayers.get(overlay.key)
        if (!layer) {
          const parameters: Record<string, string> = { format: 'image/png', transparent: 'true' }
          if (overlay.cqlFilter) parameters.CQL_FILTER = overlay.cqlFilter
          const provider = new Cesium.WebMapServiceImageryProvider({
            url: overlay.url,
            layers: overlay.layers,
            parameters,
            tilingScheme: new Cesium.WebMercatorTilingScheme()
          })
          layer = collection.addImageryProvider(provider)
          overlayLayers.set(overlay.key, layer)
        }
        // Порядок как в списке (снизу вверх)
        collection.raiseToTop(layer)
      }
      this.viewer.scene.requestRender()
    },

    /** Куда кладутся оверлеи сети: на глобус или на фотореалистичный tileset (глобус тогда скрыт) */
    overlayCollection(): ImageryLayerCollection {
      return this.photorealistic && photoTileset ? photoTileset.imageryLayers : this.viewer!.imageryLayers
    },

    /** Переносит оверлеи сети в текущую коллекцию (после включения/выключения фотореализма) */
    moveOverlays(from: ImageryLayerCollection) {
      for (const layer of overlayLayers.values()) from.remove(layer, true)
      overlayLayers = new Map()
      void this.setNetworkOverlays(lastOverlays)
    },

    /**
     * Фотореалистичные 3D Tiles из Cesium ion (ассет Google Photorealistic 3D Tiles — 2275207).
     * В этом режиме глобус (рельеф + подложка) скрыт: здания и рельеф уже есть в тайлах.
     */
    async setPhotorealistic(enabled: boolean, assetId = photoAssetId) {
      const Cesium = this.cesium as CesiumModule | null
      if (typeof window !== 'undefined') {
        try { localStorage.setItem(PHOTOREALISTIC_KEY, enabled ? '1' : '0') } catch { /* private mode */ }
      }
      if (assetId) photoAssetId = assetId
      if (!this.viewer || !Cesium) {
        this.photorealistic = enabled
        return
      }
      const before = this.overlayCollection()
      if (!enabled) {
        this.photorealistic = false
        this.photorealisticStatus = 'off'
        if (photoTileset) photoTileset.show = false
        this.viewer.scene.globe.show = true
        this.moveOverlays(before)
        this.viewer.scene.requestRender()
        return
      }
      if (!photoAssetId) return
      this.photorealisticError = ''
      if (!photoTileset) {
        this.photorealisticStatus = 'loading'
        try {
          const tileset = await Cesium.Cesium3DTileset.fromIonAssetId(photoAssetId, {
            // Google требует показывать атрибуцию на экране
            showCreditsOnScreen: true
          })
          if (!this.viewer) return
          photoTileset = markRaw(tileset)
          this.viewer.scene.primitives.add(tileset)
        } catch (error) {
          this.photorealistic = false
          this.photorealisticStatus = 'error'
          this.photorealisticError = describeTilesetError(error)
          console.warn('Фотореалистичные 3D Tiles не загрузились:', error)
          return
        }
      }
      photoTileset.show = true
      this.photorealistic = true
      this.photorealisticStatus = 'ready'
      this.viewer.scene.globe.show = false
      this.moveOverlays(before)
      this.viewer.scene.requestRender()
    },

    loadSavedPhotorealistic(): boolean {
      if (typeof window === 'undefined') return false
      try { return localStorage.getItem(PHOTOREALISTIC_KEY) === '1' } catch { return false }
    },

    setSyncedSelection(selection: SyncedSelection) {
      this.syncedSelection = selection
      if (this.viewMode === '3D' && selection) {
        this.flyToSelection(selection)
      }
    },

    clearSyncedSelection() {
      this.syncedSelection = null
    },

    flyToSelection(selection: NonNullable<SyncedSelection>, height = 400) {
      const Cesium = this.cesium as CesiumModule | null
      if (!this.viewer || !Cesium) return
      this.viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          selection.longitude,
          selection.latitude,
          height
        ),
        duration: 1.2
      })
      this.viewer.scene.requestRender()
    },

    /**
     * 3D Tiles сети. Ошибка (нет файла, CORS, не JSON) не ломает 3D-режим: карта остаётся
     * с подложкой/рельефом, статус и причина показываются в CesiumViewer.
     */
    async loadNetworkTileset(url: string) {
      const Cesium = this.cesium as CesiumModule | null
      if (!this.viewer || !Cesium || !url) return
      this.networkTilesetUrl = url
      this.networkTilesetStatus = 'loading'
      this.networkTilesetError = ''
      this.networkTileFailures = 0
      try {
        const tileset = await Cesium.Cesium3DTileset.fromUrl(url)
        if (!this.viewer) return
        tileset.tileFailed.addEventListener((event: { url?: string, message?: string }) => {
          this.networkTileFailures += 1
          if (this.networkTileFailures <= 3) {
            console.warn('3D Tiles сети: тайл не загрузился', event?.url, event?.message)
          }
        })
        this.viewer.scene.primitives.add(tileset)
        this.networkTilesetLoaded = true
        this.networkTilesetStatus = 'ready'
        this.viewer.scene.requestRender()
      } catch (error) {
        this.networkTilesetLoaded = false
        this.networkTilesetStatus = 'error'
        this.networkTilesetError = describeTilesetError(error)
        console.warn('Не удалось загрузить 3D Tiles сети:', url, error)
      }
    },

    toggleViewMode() {
      this.viewMode = this.viewMode === '2D' ? '3D' : '2D'
      if (typeof window !== 'undefined') {
        localStorage.setItem('viewMode', this.viewMode)
      }
    },

    loadSavedViewMode() {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('viewMode')
        if (saved === '2D' || saved === '3D') {
          this.viewMode = saved
        }
      }
    },

    syncCameraFrom2D(center: [number, number], zoom: number, bearing: number, pitch: number) {
      const Cesium = this.cesium as CesiumModule | null
      if (!this.viewer || !Cesium) return

      const altitude =
        156543.03392 *
        Math.cos((center[1] * Math.PI) / 180) *
        Math.pow(2, -zoom) *
        this.viewer.canvas.clientHeight

      this.viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(center[0], center[1], Math.max(altitude, 100)),
        orientation: {
          heading: Cesium.Math.toRadians(bearing),
          pitch: Cesium.Math.toRadians(pitch - 90),
          roll: 0.0
        }
      })
      this.viewer.scene.requestRender()
    },

    getCameraStateFor2D() {
      const Cesium = this.cesium as CesiumModule | null
      if (!this.viewer || !Cesium) return null
      const camera = this.viewer.camera
      const positionCartographic = Cesium.Cartographic.fromCartesian(camera.position)
      const lng = Cesium.Math.toDegrees(positionCartographic.longitude)
      const lat = Cesium.Math.toDegrees(positionCartographic.latitude)

      const altitude = positionCartographic.height
      const zoom = Math.log2(
        (156543.03392 * Math.cos((lat * Math.PI) / 180) * this.viewer.canvas.clientHeight) /
          Math.max(altitude, 1)
      )

      return {
        center: [lng, lat] as [number, number],
        zoom,
        bearing: Cesium.Math.toDegrees(camera.heading),
        pitch: Math.max(0, Cesium.Math.toDegrees(camera.pitch) + 90)
      }
    },

    hibernate(shouldHibernate: boolean) {
      if (!this.viewer) return
      this.viewer.useDefaultRenderLoop = !shouldHibernate
      if (!shouldHibernate) this.viewer.scene.requestRender()
    },

    cleanup() {
      if (this.viewer && !this.viewer.isDestroyed()) {
        this.viewer.destroy()
        this.viewer = null
      }
      baseImageryLayer = null
      baseImageryUrl = ''
      overlayLayers = new Map()
      photoTileset = null
      this.photorealisticStatus = 'off'
      this.isInitialized = false
      this.cesium = null
      this.networkTilesetLoaded = false
    }
  }
})
