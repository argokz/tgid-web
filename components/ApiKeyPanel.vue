<template>
  <v-expansion-panels variant="accordion">
    <v-expansion-panel>
      <v-expansion-panel-title>
        <v-icon
          icon="mdi-api"
          size="small"
          class="mr-2"
        />
        Ключ API v2 (внешние системы)
      </v-expansion-panel-title>
      <v-expansion-panel-text>
        <p class="text-body-2 mb-2">
          ERP, биллинг или CRM читают события, наряды, отключения и дефекты и создают заявки через API v2 — с вашими
          правами. Ключ действует только на адресах /api/v2.
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

        <template v-if="issued">
          <v-alert
            type="warning"
            variant="tonal"
            density="compact"
            class="mb-2"
            icon="mdi-key-alert-outline"
          >
            Ключ показан один раз и действует до {{ expiresText }}. Храните его как пароль: досрочно его закрывает смена
            пароля или блокировка учётной записи.
          </v-alert>
          <div
            v-for="block in blocks"
            :key="block.title"
            class="mb-2"
          >
            <div class="text-caption text-medium-emphasis">
              {{ block.title }}
            </div>
            <div class="d-flex align-start ga-1">
              <code class="ak-code flex-grow-1">{{ block.text }}</code>
              <v-btn
                icon="mdi-content-copy"
                size="x-small"
                variant="text"
                :aria-label="`Копировать: ${block.title}`"
                @click="copy(block.text)"
              />
            </div>
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
          Выдать ключ
        </v-btn>
      </v-expansion-panel-text>
    </v-expansion-panel>
  </v-expansion-panels>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { fastApiService } from '~/services/fastApiService';
import { useNotificationStore } from '~/stores/notificationStore';
import { formatApiError } from '~/utils/apiError';
import { apiCurl, type ApiKeyIssued } from '~/utils/webhooks';

/**
 * Ключ API v2 (кабинет): долгий ключ scope api на API_TOKEN_DAYS дней, адрес API и описание OpenAPI для
 * генерации клиента. Ключ в браузере не хранится — показан до закрытия окна.
 */
const notify = useNotificationStore();
const issued = ref<ApiKeyIssued | null>(null);
const issuing = ref(false);
const error = ref('');

const expiresText = computed(() => (issued.value ? new Date(issued.value.expires_at).toLocaleDateString('ru-RU') : ''));
const blocks = computed(() => {
  const k = issued.value;
  if (!k) return [];
  return [
    { title: 'Ключ (заголовок Authorization: Bearer …)', text: k.token },
    { title: 'Адрес API', text: k.api_url },
    { title: 'Описание OpenAPI — для генерации клиента', text: k.openapi_url },
    { title: 'Пример: лента событий', text: apiCurl(k.api_url, k.token) },
  ];
});

const issue = async () => {
  issuing.value = true;
  error.value = '';
  try {
    issued.value = await fastApiService.createApiKey();
  } catch (err: unknown) {
    error.value = formatApiError(err, 'Ключ не выдан');
  } finally {
    issuing.value = false;
  }
};

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    notify.showSuccess('Скопировано');
  } catch {
    notify.showWarning('Не удалось скопировать — выделите текст вручную');
  }
};
</script>

<style scoped>
.ak-code {
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
