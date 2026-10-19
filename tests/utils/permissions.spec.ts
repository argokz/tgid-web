import { describe, expect, it, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  canDo,
  cardPermKind,
  computePermissions,
  diffCount,
  diffFromPreset,
  filterByRole,
  permScope,
  ROLE_PRESETS,
  requestSavesPo,
  requestWritesSourceData,
  type PermissionInput,
} from '~/utils/permissions'
import { TOOL_GROUPS } from '~/utils/toolCatalog'
import { EDITOR_TOOLS, toolAllowed } from '~/utils/editorTools'
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

  it('editor правит журналы и сеть (удаляет только свои) — при MUTATIONS_ENABLED', () => {
    const p = computePermissions({ ...base, role: 'editor' })
    expect(p).toMatchObject({ canEditData: true, canEditTopology: true, isAdmin: false })
    expect(permScope(p, 'line', 'delete')).toBe('own')
    expect(computePermissions({ ...base, role: 'editor', mutationsEnabled: false }).canEditData).toBe(false)
  })

  it('режимщик правит режимные параметры, но не сеть; оператор создаёт, удаляет свои', () => {
    const calc = computePermissions({ ...base, role: 'calculator' })
    expect(canDo(calc, 'consumer', 'edit') && canDo(calc, 'equipment', 'edit')).toBe(true)
    expect(canDo(calc, 'line', 'edit') || canDo(calc, 'line', 'create')).toBe(false)
    expect(calc).toMatchObject({ canEditNetwork: true, canEditTopology: false, canSaveCalc: true })
    const op = computePermissions({ ...base, role: 'operator' })
    expect(op).toMatchObject({ canEditTopology: true, canCalculate: false, canEditData: false })
    expect([permScope(op, 'node', 'create'), permScope(op, 'node', 'delete')]).toEqual(['all', 'own'])
  })

  it('действующие права с сервера важнее шаблона роли', () => {
    const p = computePermissions({
      ...base, role: 'viewer',
      permissions: { matrix: { line: { create: 'all' } }, general: ['audit_view'] },
    })
    expect(p).toMatchObject({ canEditTopology: true, canViewAudit: true, canCalculate: false })
    expect(permScope(p, 'node', 'create')).toBe('none')
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
    const open = TOOL_GROUPS.flatMap((g) => g.items).filter((i) => !i.requires && !i.requiresPerm)
    expect(groups.flatMap((g) => g.items).length).toBe(open.length)
  })

  it('групповые установщики — с правом правки свойств, справочники — с правом справочников', () => {
    for (const role of ['', 'viewer']) expect(toolEvents(role)).not.toContain('open-group-setters')
    // режимщик правит потребителей и оборудование — групповые установки ему нужны
    expect(toolEvents('calculator')).toContain('open-group-setters')
    for (const role of ['', 'viewer', 'calculator', 'operator']) expect(toolEvents(role)).not.toContain('open-dictionaries')
    expect(toolEvents('editor')).toContain('open-group-setters')
    expect(toolEvents('admin')).toContain('open-dictionaries')
  })

  it('журнал действий — только с правом просмотра журнала', () => {
    for (const role of ['viewer', 'calculator', 'operator', 'editor']) {
      expect(toolEvents(role)).not.toContain('open-activity-log')
    }
    expect(toolEvents('admin')).toContain('open-activity-log')
    expect(toolEvents('editor', { permissions: { matrix: {}, general: ['audit_view'] } })).toContain('open-activity-log')
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

describe('матрица прав: отличия от роли, вид карточки', () => {
  it('diffFromPreset хранит только отличия; diffCount считает их', () => {
    const preset = ROLE_PRESETS.operator
    const same = diffFromPreset(preset, preset.matrix, preset.general, ['export', 'import'])
    expect(same).toEqual({})
    expect(diffCount(same)).toBe(0)
    const matrix = { ...preset.matrix, line: { ...preset.matrix.line, delete: 'all' as const } }
    const d = diffFromPreset(preset, matrix, ['export', 'import'], ['export', 'import'])
    expect(d).toEqual({ matrix: { line: { delete: 'all' } }, general: { import: true } })
    expect(diffCount(d)).toBe(2)
  })

  it('cardPermKind: карточка → вид объекта в правах', () => {
    expect(['line', 'genconsumer', 'pumpstation', 'refill', 'damper'].map(cardPermKind))
      .toEqual(['line', 'consumer', 'source', 'regime', 'equipment'])
  })

  it('инструменты редактора по правам', () => {
    const calc = computePermissions({ ...base, role: 'calculator' })
    expect(EDITOR_TOOLS.filter((t) => toolAllowed(t.value, calc)).map((t) => t.value)).toEqual(['select'])
    const op = computePermissions({ ...base, role: 'operator' })
    expect(EDITOR_TOOLS.every((t) => toolAllowed(t.value, op))).toBe(true)
  })
})
