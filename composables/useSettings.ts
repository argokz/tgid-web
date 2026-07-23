/**
 * Composable для управления настройками приложения
 * Обертка над settingsStore для обратной совместимости
 */

import { useSettingsStore } from '~/stores/settingsStore'
import type { WorkspaceConfig, WmsLayerConfig, AppSettings } from '~/types'

export const useSettings = () => {
  const store = useSettingsStore()
  
  // Инициализация при первом вызове, если еще не инициализировано
  if (store.workspaces.length === 0) {
    store.initSettings()
  }

  return {
    /** @deprecated Используйте store напрямую */
    loadSettings: (): AppSettings => ({ ...store.$state }),
    
    /** @deprecated Используйте store напрямую */
    saveSettings: (settings: AppSettings): void => {
      store.$patch(settings)
      store.saveSettings()
    },
    
    getWorkspaces: (): WorkspaceConfig[] => store.getWorkspaces,
    
    getWorkspace: (id: string): WorkspaceConfig | undefined => 
      store.workspaces.find(ws => ws.id === id),
    
    saveWorkspace: (workspace: WorkspaceConfig): void => store.saveWorkspace(workspace),
    
    deleteWorkspace: (id: string): void => store.deleteWorkspace(id),
    
    getWmsLayers: (): WmsLayerConfig[] => store.getWmsLayers,
    
    getWmsLayer: (id: string): WmsLayerConfig | undefined => 
      store.wmsLayers.find(l => l.id === id),
    
    saveWmsLayer: (layer: WmsLayerConfig): void => store.saveWmsLayer(layer),
    
    deleteWmsLayer: (id: string): void => store.deleteWmsLayer(id),
    
    resetSettings: (): void => store.resetSettings(),
    
    exportSettings: (): string => JSON.stringify(store.$state, null, 2),
    
    importSettings: (json: string): void => {
      try {
        const imported = JSON.parse(json)
        store.$patch(imported)
        store.saveSettings()
      } catch (e) {
        console.error('Error importing settings:', e)
        throw e
      }
    },
    
    getDefaultSettings: (): AppSettings => {
      const runtimeConfig = useRuntimeConfig()
      const geoserver = (runtimeConfig.public as any).geoserver || {}
      const defaultUrl = geoserver.url || 'https://itwin.kz/geoserver'
      const workspaces = store.getDefaultWorkspaces(geoserver, defaultUrl)
      
      return {
        geoserverUrl: defaultUrl,
        workspaces,
        wmsLayers: [],
        defaultWorkspace: workspaces[0]?.id || 'workspace',
        lastUpdated: new Date().toISOString()
      }
    }
  }
}
