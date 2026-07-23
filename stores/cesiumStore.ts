import { defineStore } from 'pinia'
import { markRaw } from 'vue'
import type { ImageryLayer, TerrainProvider, Viewer } from 'cesium'

type CesiumModule = typeof import('cesium')

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
    /** Placeholder for future 3D Tileset of the network. */
    networkTilesetUrl: '' as string,
    networkTilesetLoaded: false
  }),

  actions: {
    async initializeViewer(container: HTMLElement, ionToken = '') {
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

      if (this.syncedSelection) {
        this.flyToSelection(this.syncedSelection)
      }
      if (this.networkTilesetUrl) {
        await this.loadNetworkTileset(this.networkTilesetUrl)
      }
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
     * P4: load city-scale 3D Tiles for the heat network when a tileset URL is configured.
     */
    async loadNetworkTileset(url: string) {
      const Cesium = this.cesium as CesiumModule | null
      if (!this.viewer || !Cesium || !url) return
      try {
        const tileset = await Cesium.Cesium3DTileset.fromUrl(url)
        this.viewer.scene.primitives.add(tileset)
        this.networkTilesetUrl = url
        this.networkTilesetLoaded = true
        this.viewer.scene.requestRender()
      } catch (error) {
        this.networkTilesetLoaded = false
        console.warn('Не удалось загрузить 3D Tiles сети:', error)
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
      this.isInitialized = false
      this.cesium = null
      this.networkTilesetLoaded = false
    }
  }
})
