export default defineNuxtPlugin((nuxtApp: any) => {
  const showErrorToUser = () => {
    if (process.client) {
      try {
        const notificationStore = useNotificationStore()
        notificationStore.showError('Произошла непредвиденная ошибка')
      } catch {
        // Store may not be ready
      }
    }
  }

  nuxtApp.vueApp.config.errorHandler = (error: any, instance: any, info: string) => {
    console.error('[Global Vue Error]:', error)
    console.error('Location:', info)
    showErrorToUser()
  }

  nuxtApp.hooks.hook('app:error', (error: any) => {
    console.error('[Nuxt App Error]:', error)
    showErrorToUser()
  })

  if (process.client) {
    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      console.error('[Unhandled Rejection]:', event.reason)
      showErrorToUser()
    })

    window.addEventListener('error', (event: any) => {
      console.error('[Window Error]:', event.error)
      showErrorToUser()
    })
  }
})
