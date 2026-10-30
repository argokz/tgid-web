<template>
  <v-dialog
    v-model="visible"
    :max-width="760"
    :fullscreen="isMobile"
    scrollable
  >
    <v-card>
      <v-card-title class="d-flex align-center py-3 px-4">
        <v-icon
          class="mr-2"
          color="primary"
        >
          mdi-application-brackets-outline
        </v-icon>
        <span class="text-h6 flex-grow-1">Встраиваемые карты</span>
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
          Карта сети в iframe на портале акимата, ЕДДС или в кабинете потребителя — без входа, по ключу встраивания.
          Ключ виден в коде сайта, поэтому он открывает только выбранные слои (без имён потребителей) и только на
          указанных сайтах. Отозванный ключ перестаёт работать в течение минуты.
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

        <!-- только что выданный ключ: показан один раз -->
        <v-sheet
          v-if="issued"
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
            Ключ «{{ issued.name }}» показан один раз. Вставьте код на сайт сейчас или сохраните его.
          </v-alert>
          <div
            v-for="block in issuedBlocks"
            :key="block.title"
            class="mb-2"
          >
            <div class="text-caption text-medium-emphasis">
              {{ block.title }}
            </div>
            <div class="d-flex align-start ga-1">
              <code class="ek-code flex-grow-1">{{ block.text }}</code>
              <v-btn
                icon="mdi-content-copy"
                size="x-small"
                variant="text"
                :aria-label="`Копировать: ${block.title}`"
                @click="copy(block.text)"
              />
            </div>
          </div>
          <div class="d-flex flex-wrap ga-2">
            <v-btn
              variant="tonal"
              size="small"
              prepend-icon="mdi-open-in-new"
              :href="issuedPreview"
              target="_blank"
              rel="noopener"
            >
              Открыть карту
            </v-btn>
            <v-btn
              variant="text"
              size="small"
              @click="issued = null"
            >
              Готово
            </v-btn>
          </div>
        </v-sheet>

        <!-- новый ключ -->
        <v-expansion-panels
          v-model="formOpen"
          class="mb-4"
        >
          <v-expansion-panel value="new">
            <v-expansion-panel-title>
              <v-icon
                icon="mdi-key-plus"
                size="small"
                class="mr-2"
              />
              Новый ключ встраивания
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <v-text-field
                v-model="form.name"
                label="Название (для кого ключ)"
                placeholder="Портал акимата"
                density="compact"
                maxlength="100"
                class="mb-2"
              />
              <v-textarea
                v-model="form.origins"
                label="Сайты, где можно показывать карту"
                hint="По одному на строку: https://akimat.kz. Путь не нужен — только схема, хост и порт."
                persistent-hint
                rows="2"
                auto-grow
                density="compact"
                class="mb-3"
              />
              <div class="text-caption text-medium-emphasis mb-1">
                Слои
              </div>
              <div class="d-flex flex-wrap ga-x-4 mb-2">
                <v-checkbox
                  v-for="id in EMBED_LAYER_IDS"
                  :key="id"
                  v-model="form.layers"
                  :value="id"
                  :label="EMBED_LAYER_TITLES[id]"
                  density="compact"
                  hide-details
                />
              </div>
              <v-checkbox
                v-model="form.outages"
                label="Зоны отключений (если публичная лента отключений включена)"
                density="compact"
                hide-details
                class="mb-2"
              />
              <div class="d-flex flex-wrap ga-3">
                <v-text-field
                  v-model="form.fragments"
                  label="Только фрагменты"
                  placeholder="все"
                  hint="Номера через запятую"
                  persistent-hint
                  density="compact"
                  class="ek-field"
                />
                <v-select
                  v-model="form.days"
                  :items="DAYS"
                  label="Срок действия"
                  density="compact"
                  class="ek-field"
                />
              </div>
              <v-checkbox
                v-model="form.useView"
                :disabled="!mapStore.map"
                label="Начальный вид — как сейчас на карте (иначе вся сеть)"
                density="compact"
                hide-details
                class="mb-3"
              />
              <v-btn
                color="primary"
                prepend-icon="mdi-key-plus"
                :loading="saving"
                :disabled="!form.name.trim() || !form.layers.length || !form.origins.trim()"
                @click="create"
              >
                Выдать ключ
              </v-btn>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>

        <v-progress-linear
          v-if="loading"
          indeterminate
          class="mb-2"
        />
        <p
          v-else-if="!keys.length"
          class="text-body-2 text-medium-emphasis"
        >
          Ключей встраивания ещё нет.
        </p>
        <v-list
          v-else
          density="compact"
          class="py-0"
        >
          <v-list-item
            v-for="k in keys"
            :key="k.id"
            class="px-0"
            :class="{ 'text-medium-emphasis': !k.active }"
          >
            <v-list-item-title class="d-flex align-center ga-2">
              <span class="text-truncate">{{ k.name }}</span>
              <v-chip
                size="x-small"
                :color="k.active ? 'success' : undefined"
                variant="tonal"
              >
                {{ statusText(k) }}
              </v-chip>
            </v-list-item-title>
            <v-list-item-subtitle class="ek-sub">
              {{ k.key_prefix }}… · {{ k.origins.join(', ') }}
            </v-list-item-subtitle>
            <v-list-item-subtitle class="ek-sub">
              {{ k.layers.map((l) => EMBED_LAYER_TITLES[l]).join(', ') }}<span v-if="k.fragments"> · фрагменты {{ k.fragments.join(', ') }}</span>
              · {{ usedText(k) }}
            </v-list-item-subtitle>
            <template #append>
              <v-btn
                v-if="k.active"
                variant="text"
                size="small"
                color="error"
                prepend-icon="mdi-cancel"
                :loading="revoking === k.id"
                @click="revoke(k)"
              >
                Отозвать
              </v-btn>
            </template>
          </v-list-item>
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
import { useMapStore } from '~/stores/mapStore';
import { useNotificationStore } from '~/stores/notificationStore';
import { formatApiError } from '~/utils/apiError';
import {
  EMBED_LAYER_IDS,
  EMBED_LAYER_TITLES,
  embedPageUrl,
  iframeSnippet,
  sdkSnippet,
  type EmbedKeyRow,
  type EmbedLayerId,
} from '~/utils/embedProtocol';

/**
 * Ключи встраиваемых карт (фаза 2, п. 14): выдать ключ для сайта (слои, фрагменты, начальный вид, срок),
 * показать код iframe и SDK, отозвать. Только администратор. Страница карты — pages/embed.vue.
 */
const visible = defineModel<boolean>({ default: false });
const { isMobile } = useMobile();
const mapStore = useMapStore();
const notify = useNotificationStore();

const DAYS = [
  { title: 'Без срока', value: 0 },
  { title: '90 дней', value: 90 },
  { title: '1 год', value: 365 },
];
const VIEW_DIGITS = 1e5;

const keys = ref<EmbedKeyRow[]>([]);
const loading = ref(false);
const saving = ref(false);
const revoking = ref<number | null>(null);
const errorMessage = ref('');
const issued = ref<EmbedKeyRow | null>(null);
const formOpen = ref<string | undefined>(undefined);
const form = reactive({
  name: '',
  origins: '',
  layers: ['pipes', 'heat_sources'] as EmbedLayerId[],
  outages: false,
  fragments: '',
  days: 0,
  useView: false,
});

/** Адрес страницы карты и SDK — от адреса этого приложения (app.baseURL — например, /itwin-map/) */
const appBase = () => `${window.location.origin}${useRuntimeConfig().app.baseURL.replace(/\/?$/, '/')}`;

const issuedBlocks = computed(() => {
  const k = issued.value;
  if (!k?.key) return [];
  const base = appBase();
  const opts = { embedUrl: `${base}embed`, key: k.key };
  return [
    { title: 'Ключ', text: k.key },
    { title: 'Код для сайта — iframe', text: iframeSnippet(opts) },
    { title: 'Код для сайта — SDK (события и команды карте)', text: sdkSnippet({ ...opts, sdkUrl: `${base}tgid-embed.js` }) },
  ];
});
const issuedPreview = computed(() => (issued.value?.key ? embedPageUrl({ embedUrl: `${appBase()}embed`, key: issued.value.key }) : ''));

const statusText = (k: EmbedKeyRow) => {
  if (k.revoked_at) return `отозван ${new Date(k.revoked_at).toLocaleDateString('ru-RU')}`;
  if (!k.active) return 'истёк';
  return k.expires_at ? `до ${new Date(k.expires_at).toLocaleDateString('ru-RU')}` : 'действует';
};

const usedText = (k: EmbedKeyRow) => (k.last_used_at
  ? `открывали ${new Date(k.last_used_at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}`
  : 'ещё не открывали');

const load = async () => {
  loading.value = true;
  errorMessage.value = '';
  try {
    keys.value = await fastApiService.getEmbedKeys();
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Ключи встраивания не загружены');
  } finally {
    loading.value = false;
  }
};

/** «74, 75 76» → [74, 75, 76]; null — пусто (все фрагменты); undefined — ошибка ввода */
const parseFragments = (text: string): number[] | null | undefined => {
  const parts = text.split(/[\s,;]+/).filter(Boolean);
  if (!parts.length) return null;
  const nums = parts.map(Number);
  return nums.every((n) => Number.isInteger(n) && n > 0) ? nums : undefined;
};

const currentView = () => {
  const map = mapStore.map;
  if (!form.useView || !map) return null;
  const c = map.getCenter();
  const r = (n: number) => Math.round(n * VIEW_DIGITS) / VIEW_DIGITS;
  return { center: [r(c.lng), r(c.lat)] as [number, number], zoom: Math.round(map.getZoom() * 10) / 10 };
};

const create = async () => {
  const fragments = parseFragments(form.fragments);
  if (fragments === undefined) {
    errorMessage.value = 'Фрагменты — номера через запятую';
    return;
  }
  saving.value = true;
  errorMessage.value = '';
  try {
    issued.value = await fastApiService.createEmbedKey({
      name: form.name.trim(),
      origins: form.origins.split(/\s+/).filter(Boolean),
      layers: form.layers,
      fragments,
      outages: form.outages,
      view: currentView(),
      days: form.days || null,
    });
    formOpen.value = undefined;
    Object.assign(form, { name: '', origins: '', fragments: '', useView: false });
    await load();
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Ключ не выдан');
  } finally {
    saving.value = false;
  }
};

const revoke = async (k: EmbedKeyRow) => {
  const ok = await confirmAction({
    text: `Отозвать ключ «${k.name}»? Карта на сайтах ${k.origins.join(', ')} перестанет открываться.`,
    action: 'Отозвать',
    color: 'error',
  });
  if (!ok) return;
  revoking.value = k.id;
  try {
    await fastApiService.revokeEmbedKey(k.id);
    await load();
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Ключ не отозван');
  } finally {
    revoking.value = null;
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

watch(visible, (open) => {
  if (open) void load();
  else issued.value = null;
}, { immediate: true });

const openDialog = () => {
  visible.value = true;
};

defineExpose({ openDialog });
</script>

<style scoped>
.ek-code {
  display: block;
  padding: var(--space-1, 4px) var(--space-2, 8px);
  border-radius: var(--radius-1, 4px);
  background: rgba(var(--v-theme-on-surface), 0.05);
  font-size: var(--text-xs, 0.75rem);
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}
.ek-field { min-width: 180px; flex: 1 1 180px; }
.ek-sub { white-space: normal; }
</style>
