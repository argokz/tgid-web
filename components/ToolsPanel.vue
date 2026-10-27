<template>
  <v-navigation-drawer
    v-model="open"
    location="right"
    temporary
    :width="mobile ? undefined : 360"
    class="tools-panel"
    aria-label="Панель инструментов"
  >
    <div class="tools-panel__header">
      <span class="tools-panel__title">Инструменты</span>
      <v-spacer />
      <HintTip
        text="Закрыть панель инструментов"
      >
        <template #default="{ props: tip }">
          <v-btn
            v-bind="tip"
            icon
            size="small"
            variant="text"
            aria-label="Закрыть панель инструментов"
            @click="open = false"
          >
            <v-icon size="20">mdi-close</v-icon>
          </v-btn>
        </template>
      </HintTip>
    </div>

    <div class="px-3 pb-2">
      <v-text-field
        v-model="search"
        density="compact"
        variant="outlined"
        hide-details
        clearable
        prepend-inner-icon="mdi-magnify"
        placeholder="Найти инструмент…"
        aria-label="Поиск по инструментам"
      />
    </div>

    <v-divider />

    <div class="tools-panel__body">
      <div
        v-for="group in filteredGroups"
        :key="group.title"
        class="tools-panel__group"
      >
        <div class="tools-panel__group-title px-4 pt-3 pb-1">
          <v-icon
            size="14"
            class="me-1"
          >{{ group.icon }}</v-icon>
          <span class="section-label">{{ group.title }}</span>
          <v-spacer />
          <span class="text-caption text-medium-emphasis">{{ group.items.length }}</span>
        </div>

        <v-list
          density="compact"
          class="py-0"
        >
          <v-list-item
            v-for="tool in group.items"
            :key="tool.event"
            class="tools-panel__item"
            :aria-label="tool.label"
            @click="runTool(tool)"
          >
            <template #prepend>
              <!-- нейтральная иконка: цвет — только у главного действия и выбранного (60–30–10, этап 10е) -->
              <span class="tools-panel__icon">
                <v-icon size="18">{{ tool.icon }}</v-icon>
              </span>
            </template>
            <v-list-item-title class="text-body-2">{{ tool.label }}</v-list-item-title>
            <v-list-item-subtitle
              v-if="tool.hint"
              class="text-caption"
            >
              {{ tool.hint }}
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </div>

      <div
        v-if="!filteredGroups.length"
        class="pa-8 text-center text-medium-emphasis"
      >
        <v-icon
          size="36"
          class="mb-2"
        >mdi-file-search-outline</v-icon>
        <div class="text-body-2">Ничего не найдено</div>
      </div>
    </div>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useEscapeClose } from '~/composables/useEscape';
import { useMobile } from '~/composables/useMobile';
import { useAuthStore } from '~/stores/authStore';
import { filterByRole } from '~/utils/permissions';
import { TOOL_GROUPS, type ToolDescriptor } from '~/utils/toolCatalog';
import HintTip from '~/components/HintTip.vue';

const open = defineModel<boolean>({ default: false });
const emit = defineEmits<{ 'open-tool': [event: ToolDescriptor['event']] }>();

const { isMobile: mobile } = useMobile();
const search = ref('');
const authStore = useAuthStore();

/** Пункты с requires скрыты, если роль ниже (например «Пользователи» — только admin) */
const allowedGroups = computed(() => filterByRole(TOOL_GROUPS, authStore.permissions));

const filteredGroups = computed(() => {
  const s = (search.value || '').trim().toLowerCase();
  if (!s) return allowedGroups.value;
  return allowedGroups.value
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (i) =>
          i.label.toLowerCase().includes(s) ||
          (i.hint || '').toLowerCase().includes(s)
      ),
    }))
    .filter((g) => g.items.length > 0);
});

// Esc закрывает панель (docs/ui-zones.md); фокус на холсте карты — Esc у редактора или измерения
useEscapeClose({ open, close: () => { open.value = false; } });

const runTool = (tool: ToolDescriptor) => {
  emit('open-tool', tool.event);
  // На мобильных панель закрываем, чтобы диалог не перекрывался drawer'ом
  if (mobile.value) open.value = false;
};
</script>

<style scoped>
/* На десктопе — плавающая карточка на линиях каркаса, как панели слоёв и карточки (этап 10е). Положение и
   высоту drawer'а Vuetify пишет inline-стилем, поэтому !important */
@media (min-width: 960px) {
  .tools-panel.v-navigation-drawer {
    top: calc(var(--shell-top) + var(--shell-inset)) !important;
    right: calc(var(--shell-inset) + var(--safe-right, 0px)) !important;
    height: calc(100% - var(--shell-top) - 2 * var(--shell-inset) - var(--safe-bottom, 0px)) !important;
    border: none;
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-3);
    overflow: hidden;
  }

  /* Закрытую панель Vuetify сдвигает на её ширину — с отступом от края у экрана оставалась полоска с тенью */
  .tools-panel.v-navigation-drawer:not(.v-navigation-drawer--active) {
    transform: translateX(calc(100% + var(--shell-inset) + var(--safe-right, 0px) + 24px)) !important;
  }
}

.tools-panel :deep(.v-navigation-drawer__content) {
  display: flex;
  flex-direction: column;
}

.tools-panel__header {
  display: flex;
  align-items: center;
  padding: var(--space-3) var(--space-2) var(--space-2) var(--space-4);
}

.tools-panel__title {
  font-size: var(--text-md);
  font-weight: 600;
  line-height: 24px;
  color: var(--text-strong);
}

.tools-panel__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  border-top: 1px solid var(--border-subtle);
}

.tools-panel__group-title {
  display: flex;
  align-items: center;
  color: var(--text-muted);
}

.tools-panel__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  margin-inline-end: var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--surface-hover);
  color: var(--text-muted);
}

.tools-panel__item {
  cursor: pointer;
}

.tools-panel__item:hover {
  background: var(--surface-hover);
}
</style>
