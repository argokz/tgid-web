/**
 * Разовый сброс сохранённых в браузере подложки и слоёв контекста, когда меняются умолчания карты.
 *
 * Выбор пользователя (подложка, слои контекста) хранится в appStorage и важнее умолчаний.
 * Когда умолчания меняются для всех, MAP_DEFAULTS_VERSION увеличивается: при первой загрузке
 * карты сохранённый выбор стирается один раз (только ключи той версии, что изменилась),
 * дальше снова действует выбор пользователя.
 *
 *   2 — 23.10.2026: MapTiler Planet v4, «Здания» и «Рельеф и 3D»
 *   3 — 24.10.2026: «Рельеф и 3D» выключен по умолчанию — с ним карта шла на 5–10 fps против 35–40
 *       (A/B в docs/performance-baseline.md); подложка не трогается
 */
import { appStorage } from '~/utils/appStorage'

export const MAP_DEFAULTS_VERSION = '3'
const VERSION_KEY = 'mapDefaults_v'
/** Какие сохранённые ключи стирает каждая версия умолчаний */
const RESET_KEYS_BY_VERSION: Record<string, string[]> = {
  '2': ['selectedBaseLayer', 'baseLayer', 'visibleContextLayers'],
  '3': ['visibleContextLayers'],
}

/** Стереть сохранённый выбор, если он сделан до текущих умолчаний. Повторные вызовы ничего не делают. */
export function resetStaleMapPrefs(): void {
  try {
    const stored = appStorage.getItem(VERSION_KEY)
    if (stored === MAP_DEFAULTS_VERSION) return
    const storedVersion = Number(stored) || 0
    for (const [version, keys] of Object.entries(RESET_KEYS_BY_VERSION)) {
      if (Number(version) <= storedVersion) continue
      for (const key of keys) appStorage.removeItem(key)
    }
    appStorage.setItem(VERSION_KEY, MAP_DEFAULTS_VERSION)
  } catch {
    // localStorage недоступен (приватный режим, тесты) — работают умолчания
  }
}
