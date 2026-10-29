import { describe, expect, it } from 'vitest'
import { computePermissions, type PermissionInput } from '~/utils/permissions'
import {
  buildHeaderMenu,
  groupMenuChildren,
  HEADER_NAV_MIN_WIDTH,
  isHeaderNavCollapsed,
  type HeaderMenuItem,
} from '~/utils/headerMenu'
import { BREAKPOINTS } from '~/utils/breakpoints'

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

  it('ноутбук и десктоп — кнопки в шапке', () => {
    expect(isHeaderNavCollapsed(HEADER_NAV_MIN_WIDTH)).toBe(false)
    expect(isHeaderNavCollapsed(1280)).toBe(false)
    expect(isHeaderNavCollapsed(1600)).toBe(false)
  })

  it('ширина неизвестна (SSR) — десктопная шапка, как при гидратации', () => {
    expect(isHeaderNavCollapsed(0)).toBe(false)
  })

  it('порог не ниже фактической ширины шапки и совпадает с границей телефона', () => {
    // навигация до 615 px + «Скрыть протокол» 40 + справа лупа и две иконки 130 (замер этапа 10в)
    expect(HEADER_NAV_MIN_WIDTH).toBeGreaterThanOrEqual(615 + 40 + 130)
    expect(HEADER_NAV_MIN_WIDTH).toBe(BREAKPOINTS.md)
  })
})

describe('buildHeaderMenu: состав меню по правам', () => {
  it('без входа и viewer — всё, кроме «Расчёт»', () => {
    for (const role of ['', 'viewer']) {
      expect(ids(menuFor(role))).toEqual(['protocol', 'export', 'tools'])
    }
  })

  it('calculator, editor, admin — «Расчёт» первым', () => {
    for (const role of ['calculator', 'editor', 'admin']) {
      expect(ids(menuFor(role))).toEqual(['calculation', 'protocol', 'export', 'tools'])
    }
  })

  it('«Карты» нет — страница одна; «Инструменты» — иконкой справа, остальное — в навигации', () => {
    const menu = menuFor('admin')
    expect(ids(menu)).not.toContain('map')
    expect(menu.filter((i) => i.placement === 'end').map((i) => i.id)).toEqual(['tools'])
  })

  it('AUTH_DISABLED — сервер считает всех admin, «Расчёт» есть', () => {
    expect(ids(menuFor('', { authDisabled: true }))).toContain('calculation')
  })

  it('«Расчёт» не зависит от MUTATIONS_ENABLED (как кнопка в шапке)', () => {
    expect(ids(menuFor('calculator', { mutationsEnabled: false }))).toContain('calculation')
  })

  it('«Выгрузка» — одно подменю со всеми форматами и ведомостями, по подгруппам', () => {
    const exportItem = menuFor('viewer').find((i) => i.id === 'export')!
    expect(exportItem.title).toBe('Выгрузка')
    const geo = exportItem.children!.filter((c) => c.group === 'Геоданные')
    const excel = exportItem.children!.filter((c) => c.group === 'Ведомости Excel')
    expect(geo.map((c) => c.action)).toEqual([
      { kind: 'export', format: 'gpkg' },
      { kind: 'export', format: 'fgb' },
      { kind: 'export', format: 'shp' },
      { kind: 'export', format: 'dxf' },
      { kind: 'export', format: 'geojson' },
      { kind: 'export', format: 'geojson-attrs' },
    ])
    expect(excel.map((c) => c.action)).toEqual(
      ['ut', 'zd', 'bp', 'ns', 'pt', 'tu'].map((docType) => ({ kind: 'excel', docType })),
    )
    expect(geo.length + excel.length).toBe(exportItem.children!.length)
  })

  it('подпись протокола зависит от того, открыт ли он', () => {
    const p = computePermissions({ ...base, role: 'viewer' })
    expect(buildHeaderMenu(p).find((i) => i.id === 'protocol')!.title).toBe('Протокол')
    expect(buildHeaderMenu(p, { protocolOpen: true }).find((i) => i.id === 'protocol')!.title)
      .toBe('Скрыть протокол')
  })
})

describe('groupMenuChildren: подгруппы подменю', () => {
  it('«Выгрузка» — две подгруппы по порядку', () => {
    const exportItem = buildHeaderMenu({ canCalculate: false }).find((i) => i.id === 'export')!
    const groups = groupMenuChildren(exportItem.children!)
    expect(groups.map((g) => [g.title, g.items.length])).toEqual([['Геоданные', 6], ['Ведомости Excel', 6]])
  })

  it('пункты без группы — одна группа без заголовка', () => {
    const items = [{ id: 'a', title: 'A', icon: 'x' }, { id: 'b', title: 'B', icon: 'x' }]
    expect(groupMenuChildren(items)).toEqual([{ title: undefined, items }])
  })
})
