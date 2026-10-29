/**
 * Подключение ИИ-клиента к MCP-серверу ТГИД (itwin-api: tgid_mcp, POST /mcp): адрес сервера и готовые
 * фрагменты настройки для Claude Code и клиентов с JSON-конфигом (Claude Desktop, Cursor и др.).
 */

export interface McpToolInfo {
  name: string
  title: string
  permission: string | null
}

export interface McpInfo {
  enabled: boolean
  token_days: number
  path: string
  tools: McpToolInfo[]
}

export interface McpToken {
  token: string
  expires_at: string
  days: number
  path: string
}

/** Абсолютный адрес /mcp: база API бывает относительной (`/tgid/almaty/map-api` за nginx) */
export function mcpEndpointUrl(apiBase: string, origin: string, path = '/mcp'): string {
  const base = apiBase.replace(/\/+$/, '')
  const absolute = /^https?:\/\//i.test(base) ? base : `${origin.replace(/\/+$/, '')}${base.startsWith('/') ? '' : '/'}${base}`
  return `${absolute}${path.startsWith('/') ? path : `/${path}`}`
}

/** Имя сервера в настройках клиента: tgid или tgid-<город> (у пользователя бывает несколько городов) */
export function mcpServerName(city?: string | null): string {
  const slug = (city ?? '').toLowerCase().replace(/[^a-z0-9_-]+/g, '')
  return slug ? `tgid-${slug}` : 'tgid'
}

/** Команда Claude Code: сервер по HTTP с заголовком авторизации */
export function claudeCodeCommand(name: string, url: string, token: string): string {
  return `claude mcp add --transport http ${name} ${url} --header "Authorization: Bearer ${token}"`
}

/** JSON-конфиг клиента (mcpServers): тип http, адрес и заголовок */
export function mcpJsonConfig(name: string, url: string, token: string): string {
  return JSON.stringify({
    mcpServers: { [name]: { type: 'http', url, headers: { Authorization: `Bearer ${token}` } } },
  }, null, 2)
}
