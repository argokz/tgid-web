import { ref, watch, type Ref } from 'vue';

/**
 * Оверлей на карте, которым владеет диалог (гидравлический режим, анализ отключения,
 * результаты расчёта), — QA F27, F37. Единое правило:
 * - закрытие диалога (крестик, Esc, клик мимо, «Закрыть») снимает оверлей;
 * - явное «Оставить на карте» закрывает диалог и оставляет оверлей;
 * - оставленный оверлей переживает повторное открытие диалога, пока диалог не покажет
 *   новый (markShown) или пользователь не снимет его сам (markCleared).
 */
export function useDialogMapOverlay(visible: Ref<boolean>, clear: () => void) {
  /** Оверлей диалога сейчас на карте */
  const shown = ref(false);
  /** Пользователь явно оставил оверлей на карте */
  const kept = ref(false);

  /** Диалог нарисовал (или перерисовал) оверлей — снова принадлежит диалогу */
  const markShown = () => {
    shown.value = true;
    kept.value = false;
  };

  /** Оверлей снят (кнопкой в диалоге или при закрытии) */
  const markCleared = () => {
    shown.value = false;
    kept.value = false;
  };

  /** «Оставить на карте»: закрыть диалог, оверлей не трогать */
  const keepOnMap = () => {
    kept.value = shown.value;
    visible.value = false;
  };

  watch(visible, (isOpen, wasOpen) => {
    if (isOpen || !wasOpen || !shown.value || kept.value) return;
    clear();
    markCleared();
  });

  return { shown, kept, markShown, markCleared, keepOnMap };
}
