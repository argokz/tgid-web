<template>
  <v-dialog
    v-model="visible"
    :fullscreen="mobile"
    :max-width="mobile ? undefined : 900"
    scrollable
  >
    <v-card :rounded="mobile ? '0' : 'lg'">
      <v-card-title class="d-flex align-center ga-2 py-2">
        <v-icon>mdi-account-cog</v-icon>
        Пользователи и роли
        <v-spacer />
        <v-btn
          icon="mdi-refresh"
          variant="text"
          density="compact"
          :loading="loading"
          aria-label="Обновить"
          @click="load"
        />
        <v-btn
          icon="mdi-close"
          variant="text"
          density="compact"
          aria-label="Закрыть"
          @click="visible = false"
        />
      </v-card-title>

      <v-card-text class="pt-0">
        <v-alert
          v-if="!authStore.isAdmin"
          type="warning"
          variant="tonal"
          density="compact"
          class="mb-2"
        >
          Управление пользователями доступно только роли admin.
        </v-alert>
        <template v-else>
          <v-alert
            v-if="error"
            type="error"
            variant="tonal"
            density="compact"
            class="mb-2"
          >
            {{ error }}
          </v-alert>
          <v-alert
            v-if="note"
            type="info"
            variant="tonal"
            density="compact"
            class="mb-2"
          >
            {{ note }}
          </v-alert>

          <!-- Новый пользователь -->
          <v-form
            v-if="canWrite"
            ref="createForm"
            class="d-flex flex-wrap ga-2 align-start mb-3"
            @submit.prevent="createUser"
          >
            <v-text-field
              v-model="newUser.username"
              label="Логин"
              variant="outlined"
              density="compact"
              :rules="[rules.username]"
              style="min-width: 160px; flex: 2 1 160px;"
              autocomplete="off"
            />
            <v-text-field
              v-model="newUser.password"
              label="Пароль (от 8 символов)"
              type="password"
              variant="outlined"
              density="compact"
              :rules="[rules.password]"
              style="min-width: 180px; flex: 2 1 180px;"
              autocomplete="new-password"
            />
            <v-select
              v-model="newUser.role"
              :items="roleItems"
              item-title="title"
              item-value="value"
              label="Роль"
              variant="outlined"
              density="compact"
              style="min-width: 150px; flex: 1 1 150px;"
            />
            <v-btn
              type="submit"
              color="primary"
              variant="flat"
              prepend-icon="mdi-account-plus"
              :loading="creating"
              class="mt-1"
            >
              Добавить
            </v-btn>
          </v-form>

          <v-data-table
            :headers="headers"
            :items="users"
            :loading="loading"
            density="compact"
            items-per-page="50"
            no-data-text="Пользователей нет"
          >
            <template #[`item.role`]="{ item }">
              <v-select
                :model-value="item.role"
                :items="roleItems"
                item-title="title"
                item-value="value"
                variant="plain"
                density="compact"
                hide-details
                :disabled="!canWrite || busyId === item.id"
                style="max-width: 180px;"
                @update:model-value="(role: UserRole) => changeRole(item, role)"
              />
            </template>
            <template #[`item.is_active`]="{ item }">
              <v-chip
                size="small"
                :color="item.is_active ? 'green' : 'grey'"
                variant="tonal"
              >
                {{ item.is_active ? 'активен' : 'заблокирован' }}
              </v-chip>
            </template>
            <template #[`item.actions`]="{ item }">
              <template v-if="canWrite">
                <v-btn
                  :icon="item.is_active ? 'mdi-account-lock' : 'mdi-account-lock-open'"
                  variant="text"
                  size="small"
                  :color="item.is_active ? 'error' : 'green'"
                  :title="item.is_active ? 'Заблокировать' : 'Разблокировать'"
                  :loading="busyId === item.id"
                  @click="toggleActive(item)"
                />
                <v-btn
                  icon="mdi-lock-reset"
                  variant="text"
                  size="small"
                  title="Сменить пароль"
                  @click="askPassword(item)"
                />
              </template>
            </template>
          </v-data-table>

          <div class="text-caption text-medium-emphasis mt-2">
            <div
              v-for="r in roles"
              :key="r.role"
            >
              <b>{{ ROLE_LABELS[r.role] }}</b> ({{ r.role }}) — {{ r.description }}
            </div>
            <div class="mt-1">
              Блокировка и смена роли действуют на уже выданные токены в течение ~30 с.
            </div>
          </div>
        </template>
      </v-card-text>
    </v-card>

    <v-dialog
      v-model="passwordOpen"
      max-width="420"
    >
      <v-card>
        <v-card-title class="text-h6">
          Новый пароль: {{ passwordUser?.username }}
        </v-card-title>
        <v-card-text>
          <v-text-field
            v-model="newPassword"
            label="Пароль (от 8 символов)"
            type="password"
            variant="outlined"
            density="compact"
            :rules="[rules.password]"
            autocomplete="new-password"
          />
        </v-card-text>
        <v-card-actions class="justify-end">
          <v-btn
            variant="text"
            @click="passwordOpen = false"
          >
            Отмена
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :loading="savingPassword"
            :disabled="rules.password(newPassword) !== true"
            @click="savePassword"
          >
            Сохранить
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-dialog>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useMobile } from '~/composables/useMobile'
import {
  fastApiService,
  type AdminRole,
  type AdminUser,
  type UserRole,
} from '~/services/fastApiService'
import { useAuthStore } from '~/stores/authStore'
import { useNotificationStore } from '~/stores/notificationStore'
import { ROLE_LABELS, ROLE_ORDER } from '~/utils/permissions'

const { isMobile: mobile } = useMobile()
const authStore = useAuthStore()
const notificationStore = useNotificationStore()

const visible = ref(false)
const loading = ref(false)
const error = ref('')
const note = ref<string | null>(null)
const canWrite = ref(false)
const users = ref<AdminUser[]>([])
const roles = ref<AdminRole[]>([])
const busyId = ref<number | null>(null)

const roleItems = (Object.keys(ROLE_ORDER) as UserRole[]).map((value) => ({
  value,
  title: ROLE_LABELS[value],
}))

const headers = [
  { title: 'ID', key: 'id', width: 70 },
  { title: 'Логин', key: 'username' },
  { title: 'Роль', key: 'role', sortable: false },
  { title: 'Статус', key: 'is_active' },
  { title: '', key: 'actions', sortable: false, width: 110 },
]

const rules = {
  username: (v: string) => /^[\w.@-]{2,50}$/u.test(v || '') || '2–50 символов: буквы, цифры, . _ @ -',
  password: (v: string) =>
    ((v || '').length >= 8 && new TextEncoder().encode(v).length <= 72) || 'От 8 символов, не длиннее 72 байт',
}

const newUser = reactive<{ username: string; password: string; role: UserRole }>({
  username: '',
  password: '',
  role: 'viewer',
})
const creating = ref(false)
const createForm = ref()

const passwordOpen = ref(false)
const passwordUser = ref<AdminUser | null>(null)
const newPassword = ref('')
const savingPassword = ref(false)

const errorText = (e: any, fallback: string) => e?.detail || e?.userMessage || e?.message || fallback

const load = async () => {
  if (!authStore.isAdmin) return
  loading.value = true
  error.value = ''
  try {
    const [res, roleRes] = await Promise.all([
      fastApiService.getAdminUsers(),
      roles.value.length ? Promise.resolve({ items: roles.value }) : fastApiService.getAdminRoles(),
    ])
    users.value = res.items
    canWrite.value = res.can_write
    note.value = res.note
    roles.value = roleRes.items
  } catch (e: any) {
    error.value = errorText(e, 'Не удалось загрузить пользователей')
  } finally {
    loading.value = false
  }
}

const replaceUser = (updated: AdminUser) => {
  users.value = users.value.map((u) => (u.id === updated.id ? updated : u))
}

const createUser = async () => {
  const { valid } = await createForm.value.validate()
  if (!valid) return
  creating.value = true
  try {
    const created = await fastApiService.createAdminUser({ ...newUser, username: newUser.username.trim() })
    users.value = [...users.value, created].sort((a, b) => a.username.localeCompare(b.username))
    notificationStore.showSuccess(`Пользователь ${created.username} создан (${ROLE_LABELS[created.role]})`)
    newUser.username = ''
    newUser.password = ''
    newUser.role = 'viewer'
    createForm.value.resetValidation()
  } catch (e: any) {
    notificationStore.showError(errorText(e, 'Не удалось создать пользователя'))
  } finally {
    creating.value = false
  }
}

const update = async (item: AdminUser, body: { role?: UserRole; is_active?: boolean }, done: string) => {
  busyId.value = item.id
  try {
    replaceUser(await fastApiService.updateAdminUser(item.id, body))
    notificationStore.showSuccess(done)
  } catch (e: any) {
    notificationStore.showError(errorText(e, 'Не удалось изменить пользователя'))
    await load() // вернуть в таблицу фактическое состояние
  } finally {
    busyId.value = null
  }
}

const changeRole = (item: AdminUser, role: UserRole) => {
  if (role === item.role) return
  void update(item, { role }, `${item.username}: роль ${ROLE_LABELS[role]}`)
}

const toggleActive = (item: AdminUser) => {
  const is_active = !item.is_active
  void update(item, { is_active }, `${item.username} ${is_active ? 'разблокирован' : 'заблокирован'}`)
}

const askPassword = (item: AdminUser) => {
  passwordUser.value = item
  newPassword.value = ''
  passwordOpen.value = true
}

const savePassword = async () => {
  if (!passwordUser.value) return
  savingPassword.value = true
  try {
    await fastApiService.setAdminUserPassword(passwordUser.value.id, newPassword.value)
    notificationStore.showSuccess(`Пароль ${passwordUser.value.username} изменён`)
    passwordOpen.value = false
  } catch (e: any) {
    notificationStore.showError(errorText(e, 'Не удалось сменить пароль'))
  } finally {
    savingPassword.value = false
    newPassword.value = ''
  }
}

const openDialog = () => {
  visible.value = true
  void load()
}

defineExpose({ openDialog })
</script>
