import { describe, expect, it } from 'vitest'
import {
  canEditFragment,
  computePermissions,
  filterByRole,
  type PermissionInput,
} from '~/utils/permissions'
import { TOOL_GROUPS } from '~/utils/toolCatalog'
import { authorLabel } from '~/utils/auditAuthor'

// Права через роли PostgreSQL (AUTH_BACKEND=pg, docs/pg-auth.md): как auth.AuthUser.allows на сервере
const pg = (role: string, caps: string[] = [], fragments: number[] | null = null): PermissionInput => ({
  role, caps, fragments, pgUser: true,
  authDisabled: false, mutationsEnabled: true, topologyMutationsEnabled: true,
})
const usersdb = (role: string): PermissionInput => ({
  role, authDisabled: false, mutationsEnabled: true, topologyMutationsEnabled: true,
})

const toolEvents = (input: PermissionInput) =>
  filterByRole(TOOL_GROUPS, computePermissions(input)).flatMap((g) => g.items.map((i) => i.event))

describe('права пользователей PostgreSQL', () => {
  it('режимщик десктопа (calculator + сеть) правит оборудование, но не журналы и не топологию', () => {
    const p = computePermissions(pg('calculator', ['network'], [74]))
    expect(p.canEditNetwork).toBe(true)
    expect(p.canEditData).toBe(false)
    expect(p.canEditTopology).toBe(false)
    expect(p.canEditRepairs).toBe(false)
    expect(p.fragments).toEqual([74])
  })

  it('редактор без предметных прав правит журналы, но не оборудование, ремонты и ПТС', () => {
    const p = computePermissions(pg('editor'))
    expect(p.canEditData).toBe(true)
    expect(p.canEditNetwork || p.canEditRepairs || p.canEditPts || p.canEditCorrosion).toBe(false)
  })

  it('добавление/удаление объектов сети открывает редактор топологии (при флагах сервера)', () => {
    expect(computePermissions(pg('calculator', ['network', 'network_struct'])).canEditTopology).toBe(true)
    expect(computePermissions({ ...pg('calculator', ['network_struct']), topologyMutationsEnabled: false })
      .canEditTopology).toBe(false)
  })

  it('администратор — все права и вся сеть, территория не ограничивает', () => {
    const p = computePermissions(pg('admin', [], [74]))
    expect(p.canEditNetwork && p.canEditRepairs && p.canEditPts && p.canEditTopology).toBe(true)
    expect(p.fragments).toBeNull()
  })

  it('пользователи UsersDB — как раньше, по роли', () => {
    const editor = computePermissions(usersdb('editor'))
    expect(editor.canEditNetwork && editor.canEditRepairs && editor.canEditPts).toBe(true)
    expect(editor.canEditTopology).toBe(false) // топология — admin
    expect(computePermissions(usersdb('admin')).canEditTopology).toBe(true)
  })

  it('MUTATIONS_ENABLED=false закрывает всё', () => {
    const p = computePermissions({ ...pg('admin'), mutationsEnabled: false })
    expect(p.canEditNetwork || p.canEditData || p.canEditTopology).toBe(false)
  })
})

describe('каталог инструментов: предметные права', () => {
  it('групповые установщики — право сети, импорт — добавление/удаление', () => {
    expect(toolEvents(pg('calculator', ['network']))).toContain('open-group-setters')
    expect(toolEvents(pg('calculator', ['network']))).not.toContain('open-network-import')
    expect(toolEvents(pg('editor'))).not.toContain('open-group-setters')
    expect(toolEvents(pg('viewer', ['network', 'network_struct']))).toContain('open-network-import')
    expect(toolEvents(usersdb('editor'))).toContain('open-group-setters')
  })
})

describe('территория', () => {
  it('объект своего фрагмента или без фрагмента — можно, чужого — нельзя', () => {
    const p = computePermissions(pg('editor', ['network'], [74, 89]))
    expect(canEditFragment(p, 74)).toBe(true)
    expect(canEditFragment(p, null)).toBe(true)
    expect(canEditFragment(p, 72)).toBe(false)
    expect(canEditFragment(computePermissions(pg('editor', ['network'])), 72)).toBe(true)
  })
})

describe('автор в истории правок', () => {
  it('роль пользователя → логин, группы и прочее — как есть или подпись', () => {
    expect(authorLabel('tgid_u_Иванов Иван')).toBe('Иванов Иван')
    expect(authorLabel('tgid_admin')).toContain('администратор')
    expect(authorLabel('postgres')).toBe('postgres')
    expect(authorLabel(null)).toBe('—')
  })
})
