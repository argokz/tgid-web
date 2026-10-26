<template>
  <v-tooltip
    v-model="open"
    :location="location"
    :disabled="disabled || !text"
    :open-delay="openDelay"
    :close-delay="HOVER_BRIDGE_MS"
    open-on-focus
    content-class="hint-tip"
    :aria-label="ariaText || undefined"
  >
    <template #activator="{ props: activatorProps }">
      <slot :props="withLongPress(activatorProps)" />
    </template>
    <div class="hint-tip__title">
      <span>{{ text }}</span>
      <kbd
        v-if="hotkey"
        class="hint-tip__key"
      >{{ hotkey }}</kbd>
    </div>
    <div
      v-if="hint"
      class="hint-tip__hint"
    >{{ hint }}</div>
  </v-tooltip>
</template>

<script setup lang="ts">
import { computed, mergeProps, onBeforeUnmount, ref } from 'vue';

/**
 * HintTip — обёртка над v-tooltip с единым содержимым для всех иконочных кнопок (docs/ui-primitives.md):
 * название действия в повелительном наклонении («Построить пьезометр»), хоткей, одна строка пояснения.
 * aria-label у самой кнопки остаётся — подсказка её не заменяет. Палец: наведения нет — подсказка по долгому
 * нажатию (полсекунды), держится 2,5 с; отпускание после долгого нажатия не нажимает кнопку.
 */
const props = withDefaults(defineProps<{
  /** Название действия */
  text: string;
  /** Хоткей как показывается пользователю: «Esc», «Ctrl+K», «L» */
  hotkey?: string;
  /** Одна строка «что сделает» */
  hint?: string;
  location?: 'top' | 'bottom' | 'start' | 'end' | 'left' | 'right';
  disabled?: boolean;
  openDelay?: number;
}>(), {
  hotkey: '',
  hint: '',
  location: 'top',
  disabled: false,
  openDelay: 400,
});

/** Пауза перед скрытием: успеть перевести курсор с кнопки на подсказку (WCAG 1.4.13 hoverable) */
const HOVER_BRIDGE_MS = 80;

const open = ref(false);

/** Долгое нажатие пальцем: через сколько показать подсказку, сколько держать, какой сдвиг — уже прокрутка */
const LONG_PRESS_MS = 500;
const TOUCH_HINT_MS = 2500;
const LONG_PRESS_SLOP_PX = 10;
/** Click после отпускания приходит сразу; не пришёл (палец ушёл с кнопки, pointercancel) — флаг снимается сам */
const SWALLOW_CLICK_MS = 400;

let pressTimer: ReturnType<typeof setTimeout> | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let pressStart: { x: number; y: number } | null = null;
/** Долгое нажатие сработало — следующий click (на отпускании) — не нажатие кнопки */
let swallowClick = false;
let swallowTimer: ReturnType<typeof setTimeout> | null = null;

const resetSwallow = () => {
  if (swallowTimer) clearTimeout(swallowTimer);
  swallowTimer = null;
  swallowClick = false;
};
const releasePress = () => {
  cancelPress();
  if (!swallowClick) return;
  if (swallowTimer) clearTimeout(swallowTimer);
  swallowTimer = setTimeout(resetSwallow, SWALLOW_CLICK_MS);
};

const cancelPress = () => {
  if (pressTimer) clearTimeout(pressTimer);
  pressTimer = null;
  pressStart = null;
};

const touchHandlers = {
  onPointerdown: (e: PointerEvent) => {
    // любое новое нажатие (и мышью) — уже не отпускание после долгого нажатия
    resetSwallow();
    if (e.pointerType !== 'touch' || props.disabled || !props.text) return;
    cancelPress();
    pressStart = { x: e.clientX, y: e.clientY };
    pressTimer = setTimeout(() => {
      pressTimer = null;
      swallowClick = true;
      open.value = true;
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => { open.value = false; }, TOUCH_HINT_MS);
    }, LONG_PRESS_MS);
  },
  onPointermove: (e: PointerEvent) => {
    if (pressStart && Math.hypot(e.clientX - pressStart.x, e.clientY - pressStart.y) > LONG_PRESS_SLOP_PX) cancelPress();
  },
  onPointerup: releasePress,
  onPointercancel: releasePress,
  // Enter/Space с клавиатуры — настоящее нажатие
  onKeydown: resetSwallow,
  // долгое нажатие на телефоне открывает контекстное меню браузера — здесь вместо него подсказка
  onContextmenu: (e: Event) => {
    if (swallowClick || pressTimer) e.preventDefault();
  },
  onClickCapture: (e: Event) => {
    if (!swallowClick) return;
    resetSwallow();
    e.preventDefault();
    e.stopImmediatePropagation();
  },
};

const withLongPress = (activatorProps: Record<string, unknown>) => mergeProps(activatorProps, touchHandlers);

onBeforeUnmount(() => {
  cancelPress();
  resetSwallow();
  if (hideTimer) clearTimeout(hideTimer);
});

/** Полный текст подсказки одной строкой (читалки экрана, тесты) */
const ariaText = computed(() => [props.text, props.hotkey && `(${props.hotkey})`, props.hint].filter(Boolean).join(' '));

defineExpose({ ariaText });
</script>

<style>
/* Содержимое тултипа живёт в оверлее Vuetify — стили без scoped, через content-class */
.hint-tip {
  pointer-events: auto; /* Vuetify ставит none — подсказку нельзя было навести и выделить */
  max-width: 280px;
  padding: var(--space-2) var(--space-3) !important;
  border-radius: var(--radius-sm) !important;
  font-size: var(--text-xs);
  line-height: 1.4;
}

.hint-tip__title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: 500;
}

.hint-tip__key {
  padding: 0 var(--space-1);
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 4px;
  font: inherit;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  opacity: 0.9;
}

.hint-tip__hint {
  margin-top: 2px;
  opacity: 0.8;
}
</style>
