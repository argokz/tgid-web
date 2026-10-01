import { describe, expect, it } from 'vitest'
import { resolveMdiSvgPath } from '~/utils/mdiSvgPaths'
import {
  TOPOLOGY_FAULT_META,
  topologyFaultCounts,
  topologyFaultMeta,
  topologyFaultTitle,
} from '~/utils/topologyDiagnostics'

describe('topologyDiagnostics (QA F35)', () => {
  it('подписи по типам и запасной вариант', () => {
    expect(topologyFaultTitle({ type: 'orphaned_node', object_type: 'node', object_id: 5 }))
      .toBe('Изолированный узел: узел #5')
    expect(topologyFaultTitle({ type: 'dangling_line', object_type: 'line', object_id: 7 }))
      .toBe('Участок на снятый узел: участок #7')
    expect(topologyFaultMeta('unknown').icon).toBe('mdi-alert')
  })

  it('счётчики: только ненулевые, в порядке сервера', () => {
    const rows = topologyFaultCounts({ dangling_line: 1, zero_length_line: 0, orphaned_node: 22 })
    expect(rows.map(r => [r.type, r.count])).toEqual([['dangling_line', 1], ['orphaned_node', 22]])
    expect(topologyFaultCounts(undefined)).toEqual([])
  })

  it('все иконки есть в mdiSvgPaths', () => {
    for (const meta of [...Object.values(TOPOLOGY_FAULT_META), topologyFaultMeta('x')]) {
      expect(resolveMdiSvgPath(meta.icon), meta.icon).toBeTruthy()
    }
  })
})
