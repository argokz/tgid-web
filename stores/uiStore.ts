import { defineStore } from 'pinia';

/**
 * Состояние панелей приложения.
 *
 * Инструменты, не относящиеся к карте (журналы, реестры, отчёты, диагностика),
 * живут в отдельной панели уровня приложения, а не в оверлее карты. Панель
 * открывается из верхней навигации, а её содержимое рендерится внутри
 * MapViewer, который владеет диалогами — связь идёт через этот store.
 */
export const useUiStore = defineStore('ui', {
  state: () => ({
    /** Правая панель «Инструменты» (журналы, реестры, отчёты, диагностика) */
    toolsPanelOpen: false,
    /** Панель рисования на карте */
    drawPanelOpen: false,
  }),

  actions: {
    toggleToolsPanel(value?: boolean) {
      this.toolsPanelOpen = value ?? !this.toolsPanelOpen;
      // Панели рисования и инструментов не должны перекрывать друг друга
      if (this.toolsPanelOpen) this.drawPanelOpen = false;
    },

    toggleDrawPanel(value?: boolean) {
      this.drawPanelOpen = value ?? !this.drawPanelOpen;
      if (this.drawPanelOpen) this.toolsPanelOpen = false;
    },

    closeAll() {
      this.toolsPanelOpen = false;
      this.drawPanelOpen = false;
    },
  },
});
