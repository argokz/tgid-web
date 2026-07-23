/**
 * Composable для управления базовыми слоями карты
 */
import { ref, computed } from 'vue'

export interface BaseLayer {
  id: string
  name: string
  url: string
  attribution?: string
  icon: string
  maxZoom?: number
}

export const useBaseLayers = () => {
  const config = useRuntimeConfig()
  const mapTilerKey = (config.public as any)?.maptilerKey || 'FAz78OuNlTWu7uIH8zuM'

  const layers: BaseLayer[] = [
    {
      id: 'stadia',
      name: 'MapTiler (OSM Bright)',
      url: `https://api.maptiler.com/maps/streets/{z}/{x}/{y}.png?key=${mapTilerKey}`,
      attribution: '© MapTiler © OpenStreetMap contributors',
      icon: 'mdi-map-outline',
      maxZoom: 22
    },
    {
      id: 'streets-v4',
      name: 'Подробная карта улиц',
      url: `https://api.maptiler.com/maps/streets-v4/256/{z}/{x}/{y}@2x.png?key=${mapTilerKey}`,
      attribution: '© MapTiler © OpenStreetMap contributors',
      icon: 'mdi-map-legend',
      maxZoom: 22
    },
    {
      id: 'planet-v4',
      name: 'MapTiler Planet v4 (0-15)',
      url: `https://api.maptiler.com/tiles/v4/{z}/{x}/{y}.pbf?key=${mapTilerKey}`,
      attribution: '© MapTiler',
      icon: 'mdi-earth',
      maxZoom: 15
    },
    {
      id: 'hybrid-v4',
      name: 'Спутниковая карта',
      url: `https://api.maptiler.com/maps/hybrid-v4/256/{z}/{x}/{y}@2x.jpg?key=${mapTilerKey}`,
      attribution: '© MapTiler',
      icon: 'mdi-satellite-variant',
      maxZoom: 22
    },
    {
      id: 'osm',
      name: 'OpenStreetMap',
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '© OpenStreetMap contributors',
      icon: 'mdi-map',
      maxZoom: 19
    },
    {
      id: '2gis',
      name: '2GIS',
      url: 'http://tile1.maps.2gis.com/tiles?x={x}&y={y}&z={z}',
      attribution: '© 2GIS',
      icon: 'mdi-map-marker-path',
      maxZoom: 18
    },
    {
      id: 'google',
      name: 'Google Maps',
      url: 'http://mt0.google.com/vt/lyrs=p&hl=en&x={x}&y={y}&z={z}',
      attribution: '© Google',
      icon: 'mdi-google-maps',
      maxZoom: 20
    }
  ]

  const currentLayer = ref<string>('stadia')

  const getCurrentLayer = computed(() => {
    return layers.find(l => l.id === currentLayer.value) || layers[0]
  })

  const setLayer = (layerId: string) => {
    if (layers.find(l => l.id === layerId)) {
      currentLayer.value = layerId
      if (typeof window !== 'undefined') {
        localStorage.setItem('baseLayer', layerId)
        localStorage.setItem('selectedBaseLayer', layerId)
      }
    }
  }

  const loadSavedLayer = () => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('selectedBaseLayer') || localStorage.getItem('baseLayer')
      if (saved && layers.find(l => l.id === saved)) {
        currentLayer.value = saved
      }
    }
  }

  return { layers, currentLayer, getCurrentLayer, setLayer, loadSavedLayer }
}
