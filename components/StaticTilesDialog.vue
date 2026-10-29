<template>
  <v-dialog
    v-model="visible"
    :max-width="680"
    :fullscreen="isMobile"
    scrollable
  >
    <v-card>
      <v-card-title class="d-flex align-center py-3 px-4">
        <v-icon
          class="mr-2"
          color="primary"
        >
          mdi-layers-outline
        </v-icon>
        <span class="text-h6 flex-grow-1">Статичные слои (PMTiles)</span>
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
          Большой редко меняющийся слой (здания) запекается в один архив PMTiles: карта берёт его тайлы из API
          готовыми, а не строит каждый заново в базе. После правки слоя архив нужно пересобрать; удалённый архив —
          слой снова из GeoServer или martin.
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
        <v-alert
          v-if="changed"
          type="info"
          variant="tonal"
          density="compact"
          class="mb-3"
        >
          Карта возьмёт изменённые архивы после обновления страницы.
        </v-alert>

        <v-progress-linear
          v-if="loading"
          indeterminate
          class="mb-3"
        />
        <p
          v-else-if="!rows.length"
          class="text-body-2 text-medium-emphasis"
        >
          В базе города нет слоёв, которые можно запечь: нужны функции тайлов martin для слоёв без параметров
          (здания).
        </p>

        <v-card
          v-for="row in rows"
          :key="row.layer"
          variant="outlined"
          class="mb-3 pa-3"
        >
          <div class="d-flex flex-wrap align-center ga-2">
            <span class="text-subtitle-1 font-weight-medium">{{ row.layer }}</span>
            <v-chip
              size="small"
              :color="row.archive ? 'success' : undefined"
              variant="tonal"
            >
              {{ row.archive ? 'запечён' : 'не запечён' }}
            </v-chip>
            <v-spacer />
            <span
              v-if="row.archive"
              class="text-caption text-medium-emphasis"
            >
              {{ archiveText(row.archive) }}
            </span>
          </div>

          <div
            v-if="canBuild && row.bakeable"
            class="d-flex flex-wrap align-center ga-2 mt-2"
          >
            <v-text-field
              v-model.number="row.maxzoom"
              label="До зума"
              type="number"
              :min="row.minzoom"
              :max="MAX_ZOOM"
              :hint="`с ${row.minzoom}; выше — растяжение тайлов`"
              persistent-hint
              density="compact"
              variant="outlined"
              class="static-zoom"
            />
            <v-btn
              color="primary"
              variant="tonal"
              prepend-icon="mdi-refresh"
              :loading="row.task !== null"
              :disabled="anyRunning && row.task === null"
              @click="build(row)"
            >
              {{ row.archive ? 'Пересобрать' : 'Запечь' }}
            </v-btn>
            <v-btn
              v-if="row.archive"
              variant="text"
              prepend-icon="mdi-delete-outline"
              :disabled="row.task !== null"
              @click="remove(row)"
            >
              Удалить
            </v-btn>
          </div>
          <p
            v-if="row.message"
            class="text-caption mt-2 mb-0"
          >
            {{ row.message }}
          </p>
        </v-card>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import HintTip from '~/components/HintTip.vue';
import { confirmAction } from '~/composables/useConfirm';
import { useMobile } from '~/composables/useMobile';
import { fastApiService } from '~/services/fastApiService';
import { formatApiError } from '~/utils/apiError';
import { formatSize, type StaticTileArchive } from '~/utils/staticTiles';

/**
 * Статичные слои в PMTiles (п. 13 фазы 1): какие слои базы города можно запечь, состояние архивов,
 * запуск запекания (задача воркера, ход — GET /api/v1/task/{id}) и удаление архива. Только администратор.
 */
const visible = defineModel<boolean>({ default: false });
const { isMobile } = useMobile();

const MAX_ZOOM = 18;
const DEFAULT_MAXZOOM = 16;
const POLL_MS = 2000;

interface Row {
  layer: string;
  minzoom: number;
  maxzoom: number;
  bakeable: boolean;
  archive: StaticTileArchive | null;
  task: string | null;
  message: string;
}

const rows = ref<Row[]>([]);
const canBuild = ref(false);
const loading = ref(false);
const errorMessage = ref('');
const changed = ref(false);
const anyRunning = computed(() => rows.value.some((r) => r.task !== null));
let pollTimer: ReturnType<typeof setTimeout> | null = null;

const archiveText = (a: StaticTileArchive) => {
  const date = a.built_at ? new Date(a.built_at).toLocaleString('ru-RU') : '';
  return `зумы ${a.minzoom}–${a.maxzoom} · ${a.tiles} тайлов · ${formatSize(a.size)}${date ? ` · ${date}` : ''}`;
};

const load = async () => {
  loading.value = true;
  errorMessage.value = '';
  try {
    const res = await fastApiService.getStaticTiles();
    canBuild.value = res.can_build;
    const previous = new Map(rows.value.map((r) => [r.layer, r]));
    const byLayer = new Map<string, Row>();
    for (const l of res.layers) {
      byLayer.set(l.layer, {
        layer: l.layer, minzoom: l.minzoom, maxzoom: Math.max(l.minzoom, DEFAULT_MAXZOOM), bakeable: true,
        archive: null, task: null, message: '',
      });
    }
    for (const a of res.archives) {
      const row = byLayer.get(a.layer) ?? {
        layer: a.layer, minzoom: a.minzoom, maxzoom: a.maxzoom, bakeable: false, archive: null, task: null, message: '',
      };
      row.archive = a;
      row.maxzoom = a.maxzoom;
      byLayer.set(a.layer, row);
    }
    // идущие задачи и итог последней — переживают перечитывание списка
    for (const [layer, prev] of previous) {
      const row = byLayer.get(layer);
      if (!row) continue;
      row.message = prev.message;
      if (prev.task) Object.assign(row, { task: prev.task, maxzoom: prev.maxzoom });
    }
    rows.value = [...byLayer.values()].sort((a, b) => a.layer.localeCompare(b.layer));
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Список статичных слоёв не получен');
  } finally {
    loading.value = false;
  }
};

const stopPolling = () => {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = null;
};

const poll = async () => {
  pollTimer = null;
  let finished = false;
  for (const row of rows.value.filter((r) => r.task)) {
    try {
      const st = await fastApiService.getTaskStatus(row.task!);
      if (st.status === 'PROGRESS' || st.status === 'PENDING' || st.status === 'STARTED') {
        row.message = st.meta?.message ?? 'В очереди воркера';
        continue;
      }
      const result = st.result ?? {};
      row.message = st.status === 'SUCCESS' && result.status === 'success'
        ? `Готово: ${result.message} за ${result.elapsed_s} с`
        : `Не запечено: ${result.message ?? st.error ?? st.status}`;
      row.task = null;
      finished = true;
    } catch (err: unknown) {
      row.message = formatApiError(err, 'Состояние задачи не получено');
      row.task = null;
    }
  }
  if (finished) {
    changed.value = true;
    await load();
  }
  if (anyRunning.value && visible.value) pollTimer = setTimeout(poll, POLL_MS);
};

const build = async (row: Row) => {
  errorMessage.value = '';
  const maxzoom = Math.min(MAX_ZOOM, Math.max(row.minzoom, Math.round(Number(row.maxzoom) || DEFAULT_MAXZOOM)));
  try {
    const res = await fastApiService.buildStaticTiles(row.layer, { maxzoom });
    row.task = res.task_id;
    row.message = 'В очереди воркера';
    stopPolling();
    pollTimer = setTimeout(poll, POLL_MS);
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Запекание не запущено');
  }
};

const remove = async (row: Row) => {
  const ok = await confirmAction({
    title: 'Удалить архив слоя?',
    text: `Слой ${row.layer} снова будет строиться из GeoServer или martin.`,
    action: 'Удалить',
  });
  if (!ok) return;
  try {
    await fastApiService.deleteStaticTiles(row.layer);
    changed.value = true;
    await load();
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Архив не удалён');
  }
};

watch(visible, (open) => {
  if (open) {
    load().then(() => {
      if (anyRunning.value && !pollTimer) pollTimer = setTimeout(poll, POLL_MS);
    });
  } else {
    stopPolling();
  }
}, { immediate: true });

onBeforeUnmount(stopPolling);

const openDialog = () => {
  visible.value = true;
};

defineExpose({ openDialog });
</script>

<style scoped>
.static-zoom { flex: 0 1 140px; min-width: 120px; }
</style>
