/**
 * Трек бригады на странице бригады (pages/field.vue): переключатель «Передавать местоположение», слежение за
 * GPS, запись точек на телефон и отправка пачками. Правила — utils/fieldTrack.ts, хранение — fieldStore.
 *
 * Браузер даёт координаты, только пока страница открыта и экран включён: в фоне трек прерывается (на карте
 * диспетчера — разрыв линии). Выбор «передавать» запоминается на телефоне.
 */
import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';
import { fastApiService } from '~/services/fastApiService';
import { appStorage } from '~/utils/appStorage';
import { classifySendError } from '~/utils/fieldQueue';
import { fieldStore } from '~/utils/fieldStore';
import { shouldRecord, toBatches, type TrackPoint } from '~/utils/fieldTrack';

const TRACK_KEY = 'field:track';
const FLUSH_INTERVAL_MS = 60_000;
const WATCH_OPTIONS: PositionOptions = { enableHighAccuracy: true, maximumAge: 10_000, timeout: 60_000 };

interface Options {
  brigadeId: Readonly<Ref<number | null>>;
  online: Readonly<Ref<boolean>>;
  canSend: () => boolean;
  errorInfo: (error: unknown) => { status: number; message: string };
}

export function useFieldTrack({ brigadeId, online, canSend, errorInfo }: Options) {
  const enabled = ref(false);
  const unsent = ref(0);
  const lastAt = ref<string | null>(null);
  const error = ref('');
  let watchId: number | null = null;
  let last: TrackPoint | null = null;
  let flushing = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  async function onPosition(p: GeolocationPosition): Promise<void> {
    error.value = '';
    const point: TrackPoint = {
      t: new Date(p.timestamp || Date.now()).toISOString(),
      lon: Number(p.coords.longitude.toFixed(6)),
      lat: Number(p.coords.latitude.toFixed(6)),
      accuracy: Number.isFinite(p.coords.accuracy) ? Math.round(p.coords.accuracy) : null,
      brigadeId: brigadeId.value,
    };
    if (!shouldRecord(last, point)) return;
    last = point;
    lastAt.value = point.t;
    try {
      await fieldStore.addTrackPoint(point);
      unsent.value = await fieldStore.countTrack();
    } catch (e) {
      error.value = `Точка не сохранилась: ${errorInfo(e).message}`;
    }
  }

  function onPositionError(e: GeolocationPositionError): void {
    if (e.code === e.PERMISSION_DENIED) {
      error.value = 'Нет разрешения на геолокацию — включите его в настройках браузера';
      stop();
      enabled.value = false;
      appStorage.setItem(TRACK_KEY, '0');
      return;
    }
    error.value = 'Нет сигнала GPS — трек продолжится, когда он появится';
  }

  function start(): void {
    if (watchId != null || typeof navigator === 'undefined' || !navigator.geolocation) return;
    watchId = navigator.geolocation.watchPosition((p) => void onPosition(p), onPositionError, WATCH_OPTIONS);
  }

  function stop(): void {
    if (watchId != null) navigator.geolocation.clearWatch(watchId);
    watchId = null;
    last = null;
  }

  function setEnabled(on: boolean): void {
    if (on && (typeof navigator === 'undefined' || !navigator.geolocation)) {
      error.value = 'Телефон не даёт координаты';
      return;
    }
    enabled.value = on;
    appStorage.setItem(TRACK_KEY, on ? '1' : '0');
    if (on) start();
    else {
      stop();
      void flush();
    }
  }

  /** Отправить накопленное; без связи или без входа — подождать, отказ сервера (не та пачка) — выбросить её */
  async function flush(): Promise<void> {
    if (flushing || !online.value || !canSend()) return;
    flushing = true;
    try {
      for (const batch of toBatches(await fieldStore.listTrack())) {
        try {
          await fastApiService.sendFieldTrack({
            brigade_id: batch.brigadeId,
            points: batch.points.map(({ t, lon, lat, accuracy }) => ({ t, lon, lat, accuracy })),
          });
        } catch (e) {
          const { status, message } = errorInfo(e);
          const kind = classifySendError(status);
          if (kind === 'retry' || kind === 'auth') break;
          error.value = `Трек не принят: ${message}`;
        }
        await fieldStore.deleteTrack(batch.points.map((p) => p.t));
      }
    } catch (e) {
      error.value = `Трек не отправлен: ${errorInfo(e).message}`;
    } finally {
      unsent.value = await fieldStore.countTrack().catch(() => unsent.value);
      flushing = false;
    }
  }

  /** При выходе: отправить своё, если есть связь; остальное — удалить, чтобы не ушло от имени следующего */
  async function forget(): Promise<void> {
    stop();
    enabled.value = false;
    appStorage.setItem(TRACK_KEY, '0');
    await flush();
    await fieldStore.deleteTrack();
    unsent.value = 0;
  }

  onMounted(async () => {
    unsent.value = await fieldStore.countTrack().catch(() => 0);
    if (appStorage.getItem(TRACK_KEY) === '1') setEnabled(true);
    timer = setInterval(() => void flush(), FLUSH_INTERVAL_MS);
  });

  onBeforeUnmount(() => {
    stop();
    if (timer) clearInterval(timer);
  });

  return { enabled, unsent, lastAt, error, setEnabled, flush, forget };
}
