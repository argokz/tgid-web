/**
 * Права интерфейса: роль пользователя + серверные флаги из /auth/config.
 * Сервер проверяет то же самое сам; здесь — только чтобы не показывать кнопки,
 * которые всё равно закончатся 401/403/503.
 *
 * Роль — шаблон прав (itwin-api permissions.py): матрица «вид объекта × действие» с охватом
 * нет / только свои / все и общие права. Действующие права (шаблон + отличия пользователя)
 * приходят в /auth/me; без них (старый сервер) — права шаблона роли.
 * При AUTH_DISABLED сервер считает любой запрос «dev admin» — интерфейс тоже.
 *
 * Пользователи PostgreSQL (AUTH_BACKEND=pg, docs/pg-auth.md) дополнительно имеют предметные права
 * (биты user_right десктопа) и территорию — фрагменты, в которых разрешена правка. Как на сервере
 * (auth.AuthUser.allows): администратор или предметное право; права и территорию проверяет БД.
 */

export type Role = 'viewer' | 'calculator' | 'operator' | 'editor' | 'admin'

export const ROLE_ORDER: Record<Role, number> = { viewer: 1, calculator: 2, operator: 2, editor: 3, admin: 4 }

export const ROLE_LABELS: Record<Role, string> = {
  viewer: 'Просмотр',
  calculator: 'Режимщик',
  operator: 'Оператор сети',
  editor: 'Редактор',
  admin: 'Администратор',
}

/** Виды объектов и действия матрицы прав (как permissions.KINDS / ACTIONS) */
export type PermKind = 'line' | 'node' | 'consumer' | 'source' | 'equipment' | 'regime'
export type PermAction = 'edit' | 'create' | 'move' | 'delete'
export type PermScope = 'none' | 'own' | 'all'
export type PermMatrix = Partial<Record<PermKind, Partial<Record<PermAction, PermScope>>>>
export type GeneralPerm =
  | 'calc_run' | 'calc_save' | 'export' | 'import' | 'journals' | 'refs' | 'audit_view' | 'users_admin'

export const PERM_KIND_LABELS: Record<PermKind, string> = {
  line: 'Участки',
  node: 'Узлы',
  consumer: 'Потребители',
  source: 'Источники и насосные станции',
  equipment: 'Оборудование',
  regime: 'Режим узла (заданный напор, подпитка)',
}
export const PERM_ACTION_LABELS: Record<PermAction, string> = {
  edit: 'Свойства',
  create: 'Создание',
  move: 'Перемещение и изломы',
  delete: 'Удаление',
}
export const PERM_SCOPE_LABELS: Record<PermScope, string> = { none: 'нет', own: 'свои', all: 'все' }

const ALL_KINDS: PermKind[] = ['line', 'node', 'consumer', 'source', 'equipment', 'regime']
const fill = (kinds: PermKind[], actions: Partial<Record<PermAction, PermScope>>): PermMatrix =>
  Object.fromEntries(kinds.map((k) => [k, { ...actions }]))

/** Права шаблонов ролей — если сервер не прислал действующие права (как permissions.ROLE_PRESETS) */
export const ROLE_PRESETS: Record<Role, { matrix: PermMatrix; general: GeneralPerm[] }> = {
  viewer: { matrix: {}, general: ['export'] },
  calculator: {
    matrix: fill(['consumer', 'source', 'equipment', 'regime'], { edit: 'all' }),
    general: ['calc_run', 'calc_save', 'export'],
  },
  operator: { matrix: fill(ALL_KINDS, { edit: 'own', create: 'all', move: 'own', delete: 'own' }), general: ['export'] },
  editor: {
    matrix: fill(ALL_KINDS, { edit: 'all', create: 'all', move: 'all', delete: 'own' }),
    general: ['calc_run', 'calc_save', 'export', 'import', 'journals', 'refs'],
  },
  admin: {
    matrix: fill(ALL_KINDS, { edit: 'all', create: 'all', move: 'all', delete: 'all' }),
    general: ['calc_run', 'calc_save', 'export', 'import', 'journals', 'refs', 'audit_view', 'users_admin'],
  },
}

/** Действующие права из /auth/me */
export interface ServerPermissions {
  matrix?: PermMatrix
  general?: string[]
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
  /** Действующие права из /auth/me (нет — права шаблона роли) */
  permissions?: ServerPermissions | null
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
  /** Импорт и перенос фрагментов (право «Импорт сети») */
  canEditNetworkStruct: boolean
  /** Матрица прав: охват действия с видом объектов (без учёта флагов сервера) */
  matrix: PermMatrix
  general: GeneralPerm[]
  /** Сохранение и сравнение расчётов, направления пьезометра */
  canSaveCalc: boolean
  /** Журнал действий пользователей */
  canViewAudit: boolean
}

/** Охват действия: 'none' | 'own' | 'all' */
export function permScope(p: Pick<Permissions, 'matrix'>, kind: PermKind, action: PermAction): PermScope {
  return p.matrix[kind]?.[action] ?? 'none'
}

/** Можно ли действие хоть с какими-то объектами вида (own — свои) */
export function canDo(p: Pick<Permissions, 'matrix'>, kind: PermKind, action: PermAction): boolean {
  return permScope(p, kind, action) !== 'none'
}

/** Предметные права PostgreSQL → матрица (network — свойства, network_struct — структура сети) */
function capsMatrix(caps: Cap[]): PermMatrix {
  const m: PermMatrix = {}
  for (const k of ALL_KINDS) {
    const a: Partial<Record<PermAction, PermScope>> = {}
    if (caps.includes('network')) a.edit = 'all'
    if (caps.includes('network_struct') && k !== 'regime') {
      a.create = 'all'
      a.delete = 'all'
      if (k !== 'equipment') a.move = 'all'
    }
    if (Object.keys(a).length) m[k] = a
  }
  return m
}

/**
 * Права из админки (полная матрица и общие права) → отличия от шаблона роли (как permissions.diff_from_role):
 * в users.permissions хранится только то, что отличается от роли.
 */
export function diffFromPreset(
  preset: { matrix: PermMatrix; general: string[] },
  matrix: PermMatrix,
  general: string[],
  generalKeys: string[],
): { matrix?: PermMatrix; general?: Record<string, boolean> } {
  const out: { matrix?: PermMatrix; general?: Record<string, boolean> } = {}
  for (const [kind, actions] of Object.entries(matrix) as [PermKind, Partial<Record<PermAction, PermScope>>][]) {
    for (const [action, scope] of Object.entries(actions || {}) as [PermAction, PermScope][]) {
      const base = preset.matrix[kind]?.[action] ?? 'none'
      if (scope !== base) {
        out.matrix ??= {}
        out.matrix[kind] = { ...(out.matrix[kind] || {}), [action]: scope }
      }
    }
  }
  for (const key of generalKeys) {
    const want = general.includes(key)
    if (want !== preset.general.includes(key)) (out.general ??= {})[key] = want
  }
  return out
}

/** Число отличий прав пользователя от роли (для подписи в списке) */
export function diffCount(diff: { matrix?: PermMatrix; general?: Record<string, boolean> } | null | undefined): number {
  if (!diff) return 0
  const m = Object.values(diff.matrix || {}).reduce((a, x) => a + Object.keys(x || {}).length, 0)
  return m + Object.keys(diff.general || {}).length
}

/** Вид карточки (окно свойств: line, consumer, damper…) → вид объекта в правах */
export function cardPermKind(cardKind: string): PermKind {
  switch (cardKind) {
    case 'line': return 'line'
    case 'node': return 'node'
    case 'consumer':
    case 'genconsumer': return 'consumer'
    case 'source':
    case 'pumpstation': return 'source'
    case 'setpress':
    case 'refill': return 'regime'
    default: return 'equipment'
  }
}

const matrixHas = (m: PermMatrix, actions: PermAction[]) =>
  Object.values(m).some((a) => actions.some((x) => (a?.[x] ?? 'none') !== 'none'))

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
  const preset = role ? ROLE_PRESETS[role] : { matrix: {}, general: [] as GeneralPerm[] }
  const server = input.authDisabled ? null : input.permissions
  // пользователь PostgreSQL: сеть — только по предметным правам (как permissions.effective(pg=True))
  const fallbackMatrix = pgUser && role !== 'admin' ? capsMatrix(caps) : preset.matrix
  const matrix: PermMatrix = server?.matrix ?? fallbackMatrix
  const general = (server?.general ?? preset.general) as GeneralPerm[]
  const has = (g: GeneralPerm) => role !== '' && general.includes(g)
  const isAdmin = has('users_admin')
  const m = input.mutationsEnabled
  // журналы пользователю PostgreSQL — ещё и по его предметному праву
  const journal = (cap: Cap) => has('journals') && (!pgUser || allows(role, 'editor', cap, pgUser, caps)) && m
  return {
    role,
    isAuthenticated: role !== '',
    canCalculate: has('calc_run'),
    canEdit: has('journals'),
    canEditData: has('journals') && m,
    canRunWritingCalc: has('calc_run') && m,
    canEditTopology: matrixHas(matrix, ['create', 'move', 'delete']) && m && input.topologyMutationsEnabled,
    isAdmin,
    canViewHistory: role !== '',
    pgUser,
    caps,
    fragments: pgUser && !isAdmin ? input.fragments ?? null : null,
    canEditNetwork: matrixHas(matrix, ['edit']) && m,
    canEditRepairs: journal('repairs'),
    canEditCorrosion: journal('corrosion'),
    canEditPts: journal('pts'),
    canEditNetworkStruct: has('import') && m,
    matrix,
    general,
    canSaveCalc: has('calc_save') && m,
    canViewAudit: has('audit_view'),
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
  /** Право матрицы прав: общее или 'edit' — свойства хоть каких-то объектов */
  requiresPerm?: GeneralPerm | 'edit'
}

export function isToolVisible(tool: RequiresRole, permissions: Permissions): boolean {
  if (tool.requiresPerm) {
    if (!permissions.isAuthenticated) return false
    return tool.requiresPerm === 'edit'
      ? matrixHas(permissions.matrix, ['edit'])
      : permissions.general.includes(tool.requiresPerm)
  }
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
