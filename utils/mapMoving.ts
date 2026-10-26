/**
 * Класс `.map-moving` на корне документа, пока карта движется (панорамирование, зум, перелёт).
 *
 * Стекло уровня 1 (шапка, тулбары) берёт `backdrop-filter` из токенов, а `.map-moving` в assets/styles/_tokens.scss
 * подменяет их плотной заливкой без размытия: blur над живым WebGL-холстом пересчитывается на каждом кадре
 * движения (замер S1, docs/performance-baseline.md). Класс — на `<html>`, чтобы переменные дошли и до шапки,
 * которая вне дерева карты.
 */

export const MAP_MOVING_CLASS = 'map-moving'

/** Минимум от карты MapLibre, который нужен здесь (подписка и отписка на события) */
export interface MovingEventSource {
  on(type: 'movestart' | 'moveend', listener: () => void): unknown
  off(type: 'movestart' | 'moveend', listener: () => void): unknown
}

/** Включает класс на время движения карты; возвращает функцию отписки (и снимает класс) */
export function bindMapMovingClass(map: MovingEventSource, root: Element = document.documentElement): () => void {
  const start = () => root.classList.add(MAP_MOVING_CLASS)
  const end = () => root.classList.remove(MAP_MOVING_CLASS)
  map.on('movestart', start)
  map.on('moveend', end)
  return () => {
    map.off('movestart', start)
    map.off('moveend', end)
    end()
  }
}
