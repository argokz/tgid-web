import { onBeforeUnmount, onMounted, watch } from 'vue';
import { useAuthStore } from '~/stores/authStore';
import { useLiveStore } from '~/stores/liveStore';

/**
 * Живая карта: поток событий, пока открыта карта и есть вход (или вход выключен на сервере).
 * Выход из учётной записи закрывает поток, вход — открывает.
 */
export function useLiveChannel() {
  const auth = useAuthStore();
  const live = useLiveStore();
  const signedIn = () => auth.isAuthenticated || auth.authDisabled;

  onMounted(() => {
    if (signedIn()) live.start();
  });
  const stopWatch = watch(signedIn, (on) => (on ? live.start() : live.stop()));
  onBeforeUnmount(() => {
    stopWatch();
    live.stop();
  });
}
