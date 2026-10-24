import { ref } from 'vue';

/**
 * Флаги активных инструментов карты, доступные без импорта тяжёлых композаблов (layout, менеджер Esc).
 * Режим измерений — `activeDrawMode` в `composables/useMapDraw.ts`.
 */

/** Режим правки топологии включён (ставит `useTopologyEditor`): Esc с холста карты принадлежит редактору */
export const isTopologyEditing = ref(false);
