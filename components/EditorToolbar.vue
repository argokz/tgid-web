<template>
  <div
    ref="rootEl"
    class="editor-toolbar elevation-4"
    :class="{ 'editor-toolbar--moved': pos, 'editor-toolbar--dragging': dragging }"
    :style="posStyle"
  >
    <div class="d-flex align-center flex-wrap ga-1 pa-1">
      <!-- Ручка: перетащить панель по карте (если не закреплена), двойной щелчок — на место -->
      <div
        class="editor-toolbar__handle"
        :class="{ 'editor-toolbar__handle--pinned': pinned }"
        role="button"
        :tabindex="pinned ? -1 : 0"
        aria-label="Переместить панель (стрелки — сдвиг, Enter — на место)"
        @pointerdown="onHandleDown"
        @keydown="onHandleKeydown"
        @keydown.enter.prevent="resetPos"
        @dblclick="resetPos"
      >
        <v-icon size="18">
          mdi-drag
        </v-icon>
        <v-tooltip
          activator="parent"
          location="bottom"
        >
          {{ pinned
            ? 'Панель закреплена — открепите её кнопкой с булавкой, чтобы переместить'
            : 'Перетащите или сдвиньте стрелками; двойной щелчок или Enter — вернуть на место' }}
        </v-tooltip>
      </div>
      <!-- Инструменты: один активный (V, L, N, E, M, B) -->
      <FloatingToolbar
        :model-value="activeTool"
        :items="toolbarItems"
        aria-label="Инструменты редактора"
        @update:model-value="(t: unknown) => void setTool(t as EditorTool)"
      />

      <!-- Фрагмент новых узлов и участков: копии сети разных фрагментов лежат друг на друге -->
      <v-menu
        v-if="creating"
        v-model="fragmentMenuOpen"
        location="bottom start"
        :disabled="fragmentLocked"
      >
        <template #activator="{ props: menuProps }">
          <v-chip
            v-bind="menuProps"
            size="small"
            :color="creationFragmentId == null ? 'warning' : 'primary'"
            :variant="creationFragmentId == null ? 'flat' : 'tonal'"
            :append-icon="fragmentLocked ? undefined : 'mdi-menu-down'"
            prepend-icon="mdi-layers-outline"
            class="editor-toolbar__fragment"
          >
            {{ creationFragmentId == null ? 'Фрагмент: выберите' : `Фрагмент ${fragmentText(creationFragmentId)}` }}
            <v-tooltip
              activator="parent"
              location="bottom"
            >
              {{ fragmentLocked
                ? 'Новые узлы и участки создаются в этом фрагменте — он один на карте (сменить — на панели фрагментов)'
                : 'В каком фрагменте создавать новые узлы и участки. Трасса от узла или трубы — в их фрагменте' }}
            </v-tooltip>
          </v-chip>
        </template>
        <v-list
          density="compact"
          max-height="360"
        >
          <v-list-subheader>Создавать новые объекты во фрагменте</v-list-subheader>
          <v-list-item
            v-for="id in fragmentChoiceIds"
            :key="id"
            :active="id === creationFragmentId"
            color="primary"
            @click="setWorkFragment(id)"
          >
            <v-list-item-title>{{ fragmentText(id) }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>

      <!-- Параметры активного инструмента -->
      <template v-if="activeTool === 'trace' || activeTool === 'entry'">
        <AppSelect
          v-model="pipeMode"
          :items="PIPE_MODE_ITEMS"
          item-title="title"
          item-value="value"
          label="Трубы"
          class="editor-toolbar__select editor-toolbar__select--pipe"
          :clearable="false"
        />
        <AppSelect
          v-if="activeTool === 'trace'"
          v-model="newNodeType"
          :items="NODE_TYPE_ITEMS"
          item-title="title"
          item-value="value"
          label="Конечный узел"
          class="editor-toolbar__select"
          :clearable="false"
        >
          <v-tooltip
            activator="parent"
            location="bottom"
          >
            Тип нового узла в конце трассы: карточка потребителя, источника или насосной станции
            создаётся вместе с ним. Узлы на изломах — обычные
          </v-tooltip>
        </AppSelect>
        <AppSelect
          v-model="polarStep"
          :items="POLAR_STEP_ITEMS"
          item-title="title"
          item-value="value"
          label="Шаг угла"
          class="editor-toolbar__select editor-toolbar__select--polar"
          :clearable="false"
        >
          <v-tooltip
            activator="parent"
            location="bottom"
          >
            Направление следующего участка прилипает к шагу угла и к ∥ / ⊥ соседней трубы.
            Shift — строго 90°, Alt — без привязок. Цифры — длина, Tab — угол, Enter — точка
          </v-tooltip>
        </AppSelect>
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
      <AppSelect
        v-else-if="activeTool === 'node'"
        v-model="newNodeType"
        :items="NODE_TYPE_ITEMS"
        item-title="title"
        item-value="value"
        label="Тип узла"
        class="editor-toolbar__select"
        :clearable="false"
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

      <v-btn
        size="small"
        variant="text"
        icon
        @click="historyOpen = true"
      >
        <v-icon size="20">
          mdi-history
        </v-icon>
        <v-tooltip
          activator="parent"
          location="bottom"
        >
          История правок (H): показать, откатить до места
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
          <AppSelect
            v-model="newLineTemplateId"
            :items="lineTemplates"
            item-title="name"
            item-value="id"
            label="Участки"
            class="mb-2"
            no-data-text="Шаблонов нет — сохраните в окне свойств участка"
          />
          <AppSelect
            v-model="newNodeTemplateId"
            :items="nodeTemplates"
            item-title="name"
            item-value="id"
            label="Узлы"
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
      <v-btn
        size="small"
        :variant="pinned ? 'tonal' : 'text'"
        :color="pinned ? 'primary' : undefined"
        icon
        :aria-pressed="pinned"
        @click="togglePinned"
      >
        <v-icon size="18">
          {{ pinned ? 'mdi-pin' : 'mdi-pin-off' }}
        </v-icon>
        <v-tooltip
          activator="parent"
          location="bottom"
        >
          {{ pinned ? 'Панель закреплена на месте — открепить' : 'Закрепить панель на месте (не перетаскивать случайно)' }}
        </v-tooltip>
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import AppSelect from '~/components/AppSelect.vue';
import FloatingToolbar from '~/components/FloatingToolbar.vue';
import { computed, ref, watch } from 'vue';
import type { useTopologyEditor } from '~/composables/useTopologyEditor';
import { EDITOR_TOOLS, toolAllowed, type EditorTool } from '~/utils/editorTools';
import { useAuthStore } from '~/stores/authStore';
import { PIPE_MODE_ITEMS } from '~/utils/cadChain';
import { NODE_TYPE_ITEMS } from '~/utils/nodeTypes';
import { POLAR_STEP_ITEMS } from '~/utils/cadConstraint';
import { topologyOperationLabel } from '~/utils/topologyLabels';
import { fragmentChoices, fragmentLabel } from '~/utils/editFragment';
import { useFragmentStore } from '~/stores/fragmentStore';
import { appStorage } from '~/utils/appStorage';
import { useFloatingDrag, usePersistedPanelPos } from '~/composables/useFloatingDrag';

const props = defineProps<{ editor: ReturnType<typeof useTopologyEditor> }>();

// === Положение панели: перетаскивание за ручку (useFloatingDrag), закрепление, запоминание между сеансами ===
const PINNED_KEY = 'editorToolbarPinned';
const readPinned = (): boolean => {
  try {
    return appStorage.getItem(PINNED_KEY) === '1';
  } catch {
    return false;
  }
};

const rootEl = ref<HTMLElement | null>(null);
/** null — на месте по умолчанию (сверху по центру карты) */
const { pos, save: savePos, reset: resetStoredPos } = usePersistedPanelPos('editorToolbarPos');
const pinned = ref(readPinned());
const posStyle = computed(() => (pos.value ? { left: `${pos.value.x}px`, top: `${pos.value.y}px` } : undefined));
const { dragging, onPointerDown: onHandleDown, onKeydown: onHandleKeydown, reclamp } = useFloatingDrag({
  target: rootEl,
  pos,
  enabled: () => !pinned.value,
  onCommit: savePos,
});

const resetPos = () => {
  if (!pinned.value) resetStoredPos();
};

const togglePinned = () => {
  pinned.value = !pinned.value;
  try {
    if (pinned.value) appStorage.setItem(PINNED_KEY, '1');
    else appStorage.removeItem(PINNED_KEY);
  } catch {
    // удобство: без хранилища закрепление живёт до перезагрузки
  }
};

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
  historyOpen,
  activeFragmentList,
  creationFragmentId,
  fragmentMenuOpen,
  setWorkFragment,
} = props.editor;
watch(activeTool, reclamp);

const fragmentStore = useFragmentStore();
/** Инструменты, создающие объекты: им нужен фрагмент */
const creating = computed(() => ['trace', 'node', 'entry'].includes(activeTool.value));
/** Фрагмент один на карте (выбран или единственный видимый) — менять его здесь нечего */
const fragmentLocked = computed(() => activeFragmentList.value.length === 1);
const fragmentChoiceIds = computed(() => fragmentChoices(
  activeFragmentList.value,
  fragmentStore.fragments.map((f) => Number(f.id)).filter((id) => Number.isInteger(id) && id > 0),
));
const fragmentText = (id: number) =>
  fragmentLabel(id, fragmentStore.fragments.find((f) => Number(f.id) === id)?.name);

const authStore = useAuthStore();
/** Инструменты по правам пользователя: без права создания — нет «Трассы», «Узла», «Ввода в здание» */
const tools = computed(() => EDITOR_TOOLS.filter((t) => toolAllowed(t.value, authStore.permissions)));
const toolbarItems = computed(() => tools.value.map((t) => ({ value: t.value, title: t.title, icon: t.icon, hotkey: t.key, hint: t.hint })));

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
  /* ширина — по содержимому, не по месту на карте: иначе сдвиг панели меняет её размер */
  width: max-content;
  max-width: calc(100% - 32px);
  position: absolute;
  top: 72px;
  left: 50%;
  transform: translateX(-50%);
  transform-origin: 50% 0;
  /* стекло уровня 1 — из токенов (fallback и .map-moving в _tokens.scss) */
  background: var(--glass-1-bg);
  -webkit-backdrop-filter: var(--glass-1-filter);
  backdrop-filter: var(--glass-1-filter);
  border: var(--glass-border);
  border-radius: 24px;
  z-index: var(--z-toolbar);
  box-shadow: var(--shadow-2);
}
/* перетащена оператором: угол — из style (left/top), без центрирования */
.editor-toolbar--moved {
  transform: none;
}
.editor-toolbar--dragging {
  user-select: none;
  opacity: 0.92;
}
.editor-toolbar__handle {
  display: flex;
  align-items: center;
  align-self: stretch;
  padding: 0 2px;
  cursor: grab;
  touch-action: none;
  opacity: 0.6;
}
.editor-toolbar--dragging .editor-toolbar__handle {
  cursor: grabbing;
}
.editor-toolbar__handle--pinned {
  cursor: default;
  opacity: 0.25;
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
.editor-toolbar__fragment {
  max-width: 260px;
}
kbd {
  padding: 0 4px;
  border: 1px solid currentColor;
  border-radius: 3px;
  font-size: 11px;
}
</style>
