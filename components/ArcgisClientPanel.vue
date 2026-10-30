<template>
  <v-expansion-panels variant="accordion">
    <v-expansion-panel>
      <v-expansion-panel-title>
        <v-icon
          icon="mdi-layers-outline"
          size="small"
          class="mr-2"
        />
        ArcGIS и QGIS (FeatureServer)
      </v-expansion-panel-title>
      <v-expansion-panel-text>
        <p class="text-body-2 mb-2">
          ArcGIS Pro, ArcGIS Online и QGIS подключают слои сети ТГИД только для чтения: участки, узлы, потребители,
          источники и задвижки — с вашими правами.
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
          Адрес сервиса
        </div>
        <div class="d-flex align-center ga-1 mb-2">
          <code class="agp-code flex-grow-1">{{ url }}</code>
          <v-btn
            icon="mdi-content-copy"
            size="x-small"
            variant="text"
            aria-label="Копировать адрес сервиса"
            @click="copy(url, 'Адрес')"
          />
        </div>

        <template v-if="token">
          <v-alert
            type="warning"
            variant="tonal"
            density="compact"
            class="mb-2"
            icon="mdi-key-alert-outline"
          >
            Ключ показан один раз и действует до {{ expiresText }} только для этих слоёв. Храните его как пароль:
            досрочно его закрывает смена пароля или блокировка учётной записи.
          </v-alert>
          <div class="text-caption text-medium-emphasis">
            ArcGIS Pro и ArcGIS Online — адрес с ключом («Добавить данные → по адресу»)
          </div>
          <div class="d-flex align-start ga-1 mb-2">
            <code class="agp-code flex-grow-1">{{ urlWithToken }}</code>
            <v-btn
              icon="mdi-content-copy"
              size="x-small"
              variant="text"
              aria-label="Копировать адрес с ключом"
              @click="copy(urlWithToken, 'Адрес')"
            />
          </div>
          <div class="text-caption text-medium-emphasis">
            QGIS — соединение «ArcGIS REST Server», проверка подлинности «API Header»
          </div>
          <div class="d-flex align-start ga-1 mb-2">
            <code class="agp-code flex-grow-1">{{ header }}</code>
            <v-btn
              icon="mdi-content-copy"
              size="x-small"
              variant="text"
              aria-label="Копировать заголовок"
              @click="copy(header, 'Заголовок')"
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
          Выдать ключ
        </v-btn>

        <div class="text-caption text-medium-emphasis mt-1">
          Слои: {{ ARCGIS_LAYERS.map((name, i) => `${i} — ${name}`).join(', ') }}
        </div>
      </v-expansion-panel-text>
    </v-expansion-panel>
  </v-expansion-panels>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { fastApiService } from '~/services/fastApiService';
import { getApiBaseUrl } from '~/services/api/http';
import { useNotificationStore } from '~/stores/notificationStore';
import { formatApiError } from '~/utils/apiError';
import { ARCGIS_LAYERS, featureServerUrl, qgisHeader, withToken, type ArcgisToken } from '~/utils/arcgisClient';

/**
 * Подключение ArcGIS-клиентов к слоям сети ТГИД (кабинет): адрес FeatureServer и ключ ArcGIS (только чтение
 * этих адресов, срок — ARCGIS_TOKEN_DAYS на сервере). Ключ в браузере не хранится — показан до закрытия окна.
 */
const notify = useNotificationStore();
const issued = ref<ArcgisToken | null>(null);
const issuing = ref(false);
const error = ref('');

const url = computed(() => featureServerUrl(getApiBaseUrl(), window.location.origin));
const token = computed(() => issued.value?.token ?? '');
const urlWithToken = computed(() => withToken(url.value, token.value));
const header = computed(() => qgisHeader(token.value));
const expiresText = computed(() => (issued.value ? new Date(issued.value.expires_at).toLocaleDateString('ru-RU') : ''));

const issue = async () => {
  issuing.value = true;
  error.value = '';
  try {
    issued.value = await fastApiService.createArcgisToken();
  } catch (err: unknown) {
    error.value = formatApiError(err, 'Ключ не выдан');
  } finally {
    issuing.value = false;
  }
};

const copy = async (text: string, what: string) => {
  try {
    await navigator.clipboard.writeText(text);
    notify.showSuccess(`${what} скопирован`);
  } catch {
    notify.showWarning('Не удалось скопировать — выделите текст вручную');
  }
};
</script>

<style scoped>
.agp-code {
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
