<template>
  <component
    :is="tag"
    class="glass-surface"
    :class="[level === 'solid' ? 'glass-solid' : 'glass-1', `glass-surface--${rounded}`, { 'glass-surface--padded': padded }]"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
/**
 * GlassSurface — единственное место, где задаётся стекло (docs/ui-primitives.md): фон, blur, граница и тень
 * берутся из токенов `--glass-*`, fallback без backdrop-filter и настройки доступности — в `_tokens.scss`.
 * На время движения карты класс `.map-moving` на корне снимает blur у всех поверхностей уровня 1.
 */
withDefaults(defineProps<{
  /** 1 — полупрозрачная с blur; solid — почти непрозрачная без blur (текст и формы) */
  level?: '1' | 'solid';
  rounded?: 'sm' | 'md' | 'lg' | 'pill';
  padded?: boolean;
  tag?: string;
}>(), {
  level: '1',
  rounded: 'lg',
  padded: false,
  tag: 'div',
});
</script>

<style scoped>
.glass-surface {
  color: rgb(var(--v-theme-on-surface));
}

.glass-surface--sm { border-radius: var(--radius-sm); }
.glass-surface--md { border-radius: var(--radius-md); }
.glass-surface--lg { border-radius: var(--radius-lg); }
.glass-surface--pill { border-radius: 999px; }

.glass-surface--padded {
  padding: var(--space-2) var(--space-3);
}
</style>
