import { appStorage } from '~/utils/appStorage';
import { defineStore } from 'pinia';
import { fastApiService } from '~/services/fastApiService';
import type { Fragment } from '~/types';
import { useLayerStore } from './layerStore';
import { useMapStore } from './mapStore';
import { getCityConfig } from '~/utils/cityConfig';

export const useFragmentStore = defineStore('fragment', {
  state: () => ({
    fragments: [] as Fragment[],
    // При открытии карты — фрагменты города по умолчанию (NUXT_PUBLIC_DEFAULT_FRAGMENTS), иначе все
    visibleFragments: [...getCityConfig().defaultFragments] as number[],
    selectedFragmentId: null as number | null,
  }),

  getters: {
    getFragments: (state) => state.fragments,
    getSelectedFragmentId: (state) => state.selectedFragmentId,
    getVisibleFragments: (state) => state.visibleFragments,
    /**
     * Фрагменты текущей работы: выбранный фрагмент, иначе видимые на карте (фильтр слоёв).
     * Пусто — показаны все фрагменты, контекста нет.
     */
    activeFragmentIds: (state): number[] =>
      (state.selectedFragmentId != null ? [state.selectedFragmentId] : state.visibleFragments)
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0),
  },

  actions: {
    async loadFragments() {
      try {
        // Fetch from GeoServer WFS as requested by user (workspace схемы ТГИД города — utils/cityConfig.ts)
        const { workspace } = getCityConfig();
        const gsUrl = String((useRuntimeConfig().public as any)?.geoserver?.url || 'https://itwin.kz/geoserver').replace(/\/$/, '');
        const url = `${gsUrl}/${workspace}/ows?service=WFS&version=1.1.0&request=GetFeature&typeName=${workspace}:fragments&outputFormat=application/json`;
        const response: any = await $fetch(url);
        
        if (response && response.features) {
          this.fragments = response.features.map((f: any) => ({
            id: f.properties.id || f.id,
            name: f.properties.name || f.properties.fragment_name || `Фрагмент ${f.id}`,
            ...f.properties
          }));
          console.log(`Loaded ${this.fragments.length} fragments from WFS`);
        }
      } catch (error) {
        console.error('Не удалось загрузить фрагменты из WFS:', error);
        // Fallback to local API if WFS fails (optional, but good for robustness)
        try {
          const { data } = await fastApiService.getFragments();
          this.fragments = data;
        } catch (e) {
          console.error('Не удалось загрузить фрагменты из локального API:', e);
        }
      }
    },

    toggleFragment(fragmentId: number) {
      if (this.visibleFragments.includes(fragmentId)) {
        this.visibleFragments = this.visibleFragments.filter(id => id !== fragmentId);
      } else {
        this.visibleFragments.push(fragmentId);
      }
      this.saveVisibleFragments();
      const layerStore = useLayerStore();
      layerStore.applyFragmentFilter();
    },

    /**
     * Разом применить выбор фрагментов (после кнопки «Применить» в UI).
     * zoom=false — карту не двигать (подключение фрагментов подсветки участка: карта идёт к участку).
     */
    applyVisibleFragmentsSelection(ids: number[], zoom = true) {
      const uniq = [...new Set(ids)].sort((a, b) => a - b);
      this.visibleFragments = uniq;
      this.saveVisibleFragments();
      useLayerStore().applyFragmentFilter();
      if (zoom && uniq.length) void this.zoomToFragments(uniq);
    },

    /** Центрировать карту на охвате фрагментов (QA F25); ошибки не мешают выбору */
    async zoomToFragments(ids: number[]) {
      try {
        const { bbox } = await fastApiService.getFragmentsExtent(ids);
        const map = useMapStore().map;
        if (!bbox || !map) return;
        map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 60, maxZoom: 17, duration: 800 });
      } catch (e) {
        console.warn('Не удалось получить охват фрагментов:', e);
      }
    },

    saveVisibleFragments() {
      appStorage.setItem('visibleFragments', JSON.stringify(this.visibleFragments));
    },

    loadVisibleFragments() {
      const saved = appStorage.getItem('visibleFragments');
      this.visibleFragments = saved ? JSON.parse(saved) : [];
      
      // Применяем фильтр через layerStore
      const layerStore = useLayerStore();
      layerStore.applyFragmentFilter();
    }
  }
}); 