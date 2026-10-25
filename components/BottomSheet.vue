<template>
  <div
    v-if="modelValue"
    ref="sheetRef"
    class="bottom-sheet"
    :class="{ 'bottom-sheet--dragging': dragging }"
    :style="sheetStyle"
    role="dialog"
    aria-modal="false"
    :aria-label="ariaLabel"
    @pointerdown="onSheetPointerDown"
  >
    <div class="bottom-sheet__content">
      <button
        type="button"
        class="bottom-sheet__handle"
        :aria-label="handleLabel"
        @pointerdown.stop="startDrag"
        @click="onHandleClick"
      >
        <span
          class="bottom-sheet__grip"
          aria-hidden="true"
        />
      </button>
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { CSSProperties } from 'vue'
import { nextSheetSnap, settleSheet, sheetHeights, type SheetSnap } from '~/utils/sheetSnap'

/**
 * Нижний лист для телефона (docs/ui-primitives.md): три положения — низко, половина, почти весь экран.
 * Тянется за ручку и за элементы `dragSelector` (шапку), кнопки и поля внутри не перехватываются; содержимое
 * прокручивается само, карта над листом остаётся рабочей. Бросок — на соседнее положение, ниже низкого —
 * событие `dismiss` (закрывает владелец: у него может быть подтверждение несохранённых правок).
 */
const props = withDefaults(defineProps<{
  modelValue: boolean
  ariaLabel?: string
  /** За какие элементы, кроме ручки, можно тянуть лист */
  dragSelector?: string
}>(), {
  ariaLabel: '',
  dragSelector: '[data-sheet-drag]',
})
const emit = defineEmits<{ dismiss: [] }>()
/** Положение листа; без `v-model:snap` хранится внутри */
const snap = defineModel<SheetSnap>('snap', { default: 'half' })

/** Сдвиг пальца, после которого нажатие на ручку считается перетаскиванием, а не кликом */
const DRAG_SLOP = 4
/** Последнее движение старше этого — скорость при отпускании считается нулевой, мс */
const FLICK_WINDOW_MS = 100
const INTERACTIVE = 'button, a, input, textarea, select, [role="button"], [contenteditable="true"]'

const sheetRef = ref<HTMLElement | null>(null)
const viewportHeight = ref(800)
const dragging = ref(false)
const heights = computed(() => sheetHeights(viewportHeight.value))
const settled = computed(() => heights.value[snap.value])

const sheetStyle = computed<CSSProperties>(() => ({
  height: `${heights.value.full}px`,
  transform: `translateY(${heights.value.full - settled.value}px)`,
  '--sheet-visible': `${settled.value}px`,
} as CSSProperties))

const handleLabel = computed(() => (snap.value === 'full' ? 'Свернуть' : 'Развернуть'))

const updateViewport = () => {
  viewportHeight.value = window.visualViewport?.height ?? window.innerHeight
}
onMounted(() => {
  updateViewport()
  window.addEventListener('resize', updateViewport)
  window.visualViewport?.addEventListener('resize', updateViewport)
})

let startY = 0
let startVisible = 0
let lastY = 0
let lastTime = 0
let velocity = 0
let moved = false
let frame = 0
let pointerId: number | null = null

const applyVisible = (visible: number) => {
  const el = sheetRef.value
  if (el) el.style.transform = `translateY(${heights.value.full - visible}px)`
}
const currentVisible = (y: number) => Math.min(heights.value.full, Math.max(0, startVisible + (startY - y)))

const onMove = (e: PointerEvent) => {
  if (e.pointerId !== pointerId) return
  if (!moved && Math.abs(e.clientY - startY) < DRAG_SLOP) return
  moved = true
  dragging.value = true
  const now = e.timeStamp || performance.now()
  if (now > lastTime) velocity = (lastY - e.clientY) / (now - lastTime)
  lastY = e.clientY
  lastTime = now
  if (!frame) {
    frame = requestAnimationFrame(() => {
      frame = 0
      applyVisible(currentVisible(lastY))
    })
  }
}

const stopListening = () => {
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointercancel', onUp)
  if (frame) cancelAnimationFrame(frame)
  frame = 0
  pointerId = null
}

function onUp(e: PointerEvent) {
  if (e.pointerId !== pointerId) return
  stopListening()
  if (!moved) return
  dragging.value = false
  // палец остановился перед отпусканием — это не бросок
  const releaseVelocity = (e.timeStamp || performance.now()) - lastTime > FLICK_WINDOW_MS ? 0 : velocity
  const target = settleSheet(currentVisible(e.clientY), releaseVelocity, heights.value)
  // прямую запись стиля возвращаем к положению: если оно не изменилось, Vue стиль не перепишет.
  // Закрытие — решение владельца (может отказаться из-за несохранённых правок): лист пока на месте
  if (target === 'dismiss') {
    applyVisible(settled.value)
    emit('dismiss')
    return
  }
  applyVisible(heights.value[target])
  snap.value = target
}

function startDrag(e: PointerEvent) {
  if (e.button !== 0 || pointerId !== null) return
  pointerId = e.pointerId
  startY = e.clientY
  lastY = e.clientY
  lastTime = e.timeStamp || performance.now()
  startVisible = settled.value
  velocity = 0
  moved = false
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
}

const onSheetPointerDown = (e: PointerEvent) => {
  const target = e.target as HTMLElement | null
  if (!target?.closest(props.dragSelector) || target.closest(INTERACTIVE)) return
  startDrag(e)
}

const onHandleClick = () => {
  if (moved) {
    moved = false
    return
  }
  snap.value = nextSheetSnap(snap.value)
}

// Лист закрыт посреди перетаскивания — слушатели окна не должны остаться
watch(() => props.modelValue, (open) => {
  if (!open) {
    stopListening()
    dragging.value = false
  }
})

onBeforeUnmount(() => {
  stopListening()
  window.removeEventListener('resize', updateViewport)
  window.visualViewport?.removeEventListener('resize', updateViewport)
})
</script>

<style scoped>
.bottom-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: var(--z-inspector);
  display: flex;
  flex-direction: column;
  background: rgb(var(--v-theme-surface));
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  box-shadow: var(--shadow-3);
  transition: transform var(--duration-slow) var(--ease-out);
  will-change: transform;
}
.bottom-sheet--dragging {
  transition: none;
  user-select: none;
}
/* видимая часть листа: содержимое прокручивается в ней, а не уходит под край экрана */
.bottom-sheet__content {
  display: flex;
  flex-direction: column;
  height: var(--sheet-visible);
  min-height: 0;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  overflow: hidden;
}
.bottom-sheet :deep([data-sheet-drag]),
.bottom-sheet :deep([data-card-drag]) {
  touch-action: none;
}
.bottom-sheet__handle {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 100%;
  min-height: 24px;
  padding: var(--space-2) 0 var(--space-1);
  border: 0;
  background: transparent;
  cursor: grab;
  touch-action: none;
}
.bottom-sheet__handle:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: -2px; }
.bottom-sheet__grip {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: rgba(var(--v-theme-on-surface), 0.25);
}
</style>
