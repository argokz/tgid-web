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
      const defaultWorkspaceName = geoserver.workspace || 'AlmatyGIS';
      const defaultGroupName = geoserver.groupName || defaultWorkspaceName;
      
      const defaultWorkspaces = this.getDefaultWorkspaces(geoserver, defaultUrl, defaultWorkspaceName, defaultGroupName);

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

    getDefaultWorkspaces(geoserver: any, defaultUrl: string, defaultWorkspaceName: string, defaultGroupName: string): WorkspaceConfig[] {
      const envWorkspaces = geoserver.workspaces;
      let workspaces: WorkspaceConfig[] = [];

      if (envWorkspaces && Array.isArray(envWorkspaces) && envWorkspaces.length > 0) {
        workspaces = envWorkspaces.map((ws: any, index: number) => ({
          id: ws.id || `ws-${ws.workspace?.toLowerCase() || `workspace-${index}`}`,
          name: ws.name || ws.workspace || 'Workspace',
          url: ws.url || defaultUrl,
          workspace: ws.workspace || defaultWorkspaceName,
          groupName: ws.groupName || ws.workspace || defaultGroupName,
          enabled: ws.enabled !== false,
          order: ws.order !== undefined ? ws.order : index + 1,
          center: ws.center || undefined,
          zoom: ws.zoom || undefined
        }));
      }

      if (workspaces.length === 0) {
        workspaces = [{
          id: `ws-${defaultWorkspaceName.toLowerCase()}`,
          name: defaultWorkspaceName,
          url: defaultUrl,
          workspace: defaultWorkspaceName,
          groupName: defaultGroupName,
          enabled: true,
          order: 1
        }];
      }

      return workspaces;
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
