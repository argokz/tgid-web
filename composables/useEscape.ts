import { onBeforeUnmount, onMounted, watch, type Ref } from 'vue';
import { isMapMeasureActive } from '~/composables/useMapDraw';
import { isTopologyEditing } from '~/utils/mapToolFlags';
import { useUiStore } from '~/stores/uiStore';
import { shouldHandleEscape } from '~/utils/escapeKey';

/** На карте активен инструмент, которому принадлежит Esc при фокусе на холсте */
const mapToolActive = () => isMapMeasureActive() || isTopologyEditing.value;

export interface EscapeCloseOptions {
  /** Панель открыта — пока да, она в стеке Esc */
  open: Ref<boolean> | (() => boolean);
  close: () => void;
  /** Дополнительное условие: false — Esc сейчас принадлежит другому (идёт измерение, действие редактора) */
  allow?: () => boolean;
}

/**
 * Панель регистрируется в стеке Esc менеджера панелей, пока открыта (docs/ui-zones.md):
 * верхняя открытая панель закрывается первой. Вызывать в setup компонента панели.
 */
export function useEscapeClose(options: EscapeCloseOptions): void {
  if (import.meta.server) return;
  const ui = useUiStore();
  let dispose: (() => void) | null = null;
  const isOpen = () => (typeof options.open === 'function' ? options.open() : options.open.value);

  const register = () => {
    if (dispose) return;
    dispose = ui.pushEscape(() => {
      if (options.allow && !options.allow()) return false;
      options.close();
      return true;
    });
  };
  const unregister = () => {
    dispose?.();
    dispose = null;
  };

  watch(isOpen, (open) => (open ? register() : unregister()), { immediate: true });
  onBeforeUnmount(unregister);
}

/**
 * Один слушатель Esc на приложение (layout). Клавиша уходит верхней панели стека, если её не забрали
 * поле ввода, холст карты (фокус там — у инструментов) или открытый диалог Vuetify. Слушаем на capture-фазе окна: обработчики инструментов
 * (`useMapDraw`, `useTopologyEditor`) висят на окне обычным образом и получают клавишу только если
 * панели от неё отказались — иначе одно нажатие и отменяло бы измерение, и закрывало панель.
 */
export function useGlobalEscape(): void {
  const ui = useUiStore();
  const onKeydown = (event: KeyboardEvent) => {
    if (!shouldHandleEscape(event, document, mapToolActive())) return;
    if (ui.handleEscape()) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  onMounted(() => window.addEventListener('keydown', onKeydown, { capture: true }));
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown, { capture: true }));
}
