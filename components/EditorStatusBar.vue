<template>
  <div
    class="editor-status-bar"
    role="status"
    aria-live="polite"
  >
    <v-icon
      size="16"
      class="mr-1"
    >
      {{ toolInfo?.icon }}
    </v-icon>
    <b class="mr-2">{{ toolInfo?.title }}</b>
    <span>{{ hint }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { EDITOR_TOOLS, type EditorTool } from '~/utils/editorTools';

const props = defineProps<{ tool: EditorTool; hint: string }>();
const toolInfo = computed(() => EDITOR_TOOLS.find((t) => t.value === props.tool));
</script>

<style scoped>
.editor-status-bar {
  position: absolute;
  /* над строкой координат (CursorCoords: 4 px от низа + высота 32) с зазором 8 — не заходит под неё */
  bottom: calc(44px + var(--safe-bottom, 0px));
  left: calc(var(--map-left-inset, 0px) + (100% - var(--map-left-inset, 0px) - var(--map-right-inset, 0px)) / 2); /* центр видимой части карты */
  transform: translateX(-50%);
  max-width: calc(100% - 32px);
  z-index: var(--z-hud);
  display: flex;
  align-items: center;
  padding: 4px 14px;
  border-radius: 16px;
  font-size: 13px;
  line-height: 18px;
  background: rgba(var(--v-theme-surface), 0.95);
  color: rgb(var(--v-theme-on-surface));
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
  pointer-events: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* телефон: внизу по углам — кнопка слоёв и зум, строка состояния между ними */
@media (max-width: 959.98px) {
  .editor-status-bar {
    max-width: calc(100% - 2 * (var(--shell-inset) + var(--corner-btn) + var(--shell-gap)));
  }
}
</style>
