<template>
  <div
    class="app-splash"
    role="status"
  >
    <AppLogo
      class="app-splash__mark"
      size="72"
    />
    <!-- live-область объявляет содержимое, а не aria-label -->
    <span class="app-splash__sr">{{ label }}</span>
    <div class="app-splash__brand">
      ITwin <span>Map</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import AppLogo from '~/components/AppLogo.vue';

/**
 * Экран загрузки (этап 8): знак ITwin Map, слои данных «складываются» под карту. Только CSS — виден из
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

/* Слои данных «складываются» под карту: нижний и средний слой подъезжают к верхнему и возвращаются */
.app-splash__mark :deep(.app-logo__lower) {
  animation: app-splash-stack 1.8s var(--ease-out, ease-out) infinite alternate;
}

.app-splash__mark :deep(.app-logo__middle) {
  animation: app-splash-stack-mid 1.8s var(--ease-out, ease-out) infinite alternate;
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
  font-weight: 600;
  font-size: 1.1rem;
  letter-spacing: -0.02em;
  color: rgb(var(--v-theme-on-surface));
}

.app-splash__brand span {
  font-weight: 400;
  opacity: 0.7;
}

@keyframes app-splash-stack {
  from { transform: translateY(0); opacity: 1; }
  to { transform: translateY(-70px); opacity: 0.55; }
}

@keyframes app-splash-stack-mid {
  from { transform: translateY(0); }
  to { transform: translateY(-36px); }
}

@media (prefers-reduced-motion: reduce) {
  .app-splash__mark :deep(.app-logo__lower),
  .app-splash__mark :deep(.app-logo__middle) {
    animation: none;
  }
}
</style>
