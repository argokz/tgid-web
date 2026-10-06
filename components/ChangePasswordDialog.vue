<template>
  <v-dialog
    v-model="visible"
    max-width="440"
    :persistent="forced"
  >
    <v-card>
      <v-card-title class="text-h6">
        Смена пароля
      </v-card-title>
      <v-card-text>
        <v-alert
          v-if="forced"
          type="info"
          variant="tonal"
          density="compact"
          class="mb-3"
        >
          Администратор задал временный пароль — задайте свой. Он же действует в десктопе.
        </v-alert>
        <v-form
          ref="form"
          @submit.prevent="save"
        >
          <v-text-field
            v-model="current"
            label="Текущий пароль"
            type="password"
            variant="outlined"
            density="compact"
            autocomplete="current-password"
            :rules="[(v: string) => !!v || 'Введите текущий пароль']"
          />
          <v-text-field
            v-model="next"
            label="Новый пароль (от 8 символов)"
            type="password"
            variant="outlined"
            density="compact"
            autocomplete="new-password"
            :rules="[rules.length, rules.differs]"
          />
          <v-text-field
            v-model="repeat"
            label="Повтор нового пароля"
            type="password"
            variant="outlined"
            density="compact"
            autocomplete="new-password"
            :rules="[(v: string) => v === next || 'Пароли не совпадают']"
          />
        </v-form>
        <v-alert
          v-if="error"
          type="error"
          variant="tonal"
          density="compact"
        >
          {{ error }}
        </v-alert>
      </v-card-text>
      <v-card-actions class="justify-end">
        <v-btn
          v-if="!forced"
          variant="text"
          @click="visible = false"
        >
          Отмена
        </v-btn>
        <v-btn
          v-else
          variant="text"
          @click="later"
        >
          Позже
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :loading="saving"
          @click="save"
        >
          Сменить
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { fastApiService } from '~/services/fastApiService'
import { useAuthStore } from '~/stores/authStore'
import { useNotificationStore } from '~/stores/notificationStore'
import { formatApiError } from '~/utils/apiError'

/** Смена своего пароля (AUTH_BACKEND=pg): пароль роли PostgreSQL — общий для веба и десктопа. */
const visible = defineModel<boolean>({ default: false })
const authStore = useAuthStore()
const notificationStore = useNotificationStore()

const form = ref()
const current = ref('')
const next = ref('')
const repeat = ref('')
const saving = ref(false)
const error = ref('')
const forced = computed(() => authStore.mustChangePassword)

const rules = {
  length: (v: string) => (v || '').length >= 8 || 'Не короче 8 символов',
  differs: (v: string) => v !== current.value || 'Новый пароль совпадает с текущим',
}

watch(visible, (open) => {
  if (open) {
    current.value = ''
    next.value = ''
    repeat.value = ''
    error.value = ''
  }
})

const later = () => {
  visible.value = false
}

const save = async () => {
  const { valid } = await form.value.validate()
  if (!valid) return
  saving.value = true
  error.value = ''
  try {
    await fastApiService.changeOwnPassword(current.value, next.value)
    authStore.mustChangePassword = false
    notificationStore.showSuccess('Пароль изменён — он действует и в десктопе')
    visible.value = false
  } catch (e: any) {
    error.value = formatApiError(e, 'Не удалось сменить пароль')
  } finally {
    saving.value = false
  }
}
</script>
