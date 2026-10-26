/**
 * Предзагрузка общих примитивов журналов (S3b, docs/ui-modernization-acceptance.md): журналы собраны на
 * DataTable, StateView, AppSelect, KpiTile и др. — без предзагрузки их чанки, CSS и первый прогон кода
 * приходятся на первое открытие журнала. Грузим в простое после первого кадра карты: стартовую загрузку
 * это не задерживает, а сами диалоги остаются ленивыми (openLazyDialog в MapViewer).
 */

/** Примитивы, которые есть в трёх и более диалогах инструментов (таблица toolDialogs в MapViewer.vue) */
export const JOURNAL_PRIMITIVES: ReadonlyArray<() => Promise<unknown>> = [
  () => import('~/components/DataTable.vue'),
  () => import('~/components/StateView.vue'),
  () => import('~/components/AppSelect.vue'),
  () => import('~/components/KpiTile.vue'),
  () => import('~/components/SearchField.vue'),
  () => import('~/components/JournalDetailFields.vue'),
  () => import('~/components/SegmentedToggle.vue'),
];

/** Сколько ждать простоя: дольше — грузим всё равно, на медленной машине простоя может не быть */
export const PRELOAD_IDLE_TIMEOUT_MS = 5000;

type IdleScheduler = (cb: () => void, timeoutMs: number) => void;

const scheduleIdle: IdleScheduler = (cb, timeoutMs) => {
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(cb, { timeout: timeoutMs });
  else setTimeout(cb, timeoutMs);
};

let started = false;

/**
 * Один раз за сессию страницы: в простое загрузить чанки примитивов. Сбой не критичен — при открытии журнала
 * чанк запросится снова, а ошибку покажет LazyDialogBoundary; здесь только предупреждение.
 */
export function preloadJournalPrimitives(
  loaders: ReadonlyArray<() => Promise<unknown>> = JOURNAL_PRIMITIVES,
  schedule: IdleScheduler = scheduleIdle,
): Promise<void> {
  if (started) return Promise.resolve();
  started = true;
  return new Promise((resolve) => {
    schedule(() => {
      void Promise.allSettled(loaders.map((load) => load())).then((results) => {
        const failed = results.filter((r) => r.status === 'rejected').length;
        if (failed) console.warn(`[journalPreload] не загрузились ${failed} из ${loaders.length} примитивов журналов`);
        resolve();
      });
    }, PRELOAD_IDLE_TIMEOUT_MS);
  });
}

/** Для тестов: снова разрешить предзагрузку */
export function resetJournalPreload(): void {
  started = false;
}
