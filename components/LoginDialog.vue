<template>
  <v-dialog v-model="visible" max-width="420" persistent>
    <v-card rounded="lg">
      <v-card-title class="d-flex align-center ga-2">
        <v-icon>mdi-login</v-icon>
        Вход
      </v-card-title>
      <v-card-text>
        <v-text-field
          v-model="username"
          label="Логин"
          autocomplete="username"
          density="compact"
          variant="outlined"
          hide-details="auto"
          class="mb-3"
          @keyup.enter="submit"
        />
        <v-text-field
          v-model="password"
          label="Пароль"
          type="password"
          autocomplete="current-password"
          density="compact"
          variant="outlined"
          hide-details="auto"
          class="mb-3"
          @keyup.enter="submit"
        />
        <v-select
          v-if="allowRolePick"
          v-model="role"
          :items="roles"
          label="Роль (только DEV_LOGIN)"
          density="compact"
          variant="outlined"
          hide-details
        />
        <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-3">
          {{ error }}
        </v-alert>
      </v-card-text>
      <v-card-actions class="px-4 pb-4">
        <v-spacer />
        <v-btn variant="text" @click="close">Отмена</v-btn>
        <v-btn color="primary" variant="flat" :loading="loading" @click="submit">Войти</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { fastApiService } from '~/services/fastApiService'

const visible = defineModel<boolean>({ default: false })

const authStore = useAuthStore()
const notify = useNotificationStore()

const username = ref(authStore.username || 'editor')
const password = ref('')
const role = ref('editor')
const loading = ref(false)
const error = ref('')
const allowRolePick = ref(false)
const roles = [
  { title: 'viewer', value: 'viewer' },
  { title: 'calculator', value: 'calculator' },
  { title: 'editor', value: 'editor' },
  { title: 'admin', value: 'admin' },
]

watch(visible, async (open) => {
  if (!open) return
  error.value = ''
  password.value = ''
  username.value = authStore.username || 'editor'
  try {
    const cfg = await fastApiService.getAuthConfig()
    allowRolePick.value = Boolean(cfg.dev_login_enabled || cfg.auth_disabled)
  } catch {
    allowRolePick.value = false
  }
})

const close = () => {
  visible.value = false
}

const submit = async () => {
  error.value = ''
  if (!username.value.trim()) {
    error.value = 'Укажите логин'
    return
  }
  loading.value = true
  try {
    await authStore.login(username.value.trim(), password.value, allowRolePick.value ? role.value : undefined)
    notify.showSuccess(`Вход: ${authStore.username} (${authStore.role})`)
    close()
  } catch (err: any) {
    error.value = err?.message || String(err)
  } finally {
    loading.value = false
  }
}
</script>
