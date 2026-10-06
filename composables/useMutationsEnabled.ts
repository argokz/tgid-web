import { computed } from 'vue'
import { useAuthStore } from '~/stores/authStore'
import type { Cap } from '~/utils/permissions'

/**
 * Кнопки записи в журналах и атрибутах: роль editor+ и MUTATIONS_ENABLED на сервере
 * (флаги из /auth/config и /auth/me), а не флаг сборки.
 *
 * cap — предметное право пользователя PostgreSQL (как require_roles(cap=…) на сервере):
 * оборудование — network, ремонты — repairs, коррозия — corrosion, ПТС — pts.
 */
export function useMutationsEnabled(cap?: Cap) {
  const authStore = useAuthStore()
  return computed(() => {
    switch (cap) {
      case 'network': return authStore.canEditNetwork
      case 'network_struct': return authStore.canEditNetworkStruct
      case 'repairs': return authStore.canEditRepairs
      case 'corrosion': return authStore.canEditCorrosion
      case 'pts': return authStore.canEditPts
      default: return authStore.canEditData
    }
  })
}
