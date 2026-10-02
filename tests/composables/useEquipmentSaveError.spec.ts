import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useEquipmentSaveError } from '~/composables/useEquipmentSaveError'
import {
  EQUIPMENT_CONFLICT_TEXT,
  EquipmentConflictError,
  equipmentEditService,
  saveEquipmentEdit,
} from '~/services/equipmentEditService'
import { useNotificationStore } from '~/stores/notificationStore'

describe('equipment save errors (QA F50)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  it('409 from PUT becomes EquipmentConflictError', async () => {
    vi.spyOn(equipmentEditService, 'get').mockResolvedValue({
      table: 'pumps', label: 'Насосы', id: 1, fields: [], version: '10', values: { number: 'A' },
    })
    vi.spyOn(equipmentEditService, 'update').mockRejectedValue(Object.assign(new Error('raw'), { status: 409 }))
    await expect(saveEquipmentEdit('pumps', 1, { number: 'B' })).rejects.toBeInstanceOf(EquipmentConflictError)
  })

  it('other errors keep the server text', async () => {
    vi.spyOn(equipmentEditService, 'get').mockResolvedValue({
      table: 'pumps', label: 'Насосы', id: 2, fields: [], version: '10', values: { number: 'A' },
    })
    vi.spyOn(equipmentEditService, 'update').mockRejectedValue({ status: 422, data: { detail: 'Поле number: слишком длинное' } })
    await expect(saveEquipmentEdit('pumps', 2, { number: 'B' })).rejects.toThrow('Поле number: слишком длинное')
  })

  it('conflict: text in the card and a reload action in the notification', async () => {
    const notify = useNotificationStore()
    const spy = vi.spyOn(notify, 'showConflict')
    const reload = vi.fn()
    const { saveError, reportSaveError } = useEquipmentSaveError()
    reportSaveError(new EquipmentConflictError(), reload)
    expect(saveError.value).toBe(EQUIPMENT_CONFLICT_TEXT)
    expect(spy).toHaveBeenCalledWith(EQUIPMENT_CONFLICT_TEXT, expect.any(Function))
    await spy.mock.calls[0][1]()
    expect(reload).toHaveBeenCalled()
    expect(saveError.value).toBe('')
  })

  it('plain error: only the card text, no conflict notification', () => {
    const spy = vi.spyOn(useNotificationStore(), 'showConflict')
    const { saveError, reportSaveError } = useEquipmentSaveError()
    reportSaveError(new Error('Нет прав на правку'), vi.fn())
    expect(saveError.value).toBe('Нет прав на правку')
    expect(spy).not.toHaveBeenCalled()
  })
})
