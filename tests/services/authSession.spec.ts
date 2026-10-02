import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ApiError, fastApiService, setUnauthorizedHandler } from '~/services/fastApiService'
import { BAD_CREDENTIALS_TEXT, SESSION_EXPIRED_TEXT } from '~/utils/apiError'
import { useAuthStore } from '~/stores/authStore'
import { useNotificationStore } from '~/stores/notificationStore'
import { isJwtExpired, jwtExpiresAt } from '~/utils/jwt'

const TOKEN_KEY = 'itwin_access_token'

const fetchError = (status: number, data: any) =>
  Object.assign(new Error(`[GET] "https://api.example.test/x": ${status}`), { name: 'FetchError', status, statusCode: status, data })

const jwt = (exp: number) =>
  `h.${btoa(JSON.stringify({ sub: 'u', exp })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.s`

describe('401 и истечение сессии (QA F71, F72)', () => {
  const fetchMock = vi.fn()
  const onUnauthorized = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    onUnauthorized.mockReset()
    vi.stubGlobal('$fetch', fetchMock)
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { mapApiBaseUrl: 'https://api.example.test/' } }))
    setUnauthorizedHandler(onUnauthorized)
    localStorage.clear()
  })

  afterEach(() => {
    setUnauthorizedHandler(null)
    localStorage.clear()
  })

  it('401 при отправленном токене: обработчик сессии и текст «Сессия истекла»', async () => {
    localStorage.setItem(TOKEN_KEY, 'expired')
    fetchMock.mockRejectedValue(fetchError(401, { detail: 'Token expired' }))
    const error = await fastApiService.authMe().catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.userMessage).toBe(SESSION_EXPIRED_TEXT)
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('401 без токена — обработчик сессии не вызывается', async () => {
    fetchMock.mockRejectedValue(fetchError(401, { detail: 'Not authenticated' }))
    const error = await fastApiService.authMe().catch((e) => e)
    expect(error.status).toBe(401)
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('неверный пароль: «Неверный логин или пароль», сессия не сбрасывается', async () => {
    localStorage.setItem(TOKEN_KEY, 'old')
    fetchMock.mockRejectedValue(fetchError(401, { detail: 'Invalid credentials' }))
    const error = await fastApiService.login('qa', 'wrong').catch((e) => e)
    expect(error.userMessage).toBe(BAD_CREDENTIALS_TEXT)
    expect(onUnauthorized).not.toHaveBeenCalled()
  })
})

describe('blob-ответы с ошибкой (QA F22)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('$fetch', fetchMock)
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { mapApiBaseUrl: 'https://api.example.test/' } }))
  })

  it('detail сервера из Blob, без URL; запрос не повторяется', async () => {
    const body = new Blob([JSON.stringify({ detail: 'Фрагмент 999 не найден' })], { type: 'application/json' })
    fetchMock.mockRejectedValue(fetchError(404, body))
    const error = await fastApiService.downloadDxfExport([999]).catch((e) => e)
    expect(error.userMessage).toBe('Фрагмент 999 не найден')
    expect(error.userMessage).not.toContain('http')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ retry: 0, responseType: 'blob' })
  })

  it('5xx у blob тоже без повторов и без сырого URL', async () => {
    fetchMock.mockRejectedValue(fetchError(500, new Blob(['<html>err</html>'], { type: 'text/html' })))
    const error = await fastApiService.downloadDxfExport([1]).catch((e) => e)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(error.userMessage).toBe('Ошибка на сервере (500). Попробуйте позже.')
  })
})

describe('authStore: сброс сессии', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('expireSession: выход, предупреждение с кнопкой «Войти» и запрос формы входа', () => {
    const auth = useAuthStore()
    const notes = useNotificationStore()
    auth.setSession('token', 'qa_user', 'editor')
    auth.expireSession()
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.canEdit).toBe(false)
    expect(notes.type).toBe('warning')
    expect(notes.message).toBe(SESSION_EXPIRED_TEXT)
    expect(notes.action?.label).toBe('Войти')
    expect(auth.loginPrompt).toBe(1)
    expect(auth.lastUsername).toBe('qa_user')
    // повторный 401 от параллельного запроса — без второго уведомления
    auth.expireSession()
    expect(auth.loginPrompt).toBe(1)
  })

  it('checkTokenExpiry: истёкший exp сбрасывает сессию, живой — нет', () => {
    const auth = useAuthStore()
    auth.setSession(jwt(Math.floor(Date.now() / 1000) + 3600), 'qa_user', 'editor')
    auth.checkTokenExpiry()
    expect(auth.isAuthenticated).toBe(true)
    auth.setSession(jwt(Math.floor(Date.now() / 1000) - 60), 'qa_user', 'editor')
    auth.checkTokenExpiry()
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.loginPrompt).toBe(1)
  })

  it('AUTH_DISABLED: токен сбрасывается молча, без формы входа', () => {
    const auth = useAuthStore()
    auth.authDisabled = true
    auth.setSession('token', 'dev', 'admin')
    auth.expireSession()
    expect(auth.accessToken).toBe('')
    expect(auth.loginPrompt).toBe(0)
  })

  it('refreshMe: сетевая ошибка не выходит из учётной записи, 401 — выходит', async () => {
    const auth = useAuthStore()
    auth.setSession('token', 'qa_user', 'editor')
    const spy = vi.spyOn(fastApiService, 'authMe')
    spy.mockRejectedValueOnce(new ApiError({ status: 0, detail: '', path: 'api/v1/auth/me', userMessage: 'нет сети' }))
    await auth.refreshMe()
    expect(auth.isAuthenticated).toBe(true)
    spy.mockRejectedValueOnce(new ApiError({ status: 401, detail: '', path: 'api/v1/auth/me', userMessage: 'x' }))
    await auth.refreshMe()
    expect(auth.isAuthenticated).toBe(false)
    spy.mockRestore()
  })
})

describe('jwt exp (QA F71)', () => {
  const token = (payload: object) =>
    `h.${btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.s`

  it('читает exp и сравнивает с текущим временем', () => {
    const now = 1_800_000_000_000
    expect(jwtExpiresAt(token({ exp: 1_800_000_100 }))).toBe(1_800_000_100_000)
    expect(isJwtExpired(token({ exp: 1_800_000_100 }), now)).toBe(false)
    expect(isJwtExpired(token({ exp: 1_799_999_000 }), now)).toBe(true)
  })

  it('без exp или не JWT — не считается истёкшим', () => {
    expect(isJwtExpired(token({ sub: 'u' }))).toBe(false)
    expect(isJwtExpired('not-a-jwt')).toBe(false)
    expect(isJwtExpired('')).toBe(false)
  })
})
