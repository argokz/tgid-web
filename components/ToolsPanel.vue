<template>
  <v-navigation-drawer
    v-model="open"
    location="right"
    temporary
    :width="mobile ? undefined : 360"
    class="tools-panel"
    aria-label="Панель инструментов"
  >
    <div class="tools-panel__header px-4 py-3">
      <v-icon size="20" color="primary" class="me-2">mdi-toolbox-outline</v-icon>
      <span class="text-subtitle-1 font-weight-bold">Инструменты</span>
      <v-spacer />
      <v-btn
        icon
        size="small"
        variant="text"
        aria-label="Закрыть панель инструментов"
        @click="open = false"
      >
        <v-icon size="20">mdi-close</v-icon>
      </v-btn>
    </div>

    <v-divider />

    <div class="px-3 py-2">
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
      <div v-for="group in filteredGroups" :key="group.title" class="tools-panel__group">
        <div class="tools-panel__group-title px-4 pt-3 pb-1">
          <v-icon size="14" :color="group.color" class="me-1">{{ group.icon }}</v-icon>
          <span class="text-caption font-weight-bold text-uppercase">{{ group.title }}</span>
          <v-spacer />
          <span class="text-caption text-medium-emphasis">{{ group.items.length }}</span>
        </div>

        <v-list density="compact" class="py-0">
          <v-list-item
            v-for="tool in group.items"
            :key="tool.event"
            class="tools-panel__item"
            :aria-label="tool.label"
            @click="runTool(tool)"
          >
            <template #prepend>
              <v-avatar size="32" :color="`${tool.color}`" variant="tonal">
                <v-icon size="18" :color="tool.color">{{ tool.icon }}</v-icon>
              </v-avatar>
            </template>
            <v-list-item-title class="text-body-2">{{ tool.label }}</v-list-item-title>
            <v-list-item-subtitle v-if="tool.hint" class="text-caption">
              {{ tool.hint }}
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </div>

      <div v-if="!filteredGroups.length" class="pa-8 text-center text-medium-emphasis">
        <v-icon size="36" class="mb-2">mdi-file-search-outline</v-icon>
        <div class="text-body-2">Ничего не найдено</div>
      </div>
    </div>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useMobile } from '~/composables/useMobile';
import { TOOL_GROUPS, type ToolDescriptor } from '~/utils/toolCatalog';

const open = defineModel<boolean>({ default: false });
const emit = defineEmits<{ 'open-tool': [event: ToolDescriptor['event']] }>();

const { isMobile: mobile } = useMobile();
const search = ref('');

const filteredGroups = computed(() => {
  const s = (search.value || '').trim().toLowerCase();
  if (!s) return TOOL_GROUPS;
  return TOOL_GROUPS
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

const runTool = (tool: ToolDescriptor) => {
  emit('open-tool', tool.event);
  // На мобильных панель закрываем, чтобы диалог не перекрывался drawer'ом
  if (mobile.value) open.value = false;
};
</script>

<style scoped>
.tools-panel__header {
  display: flex;
  align-items: center;
}

.tools-panel__body {
  height: calc(100% - 120px);
  overflow-y: auto;
  overscroll-behavior: contain;
}

.tools-panel__group-title {
  display: flex;
  align-items: center;
  opacity: 0.75;
}

.tools-panel__item {
  cursor: pointer;
}

.tools-panel__item:hover {
  background: rgba(var(--v-theme-primary), 0.06);
}
</style>
