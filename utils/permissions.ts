/**
 * Права интерфейса: роль пользователя + серверные флаги из /auth/config.
 * Сервер проверяет то же самое сам; здесь — только чтобы не показывать кнопки,
 * которые всё равно закончатся 401/403/503.
 *
 * Роли (как auth.ROLE_ORDER на сервере): viewer < calculator < editor < admin.
 * При AUTH_DISABLED сервер считает любой запрос «dev admin» — интерфейс тоже.
 */

export type Role = 'viewer' | 'calculator' | 'editor' | 'admin'

export const ROLE_ORDER: Record<Role, number> = { viewer: 1, calculator: 2, editor: 3, admin: 4 }

export const ROLE_LABELS: Record<Role, string> = {
  viewer: 'Просмотр',
  calculator: 'Расчётчик',
  editor: 'Редактор',
  admin: 'Администратор',
}

export interface PermissionInput {
  role: string
  authDisabled: boolean
  mutationsEnabled: boolean
  topologyMutationsEnabled: boolean
}

export interface Permissions {
  /** Роль, с которой сервер обработает запрос ('' — не вошёл) */
  role: Role | ''
  isAuthenticated: boolean
  /** Запуск расчётов sety, калькуляторы с записью результатов в *_out */
  canCalculate: boolean
  /** Роль editor+ (без учёта флага сервера) */
  canEdit: boolean
  /** Правка журналов и атрибутов: editor+ и MUTATIONS_ENABLED */
  canEditData: boolean
  /** Расчёты, пишущие в БД сверх *_out (теплопотери, -save_po, -dross_yes), удаление расчётов */
  canRunWritingCalc: boolean
  /** Редактор топологии: admin + MUTATIONS_ENABLED + TOPOLOGY_MUTATIONS_ENABLED */
  canEditTopology: boolean
  /** Управление пользователями */
  isAdmin: boolean
  /** История правок (audit_log) — любой вошедший */
  canViewHistory: boolean
}

export function effectiveRole(role: string, authDisabled: boolean): Role | '' {
  if (authDisabled) return 'admin'
  return role in ROLE_ORDER ? (role as Role) : ''
}

export function roleAtLeast(role: Role | '', minimum: Role): boolean {
  return role !== '' && ROLE_ORDER[role] >= ROLE_ORDER[minimum]
}

export function computePermissions(input: PermissionInput): Permissions {
  const role = effectiveRole(input.role, input.authDisabled)
  const canCalculate = roleAtLeast(role, 'calculator')
  const canEdit = roleAtLeast(role, 'editor')
  const isAdmin = roleAtLeast(role, 'admin')
  return {
    role,
    isAuthenticated: role !== '',
    canCalculate,
    canEdit,
    canEditData: canEdit && input.mutationsEnabled,
    canRunWritingCalc: canCalculate && input.mutationsEnabled,
    canEditTopology: isAdmin && input.mutationsEnabled && input.topologyMutationsEnabled,
    isAdmin,
    canViewHistory: role !== '',
  }
}

/** Минимальная роль для пункта каталога инструментов */
export interface RequiresRole {
  requires?: Role
}

export function isToolVisible(tool: RequiresRole, permissions: Permissions): boolean {
  return !tool.requires || roleAtLeast(permissions.role, tool.requires)
}

export function filterByRole<G extends { items: I[] }, I extends RequiresRole>(
  groups: G[],
  permissions: Permissions
): G[] {
  return groups
    .map((g) => ({ ...g, items: g.items.filter((i) => isToolVisible(i, permissions)) }))
    .filter((g) => g.items.length > 0)
}

/** Поля запроса расчёта, после которых sety пишет в исходные таблицы (как SOURCE_WRITE_FLAGS API) */
export interface SourceWriteFields {
  save_po?: boolean
  save_leto?: boolean
  dross_yes?: boolean
  save_uf_new?: boolean
}

/** Запрос расчёта пишет исходные данные: сервер потребует MUTATIONS_ENABLED */
export function requestWritesSourceData(req: SourceWriteFields): boolean {
  return Boolean(req.save_po || req.save_leto || req.dross_yes || req.save_uf_new)
}

/**
 * -save_po (плановый «Запись тепловых нагрузок…» или летний «Запись летних сопротивлений…»):
 * во фрагменте с обобщёнными потребителями sety перезаписывает нагрузки магистрали нулями
 * (так же на десктопе, docs/acceptance-numeric.md) — перед запуском нужно подтверждение.
 */
export function requestSavesPo(req: SourceWriteFields): boolean {
  return Boolean(req.save_po || req.save_leto)
}
