import { describe, expect, it } from 'vitest'
import { bindMapMovingClass, MAP_MOVING_CLASS, type MovingEventSource } from '~/utils/mapMoving'

/** Карта-заглушка: хранит подписчиков и вызывает их по fire() */
function fakeMap() {
  const listeners = new Map<string, Set<() => void>>()
  const map: MovingEventSource & { fire: (type: string) => void; count: () => number } = {
    on: (type, fn) => { (listeners.get(type) ?? listeners.set(type, new Set()).get(type)!).add(fn) },
    off: (type, fn) => { listeners.get(type)?.delete(fn) },
    fire: (type) => listeners.get(type)?.forEach((fn) => fn()),
    count: () => [...listeners.values()].reduce((n, s) => n + s.size, 0),
  }
  return map
}

describe('bindMapMovingClass: плотное стекло на время движения карты', () => {
  it('класс есть только между movestart и moveend', () => {
    const root = document.createElement('div')
    const map = fakeMap()
    bindMapMovingClass(map, root)
    expect(root.classList.contains(MAP_MOVING_CLASS)).toBe(false)
    map.fire('movestart')
    expect(root.classList.contains(MAP_MOVING_CLASS)).toBe(true)
    map.fire('moveend')
    expect(root.classList.contains(MAP_MOVING_CLASS)).toBe(false)
  })

  it('отписка снимает слушатели и класс, даже если карта остановилась на полпути', () => {
    const root = document.createElement('div')
    const map = fakeMap()
    const dispose = bindMapMovingClass(map, root)
    map.fire('movestart')
    dispose()
    expect(map.count()).toBe(0)
    expect(root.classList.contains(MAP_MOVING_CLASS)).toBe(false)
  })

  it('по умолчанию — корень документа, чтобы переменные дошли до шапки', () => {
    const map = fakeMap()
    const dispose = bindMapMovingClass(map)
    map.fire('movestart')
    expect(document.documentElement.classList.contains(MAP_MOVING_CLASS)).toBe(true)
    dispose()
    expect(document.documentElement.classList.contains(MAP_MOVING_CLASS)).toBe(false)
  })
})
