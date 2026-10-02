import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  describeNetworkExportTruncation,
  fastApiService,
  parseNetworkExportMeta,
} from '../../services/fastApiService'

const BASE = 'https://api.example.test/'

describe('выгрузки сети: DXF фоном, предупреждение об обрезке (QA F77, F84)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('$fetch', fetchMock)
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { mapApiBaseUrl: BASE } }))
  })

  it('разбирает X-Export-* и пишет предупреждение только при обрезке', () => {
    const cut = new Headers({ 'X-Export-Rows': '50000', 'X-Export-Limit': '50000', 'X-Export-Truncated': '1' })
    const meta = parseNetworkExportMeta((n) => cut.get(n))
    expect(meta).toEqual({ rows: 50000, limit: 50000, truncated: true })
    expect(describeNetworkExportTruncation('SHP', meta)).toContain('выгрузка неполная')
    const full = new Headers({ 'X-Export-Rows': '12', 'X-Export-Limit': '50000', 'X-Export-Truncated': '0' })
    expect(describeNetworkExportTruncation('SHP', parseNetworkExportMeta((n) => full.get(n)))).toBeNull()
    expect(parseNetworkExportMeta(() => null)).toBeUndefined()
  })

  it('DXF идёт задачей file-job network_dxf и возвращает признак обрезки', async () => {
    const blob = new Blob(['0\nSECTION'])
    fetchMock.mockImplementation(async (url: string, opts: any) => {
      if (url === `${BASE}api/v1/file-jobs`) {
        expect(opts.body).toEqual({ kind: 'network_dxf', params: { fragments: [74] } })
        return { task_id: 'd1' }
      }
      if (url === `${BASE}api/v1/file-jobs/d1`) return { task_id: 'd1', state: 'SUCCESS', ready: true, success: true, message: null, filename: 'network_f74.dxf' }
      if (url === `${BASE}api/v1/file-jobs/d1/download`) {
        opts.onResponse?.({ response: { headers: new Headers({ 'X-Export-Truncated': '0', 'X-Export-Rows': '3821', 'X-Export-Limit': '50000' }) } })
        return blob
      }
      throw new Error(`unexpected ${url}`)
    })
    const res = await fastApiService.downloadDxfExport([74], { pollMs: 1 })
    expect(res.blob).toBe(blob)
    expect(res.filename).toBe('network_f74.dxf')
    expect(res.meta).toEqual({ rows: 3821, limit: 50000, truncated: false })
  })
})
