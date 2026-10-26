<template>
  <svg
    class="app-logo"
    viewBox="0 0 24 24"
    :width="size"
    :height="size"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M4 20V6l8 8 8-8v14"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <g fill="currentColor">
      <circle
        cx="4"
        cy="20"
        r="2.25"
      />
      <circle
        cx="4"
        cy="6"
        r="2.25"
      />
      <circle
        cx="20"
        cy="6"
        r="2.25"
      />
      <circle
        cx="20"
        cy="20"
        r="2.25"
      />
    </g>
    <circle
      class="app-logo__source"
      cx="12"
      cy="14"
      r="3"
    />
  </svg>
</template>

<script setup lang="ts">
/**
 * Знак ITwin Map «Сеть-M» (этап 8, docs/brand/logo-a-network-m.svg): трасса сети буквой M, узлы и источник.
 * Цвет — currentColor (синий в шапке, белый на тёмной подложке, чёрный в печати), источник — --logo-accent
 * (в печати — тем же цветом). Подпись «ITwin Map» — текстом рядом, не в знаке.
 */
withDefaults(defineProps<{ size?: number | string }>(), { size: 24 });
</script>

<style scoped>
.app-logo {
  display: block;
  flex: 0 0 auto;
}

.app-logo__source {
  fill: var(--logo-accent, var(--accent, #d97706));
}

@media print {
  .app-logo__source {
    fill: currentColor;
  }
}
</style>
