import { onBeforeUnmount, onMounted } from 'vue';
import { fastApiService } from '~/services/fastApiService';
import { useLayerStore } from '~/stores/layerStore';

/** Как часто спрашивать версию данных (API держит ответ 10 с в кеше) */
export const DATA_VERSION_POLL_MS = 30_000;

/**
 * Версия данных базы города: изменения сети у других пользователей и в десктопе видны на карте
 * через 30–60 с (тайлы по новой версии мимо кешей GWC/nginx/браузера). Опрос — только пока вкладка
 * видна; при возвращении на вкладку — сразу.
 */
export function useMapDataVersion(pollMs = DATA_VERSION_POLL_MS) {
  const layerStore = useLayerStore();
  let timer: ReturnType<typeof setInterval> | null = null;
  let busy = false;

  const check = async () => {
    if (busy || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;
    busy = true;
    try {
      const { version } = await fastApiService.getMapDataVersion();
      layerStore.applyDataVersion(String(version ?? ''));
    } catch {
      // API недоступен или ещё нет входа — следующий опрос
    } finally {
      busy = false;
    }
  };

  const onVisibility = () => {
    if (document.visibilityState === 'visible') void check();
  };

  onMounted(() => {
    void check();
    timer = setInterval(check, pollMs);
    document.addEventListener('visibilitychange', onVisibility);
  });

  onBeforeUnmount(() => {
    if (timer) clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisibility);
  });

  return { check };
}
