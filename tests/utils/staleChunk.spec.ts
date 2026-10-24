import { describe, expect, it } from 'vitest';
import { isStaleChunkError } from '~/utils/staleChunk';

describe('isStaleChunkError: устаревший чанк после выкатки', () => {
  it('узнаёт тексты Chrome, Safari, Firefox и Vite', () => {
    expect(isStaleChunkError(new TypeError('Failed to fetch dynamically imported module: https://itwin.kz/tgid/almaty/_nuxt/Cuwv1oJa.js'))).toBe(true);
    expect(isStaleChunkError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isStaleChunkError(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(isStaleChunkError({ message: 'Unable to preload CSS for /_nuxt/x.css' })).toBe(true);
    expect(isStaleChunkError('Failed to fetch dynamically imported module')).toBe(true);
  });

  it('обычные ошибки и пустые значения — не считает', () => {
    expect(isStaleChunkError(new Error('Сервер API недоступен'))).toBe(false);
    expect(isStaleChunkError(new TypeError('Failed to fetch'))).toBe(false);
    expect(isStaleChunkError(null)).toBe(false);
    expect(isStaleChunkError(undefined)).toBe(false);
    expect(isStaleChunkError('')).toBe(false);
  });
});
