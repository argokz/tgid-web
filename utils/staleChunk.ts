/**
 * Ленивый чанк не загрузился: после выкатки новой сборки у открытой вкладки старые имена файлов
 * (`_nuxt/*.js` с хешем), сервер их уже не отдаёт. Тексты браузеров: Chrome/Vite — «Failed to fetch
 * dynamically imported module», Safari — «Importing a module script failed», Firefox — «error loading
 * dynamically imported module»; Vite при отсутствии CSS чанка — «Unable to preload CSS».
 */
const STALE_CHUNK_RE =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i;

export function isStaleChunkError(error: unknown): boolean {
  if (error == null) return false;
  const message = typeof error === 'object' && 'message' in error ? String((error as { message: unknown }).message) : String(error);
  return STALE_CHUNK_RE.test(message);
}
