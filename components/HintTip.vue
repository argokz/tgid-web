<template>
  <v-tooltip
    :location="location"
    :disabled="disabled || !text"
    :open-delay="openDelay"
    :close-delay="0"
    open-on-focus
    content-class="hint-tip"
    :aria-label="ariaText"
  >
    <template #activator="{ props: activatorProps }">
      <slot :props="activatorProps" />
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
import { computed } from 'vue';

/**
 * HintTip — обёртка над v-tooltip с единым содержимым для всех иконочных кнопок (docs/ui-primitives.md):
 * название действия в повелительном наклонении («Построить пьезометр»), хоткей, одна строка пояснения.
 * aria-label у самой кнопки остаётся — подсказка её не заменяет. Тач-эквивалент (долгое нажатие) — этап 7.
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

/** Полный текст подсказки одной строкой (читалки экрана, тесты) */
const ariaText = computed(() => [props.text, props.hotkey && `(${props.hotkey})`, props.hint].filter(Boolean).join(' '));

defineExpose({ ariaText });
</script>

<style>
/* Содержимое тултипа живёт в оверлее Vuetify — стили без scoped, через content-class */
.hint-tip {
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
