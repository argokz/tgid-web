import { defineStore } from 'pinia';
import type { PopupOptions } from 'maplibre-gl';
import { getMaplibreDefault } from '~/utils/maplibreLoader';
import { markRaw } from 'vue';
import { escapeHtml } from '~/utils/escapeHtml';

interface PopupConfig {
  layerId: string;
  sourceId: string;
  sourceLayer: string;
  fields: string[];
  title?: string;
  options?: PopupOptions;
}

export const usePopupStore = defineStore('popup', {
  state: () => ({
    map: null as any,
    popups: [] as PopupConfig[],
    popupMinZoom: 0,
    popupMaxZoom: 22,
    showAllPopups: false,
    allPopupsZoom: 16,
    allPopups: [] as any[],
  }),

  actions: {
    initPopupSettings() {
      const savedMinZoom = localStorage.getItem('popupMinZoom');
      const savedMaxZoom = localStorage.getItem('popupMaxZoom');
      const savedShowAll = localStorage.getItem('showAllPopups');
      const savedAllZoom = localStorage.getItem('allPopupsZoom');

      this.popupMinZoom = savedMinZoom ? parseInt(savedMinZoom) : 0;
      this.popupMaxZoom = savedMaxZoom ? parseInt(savedMaxZoom) : 22;
      this.showAllPopups = savedShowAll === 'true';
      this.allPopupsZoom = savedAllZoom ? parseInt(savedAllZoom) : 16;

      console.log(`Initialized popup settings: min=${this.popupMinZoom}, max=${this.popupMaxZoom}, showAll=${this.showAllPopups}`);
    },

    setMap(map: any) {
      this.map = markRaw(map);
    },

    addPopup(popup: PopupConfig) {
      this.popups.push(popup);
      this.setupPopup(popup);
    },

    removePopup(layerId: string) {
      this.popups = this.popups.filter(p => p.layerId !== layerId);
    },

    setupPopup(popup: PopupConfig) {
      if (!this.map) return;

      const { layerId, fields, title, options } = popup;

      this.map.on('click', layerId, async (e: any) => {
        if (!e.features?.[0]) return;

        const properties = e.features[0].properties;
        const content = fields
          .map(field => `<div><strong>${escapeHtml(field)}:</strong> ${escapeHtml(properties[field])}</div>`)
          .join('');

        const maplibregl = await getMaplibreDefault();
        new maplibregl.Popup({
          closeButton: true,
          closeOnClick: true,
          className: 'custom-popup',
          maxWidth: '300px',
          offset: [0, -15] as [number, number],
          ...options
        })
          .setLngLat(e.lngLat)
          .setHTML(title ? `<h3>${escapeHtml(title)}</h3>${content}` : content)
          .addTo(this.map!);
      });

      this.map.on('mouseenter', layerId, () => {
        this.map!.getCanvas().style.cursor = 'pointer';
      });

      this.map.on('mouseleave', layerId, () => {
        this.map!.getCanvas().style.cursor = '';
      });
    },

    toggleShowAllPopups(value: boolean) {
      this.showAllPopups = value;
      localStorage.setItem('showAllPopups', value.toString());
    },

    updateAllPopupsZoom(zoom: number) {
      this.allPopupsZoom = zoom;
      localStorage.setItem('allPopupsZoom', zoom.toString());
    },

    updatePopupZoomLimits(min: number, max: number) {
      this.popupMinZoom = min;
      this.popupMaxZoom = max;
      localStorage.setItem('popupMinZoom', min.toString());
      localStorage.setItem('popupMaxZoom', max.toString());
    }
  }
});