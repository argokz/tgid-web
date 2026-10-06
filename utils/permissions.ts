/**
 * Права интерфейса: роль пользователя + серверные флаги из /auth/config.
 * Сервер проверяет то же самое сам; здесь — только чтобы не показывать кнопки,
 * которые всё равно закончатся 401/403/503.
 *
 * Роли (как auth.ROLE_ORDER на сервере): viewer < calculator < editor < admin.
 * При AUTH_DISABLED сервер считает любой запрос «dev admin» — интерфейс тоже.
 *
 * Пользователи PostgreSQL (AUTH_BACKEND=pg, docs/pg-auth.md) дополнительно имеют предметные права
 * (биты user_right десктопа) и территорию — фрагменты, в которых разрешена правка. Как на сервере
 * (auth.AuthUser.allows): администратор или предметное право; права и территорию проверяет БД.
 */

export type Role = 'viewer' | 'calculator' | 'editor' | 'admin'

export const ROLE_ORDER: Record<Role, number> = { viewer: 1, calculator: 2, editor: 3, admin: 4 }

export const ROLE_LABELS: Record<Role, string> = {
  viewer: 'Просмотр',
  calculator: 'Расчётчик',
  editor: 'Редактор',
  admin: 'Администратор',
}

/** Предметные права (роли PostgreSQL tgid_cap_*) */
export type Cap = 'network' | 'network_struct' | 'acts' | 'geo' | 'pts' | 'corrosion' | 'repairs'

export const CAP_LABELS: Record<Cap, string> = {
  network: 'Правка гидравлической сети (режимы)',
  network_struct: 'Добавление и удаление объектов сети',
  acts: 'Акты раздела',
  geo: 'Геобаза',
  pts: 'Производственная служба (ПТС)',
  corrosion: 'Индикаторы коррозии',
  repairs: 'Ремонты',
}

export interface PermissionInput {
  role: string
  authDisabled: boolean
  mutationsEnabled: boolean
  topologyMutationsEnabled: boolean
  /** Пользователь — роль PostgreSQL (sub = tgid_u_*): права по предметным правам */
  pgUser?: boolean
  caps?: string[]
  /** Фрагменты, в которых разрешена правка; null — вся сеть */
  fragments?: number[] | null
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
  /** Пользователь — роль PostgreSQL: доступ по предметным правам */
  pgUser: boolean
  /** Предметные права пользователя PostgreSQL ([] — пользователь UsersDB) */
  caps: Cap[]
  /** Фрагменты правки; null — вся сеть */
  fragments: number[] | null
  /** Правка атрибутов сети и оборудования, групповые установщики (право «network») */
  canEditNetwork: boolean
  /** Ремонты (право «repairs»), индикаторы коррозии («corrosion»), ПТС («pts») */
  canEditRepairs: boolean
  canEditCorrosion: boolean
  canEditPts: boolean
  /** Импорт и перенос фрагментов, добавление/удаление объектов (право «network_struct») */
  canEditNetworkStruct: boolean
}

export function effectiveRole(role: string, authDisabled: boolean): Role | '' {
  if (authDisabled) return 'admin'
  return role in ROLE_ORDER ? (role as Role) : ''
}

export function roleAtLeast(role: Role | '', minimum: Role): boolean {
  return role !== '' && ROLE_ORDER[role] >= ROLE_ORDER[minimum]
}

/**
 * Доступ как на сервере (auth.AuthUser.allows): пользователю PostgreSQL — администратор или
 * предметное право; пользователю UsersDB и при AUTH_DISABLED — минимальная роль.
 */
export function allows(role: Role | '', minimum: Role, cap: Cap | undefined, pgUser: boolean, caps: Cap[]): boolean {
  if (cap && pgUser) return role === 'admin' || caps.includes(cap)
  return roleAtLeast(role, minimum)
}

export function computePermissions(input: PermissionInput): Permissions {
  const role = effectiveRole(input.role, input.authDisabled)
  const pgUser = Boolean(input.pgUser) && !input.authDisabled
  const caps = (input.caps || []).filter((c): c is Cap => c in CAP_LABELS)
  const canCalculate = roleAtLeast(role, 'calculator')
  const canEdit = roleAtLeast(role, 'editor')
  const isAdmin = roleAtLeast(role, 'admin')
  const m = input.mutationsEnabled
  const can = (minimum: Role, cap?: Cap) => allows(role, minimum, cap, pgUser, caps) && m
  return {
    role,
    isAuthenticated: role !== '',
    canCalculate,
    canEdit,
    canEditData: canEdit && m,
    canRunWritingCalc: canCalculate && m,
    canEditTopology: can('admin', 'network_struct') && input.topologyMutationsEnabled,
    isAdmin,
    canViewHistory: role !== '',
    pgUser,
    caps,
    fragments: pgUser && !isAdmin ? input.fragments ?? null : null,
    canEditNetwork: can('editor', 'network'),
    canEditRepairs: can('editor', 'repairs'),
    canEditCorrosion: can('editor', 'corrosion'),
    canEditPts: can('editor', 'pts'),
    canEditNetworkStruct: can('editor', 'network_struct'),
  }
}

/** Можно ли править объект фрагмента fileid (null/undefined — объект без фрагмента). */
export function canEditFragment(permissions: Permissions, fileid: number | null | undefined): boolean {
  if (permissions.fragments === null || fileid === null || fileid === undefined) return true
  return permissions.fragments.includes(Number(fileid))
}

/** Минимальная роль (и предметное право для пользователей PostgreSQL) для пункта каталога */
export interface RequiresRole {
  requires?: Role
  requiresCap?: Cap
}

export function isToolVisible(tool: RequiresRole, permissions: Permissions): boolean {
  if (!tool.requires) return true
  return allows(permissions.role, tool.requires, tool.requiresCap, permissions.pgUser, permissions.caps)
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
