import { useNotificationStore } from '~/stores/notificationStore';

export function useNotification() {
  const store = useNotificationStore();
  return {
    showError: store.showError,
    showSuccess: store.showSuccess,
    showInfo: store.showInfo,
    hide: store.hide,
  };
}
