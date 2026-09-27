import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useNotificationStore } from '../../stores/notificationStore'
import {
  countList,
  endPositionLabel,
  externalSignLineLabel,
  topologyRefLabel,
  topologyTableLabel,
} from '../../utils/topologyLabels'

describe('topology preview labels', () => {
  it('names node references by table and special columns', () => {
    expect(topologyRefLabel('realconsumers.nodeid')).toBe('Потребители')
    expect(topologyRefLabel('nodes.internalnodeid')).toBe('Узлы внутренней схемы')
    expect(topologyRefLabel('pumps.nodeid2')).toBe('Насосы (nodeid2)')
    expect(topologyRefLabel('unknown_table.nodeid')).toBe('unknown_table.nodeid')
    expect(topologyTableLabel('diaphragms')).toBe('Диафрагмы')
  })

  it('keeps only positive counts', () => {
    expect(countList({ a: 2, b: 0 })).toEqual([{ key: 'a', count: 2 }])
    expect(countList(null)).toEqual([])
  })

  it('labels external sign and end positions', () => {
    expect(externalSignLineLabel(4)).toBe('подающий-обратный')
    expect(externalSignLineLabel(null)).toBe('—')
    expect(endPositionLabel('start')).toBe('начало')
    expect(endPositionLabel('other')).toBe('не на концах')
  })
})

describe('notification store conflict action', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('offers a reload action for version conflicts and runs it once', async () => {
    const store = useNotificationStore()
    const reload = vi.fn()
    store.showConflict('Объект изменён другим пользователем', reload)
    expect(store.type).toBe('warning')
    expect(store.action?.label).toBe('Перезагрузить объект')
    await store.runAction()
    expect(reload).toHaveBeenCalledTimes(1)
    expect(store.show).toBe(false)
    expect(store.action).toBeNull()
  })

  it('plain messages clear a previous action', () => {
    const store = useNotificationStore()
    store.showConflict('x', () => {})
    store.showSuccess('ok')
    expect(store.action).toBeNull()
  })
})
