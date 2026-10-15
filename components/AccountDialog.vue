<template>
  <v-dialog
    v-model="visible"
    :fullscreen="mobile"
    :max-width="mobile ? undefined : (tab === 'users' ? 1100 : 640)"
    scrollable
  >
    <v-card :rounded="mobile ? '0' : 'lg'">
      <v-card-title class="d-flex align-center ga-2 py-2">
        <v-icon>mdi-card-account-details-outline</v-icon>
        Личный кабинет
        <v-spacer />
        <v-btn
          v-if="tab === 'users'"
          icon="mdi-refresh"
          variant="text"
          density="compact"
          :loading="usersPanel?.loading"
          aria-label="Обновить список пользователей"
          @click="usersPanel?.load()"
        />
        <v-btn
          icon="mdi-close"
          variant="text"
          density="compact"
          aria-label="Закрыть"
          @click="visible = false"
        />
      </v-card-title>

      <v-tabs
        v-if="authStore.isAdmin"
        v-model="tab"
        density="compact"
        color="primary"
        class="px-2"
      >
        <v-tab
          value="profile"
          prepend-icon="mdi-account"
        >
          Профиль
        </v-tab>
        <v-tab
          value="users"
          prepend-icon="mdi-account-cog"
        >
          Пользователи
        </v-tab>
      </v-tabs>
      <v-divider />

      <v-card-text>
        <template v-if="tab === 'profile' || !authStore.isAdmin">
          <v-alert
            v-if="authStore.authDisabled"
            type="warning"
            variant="tonal"
            density="compact"
            class="mb-3"
            icon="mdi-shield-off-outline"
          >
            Защита выключена: сервер пускает без входа и считает каждого администратором.
          </v-alert>
          <v-alert
            v-else-if="!authStore.isAuthenticated"
            type="info"
            variant="tonal"
            density="compact"
            class="mb-3"
          >
            Вы не вошли.
          </v-alert>

          <div
            v-if="authStore.isAuthenticated"
            class="d-flex align-center ga-3 mb-3"
          >
            <v-avatar
              size="48"
              :color="authStore.isMaster ? 'deep-purple' : 'primary'"
            >
              <v-icon
                color="white"
                :icon="authStore.isMaster ? 'mdi-shield-key' : 'mdi-account'"
              />
            </v-avatar>
            <div>
              <div class="text-h6">
                {{ authStore.displayName || authStore.username }}
              </div>
              <div class="d-flex flex-wrap ga-1 mt-1">
                <v-chip
                  size="small"
                  color="primary"
                  variant="tonal"
                >
                  {{ roleLabel }}
                </v-chip>
                <v-chip
                  v-if="authStore.isMaster"
                  size="small"
                  color="deep-purple"
                  variant="tonal"
                  prepend-icon="mdi-shield-key"
                >
                  Мастер-учётка
                </v-chip>
              </div>
            </div>
          </div>

          <v-list
            density="compact"
            class="py-0"
          >
            <v-list-item
              v-if="authStore.isAuthenticated"
              title="Логин"
              :subtitle="authStore.username"
              prepend-icon="mdi-login-variant"
            />
            <v-list-item
              v-if="authStore.cityLabel"
              title="Город"
              :subtitle="cityAccess"
              prepend-icon="mdi-city-variant-outline"
            />
            <v-list-item
              v-if="sessionUntil"
              title="Сессия действует до"
              :subtitle="sessionUntil"
              prepend-icon="mdi-timer-sand"
            />
          </v-list>

          <div class="text-subtitle-2 mt-2 mb-1">
            Что доступно
          </div>
          <div
            v-for="p in abilities"
            :key="p.label"
            class="d-flex align-center ga-2 py-1"
          >
            <v-icon
              :icon="p.ok ? 'mdi-check-circle' : 'mdi-minus-circle-outline'"
              :color="p.ok ? 'green' : 'grey'"
              size="small"
            />
            <span :class="p.ok ? '' : 'text-medium-emphasis'">{{ p.label }}</span>
            <span
              v-if="p.note"
              class="text-caption text-medium-emphasis"
            >— {{ p.note }}</span>
          </div>

          <v-alert
            v-if="authStore.isMaster"
            type="info"
            variant="tonal"
            density="compact"
            class="mt-3"
            icon="mdi-shield-key"
          >
            Мастер-учётку нельзя удалить или заблокировать из веба. Пароль меняется только на сервере:
            <code>H:\deploy\set-master-password.cmd</code> — после смены все сессии мастер-учётки закрываются.
          </v-alert>
        </template>

        <UsersAdminPanel
          v-else
          ref="usersPanel"
        />
      </v-card-text>

      <v-card-actions
        v-if="tab === 'profile' || !authStore.isAdmin"
        class="px-4 pb-3"
      >
        <v-btn
          v-if="authStore.canChangeOwnPassword"
          variant="tonal"
          prepend-icon="mdi-lock-reset"
          @click="emit('change-password')"
        >
          Сменить пароль
        </v-btn>
        <v-spacer />
        <v-btn
          v-if="authStore.isAuthenticated"
          color="error"
          variant="text"
          prepend-icon="mdi-logout"
          @click="emit('logout')"
        >
          Выйти
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
/** Личный кабинет: свой профиль и права, смена пароля, выход; администратору — пользователи */
import { computed, ref, watch } from 'vue'
import { useMobile } from '~/composables/useMobile'
import { useAuthStore } from '~/stores/authStore'
import UsersAdminPanel from '~/components/UsersAdminPanel.vue'
import { jwtExpiresAt } from '~/utils/jwt'
import { ROLE_LABELS, type Role } from '~/utils/permissions'

const visible = defineModel<boolean>({ default: false })
const props = defineProps<{ initialTab?: 'profile' | 'users' }>()
const emit = defineEmits<{ (e: 'change-password'): void; (e: 'logout'): void }>()

const { isMobile: mobile } = useMobile()
const authStore = useAuthStore()
const tab = ref<'profile' | 'users'>('profile')
const usersPanel = ref<InstanceType<typeof UsersAdminPanel> | null>(null)

watch(visible, (open) => {
  if (open) tab.value = props.initialTab === 'users' && authStore.isAdmin ? 'users' : 'profile'
})

/** «Алматы (доступны: Алматы, Астана)» — города пользователя UsersDB */
const cityAccess = computed(() => {
  const others = authStore.allCities ? 'все города' : authStore.cities.map((c) => c.label).join(', ')
  return others ? `${authStore.cityLabel} · доступны: ${others}` : authStore.cityLabel
})
const roleLabel = computed(() => ROLE_LABELS[authStore.role as Role] || authStore.role || 'не вошёл')

const sessionUntil = computed(() => {
  const at = jwtExpiresAt(authStore.accessToken)
  return at ? new Date(at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : ''
})

const abilities = computed(() => {
  const p = authStore.permissions
  const writesOff = !authStore.mutationsEnabledServer ? 'запись на сервере выключена' : undefined
  return [
    { label: 'Просмотр карты, журналов и результатов', ok: authStore.isAuthenticated || authStore.authDisabled },
    { label: 'Запуск расчётов', ok: p.canCalculate },
    { label: 'Правка журналов и атрибутов', ok: p.canEditData, note: p.canEdit && !p.canEditData ? writesOff : undefined },
    { label: 'Правка топологии сети', ok: p.canEditTopology, note: p.isAdmin && !p.canEditTopology ? 'выключена на сервере' : undefined },
    { label: 'Управление пользователями', ok: p.isAdmin },
  ]
})
</script>
