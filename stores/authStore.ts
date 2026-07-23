import { defineStore } from 'pinia'

const TOKEN_KEY = 'itwin_access_token'
const ROLE_KEY = 'itwin_user_role'
const USER_KEY = 'itwin_username'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    accessToken: '' as string,
    role: '' as string,
    username: '' as string,
    loaded: false
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
    async loginDev(username: string, password: string, role = 'editor') {
      const { fastApiService } = await import('~/services/fastApiService')
      const result = await fastApiService.login(username, password, role)
      this.setSession(result.access_token, result.username, result.role)
      return result
    }
  }
})
