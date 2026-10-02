import { describe, expect, it } from 'vitest'
import { computePermissions, type PermissionInput } from '~/utils/permissions'
import {
  buildHeaderMenu,
  HEADER_NAV_MIN_WIDTH,
  isHeaderNavCollapsed,
  type HeaderMenuItem,
} from '~/utils/headerMenu'

const base: PermissionInput = {
  role: '',
  authDisabled: false,
  mutationsEnabled: true,
  topologyMutationsEnabled: true,
}

const ids = (items: HeaderMenuItem[]) => items.map((i) => i.id)
const menuFor = (role: string, extra: Partial<PermissionInput> = {}) =>
  buildHeaderMenu(computePermissions({ ...base, role, ...extra }))

describe('isHeaderNavCollapsed: порог гамбургера (QA F1, F57)', () => {
  it('телефон и планшет в портрете — меню, шапка не обрезается', () => {
    expect(isHeaderNavCollapsed(375)).toBe(true)
    expect(isHeaderNavCollapsed(768)).toBe(true)
    expect(isHeaderNavCollapsed(820)).toBe(true)
    expect(isHeaderNavCollapsed(HEADER_NAV_MIN_WIDTH - 1)).toBe(true)
  })

  it('планшет в альбомной ориентации и десктоп — кнопки в шапке', () => {
    expect(isHeaderNavCollapsed(HEADER_NAV_MIN_WIDTH)).toBe(false)
    expect(isHeaderNavCollapsed(1024)).toBe(false)
    expect(isHeaderNavCollapsed(1600)).toBe(false)
  })

  it('ширина неизвестна (SSR) — десктопная шапка, как при гидратации', () => {
    expect(isHeaderNavCollapsed(0)).toBe(false)
  })

  it('порог не ниже фактической ширины шапки: брендинг 133 + пункты 765 + аватар 56', () => {
    expect(HEADER_NAV_MIN_WIDTH).toBeGreaterThanOrEqual(133 + 765 + 56)
    expect(HEADER_NAV_MIN_WIDTH).toBeLessThanOrEqual(1024)
  })
})

describe('buildHeaderMenu: состав меню по правам', () => {
  it('без входа и viewer — всё, кроме «Расчёт»', () => {
    for (const role of ['', 'viewer']) {
      expect(ids(menuFor(role))).toEqual(['map', 'protocol', 'tools', 'export', 'excel'])
    }
  })

  it('calculator, editor, admin — с «Расчёт» сразу после «Карты»', () => {
    for (const role of ['calculator', 'editor', 'admin']) {
      expect(ids(menuFor(role))).toEqual(['map', 'calculation', 'protocol', 'tools', 'export', 'excel'])
    }
  })

  it('AUTH_DISABLED — сервер считает всех admin, «Расчёт» есть', () => {
    expect(ids(menuFor('', { authDisabled: true }))).toContain('calculation')
  })

  it('«Расчёт» не зависит от MUTATIONS_ENABLED (как кнопка в шапке)', () => {
    expect(ids(menuFor('calculator', { mutationsEnabled: false }))).toContain('calculation')
  })

  it('экспорт и ведомости — подменю со всеми форматами, как в шапке', () => {
    const menu = menuFor('viewer')
    const exportItem = menu.find((i) => i.id === 'export')!
    const excelItem = menu.find((i) => i.id === 'excel')!
    expect(exportItem.children!.map((c) => c.action)).toEqual([
      { kind: 'export', format: 'shp' },
      { kind: 'export', format: 'dxf' },
      { kind: 'export', format: 'geojson' },
      { kind: 'export', format: 'geojson-attrs' },
    ])
    expect(excelItem.children!.map((c) => c.action)).toEqual(
      ['ut', 'zd', 'bp', 'ns', 'pt', 'tu'].map((docType) => ({ kind: 'excel', docType })),
    )
  })

  it('подпись протокола зависит от того, открыт ли он', () => {
    const p = computePermissions({ ...base, role: 'viewer' })
    expect(buildHeaderMenu(p).find((i) => i.id === 'protocol')!.title).toBe('Протокол')
    expect(buildHeaderMenu(p, { protocolOpen: true }).find((i) => i.id === 'protocol')!.title)
      .toBe('Скрыть протокол')
  })
})
