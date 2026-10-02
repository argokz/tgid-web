<template>
  <v-dialog
    v-model="isOpen"
    :max-width="mobile ? undefined : 1100"
    :fullscreen="mobile"
    scrollable
  >
    <v-card :rounded="mobile ? '0' : undefined">
      <v-card-title class="d-flex align-center py-2">
        <v-icon class="mr-2">
          mdi-format-list-text
        </v-icon>
        Расчёты
        <v-spacer />
        <v-btn
          icon="mdi-refresh"
          variant="text"
          density="compact"
          :loading="loading"
          @click="load"
        />
        <v-btn
          icon="mdi-close"
          variant="text"
          density="compact"
          @click="isOpen = false"
        />
      </v-card-title>

      <v-card-text class="pt-0">
        <div class="d-flex flex-wrap ga-2 mb-2">
          <v-autocomplete
            v-model="filter.file_id"
            :items="fragmentItems"
            item-title="name"
            item-value="id"
            label="Фрагмент"
            variant="outlined"
            density="compact"
            clearable
            hide-details
            style="min-width: 220px; flex: 2 1 220px;"
          />
          <v-select
            v-model="filter.mode"
            :items="modeOptions"
            item-title="label"
            item-value="value"
            label="Режим"
            variant="outlined"
            density="compact"
            clearable
            hide-details
            style="min-width: 160px; flex: 1 1 160px;"
          />
          <v-text-field
            v-model="filter.author"
            label="Автор"
            variant="outlined"
            density="compact"
            clearable
            hide-details
            style="min-width: 140px; flex: 1 1 140px;"
          />
          <v-text-field
            v-model="filter.date_from"
            label="С даты"
            type="date"
            variant="outlined"
            density="compact"
            hide-details
            style="min-width: 150px; flex: 1 1 150px;"
          />
          <v-text-field
            v-model="filter.date_to"
            label="По дату"
            type="date"
            variant="outlined"
            density="compact"
            hide-details
            style="min-width: 150px; flex: 1 1 150px;"
          />
        </div>

        <v-alert
          v-if="error"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-2"
        >
          {{ error }}
        </v-alert>

        <v-data-table-server
          v-model:items-per-page="itemsPerPage"
          v-model:page="page"
          :headers="headers"
          :items="items"
          :items-length="total"
          :loading="loading"
          :items-per-page-options="[25, 50, 100]"
          density="compact"
          no-data-text="Расчётов нет"
          @update:options="load"
        >
          <template #[`item.calculated_at`]="{ item }">
            {{ formatDate(item.calculated_at) }}
          </template>
          <template #[`item.fragment_name`]="{ item }">
            {{ item.fragment_name || item.fileid }}
            <v-chip
              v-if="item.is_latest"
              size="x-small"
              color="primary"
              class="ml-1"
            >
              текущий
            </v-chip>
          </template>
          <template #[`item.mode`]="{ item }">
            {{ modeLabel(item) }}
          </template>
          <template #[`item.tn`]="{ item }">
            {{ item.tn ?? '—' }}
          </template>
          <template #[`item.actions`]="{ item }">
            <v-btn
              v-if="authStore.canRunWritingCalc"
              icon="mdi-delete"
              variant="text"
              size="small"
              color="error"
              :disabled="!canDelete(item)"
              :title="deleteHint(item)"
              @click="askDelete(item)"
            />
          </template>
        </v-data-table-server>
        <p
          v-if="!authStore.canRunWritingCalc"
          class="text-caption text-medium-emphasis mt-1"
        >
          Удаление расчётов: нужна роль calculator или выше и MUTATIONS_ENABLED=true на сервере.
        </p>
      </v-card-text>
    </v-card>

    <v-dialog
      v-model="confirmOpen"
      max-width="520"
    >
      <v-card>
        <v-card-title class="text-h6">
          Удалить расчёт #{{ pending?.id }}?
        </v-card-title>
        <v-card-text>
          <p class="mb-2">
            «{{ pending?.name || 'без названия' }}», {{ pending ? formatDate(pending.calculated_at) : '' }},
            фрагмент {{ pending?.fragment_name || pending?.fileid }}.
          </p>
          <p class="mb-2">
            Будут удалены строка расчёта и все его результаты (ut_out, us_out, pt_out и прочие *_out). Отменить нельзя.
          </p>
          <p
            v-if="pending?.is_latest"
            class="text-warning"
          >
            Это текущий расчёт фрагмента: карта и анализ перейдут на предыдущий расчёт.
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="confirmOpen = false"
          >
            Отмена
          </v-btn>
          <v-btn
            color="error"
            variant="elevated"
            :loading="deleting"
            @click="confirmDelete"
          >
            Удалить
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-dialog>
</template>

<script setup lang="ts">
import { formatApiError } from '~/utils/apiError';
import { computed, reactive, ref, watch } from 'vue';
import { useMobile } from '~/composables/useMobile';
import {
  fastApiService,
  type CalculationListItem,
  type SetyCalcMode,
} from '~/services/fastApiService';
import { useAuthStore } from '~/stores/authStore';
import { useFragmentStore } from '~/stores/fragmentStore';
import { useNotificationStore } from '~/stores/notificationStore';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; 'deleted': [id: number] }>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

const { isMobile: mobile } = useMobile();
const authStore = useAuthStore();
const fragmentStore = useFragmentStore();
const notificationStore = useNotificationStore();

const fragmentItems = computed(() =>
  fragmentStore.getFragments.map(f => ({ id: Number(f.id), name: f.name ?? `Фрагмент ${f.id}` })));

const modeOptions = [
  { label: 'Плановый', value: 'plan' },
  { label: 'Аварийный', value: 'emergency' },
];

const headers = [
  { title: 'ID', key: 'id', sortable: false, width: 70 },
  { title: 'Дата', key: 'calculated_at', sortable: false },
  { title: 'Фрагмент', key: 'fragment_name', sortable: false },
  { title: 'Режим', key: 'mode', sortable: false },
  { title: 'Tн, °C', key: 'tn', sortable: false },
  { title: 'Наименование', key: 'name', sortable: false },
  { title: 'Автор', key: 'user_gid', sortable: false },
  { title: '', key: 'actions', sortable: false, width: 56 },
];

const filter = reactive<{
  file_id: number | null;
  mode: SetyCalcMode | null;
  author: string | null;
  date_from: string | null;
  date_to: string | null;
}>({ file_id: null, mode: null, author: null, date_from: null, date_to: null });

const items = ref<CalculationListItem[]>([]);
const total = ref(0);
const page = ref(1);
const itemsPerPage = ref(25);
const loading = ref(false);
const error = ref('');

const confirmOpen = ref(false);
const pending = ref<CalculationListItem | null>(null);
const deleting = ref(false);

const formatDate = (value: string | null) =>
  (value ? new Date(value).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : '—');

const modeLabel = (item: CalculationListItem) => {
  if (item.mode === 'plan') return item.params?.is_tg ? 'Плановый (по граф.)' : 'Плановый';
  if (item.mode === 'emergency') {
    if (item.params?.is_leto) return 'Аварийный, летний';
    return item.params?.g_equival ? 'Аварийный (экв.)' : 'Аварийный (дет.)';
  }
  return '—';
};

const canDelete = (item: CalculationListItem) => {
  if (!authStore.canRunWritingCalc) return false;
  return authStore.canEdit || (item.user_gid ?? '') === authStore.username;
};

const deleteHint = (item: CalculationListItem) => {
  if (!authStore.mutationsEnabledServer) return 'Удаление выключено на сервере';
  if (!authStore.canCalculate) return 'Нужна роль calculator или выше';
  if (!canDelete(item)) return 'Чужой расчёт может удалить editor или admin';
  return 'Удалить расчёт и его результаты';
};

// При открытии список запрашивают и watch(isOpen), и v-data-table-server (update:options при
// монтировании); смена фильтра — watch + update:options при сбросе страницы. Одинаковый запрос,
// который уже в полёте, не повторяем.
let inflight: { key: string; promise: Promise<void> } | null = null;

const load = (): Promise<void> => {
  const query = {
    file_id: filter.file_id,
    mode: filter.mode,
    author: filter.author?.trim() || null,
    date_from: filter.date_from ? `${filter.date_from}T00:00:00` : null,
    date_to: filter.date_to ? `${filter.date_to}T23:59:59` : null,
    limit: itemsPerPage.value,
    offset: (page.value - 1) * itemsPerPage.value,
  };
  const key = JSON.stringify(query);
  if (inflight?.key === key) return inflight.promise;
  const promise = (async () => {
    loading.value = true;
    error.value = '';
    try {
      const res = await fastApiService.listCalculations(query);
      if (inflight?.key !== key) return; // ответ устарел: уже запрошены другие фильтры/страница
      items.value = res.items;
      total.value = res.total;
    } catch (e: any) {
      if (inflight?.key !== key) return;
      error.value = formatApiError(e, 'Не удалось загрузить список расчётов');
    } finally {
      if (inflight?.key === key) {
        inflight = null;
        loading.value = false;
      }
    }
  })();
  inflight = { key, promise };
  return promise;
};

const askDelete = (item: CalculationListItem) => {
  pending.value = item;
  confirmOpen.value = true;
};

const confirmDelete = async () => {
  if (!pending.value) return;
  deleting.value = true;
  const id = pending.value.id;
  try {
    const res = await fastApiService.deleteCalculation(id);
    const rows = Object.values(res.deleted_rows || {}).reduce((a, b) => a + b, 0);
    notificationStore.showSuccess(`Расчёт #${id} удалён (строк результатов: ${rows})`);
    confirmOpen.value = false;
    emit('deleted', id);
    await load();
  } catch (e: any) {
    notificationStore.showError(formatApiError(e, `Не удалось удалить расчёт №${id}`));
  } finally {
    deleting.value = false;
  }
};

watch(
  () => [filter.file_id, filter.mode, filter.author, filter.date_from, filter.date_to],
  () => {
    page.value = 1;
    if (isOpen.value) void load();
  },
);

watch(isOpen, (open) => {
  if (!open) return;
  if (!fragmentStore.getFragments.length) void fragmentStore.loadFragments();
  // актуальный флаг MUTATIONS_ENABLED и роль для кнопки удаления
  void (authStore.accessToken ? authStore.refreshMe() : authStore.loadConfig());
  void load();
});
</script>
