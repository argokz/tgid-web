import { defineStore } from 'pinia';

export type NotificationType = 'error' | 'success' | 'info' | 'warning';

export const useNotificationStore = defineStore('notification', {
  state: () => ({
    message: '',
    type: 'info' as NotificationType,
    show: false,
  }),

  actions: {
    showError(msg: string) {
      this.message = msg;
      this.type = 'error';
      this.show = true;
    },

    showWarning(msg: string) {
      this.message = msg;
      this.type = 'warning';
      this.show = true;
    },

    showSuccess(msg: string) {
      this.message = msg;
      this.type = 'success';
      this.show = true;
    },

    showInfo(msg: string) {
      this.message = msg;
      this.type = 'info';
      this.show = true;
    },

    hide() {
      this.show = false;
    },
  },
});
