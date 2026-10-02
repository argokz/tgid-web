import { reactive } from 'vue';

/**
 * Подтверждение действия своим диалогом вместо нативного confirm() (QA F45):
 * встроенный браузер и часть окружений молча блокируют window.confirm, и действие не выполнялось.
 * Диалог один на приложение — ConfirmDialogHost в layouts/default.vue.
 */
export interface ConfirmOptions {
  /** Вопрос с конкретным объектом: «Удалить запись №123?» */
  text: string;
  title?: string;
  /** Текст кнопки действия */
  action?: string;
  cancel?: string;
  /** Цвет кнопки действия: error — для удаления */
  color?: string;
}

export const confirmState = reactive({
  visible: false,
  title: '',
  text: '',
  action: 'OK',
  cancel: 'Отмена',
  color: 'primary',
  resolve: null as ((ok: boolean) => void) | null,
});

/** Закрыть диалог с ответом (кнопка, Esc, клик мимо — false) */
export function settleConfirm(ok: boolean): void {
  const resolve = confirmState.resolve;
  confirmState.resolve = null;
  confirmState.visible = false;
  resolve?.(ok);
}

/** Спросить пользователя; true — подтвердил */
export function confirmAction(options: ConfirmOptions | string): Promise<boolean> {
  const opts: ConfirmOptions = typeof options === 'string' ? { text: options } : options;
  // Новый вопрос поверх открытого: прежний считается отменённым
  if (confirmState.resolve) settleConfirm(false);
  const destructive = /^(удал|отказ|сброс)/i.test(opts.action || '');
  confirmState.title = opts.title || 'Подтверждение';
  confirmState.text = opts.text;
  confirmState.action = opts.action || 'OK';
  confirmState.cancel = opts.cancel || 'Отмена';
  confirmState.color = opts.color || (destructive ? 'error' : 'primary');
  confirmState.visible = true;
  return new Promise<boolean>((resolve) => {
    confirmState.resolve = resolve;
  });
}

export function useConfirm() {
  return { confirm: confirmAction, state: confirmState };
}
