<template>
  <div
    v-if="!failed"
    :key="attempt"
    class="lazy-dialog-boundary"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue'
import { useNotificationStore } from '~/stores/notificationStore'
import { formatApiError } from '~/utils/apiError'
import { isStaleChunkError } from '~/utils/staleChunk'

/**
 * Граница ошибок вокруг ленивого диалога (план, «Надёжность»): упавший журнал не роняет карту.
 * Ошибка загрузки чанка или рендера → содержимое размонтируется, уведомление с «Повторить» монтирует его
 * заново (ожидающий `openLazyDialog` дождётся нового экземпляра и откроет диалог). Устаревший чанк после
 * выкатки — «Обновить» страницу. В глобальный обработчик ошибка не всплывает: одного уведомления достаточно.
 */
const props = defineProps<{
  /** Название диалога для текста уведомления */
  name: string
}>()
const emit = defineEmits<{ error: [error: unknown] }>()

const notifications = useNotificationStore()
const failed = ref(false)
const attempt = ref(0)

const retry = () => {
  failed.value = false
  attempt.value += 1
}

onErrorCaptured((error) => {
  console.error(`[LazyDialogBoundary] «${props.name}»:`, error)
  failed.value = true
  if (isStaleChunkError(error)) {
    notifications.notify('warning', `«${props.name}» не загрузился: приложение обновлено на сервере — откройте страницу заново.`, {
      label: 'Обновить',
      handler: () => window.location.reload(),
    })
  } else {
    notifications.notify('error', `«${props.name}» не открылся: ${formatApiError(error, 'внутренняя ошибка')}`, {
      label: 'Повторить',
      handler: retry,
    })
  }
  emit('error', error)
  return false
})

defineExpose({ retry })
</script>

<style scoped>
.lazy-dialog-boundary { display: contents; }
</style>
