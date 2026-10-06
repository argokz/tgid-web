import { defineStore } from 'pinia'
import { computePermissions, type Permissions } from '~/utils/permissions'
import { isJwtExpired } from '~/utils/jwt'
import { SESSION_EXPIRED_TEXT } from '~/utils/apiError'
import { useNotificationStore } from '~/stores/notificationStore'

const TOKEN_KEY = 'itwin_access_token'
const ROLE_KEY = 'itwin_user_role'
const USER_KEY = 'itwin_username'
/** Проверка exp токена по таймеру (QA F71) */
const EXPIRY_CHECK_MS = 30_000
let expiryTimer: ReturnType<typeof setInterval> | null = null

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
    /** Счётчик запросов открыть форму входа (истёкшая сессия); layout открывает LoginDialog */
    loginPrompt: 0,
    /** Логин истёкшей сессии — подставляется в форму входа */
    lastUsername: '' as string,
    /** AUTH_BACKEND=pg: пользователь — роль PostgreSQL (sub = tgid_u_*), права и территория из /auth/me */
    pgUser: false as boolean,
    caps: [] as string[],
    fragments: null as number[] | null,
    displayName: '' as string,
    mustChangePassword: false as boolean,
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
        pgUser: state.pgUser,
        caps: state.caps,
        fragments: state.fragments,
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
    /** Предметные права (пользователи PostgreSQL); UsersDB — по роли editor */
    canEditNetwork(): boolean {
      return this.permissions.canEditNetwork
    },
    canEditRepairs(): boolean {
      return this.permissions.canEditRepairs
    },
    canEditCorrosion(): boolean {
      return this.permissions.canEditCorrosion
    },
    canEditPts(): boolean {
      return this.permissions.canEditPts
    },
    canEditNetworkStruct(): boolean {
      return this.permissions.canEditNetworkStruct
    },
  },
  actions: {
    hydrate() {
      if (!process.client) return
      this.accessToken = localStorage.getItem(TOKEN_KEY) || ''
      this.role = localStorage.getItem(ROLE_KEY) || ''
      this.username = localStorage.getItem(USER_KEY) || ''
      this.loaded = true
      void import('~/services/fastApiService').then(({ setUnauthorizedHandler }) => {
        setUnauthorizedHandler(() => this.expireSession())
      })
      if (!expiryTimer) {
        expiryTimer = setInterval(() => this.checkTokenExpiry(), EXPIRY_CHECK_MS)
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') this.checkTokenExpiry()
        })
      }
      void this.loadConfig().then(() => {
        this.checkTokenExpiry()
        if (this.accessToken || this.authDisabled) void this.refreshMe()
      })
    },
    /** Токен истёк по exp — сбросить сессию до первого отказа сервера */
    checkTokenExpiry() {
      if (this.accessToken && isJwtExpired(this.accessToken)) this.expireSession()
    },
    /**
     * Сессия истекла (exp или 401 сервера): выйти, предупредить и открыть форму входа.
     * При AUTH_DISABLED токен не нужен — выходим молча.
     */
    expireSession() {
      if (!this.accessToken) return
      const username = this.username
      this.logout()
      this.lastUsername = username
      if (this.authDisabled) return
      useNotificationStore().notify('warning', SESSION_EXPIRED_TEXT, {
        label: 'Войти',
        handler: () => { this.loginPrompt += 1 },
      })
      this.loginPrompt += 1
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
      this.pgUser = false
      this.caps = []
      this.fragments = null
      this.displayName = ''
      this.mustChangePassword = false
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
        this.pgUser = me.auth_backend === 'pg' && String(me.sub || '').startsWith('tgid_u_')
        this.caps = me.caps || []
        this.fragments = me.fragments ?? null
        this.displayName = me.display_name || me.username
        this.mustChangePassword = Boolean(me.must_change_password)
        this.authDisabled = Boolean(me.auth_disabled)
        this.mutationsEnabledServer = Boolean(me.mutations_enabled)
        this.topologyMutationsEnabledServer = Boolean(me.topology_mutations_enabled)
        this.configLoaded = true
        if (process.client && this.accessToken) {
          localStorage.setItem(USER_KEY, me.username)
          localStorage.setItem(ROLE_KEY, me.role)
        }
      } catch (error: any) {
        // 401 (токен истёк, учётная запись заблокирована) — сессия сброшена с уведомлением;
        // сеть/5xx — сессию не трогаем
        if (!this.authDisabled && error?.status === 401) this.expireSession()
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
