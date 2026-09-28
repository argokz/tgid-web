import { describe, it, expect, vi, afterEach } from 'vitest';
import { isStyleMutable, waitForStyleMutable } from '~/services/mapService';

/** Минимальная заглушка maplibre Map: style._loaded + isStyleLoaded + события. */
function fakeMap(opts: { parsed: boolean; tilesDone: boolean }) {
  const handlers: Record<string, Set<() => void>> = {};
  const map = {
    style: { _loaded: opts.parsed },
    tilesDone: opts.tilesDone,
    isStyleLoaded() {
      return this.style._loaded && this.tilesDone;
    },
    on(ev: string, fn: () => void) {
      (handlers[ev] ||= new Set()).add(fn);
    },
    off(ev: string, fn: () => void) {
      handlers[ev]?.delete(fn);
    },
    fire(ev: string) {
      for (const fn of [...(handlers[ev] || [])]) fn();
    },
    listenerCount() {
      return Object.values(handlers).reduce((n, s) => n + s.size, 0);
    },
  };
  return map;
}

describe('mapService: ожидание готовности стиля', () => {
  afterEach(() => vi.useRealTimers());

  it('стиль разобран, но тайлы ещё грузятся — менять стиль уже можно', async () => {
    const map = fakeMap({ parsed: true, tilesDone: false });
    expect(map.isStyleLoaded()).toBe(false);
    expect(isStyleMutable(map as any)).toBe(true);
    await expect(waitForStyleMutable(map as any, 50)).resolves.toBeUndefined();
  });

  it('ждёт style.load после setStyle и снимает обработчики', async () => {
    const map = fakeMap({ parsed: false, tilesDone: false });
    const p = waitForStyleMutable(map as any, 1000);
    map.fire('styledata'); // ещё не разобран — продолжаем ждать
    map.style._loaded = true;
    map.fire('style.load');
    await expect(p).resolves.toBeUndefined();
    expect(map.listenerCount()).toBe(0);
  });

  it('по таймауту отклоняет промис и тоже снимает обработчики', async () => {
    vi.useFakeTimers();
    const map = fakeMap({ parsed: false, tilesDone: false });
    const p = waitForStyleMutable(map as any, 100);
    vi.advanceTimersByTime(150);
    await expect(p).rejects.toThrow(/did not finish loading/);
    expect(map.listenerCount()).toBe(0);
  });
});
