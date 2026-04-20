import { defineStore } from 'pinia';
import type { WorkspaceConfig, WmsLayerConfig, AppSettings } from '~/types';

const STORAGE_KEY = 'tgid-web-settings';

export const useSettingsStore = defineStore('settings', {
  state: (): AppSettings => ({
    geoserverUrl: '',
    workspaces: [],
    wmsLayers: [],
    defaultWorkspace: '',
    lastUpdated: new Date().toISOString()
  }),

  actions: {
    initSettings() {
      const runtimeConfig = useRuntimeConfig();
      const geoserver = (runtimeConfig.public as any).geoserver || {};
      const defaultUrl = geoserver.url || 'https://itwin.kz/geoserver';
      const defaultWorkspaces = this.getDefaultWorkspaces(geoserver, defaultUrl);

      if (process.client) {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            
            // Sync with env if localStorage is missing workspaces
            const workspaces = parsed.workspaces && Array.isArray(parsed.workspaces) && parsed.workspaces.length > 0
              ? parsed.workspaces
              : defaultWorkspaces;

            this.$patch({
              ...parsed,
              geoserverUrl: parsed.geoserverUrl || defaultUrl,
              workspaces: workspaces,
              wmsLayers: parsed.wmsLayers || [],
              defaultWorkspace: parsed.defaultWorkspace || (workspaces[0]?.id || 'workspace'),
              lastUpdated: parsed.lastUpdated || new Date().toISOString()
            });
            return;
          } catch (e) {
            console.error('❌ Error parsing settings:', e);
          }
        }
      }

      // Initial state
      this.$patch({
        geoserverUrl: defaultUrl,
        workspaces: defaultWorkspaces,
        wmsLayers: [],
        defaultWorkspace: defaultWorkspaces[0]?.id || 'workspace',
        lastUpdated: new Date().toISOString()
      });
    },

    getDefaultWorkspaces(geoserver: any, defaultUrl: string): WorkspaceConfig[] {
      const catalog = geoserver.layerCatalog as any[] | undefined;
      if (catalog && Array.isArray(catalog) && catalog.length > 0) {
        return catalog
          .filter((ws: any) => ws.enabled !== false)
          .sort((a: any, b: any) => (a.order ?? 999) - (b.order ?? 999))
          .map((ws: any, index: number) => ({
            id: ws.id || `ws-${String(ws.workspace || '').toLowerCase() || index}`,
            name: ws.name || ws.workspace || 'Workspace',
            url: (ws.url || defaultUrl).replace(/\/$/, ''),
            workspace: ws.workspace,
            groupName: ws.groupName || ws.workspace,
            enabled: ws.enabled !== false,
            order: ws.order !== undefined ? ws.order : index + 1,
            center: ws.center,
            zoom: ws.zoom
          }))
      }

      const w = geoserver.workspace || 'AlmatyGIS';
      return [{
        id: `ws-${String(w).toLowerCase()}`,
        name: w,
        url: defaultUrl,
        workspace: w,
        groupName: geoserver.groupName || w,
        enabled: true,
        order: 1
      }];
    },

    saveSettings() {
      if (process.client) {
        this.lastUpdated = new Date().toISOString();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.$state));
      }
    },

    saveWorkspace(workspace: WorkspaceConfig) {
      const index = this.workspaces.findIndex(ws => ws.id === workspace.id);
      if (index >= 0) {
        this.workspaces[index] = workspace;
      } else {
        const maxOrder = this.workspaces.reduce((max, ws) => Math.max(max, ws.order), 0);
        workspace.order = maxOrder + 1;
        this.workspaces.push(workspace);
      }
      this.saveSettings();
    },

    deleteWorkspace(id: string) {
      this.workspaces = this.workspaces.filter(ws => ws.id !== id);
      this.saveSettings();
    },

    saveWmsLayer(layer: WmsLayerConfig) {
      const index = this.wmsLayers.findIndex(l => l.id === layer.id);
      if (index >= 0) {
        this.wmsLayers[index] = layer;
      } else {
        const maxOrder = this.wmsLayers.reduce((max, l) => Math.max(max, l.order), 0);
        layer.order = maxOrder + 1;
        this.wmsLayers.push(layer);
      }
      this.saveSettings();
    },

    deleteWmsLayer(id: string) {
      this.wmsLayers = this.wmsLayers.filter(l => l.id !== id);
      this.saveSettings();
    },

    resetSettings() {
      if (process.client) {
        localStorage.removeItem(STORAGE_KEY);
        this.initSettings();
      }
    }
  },

  getters: {
    getWorkspaces: (state) => state.workspaces.filter(ws => ws.enabled).sort((a, b) => a.order - b.order),
    getWmsLayers: (state) => state.wmsLayers.filter(l => l.enabled).sort((a, b) => a.order - b.order)
  }
});
