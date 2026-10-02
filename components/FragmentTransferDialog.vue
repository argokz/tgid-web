<template>
  <v-dialog
    :model-value="modelValue"
    max-width="720"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card>
      <v-toolbar
        color="primary"
        density="compact"
      >
        <v-toolbar-title>Фрагменты: экспорт, импорт, слияние</v-toolbar-title>
        <v-spacer />
        <v-btn
          icon
          size="small"
          aria-label="Закрыть"
          @click="$emit('update:modelValue', false)"
        >
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-toolbar>
      <v-tabs
        v-model="tab"
        density="compact"
        color="primary"
      >
        <v-tab
          value="export"
          prepend-icon="mdi-file-export"
        >Экспорт</v-tab>
        <v-tab
          value="import"
          prepend-icon="mdi-file-import"
        >Импорт</v-tab>
        <v-tab
          value="merge"
          prepend-icon="mdi-source-merge"
        >Слияние</v-tab>
      </v-tabs>
      <v-divider />
      <v-card-text>
        <p class="text-caption text-medium-emphasis mb-3">
          Формат .tgid десктопа (zip с tgid.txt): узлы, участки, паспорта труб, оборудование, потребители,
          источники, коды, направления. Импорт создаёт новый фрагмент с новыми id; слияние, как в десктопе,
          сводит копии выбранных фрагментов в новый, исходные не меняются. Отмена — «Отменить» редактора топологии.
        </p>

        <v-window v-model="tab">
          <v-window-item value="export">
            <v-autocomplete
              v-model="exportId"
              :items="fragmentItems"
              label="Фрагмент"
              density="compact"
              :loading="fragmentsLoading"
            />
            <v-btn
              color="primary"
              :disabled="!exportId"
              :loading="busy"
              prepend-icon="mdi-download"
              @click="doExport"
            >
              Скачать .tgid
            </v-btn>
          </v-window-item>

          <v-window-item value="import">
            <v-alert
              v-if="!canWrite"
              type="info"
              variant="tonal"
              density="compact"
              class="mb-2"
            >
              Импорт — редактор топологии (admin и включённая запись топологии на сервере).
            </v-alert>
            <v-file-input
              v-model="importFile"
              label="Файл .tgid"
              accept=".tgid,.zip,.txt"
              density="compact"
              prepend-icon="mdi-file-import"
              :disabled="!canWrite"
              @update:model-value="report = null"
            />
            <v-text-field
              v-model="importName"
              label="Название нового фрагмента (необязательно)"
              density="compact"
              :disabled="!canWrite"
            />
            <div class="d-flex ga-2">
              <v-btn
                variant="tonal"
                :disabled="!canWrite || !selectedFile"
                :loading="busy"
                @click="doImport(true)"
              >Проверить</v-btn>
              <v-btn
                color="primary"
                :disabled="!canWrite || !report?.dry_run || reportKind !== 'import'"
                :loading="busy"
                @click="doImport(false)"
              >
                Импортировать
              </v-btn>
            </div>
          </v-window-item>

          <v-window-item value="merge">
            <v-alert
              v-if="!canWrite"
              type="info"
              variant="tonal"
              density="compact"
              class="mb-2"
            >
              Слияние — редактор топологии (admin и включённая запись топологии на сервере).
            </v-alert>
            <v-autocomplete
              v-model="mergeIds"
              :items="fragmentItems"
              label="Фрагменты (два и более, первый — основной)"
              multiple
              chips
              closable-chips
              density="compact"
              :disabled="!canWrite"
              @update:model-value="report = null"
            />
            <v-text-field
              v-model="mergeName"
              label="Название объединённого фрагмента"
              density="compact"
              :disabled="!canWrite"
            />
            <v-checkbox
              v-model="unifyCodes"
              label="Свести коды с одинаковым названием в один (в десктопе не делается)"
              density="compact"
              hide-details
              :disabled="!canWrite"
            />
            <div class="d-flex ga-2 mt-2">
              <v-btn
                variant="tonal"
                :disabled="!canWrite || mergeIds.length < 2"
                :loading="busy"
                @click="doMerge(true)"
              >Проверить</v-btn>
              <v-btn
                color="primary"
                :disabled="!canWrite || !report?.dry_run || reportKind !== 'merge'"
                :loading="busy"
                @click="doMerge(false)"
              >
                Объединить
              </v-btn>
            </div>
          </v-window-item>
        </v-window>

        <v-alert
          v-if="error"
          type="error"
          variant="tonal"
          density="compact"
          class="mt-3"
        >{{ error }}</v-alert>

        <div
          v-if="report"
          class="mt-3"
        >
          <v-alert
            :type="report.dry_run ? 'info' : 'success'"
            variant="tonal"
            density="compact"
            class="mb-2"
          >
            <template v-if="report.dry_run">Проверка (ничего не записано):</template>
            <template v-else>Готово: фрагмент {{ report.fileid }}<template v-if="report.name"> «{{ report.name }}»</template>.</template>
            узлов {{ report.created_nodes }}, участков {{ report.created_lines }}.
            <template v-if="report.geometry">
              Геометрия: узлов {{ report.geometry.nodes_with_shape }}, участков {{ report.geometry.lines_with_shape }}.
            </template>
          </v-alert>
          <div
            v-if="!report.dry_run && report.operation_id"
            class="mb-2"
          >
            <v-btn
              size="small"
              variant="tonal"
              color="warning"
              prepend-icon="mdi-undo"
              :loading="busy"
              @click="doUndo"
            >
              Отменить операцию
            </v-btn>
          </div>
          <v-alert
            v-if="unresolvedText"
            type="warning"
            variant="tonal"
            density="compact"
            class="mb-2"
          >
            Ссылки на объекты вне файла обнулены: {{ unresolvedText }}
          </v-alert>
          <v-alert
            v-if="report.duplicate_external_codes?.length"
            type="warning"
            variant="tonal"
            density="compact"
            class="mb-2"
          >
            Совпадающие коды: {{ report.duplicate_external_codes.map((d) => d.name).join(', ') }}
            <template v-if="report.unified_external_codes"> — сведено {{ report.unified_external_codes }}</template>
          </v-alert>
          <v-alert
            v-if="report.coincident_node_positions"
            type="info"
            variant="tonal"
            density="compact"
            class="mb-2"
          >
            Узлов в одинаковых координатах: {{ report.coincident_node_positions }} (стыки фрагментов не сливаются, как в десктопе).
          </v-alert>
          <v-table density="compact">
            <thead><tr><th>Таблица</th><th class="text-right">Строк</th></tr></thead>
            <tbody>
              <tr
                v-for="(n, t) in report.tables"
                :key="t"
              ><td>{{ t }}</td><td class="text-right">{{ n }}</td></tr>
            </tbody>
          </v-table>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { formatApiError, formatApiErrorWith } from '~/utils/apiError';
import { computed, ref, watch } from 'vue';
import { fastApiService, type FragmentTransferReport } from '~/services/fastApiService';
import { useAuthStore } from '~/stores/authStore';
import { useNotificationStore } from '~/stores/notificationStore';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [boolean]; changed: [] }>();

const authStore = useAuthStore();
const notify = useNotificationStore();
const canWrite = computed(() => authStore.canEditTopology);

const tab = ref<'export' | 'import' | 'merge'>('export');
const fragments = ref<{ id: number; name: string }[]>([]);
const fragmentsLoading = ref(false);
const fragmentItems = computed(() => fragments.value.map((f) => ({ title: `${f.name} (${f.id})`, value: f.id })));

const exportId = ref<number | null>(null);
const importFile = ref<File | File[] | null>(null);
const importName = ref('');
const mergeIds = ref<number[]>([]);
const mergeName = ref('');
const unifyCodes = ref(false);
const busy = ref(false);
const error = ref<string | null>(null);
const report = ref<FragmentTransferReport | null>(null);
const reportKind = ref<'import' | 'merge' | null>(null);

const selectedFile = computed<File | null>(() =>
  Array.isArray(importFile.value) ? importFile.value[0] ?? null : importFile.value
);

const unresolvedText = computed(() =>
  Object.entries(report.value?.unresolved_refs || {}).map(([k, n]) => `${k}: ${n}`).join(', ')
);

const loadFragments = async () => {
  fragmentsLoading.value = true;
  try {
    const res = await fastApiService.getFragments();
    fragments.value = (res.data || []).map((f: any) => ({ id: Number(f.id), name: String(f.name ?? f.id) }));
  } catch (err: any) {
    error.value = formatApiErrorWith('Список фрагментов', err, 'ошибка сервера');
  } finally {
    fragmentsLoading.value = false;
  }
};

watch(() => props.modelValue, (open) => { if (open) loadFragments(); }, { immediate: true });
watch(tab, () => { report.value = null; error.value = null; });

const run = async (fn: () => Promise<void>) => {
  busy.value = true;
  error.value = null;
  try {
    await fn();
  } catch (err: any) {
    const detail = err?.data?.detail;
    error.value = typeof detail === 'string' ? detail : formatApiError(err, 'Ошибка сервера');
  } finally {
    busy.value = false;
  }
};

const doExport = () => run(async () => {
  const id = exportId.value;
  if (!id) return;
  const blob = await fastApiService.exportFragmentTgid(id);
  const name = fragments.value.find((f) => f.id === id)?.name || `fragment_${id}`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name.replace(/[\\/:*?"<>|]+/g, '_')}.tgid`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});

const doImport = (dryRun: boolean) => run(async () => {
  const file = selectedFile.value;
  if (!file) return;
  report.value = await fastApiService.importFragmentTgid(file, { name: importName.value.trim() || undefined, dryRun });
  reportKind.value = 'import';
  if (!dryRun) {
    notify.showSuccess(`Фрагмент импортирован (id ${report.value.fileid})`);
    emit('changed');
    loadFragments();
  }
});

const doMerge = (dryRun: boolean) => run(async () => {
  report.value = await fastApiService.mergeFragments({
    fragment_ids: mergeIds.value,
    name: mergeName.value.trim() || undefined,
    unify_external_codes: unifyCodes.value,
    dry_run: dryRun,
  });
  reportKind.value = 'merge';
  if (!dryRun) {
    notify.showSuccess(`Фрагменты объединены (id ${report.value.fileid})`);
    emit('changed');
    loadFragments();
  }
});

const doUndo = () => run(async () => {
  const opId = report.value?.operation_id;
  if (!opId) return;
  await fastApiService.undoTopologyOperation(opId);
  notify.showSuccess('Операция отменена');
  report.value = null;
  emit('changed');
  loadFragments();
});
</script>
