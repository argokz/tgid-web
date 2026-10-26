import { afterEach, describe, expect, it, vi } from 'vitest';
import { PRELOAD_IDLE_TIMEOUT_MS, preloadJournalPrimitives, resetJournalPreload } from '~/utils/journalPreload';

describe('preloadJournalPrimitives', () => {
  afterEach(() => {
    resetJournalPreload();
    vi.restoreAllMocks();
  });

  it('грузит примитивы только в простое и один раз за страницу', async () => {
    const load = vi.fn(() => Promise.resolve({}));
    let idle: (() => void) | null = null;
    const schedule = vi.fn((cb: () => void, timeout: number) => {
      expect(timeout).toBe(PRELOAD_IDLE_TIMEOUT_MS);
      idle = cb;
    });

    const done = preloadJournalPrimitives([load, load], schedule);
    expect(load).not.toHaveBeenCalled();
    idle!();
    await done;
    expect(load).toHaveBeenCalledTimes(2);

    await preloadJournalPrimitives([load], schedule);
    expect(schedule).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('сбой чанка не роняет предзагрузку — остальные грузятся, в консоли предупреждение', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ok = vi.fn(() => Promise.resolve({}));
    await preloadJournalPrimitives([() => Promise.reject(new Error('chunk')), ok], (cb) => cb());
    expect(ok).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('1 из 2'));
  });
});
