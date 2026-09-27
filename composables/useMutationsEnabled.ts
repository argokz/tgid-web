import { useAuthStore } from '~/stores/authStore'

/**
 * Кнопки записи в журналах и атрибутах: роль editor+ и MUTATIONS_ENABLED на сервере
 * (флаги из /auth/config и /auth/me), а не флаг сборки.
 */
export function useMutationsEnabled() {
  const authStore = useAuthStore()
  return computed(() => authStore.canEditData)
}
