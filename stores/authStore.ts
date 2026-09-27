import { defineStore } from 'pinia'
import { computePermissions, type Permissions } from '~/utils/permissions'

const TOKEN_KEY = 'itwin_access_token'
const ROLE_KEY = 'itwin_user_role'
const USER_KEY = 'itwin_username'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    accessToken: '' as string,
    role: '' as string,
    username: '' as string,
    loaded: false,
    /** Флаги сервера (/auth/config, /auth/me). До ответа — самый строгий вариант. */
    configLoaded: false,
    authDisabled: false as boolean,
    mutationsEnabledServer: false as boolean,
    topologyMutationsEnabledServer: false as boolean,
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.accessToken),
    permissions: (state): Permissions =>
      computePermissions({
        // Роль без токена не в счёт (в localStorage могла остаться от прошлой сессии),
        // кроме AUTH_DISABLED — тогда сервер сам считает любой запрос dev admin
        role: state.accessToken || state.authDisabled ? state.role : '',
        authDisabled: state.authDisabled,
        mutationsEnabled: state.mutationsEnabledServer,
        topologyMutationsEnabled: state.topologyMutationsEnabledServer,
      }),
    /** Роль editor+ (при AUTH_DISABLED сервер считает всех admin) */
    canEdit(): boolean {
      return this.permissions.canEdit
    },
    /** Роль calculator+ */
    canCalculate(): boolean {
      return this.permissions.canCalculate
    },
    /** Правка журналов/атрибутов: editor+ и MUTATIONS_ENABLED на сервере */
    canEditData(): boolean {
      return this.permissions.canEditData
    },
    /** Теплопотери, -save_po/-dross_yes, удаление расчётов: calculator+ и MUTATIONS_ENABLED */
    canRunWritingCalc(): boolean {
      return this.permissions.canRunWritingCalc
    },
    canEditTopology(): boolean {
      return this.permissions.canEditTopology
    },
    isAdmin(): boolean {
      return this.permissions.isAdmin
    },
    canViewHistory(): boolean {
      return this.permissions.canViewHistory
    },
  },
  actions: {
    hydrate() {
      if (!process.client) return
      this.accessToken = localStorage.getItem(TOKEN_KEY) || ''
      this.role = localStorage.getItem(ROLE_KEY) || ''
      this.username = localStorage.getItem(USER_KEY) || ''
      this.loaded = true
      void this.loadConfig().then(() => {
        if (this.accessToken || this.authDisabled) void this.refreshMe()
      })
    },
    /** Публичные флаги сервера: AUTH_DISABLED, MUTATIONS_ENABLED, TOPOLOGY_MUTATIONS_ENABLED */
    async loadConfig() {
      try {
        const { fastApiService } = await import('~/services/fastApiService')
        const config = await fastApiService.getAuthConfig()
        this.authDisabled = Boolean(config.auth_disabled)
        this.mutationsEnabledServer = Boolean(config.mutations_enabled)
        this.topologyMutationsEnabledServer = Boolean(config.topology_mutations_enabled)
        this.configLoaded = true
      } catch {
        // API недоступен — оставляем строгие значения (кнопки записи скрыты)
      }
    },
    setSession(token: string, username: string, role: string) {
      this.accessToken = token
      this.username = username
      this.role = role
      if (process.client) {
        localStorage.setItem(TOKEN_KEY, token)
        localStorage.setItem(USER_KEY, username)
        localStorage.setItem(ROLE_KEY, role)
      }
    },
    logout() {
      this.accessToken = ''
      this.username = ''
      this.role = ''
      if (process.client) {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
        localStorage.removeItem(ROLE_KEY)
      }
    },
    async refreshMe() {
      try {
        const { fastApiService } = await import('~/services/fastApiService')
        const me = await fastApiService.authMe()
        this.username = me.username
        this.role = me.role
        this.authDisabled = Boolean(me.auth_disabled)
        this.mutationsEnabledServer = Boolean(me.mutations_enabled)
        this.topologyMutationsEnabledServer = Boolean(me.topology_mutations_enabled)
        this.configLoaded = true
        if (process.client && this.accessToken) {
          localStorage.setItem(USER_KEY, me.username)
          localStorage.setItem(ROLE_KEY, me.role)
        }
      } catch {
        // Токен истёк или учётная запись заблокирована (401) — выходим тихо
        if (!this.authDisabled) {
          this.logout()
        }
      }
    },
    /** Production login: role comes from UsersDB, not from the client. */
    async login(username: string, password: string, role?: string) {
      const { fastApiService } = await import('~/services/fastApiService')
      const result = await fastApiService.login(username, password, role)
      this.setSession(result.access_token, result.username, result.role)
      await this.refreshMe()
      return result
    },
    /** @deprecated use login() */
    async loginDev(username: string, password: string, role = 'editor') {
      return this.login(username, password, role)
    }
  }
})
