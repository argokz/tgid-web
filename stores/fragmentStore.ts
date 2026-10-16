import { appStorage } from '~/utils/appStorage';
import { defineStore } from 'pinia';
import { fastApiService } from '~/services/fastApiService';
import type { Fragment } from '~/types';
import { useLayerStore } from './layerStore';
import { useMapStore } from './mapStore';
import { getCityConfig } from '~/utils/cityConfig';
import { defaultFragments, keepExistingFragments, parseSavedFragments } from '~/utils/fragmentSelection';

const SAVED_KEY = 'visibleFragments';

/** Сохранённый выбор (только в браузере; на сервере и без localStorage — пусто) */
function savedVisibleFragments(): number[] {
  try {
    return parseSavedFragments(appStorage.getItem(SAVED_KEY));
  } catch {
    return [];
  }
}

export const useFragmentStore = defineStore('fragment', {
  state: () => ({
    fragments: [] as Fragment[],
    // При открытии карты — сохранённый выбор, иначе фрагмент по умолчанию (initVisibleFragments).
    // Состояние приходит с сервера (SSR), где сохранённого выбора нет, — его берёт initVisibleFragments
    visibleFragments: [...getCityConfig().defaultFragments] as number[],
    selectedFragmentId: null as number | null,
    /** Фрагмент по умолчанию (utils/fragmentSelection.ts) — когда ничего не выбрано */
    defaultFragmentIds: [] as number[],
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
     * При открытии карты: сохранённый выбор без удалённых фрагментов; ничего не осталось —
     * фрагмент по умолчанию (города, последнего расчёта, первый). Список фрагментов не загрузился —
     * выбор не трогаем.
     */
    async initVisibleFragments() {
      const saved = savedVisibleFragments();
      if (saved.length && JSON.stringify(saved) !== JSON.stringify(this.visibleFragments)) {
        this.visibleFragments = saved;
        useLayerStore().applyFragmentFilter();
      }
      if (!this.fragments.length) await this.loadFragments();
      const existing = this.fragments.map((f) => Number(f.id)).filter((id) => Number.isInteger(id) && id > 0);
      if (!existing.length) return;
      let calculations: { fileid: number | null; has_results?: boolean }[] = [];
      if (!keepExistingFragments(getCityConfig().defaultFragments, existing).length) {
        try {
          calculations = (await fastApiService.listCalculations({ limit: 50 })).items ?? [];
        } catch (e) {
          console.warn('Не удалось получить расчёты для фрагмента по умолчанию:', e);
        }
      }
      this.defaultFragmentIds = defaultFragments(existing, getCityConfig().defaultFragments, calculations);
      const kept = keepExistingFragments(this.visibleFragments, existing);
      const next = kept.length ? kept : [...this.defaultFragmentIds];
      const changed = JSON.stringify(next) !== JSON.stringify([...this.visibleFragments].sort((a, b) => a - b));
      this.visibleFragments = next;
      this.saveVisibleFragments();
      if (changed) useLayerStore().applyFragmentFilter();
    },

    /**
     * Разом применить выбор фрагментов (после кнопки «Применить» в UI). Пустой выбор — фрагмент
     * по умолчанию: карта всегда показывает какой-то фрагмент.
     * zoom=false — карту не двигать (подключение фрагментов подсветки участка: карта идёт к участку).
     */
    applyVisibleFragmentsSelection(ids: number[], zoom = true) {
      const picked = ids.length ? ids : this.defaultFragmentIds;
      const uniq = [...new Set(picked)].sort((a, b) => a - b);
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
      try {
        appStorage.setItem(SAVED_KEY, JSON.stringify(this.visibleFragments));
      } catch {
        // localStorage недоступен — выбор живёт до перезагрузки
      }
    },
  }
}); 