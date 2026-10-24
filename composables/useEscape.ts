import { onBeforeUnmount, onMounted, watch, type Ref } from 'vue';
import { registerHotkeys } from '~/composables/useHotkeys';
import { useUiStore } from '~/stores/uiStore';
import { shouldHandleEscape } from '~/utils/escapeKey';

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
 * Стек панелей — последняя область реестра хоткеев (`utils/hotkeys.ts`): Esc доходит сюда, когда от него
 * отказались поповер, измерение и редактор. Вызывать в layout.
 */
export function useGlobalEscape(): void {
  const ui = useUiStore();
  let dispose: (() => void) | null = null;
  onMounted(() => {
    dispose = registerHotkeys({
      id: 'panels-escape',
      area: 'panels',
      allowInInput: true, // пустое поле Esc отпускает — решает shouldHandleEscape
      handle: (event) => shouldHandleEscape(event) && ui.handleEscape(),
    });
  });
  onBeforeUnmount(() => dispose?.());
}
