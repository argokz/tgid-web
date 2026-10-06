/**
 * Автор в истории правок. При правах через роли PostgreSQL (docs/pg-auth.md) audit_log.changed_by —
 * роль сессии: tgid_u_<логин> для пользователя, групповая роль для UsersDB/AUTH_DISABLED.
 */
const GROUP_ROLES: Record<string, string> = {
  tgid_admin: 'администратор (без входа)',
  tgid_editor: 'редактор (UsersDB)',
  tgid_calculator: 'расчётчик (UsersDB)',
  tgid_viewer: 'просмотр (UsersDB)',
  tgid_worker: 'служба расчётов',
}

export function authorLabel(changedBy: string | null | undefined): string {
  const value = (changedBy || '').trim()
  if (!value) return '—'
  if (value.startsWith('tgid_u_')) return value.slice('tgid_u_'.length)
  return GROUP_ROLES[value] || value
}
