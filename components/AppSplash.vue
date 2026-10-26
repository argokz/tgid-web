<template>
  <div
    class="app-splash"
    role="status"
  >
    <svg
      class="app-splash__mark"
      viewBox="0 0 24 24"
      width="56"
      height="56"
      fill="none"
      aria-hidden="true"
    >
      <g
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path
          class="app-splash__trace"
          d="M4 20V6l8 8 8-8v14"
        />
        <path
          class="app-splash__flow"
          d="M4 20V6l8 8 8-8v14"
          pathLength="1"
        />
      </g>
      <g
        class="app-splash__nodes"
        fill="currentColor"
      >
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
        class="app-splash__source"
        cx="12"
        cy="14"
        r="3"
      />
    </svg>
    <!-- live-область объявляет содержимое, а не aria-label -->
    <span class="app-splash__sr">{{ label }}</span>
    <div class="app-splash__brand">
      ITwin <span>Map</span>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Экран загрузки (этап 8): знак ITwin Map, по трассе M бежит поток, источник «дышит». Только CSS — виден из
 * серверного HTML до загрузки скриптов (медленная сеть); prefers-reduced-motion — статичный знак. Убирает его
 * страница карты по первому кадру (mapStore.firstFrameShown).
 */
withDefaults(defineProps<{ label?: string }>(), { label: 'Загрузка карты…' });
</script>

<style scoped>
.app-splash {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: rgb(var(--v-theme-primary));
}

/* Трасса бледная, по ней бежит поток — штрих в треть пути от левого нижнего узла к правому */
.app-splash__trace {
  opacity: 0.3;
}

.app-splash__flow {
  stroke-dasharray: 0.3 0.7;
  animation: app-splash-flow 1.6s linear infinite;
}

.app-splash__source {
  fill: var(--logo-accent, var(--accent, #d97706));
  transform-origin: 12px 14px;
  animation: app-splash-pulse 1.6s ease-in-out infinite;
}

.app-splash__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.app-splash__brand {
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: -0.02em;
  color: rgb(var(--v-theme-on-surface));
}

.app-splash__brand span {
  font-weight: 400;
  opacity: 0.7;
}

@keyframes app-splash-flow {
  from { stroke-dashoffset: 1; }
  to { stroke-dashoffset: 0; }
}

@keyframes app-splash-pulse {
  50% { transform: scale(0.8); opacity: 0.6; }
}

@media (prefers-reduced-motion: reduce) {
  .app-splash__trace {
    opacity: 1;
  }

  .app-splash__flow {
    display: none;
  }

  .app-splash__source {
    animation: none;
  }
}
</style>
