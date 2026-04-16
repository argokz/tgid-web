<template>
  <div
    v-show="show"
    class="protocol-container"
  >
    <div
      class="protocol-resize-handle"
      @mousedown="startResize"
    />
    <v-card
      class="protocol-card"
      variant="outlined"
    >
      <!-- Комбинированный заголовок -->
      <div class="protocol-header">
        <div class="protocol-tabs-container">
          <v-tabs
            v-model="activeTab"
            color="primary"
            density="compact"
            class="protocol-tabs"
          >
            <v-tab value="calculation">
              <v-icon class="mr-2">
                mdiCalculator
              </v-icon>
              Расчет
            </v-tab>
            <v-tab value="system">
              <v-icon class="mr-2">
                mdiCog
              </v-icon>
              Система
            </v-tab>
          </v-tabs>
        </div>
        <div class="protocol-actions">
          <v-btn
            icon
            density="compact"
            class="mr-2"
            variant="text"
            @click="clear"
          >
            <v-icon>mdiDelete</v-icon>
          </v-btn>
          <v-btn
            icon
            density="compact"
            class="mr-2"
            variant="text"
            @click="toggleFullscreen"
          >
            <v-icon>{{ isFullscreen ? 'mdiFullscreenExit' : 'mdiFullscreen' }}</v-icon>
          </v-btn>
          <v-btn
            icon
            density="compact"
            class="mr-2"
            variant="text"
            @click="minimize"
          >
            <v-icon>{{ protocolHeight <= 45 ? 'mdiChevronUp' : 'mdiChevronDown' }}</v-icon>
          </v-btn>
          <v-btn
            icon
            density="compact"
            variant="text"
            @click="close"
          >
            <v-icon>mdiClose</v-icon>
          </v-btn>
        </div>
      </div>

      <!-- Контент -->
      <div v-if="!isMinimized">
        <v-window v-model="activeTab">
          <v-window-item value="calculation">
            <v-card-text class="protocol-window">
              <div
                v-for="log in logs"
                :key="log.id"
                class="protocol-line"
              >
                <span class="protocol-timestamp">{{ log.timestamp }}</span>
                <span :class="['protocol-message', log.type]">{{ log.message }}</span>
                <v-btn
                  v-if="log.message.includes('Начало расчета')"
                  size="small"
                  variant="text"
                  color="primary"
                  class="ml-2"
                  @click="emit('open-calculation')"
                >
                  <v-icon
                    size="small"
                    class="mr-1"
                  >
                    mdiCalculator
                  </v-icon>
                  Открыть настройки
                </v-btn>
              </div>
            </v-card-text>
          </v-window-item>
          <v-window-item value="system">
            <v-card-text class="protocol-window">
              <div class="protocol-line">
                <span class="protocol-timestamp">{{ systemTime }}</span>
                <span class="protocol-message info">Системный протокол</span>
              </div>
            </v-card-text>
          </v-window-item>
        </v-window>
      </div>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';

const props = defineProps<{
  show: boolean
}>();

const emit = defineEmits<{
  'update:show': [value: boolean]
  'open-calculation': []
}>();

const logs = ref<Array<{id: string; timestamp: string; message: string; type: string}>>([]);
const protocolHeight = ref(300);
const activeTab = ref('calculation');
const isMinimized = ref(false);
const isFullscreen = ref(false);
const systemTime = ref('');

onMounted(() => {
  systemTime.value = new Date().toLocaleTimeString('ru-RU');
});

// Сбрасываем состояние при скрытии
watch(() => props.show, (newValue) => {
  if (!newValue) {
    isMinimized.value = false;
    protocolHeight.value = 300;
    isFullscreen.value = false;
  }
});

const startResize = (e: MouseEvent) => {
  e.preventDefault();
  const startY = e.clientY;
  const startHeight = protocolHeight.value;

  const handleMouseMove = (e: MouseEvent) => {
    const deltaY = startY - e.clientY;
    protocolHeight.value = Math.max(40, Math.min(300, startHeight + deltaY));
    if (protocolHeight.value > 40) {
      isMinimized.value = false;
    }
  };

  const handleMouseUp = () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
};

const addLog = (log: {timestamp: string; message: string; type: string}) => {
  logs.value.push({
    ...log,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  });
};

const clear = () => {
  logs.value = [];
};

const minimize = () => {
  if (protocolHeight.value <= 45) { // Если близко к минимальной высоте
    protocolHeight.value = 300; // Разворачиваем на максимум
    isMinimized.value = false;
  } else {
    protocolHeight.value = 40; // Сворачиваем до минимума
    isMinimized.value = true;
  }
};

const close = () => {
  emit('update:show', false);
};

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value;
  if (isFullscreen.value) {
    protocolHeight.value = window.innerHeight - 64; // 40px для заголовка
  } else {
    protocolHeight.value = 300;
  }
};

defineExpose({
  addLog,
  clear
});
</script>

<style scoped>
.protocol-container {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background-color: transparent;
  height: v-bind('protocolHeight + "px"');
  transition: height 0.2s ease;
}

.protocol-resize-handle {
  height: 4px;
  background-color: #e0e0e0;
  cursor: ns-resize;
  transition: background-color 0.2s;
  position: relative;
  z-index: 1001;
}

.protocol-resize-handle:hover {
  background-color: #bdbdbd;
}

.protocol-card {
  margin: 0;
  border-radius: 0;
  box-shadow: none;
  background-color: #f3f3f3;
  height: 100%;
  transition: all 0.2s ease;
}

.protocol-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0;
  background-color: #f3f3f3;
  border-bottom: 1px solid #e0e0e0;
  height: 40px;
}

.protocol-tabs-container {
  flex: 1;
}

.protocol-tabs {
  background-color: transparent;
  height: 40px;
}

:deep(.v-tabs__bar) {
  background-color: transparent;
}

:deep(.v-tab) {
  height: 40px;
  text-transform: none;
  letter-spacing: normal;
  font-size: 0.9em;
}

.protocol-actions {
  display: flex;
  align-items: center;
  padding-right: 4px;
}

.protocol-window {
  background-color: #ffffff;
  color: #333;
  font-family: 'Consolas', monospace;
  padding: 12px;
  margin: 0;
  height: v-bind('isMinimized ? "0px" : (protocolHeight - 40) + "px"');
  overflow-y: auto;
  border: 1px solid #e0e0e0;
  transition: height 0.2s ease;
}

.protocol-line {
  margin-bottom: 4px;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.4;
}

.protocol-timestamp {
  color: #666;
  margin-right: 8px;
  font-size: 0.9em;
}

.protocol-message {
  color: #333;
}

.protocol-message.success {
  color: #2e7d32;
}

.protocol-message.error {
  color: #c62828;
}

.protocol-message.info {
  color: #1565c0;
}

/* Стили для кнопок в светлой теме */
:deep(.v-btn) {
  color: #666;
}

:deep(.v-btn:hover) {
  color: #333;
  background-color: rgba(0, 0, 0, 0.04);
}

/* Стили для вкладок в светлой теме */
:deep(.v-tab) {
  color: #666;
}

:deep(.v-tab--selected) {
  color: #1976d2;
}

:deep(.v-tab:hover) {
  color: #333;
}

/* Добавляем стили для полноэкранного режима */
:deep(.v-card) {
  transition: all 0.2s ease;
}

:deep(.v-card.v-card--fullscreen) {
  border-radius: 0;
  margin: 0;
  max-width: 100%;
  max-height: 100%;
  width: 100%;
  height: 100%;
}

/* Улучшаем стили для кнопок в полноэкранном режиме */
:deep(.v-btn) {
  transition: all 0.2s ease;
}

:deep(.v-btn:hover) {
  transform: scale(1.1);
}
</style> 