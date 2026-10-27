import type { IControl, Map as MapLibreMap } from 'maplibre-gl'

/**
 * Масштабная линейка карты (этап 10е). Встроенный `ScaleControl` MapLibre переписывает свой DOM на каждом кадре
 * движения, а это пересчёт вёрстки всего документа: с открытой панелью слоёв и журналом панорамирование падало
 * с 25 до 13 fps (замер S1, docs/performance-baseline.md). Здесь линейка обновляется только по окончании
 * движения: при панорамировании масштаб почти не меняется, при зуме — догоняет на moveend.
 * Классы — как у встроенной (`maplibregl-ctrl-scale`): тот же вид, и e2e/visual-hide-map.css её прячет.
 */

/** Длина линейки по умолчанию, px */
export const SCALE_MAX_WIDTH_PX = 100

/** Круглое число не больше `value`: 1, 2, 3, 5 × 10ⁿ */
export function roundScaleDistance(value: number): number {
  if (!(value > 0) || !Number.isFinite(value)) return 0
  const pow10 = 10 ** Math.floor(Math.log10(value))
  const d = value / pow10
  const step = d >= 10 ? 10 : d >= 5 ? 5 : d >= 3 ? 3 : d >= 2 ? 2 : 1
  return step * pow10
}

export interface ScaleBar {
  /** Ширина полосы, px */
  width: number
  /** Подпись: «500 м», «2 км» */
  label: string
}

/** Полоса и подпись для расстояния `metersAtMax`, которое укладывается в `maxWidth` px */
export function scaleBar(metersAtMax: number, maxWidth = SCALE_MAX_WIDTH_PX): ScaleBar | null {
  if (!(metersAtMax > 0) || !Number.isFinite(metersAtMax)) return null
  const useKm = metersAtMax >= 1000
  const total = useKm ? metersAtMax / 1000 : metersAtMax
  const rounded = roundScaleDistance(total)
  if (!rounded) return null
  return { width: Math.round(maxWidth * (rounded / total)), label: `${rounded} ${useKm ? 'км' : 'м'}` }
}

export class MapScaleControl implements IControl {
  private map: MapLibreMap | null = null
  private container: HTMLElement | null = null
  private readonly maxWidth: number

  constructor(maxWidth = SCALE_MAX_WIDTH_PX) {
    this.maxWidth = maxWidth
  }

  private readonly update = () => {
    const map = this.map
    const el = this.container
    if (!map || !el) return
    // расстояние по горизонтали через середину видимой высоты — как у встроенной линейки
    const y = map.getContainer().clientHeight / 2
    const left = map.unproject([0, y])
    const right = map.unproject([this.maxWidth, y])
    const bar = scaleBar(left.distanceTo(right), this.maxWidth)
    el.hidden = !bar
    if (!bar) return
    el.style.width = `${bar.width}px`
    el.textContent = bar.label
  }

  onAdd(map: MapLibreMap): HTMLElement {
    this.map = map
    const el = document.createElement('div')
    el.className = 'maplibregl-ctrl maplibregl-ctrl-scale'
    this.container = el
    map.on('moveend', this.update)
    // до первого moveend: размеры контейнера уже известны
    this.update()
    return el
  }

  onRemove(): void {
    this.map?.off('moveend', this.update)
    this.container?.remove()
    this.container = null
    this.map = null
  }
}
