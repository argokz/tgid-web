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
    /** Запрос открыть диалог инструментов из-за пределов карты (протокол расчёта → журнал) */
    toolDialogRequest: null as { key: string; scope?: unknown; seq: number } | null,
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

    /** Открыть диалог инструментов (ключ toolDialogs в MapViewer) с параметрами */
    requestToolDialog(key: string, scope?: unknown) {
      this.toolDialogRequest = { key, scope, seq: (this.toolDialogRequest?.seq ?? 0) + 1 };
    },

    closeAll() {
      this.toolsPanelOpen = false;
      this.drawPanelOpen = false;
    },
  },
});
