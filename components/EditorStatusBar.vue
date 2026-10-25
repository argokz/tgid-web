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
  bottom: calc(28px + var(--safe-bottom, 0px));
  left: 50%;
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
</style>
