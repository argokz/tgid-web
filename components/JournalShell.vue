<script setup lang="ts">
/**
 * Рамка журнала (общая для *JournalDialog.vue): окно, шапка со значком, названием и областью,
 * действия шапки, плитки-счётчики, фильтры, таблица в StateView (загрузка / ошибка / пусто),
 * страницы внизу. Содержимое — слотами: actions, top, kpi, filters, default (таблица), footer.
 * Механика списка — composables/useJournalList.ts.
 */
import HintTip from '~/components/HintTip.vue'
import StateView from '~/components/StateView.vue'
import { useMobile } from '~/composables/useMobile'

const visible = defineModel<boolean>({ required: true })
const page = defineModel<number>('page', { required: true })

withDefaults(defineProps<{
  title: string
  subtitle?: string
  icon: string
  /** цвет круга под значком и самого значка (палитра Vuetify) */
  avatarColor?: string
  iconColor?: string
  maxWidth?: number | string
  pages: number
  loading: boolean
  error: string
  /** записей нет (после загрузки) */
  empty: boolean
  emptyTitle: string
  emptyText: string
  emptyIcon?: string
  /** кнопка в пустом состоянии (например, «Сбросить фильтры»); нет — без кнопки */
  emptyActionLabel?: string
  /** строк-заглушек при первой загрузке */
  skeletonRows?: number
  /** подсказка кнопки закрытия («Закрыть реестр» у реестров) */
  closeText?: string
}>(), {
  subtitle: '',
  avatarColor: 'primary-lighten-5',
  iconColor: 'primary',
  maxWidth: 1240,
  emptyIcon: 'mdi-clipboard-text-outline',
  emptyActionLabel: undefined,
  skeletonRows: 10,
  closeText: 'Закрыть журнал',
})

const emit = defineEmits<{ retry: []; 'empty-action': [] }>()
const { isMobile } = useMobile()
</script>

<template>
  <v-dialog
    v-model="visible"
    :fullscreen="isMobile"
    :max-width="maxWidth"
    scrollable
  >
    <v-card
      class="journal-shell"
      :rounded="isMobile ? 0 : 'lg'"
    >
      <v-card-title class="d-flex align-center ga-3 px-4 py-3">
        <v-avatar
          :color="avatarColor"
          size="40"
        >
          <v-icon :color="iconColor">
            {{ icon }}
          </v-icon>
        </v-avatar>
        <div
          class="flex-grow-1"
          style="min-width: 0"
        >
          <div class="text-subtitle-1 font-weight-bold">
            {{ title }}
          </div>
          <div class="text-caption text-medium-emphasis text-truncate">
            {{ subtitle }}
          </div>
        </div>
        <slot name="actions" />
        <HintTip
          :text="closeText"
          hotkey="Esc"
          location="bottom"
        >
          <template #default="{ props: tip }">
            <v-btn
              v-bind="tip"
              icon
              variant="text"
              aria-label="Закрыть журнал"
              @click="visible = false"
            >
              <v-icon>mdi-close</v-icon>
            </v-btn>
          </template>
        </HintTip>
      </v-card-title>
      <v-divider />

      <!-- нестандартный верх журнала (предупреждения, несколько рядов плиток) — как есть -->
      <slot name="top" />

      <div
        v-if="$slots.kpi"
        class="journal-shell__kpi px-3 px-md-4 pt-3"
      >
        <slot name="kpi" />
      </div>

      <div
        v-if="$slots.filters"
        class="pa-3 pa-md-4 journal-shell__filters"
      >
        <slot name="filters" />
      </div>

      <v-divider />

      <v-card-text class="pa-0 journal-shell__table">
        <StateView
          variant="table"
          :rows="skeletonRows"
          :loading="loading && empty"
          :error="error"
          :empty="!loading && empty"
          :empty-title="emptyTitle"
          :empty-text="emptyText"
          :empty-icon="emptyIcon"
          :action-label="emptyActionLabel"
          :retrying="loading"
          @retry="emit('retry')"
          @action="emit('empty-action')"
        >
          <v-progress-linear
            v-if="loading"
            indeterminate
            color="primary"
          />
          <slot />
        </StateView>
      </v-card-text>

      <v-divider />
      <v-card-actions class="px-4 py-2">
        <slot name="footer">
          <span class="text-caption text-medium-emphasis">
            Страница {{ page }}{{ pages ? ` из ${pages}` : '' }}
          </span>
        </slot>
        <v-spacer />
        <v-pagination
          v-if="pages > 1"
          v-model="page"
          :length="pages"
          :total-visible="isMobile ? 3 : 7"
          density="compact"
        />
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.journal-shell {
  height: min(88vh, 880px);
  display: flex;
  flex-direction: column;
}

.journal-shell__kpi {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.journal-shell__filters {
  flex-shrink: 0;
  background: rgba(var(--v-theme-on-surface), 0.02);
}

.journal-shell__table {
  min-height: 280px;
  overflow: auto;
  flex: 1;
}

@media (max-width: 600px) {
  .journal-shell {
    height: 100dvh;
  }
}
</style>
