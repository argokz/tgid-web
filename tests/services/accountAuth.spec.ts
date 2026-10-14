import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '~/stores/authStore'
import { formatApiError } from '~/utils/apiError'

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

  it('русский текст сервера для 403 и 429 показывается как есть', () => {
    expect(formatApiError(fetchError(403, { detail: 'Текущий пароль указан неверно' }))).toBe('Текущий пароль указан неверно')
    expect(formatApiError(fetchError(403, { detail: 'Requires one of roles: admin (have viewer)' })))
      .toBe('Недостаточно прав для этой операции.')
    expect(formatApiError(fetchError(429, { detail: 'Слишком много неудачных попыток входа. Повторите через 10 мин.' })))
      .toMatch(/Повторите через 10 мин/)
  })
})
