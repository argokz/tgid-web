<template>
  <v-dialog
    v-model="open"
    max-width="860"
    scrollable
  >
    <v-card v-if="user && model">
      <v-card-title class="d-flex align-center">
        <v-icon
          start
          size="20"
        >
          mdi-shield-account-outline
        </v-icon>
        Права: {{ user.username }}
        <v-spacer />
        <v-chip
          v-if="changed"
          size="small"
          color="primary"
          variant="tonal"
        >
          отличий от роли: {{ changed }}
        </v-chip>
      </v-card-title>
      <v-card-text>
        <div class="d-flex flex-wrap align-center ga-2 mb-3">
          <AppSelect
            v-model="role"
            :items="roleItems"
            item-title="title"
            item-value="value"
            label="Роль-шаблон"
            style="max-width: 260px;"
            :clearable="false"
            @update:model-value="resetToRole"
          />
          <v-btn
            variant="text"
            size="small"
            prepend-icon="mdi-restore"
            :disabled="!changed"
            @click="resetToRole"
          >
            Сбросить к роли
          </v-btn>
          <span class="text-caption text-medium-emphasis">{{ presetOf(role)?.description }}</span>
        </div>

        <div class="text-subtitle-2 mb-1">
          Объекты сети
        </div>
        <div class="text-caption text-medium-emphasis mb-2">
          «Свои» — только объекты, созданные этим пользователем в вебе. Отличия от роли отмечены точкой.
        </div>
        <v-table
          density="compact"
          class="perm-table"
        >
          <thead>
            <tr>
              <th />
              <th
                v-for="a in model.actions"
                :key="a.action"
              >
                {{ a.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="k in model.kinds"
              :key="k.kind"
            >
              <td class="perm-table__kind">
                {{ k.label }}
              </td>
              <td
                v-for="a in model.actions"
                :key="a.action"
              >
                <template v-if="k.actions.includes(a.action)">
                  <v-btn-toggle
                    :model-value="scopeOf(k.kind, a.action)"
                    mandatory
                    density="compact"
                    divided
                    variant="outlined"
                    :color="scopeOf(k.kind, a.action) === 'none' ? undefined : 'primary'"
                    @update:model-value="(s: PermScope) => setScope(k.kind, a.action, s)"
                  >
                    <v-btn
                      v-for="s in scopesFor(a.action)"
                      :key="s"
                      :value="s"
                      size="x-small"
                    >
                      {{ PERM_SCOPE_LABELS[s] }}
                    </v-btn>
                  </v-btn-toggle>
                  <span
                    v-if="differs(k.kind, a.action)"
                    class="perm-dot"
                    title="Отличается от роли"
                  />
                </template>
                <span
                  v-else
                  class="text-medium-emphasis"
                >—</span>
              </td>
            </tr>
          </tbody>
        </v-table>

        <div class="text-subtitle-2 mt-4 mb-1">
          Общие права
        </div>
        <div class="perm-general">
          <div
            v-for="g in model.general"
            :key="g.key"
            class="d-flex align-center"
          >
            <v-checkbox
              v-model="general"
              :value="g.key"
              :label="g.label"
              density="compact"
              hide-details
            />
            <span
              v-if="generalDiffers(g.key)"
              class="perm-dot"
              title="Отличается от роли"
            />
          </div>
        </div>
      </v-card-text>
      <v-card-actions class="justify-end">
        <v-btn
          variant="text"
          @click="open = false"
        >
          Отмена
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :loading="saving"
          @click="save"
        >
          Сохранить
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import AppSelect from '~/components/AppSelect.vue'
/** Права пользователя UsersDB: роль-шаблон + галочки «нет / свои / все» по видам объектов и общие права */
import { computed, ref, watch } from 'vue'
import type { AdminUser, AdminUserUpdate, PermissionsModel, UserRole } from '~/services/fastApiService'
import {
  diffCount,
  diffFromPreset,
  PERM_SCOPE_LABELS,
  type PermAction,
  type PermKind,
  type PermMatrix,
  type PermScope,
} from '~/utils/permissions'

const props = defineProps<{ user: AdminUser | null; model: PermissionsModel | null }>()
const emit = defineEmits<{ save: [body: AdminUserUpdate] }>()
const open = defineModel<boolean>({ default: false })
const saving = defineModel<boolean>('saving', { default: false })

const role = ref<UserRole>('viewer')
const matrix = ref<PermMatrix>({})
const general = ref<string[]>([])

const presetOf = (r: UserRole) => props.model?.roles.find((x) => x.role === r)
const roleItems = computed(() => (props.model?.roles || []).map((r) => ({ value: r.role, title: r.label })))

const copy = (m: PermMatrix): PermMatrix => JSON.parse(JSON.stringify(m || {}))

/** Открыли — действующие права пользователя (шаблон роли + его отличия) */
watch(open, (on) => {
  if (!on || !props.user) return
  role.value = props.user.role
  const eff = props.user.effective ?? presetOf(props.user.role)?.permissions
  matrix.value = copy(eff?.matrix || {})
  general.value = [...(eff?.general || [])]
}, { immediate: true })

const resetToRole = () => {
  const p = presetOf(role.value)?.permissions
  matrix.value = copy(p?.matrix || {})
  general.value = [...(p?.general || [])]
}

const scopeOf = (k: PermKind, a: PermAction): PermScope => matrix.value[k]?.[a] ?? 'none'
const setScope = (k: PermKind, a: PermAction, s: PermScope) => {
  matrix.value = { ...matrix.value, [k]: { ...(matrix.value[k] || {}), [a]: s } }
}
/** «Создание» — только да/нет: создавать «только свои» нельзя */
const scopesFor = (a: PermAction): PermScope[] => (a === 'create' ? ['none', 'all'] : ['none', 'own', 'all'])

const preset = computed(() => {
  const p = presetOf(role.value)?.permissions
  return { matrix: p?.matrix || {}, general: p?.general || [] }
})
const differs = (k: PermKind, a: PermAction) => scopeOf(k, a) !== (preset.value.matrix[k]?.[a] ?? 'none')
const generalDiffers = (key: string) => general.value.includes(key) !== preset.value.general.includes(key)
const diff = computed(() => diffFromPreset(preset.value, matrix.value, general.value,
  (props.model?.general || []).map((g) => g.key)))
const changed = computed(() => diffCount(diff.value))

const save = () => {
  const body: AdminUserUpdate = { permissions: changed.value ? diff.value : null }
  if (props.user && role.value !== props.user.role) body.role = role.value
  emit('save', body)
}
</script>

<style scoped>
.perm-table th,
.perm-table td {
  white-space: nowrap;
}
.perm-table__kind {
  white-space: normal !important;
  min-width: 170px;
}
.perm-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  margin-left: 4px;
  border-radius: 50%;
  background: rgb(var(--v-theme-primary));
  vertical-align: middle;
}
.perm-general {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
}
</style>
