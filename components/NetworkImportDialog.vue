<template>
  <v-dialog
    v-model="visible"
    :fullscreen="mobile"
    :max-width="mobile ? undefined : 1050"
    scrollable
  >
    <v-card :rounded="mobile ? '0' : 'lg'">
      <v-card-title class="d-flex align-center ga-2 py-2">
        <v-icon>mdi-database-import</v-icon>
        Импорт сети: SHP, Excel, координаты
        <v-spacer />
        <v-btn
          icon="mdi-close"
          variant="text"
          density="compact"
          aria-label="Закрыть"
          @click="visible = false"
        />
      </v-card-title>

      <v-card-text class="pt-0">
        <v-alert
          v-if="!canApply"
          type="info"
          variant="tonal"
          density="compact"
          class="mb-3"
        >
          Разбор и превью — редактору при включённых правках топологии на сервере;
          применение — только администратору (создание и перенос узлов и участков).
        </v-alert>
        <v-alert
          v-if="error"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-3"
          closable
          @click:close="error = ''"
        >
          {{ error }}
        </v-alert>

        <!-- 1. Файл -->
        <div class="text-subtitle-2 mb-1">1. Что и откуда импортировать</div>
        <v-btn-toggle
          v-model="mode"
          mandatory
          density="compact"
          color="primary"
          class="mb-2"
          @update:model-value="resetInspect"
        >
          <v-btn
            v-for="m in IMPORT_MODES"
            :key="m.value"
            :value="m.value"
            size="small"
          >{{ m.title }}</v-btn>
        </v-btn-toggle>
        <div class="text-caption text-medium-emphasis mb-2">{{ currentMode.hint }}</div>
        <div class="d-flex flex-wrap ga-2 align-center">
          <v-file-input
            v-model="files"
            :accept="currentMode.accept"
            multiple
            label="Файл: zip с shapefile (или .shp+.shx+.dbf+.prj), .xlsx, .csv"
            density="compact"
            hide-details
            prepend-icon="mdi-file-upload-outline"
            style="min-width: 320px; flex: 1"
            @update:model-value="resetInspect"
          />
          <v-select
            v-if="inspect?.sheets?.length && inspect.sheets.length > 1"
            v-model="sheet"
            :items="inspect.sheets"
            label="Лист"
            density="compact"
            hide-details
            style="max-width: 200px"
            @update:model-value="runInspect"
          />
          <v-btn
            color="primary"
            variant="tonal"
            :loading="busy === 'inspect'"
            :disabled="!files.length"
            @click="runInspect"
          >
            Разобрать файл
          </v-btn>
        </div>

        <template v-if="inspect">
          <v-alert
            v-for="w in inspect.warnings"
            :key="w"
            type="warning"
            variant="tonal"
            density="compact"
            class="mt-2"
          >
            {{ w }}
          </v-alert>
          <div class="text-caption text-medium-emphasis mt-2">
            {{ inspect.kind === 'shp' ? `Shapefile: ${inspect.geometry_type || 'без геометрии'}` : `Таблица${inspect.sheet ? ` «${inspect.sheet}»` : ''}` }},
            строк: {{ inspect.row_count }}{{ inspect.crs ? `, система: ${inspect.crs}` : '' }}
          </div>

          <!-- 2. Параметры и сопоставление -->
          <div class="text-subtitle-2 mt-4 mb-1">2. Параметры и сопоставление полей</div>
          <v-row dense>
            <v-col
              cols="12"
              md="4"
            >
              <v-autocomplete
                v-model="fileid"
                :items="fragmentItems"
                :label="needsFragment ? 'Фрагмент (обязательно)' : 'Фрагмент (ограничить поиск узлов)'"
                density="compact"
                clearable
                hide-details
              />
            </v-col>
            <v-col
              cols="12"
              md="4"
            >
              <v-select
                v-model="sourceCrs"
                :items="crsItems"
                label="Система координат"
                density="compact"
                hide-details
              />
            </v-col>
            <v-col
              v-if="mode === 'coords'"
              cols="12"
              md="4"
            >
              <v-select
                v-model="matchBy"
                :items="matchItems"
                label="Узел в файле — это"
                density="compact"
                hide-details
              />
            </v-col>
            <v-col
              v-if="mode === 'lines'"
              cols="12"
              md="4"
            >
              <v-text-field
                v-model.number="snapTolerance"
                type="number"
                min="0"
                max="50"
                step="0.5"
                label="Допуск привязки концов, м"
                density="compact"
                hide-details
              />
            </v-col>
          </v-row>
          <div
            v-if="mode === 'coords'"
            class="d-flex flex-wrap ga-4"
          >
            <v-checkbox
              v-model="recalcLengths"
              label="Пересчитать длины участков по геометрии"
              density="compact"
              hide-details
            />
            <v-checkbox
              v-model="buildMissingLines"
              label="Построить геометрию участков без линии"
              density="compact"
              hide-details
            />
          </div>
          <v-table
            density="compact"
            class="mt-2"
          >
            <thead>
              <tr><th>Поле</th><th>Колонка файла</th><th>Пример</th></tr>
            </thead>
            <tbody>
              <tr
                v-for="t in inspect.targets"
                :key="t.key"
              >
                <td>{{ t.label }}<span
                  v-if="t.required"
                  class="text-error"
                > *</span></td>
                <td style="min-width: 220px">
                  <v-select
                    v-model="mapping[t.key]"
                    :items="inspect.columns"
                    density="compact"
                    variant="plain"
                    clearable
                    hide-details
                    placeholder="— не импортировать —"
                  />
                </td>
                <td class="text-caption text-medium-emphasis">{{ sampleValue(t.key) }}</td>
              </tr>
            </tbody>
          </v-table>

          <!-- 3. Превью -->
          <div class="d-flex align-center ga-2 mt-4">
            <div class="text-subtitle-2">3. Превью</div>
            <v-spacer />
            <v-checkbox
              v-model="skipErrors"
              label="Пропустить строки с ошибками"
              density="compact"
              hide-details
            />
            <v-btn
              color="primary"
              variant="tonal"
              :loading="busy === 'preview'"
              :disabled="!canPreview"
              @click="runPreview"
            >
              Проверить (dry-run)
            </v-btn>
          </div>
          <div
            v-if="missing.length"
            class="text-caption text-error"
          >Не сопоставлено: {{ missing.join(', ') }}</div>

          <template v-if="report">
            <v-alert
              :type="report.dry_run ? 'info' : 'success'"
              variant="tonal"
              density="compact"
              class="mt-2"
            >
              {{ importSummary(report) }}
              <span v-if="!report.dry_run && report.operation_id">
                — операция отмены №{{ report.operation_id }}{{ undone ? ' (импорт отменён)' : '' }}
              </span>
            </v-alert>
            <v-row
              dense
              class="mt-1"
            >
              <v-col
                v-if="report.errors.length"
                cols="12"
                md="6"
              >
                <div class="text-caption font-weight-bold mb-1">Ошибки по строкам ({{ report.errors.length }})</div>
                <div class="report-list">
                  <div
                    v-for="e in report.errors"
                    :key="`e${e.row}`"
                    class="text-caption"
                  >
                    <b>стр. {{ e.row }}</b>: {{ e.message }}
                  </div>
                </div>
              </v-col>
              <v-col
                v-if="report.actions.length"
                cols="12"
                :md="report.errors.length ? 6 : 12"
              >
                <div class="text-caption font-weight-bold mb-1">
                  {{ report.dry_run ? 'Будет сделано' : 'Сделано' }}{{ report.actions_truncated ? ' (первые 500)' : '' }}
                  <span
                    v-if="report.dry_run"
                    class="text-medium-emphasis font-weight-regular"
                  >— id в превью условные</span>
                </div>
                <div class="report-list">
                  <div
                    v-for="a in report.actions"
                    :key="`a${a.row}-${a.id}`"
                    class="text-caption"
                  >
                    стр. {{ a.row }}: {{ describeImportAction(a) }}
                  </div>
                </div>
              </v-col>
            </v-row>
          </template>
        </template>
      </v-card-text>

      <v-card-actions>
        <v-btn
          v-if="applied?.operation_id"
          variant="text"
          color="warning"
          prepend-icon="mdi-undo"
          :loading="busy === 'undo'"
          :disabled="undone"
          @click="undo"
        >
          {{ undone ? 'Импорт отменён' : 'Отменить импорт' }}
        </v-btn>
        <v-spacer />
        <v-btn
          variant="text"
          @click="visible = false"
        >Закрыть</v-btn>
        <v-btn
          color="primary"
          prepend-icon="mdi-database-import"
          :loading="busy === 'apply'"
          :disabled="!canApply || !report || !report.dry_run || previewStale || (report.errors.length > 0 && !skipErrors) || report.ok_rows === 0"
          @click="runApply"
        >
          Применить
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useDisplay } from 'vuetify';
import { fastApiService } from '~/services/fastApiService';
import { useAuthStore } from '~/stores/authStore';
import { useFragmentStore } from '~/stores/fragmentStore';
import { useLayerStore } from '~/stores/layerStore';
import { useNotificationStore } from '~/stores/notificationStore';
import {
  IMPORT_MODES,
  cleanMapping,
  crsOptionsFor,
  defaultCrsFor,
  describeImportAction,
  importApiError,
  importSummary,
  missingRequired,
  type NetworkImportCrs,
  type NetworkImportInspect,
  type NetworkImportMode,
  type NetworkImportParams,
  type NetworkImportReport,
} from '~/utils/networkImport';

const { mobile } = useDisplay();
const authStore = useAuthStore();
const fragmentStore = useFragmentStore();
const layerStore = useLayerStore();
const notify = useNotificationStore();

const visible = ref(false);
const mode = ref<NetworkImportMode>('nodes');
const files = ref<File[]>([]);
const sheet = ref<string | undefined>(undefined);
const inspect = ref<NetworkImportInspect | null>(null);
const mapping = reactive<Record<string, string | null | undefined>>({});
const fileid = ref<number | null>(null);
const sourceCrs = ref<NetworkImportCrs>('local');
const matchBy = ref<'id' | 'code'>('code');
const snapTolerance = ref(1);
const recalcLengths = ref(true);
const buildMissingLines = ref(false);
const skipErrors = ref(false);
const report = ref<NetworkImportReport | null>(null);
const applied = ref<NetworkImportReport | null>(null);
const undone = ref(false);
const previewStale = ref(false);
const busy = ref<'' | 'inspect' | 'preview' | 'apply' | 'undo'>('');
const error = ref('');

const currentMode = computed(() => IMPORT_MODES.find((m) => m.value === mode.value)!);
const canApply = computed(() => authStore.isAdmin && authStore.canEditTopology);
const needsFragment = computed(() => mode.value !== 'coords' || matchBy.value === 'code');
const crsItems = computed(() => crsOptionsFor(inspect.value));
const matchItems = [
  { title: 'Код узла (externalnodename, в пределах фрагмента)', value: 'code' },
  { title: 'Номер узла (id)', value: 'id' },
];
const fragmentItems = computed(() =>
  (fragmentStore.fragments || []).map((f: any) => ({ title: `${f.id} — ${f.name ?? ''}`, value: Number(f.id) })),
);
const missing = computed(() => (inspect.value ? missingRequired(inspect.value.targets, mapping) : []));
const canPreview = computed(
  () =>
    !!inspect.value &&
    !missing.value.length &&
    (!needsFragment.value || fileid.value != null) &&
    authStore.canEdit,
);

const params = (): NetworkImportParams => ({
  mode: mode.value,
  fileid: fileid.value,
  source_crs: sourceCrs.value,
  mapping: cleanMapping(mapping),
  match_by: matchBy.value,
  snap_tolerance_m: Number(snapTolerance.value) || 0,
  recalc_lengths: recalcLengths.value,
  build_missing_lines: buildMissingLines.value,
  skip_errors: skipErrors.value,
  sheet: sheet.value,
});

watch(
  [fileid, sourceCrs, matchBy, snapTolerance, recalcLengths, buildMissingLines, skipErrors, () => ({ ...mapping })],
  () => {
    if (report.value?.dry_run) previewStale.value = true;
  },
);

const sampleValue = (key: string) => {
  const col = mapping[key];
  if (!col || !inspect.value) return '';
  return inspect.value.sample
    .slice(0, 3)
    .map((r) => r[col])
    .filter((v) => v !== null && v !== undefined && v !== '')
    .join('; ');
};

function resetInspect() {
  inspect.value = null;
  report.value = null;
  applied.value = null;
  undone.value = false;
  error.value = '';
  sheet.value = undefined;
  Object.keys(mapping).forEach((k) => delete mapping[k]);
}

const runInspect = async () => {
  if (!files.value.length) return;
  busy.value = 'inspect';
  error.value = '';
  report.value = null;
  try {
    const res = await fastApiService.inspectNetworkImport(files.value, mode.value, { sheet: sheet.value });
    inspect.value = res;
    if (res.sheet) sheet.value = res.sheet;
    Object.keys(mapping).forEach((k) => delete mapping[k]);
    Object.assign(mapping, res.suggested_mapping);
    sourceCrs.value = defaultCrsFor(res);
    if (fileid.value == null && fragmentStore.selectedFragmentId != null) fileid.value = Number(fragmentStore.selectedFragmentId);
  } catch (e: any) {
    inspect.value = null;
    error.value = importApiError(e).message;
  } finally {
    busy.value = '';
  }
};

const runPreview = async () => {
  busy.value = 'preview';
  error.value = '';
  try {
    report.value = await fastApiService.runNetworkImport(files.value, params(), true);
    previewStale.value = false;
  } catch (e: any) {
    error.value = importApiError(e).message;
  } finally {
    busy.value = '';
  }
};

const runApply = async () => {
  busy.value = 'apply';
  error.value = '';
  try {
    const res = await fastApiService.runNetworkImport(files.value, params(), false);
    report.value = res;
    applied.value = res;
    undone.value = false;
    notify.showSuccess(importSummary(res));
    layerStore.refreshVisibleDataLayers();
  } catch (e: any) {
    const { message, report: rep } = importApiError(e);
    error.value = message;
    if (rep) report.value = rep;
  } finally {
    busy.value = '';
  }
};

const undo = async () => {
  if (!applied.value?.operation_id) return;
  busy.value = 'undo';
  error.value = '';
  try {
    await fastApiService.undoTopologyOperation(applied.value.operation_id);
    undone.value = true;
    notify.showSuccess('Импорт отменён');
    layerStore.refreshVisibleDataLayers();
  } catch (e: any) {
    error.value = `Отмена не выполнена: ${importApiError(e).message}`;
  } finally {
    busy.value = '';
  }
};

const openDialog = () => {
  visible.value = true;
};

defineExpose({ openDialog });
</script>

<style scoped>
.report-list {
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 6px;
  padding: 4px 8px;
}
</style>
