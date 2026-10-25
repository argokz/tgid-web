<template>
  <v-dialog
    v-model="visible"
    :fullscreen="mobile"
    :max-width="mobile ? undefined : 1100"
    scrollable
  >
    <v-card :rounded="mobile ? '0' : 'lg'">
      <v-card-title class="d-flex align-center ga-2 py-2">
        <v-icon>mdi-account-cog</v-icon>
        Пользователи и роли
        <v-spacer />
        <HintTip
          text="Обновить"
        >
          <template #default="{ props: tip }">
            <v-btn
              v-bind="tip"
              icon="mdi-refresh"
              variant="text"
              density="compact"
              :loading="panel?.loading"
              aria-label="Обновить"
              @click="panel?.load()"
            />
          </template>
        </HintTip>
        <HintTip
          text="Закрыть"
        >
          <template #default="{ props: tip }">
            <v-btn
              v-bind="tip"
              icon="mdi-close"
              variant="text"
              density="compact"
              aria-label="Закрыть"
              @click="visible = false"
            />
          </template>
        </HintTip>
      </v-card-title>

      <v-card-text class="pt-0">
        <UsersAdminPanel ref="panel" />
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useMobile } from '~/composables/useMobile'
import UsersAdminPanel from '~/components/UsersAdminPanel.vue'
import HintTip from '~/components/HintTip.vue'

const { isMobile: mobile } = useMobile()
const visible = ref(false)
const panel = ref<InstanceType<typeof UsersAdminPanel> | null>(null)

/** Список загружает панель при первом открытии; при повторных — обновить */
const openDialog = () => {
  const reopened = Boolean(panel.value)
  visible.value = true
  if (reopened) void panel.value?.load()
}

defineExpose({ openDialog })
</script>
