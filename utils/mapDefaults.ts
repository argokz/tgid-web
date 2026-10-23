/**
 * Разовый сброс сохранённых в браузере подложки и слоёв контекста, когда меняются умолчания карты.
 *
 * Выбор пользователя (подложка, слои контекста) хранится в appStorage и важнее умолчаний.
 * Когда умолчания меняются для всех, MAP_DEFAULTS_VERSION увеличивается: при первой загрузке
 * карты сохранённый выбор стирается один раз, дальше снова действует выбор пользователя.
 *
 *   2 — 23.10.2026: MapTiler Planet v4, «Здания» и «Рельеф и 3D»
 */
import { appStorage } from '~/utils/appStorage'

export const MAP_DEFAULTS_VERSION = '2'
const VERSION_KEY = 'mapDefaults_v'
const RESET_KEYS = ['selectedBaseLayer', 'baseLayer', 'visibleContextLayers']

/** Стереть сохранённый выбор, если он сделан до текущих умолчаний. Повторные вызовы ничего не делают. */
export function resetStaleMapPrefs(): void {
  try {
    if (appStorage.getItem(VERSION_KEY) === MAP_DEFAULTS_VERSION) return
    for (const key of RESET_KEYS) appStorage.removeItem(key)
    appStorage.setItem(VERSION_KEY, MAP_DEFAULTS_VERSION)
  } catch {
    // localStorage недоступен (приватный режим, тесты) — работают умолчания
  }
}
