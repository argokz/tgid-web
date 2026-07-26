import { defineStore } from 'pinia'

const TOKEN_KEY = 'itwin_access_token'
const ROLE_KEY = 'itwin_user_role'
const USER_KEY = 'itwin_username'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    accessToken: '' as string,
    role: '' as string,
    username: '' as string,
    loaded: false,
    authDisabled: true as boolean,
    mutationsEnabledServer: false as boolean,
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.accessToken),
    canEdit: (state) => ['editor', 'admin'].includes(state.role),
    canCalculate: (state) => ['calculator', 'editor', 'admin'].includes(state.role)
  },
  actions: {
    hydrate() {
      if (!process.client) return
      this.accessToken = localStorage.getItem(TOKEN_KEY) || ''
      this.role = localStorage.getItem(ROLE_KEY) || ''
      this.username = localStorage.getItem(USER_KEY) || ''
      this.loaded = true
      if (this.accessToken) {
        void this.refreshMe()
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
        if (process.client) {
          localStorage.setItem(USER_KEY, me.username)
          localStorage.setItem(ROLE_KEY, me.role)
        }
      } catch {
        // Token may be expired when AUTH is on — clear quietly
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
