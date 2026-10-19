<template>
  <div>
    <v-alert
      v-if="!authStore.isAdmin"
      type="warning"
      variant="tonal"
      density="compact"
      class="mb-2"
    >
      Управление пользователями — только с правом «Управление пользователями».
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
        v-if="masterLogin"
        type="info"
        variant="tonal"
        density="compact"
        icon="mdi-shield-key"
        class="mb-2"
      >
        Мастер-учётка «{{ masterLogin }}» — вне списка: её нельзя удалить или заблокировать,
        пароль меняется только на сервере.
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
        <v-select
          v-if="showCities"
          v-model="newUser.cities"
          :items="cityItems"
          item-title="title"
          item-value="value"
          label="Города"
          placeholder="Все города"
          persistent-placeholder
          variant="outlined"
          density="compact"
          multiple
          chips
          closable-chips
          style="min-width: 200px; flex: 2 1 200px;"
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
        <template #[`item.username`]="{ item }">
          <div>{{ item.username }}</div>
          <div
            v-if="item.full_name"
            class="text-caption text-medium-emphasis"
          >
            {{ item.full_name }}
          </div>
        </template>
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
            style="min-width: 150px; max-width: 180px;"
            @update:model-value="(role: UserRole) => changeRole(item, role)"
          />
        </template>
        <template #[`item.cities`]="{ item }">
          <v-select
            :model-value="item.cities || []"
            :items="cityItems"
            item-title="title"
            item-value="value"
            placeholder="Все города"
            persistent-placeholder
            variant="plain"
            density="compact"
            multiple
            chips
            hide-details
            :disabled="!canWrite || busyId === item.id"
            style="min-width: 190px; max-width: 280px;"
            :aria-label="`Города пользователя ${item.username}`"
            @update:model-value="(codes: string[]) => changeCities(item, codes)"
          />
        </template>
        <template #[`item.caps`]="{ item }">
          <span
            v-if="item.role === 'admin'"
            class="text-medium-emphasis"
          >все</span>
          <span
            v-else-if="!item.caps?.length"
            class="text-medium-emphasis"
          >—</span>
          <v-chip
            v-for="c in item.caps || []"
            v-else
            :key="c"
            size="x-small"
            variant="tonal"
            class="mr-1 mb-1"
            :title="capLabel(c)"
          >
            {{ capShort(c) }}
          </v-chip>
        </template>
        <template #[`item.perms`]="{ item }">
          <v-chip
            size="small"
            :color="diffCount(item.permissions) ? 'primary' : undefined"
            variant="tonal"
            :disabled="!canWrite"
            prepend-icon="mdi-shield-account-outline"
            @click="openPermissions(item)"
          >
            {{ diffCount(item.permissions) ? `роль + ${diffCount(item.permissions)}` : 'по роли' }}
          </v-chip>
        </template>
        <template #[`item.fragments`]="{ item }">
          <span v-if="item.role === 'admin' || !item.fragments?.length">вся сеть</span>
          <span v-else>{{ item.fragments.join(', ') }}</span>
        </template>
        <template #[`item.web_access`]="{ item }">
          <v-icon
            :icon="item.web_access ? 'mdi-check' : 'mdi-minus'"
            :color="item.web_access ? 'green' : 'grey'"
            size="small"
            :aria-label="item.web_access ? 'есть доступ к вебу' : 'только десктоп'"
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
          <div
            v-if="canWrite"
            class="d-flex flex-nowrap"
          >
            <v-btn
              v-if="pgBackend"
              icon="mdi-pencil"
              variant="text"
              size="small"
              title="Права и территория"
              aria-label="Права и территория"
              @click="openEdit(item)"
            />
            <v-btn
              :icon="item.is_active ? 'mdi-account-lock' : 'mdi-account-lock-open'"
              variant="text"
              size="small"
              :color="item.is_active ? 'error' : 'green'"
              :title="item.is_active ? 'Заблокировать' : 'Разблокировать'"
              :loading="busyId === item.id"
              :aria-label="item.is_active ? 'Заблокировать' : 'Разблокировать'"
              @click="toggleActive(item)"
            />
            <v-btn
              icon="mdi-lock-reset"
              variant="text"
              size="small"
              title="Сменить пароль"
              aria-label="Сменить пароль"
              @click="askPassword(item)"
            />
            <v-btn
              v-if="!pgBackend"
              icon="mdi-delete-outline"
              variant="text"
              size="small"
              color="error"
              title="Удалить"
              aria-label="Удалить"
              :loading="busyId === item.id"
              @click="removeUser(item)"
            />
          </div>
        </template>
      </v-data-table>

      <div class="text-caption text-medium-emphasis mt-2">
        <div
          v-for="r in roles"
          :key="r.role"
        >
          <b>{{ r.label || ROLE_LABELS[r.role] }}</b> — {{ r.description }}
        </div>
        <div
          v-if="pgBackend"
          class="mt-1"
        >
          Пользователи — роли PostgreSQL: те же логин и пароль у веба и десктопа. Предметные права
          (как в десктопе) и территория — фрагменты, в которых разрешена правка; чтение — вся сеть.
          Права и территорию проверяет база данных.
        </div>
        <div
          v-if="showCities"
          class="mt-1"
        >
          Города: без выбора — доступ ко всем городам (и к добавленным позже). Пользователь входит
          только в отмеченные города; мастер-учётке доступны все.
        </div>
        <div
          v-if="!pgBackend"
          class="mt-1"
        >
          Роль — шаблон прав; в «Правах» можно выдать или снять отдельные права: свойства, создание,
          перемещение и удаление по видам объектов («свои» — созданные пользователем) и общие права.
        </div>
        <div class="mt-1">
          Блокировка, смена роли, прав и городов действуют на уже выданные токены в течение ~30 с.
        </div>
      </div>
    </template>

    <!-- Права и территория (AUTH_BACKEND=pg) -->
    <v-dialog
      v-model="editOpen"
      max-width="560"
      scrollable
    >
      <v-card v-if="editUser">
        <v-card-title class="text-h6">
          {{ editUser.username }}
        </v-card-title>
        <v-card-text>
          <v-text-field
            v-model="editForm.full_name"
            label="ФИО"
            variant="outlined"
            density="compact"
          />
          <v-text-field
            v-model="editForm.display_name"
            label="Имя в истории правок"
            variant="outlined"
            density="compact"
          />
          <v-select
            v-model="editForm.role"
            :items="roleItems"
            item-title="title"
            item-value="value"
            label="Роль"
            variant="outlined"
            density="compact"
          />
          <div class="text-subtitle-2 mt-1">
            Предметные права
          </div>
          <div
            v-if="editForm.role === 'admin'"
            class="text-caption text-medium-emphasis mb-2"
          >
            Администратор имеет все права.
          </div>
          <v-checkbox
            v-for="c in caps"
            v-else
            :key="c.cap"
            v-model="editForm.caps"
            :value="c.cap"
            :label="c.description"
            density="compact"
            hide-details
          />
          <v-autocomplete
            v-model="editForm.fragments"
            :items="fragmentItems"
            item-title="title"
            item-value="value"
            label="Территория: фрагменты правки (пусто — вся сеть)"
            variant="outlined"
            density="compact"
            multiple
            chips
            closable-chips
            class="mt-3"
            :disabled="editForm.role === 'admin'"
          />
          <v-switch
            v-model="editForm.web_access"
            label="Доступ к веб-приложению"
            color="primary"
            density="compact"
            hide-details
          />
        </v-card-text>
        <v-card-actions class="justify-end">
          <v-btn
            variant="text"
            @click="editOpen = false"
          >
            Отмена
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :loading="busyId === editUser.id"
            @click="saveEdit"
          >
            Сохранить
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <LazyUserPermissionsDialog
      v-if="permUser"
      v-model="permOpen"
      v-model:saving="permSaving"
      :user="permUser"
      :model="permModel"
      @save="savePermissions"
    />

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
          <div
            v-if="pgBackend"
            class="text-caption text-medium-emphasis"
          >
            Временный: при следующем входе пользователь задаст свой.
          </div>
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
  </div>
</template>

<script setup lang="ts">
/** Пользователи и роли: список, создание, роль, блокировка, пароль, удаление (только admin) */
import { formatApiError } from '~/utils/apiError'
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { confirmAction } from '~/composables/useConfirm'
import {
  fastApiService,
  type AdminCap,
  type AdminRole,
  type AdminUser,
  type AdminUserUpdate,
  type CityItem,
  type PermissionsModel,
  type UserRole,
} from '~/services/fastApiService'
import { useAuthStore } from '~/stores/authStore'
import { useFragmentStore } from '~/stores/fragmentStore'
import { useNotificationStore } from '~/stores/notificationStore'
import { CAP_LABELS, diffCount, ROLE_LABELS, ROLE_ORDER, type Cap } from '~/utils/permissions'

const authStore = useAuthStore()
const fragmentStore = useFragmentStore()
const notificationStore = useNotificationStore()

const loading = ref(false)
const error = ref('')
const note = ref<string | null>(null)
const canWrite = ref(false)
/** Мастер-учётка владельца (вне списка UsersDB); null — не настроена */
const masterLogin = ref<string | null>(null)
const users = ref<AdminUser[]>([])
const roles = ref<AdminRole[]>([])
const caps = ref<AdminCap[]>([])
/** AUTH_BACKEND=pg: пользователи — роли PostgreSQL (права, территория, профиль) */
const pgBackend = ref(false)
const busyId = ref<number | string | null>(null)
/** Справочник городов (UsersDB); у пользователей PostgreSQL доступ к базам даёт сам PostgreSQL */
const citiesCatalog = ref<CityItem[]>([])
const currentCity = ref('')
const showCities = computed(() => !pgBackend.value && citiesCatalog.value.length > 0)
const cityItems = computed(() => citiesCatalog.value.map((c) => ({
  value: c.code,
  title: c.code === currentCity.value ? `${c.label} (этот)` : c.label,
})))

const roleItems = (Object.keys(ROLE_ORDER) as UserRole[]).map((value) => ({
  value,
  title: ROLE_LABELS[value],
}))

const CAP_SHORT: Record<string, string> = {
  network: 'сеть', network_struct: 'добавл./удал.', acts: 'акты', geo: 'геобаза',
  pts: 'ПТС', corrosion: 'коррозия', repairs: 'ремонты',
}
const capShort = (c: string) => CAP_SHORT[c] || c
const capLabel = (c: string) => CAP_LABELS[c as Cap] || c

const headers = computed(() => pgBackend.value
  ? [
      { title: 'Логин', key: 'username' },
      { title: 'Роль', key: 'role', sortable: false },
      { title: 'Права', key: 'caps', sortable: false },
      { title: 'Территория', key: 'fragments', sortable: false },
      { title: 'Веб', key: 'web_access', width: 60 },
      { title: 'Статус', key: 'is_active' },
      { title: '', key: 'actions', sortable: false, width: 150 },
    ]
  : [
      { title: 'ID', key: 'id', width: 70 },
      { title: 'Логин', key: 'username' },
      { title: 'Роль', key: 'role', sortable: false },
      { title: 'Права', key: 'perms', sortable: false },
      ...(showCities.value ? [{ title: 'Города', key: 'cities', sortable: false }] : []),
      { title: 'Статус', key: 'is_active' },
      { title: '', key: 'actions', sortable: false, width: 150 },
    ])

const fragmentItems = computed(() =>
  (fragmentStore.fragments || []).map((f: any) => ({ title: `${f.id} — ${f.name ?? ''}`, value: Number(f.id) })),
)

const rules = {
  // логины десктопа — «Фамилия Имя» (пробел), UsersDB — буквы, цифры, . _ @ -
  username: (v: string) => /^[\w .@-]{2,50}$/u.test((v || '').trim()) || '2–50 символов: буквы, цифры, пробел, . _ @ -',
  password: (v: string) =>
    ((v || '').length >= 8 && new TextEncoder().encode(v).length <= 72) || 'От 8 символов, не длиннее 72 байт',
}

const newUser = reactive<{ username: string; password: string; role: UserRole; cities: string[] }>({
  username: '',
  password: '',
  role: 'viewer',
  cities: [],
})
const creating = ref(false)
const createForm = ref()

const passwordOpen = ref(false)
const passwordUser = ref<AdminUser | null>(null)
const newPassword = ref('')
const savingPassword = ref(false)

const editOpen = ref(false)
const editUser = ref<AdminUser | null>(null)
const editForm = reactive<{
  role: UserRole
  caps: string[]
  fragments: number[]
  display_name: string
  full_name: string
  web_access: boolean
}>({ role: 'viewer', caps: [], fragments: [], display_name: '', full_name: '', web_access: true })

const errorText = (e: any, fallback: string) => formatApiError(e, fallback)

const load = async () => {
  if (!authStore.isAdmin) return
  loading.value = true
  error.value = ''
  try {
    const [res, roleRes] = await Promise.all([
      fastApiService.getAdminUsers(),
      roles.value.length
        ? Promise.resolve({ items: roles.value, caps: caps.value, backend: pgBackend.value ? 'pg' : undefined,
          model: permModel.value ?? undefined })
        : fastApiService.getAdminRoles(),
    ])
    users.value = res.items
    canWrite.value = res.can_write
    note.value = res.note
    masterLogin.value = res.master_login ?? null
    citiesCatalog.value = res.cities_catalog || []
    currentCity.value = res.current_city || ''
    roles.value = roleRes.items
    caps.value = roleRes.caps || []
    permModel.value = roleRes.model ?? null
    pgBackend.value = roleRes.backend === 'pg'
    if (pgBackend.value && !fragmentStore.fragments?.length) void fragmentStore.loadFragments()
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
    const created = await fastApiService.createAdminUser({
      username: newUser.username.trim(),
      password: newUser.password,
      role: newUser.role,
      // без выбора — все города
      ...(showCities.value ? { cities: newUser.cities.length ? [...newUser.cities] : null } : {}),
    })
    users.value = [...users.value, created].sort((a, b) => a.username.localeCompare(b.username))
    notificationStore.showSuccess(`Пользователь ${created.username} создан (${ROLE_LABELS[created.role]})`)
    newUser.username = ''
    newUser.password = ''
    newUser.role = 'viewer'
    newUser.cities = []
    // сброс подсветки — после того как правила пересчитались на пустые поля
    await nextTick()
    createForm.value?.resetValidation()
    if (pgBackend.value) openEdit(created) // права и территория — сразу
  } catch (e: any) {
    notificationStore.showError(errorText(e, 'Не удалось создать пользователя'))
  } finally {
    creating.value = false
  }
}

const update = async (item: AdminUser, body: AdminUserUpdate, done: string) => {
  busyId.value = item.id
  try {
    replaceUser(await fastApiService.updateAdminUser(item.id, body))
    notificationStore.showSuccess(done)
    return true
  } catch (e: any) {
    notificationStore.showError(errorText(e, 'Не удалось изменить пользователя'))
    await load() // вернуть в таблицу фактическое состояние
    return false
  } finally {
    busyId.value = null
  }
}

const changeRole = (item: AdminUser, role: UserRole) => {
  if (role === item.role) return
  void update(item, { role }, `${item.username}: роль ${ROLE_LABELS[role]}`)
}

const cityNames = (codes: string[] | null | undefined) =>
  codes?.length
    ? codes.map((c) => citiesCatalog.value.find((x) => x.code === c)?.label || c).join(', ')
    : 'все города'

const changeCities = (item: AdminUser, codes: string[]) => {
  const next = codes.length ? codes : null
  const prev = item.cities?.length ? item.cities : null
  if (JSON.stringify(next) === JSON.stringify(prev)) return
  void update(item, { cities: next }, `${item.username}: ${cityNames(next)}`)
}

const toggleActive = (item: AdminUser) => {
  const is_active = !item.is_active
  void update(item, { is_active }, `${item.username} ${is_active ? 'разблокирован' : 'заблокирован'}`)
}

const openEdit = (item: AdminUser) => {
  editUser.value = item
  editForm.role = item.role
  editForm.caps = [...(item.caps || [])]
  editForm.fragments = [...(item.fragments || [])]
  editForm.display_name = item.display_name || ''
  editForm.full_name = item.full_name || ''
  editForm.web_access = item.web_access !== false
  editOpen.value = true
}

const saveEdit = async () => {
  if (!editUser.value) return
  const admin = editForm.role === 'admin'
  const ok = await update(editUser.value, {
    role: editForm.role,
    caps: admin ? [] : editForm.caps,
    fragments: admin ? [] : editForm.fragments,
    display_name: editForm.display_name.trim() || null,
    full_name: editForm.full_name.trim() || null,
    web_access: editForm.web_access,
  }, `${editUser.value.username}: права сохранены`)
  if (ok) editOpen.value = false
}

// --- права пользователя UsersDB: роль-шаблон + отличия (UserPermissionsDialog) ---
const permModel = ref<PermissionsModel | null>(null)
const permOpen = ref(false)
const permSaving = ref(false)
const permUser = ref<AdminUser | null>(null)
const openPermissions = (item: AdminUser) => {
  if (!permModel.value) {
    notificationStore.showWarning('Сервер не прислал модель прав — обновите API.')
    return
  }
  permUser.value = item
  permOpen.value = true
}
const savePermissions = async (body: AdminUserUpdate) => {
  if (!permUser.value) return
  permSaving.value = true
  const ok = await update(permUser.value, body, `${permUser.value.username}: права сохранены`)
  permSaving.value = false
  if (ok) permOpen.value = false
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

const removeUser = async (item: AdminUser) => {
  const ok = await confirmAction({
    title: 'Удалить пользователя',
    text: `Удалить учётную запись «${item.username}»? Войти под ней будет нельзя сразу; история правок сохранится.`,
    action: 'Удалить',
    color: 'error',
  })
  if (!ok) return
  busyId.value = item.id
  try {
    await fastApiService.deleteAdminUser(item.id)
    users.value = users.value.filter((u) => u.id !== item.id)
    notificationStore.showSuccess(`Пользователь ${item.username} удалён`)
  } catch (e: any) {
    notificationStore.showError(errorText(e, 'Не удалось удалить пользователя'))
  } finally {
    busyId.value = null
  }
}

onMounted(() => { void load() })

defineExpose({ load, loading })
</script>
