/**
 * Ветки комментариев на карте (фаза 2, п. 4): точки веток поверх карты, клик по точке — ветка в окне
 * «Комментарии на карте», раз в 2 минуты — проверка нового для меня (упомянули или ответили в моей ветке).
 *
 * Состояние общее для приложения (модульный singleton): окно комментариев включает слой и просит перерисовать
 * после правки, MapViewer рисует (attach — один раз в его setup).
 */
import type { Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';
import { ref, watch } from 'vue';
import { useOverlayLayer } from '~/composables/useOverlayLayer';
import { fastApiService } from '~/services/fastApiService';
import { appStorage } from '~/utils/appStorage';
import { COMMENT_PIN_LAYER, threadMapFeatures, type CommentStatus } from '~/utils/mapComments';

const PINS_KEY = 'mapComments:pins';
const UNREAD_POLL_MS = 120_000;

/** Точки веток на карте (выбор запоминается; читается в start — на сервере localStorage нет) */
export const commentPinsEnabled = ref(false);
/** Какие ветки показывать точками */
export const commentPinsStatus = ref<CommentStatus>('open');
/** Сколько веток с новым для меня */
export const commentsUnread = ref(0);
const version = ref(0);

export function setCommentPins(on: boolean): void {
  commentPinsEnabled.value = on;
  appStorage.setItem(PINS_KEY, on ? '1' : '0');
}

/** Ветки изменились (новая, ответ, решено) — перерисовать точки и счётчик */
export function refreshCommentPins(): void {
  version.value += 1;
}

interface AttachOptions {
  getMap: () => MapLibreMap | null | undefined;
  /** Клик по точке ветки */
  openThread: (threadId: number) => void;
  /** Вход выполнен: без него опрос нового не нужен */
  signedIn: () => boolean;
  /** Появилось новое для меня (больше, чем было) */
  onNewUnread?: (count: number) => void;
}

export function attachMapCommentPins({ getMap, openThread, signedIn, onNewUnread }: AttachOptions) {
  const overlay = useOverlayLayer(getMap, 'map-comments', { layerIds: [COMMENT_PIN_LAYER, 'map-comments-count'] });
  let timer: ReturnType<typeof setInterval> | null = null;
  let clickBound: MapLibreMap | null = null;

  const draw = async () => {
    const map = getMap();
    if (!map) return;
    if (!commentPinsEnabled.value) {
      overlay.clear();
      return;
    }
    try {
      const fc = threadMapFeatures(await fastApiService.getMapThreadsGeoJson(commentPinsStatus.value));
      overlay.show(fc, [
        {
          id: COMMENT_PIN_LAYER,
          type: 'circle',
          paint: { 'circle-radius': 11, 'circle-color': ['get', 'color'], 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' },
        },
        {
          id: 'map-comments-count',
          type: 'symbol',
          layout: { 'text-field': ['get', 'label'], 'text-font': ['Open Sans Regular'], 'text-size': 11, 'text-allow-overlap': true },
          paint: { 'text-color': '#fff' },
        },
      ]);
      bindClick(map);
    } catch {
      // нет связи или входа — точки появятся при следующей перерисовке
    }
  };

  const bindClick = (map: MapLibreMap) => {
    if (clickBound === map) return;
    clickBound = map;
    map.on('click', (e: MapMouseEvent) => {
      if (!map.getLayer(COMMENT_PIN_LAYER)) return;
      const hit = map.queryRenderedFeatures(e.point, { layers: [COMMENT_PIN_LAYER] })[0];
      const id = Number(hit?.properties?.id);
      if (Number.isFinite(id)) openThread(id);
    });
    map.on('mousemove', (e: MapMouseEvent) => {
      if (!map.getLayer(COMMENT_PIN_LAYER)) return;
      const over = map.queryRenderedFeatures(e.point, { layers: [COMMENT_PIN_LAYER] }).length > 0;
      if (over) map.getCanvas().style.cursor = 'pointer';
    });
  };

  const pollUnread = async () => {
    if (!signedIn()) return;
    try {
      const { unread } = await fastApiService.getMapCommentsUnread();
      if (unread > commentsUnread.value) onNewUnread?.(unread);
      commentsUnread.value = unread;
    } catch {
      // сервер недоступен — проверим в следующий раз
    }
  };

  watch([commentPinsEnabled, commentPinsStatus, version], () => void draw());
  watch(version, () => void pollUnread());

  /** Карта готова (и после смены стиля — оверлей снимается вместе со стилем) */
  const start = () => {
    commentPinsEnabled.value = appStorage.getItem(PINS_KEY) === '1';
    // смена подложки снимает все слои стиля — точки веток вернуть
    getMap()?.on('style.load', () => void draw());
    void draw();
    void pollUnread();
    if (!timer) timer = setInterval(() => void pollUnread(), UNREAD_POLL_MS);
  };

  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };

  return { start, stop, redraw: draw };
}
