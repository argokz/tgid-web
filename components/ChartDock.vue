<template>
  <Teleport to="body">
    <BottomSheet
      v-if="modelValue && isMobile"
      v-model:snap="sheetSnap"
      :model-value="true"
      :aria-label="title"
      @dismiss="close"
    >
      <div class="chart-dock chart-dock--sheet">
        <header
          class="chart-dock__header"
          data-sheet-drag
        >
          <v-icon
            v-if="icon"
            color="primary"
            size="20"
          >
            {{ icon }}
          </v-icon>
          <div class="chart-dock__heading">
            <div class="chart-dock__title text-truncate">
              {{ title }}
            </div>
            <div
              v-if="subtitle"
              class="chart-dock__subtitle text-truncate"
            >
              {{ subtitle }}
            </div>
          </div>
          <HintTip
            text="Закрыть"
          >
            <template #default="{ props: tip }">
              <v-btn
                v-bind="tip"
                icon
                size="small"
                variant="text"
                aria-label="Закрыть"
                @click="close"
              >
                <v-icon>mdi-close</v-icon>
              </v-btn>
            </template>
          </HintTip>
        </header>
        <div
          v-if="$slots.actions"
          class="chart-dock__actions chart-dock__actions--row"
        >
          <slot name="actions" />
        </div>
        <div class="chart-dock__body">
          <slot />
        </div>
      </div>
    </BottomSheet>

    <Transition name="motion-panel-up">
      <section
        v-if="modelValue && !isMobile"
        ref="dockRef"
        class="chart-dock chart-dock--desktop"
        :class="{ 'chart-dock--collapsed': collapsed }"
        :style="dockStyle"
        role="region"
        :aria-label="title"
      >
        <header class="chart-dock__header">
          <v-icon
            v-if="icon"
            color="primary"
            size="20"
          >
            {{ icon }}
          </v-icon>
          <div class="chart-dock__heading">
            <div class="chart-dock__title text-truncate">
              {{ title }}
            </div>
            <div
              v-if="subtitle"
              class="chart-dock__subtitle text-truncate"
            >
              {{ subtitle }}
            </div>
          </div>
          <div
            v-if="$slots.actions && !collapsed"
            class="chart-dock__actions"
          >
            <slot name="actions" />
          </div>
          <HintTip
            :text="collapsed ? 'Развернуть панель' : 'Свернуть панель'"
            hint="Карта под панелью остаётся рабочей"
            location="top"
          >
            <template #default="{ props: tip }">
              <v-btn
                v-bind="tip"
                icon
                size="small"
                variant="text"
                :aria-expanded="!collapsed"
                :aria-label="collapsed ? 'Развернуть панель' : 'Свернуть панель'"
                @click="collapsed = !collapsed"
              >
                <v-icon>{{ collapsed ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
              </v-btn>
            </template>
          </HintTip>
          <HintTip
            text="Закрыть"
            hotkey="Esc"
            location="top"
          >
            <template #default="{ props: tip }">
              <v-btn
                v-bind="tip"
                icon
                size="small"
                variant="text"
                aria-label="Закрыть"
                @click="close"
              >
                <v-icon>mdi-close</v-icon>
              </v-btn>
            </template>
          </HintTip>
        </header>
        <div
          v-show="!collapsed"
          class="chart-dock__body"
        >
          <slot />
        </div>
      </section>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import BottomSheet from '~/components/BottomSheet.vue'
import HintTip from '~/components/HintTip.vue'
import { useEscapeClose } from '~/composables/useEscape'
import { useMobile } from '~/composables/useMobile'
import { useUiStore } from '~/stores/uiStore'
import type { SheetSnap } from '~/utils/sheetSnap'

/**
 * Панель графиков у нижнего края (docs/ui-primitives.md, этап 6): на десктопе — сворачиваемая полоса над картой
 * (карта остаётся видимой и рабочей — график можно сверять с ней), на телефоне — `BottomSheet`. Не перекрывает
 * колонку контролов карты и карточку объекта справа (`uiStore.rightInset`). Закрытие — крестик или Esc
 * (стек панелей); свёрнутая панель держит только шапку.
 */
const props = withDefaults(defineProps<{
  modelValue: boolean
  title: string
  subtitle?: string
  icon?: string
  /** Высота развёрнутой панели (CSS) */
  height?: string
}>(), {
  subtitle: '',
  icon: '',
  height: 'min(46vh, 560px)'
})

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const collapsed = defineModel<boolean>('collapsed', { default: false })

const { isMobile } = useMobile()
const ui = useUiStore()
const sheetSnap = ref<SheetSnap>('half')

/** Справа — колонка контролов карты (56 px + отступы) и открытая панель карточки */
const CONTROLS_GUTTER_PX = 84
/** Отступ слева — от края карты или от открытой панели слоёв */
const DOCK_SIDE_GAP_PX = 16
const dockStyle = computed(() => ({
  right: `${ui.rightInset + CONTROLS_GUTTER_PX}px`,
  left: `${ui.leftInset + DOCK_SIDE_GAP_PX}px`,
  '--chart-dock-height': props.height
}))

const close = () => emit('update:modelValue', false)

/** Высота панели (с отступом снизу) — в `uiStore.bottomInset`: перелёт к узлу ставит его над панелью */
const DOCK_BOTTOM_GAP_PX = 12
const dockRef = ref<HTMLElement | null>(null)
let resizeObserver: ResizeObserver | null = null
watch(dockRef, (el) => {
  resizeObserver?.disconnect()
  resizeObserver = null
  if (!el) {
    ui.setBottomInset(0)
    return
  }
  if (typeof ResizeObserver === 'undefined') {
    ui.setBottomInset(el.offsetHeight + DOCK_BOTTOM_GAP_PX)
    return
  }
  const measure = () => ui.setBottomInset(el.offsetHeight + DOCK_BOTTOM_GAP_PX)
  measure()
  resizeObserver = new ResizeObserver(measure)
  resizeObserver.observe(el)
})
onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  ui.setBottomInset(0)
})

useEscapeClose({ open: () => props.modelValue, close })

// каждое открытие — развёрнутой и с половины листа
watch(() => props.modelValue, (open) => {
  if (!open) return
  collapsed.value = false
  sheetSnap.value = 'half'
})
</script>

<style scoped>
.chart-dock { display: flex; flex-direction: column; min-height: 0; }
.chart-dock--desktop {
  position: fixed;
  left: var(--space-4, 16px);
  bottom: calc(var(--space-3, 12px) + var(--safe-bottom, 0px));
  z-index: var(--z-toolbar);
  border-radius: var(--radius-3, 12px);
  background: rgb(var(--v-theme-surface));
  box-shadow: var(--shadow-3);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  overflow: hidden;
  transition: box-shadow var(--duration-2, 200ms) var(--ease-out, ease-out);
}
.chart-dock--sheet { height: 100%; }
.chart-dock__header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  flex-shrink: 0;
}
.chart-dock--collapsed .chart-dock__header { border-bottom: 0; }
.chart-dock__heading { flex: 1 1 auto; min-width: 0; }
.chart-dock__title { font-weight: 600; font-size: var(--text-sm, 0.875rem); }
.chart-dock__subtitle {
  font-size: var(--text-xs, 0.75rem);
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-variant-numeric: tabular-nums;
}
.chart-dock__actions { display: flex; align-items: center; gap: var(--space-1); flex-shrink: 0; }
.chart-dock__actions--row {
  padding: var(--space-1) var(--space-3);
  overflow-x: auto;
  scrollbar-width: none;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.chart-dock__actions--row > * { flex-shrink: 0; }
.chart-dock--desktop .chart-dock__body { height: var(--chart-dock-height); overflow: auto; }
.chart-dock--sheet .chart-dock__body { flex: 1; min-height: 0; overflow: auto; }
</style>
