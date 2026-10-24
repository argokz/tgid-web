import { defineStore } from 'pinia';
import { computed, ref, watch, type Ref } from 'vue';
import type { DeviceClass } from '~/utils/breakpoints';

/**
 * Менеджер панелей приложения (docs/ui-zones.md).
 *
 * Панели, которые делят экран с картой: «Инструменты» (журналы, реестры, отчёты — правый drawer),
 * «Измерения» (панель рисования слева) и карточка объекта (панель справа или окно). Их содержимое
 * рендерится внутри MapViewer и AttributePanel, открываются они из шапки, контролов карты и клика
 * по объекту — связь идёт через этот store.
 *
 * Правила (`PANEL_RULES`): кто кого закрывает при открытии; на телефоне (`viewport === 'phone'`)
 * экран один — открытая панель закрывает остальные. Esc — стек обработчиков (`pushEscape`):
 * верхний, кто согласился, закрывает своё; один слушатель клавиши на приложение — `useGlobalEscape`.
 * `rightInset` — ширина открытой панели карточки справа: полосы над картой центрируются по видимой части.
 */
export type PanelKey = 'tools' | 'draw' | 'card';

export interface PanelRule {
  /** Панели, которые закрываются при открытии этой */
  closes: readonly PanelKey[];
  /** На телефоне открытие закрывает все остальные панели */
  soloOnPhone: boolean;
  /**
   * Менеджер может закрыть панель сам. У карточки — false: её закрывает только владелец (`AttributePanel.close()`
   * с подтверждением несохранённых правок); на телефоне она во весь экран и сама закрывает остальные
   */
  evictable: boolean;
}

export const PANEL_RULES: Readonly<Record<PanelKey, PanelRule>> = {
  tools: { closes: ['draw'], soloOnPhone: true, evictable: true },
  draw: { closes: ['tools'], soloOnPhone: true, evictable: true },
  card: { closes: [], soloOnPhone: true, evictable: false },
};

export const PANEL_KEYS = Object.keys(PANEL_RULES) as PanelKey[];

/** Обработчик Esc: true — клавиша обработана и дальше не идёт */
export type EscapeHandler = () => boolean;

export interface ToolDialogRequest {
  key: string;
  scope?: unknown;
  seq: number;
}

export const useUiStore = defineStore('ui', () => {
  /** Правая панель «Инструменты» (журналы, реестры, отчёты, диагностика) */
  const toolsPanelOpen = ref(false);
  /** Панель рисования и измерений на карте */
  const drawPanelOpen = ref(false);
  /** Карточка объекта (ObjectCardShell сообщает о своём состоянии) */
  const cardOpen = ref(false);
  /** Запрос открыть диалог инструментов из-за пределов карты (протокол расчёта → журнал) */
  const toolDialogRequest = ref<ToolDialogRequest | null>(null);
  /** Класс устройства по ширине окна (utils/breakpoints); ставит layout после гидрации */
  const viewport = ref<DeviceClass>('desktop');
  /** Ширина панели карточки справа, px (0 — закрыта или плавающее окно) */
  const rightInset = ref(0);

  const flags: Record<PanelKey, Ref<boolean>> = { tools: toolsPanelOpen, draw: drawPanelOpen, card: cardOpen };

  const evict = (keys: readonly PanelKey[], except: PanelKey | null) => {
    for (const other of keys) {
      if (other !== except && PANEL_RULES[other].evictable) flags[other].value = false;
    }
  };
  const applyRules = (key: PanelKey) => {
    const rule = PANEL_RULES[key];
    evict(viewport.value === 'phone' && rule.soloOnPhone ? PANEL_KEYS : rule.closes, key);
  };
  // sync: правило применяется в момент записи, поэтому при двух открытиях подряд побеждает последнее
  for (const key of PANEL_KEYS) watch(flags[key], (open) => { if (open) applyRules(key); }, { flush: 'sync' });

  const openPanels = computed(() => PANEL_KEYS.filter((k) => flags[k].value));

  const isOpen = (key: PanelKey): boolean => flags[key].value;
  const setPanel = (key: PanelKey, open: boolean) => { flags[key].value = open; };
  const togglePanel = (key: PanelKey, value?: boolean) => setPanel(key, value ?? !flags[key].value);

  const toggleToolsPanel = (value?: boolean) => togglePanel('tools', value);
  const toggleDrawPanel = (value?: boolean) => togglePanel('draw', value);

  /** Открыть диалог инструментов (ключ toolDialogs в MapViewer) с параметрами */
  const requestToolDialog = (key: string, scope?: unknown) => {
    toolDialogRequest.value = { key, scope, seq: (toolDialogRequest.value?.seq ?? 0) + 1 };
  };

  /** Закрыть панели менеджера (карточку — не трогает, её закрывает владелец) */
  const closeAll = () => evict(PANEL_KEYS, null);

  const setViewport = (value: DeviceClass) => {
    viewport.value = value;
    // Стали телефоном (поворот, сужение окна): под открытой карточкой во весь экран панелям делать нечего
    if (value === 'phone' && cardOpen.value) evict(PANEL_KEYS, 'card');
  };
  const setRightInset = (px: number) => { rightInset.value = Math.max(0, Math.round(px)); };

  // Стек Esc: регистрируются открытые панели и меню; снимаются при закрытии (useEscapeClose)
  const escapeStack: { id: number; handle: EscapeHandler }[] = [];
  let escapeSeq = 0;
  const escapeCount = ref(0);
  /** Сколько обработчиков в стеке (только чтение: тесты и отладка) */
  const escapeDepth = computed(() => escapeCount.value);

  const pushEscape = (handle: EscapeHandler): (() => void) => {
    const id = ++escapeSeq;
    escapeStack.push({ id, handle });
    escapeCount.value = escapeStack.length;
    return () => {
      const i = escapeStack.findIndex((e) => e.id === id);
      if (i >= 0) escapeStack.splice(i, 1);
      escapeCount.value = escapeStack.length;
    };
  };

  /** Отдать Esc верхнему обработчику, который его примет; false — никто не принял */
  const handleEscape = (): boolean => {
    for (let i = escapeStack.length - 1; i >= 0; i--) {
      if (escapeStack[i].handle()) return true;
    }
    return false;
  };

  return {
    toolsPanelOpen,
    drawPanelOpen,
    cardOpen,
    toolDialogRequest,
    viewport,
    rightInset,
    openPanels,
    escapeDepth,
    isOpen,
    setPanel,
    togglePanel,
    toggleToolsPanel,
    toggleDrawPanel,
    requestToolDialog,
    closeAll,
    setViewport,
    setRightInset,
    pushEscape,
    handleEscape,
  };
});
