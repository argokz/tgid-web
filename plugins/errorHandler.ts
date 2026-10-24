import { isStaleChunkError } from '~/utils/staleChunk'

export default defineNuxtPlugin((nuxtApp: any) => {
  let staleChunkReported = false
  const showErrorToUser = (error?: unknown) => {
    if (!process.client) return
    try {
      const notificationStore = useNotificationStore()
      if (isStaleChunkError(error)) {
        // один раз: сообщений может прийти несколько (ошибка импорта и отклонённый промис)
        if (staleChunkReported) return
        staleChunkReported = true
        notificationStore.notify(
          'warning',
          'Приложение обновлено на сервере — откройте страницу заново, чтобы загрузить новую версию.',
          { label: 'Обновить', handler: () => window.location.reload() },
        )
        return
      }
      notificationStore.showError('Произошла непредвиденная ошибка')
    } catch {
      // Store may not be ready
    }
  }

  nuxtApp.vueApp.config.errorHandler = (error: any, instance: any, info: string) => {
    console.error('[Global Vue Error]:', error)
    console.error('Location:', info)
    showErrorToUser(error)
  }

  nuxtApp.hooks.hook('app:error', (error: any) => {
    console.error('[Nuxt App Error]:', error)
    showErrorToUser(error)
  })

  // Nuxt сам ловит ошибку импорта чанка после выкатки (hook app:chunkError) — тоже предлагаем обновить
  nuxtApp.hooks.hook('app:chunkError', ({ error }: { error: unknown }) => {
    console.error('[Chunk Error]:', error)
    showErrorToUser(error ?? new Error('Failed to fetch dynamically imported module'))
  })

  if (process.client) {
    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      console.error('[Unhandled Rejection]:', event.reason)
      showErrorToUser(event.reason)
    })

    window.addEventListener('error', (event: any) => {
      // «ResizeObserver loop …» — уведомление браузера, а не сбой (события без объекта ошибки):
      // окно «непредвиденная ошибка» на каждое такое — только пугает
      if (/ResizeObserver loop/i.test(String(event?.message ?? ''))) return
      console.error('[Window Error]:', event.error ?? event.message)
      showErrorToUser(event.error ?? event.message)
    })
  }
})
