import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '~/stores/authStore'
import { fastApiService } from '~/services/fastApiService'
import { formatApiError } from '~/utils/apiError'
import { appStorage } from '~/utils/appStorage'

const fetchError = (status: number, data: any) =>
  Object.assign(new Error(`[POST] "https://api.example.test/x": ${status}`), { name: 'FetchError', status, statusCode: status, data })

describe('личный кабинет и обязательный вход', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { mapApiBaseUrl: 'https://api.example.test/' } }))
  })

  it('форма входа обязательна, только когда сервер требует вход и сессии нет', () => {
    const auth = useAuthStore()
    auth.authRequiredGet = true
    expect(auth.loginRequired).toBe(false) // до ответа /auth/config — не требуем
    auth.configLoaded = true
    expect(auth.loginRequired).toBe(true)
    auth.setSession('t.o.k', 'ivanov', 'viewer')
    expect(auth.loginRequired).toBe(false)
    auth.logout()
    auth.authDisabled = true
    expect(auth.loginRequired).toBe(false)
  })

  it('при входе /auth/me (cookie GeoServer) вызывается до сохранения сессии, открывающей карту', async () => {
    ;(process as any).client = true // ветка браузера authStore
    const auth = useAuthStore()
    auth.configLoaded = true
    auth.authRequiredGet = true
    const order: string[] = []
    vi.stubGlobal('$fetch', vi.fn(async (url: string) => {
      if (String(url).includes('auth/login')) return { access_token: 'h.e.s', username: 'ivanov', role: 'viewer' }
      order.push(`me:${auth.loginRequired ? 'locked' : 'open'}:${appStorage.getItem('itwin_access_token') ? 'token' : 'none'}`)
      return { sub: '5', username: 'ivanov', role: 'viewer', auth_disabled: false, mutations_enabled: false, topology_mutations_enabled: false }
    }))
    await auth.login('ivanov', 'secret-pass')
    expect(order[0]).toBe('me:locked:token')
    expect(auth.loginRequired).toBe(false)
    ;(process as any).client = undefined
  })

  it('мастер-учётка меняет пароль только на сервере', async () => {
    const auth = useAuthStore()
    auth.setSession('t.o.k', 'admin', 'admin')
    expect(auth.canChangeOwnPassword).toBe(true)
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({
      sub: 'master', username: 'admin', role: 'admin', is_master: true,
      auth_disabled: false, mutations_enabled: false, topology_mutations_enabled: false,
    }))
    await auth.refreshMe()
    expect(auth.isMaster).toBe(true)
    expect(auth.isAdmin).toBe(true)
    expect(auth.canChangeOwnPassword).toBe(false)
    auth.logout()
    expect(auth.isMaster).toBe(false)
  })

  it('токен для API — из хранилища города (Астана: astana:itwin_access_token)', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { mapApiBaseUrl: 'https://api.example.test/', storagePrefix: 'astana' } }))
    localStorage.setItem('itwin_access_token', 'almaty-token')
    localStorage.setItem('astana:itwin_access_token', 'astana-token')
    const fetchMock = vi.fn().mockResolvedValue({ sub: '1', username: 'u', role: 'viewer' })
    vi.stubGlobal('$fetch', fetchMock)
    await fastApiService.authMe()
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer astana-token')
  })

  it('русский текст сервера для 403 и 429 показывается как есть', () => {
    expect(formatApiError(fetchError(403, { detail: 'Текущий пароль указан неверно' }))).toBe('Текущий пароль указан неверно')
    expect(formatApiError(fetchError(403, { detail: 'Requires one of roles: admin (have viewer)' })))
      .toBe('Недостаточно прав для этой операции.')
    expect(formatApiError(fetchError(429, { detail: 'Слишком много неудачных попыток входа. Повторите через 10 мин.' })))
      .toMatch(/Повторите через 10 мин/)
  })
})
