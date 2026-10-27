import { ref, watch } from 'vue'
import { appStorage } from '~/utils/appStorage'
import { coordCopyText, copyFormatFor, type CursorPoint, type PointCrs } from '~/utils/pointCrs'
import { fastApiService } from '~/services/fastApiService'
import { useNotificationStore } from '~/stores/notificationStore'

/**
 * Система координат, выбранная в строке координат внизу карты (CursorCoords): WGS84, местная (9998, м)
 * или десктоп (см). Одна на приложение — копирование координат объекта (меню редактора) идёт в ней же,
 * а не всегда в WGS84.
 */
const CRS_KEY = 'cursorCoordsCrs'
const CRS_VALUES: readonly PointCrs[] = ['wgs84', 'local', 'desktop']

const readSaved = (): PointCrs => {
  try {
    const v = appStorage.getItem(CRS_KEY)
    return CRS_VALUES.includes(v as PointCrs) ? (v as PointCrs) : 'wgs84'
  } catch {
    return 'wgs84'
  }
}

const crs = ref<PointCrs>(readSaved())
watch(crs, (v) => {
  try {
    appStorage.setItem(CRS_KEY, v)
  } catch {
    // удобство: без хранилища — до перезагрузки
  }
})

/** Подпись формата для меню: что окажется в буфере */
export const COPY_HINT: Record<PointCrs, string> = {
  wgs84: 'широта, долгота',
  local: 'местная X Y, м',
  desktop: 'десктоп x y, см',
}

/** Текст точки в выбранной системе; местная и десктоп — пересчёт на сервере. null — пересчёт не удался */
export const pointTextInCrs = async (system: PointCrs, lng: number, lat: number): Promise<string | null> => {
  const point: CursorPoint = { lng, lat, converted: null }
  if (system !== 'wgs84') {
    try {
      point.converted = await fastApiService.convertPoint('wgs84', lng, lat)
    } catch {
      return null
    }
  }
  return coordCopyText(copyFormatFor(system), point)
}

/** Скопировать точку в выбранной системе с уведомлением; не пересчиталась — подсказать WGS84 */
const copyPoint = async (lng: number, lat: number): Promise<void> => {
  const notify = useNotificationStore()
  const text = await pointTextInCrs(crs.value, lng, lat)
  if (!text) {
    notify.showWarning('Не удалось пересчитать координаты — выберите внизу карты WGS84 и скопируйте снова.')
    return
  }
  try {
    await navigator.clipboard.writeText(text)
    notify.showSuccess(`Скопировано: ${text}`)
  } catch {
    notify.showWarning(`Буфер обмена недоступен: ${text}`)
  }
}

export const useCoordCrs = () => ({ crs, copyPoint })
