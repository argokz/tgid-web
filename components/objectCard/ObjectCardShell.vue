<template>
  <!-- Окно свойств без затемнения карты: панель справа или плавающее окно (useObjectCardLayout) -->
  <div
    v-if="modelValue"
    ref="root"
    class="oc-shell"
    :class="[`oc-shell--${mobile ? 'mobile' : layout.mode}`, { 'oc-shell--dragging': dragging }]"
    :style="shellStyle"
    role="dialog"
    aria-modal="false"
    @pointerdown="onPointerDown"
  >
    <div
      v-if="!mobile && layout.mode === 'panel'"
      class="oc-resize oc-resize--left"
      title="Ширина панели"
      @pointerdown.stop.prevent="startResize($event, 'panel')"
    />
    <slot />
    <div
      v-if="!mobile && layout.mode === 'float'"
      class="oc-resize oc-resize--corner"
      title="Размер окна"
      @pointerdown.stop.prevent="startResize($event, 'float')"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue';
import { cardPanelInset, clampFloat, clampPanelWidth, useObjectCardLayout } from '~/composables/useObjectCardLayout';

const props = defineProps<{ modelValue: boolean; mobile?: boolean }>();
defineEmits<{ 'update:modelValue': [value: boolean] }>();

const layout = useObjectCardLayout();
const root = ref<HTMLElement | null>(null);
const dragging = ref(false);
const viewport = ref({ w: 1280, h: 800 });

const updateViewport = () => {
  viewport.value = { w: window.innerWidth, h: window.innerHeight };
  if (layout.mode === 'float') Object.assign(layout.float, clampFloat(layout.float, viewport.value.w, viewport.value.h));
};

onMounted(() => {
  updateViewport();
  window.addEventListener('resize', updateViewport);
});
watchEffect(() => {
  cardPanelInset.value = props.modelValue && !props.mobile && layout.mode === 'panel'
    ? clampPanelWidth(layout.panelWidth, viewport.value.w)
    : 0;
});
onBeforeUnmount(() => {
  cardPanelInset.value = 0;
  window.removeEventListener('resize', updateViewport);
  stopPointer();
});

const shellStyle = computed(() => {
  if (props.mobile) return {};
  if (layout.mode === 'panel') return { width: `${clampPanelWidth(layout.panelWidth, viewport.value.w)}px` };
  const f = clampFloat(layout.float, viewport.value.w, viewport.value.h);
  return { left: `${f.x}px`, top: `${f.y}px`, width: `${f.w}px`, height: `${f.h}px` };
});

// Перетаскивание плавающего окна — за элемент с data-card-drag (шапка карточки), не за кнопки
let move: ((e: PointerEvent) => void) | null = null;
const stopPointer = () => {
  if (move) window.removeEventListener('pointermove', move);
  window.removeEventListener('pointerup', stopPointer);
  move = null;
  dragging.value = false;
};

const onPointerDown = (e: PointerEvent) => {
  if (props.mobile || layout.mode !== 'float' || e.button !== 0) return;
  const target = e.target as HTMLElement | null;
  if (!target?.closest('[data-card-drag]') || target.closest('button, a, input, textarea, .v-field')) return;
  const start = { x: e.clientX, y: e.clientY, fx: layout.float.x, fy: layout.float.y };
  dragging.value = true;
  move = (ev: PointerEvent) => {
    Object.assign(layout.float, clampFloat(
      { ...layout.float, x: start.fx + ev.clientX - start.x, y: start.fy + ev.clientY - start.y },
      viewport.value.w, viewport.value.h,
    ));
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', stopPointer);
};

const startResize = (e: PointerEvent, what: 'panel' | 'float') => {
  const start = { x: e.clientX, y: e.clientY, w: layout.panelWidth, fw: layout.float.w, fh: layout.float.h };
  dragging.value = true;
  move = (ev: PointerEvent) => {
    if (what === 'panel') {
      layout.panelWidth = clampPanelWidth(start.w + start.x - ev.clientX, viewport.value.w);
    } else {
      Object.assign(layout.float, clampFloat(
        { ...layout.float, w: start.fw + ev.clientX - start.x, h: start.fh + ev.clientY - start.y },
        viewport.value.w, viewport.value.h,
      ));
    }
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', stopPointer);
};
</script>

<style scoped>
.oc-shell {
  position: fixed;
  z-index: 1006;
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
.oc-shell--mobile {
  inset: 0;
  z-index: 2400;
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
