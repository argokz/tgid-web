import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';
import { authHeaders, buildApiUrl, mutationOptions, request } from '~/services/api/http';
import { useAuthStore } from '~/stores/authStore';
import { useLayerStore } from '~/stores/layerStore';
import { useMapStore } from '~/stores/mapStore';
import { useNotificationStore } from '~/stores/notificationStore';
import {
  changeText,
  createSseParser,
  mergeChanges,
  reconnectDelay,
  type LiveChange,
  type LiveEditing,
  type LivePresence,
  type SseMessage,
} from '~/utils/liveStream';

/** Как часто вкладка сообщает «я здесь» (сервер считает ушедшим через 60 с) */
export const HEARTBEAT_MS = 20_000;
/** Уведомления о чужих правках — не чаще (правки копятся и показываются одной строкой) */
const NOTIFY_EVERY_MS = 10_000;
const MAX_CHANGES = 30;

const newSessionId = (): string => (typeof crypto !== 'undefined' && 'randomUUID' in crypto
  ? crypto.randomUUID()
  : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
    (Number(c) ^ (Math.random() * 16 >> (Number(c) / 4))).toString(16)));

/**
 * Живая карта (фаза 2, п. 11): поток событий /api/v1/live/stream — кто на карте и что правит, правки сети у
 * других пользователей и в десктопе (сразу новые тайлы и уведомление). Запускает MapViewer (useLiveChannel);
 * опрос версии данных (useMapDataVersion) остаётся запасным путём, если поток не держится.
 */
export const useLiveStore = defineStore('live', () => {
  const connected = ref(false);
  const presence = ref<LivePresence[]>([]);
  const selfKey = ref<string | null>(null);
  const changes = ref<LiveChange[]>([]);
  /** Последняя чужая правка — карточки сверяют с ней свой объект */
  const lastChange = shallowRef<LiveChange | null>(null);
  const editing = ref<LiveEditing | null>(null);
  const sessionId = newSessionId();

  let running = false;
  let abort: AbortController | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let pendingNotify: LiveChange[] = [];
  let notifyTimer: ReturnType<typeof setTimeout> | null = null;

  const isOwn = (c: LiveChange) => !c.direct && c.by === useAuthStore().username;

  const flushNotify = () => {
    notifyTimer = null;
    if (!pendingNotify.length) return;
    const merged = mergeChanges(pendingNotify);
    const text = merged.slice(0, 3).map(changeText).join('; ');
    const more = merged.length > 3 ? ` и ещё ${merged.length - 3}` : '';
    useNotificationStore().showInfo(`Изменения на карте — ${text}${more}`);
    pendingNotify = [];
  };

  const onChange = (c: LiveChange) => {
    changes.value = [c, ...changes.value].slice(0, MAX_CHANGES);
    if (isOwn(c)) return;
    lastChange.value = c;
    pendingNotify.push(c);
    notifyTimer ??= setTimeout(flushNotify, NOTIFY_EVERY_MS);
  };

  const onMessage = (m: SseMessage) => {
    let data: unknown;
    try {
      data = JSON.parse(m.data);
    } catch {
      return;
    }
    const layerStore = useLayerStore();
    switch (m.event) {
      case 'hello': {
        const hello = data as { presence: LivePresence[]; version: string };
        connected.value = true;
        presence.value = hello.presence ?? [];
        if (hello.version) layerStore.applyDataVersion(String(hello.version));
        break;
      }
      case 'presence':
        presence.value = (data as LivePresence[]) ?? [];
        break;
      case 'data_version':
        layerStore.applyDataVersion(String((data as { version: string }).version));
        break;
      case 'network.changed':
        onChange(data as LiveChange);
        break;
      case 'resync':
        abort?.abort();
        break;
    }
  };

  const heartbeat = async () => {
    const map = useMapStore().map;
    const c = map?.getCenter();
    try {
      const res = await request<{ key: string }>('api/v1/live/presence', mutationOptions('POST', {
        session_id: sessionId,
        center: c ? [c.lng, c.lat] : null,
        zoom: map ? map.getZoom() : null,
        editing: editing.value,
      }));
      selfKey.value = res.key;
    } catch {
      // нет связи или входа — следующая попытка через HEARTBEAT_MS
    }
  };

  /** Одно подключение: читает поток, пока сервер его не закроет (через 10 мин) или связь не оборвётся */
  const readStream = async (signal: AbortSignal): Promise<'closed' | 'denied'> => {
    const res = await fetch(buildApiUrl('api/v1/live/stream'), {
      headers: { ...authHeaders(), Accept: 'text/event-stream' },
      signal,
      cache: 'no-store',
    });
    if (res.status === 401 || res.status === 403) return 'denied';
    if (!res.ok || !res.body) throw new Error(`live stream ${res.status}`);
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    const feed = createSseParser(onMessage);
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return 'closed';
      feed(value);
    }
  };

  const loop = async () => {
    let attempt = 0;
    while (running) {
      abort = new AbortController();
      let outcome: 'closed' | 'denied' | 'error' = 'error';
      try {
        outcome = await readStream(abort.signal);
      } catch {
        outcome = 'error';
      }
      const wasConnected = connected.value;
      connected.value = false;
      if (!running) return;
      // плановое закрытие сервером — сразу снова; ошибка или отказ — с растущей паузой
      attempt = outcome === 'closed' && wasConnected ? 0 : attempt + (outcome === 'denied' ? 3 : 1);
      await new Promise((r) => setTimeout(r, reconnectDelay(attempt)));
    }
  };

  const leave = () => {
    try {
      void fetch(buildApiUrl(`api/v1/live/presence/${sessionId}`), { method: 'DELETE', keepalive: true, headers: authHeaders() });
    } catch {
      // вкладка закрывается — сервер всё равно забудет её через минуту
    }
  };

  function start() {
    if (running || typeof window === 'undefined' || typeof TextDecoderStream === 'undefined') return;
    running = true;
    void heartbeat();
    heartbeatTimer = setInterval(heartbeat, HEARTBEAT_MS);
    window.addEventListener('pagehide', leave);
    void loop();
  }

  function stop() {
    running = false;
    abort?.abort();
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    if (notifyTimer) clearTimeout(notifyTimer);
    notifyTimer = null;
    if (typeof window !== 'undefined') window.removeEventListener('pagehide', leave);
    leave();
    connected.value = false;
  }

  /** Карточка открыла или закрыла объект на правку: другие увидят это сразу, а не через 20 с */
  function setEditing(e: LiveEditing | null) {
    const same = e && editing.value && e.kind === editing.value.kind && e.id === editing.value.id;
    if (same || (!e && !editing.value)) return;
    editing.value = e;
    if (running) void heartbeat();
  }

  return { connected, presence, selfKey, changes, lastChange, editing, start, stop, setEditing, onMessage };
});
