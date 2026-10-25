<template>
  <Teleport to="body">
    <div
      ref="rootRef"
      class="map-popover"
      :class="[`map-popover--${placement}`, { 'map-popover--hidden': !inView }]"
      :style="positionStyle"
      role="dialog"
      :aria-label="ariaLabel || title"
      tabindex="-1"
    >
      <header class="map-popover__header">
        <v-icon
          v-if="icon"
          size="20"
          color="primary"
          class="flex-shrink-0"
        >
          {{ icon }}
        </v-icon>
        <div class="map-popover__heading">
          <div
            class="map-popover__title text-truncate"
            :title="title"
          >
            {{ title }}
          </div>
          <div
            v-if="subtitle"
            class="map-popover__subtitle text-truncate"
          >
            {{ subtitle }}
          </div>
        </div>
        <v-btn
          icon
          variant="text"
          size="x-small"
          color="secondary"
          aria-label="Закрыть"
          @click="emit('close')"
        >
          <v-icon size="18">
            mdi-close
          </v-icon>
        </v-btn>
      </header>
      <div class="map-popover__body">
        <slot />
      </div>
      <footer
        v-if="$slots.actions"
        class="map-popover__actions"
      >
        <slot name="actions" />
      </footer>
      <span
        class="map-popover__tip"
        aria-hidden="true"
      />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { CSSProperties } from 'vue'
import { registerHotkeys } from '~/composables/useHotkeys'
import { holdsEscape } from '~/utils/escapeKey'

/** То, что поповеру нужно от карты MapLibre: проекция точки, контейнер, события перемещения */
export interface MapPopoverMap {
  project: (lngLat: [number, number]) => { x: number; y: number }
  getContainer: () => HTMLElement
  on: (type: string, listener: () => void) => unknown
  off: (type: string, listener: () => void) => unknown
}

/**
 * Поповер у точки карты (docs/ui-primitives.md): привязан к координате, следует за ней при сдвиге и зуме
 * (карта остаётся интерактивной), у верхнего края раскрывается вниз, точка ушла за карту — прячется.
 * Esc закрывает (область `popover` реестра хоткеев), фокус при открытии — на первое действие, при закрытии
 * возвращается туда, где был. Содержимое и действия — слоты владельца.
 */
const props = withDefaults(defineProps<{
  map: MapPopoverMap
  lngLat: [number, number]
  title: string
  subtitle?: string
  icon?: string
  ariaLabel?: string
}>(), {
  subtitle: '',
  icon: '',
  ariaLabel: '',
})
const emit = defineEmits<{ close: [] }>()

/** Отступ стрелки от точки и поля до края окна, px */
const ANCHOR_GAP = 12
const VIEWPORT_MARGIN = 8

const rootRef = ref<HTMLElement | null>(null)
const anchor = ref({ x: 0, y: 0 })
const size = ref({ width: 0, height: 0 })
const inView = ref(true)

const placement = computed<'top' | 'bottom'>(() =>
  anchor.value.y - size.value.height - ANCHOR_GAP < VIEWPORT_MARGIN ? 'bottom' : 'top')

const positionStyle = computed<CSSProperties>(() => {
  const { width, height } = size.value
  const maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN)
  const left = Math.min(Math.max(anchor.value.x - width / 2, VIEWPORT_MARGIN), maxLeft)
  const top = placement.value === 'top' ? anchor.value.y - height - ANCHOR_GAP : anchor.value.y + ANCHOR_GAP
  // стрелка остаётся над точкой, даже когда сам поповер прижат к краю окна
  const tip = Math.min(Math.max(anchor.value.x - left, 16), Math.max(16, width - 16))
  return { left: `${left}px`, top: `${top}px`, '--map-popover-tip': `${tip}px` } as CSSProperties
})

let frame = 0
const update = () => {
  frame = 0
  const container = props.map.getContainer()
  const rect = container.getBoundingClientRect()
  const point = props.map.project(props.lngLat)
  inView.value = point.x >= 0 && point.y >= 0 && point.x <= rect.width && point.y <= rect.height
  anchor.value = { x: rect.left + point.x, y: rect.top + point.y }
  const el = rootRef.value
  if (el) size.value = { width: el.offsetWidth, height: el.offsetHeight }
}
const scheduleUpdate = () => {
  if (!frame) frame = requestAnimationFrame(update)
}

let focusBefore: HTMLElement | null = null
onMounted(async () => {
  props.map.on('move', scheduleUpdate)
  props.map.on('resize', scheduleUpdate)
  window.addEventListener('resize', scheduleUpdate)
  update()
  await nextTick()
  update() // размер известен только после отрисовки содержимого
  focusBefore = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const first = rootRef.value?.querySelector<HTMLElement>('.map-popover__actions button:not([disabled])')
  const target = first ?? rootRef.value
  target?.focus({ preventScroll: true })
})
watch(() => props.lngLat, () => nextTick(update))

const disposeHotkeys = registerHotkeys({
  id: 'map-popover-escape',
  area: 'popover',
  allowInInput: true,
  handle: (ev) => {
    if (ev.key !== 'Escape' || holdsEscape(ev.target)) return false
    emit('close')
    return true
  },
})

onBeforeUnmount(() => {
  disposeHotkeys()
  if (frame) cancelAnimationFrame(frame)
  props.map.off('move', scheduleUpdate)
  props.map.off('resize', scheduleUpdate)
  window.removeEventListener('resize', scheduleUpdate)
  if (focusBefore?.isConnected) focusBefore.focus({ preventScroll: true })
})

defineExpose({ update })
</script>

<style scoped>
.map-popover {
  position: fixed;
  z-index: var(--z-popover);
  width: min(344px, calc(100vw - 16px));
  display: flex;
  flex-direction: column;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-3);
  animation: map-popover-in var(--duration-base) var(--ease-out);
}
.map-popover:focus { outline: none; }
.map-popover--hidden { visibility: hidden; }
.map-popover__header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-2) var(--space-1) var(--space-3);
}
.map-popover__heading { flex: 1 1 auto; min-width: 0; }
.map-popover__title { font-weight: 600; font-size: 0.9rem; }
.map-popover__subtitle { font-size: 0.75rem; color: rgba(var(--v-theme-on-surface), 0.6); }
.map-popover__body { padding: 0 var(--space-3) var(--space-2); }
.map-popover__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-3);
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.map-popover__tip {
  position: absolute;
  left: var(--map-popover-tip, 50%);
  width: 12px;
  height: 12px;
  background: inherit;
  transform: translateX(-50%) rotate(45deg);
}
.map-popover--top .map-popover__tip { bottom: -6px; box-shadow: 2px 2px 3px rgba(15, 23, 42, 0.08); }
.map-popover--bottom .map-popover__tip { top: -6px; }
@keyframes map-popover-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: none; }
}
</style>
