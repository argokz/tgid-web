import { describe, expect, it, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  computePermissions,
  filterByRole,
  requestSavesPo,
  requestWritesSourceData,
  type PermissionInput,
} from '~/utils/permissions'
import { TOOL_GROUPS } from '~/utils/toolCatalog'
import { useAuthStore } from '~/stores/authStore'

const base: PermissionInput = {
  role: '',
  authDisabled: false,
  mutationsEnabled: true,
  topologyMutationsEnabled: true,
}

const toolEvents = (role: string, extra: Partial<PermissionInput> = {}) =>
  filterByRole(TOOL_GROUPS, computePermissions({ ...base, role, ...extra }))
    .flatMap((g) => g.items.map((i) => i.event))

describe('computePermissions: роль × флаги сервера', () => {
  it('без входа при включённой аутентификации — ничего не меняет и не считает', () => {
    const p = computePermissions(base)
    expect(p).toMatchObject({
      role: '', isAuthenticated: false, canCalculate: false, canEditData: false,
      canRunWritingCalc: false, canEditTopology: false, isAdmin: false, canViewHistory: false,
    })
  })

  it('viewer видит историю, но не считает и не правит', () => {
    const p = computePermissions({ ...base, role: 'viewer' })
    expect(p.canViewHistory).toBe(true)
    expect(p.canCalculate || p.canEditData || p.canRunWritingCalc || p.isAdmin).toBe(false)
  })

  it('calculator считает; запись (теплопотери, удаление расчётов) — только при MUTATIONS_ENABLED', () => {
    expect(computePermissions({ ...base, role: 'calculator' })).toMatchObject({
      canCalculate: true, canRunWritingCalc: true, canEditData: false, canEditTopology: false,
    })
    expect(computePermissions({ ...base, role: 'calculator', mutationsEnabled: false })).toMatchObject({
      canCalculate: true, canRunWritingCalc: false,
    })
  })

  it('editor правит журналы только при MUTATIONS_ENABLED, топологию — никогда', () => {
    expect(computePermissions({ ...base, role: 'editor' })).toMatchObject({ canEditData: true, canEditTopology: false })
    expect(computePermissions({ ...base, role: 'editor', mutationsEnabled: false }).canEditData).toBe(false)
  })

  it('admin: топология требует оба серверных флага', () => {
    expect(computePermissions({ ...base, role: 'admin' }).canEditTopology).toBe(true)
    expect(computePermissions({ ...base, role: 'admin', topologyMutationsEnabled: false }).canEditTopology).toBe(false)
    expect(computePermissions({ ...base, role: 'admin', mutationsEnabled: false }).canEditTopology).toBe(false)
  })

  it('AUTH_DISABLED: сервер считает всех dev admin — интерфейс тоже, но флаги сервера действуют', () => {
    const p = computePermissions({ ...base, authDisabled: true, mutationsEnabled: false })
    expect(p).toMatchObject({ role: 'admin', canCalculate: true, isAdmin: true, canEditData: false })
  })

  it('неизвестная роль из localStorage не даёт прав', () => {
    expect(computePermissions({ ...base, role: 'root' }).isAuthenticated).toBe(false)
  })
})

describe('каталог инструментов по ролям', () => {
  it('«Пользователи» видит только admin, «История правок» — любой вошедший', () => {
    expect(toolEvents('')).not.toContain('open-audit-history')
    expect(toolEvents('viewer')).toContain('open-audit-history')
    for (const role of ['', 'viewer', 'calculator', 'editor']) {
      expect(toolEvents(role)).not.toContain('open-users-admin')
    }
    expect(toolEvents('admin')).toContain('open-users-admin')
    expect(toolEvents('', { authDisabled: true })).toContain('open-users-admin')
  })

  it('инструменты без requires видны всем, пустые группы скрываются', () => {
    const groups = filterByRole(TOOL_GROUPS, computePermissions(base))
    expect(groups.find((g) => g.title === 'Администрирование')).toBeUndefined()
    expect(groups.find((g) => g.title === 'Исходные данные')).toBeUndefined()
    const open = TOOL_GROUPS.flatMap((g) => g.items).filter((i) => !i.requires)
    expect(groups.flatMap((g) => g.items).length).toBe(open.length)
  })

  it('групповые установщики и справочники — editor+', () => {
    for (const role of ['', 'viewer', 'calculator']) {
      expect(toolEvents(role)).not.toContain('open-group-setters')
      expect(toolEvents(role)).not.toContain('open-dictionaries')
    }
    expect(toolEvents('editor')).toContain('open-group-setters')
    expect(toolEvents('admin')).toContain('open-dictionaries')
  })
})

describe('запись исходных данных из расчёта', () => {
  it('флаги записи совпадают с SOURCE_WRITE_FLAGS сервера', () => {
    expect(requestWritesSourceData({})).toBe(false)
    for (const key of ['save_po', 'save_leto', 'dross_yes', 'save_uf_new'] as const) {
      expect(requestWritesSourceData({ [key]: true })).toBe(true)
    }
  })

  it('подтверждение -save_po: плановый save_po и летний save_leto', () => {
    expect(requestSavesPo({ save_po: true })).toBe(true)
    expect(requestSavesPo({ save_leto: true })).toBe(true)
    expect(requestSavesPo({ dross_yes: true })).toBe(false)
  })
})

describe('authStore: права по роли и флагам сервера', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('роль без токена (остаток в localStorage) не открывает кнопки', () => {
    const store = useAuthStore()
    store.role = 'admin'
    store.mutationsEnabledServer = true
    store.topologyMutationsEnabledServer = true
    expect(store.isAdmin).toBe(false)
    expect(store.canCalculate).toBe(false)
    store.accessToken = 'token'
    expect(store.isAdmin).toBe(true)
    expect(store.canEditTopology).toBe(true)
  })

  it('кнопка расчёта: calculator+; удаление/теплопотери — ещё и MUTATIONS_ENABLED', () => {
    const store = useAuthStore()
    store.setSession('token', 'ivan', 'calculator')
    expect(store.canCalculate).toBe(true)
    expect(store.canRunWritingCalc).toBe(false)
    store.mutationsEnabledServer = true
    expect(store.canRunWritingCalc).toBe(true)
    expect(store.canEditData).toBe(false)
    store.logout()
    expect(store.canCalculate).toBe(false)
  })

  it('AUTH_DISABLED без токена — dev admin', () => {
    const store = useAuthStore()
    store.authDisabled = true
    expect(store.isAdmin).toBe(true)
    expect(store.canEditData).toBe(false)
  })
})
