/**
 * localStorage с префиксом города.
 *
 * Алматы и Астана открываются с одного домена (itwin.kz/tgid/almaty/, itwin.kz/tgid/astana/),
 * а localStorage общий на домен. Без префикса города делили бы видимые слои, фрагменты,
 * стили, положение карты и вход.
 *
 *   NUXT_PUBLIC_STORAGE_PREFIX="astana"  → ключ "astana:layerStyles"
 *   пусто (Алматы)                       → ключи как раньше, сохранённые настройки не теряются
 */

function readPrefix(): string {
  try {
    return String(useRuntimeConfig().public?.storagePrefix || '').trim()
  } catch {
    // вне контекста Nuxt (тесты, ранний код) — из конфигурации, отданной сервером в страницу
    const pub = (globalThis as any).__NUXT__?.config?.public
    return String(pub?.storagePrefix || '').trim()
  }
}

export function storageKey(key: string): string {
  const prefix = readPrefix()
  return prefix ? `${prefix}:${key}` : key
}

export const appStorage = {
  getItem: (key: string): string | null => localStorage.getItem(storageKey(key)),
  setItem: (key: string, value: string): void => localStorage.setItem(storageKey(key), value),
  removeItem: (key: string): void => localStorage.removeItem(storageKey(key)),
}
