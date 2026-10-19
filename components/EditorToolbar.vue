<template>
  <div class="editor-toolbar elevation-4">
    <div class="d-flex align-center flex-wrap ga-1 pa-1">
      <!-- Инструменты: один активный (V, L, N, E, M, B) -->
      <v-btn-toggle
        :model-value="activeTool"
        mandatory
        density="comfortable"
        divided
        rounded="xl"
        variant="outlined"
        color="primary"
        class="editor-toolbar__tools"
        @update:model-value="(t: EditorTool) => void setTool(t)"
      >
        <v-btn
          v-for="t in tools"
          :key="t.value"
          :value="t.value"
          size="small"
          :aria-label="t.title"
        >
          <v-icon size="18">
            {{ t.icon }}
          </v-icon>
          <span
            v-if="t.value === activeTool"
            class="ml-1"
          >{{ t.title }}</span>
          <v-tooltip
            activator="parent"
            location="bottom"
          >
            <b>{{ t.title }}</b> <kbd>{{ t.key }}</kbd><br>{{ t.hint }}
          </v-tooltip>
        </v-btn>
      </v-btn-toggle>

      <!-- Параметры активного инструмента -->
      <template v-if="activeTool === 'trace' || activeTool === 'entry'">
        <v-select
          v-model="pipeMode"
          :items="PIPE_MODE_ITEMS"
          item-title="title"
          item-value="value"
          label="Трубы"
          density="compact"
          variant="outlined"
          hide-details
          class="editor-toolbar__select editor-toolbar__select--pipe"
        />
        <v-select
          v-if="activeTool === 'trace'"
          v-model="newNodeType"
          :items="NODE_TYPE_ITEMS"
          item-title="title"
          item-value="value"
          label="Конечный узел"
          density="compact"
          variant="outlined"
          hide-details
          class="editor-toolbar__select"
        >
          <v-tooltip
            activator="parent"
            location="bottom"
          >
            Тип нового узла в конце трассы: карточка потребителя, источника или насосной станции
            создаётся вместе с ним. Узлы на изломах — обычные
          </v-tooltip>
        </v-select>
        <v-select
          v-model="polarStep"
          :items="POLAR_STEP_ITEMS"
          item-title="title"
          item-value="value"
          label="Шаг угла"
          density="compact"
          variant="outlined"
          hide-details
          class="editor-toolbar__select editor-toolbar__select--polar"
        >
          <v-tooltip
            activator="parent"
            location="bottom"
          >
            Направление следующего участка прилипает к шагу угла и к ∥ / ⊥ соседней трубы.
            Shift — строго 90°, Alt — без привязок. Цифры — длина, Tab — угол, Enter — точка
          </v-tooltip>
        </v-select>
        <v-btn
          size="small"
          :color="contextSnapEnabled ? 'brown' : 'default'"
          :variant="contextSnapEnabled ? 'tonal' : 'outlined'"
          icon
          @click="contextSnapEnabled = !contextSnapEnabled"
        >
          <v-icon size="18">
            mdi-office-building-marker-outline
          </v-icon>
          <v-tooltip
            activator="parent"
            location="bottom"
          >
            Привязка к зданиям и улицам подложки и размеры «≈ до здания / до оси улицы»:
            {{ contextSnapEnabled ? 'включена' : 'выключена' }}. Ориентировочно, с масштаба 15
          </v-tooltip>
        </v-btn>
        <v-btn
          size="small"
          variant="outlined"
          icon
          @click="coordPointOpen = true"
        >
          <v-icon size="18">
            mdi-crosshairs-gps
          </v-icon>
          <v-tooltip
            activator="parent"
            location="bottom"
          >
            Точка трассы по координатам (G): местная система, x/y десктопа или WGS84
          </v-tooltip>
        </v-btn>
      </template>
      <v-select
        v-else-if="activeTool === 'node'"
        v-model="newNodeType"
        :items="NODE_TYPE_ITEMS"
        item-title="title"
        item-value="value"
        label="Тип узла"
        density="compact"
        variant="outlined"
        hide-details
        class="editor-toolbar__select"
      />
      <template v-else-if="activeTool === 'vertex' && vertexEditor.active.value">
        <v-btn
          size="small"
          color="primary"
          variant="flat"
          :disabled="!vertexEditor.dirty.value"
          :loading="vertexEditor.saving.value"
          @click="vertexEditor.save()"
        >
          <v-icon
            start
            size="16"
          >
            mdi-content-save
          </v-icon>
          Сохранить
          <v-tooltip
            activator="parent"
            location="bottom"
          >
            Ctrl+S
          </v-tooltip>
        </v-btn>
        <v-btn
          size="small"
          variant="text"
          :disabled="!vertexEditor.dirty.value"
          @click="vertexEditor.reset()"
        >
          <v-icon
            start
            size="16"
          >
            mdi-restore
          </v-icon>
          Сбросить
        </v-btn>
      </template>

      <v-chip
        v-for="s in statusChips"
        :key="s.text"
        size="small"
        :color="s.color"
        variant="tonal"
      >
        {{ s.text }}
      </v-chip>

      <v-divider
        vertical
        class="mx-1"
      />
      <v-btn
        size="small"
        variant="text"
        icon
        :disabled="!lastTopologyOperation || !lastTopologyOperation.undo_supported"
        :loading="undoBusy"
        @click="undoLastTopologyOperation"
      >
        <v-icon size="20">
          mdi-undo
        </v-icon>
        <v-tooltip
          activator="parent"
          location="bottom"
        >
          {{ lastTopologyOperation ? `Отменить: ${topologyOperationLabel(lastTopologyOperation)} (Ctrl+Z)` : 'Нет операций для отмены' }}
        </v-tooltip>
      </v-btn>
      <v-btn
        size="small"
        variant="text"
        icon
        :disabled="!lastRedoOperation"
        :loading="redoBusy"
        @click="redoLastTopologyOperation"
      >
        <v-icon size="20">
          mdi-redo
        </v-icon>
        <v-tooltip
          activator="parent"
          location="bottom"
        >
          {{ lastRedoOperation ? `Повторить: ${topologyOperationLabel(lastRedoOperation)} (Ctrl+Y)` : 'Нет отменённых операций' }}
        </v-tooltip>
      </v-btn>

      <!-- Шаблоны для новых объектов — в меню, чтобы не загромождать панель -->
      <v-menu
        :close-on-content-click="false"
        location="bottom end"
        @update:model-value="(open: boolean) => { if (open) void loadLineTemplates(); }"
      >
        <template #activator="{ props: menuProps }">
          <v-btn
            v-bind="menuProps"
            size="small"
            variant="text"
            icon
          >
            <v-badge
              :model-value="Boolean(newLineTemplateId || newNodeTemplateId)"
              dot
              color="primary"
            >
              <v-icon size="20">
                mdi-file-document-edit-outline
              </v-icon>
            </v-badge>
            <v-tooltip
              activator="parent"
              location="bottom"
            >
              Шаблоны свойств для новых участков и узлов
            </v-tooltip>
          </v-btn>
        </template>
        <v-card
          min-width="300"
          class="pa-3"
        >
          <div class="text-subtitle-2 mb-2">
            Шаблоны для новых объектов
          </div>
          <v-select
            v-model="newLineTemplateId"
            :items="lineTemplates"
            item-title="name"
            item-value="id"
            label="Участки"
            density="compact"
            variant="outlined"
            clearable
            hide-details
            class="mb-2"
            no-data-text="Шаблонов нет — сохраните в окне свойств участка"
          />
          <v-select
            v-model="newNodeTemplateId"
            :items="nodeTemplates"
            item-title="name"
            item-value="id"
            label="Узлы"
            density="compact"
            variant="outlined"
            clearable
            hide-details
            no-data-text="Шаблонов нет — сохраните в окне свойств узла"
          />
        </v-card>
      </v-menu>
      <v-btn
        size="small"
        variant="text"
        icon
        @click="hotkeysHelpOpen = true"
      >
        <v-icon size="20">
          mdi-keyboard-outline
        </v-icon>
        <v-tooltip
          activator="parent"
          location="bottom"
        >
          Горячие клавиши (?)
        </v-tooltip>
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { useTopologyEditor } from '~/composables/useTopologyEditor';
import { EDITOR_TOOLS, toolAllowed, type EditorTool } from '~/utils/editorTools';
import { useAuthStore } from '~/stores/authStore';
import { PIPE_MODE_ITEMS } from '~/utils/cadChain';
import { NODE_TYPE_ITEMS } from '~/utils/nodeTypes';
import { POLAR_STEP_ITEMS } from '~/utils/cadConstraint';
import { topologyOperationLabel } from '~/utils/topologyLabels';

const props = defineProps<{ editor: ReturnType<typeof useTopologyEditor> }>();

// поля редактора — ссылки: в шаблоне разворачиваются как верхнеуровневые
const {
  activeTool,
  setTool,
  pipeMode,
  newNodeType,
  polarStep,
  contextSnapEnabled,
  contextSnap,
  snapIndex,
  coordPointOpen,
  vertexEditor,
  lastTopologyOperation,
  lastRedoOperation,
  undoBusy,
  redoBusy,
  undoLastTopologyOperation,
  redoLastTopologyOperation,
  newLineTemplateId,
  newNodeTemplateId,
  lineTemplates,
  nodeTemplates,
  loadLineTemplates,
  hotkeysHelpOpen,
} = props.editor;

const authStore = useAuthStore();
/** Инструменты по правам пользователя: без права создания — нет «Трассы», «Узла», «Ввода в здание» */
const tools = computed(() => EDITOR_TOOLS.filter((t) => toolAllowed(t.value, authStore.permissions)));

/** Состояние привязок трассы — только когда что-то не так */
const statusChips = computed(() => {
  const chips: { text: string; color: string }[] = [];
  if (activeTool.value !== 'trace' && activeTool.value !== 'entry') return chips;
  if (contextSnapEnabled.value) {
    if (contextSnap.status.value === 'zoom-in') chips.push({ text: 'Здания — с масштаба 15', color: 'warning' });
    if (contextSnap.status.value === 'no-key') chips.push({ text: 'Здания недоступны (нет ключа MapTiler)', color: 'warning' });
  }
  switch (snapIndex.status.value) {
    case 'loading':
      chips.push({ text: 'Привязка: загрузка…', color: 'warning' });
      break;
    case 'zoom-in':
      chips.push({ text: 'Приблизьте карту для привязки', color: 'warning' });
      break;
    case 'error':
      chips.push({ text: 'Привязка недоступна', color: 'error' });
      break;
    case 'ready':
      if (snapIndex.truncated.value) chips.push({ text: 'Привязка: окно урезано — приблизьте', color: 'warning' });
      break;
  }
  return chips;
});
</script>

<style scoped>
.editor-toolbar {
  max-width: calc(100% - 32px);
  position: absolute;
  top: 72px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(var(--v-theme-surface), 0.96);
  backdrop-filter: blur(8px);
  border-radius: 24px;
  z-index: 10;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}
.editor-toolbar__tools {
  height: 36px !important;
}
.editor-toolbar__select {
  width: 190px;
  flex: 0 0 auto;
}
.editor-toolbar__select--pipe {
  width: 170px;
}
.editor-toolbar__select--polar {
  width: 110px;
}
kbd {
  padding: 0 4px;
  border: 1px solid currentColor;
  border-radius: 3px;
  font-size: 11px;
}
</style>
