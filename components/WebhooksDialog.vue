<template>
  <v-dialog
    v-model="visible"
    :max-width="820"
    :fullscreen="isMobile"
    scrollable
  >
    <v-card>
      <v-card-title class="d-flex align-center py-3 px-4">
        <v-icon
          class="mr-2"
          color="primary"
        >
          mdi-webhook
        </v-icon>
        <span class="text-h6 flex-grow-1">Вебхуки</span>
        <HintTip text="Закрыть">
          <template #default="{ props: tip }">
            <v-btn
              v-bind="tip"
              icon="mdi-close"
              variant="text"
              size="small"
              aria-label="Закрыть"
              @click="visible = false"
            />
          </template>
        </HintTip>
      </v-card-title>
      <v-divider />

      <v-card-text class="pa-4">
        <p class="text-body-2 mb-3">
          ERP, биллинг, CRM или call-центр узнают о новых дефектах, нарядах и отключениях сразу: ТГИД отправляет событие
          POST-запросом на адрес системы с подписью. Если адрес не ответил, отправка повторяется в течение суток.
          Подробности внешняя система читает через API v2 своим ключом («Учётная запись → Ключ API»).
        </p>
        <v-alert
          v-if="errorMessage"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-3"
          closable
          @click:close="errorMessage = ''"
        >
          {{ errorMessage }}
        </v-alert>

        <!-- секрет подписи: показан один раз -->
        <v-sheet
          v-if="secretShown"
          border
          rounded
          class="pa-3 mb-4"
        >
          <v-alert
            type="warning"
            variant="tonal"
            density="compact"
            class="mb-3"
            icon="mdi-key-alert-outline"
          >
            Секрет подписки «{{ secretShown.name }}» показан один раз. Передайте его разработчикам принимающей системы:
            по нему они проверяют, что событие пришло от ТГИД.
          </v-alert>
          <div
            v-for="block in secretBlocks"
            :key="block.title"
            class="mb-2"
          >
            <div class="text-caption text-medium-emphasis">
              {{ block.title }}
            </div>
            <div class="d-flex align-start ga-1">
              <code class="wh-code flex-grow-1">{{ block.text }}</code>
              <v-btn
                icon="mdi-content-copy"
                size="x-small"
                variant="text"
                :aria-label="`Копировать: ${block.title}`"
                @click="copy(block.text)"
              />
            </div>
          </div>
          <v-btn
            variant="text"
            size="small"
            @click="secretShown = null"
          >
            Готово
          </v-btn>
        </v-sheet>

        <!-- новая подписка или правка -->
        <v-expansion-panels
          v-model="formOpen"
          class="mb-4"
        >
          <v-expansion-panel value="form">
            <v-expansion-panel-title>
              <v-icon
                :icon="editingId ? 'mdi-pencil' : 'mdi-plus'"
                size="small"
                class="mr-2"
              />
              {{ editingId ? `Изменить подписку «${form.name}»` : 'Новая подписка' }}
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <v-text-field
                v-model="form.name"
                label="Название (какая система)"
                placeholder="1С: заявки"
                density="compact"
                maxlength="100"
                class="mb-2"
              />
              <v-text-field
                v-model="form.url"
                label="Адрес приёма событий"
                placeholder="https://erp.example.kz/hooks/tgid"
                hint="https://… Адреса внутренней сети и http разрешает служба на сервере API"
                persistent-hint
                density="compact"
                maxlength="500"
                class="mb-3"
              />
              <div class="text-caption text-medium-emphasis mb-1">
                События
              </div>
              <v-checkbox
                v-for="t in eventTypes"
                :key="t.type"
                v-model="form.events"
                :value="t.type"
                density="compact"
                hide-details
              >
                <template #label>
                  <span>{{ t.label }} <code class="wh-type">{{ t.type }}</code></span>
                </template>
              </v-checkbox>
              <div class="d-flex flex-wrap ga-2 mt-3">
                <v-btn
                  color="primary"
                  :prepend-icon="editingId ? 'mdi-content-save' : 'mdi-plus'"
                  :loading="saving"
                  :disabled="!form.name.trim() || !form.url.trim() || !form.events.length"
                  @click="save"
                >
                  {{ editingId ? 'Сохранить' : 'Создать подписку' }}
                </v-btn>
                <v-btn
                  v-if="editingId"
                  variant="text"
                  @click="resetForm"
                >
                  Отмена
                </v-btn>
              </div>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>

        <v-progress-linear
          v-if="loading"
          indeterminate
          class="mb-2"
        />
        <p
          v-else-if="!hooks.length"
          class="text-body-2 text-medium-emphasis"
        >
          Подписок ещё нет.
        </p>
        <v-list
          v-else
          density="compact"
          class="py-0"
        >
          <template
            v-for="h in hooks"
            :key="h.id"
          >
            <v-list-item
              class="px-0"
              :class="{ 'text-medium-emphasis': !h.active }"
            >
              <v-list-item-title class="d-flex align-center flex-wrap ga-2">
                <span class="text-truncate">{{ h.name }}</span>
                <v-chip
                  size="x-small"
                  :color="hookState(h).color"
                  variant="tonal"
                >
                  {{ hookState(h).text }}
                </v-chip>
              </v-list-item-title>
              <v-list-item-subtitle class="wh-sub">
                {{ h.url }}
              </v-list-item-subtitle>
              <v-list-item-subtitle class="wh-sub">
                {{ h.events.map(eventLabel).join(', ') }}
              </v-list-item-subtitle>
              <v-list-item-subtitle class="wh-sub">
                доставлено {{ h.deliveries.ok }}<span v-if="h.deliveries.pending"> · ждут повтора {{ h.deliveries.pending }}</span><span
                  v-if="h.deliveries.failed"
                  class="text-error"
                > · не доставлено {{ h.deliveries.failed }}</span>
              </v-list-item-subtitle>
              <div class="d-flex flex-wrap ga-1 mt-1">
                <v-btn
                  size="small"
                  variant="tonal"
                  prepend-icon="mdi-send-check-outline"
                  :loading="busy === `test-${h.id}`"
                  @click="test(h)"
                >
                  Проверить
                </v-btn>
                <v-btn
                  size="small"
                  variant="text"
                  prepend-icon="mdi-format-list-bulleted"
                  @click="toggleDeliveries(h)"
                >
                  Доставки
                </v-btn>
                <v-btn
                  size="small"
                  variant="text"
                  prepend-icon="mdi-pencil"
                  @click="edit(h)"
                >
                  Изменить
                </v-btn>
                <v-btn
                  size="small"
                  variant="text"
                  :prepend-icon="h.active ? 'mdi-pause' : 'mdi-play'"
                  :loading="busy === `active-${h.id}`"
                  @click="setActive(h, !h.active)"
                >
                  {{ h.active ? 'Выключить' : 'Включить' }}
                </v-btn>
                <v-btn
                  size="small"
                  variant="text"
                  prepend-icon="mdi-key-change"
                  :loading="busy === `secret-${h.id}`"
                  @click="rotate(h)"
                >
                  Новый секрет
                </v-btn>
                <v-btn
                  size="small"
                  variant="text"
                  color="error"
                  prepend-icon="mdi-delete-outline"
                  :loading="busy === `delete-${h.id}`"
                  @click="remove(h)"
                >
                  Удалить
                </v-btn>
              </div>
            </v-list-item>

            <!-- журнал доставок подписки -->
            <v-sheet
              v-if="openDeliveries === h.id"
              border
              rounded
              class="pa-2 mb-3"
            >
              <v-progress-linear
                v-if="deliveriesLoading"
                indeterminate
              />
              <p
                v-else-if="!deliveries.length"
                class="text-body-2 text-medium-emphasis ma-1"
              >
                Доставок ещё не было.
              </p>
              <v-table
                v-else
                density="compact"
                class="wh-table"
              >
                <thead>
                  <tr>
                    <th>Событие</th>
                    <th>Когда</th>
                    <th>Состояние</th>
                    <th>Ответ</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="d in deliveries"
                    :key="d.id"
                  >
                    <td>
                      {{ shortLabel(d.event_type) }}
                      <div class="text-caption text-medium-emphasis">
                        {{ d.event_key }}
                      </div>
                    </td>
                    <td>{{ shortTime(d.delivered_at || d.created_at) }}</td>
                    <td>
                      <v-chip
                        size="x-small"
                        :color="deliveryState(d).color"
                        variant="tonal"
                      >
                        {{ deliveryState(d).text }}
                      </v-chip>
                      <div
                        v-if="d.attempts > 1"
                        class="text-caption text-medium-emphasis"
                      >
                        попыток {{ d.attempts }}
                      </div>
                    </td>
                    <td class="wh-result">
                      {{ deliveryResult(d) }}
                    </td>
                    <td>
                      <v-btn
                        v-if="canRetry(d)"
                        size="x-small"
                        variant="text"
                        prepend-icon="mdi-refresh"
                        :loading="busy === `retry-${d.id}`"
                        @click="retry(h, d)"
                      >
                        Ещё раз
                      </v-btn>
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </v-sheet>
          </template>
        </v-list>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import HintTip from '~/components/HintTip.vue';
import { confirmAction } from '~/composables/useConfirm';
import { useMobile } from '~/composables/useMobile';
import { fastApiService } from '~/services/fastApiService';
import { useNotificationStore } from '~/stores/notificationStore';
import { formatApiError } from '~/utils/apiError';
import {
  deliveryResult,
  deliveryState,
  hookState,
  verifySnippet,
  type WebhookDelivery,
  type WebhookEventType,
  type WebhookRow,
} from '~/utils/webhooks';

/**
 * Вебхуки (фаза 2): подписки внешних систем на события ТГИД — адрес, события, секрет подписи; проверка
 * адреса событием ping, журнал доставок с повтором. Только администратор. Описание — itwin-api
 * docs/webhooks-api-v2.md.
 */
const visible = defineModel<boolean>({ default: false });
const { isMobile } = useMobile();
const notify = useNotificationStore();

const hooks = ref<WebhookRow[]>([]);
const eventTypes = ref<WebhookEventType[]>([]);
const loading = ref(false);
const saving = ref(false);
const busy = ref('');
const errorMessage = ref('');
const secretShown = ref<WebhookRow | null>(null);
const formOpen = ref<string | undefined>(undefined);
const editingId = ref<number | null>(null);
const form = reactive({ name: '', url: '', events: [] as string[] });
const openDeliveries = ref<number | null>(null);
const deliveries = ref<WebhookDelivery[]>([]);
const deliveriesLoading = ref(false);

const secretBlocks = computed(() => {
  const secret = secretShown.value?.secret;
  if (!secret) return [];
  return [
    { title: 'Секрет подписи', text: secret },
    { title: 'Проверка подписи у получателя (Node.js)', text: verifySnippet(secret) },
  ];
});

const eventLabel = (type: string) => eventTypes.value.find((t) => t.type === type)?.label ?? type;
/** Для таблицы: «Статус наряда изменён (назначен, …)» → «Статус наряда изменён» */
const shortLabel = (type: string) => (type === 'ping' ? 'Проверка (ping)' : eventLabel(type).replace(/\s*[(—].*$/, ''));
/** «Ещё раз» — не доставленной или ждущей повтора (отправляемую сейчас сервер не тронет); ping — не повторяется */
const canRetry = (d: WebhookDelivery) => d.event_id !== null && (d.status === 'failed' || (d.status === 'pending' && d.attempts > 0));
const shortTime = (iso: string) => new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });

const load = async () => {
  loading.value = true;
  errorMessage.value = '';
  try {
    const [types, rows] = await Promise.all([
      eventTypes.value.length ? Promise.resolve(eventTypes.value) : fastApiService.getWebhookEventTypes(),
      fastApiService.getWebhooks(),
    ]);
    eventTypes.value = types;
    hooks.value = rows;
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Подписки не загружены');
  } finally {
    loading.value = false;
  }
};

const resetForm = () => {
  editingId.value = null;
  Object.assign(form, { name: '', url: '', events: [] });
  formOpen.value = undefined;
};

const edit = (h: WebhookRow) => {
  editingId.value = h.id;
  Object.assign(form, { name: h.name, url: h.url, events: [...h.events] });
  formOpen.value = 'form';
};

const save = async () => {
  saving.value = true;
  errorMessage.value = '';
  const body = { name: form.name.trim(), url: form.url.trim(), events: form.events };
  try {
    if (editingId.value) {
      await fastApiService.updateWebhook(editingId.value, body);
      notify.showSuccess('Подписка сохранена');
    } else {
      secretShown.value = await fastApiService.createWebhook(body);
    }
    resetForm();
    await load();
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Подписка не сохранена');
  } finally {
    saving.value = false;
  }
};

/** Обёртка действий над подпиской: флажок занятости и ошибка в окне */
const run = async (key: string, fallback: string, action: () => Promise<void>) => {
  busy.value = key;
  errorMessage.value = '';
  try {
    await action();
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, fallback);
  } finally {
    busy.value = '';
  }
};

const loadDeliveries = async (id: number) => {
  deliveriesLoading.value = true;
  try {
    deliveries.value = await fastApiService.getWebhookDeliveries(id);
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Доставки не загружены');
  } finally {
    deliveriesLoading.value = false;
  }
};

const toggleDeliveries = (h: WebhookRow) => {
  if (openDeliveries.value === h.id) {
    openDeliveries.value = null;
    return;
  }
  openDeliveries.value = h.id;
  deliveries.value = [];
  void loadDeliveries(h.id);
};

const refreshOpen = async (h: WebhookRow) => {
  await load();
  if (openDeliveries.value === h.id) await loadDeliveries(h.id);
};

const test = (h: WebhookRow) => run(`test-${h.id}`, 'Проверка не выполнена', async () => {
  const r = await fastApiService.testWebhook(h.id);
  if (r.ok) notify.showSuccess(`«${h.name}»: адрес принял событие (ответ ${r.code}, ${r.ms} мс)`);
  else notify.showWarning(`«${h.name}»: ${r.error ?? 'адрес не принял событие'}`);
  await refreshOpen(h);
});

const setActive = (h: WebhookRow, active: boolean) => run(`active-${h.id}`, 'Подписка не изменена', async () => {
  await fastApiService.updateWebhook(h.id, { active });
  await load();
});

const rotate = async (h: WebhookRow) => {
  const ok = await confirmAction({
    text: `Выдать новый секрет подписке «${h.name}»? Старый перестанет действовать сразу: принимающая система должна получить новый.`,
    action: 'Новый секрет',
  });
  if (!ok) return;
  await run(`secret-${h.id}`, 'Секрет не выдан', async () => {
    secretShown.value = await fastApiService.rotateWebhookSecret(h.id);
  });
};

const remove = async (h: WebhookRow) => {
  const ok = await confirmAction({
    text: `Удалить подписку «${h.name}» вместе с журналом доставок? События на ${h.url} больше не пойдут.`,
    action: 'Удалить',
    color: 'error',
  });
  if (!ok) return;
  await run(`delete-${h.id}`, 'Подписка не удалена', async () => {
    await fastApiService.deleteWebhook(h.id);
    if (openDeliveries.value === h.id) openDeliveries.value = null;
    await load();
  });
};

const retry = (h: WebhookRow, d: WebhookDelivery) => run(`retry-${d.id}`, 'Повтор не поставлен', async () => {
  await fastApiService.retryWebhookDelivery(d.id);
  notify.showSuccess('Доставка поставлена в очередь — уйдёт в течение нескольких секунд');
  await refreshOpen(h);
});

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    notify.showSuccess('Скопировано');
  } catch {
    notify.showWarning('Не удалось скопировать — выделите текст вручную');
  }
};

watch(visible, (open) => {
  if (open) void load();
  else {
    secretShown.value = null;
    openDeliveries.value = null;
    resetForm();
  }
}, { immediate: true });

const openDialog = () => {
  visible.value = true;
};

defineExpose({ openDialog });
</script>

<style scoped>
.wh-code {
  display: block;
  padding: var(--space-1, 4px) var(--space-2, 8px);
  border-radius: var(--radius-1, 4px);
  background: rgba(var(--v-theme-on-surface), 0.05);
  font-size: var(--text-xs, 0.75rem);
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}
.wh-type { font-size: var(--text-xs, 0.75rem); opacity: 0.7; }
.wh-sub { white-space: normal; word-break: break-word; -webkit-line-clamp: unset; line-clamp: unset; }
.wh-table { font-size: var(--text-sm, 0.8125rem); }
.wh-result { max-width: 220px; word-break: break-word; }
</style>
