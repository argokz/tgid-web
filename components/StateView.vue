<template>
  <div
    class="state-view"
    :class="`state-view--${state}`"
  >
    <template v-if="state === 'loading'">
      <v-skeleton-loader
        class="state-view__skeleton"
        :type="skeletonType"
        :loading="true"
        role="status"
        :aria-label="loadingLabel"
      />
    </template>

    <v-empty-state
      v-else-if="state === 'error'"
      class="state-view__empty"
      :headline="errorTitle"
      :text="error || undefined"
      size="64"
      role="alert"
    >
      <template #media>
        <slot name="illustration-error">
          <v-icon
            size="48"
            color="error"
          >mdi-alert-circle-outline</v-icon>
        </slot>
      </template>
      <template
        v-if="retry"
        #actions
      >
        <v-btn
          color="primary"
          variant="tonal"
          prepend-icon="mdi-refresh"
          :loading="retrying"
          @click="$emit('retry')"
        >Повторить</v-btn>
      </template>
    </v-empty-state>

    <v-empty-state
      v-else-if="state === 'empty'"
      class="state-view__empty"
      :headline="emptyTitle"
      :text="emptyText || undefined"
      size="64"
      role="status"
    >
      <template #media>
        <slot name="illustration-empty">
          <v-icon
            size="48"
            class="state-view__icon"
          >{{ emptyIcon }}</v-icon>
        </slot>
      </template>
      <template
        v-if="actionLabel"
        #actions
      >
        <v-btn
          color="primary"
          variant="tonal"
          @click="$emit('action')"
        >{{ actionLabel }}</v-btn>
      </template>
    </v-empty-state>

    <slot v-else />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

/**
 * StateView — загрузка (скелетон той же формы, что и данные), пусто (что это, почему пусто, что сделать),
 * ошибка (текст, «Повторить») и данные (слот). Состояние считается из флагов: ошибка важнее загрузки,
 * загрузка важнее пустоты. docs/ui-primitives.md.
 */
export type StateViewVariant = 'table' | 'list' | 'form' | 'chart' | 'card' | 'inline';

const props = withDefaults(defineProps<{
  loading?: boolean;
  /** Текст ошибки; пусто — ошибки нет */
  error?: string | null;
  /** Данных нет (после загрузки без ошибки) */
  empty?: boolean;
  /** Форма скелетона и пустого состояния */
  variant?: StateViewVariant;
  /** Сколько строк скелетона (таблица, список) */
  rows?: number;
  emptyTitle?: string;
  emptyText?: string;
  emptyIcon?: string;
  /** Подпись кнопки в пустом состоянии; событие action */
  actionLabel?: string;
  errorTitle?: string;
  /** Показывать «Повторить» (событие retry) */
  retry?: boolean;
  /** Повтор уже идёт — кнопка с индикатором, пока не придёт ответ */
  retrying?: boolean;
  loadingLabel?: string;
}>(), {
  loading: false,
  error: null,
  empty: false,
  variant: 'list',
  rows: 6,
  emptyTitle: 'Записей нет',
  emptyText: '',
  emptyIcon: 'mdi-tray-remove',
  actionLabel: '',
  errorTitle: 'Не удалось загрузить данные',
  retry: true,
  retrying: false,
  loadingLabel: 'Загрузка…',
});

defineEmits<{ retry: []; action: [] }>();

export type StateViewState = 'loading' | 'error' | 'empty' | 'ready';

const state = computed<StateViewState>(() => {
  if (props.error) return 'error';
  if (props.loading) return 'loading';
  if (props.empty) return 'empty';
  return 'ready';
});

/** Скелетон повторяет форму данных, а не спиннер по центру (принцип «состояния у всего») */
const skeletonType = computed(() => {
  const n = Math.max(1, Math.min(20, Math.round(props.rows)));
  switch (props.variant) {
    case 'table': return `table-thead, table-tbody@${Math.ceil(n / 6)}`;
    case 'form': return 'heading, text@2, divider, text@3';
    case 'chart': return 'heading, image';
    case 'card': return 'article';
    case 'inline': return 'text';
    default: return `list-item-two-line@${n}`;
  }
});

defineExpose({ state });
</script>

<style scoped>
.state-view {
  min-height: 0;
}

.state-view--loading,
.state-view--empty,
.state-view--error {
  min-height: 160px;
}

.state-view__skeleton {
  background: transparent;
}

.state-view__empty {
  padding: var(--space-6) var(--space-4);
}

.state-view__icon {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

/* Меньше движения — без мерцания скелетона */
@media (prefers-reduced-motion: reduce) {
  .state-view__skeleton :deep(.v-skeleton-loader__bone::after) {
    animation: none;
  }
}
</style>
