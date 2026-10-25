<template>
  <div
    class="state-illustration"
    :class="`state-illustration--${kind}`"
    aria-hidden="true"
  >
    <svg
      viewBox="0 0 120 72"
      width="120"
      height="72"
      fill="none"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <!-- Ветви сети от центрального узла; у «нет связи» правая ветвь оборвана -->
      <g
        class="state-illustration__net"
        stroke-width="2"
      >
        <path d="M40 36H24l-10-14M24 36l-12 16" />
        <path
          v-if="kind !== 'offline'"
          d="M80 36h16l12-16M96 36l10 18"
        />
        <template v-else>
          <path d="M80 36h4" />
          <path
            class="state-illustration__broken"
            d="M92 36h4l12-16M96 36l10 18"
          />
          <path
            class="state-illustration__hub-stroke"
            d="M86 31l3 4-3 2 3 4"
          />
        </template>
      </g>
      <g class="state-illustration__nodes">
        <circle
          cx="24"
          cy="36"
          r="3.5"
        />
        <circle
          cx="14"
          cy="22"
          r="3.5"
        />
        <circle
          cx="12"
          cy="52"
          r="3.5"
        />
        <circle
          cx="96"
          cy="36"
          r="3.5"
        />
        <circle
          cx="108"
          cy="20"
          r="3.5"
        />
        <circle
          cx="106"
          cy="54"
          r="3.5"
        />
      </g>
      <circle
        class="state-illustration__hub state-illustration__hub-stroke"
        cx="60"
        cy="36"
        r="19"
        stroke-width="2"
      />
    </svg>
    <v-icon
      class="state-illustration__glyph"
      size="22"
    >
      {{ glyph }}
    </v-icon>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { STATE_ILLUSTRATION_ICONS, type StateIllustrationKind } from '~/utils/stateIllustration';

/**
 * Иллюстрация состояния (этап 8): одна серия в графическом языке знака — ветви и узлы сети, в центре — узел со
 * значком. Цвет несёт только центральный узел (ошибка, нет связи, готово); сеть — приглушённая линия. Без
 * анимации: иллюстрация объясняет состояние, а не украшает. Значок — предметная иконка экрана (пусто в журнале
 * насосов — насос) или значок вида по умолчанию.
 */
const props = withDefaults(defineProps<{
  kind?: StateIllustrationKind;
  icon?: string;
}>(), {
  kind: 'empty',
  icon: '',
});

const glyph = computed(() => props.icon || STATE_ILLUSTRATION_ICONS[props.kind]);
</script>

<style scoped>
.state-illustration {
  --ill-line: rgba(var(--v-theme-on-surface), 0.26);
  --ill-hub: rgba(var(--v-theme-on-surface), 0.5);
  position: relative;
  width: 120px;
  height: 72px;
  /* медиа v-empty-state — блок на всю ширину */
  margin-inline: auto;
  color: var(--ill-hub);
}

.state-illustration--offline {
  --ill-hub: rgb(var(--v-theme-warning));
}

.state-illustration--error {
  --ill-hub: rgb(var(--v-theme-error));
}

.state-illustration--done {
  --ill-hub: rgb(var(--v-theme-success));
}

.state-illustration--not-found,
.state-illustration--no-access {
  --ill-hub: rgb(var(--v-theme-primary));
}

.state-illustration svg {
  display: block;
}

.state-illustration__net {
  stroke: var(--ill-line);
}

/* пусто — данных по сети нет: ветви пунктиром */
.state-illustration--empty .state-illustration__net {
  stroke-dasharray: 2 5;
}

.state-illustration__broken {
  stroke-dasharray: 2 5;
}

.state-illustration__nodes circle {
  fill: rgb(var(--v-theme-surface));
  stroke: var(--ill-line);
  stroke-width: 2;
}

/* готово — узлы «под нагрузкой» */
.state-illustration--done .state-illustration__nodes circle {
  fill: var(--ill-line);
}

.state-illustration__hub {
  fill: rgb(var(--v-theme-surface));
}

.state-illustration__hub-stroke {
  stroke: var(--ill-hub);
}

.state-illustration__glyph {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  color: var(--ill-hub);
}
</style>
