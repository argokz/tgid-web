<template>
  <v-dialog
    v-model="visible"
    max-width="400"
    persistent
    :scrim="required ? 'rgba(15, 23, 42, 0.35)' : true"
  >
    <v-card
      rounded="xl"
      class="login-card"
      elevation="12"
    >
      <v-btn
        v-if="!required"
        icon="mdi-close"
        variant="text"
        size="small"
        class="login-close"
        aria-label="Закрыть"
        @click="close"
      />

      <div class="login-head">
        <div class="login-logo">
          <v-icon
            size="30"
            color="primary"
          >mdi-layers</v-icon>
        </div>
        <div class="login-brand">
          ITwin <span class="login-brand-sub">Map</span>
        </div>
        <div class="text-body-2 text-medium-emphasis">
          {{ cityName ? `Вход · ${cityName}` : 'Вход в систему' }}
        </div>
      </div>

      <v-form
        class="login-form"
        @submit.prevent="submit"
      >
        <v-text-field
          v-model="username"
          label="Логин"
          autocomplete="username"
          prepend-inner-icon="mdi-account-outline"
          variant="outlined"
          density="comfortable"
          rounded="lg"
          hide-details="auto"
          class="mb-3"
          :autofocus="!username"
          :disabled="loading"
        />
        <v-text-field
          v-model="password"
          label="Пароль"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="current-password"
          prepend-inner-icon="mdi-lock-outline"
          :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
          variant="outlined"
          density="comfortable"
          rounded="lg"
          hide-details="auto"
          :autofocus="Boolean(username)"
          :disabled="loading"
          @click:append-inner="showPassword = !showPassword"
          @keydown="onPasswordKey"
          @keyup="onPasswordKey"
        />
        <div
          class="caps-hint text-caption"
          :class="{ 'caps-hint--on': capsLock }"
        >
          <v-icon
            size="14"
            class="me-1"
          >mdi-apple-keyboard-caps</v-icon>
          Включён Caps Lock
        </div>
        <v-select
          v-if="allowRolePick"
          v-model="role"
          :items="roles"
          label="Роль (только DEV_LOGIN)"
          variant="outlined"
          density="comfortable"
          rounded="lg"
          hide-details
          class="mb-3"
        />
        <v-expand-transition>
          <v-alert
            v-if="error"
            type="error"
            variant="tonal"
            density="compact"
            rounded="lg"
            class="mb-3"
          >
            {{ error }}
          </v-alert>
        </v-expand-transition>
        <v-btn
          type="submit"
          color="primary"
          variant="flat"
          size="large"
          rounded="lg"
          block
          :loading="loading"
        >Войти</v-btn>
      </v-form>

      <div class="login-foot text-caption text-medium-emphasis">
        Учётную запись выдаёт администратор
      </div>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { fastApiService } from '~/services/fastApiService'
import { formatApiError } from '~/utils/apiError'

const visible = defineModel<boolean>({ default: false })
/** Сервер не отдаёт данные без входа: форму нельзя закрыть */
const props = defineProps<{ required?: boolean }>()

const authStore = useAuthStore()
const notify = useNotificationStore()

/** Город этого API (/auth/config: на проде два города на одном домене) */
const cityName = computed(() => authStore.cityLabel)

const username = ref(authStore.username || '')
const password = ref('')
const showPassword = ref(false)
const capsLock = ref(false)
const role = ref('editor')
const loading = ref(false)
const error = ref('')
const allowRolePick = ref(false)
const roles = [
  { title: 'viewer', value: 'viewer' },
  { title: 'calculator', value: 'calculator' },
  { title: 'operator', value: 'operator' },
  { title: 'editor', value: 'editor' },
  { title: 'admin', value: 'admin' },
]

watch(visible, async (open) => {
  if (!open) return
  error.value = ''
  password.value = ''
  showPassword.value = false
  username.value = authStore.username || authStore.lastUsername || ''
  try {
    const cfg = await fastApiService.getAuthConfig()
    allowRolePick.value = Boolean(cfg.dev_login_enabled || cfg.auth_disabled)
    if (allowRolePick.value && !username.value) username.value = 'editor'
  } catch {
    allowRolePick.value = false
  }
})

const onPasswordKey = (event: KeyboardEvent) => {
  if (typeof event.getModifierState === 'function') capsLock.value = event.getModifierState('CapsLock')
}

const close = () => {
  if (props.required && !authStore.isAuthenticated) return
  visible.value = false
}

const submit = async () => {
  if (loading.value) return
  error.value = ''
  if (!username.value.trim()) {
    error.value = 'Укажите логин'
    return
  }
  if (!password.value && !allowRolePick.value) {
    error.value = 'Укажите пароль'
    return
  }
  loading.value = true
  try {
    await authStore.login(username.value.trim(), password.value, allowRolePick.value ? role.value : undefined)
    notify.showSuccess(`Вход: ${authStore.username} (${authStore.role})`)
    close()
  } catch (err: any) {
    // 401 входа — «Неверный логин или пароль» (QA F72)
    error.value = formatApiError(err, 'Не удалось войти')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-card {
  position: relative;
  padding: 32px 28px 20px;
}
.login-close {
  position: absolute;
  top: 10px;
  right: 10px;
}
.login-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin-bottom: 24px;
  text-align: center;
}
.login-logo {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(var(--v-theme-primary), 0.12);
  margin-bottom: 8px;
}
.login-brand {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
}
.login-brand-sub {
  font-weight: 400;
  opacity: 0.7;
}
.caps-hint {
  display: flex;
  align-items: center;
  height: 22px;
  padding: 2px 4px 0;
  margin-bottom: 6px;
  color: rgb(var(--v-theme-warning));
  visibility: hidden;
}
.caps-hint--on {
  visibility: visible;
}
.login-foot {
  text-align: center;
  margin-top: 16px;
}
@media (max-width: 420px) {
  .login-card {
    padding: 28px 18px 16px;
  }
}
</style>
