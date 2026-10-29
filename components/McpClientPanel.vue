<template>
  <v-expansion-panels
    v-if="info?.enabled !== false"
    variant="accordion"
  >
    <v-expansion-panel @group:selected="onOpen">
      <v-expansion-panel-title>
        <v-icon
          icon="mdi-robot-outline"
          size="small"
          class="mr-2"
        />
        ИИ-клиенты (MCP)
      </v-expansion-panel-title>
      <v-expansion-panel-text>
        <p class="text-body-2 mb-2">
          Claude, Cursor или свой агент подключаются к ТГИД по протоколу MCP: ищут объекты, трассируют сеть,
          локализуют аварию, смотрят режим и износ, запускают расчёт — с вашими правами.
        </p>
        <v-alert
          v-if="error"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-2"
        >
          {{ error }}
        </v-alert>

        <div class="text-caption text-medium-emphasis">
          Адрес сервера
        </div>
        <div class="d-flex align-center ga-1 mb-2">
          <code class="mcp-code flex-grow-1">{{ url }}</code>
          <HintTip text="Копировать адрес">
            <template #default="{ props: tip }">
              <v-btn
                v-bind="tip"
                icon="mdi-content-copy"
                size="x-small"
                variant="text"
                aria-label="Копировать адрес"
                @click="copy(url, 'Адрес')"
              />
            </template>
          </HintTip>
        </div>

        <template v-if="token">
          <v-alert
            type="warning"
            variant="tonal"
            density="compact"
            class="mb-2"
            icon="mdi-key-alert-outline"
          >
            Токен показан один раз и действует до {{ expiresText }} только для MCP. Храните его как пароль:
            досрочно его закрывает смена пароля или блокировка учётной записи.
          </v-alert>
          <div class="text-caption text-medium-emphasis">
            Claude Code — команда в терминале
          </div>
          <div class="d-flex align-start ga-1 mb-2">
            <code class="mcp-code flex-grow-1">{{ command }}</code>
            <v-btn
              icon="mdi-content-copy"
              size="x-small"
              variant="text"
              aria-label="Копировать команду"
              @click="copy(command, 'Команда')"
            />
          </div>
          <div class="text-caption text-medium-emphasis">
            Claude Desktop, Cursor и др. — настройка mcpServers
          </div>
          <div class="d-flex align-start ga-1 mb-2">
            <pre class="mcp-code flex-grow-1">{{ jsonConfig }}</pre>
            <v-btn
              icon="mdi-content-copy"
              size="x-small"
              variant="text"
              aria-label="Копировать настройку"
              @click="copy(jsonConfig, 'Настройка')"
            />
          </div>
        </template>
        <v-btn
          v-else
          color="primary"
          variant="tonal"
          prepend-icon="mdi-key-plus"
          :loading="issuing"
          class="mb-2"
          @click="issue"
        >
          Выдать токен{{ info ? ` на ${info.token_days} дн.` : '' }}
        </v-btn>

        <div
          v-if="info?.tools.length"
          class="text-caption text-medium-emphasis mt-1"
        >
          Инструменты: {{ info.tools.map((t) => t.title).join(', ') }}
        </div>
      </v-expansion-panel-text>
    </v-expansion-panel>
  </v-expansion-panels>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import HintTip from '~/components/HintTip.vue';
import { fastApiService } from '~/services/fastApiService';
import { getApiBaseUrl } from '~/services/api/http';
import { useAuthStore } from '~/stores/authStore';
import { useNotificationStore } from '~/stores/notificationStore';
import { formatApiError } from '~/utils/apiError';
import {
  claudeCodeCommand,
  mcpEndpointUrl,
  mcpJsonConfig,
  mcpServerName,
  type McpInfo,
  type McpToken,
} from '~/utils/mcpClient';

/**
 * Подключение ИИ-клиента к MCP-серверу ТГИД (кабинет): адрес, токен ИИ-клиента (только для /mcp, срок —
 * MCP_TOKEN_DAYS на сервере) и готовые настройки. Токен в браузере не хранится — показан до закрытия окна.
 */
const authStore = useAuthStore();
const notify = useNotificationStore();
const info = ref<McpInfo | null>(null);
const issued = ref<McpToken | null>(null);
const issuing = ref(false);
const error = ref('');

const url = computed(() => mcpEndpointUrl(getApiBaseUrl(), window.location.origin, info.value?.path ?? '/mcp'));
const name = computed(() => mcpServerName(authStore.city));
const token = computed(() => issued.value?.token ?? '');
const command = computed(() => claudeCodeCommand(name.value, url.value, token.value));
const jsonConfig = computed(() => mcpJsonConfig(name.value, url.value, token.value));
const expiresText = computed(() => (issued.value
  ? new Date(issued.value.expires_at).toLocaleDateString('ru-RU') : ''));

const onOpen = async ({ value }: { value: boolean }) => {
  if (!value || info.value) return;
  try {
    info.value = await fastApiService.getMcpInfo();
  } catch (err: unknown) {
    error.value = formatApiError(err, 'Сведения о MCP не загружены');
  }
};

const issue = async () => {
  issuing.value = true;
  error.value = '';
  try {
    issued.value = await fastApiService.createMcpToken();
  } catch (err: unknown) {
    error.value = formatApiError(err, 'Токен не выдан');
  } finally {
    issuing.value = false;
  }
};

const copy = async (text: string, what: string) => {
  try {
    await navigator.clipboard.writeText(text);
    notify.showSuccess(`${what} скопирован${what === 'Команда' || what === 'Настройка' ? 'а' : ''}`);
  } catch {
    notify.showWarning('Не удалось скопировать — выделите текст вручную');
  }
};
</script>

<style scoped>
.mcp-code {
  display: block;
  padding: var(--space-1, 4px) var(--space-2, 8px);
  border-radius: var(--radius-1, 4px);
  background: rgba(var(--v-theme-on-surface), 0.05);
  font-size: var(--text-xs, 0.75rem);
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}
</style>
