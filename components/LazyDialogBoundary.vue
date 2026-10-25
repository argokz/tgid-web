<template>
  <div
    v-if="!failed"
    :key="attempt"
    class="lazy-dialog-boundary"
  >
    <slot />
  </div>
</template>

<script lang="ts">
/**
 * Что делать с ошибкой потомка по `info` из `onErrorCaptured` (в dev — текст, в prod — ссылка с кодом):
 * `load` — не загрузился чанк (async component loader), `render` — компонент не может жить (setup, рендер,
 * монтирование, обновление), `pass` — ошибка обработчика или наблюдателя: компонент жив, правки не трогаем.
 */
export type BoundaryErrorKind = 'load' | 'render' | 'pass'

const LOAD_CODES = new Set(['13', 'async component loader'])
const RENDER_CODES = new Set([
  '0', '1', '15', 'bm', 'm',
  'setup function', 'render function', 'component update', 'beforeMount hook', 'mounted hook',
])

export const classifyBoundaryError = (info: string): BoundaryErrorKind => {
  const code = info.startsWith('https://vuejs.org/error-reference/#runtime-')
    ? info.slice('https://vuejs.org/error-reference/#runtime-'.length)
    : info
  if (LOAD_CODES.has(code)) return 'load'
  if (RENDER_CODES.has(code)) return 'render'
  return 'pass'
}
</script>

<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue'
import { useNotificationStore } from '~/stores/notificationStore'
import { formatApiError } from '~/utils/apiError'
import { isStaleChunkError } from '~/utils/staleChunk'

/**
 * Граница ошибок вокруг ленивого диалога (план, «Надёжность»): упавший журнал не роняет карту.
 * Не загрузился чанк — содержимое снимается, «Обновить» страницу: `defineAsyncComponent` хранит отклонённую
 * загрузку, а браузер — неудачный `import()`, повторное монтирование не поможет. Ошибка setup / рендера —
 * содержимое снимается, «Повторить» монтирует заново (`openLazyDialog` вызывает `retry` сам, если диалог
 * открывают снова). Ошибки обработчиков и наблюдателей граница не трогает: компонент и его несохранённые
 * правки остаются, ошибка уходит в глобальный обработчик.
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
const reload = () => window.location.reload()

onErrorCaptured((error, _instance, info) => {
  const kind = classifyBoundaryError(String(info ?? ''))
  if (kind === 'pass') return true
  console.error(`[LazyDialogBoundary] «${props.name}» (${info}):`, error)
  failed.value = true
  if (kind === 'load' || isStaleChunkError(error)) {
    const reason = isStaleChunkError(error) ? 'приложение обновлено на сервере' : 'файл не загрузился'
    notifications.notify('warning', `«${props.name}» не открылся: ${reason} — обновите страницу.`, {
      label: 'Обновить',
      handler: reload,
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

defineExpose({ retry, failed })
</script>

<style scoped>
.lazy-dialog-boundary { display: contents; }
</style>
