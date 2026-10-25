<template>
  <!-- На телефоне — нижний лист: карта над ним остаётся рабочей; закрытие свайпом решает владелец -->
  <BottomSheet
    v-if="mobile"
    v-model:snap="sheetSnap"
    :model-value="modelValue"
    drag-selector="[data-card-drag]"
    aria-label="Карточка объекта"
    @dismiss="emit('dismiss')"
  >
    <slot />
  </BottomSheet>
  <!-- Окно свойств без затемнения карты: панель справа или плавающее окно (useObjectCardLayout) -->
  <div
    v-else-if="modelValue"
    ref="root"
    class="oc-shell"
    :class="[`oc-shell--${layout.mode}`, { 'oc-shell--dragging': dragging }]"
    :style="shellStyle"
    role="dialog"
    aria-modal="false"
    @pointerdown="onPointerDown"
  >
    <div
      v-if="layout.mode === 'panel'"
      class="oc-resize oc-resize--left"
      title="Ширина панели"
      @pointerdown.stop.prevent="startResize($event, 'panel')"
    />
    <slot />
    <div
      v-if="layout.mode === 'float'"
      class="oc-resize oc-resize--corner"
      title="Размер окна"
      @pointerdown.stop.prevent="startResize($event, 'float')"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue';
import { clampFloat, clampPanelWidth, useObjectCardLayout, type ObjectCardLayout } from '~/composables/useObjectCardLayout';
import { useUiStore } from '~/stores/uiStore';
import BottomSheet from '~/components/BottomSheet.vue';
import type { SheetSnap } from '~/utils/sheetSnap';

const props = defineProps<{ modelValue: boolean; mobile?: boolean }>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  /** Лист смахнут вниз на телефоне — закрыть просит владелец (подтверждение правок) */
  dismiss: [];
}>();

const layout = useObjectCardLayout();
const ui = useUiStore();
const root = ref<HTMLElement | null>(null);
const dragging = ref(false);
const viewport = ref({ w: 1280, h: 800 });
/** Положение нижнего листа; каждое открытие — с половины экрана */
const sheetSnap = ref<SheetSnap>('half');
watch(() => props.modelValue, (open) => { if (open) sheetSnap.value = 'half'; });

const updateViewport = () => {
  viewport.value = { w: window.innerWidth, h: window.innerHeight };
  if (layout.mode === 'float') Object.assign(layout.float, clampFloat(layout.float, viewport.value.w, viewport.value.h));
};

onMounted(() => {
  updateViewport();
  window.addEventListener('resize', updateViewport);
});
// Ширина панели справа — в менеджер панелей: полосы над картой центрируются по видимой части карты
watchEffect(() => {
  ui.setRightInset(props.modelValue && !props.mobile && layout.mode === 'panel'
    ? clampPanelWidth(layout.panelWidth, viewport.value.w)
    : 0);
});
// Карточка — панель менеджера (docs/ui-zones.md): на телефоне вытесняет «Инструменты» и «Измерения».
// Сама она менеджером не закрывается (evictable: false) — закрывает владелец с подтверждением правок
watch(() => props.modelValue, (open) => ui.setPanel('card', open), { immediate: true });
onBeforeUnmount(() => {
  ui.setRightInset(0);
  ui.setPanel('card', false);
  window.removeEventListener('resize', updateViewport);
  stopPointer();
});

const shellStyle = computed(() => {
  if (props.mobile) return {};
  if (layout.mode === 'panel') return { width: `${clampPanelWidth(layout.panelWidth, viewport.value.w)}px` };
  const f = clampFloat(layout.float, viewport.value.w, viewport.value.h);
  return { left: `${f.x}px`, top: `${f.y}px`, width: `${f.w}px`, height: `${f.h}px` };
});

// Перетаскивание плавающего окна — за элемент с data-card-drag (шапка карточки), не за кнопки.
// Пока кнопка нажата, геометрия пишется прямо в style корня один раз на кадр (rAF), а в реактивный
// layout — только на pointerup: иначе каждый pointermove перерисовывал всю карточку (замер S4a:
// 185 мс на шаг, docs/performance-baseline.md).
let move: ((e: PointerEvent) => void) | null = null;
let pendingGeometry: Partial<ObjectCardLayout['float']> & { panelWidth?: number } | null = null;
let geometryFrame = 0;
const applyPendingToDom = () => {
  geometryFrame = 0;
  const el = root.value;
  const g = pendingGeometry;
  if (!el || !g) return;
  if (g.panelWidth != null) el.style.width = `${g.panelWidth}px`;
  if (g.x != null) el.style.left = `${g.x}px`;
  if (g.y != null) el.style.top = `${g.y}px`;
  if (g.w != null) el.style.width = `${g.w}px`;
  if (g.h != null) el.style.height = `${g.h}px`;
};
const scheduleGeometry = (g: NonNullable<typeof pendingGeometry>) => {
  pendingGeometry = { ...pendingGeometry, ...g };
  if (!geometryFrame) geometryFrame = requestAnimationFrame(applyPendingToDom);
};
const stopPointer = () => {
  if (move) window.removeEventListener('pointermove', move);
  window.removeEventListener('pointerup', stopPointer);
  window.removeEventListener('pointercancel', stopPointer);
  move = null;
  if (geometryFrame) cancelAnimationFrame(geometryFrame);
  geometryFrame = 0;
  const g = pendingGeometry;
  pendingGeometry = null;
  // Inline-style больше не нужен: итог идёт через shellStyle (иначе при равном итоге Vue не перепатчит
  // стиль, и останется промежуточное положение из последнего кадра)
  if (root.value) root.value.style.cssText = '';
  if (g) {
    const { panelWidth, ...float } = g;
    if (panelWidth != null) layout.panelWidth = panelWidth;
    if (Object.keys(float).length) Object.assign(layout.float, float);
  }
  dragging.value = false;
};

const listenPointer = (handler: (e: PointerEvent) => void) => {
  move = handler;
  window.addEventListener('pointermove', handler);
  window.addEventListener('pointerup', stopPointer);
  window.addEventListener('pointercancel', stopPointer);
};

const onPointerDown = (e: PointerEvent) => {
  if (props.mobile || layout.mode !== 'float' || e.button !== 0) return;
  const target = e.target as HTMLElement | null;
  if (!target?.closest('[data-card-drag]') || target.closest('button, a, input, textarea, .v-field')) return;
  const start = { x: e.clientX, y: e.clientY, fx: layout.float.x, fy: layout.float.y };
  dragging.value = true;
  listenPointer((ev: PointerEvent) => {
    const f = clampFloat(
      { ...layout.float, x: start.fx + ev.clientX - start.x, y: start.fy + ev.clientY - start.y },
      viewport.value.w, viewport.value.h,
    );
    scheduleGeometry({ x: f.x, y: f.y });
  });
};

const startResize = (e: PointerEvent, what: 'panel' | 'float') => {
  const start = { x: e.clientX, y: e.clientY, w: layout.panelWidth, fw: layout.float.w, fh: layout.float.h };
  dragging.value = true;
  listenPointer((ev: PointerEvent) => {
    if (what === 'panel') {
      scheduleGeometry({ panelWidth: clampPanelWidth(start.w + start.x - ev.clientX, viewport.value.w) });
    } else {
      const f = clampFloat(
        { ...layout.float, w: start.fw + ev.clientX - start.x, h: start.fh + ev.clientY - start.y },
        viewport.value.w, viewport.value.h,
      );
      scheduleGeometry({ x: f.x, y: f.y, w: f.w, h: f.h });
    }
  });
};
</script>

<style scoped>
.oc-shell {
  position: fixed;
  z-index: var(--z-inspector);
  display: flex;
  flex-direction: column;
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.18);
}
.oc-shell--panel {
  top: 56px;
  right: 0;
  bottom: 0;
  border-left: 1px solid rgba(0, 0, 0, 0.1);
}
.oc-shell--float {
  border-radius: 12px;
  overflow: hidden;
}
.oc-shell--dragging {
  user-select: none;
}
.oc-shell :deep([data-card-drag]) {
  cursor: default;
}
.oc-shell--float :deep([data-card-drag]) {
  cursor: move;
}
.oc-resize {
  position: absolute;
  z-index: 2;
}
.oc-resize--left {
  left: -3px;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: ew-resize;
}
.oc-resize--corner {
  right: 0;
  bottom: 0;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
  background: linear-gradient(135deg, transparent 50%, rgba(0, 0, 0, 0.25) 50%);
}
</style>
