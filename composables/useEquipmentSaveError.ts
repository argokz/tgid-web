import { ref } from 'vue'
import { isEquipmentConflict } from '~/services/equipmentEditService'
import { useNotificationStore } from '~/stores/notificationStore'
import { formatApiError } from '~/utils/apiError'

/**
 * Ошибка сохранения карточки оборудования (QA F50): текст показывается в самой карточке
 * правки, а конфликт версий (409) ещё и уведомлением с кнопкой «Перезагрузить объект».
 */
export function useEquipmentSaveError() {
  const saveError = ref('')

  const clearSaveError = () => {
    saveError.value = ''
  }

  const reportSaveError = (cause: unknown, reload: () => void | Promise<void>) => {
    const message = formatApiError(cause, 'Ошибка при сохранении')
    saveError.value = message
    if (isEquipmentConflict(cause)) {
      useNotificationStore().showConflict(message, async () => {
        saveError.value = ''
        await reload()
      })
    }
  }

  return { saveError, clearSaveError, reportSaveError }
}
