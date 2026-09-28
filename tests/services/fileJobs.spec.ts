import { beforeEach, describe, expect, it, vi } from 'vitest'
import { describeFileJobProgress, fastApiService } from '../../services/fastApiService'

const BASE = 'https://api.example.test/'

describe('fastApiService: фоновые файлы (задача → статус → скачивание)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('$fetch', fetchMock)
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { mapApiBaseUrl: BASE } }))
  })

  it('паспорт: ставит задачу, опрашивает статус и скачивает файл с именем из Content-Disposition', async () => {
    const statuses = [
      { task_id: 't1', state: 'PENDING', ready: false, success: null, message: null },
      { task_id: 't1', state: 'PROGRESS', ready: false, success: null, message: 'Формирование файла' },
      { task_id: 't1', state: 'SUCCESS', ready: true, success: true, message: null, filename: 'Passport_ms_5.xlsx' },
    ]
    const blob = new Blob(['PK'])
    fetchMock.mockImplementation(async (url: string, opts: any) => {
      if (url === `${BASE}api/v1/file-jobs`) return { task_id: 't1' }
      if (url === `${BASE}api/v1/file-jobs/t1`) return statuses.shift()
      if (url === `${BASE}api/v1/file-jobs/t1/download`) {
        opts.onResponse({ response: { headers: new Headers({
          'content-disposition': "attachment; filename=\"Passport_ms_5.xlsx\"; filename*=UTF-8''%D0%9F%D0%B0%D1%81%D0%BF%D0%BE%D1%80%D1%82.xlsx",
        }) } })
        return blob
      }
      throw new Error(`unexpected ${url}`)
    })
    const phases: string[] = []
    const res = await fastApiService.downloadObjectPassport('nodes', 42, {
      pollMs: 0,
      onProgress: (p) => phases.push(p.phase),
    })
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', body: { kind: 'passport', params: { table: 'nodes', obj_id: 42 } } })
    expect(res.blob).toBe(blob)
    expect(res.filename).toBe('Паспорт.xlsx')
    expect(phases).toEqual(['queued', 'queued', 'running', 'downloading'])
  })

  it('ошибка построения из статуса задачи доходит до вызывающего', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('api/v1/file-jobs')) return { task_id: 't2' }
      return { task_id: 't2', state: 'SUCCESS', ready: true, success: false, message: 'Узел не найден' }
    })
    await expect(fastApiService.downloadObjectPassport('nodes', 1, { pollMs: 0 })).rejects.toThrow('Узел не найден')
  })

  it('старый API без file-jobs (404) — синхронный эндпоинт', async () => {
    const blob = new Blob(['x'])
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('api/v1/file-jobs')) throw Object.assign(new Error('nf'), { status: 404, response: { status: 404 } })
      if (url.endsWith('api/reports/excel/tu-balance')) return blob
      throw new Error(`unexpected ${url}`)
    })
    const res = await fastApiService.downloadExcelReport('tu-balance', { year: 2025 }, { pollMs: 0 })
    expect(res).toEqual({ blob, filename: 'report_tu-balance_2025.xlsx' })
  })

  it('воркер не взял задачу — переход на синхронный эндпоинт', async () => {
    const blob = new Blob(['y'])
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('api/v1/file-jobs')) return { task_id: 't3' }
      if (url.endsWith('api/v1/file-jobs/t3')) return { task_id: 't3', state: 'PENDING', ready: false, success: null, message: null }
      if (url.endsWith('api/alseko/reconciliation/report.xlsx')) return blob
      throw new Error(`unexpected ${url}`)
    })
    const res = await fastApiService.downloadAlsekoReconciliationReport(undefined, { pollMs: 0, pendingFallbackMs: -1 })
    expect(res).toBe(blob)
  })

  it('текст прогресса', () => {
    expect(describeFileJobProgress({ phase: 'running', message: 'Формирование файла…', elapsedMs: 7400 })).toBe('Формирование файла… 7 с')
    expect(describeFileJobProgress(null)).toBe('')
  })
})
