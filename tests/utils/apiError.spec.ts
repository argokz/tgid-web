import { describe, expect, it } from 'vitest'
import { ApiError } from '~/services/fastApiService'
import {
  BAD_CREDENTIALS_TEXT,
  NETWORK_ERROR_TEXT,
  formatApiError,
  formatApiErrorWith,
  serverDetailText,
  statusMessage,
} from '~/utils/apiError'

const apiError = (status: number, userMessage: string, data: any = null) =>
  new ApiError({ status, detail: userMessage, path: 'api/x', userMessage, data })

/** «Сырая» ошибка ofetch: message с URL, статус и тело ответа */
const fetchError = (status: number, data: any) =>
  Object.assign(new Error(`[GET] "http://127.0.0.1:8040/api/x": ${status} Internal Server Error`), {
    name: 'FetchError',
    status,
    statusCode: status,
    data,
  })

describe('formatApiError (QA F61)', () => {
  it('ApiError: показывает userMessage', () => {
    expect(formatApiError(apiError(404, 'Паспорт не найден'), 'x')).toBe('Паспорт не найден')
  })

  it('ApiError с сырым текстом ofetch → текст по статусу', () => {
    expect(formatApiError(apiError(500, '[GET] "http://h/api": 500'))).toBe('Ошибка на сервере (500). Попробуйте позже.')
  })

  it('сырая ошибка $fetch: detail сервера вместо URL', () => {
    const text = formatApiError(fetchError(500, { detail: 'Нет связи с БД' }))
    expect(text).toBe('Ошибка на сервере: Нет связи с БД')
    expect(text).not.toContain('http')
  })

  it('сырая ошибка $fetch без тела: понятный текст по статусу', () => {
    expect(formatApiError(fetchError(403, undefined))).toBe('Недостаточно прав для этой операции.')
    expect(formatApiError(fetchError(401, undefined))).toBe('Требуется вход в систему.')
    expect(formatApiError(fetchError(409, { detail: { message: 'Запись изменена' } }))).toBe('Запись изменена')
    expect(formatApiError(fetchError(502, '<html>Bad gateway</html>'))).not.toContain('<html>')
  })

  it('сетевая ошибка браузера → «Сервер API недоступен»', () => {
    expect(formatApiError(new TypeError('Failed to fetch'))).toBe(NETWORK_ERROR_TEXT)
  })

  it('обычная Error — её текст; пусто — fallback', () => {
    expect(formatApiError(new Error('Воркер не взял задачу'))).toBe('Воркер не взял задачу')
    expect(formatApiError(null, 'Не удалось')).toBe('Не удалось')
    expect(formatApiError({}, 'Не удалось')).toBe('Не удалось')
    expect(formatApiError('  ', 'Не удалось')).toBe('Не удалось')
  })

  it('formatApiErrorWith: префикс и непустой fallback', () => {
    expect(formatApiErrorWith('Экспорт DXF', fetchError(404, { detail: 'Фрагмент не найден' })))
      .toBe('Экспорт DXF: Фрагмент не найден')
    expect(formatApiErrorWith('Экспорт', {}, '')).toBe('Экспорт: ошибка сервера')
  })

  it('serverDetailText: строка, объект с message/reason, список pydantic', () => {
    expect(serverDetailText({ detail: 'Not Found' })).toBe('')
    expect(serverDetailText({ detail: { message: 'Нельзя', reason: 'утверждено' } })).toBe('Нельзя — утверждено')
    expect(serverDetailText({ detail: [{ loc: ['body', 'fragment_id'], msg: 'field required' }] }))
      .toBe('fragment_id: field required')
  })

  it('statusMessage: 422 и 5xx с detail и без', () => {
    expect(statusMessage(422, 'id')).toBe('Некорректные параметры запроса: id')
    expect(statusMessage(0)).toBe(NETWORK_ERROR_TEXT)
    expect(statusMessage(503)).toContain('503')
    expect(BAD_CREDENTIALS_TEXT).toMatch(/Неверный логин или пароль/)
  })
})
