import { defineStore } from 'pinia';

export type NotificationType = 'error' | 'success' | 'info' | 'warning';

/** Кнопка в уведомлении (например, «Перезагрузить» при конфликте версий) */
export interface NotificationAction {
  label: string;
  handler: () => void | Promise<void>;
}

export const useNotificationStore = defineStore('notification', {
  state: () => ({
    message: '',
    type: 'info' as NotificationType,
    show: false,
    action: null as NotificationAction | null,
  }),

  actions: {
    notify(type: NotificationType, msg: string, action: NotificationAction | null = null) {
      this.message = msg;
      this.type = type;
      this.action = action;
      this.show = true;
    },

    showError(msg: string) {
      this.notify('error', msg);
    },

    showWarning(msg: string) {
      this.notify('warning', msg);
    },

    showSuccess(msg: string) {
      this.notify('success', msg);
    },

    showInfo(msg: string) {
      this.notify('info', msg);
    },

    /** Объект изменён другим пользователем (409): предложить перезагрузить его */
    showConflict(msg: string, onReload: () => void | Promise<void>) {
      this.notify('warning', msg, { label: 'Перезагрузить объект', handler: onReload });
    },

    async runAction() {
      const action = this.action;
      this.show = false;
      this.action = null;
      if (action) await action.handler();
    },

    hide() {
      this.show = false;
    },
  },
});
