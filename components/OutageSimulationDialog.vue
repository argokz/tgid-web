<template>
  <v-dialog v-model="visible" :fullscreen="isMobile" max-width="1100" scrollable>
    <v-card rounded="lg" class="outage-dialog">
      <v-card-title class="d-flex align-center ga-2 bg-surface-variant py-3 px-4">
        <v-icon color="error" size="24">mdi-valve-closed</v-icon>
        <span class="text-h6 font-weight-bold">Анализ аварийного отключения (Локализация задвижек)</span>
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" size="small" @click="visible = false" />
      </v-card-title>

      <v-card-text class="pa-4">
        <!-- Форма параметров аварийного участка -->
        <v-card variant="outlined" class="mb-4 pa-3 rounded-lg bg-surface">
          <div class="d-flex flex-wrap align-center ga-3">
            <v-btn-toggle
              v-model="targetType"
              mandatory
              density="compact"
              color="primary"
              variant="outlined"
            >
              <v-btn value="line">
                <v-icon start size="18">mdi-pipe</v-icon>
                Трубопровод (Line ID)
              </v-btn>
              <v-btn value="node">
                <v-icon start size="18">mdi-map-marker-radius</v-icon>
                Узел сети (Node ID)
              </v-btn>
            </v-btn-toggle>

            <v-text-field
              v-model.number="targetId"
              type="number"
              density="compact"
              variant="outlined"
              hide-details
              :placeholder="targetType === 'line' ? 'Введите ID трубы (напр. 371424)' : 'Введите ID узла'"
              style="max-width: 280px"
              clearable
            />

            <v-btn
              color="error"
              variant="flat"
              prepend-icon="mdi-magnify-scan"
              :loading="loading"
              :disabled="!targetId || loading"
              @click="runSimulation"
            >
              Локализовать аварию
            </v-btn>

            <v-spacer />

            <v-btn
              v-if="result"
              color="primary"
              variant="tonal"
              prepend-icon="mdi-map-marker-path"
              @click="emitShowOnMap"
            >
              Показать на карте
            </v-btn>

            <v-btn
              v-if="result"
              variant="outlined"
              prepend-icon="mdi-download"
              @click="exportCsv"
            >
              Экспорт CSV
            </v-btn>
          </div>

          <v-alert
            v-if="errorMessage"
            type="error"
            density="compact"
            variant="tonal"
            class="mt-3 mb-0"
            closable
            @click:close="errorMessage = ''"
          >
            {{ errorMessage }}
          </v-alert>
        </v-card>

        <v-alert
          v-if="result?.summary"
          type="info"
          variant="tonal"
          density="compact"
          class="mb-3"
        >
          Оценка по модели сети: зона ограничена задвижками на участках и задвижками во внутренних
          схемах камер/ТРП ({{ result.summary.boundary_nodes_count ?? 0 }} узлов на границе).
          Потребители ниже по течению за закрытыми задвижками не учитываются.
          <template v-if="result.valves_already_closed?.length">
            Уже закрыты и не требуют действий: {{ result.valves_already_closed.length }} задв.
          </template>
        </v-alert>

        <!-- KPI Сводка результатов -->
        <div v-if="result?.summary" class="mb-4">
          <v-row dense>
            <v-col cols="12" sm="6" md="3">
              <v-card variant="tonal" color="error" class="pa-3 rounded-lg text-center">
                <div class="text-caption text-medium-emphasis">Отсекающие задвижки</div>
                <div class="text-h4 font-weight-bold d-flex align-center justify-center ga-2 mt-1">
                  <v-icon size="28">mdi-valve</v-icon>
                  {{ result.summary.valves_count }}
                </div>
                <div class="text-caption mt-1">к закрытию бригадой</div>
              </v-card>
            </v-col>

            <v-col cols="12" sm="6" md="3">
              <v-card variant="tonal" color="amber-darken-4" class="pa-3 rounded-lg text-center">
                <div class="text-caption text-medium-emphasis">Отключено зданий</div>
                <div class="text-h4 font-weight-bold d-flex align-center justify-center ga-2 mt-1">
                  <v-icon size="28">mdi-home-alert-outline</v-icon>
                  {{ result.summary.consumers_count }}
                </div>
                <div class="text-caption mt-1">потребителей без тепла</div>
              </v-card>
            </v-col>

            <v-col cols="12" sm="6" md="3">
              <v-card variant="tonal" color="deep-orange-darken-2" class="pa-3 rounded-lg text-center">
                <div class="text-caption text-medium-emphasis">Недоотпуск тепла</div>
                <div class="text-h4 font-weight-bold d-flex align-center justify-center ga-2 mt-1">
                  <v-icon size="28">mdi-fire-alert</v-icon>
                  {{ result.summary.total_load_gcal_h }}
                </div>
                <div class="text-caption mt-1">Гкал/ч (Qот + Qгвс + Qвент)</div>
              </v-card>
            </v-col>

            <v-col cols="12" sm="6" md="3">
              <v-card variant="tonal" color="blue-grey-darken-3" class="pa-3 rounded-lg text-center">
                <div class="text-caption text-medium-emphasis">Сеть в зоне аварии</div>
                <div class="text-h5 font-weight-bold d-flex align-center justify-center ga-2 mt-1">
                  {{ result.summary.total_pipe_length_m }} м / {{ result.summary.total_pipe_volume_m3 }} м³
                </div>
                <div class="text-caption mt-1">{{ result.summary.isolated_lines_count }} участков труб</div>
              </v-card>
            </v-col>
          </v-row>
        </div>

        <!-- Детальные таблицы -->
        <v-card v-if="result" variant="outlined" class="rounded-lg">
          <v-tabs v-model="activeTab" density="compact" color="primary">
            <v-tab value="valves">
              <v-badge
                :content="result.valves_to_close.length"
                color="error"
                inline
                class="me-1"
              />
              Отсекающие задвижки
            </v-tab>
            <v-tab value="consumers">
              <v-badge
                :content="result.affected_consumers.length"
                color="warning"
                inline
                class="me-1"
              />
              Отключенные потребители
            </v-tab>
            <v-tab value="pipes">
              <v-badge
                :content="result.summary.isolated_lines_count"
                color="primary"
                inline
                class="me-1"
              />
              Изолированные трубы
            </v-tab>
          </v-tabs>

          <v-divider />

          <v-window v-model="activeTab">
            <!-- Таблица задвижек -->
            <v-window-item value="valves">
              <v-table density="compact" hover>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Участок (Line ID)</th>
                    <th>Наименование</th>
                    <th>Диаметр (мм)</th>
                    <th>Текущее состояние</th>
                    <th>Действие</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="v in result.valves_to_close" :key="v.id">
                    <td class="font-weight-bold">#{{ v.id }}</td>
                    <td>{{ v.lineid }}</td>
                    <td>{{ v.display_name }}</td>
                    <td>{{ v.nominal_diameter }} мм</td>
                    <td>
                      <v-chip
                        size="x-small"
                        :color="v.state_id === 2 ? 'error' : 'success'"
                        variant="flat"
                      >
                        {{ v.state_name }}
                      </v-chip>
                    </td>
                    <td>
                      <v-btn
                        v-if="v.lng && v.lat"
                        size="x-small"
                        variant="text"
                        color="primary"
                        prepend-icon="mdi-crosshairs-gps"
                        @click="focusCoords(v.lng, v.lat)"
                      >
                        К задвижке
                      </v-btn>
                    </td>
                  </tr>
                  <tr v-if="!result.valves_to_close.length">
                    <td colspan="6" class="text-center text-medium-emphasis py-4">
                      Задвижки не найдены на границах изолированного сегмента
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </v-window-item>

            <!-- Таблица потребителей -->
            <v-window-item value="consumers">
              <v-table density="compact" hover>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Тип</th>
                    <th>Адрес / Наименование</th>
                    <th>Узел</th>
                    <th>Q от (Гкал/ч)</th>
                    <th>Q гвс (Гкал/ч)</th>
                    <th>Q сум (Гкал/ч)</th>
                    <th>На карте</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in result.affected_consumers" :key="`${c.consumer_type}-${c.id}`">
                    <td>{{ c.id }}</td>
                    <td>
                      <v-chip size="x-small" variant="tonal" color="info">
                        {{ c.consumer_type === 'real' ? 'Реальный' : 'Обобщенный' }}
                      </v-chip>
                    </td>
                    <td class="font-weight-medium">{{ c.name }}</td>
                    <td>Узел {{ c.node_id }}</td>
                    <td>{{ c.heating_load }}</td>
                    <td>{{ c.hot_water_load }}</td>
                    <td class="font-weight-bold text-error">{{ c.total_load }}</td>
                    <td>
                      <v-btn
                        v-if="c.longitude && c.latitude"
                        size="x-small"
                        variant="text"
                        color="primary"
                        icon="mdi-crosshairs-gps"
                        @click="focusCoords(c.longitude, c.latitude)"
                      />
                    </td>
                  </tr>
                  <tr v-if="!result.affected_consumers.length">
                    <td colspan="8" class="text-center text-medium-emphasis py-4">
                      В изолированной зоне нет подключенных потребителей
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </v-window-item>

            <!-- Таблица труб -->
            <v-window-item value="pipes">
              <v-table density="compact" hover>
                <thead>
                  <tr>
                    <th>ID участка</th>
                    <th>Длина (м)</th>
                    <th>Диаметр (мм)</th>
                    <th>Узлы</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="feat in result.geojson.isolated_pipes.features"
                    :key="feat.properties.id"
                  >
                    <td class="font-weight-bold">#{{ feat.properties.id }}</td>
                    <td>{{ feat.properties.length }} м</td>
                    <td>{{ feat.properties.diameter }} мм</td>
                    <td>{{ feat.properties.nodeid1 }} → {{ feat.properties.nodeid2 }}</td>
                  </tr>
                </tbody>
              </v-table>
            </v-window-item>
          </v-window>
        </v-card>

        <div v-else-if="!loading" class="text-center py-8 text-medium-emphasis">
          <v-icon size="48" color="medium-emphasis" class="mb-2">mdi-pipe-valve</v-icon>
          <div class="text-body-1">
            Выберите трубопровод или узел для расчета аварийной зоны и поиска отсекающих задвижек
          </div>
        </div>
      </v-card-text>

      <v-divider />

      <v-card-actions class="px-4 py-2">
        <v-btn
          v-if="result"
          color="error"
          variant="text"
          prepend-icon="mdi-layers-remove"
          @click="emitClearHighlight"
        >
          Снять подсветку с карты
        </v-btn>
        <v-spacer />
        <v-btn variant="text" @click="visible = false">Закрыть</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useMobile } from '~/composables/useMobile';
import {
  fastApiService,
  type OutageSimulationResponse,
} from '~/services/fastApiService';

const props = defineProps<{
  initialLineId?: number | null;
  initialNodeId?: number | null;
}>();

const emit = defineEmits<{
  'show-on-map': [data: OutageSimulationResponse];
  'clear-highlight': [];
  'focus-coords': [lng: number, lat: number];
}>();

const visible = defineModel<boolean>({ default: false });
const { isMobile } = useMobile();

const targetType = ref<'line' | 'node'>('line');
const targetId = ref<number | null>(null);
const loading = ref(false);
const errorMessage = ref('');
const result = ref<OutageSimulationResponse | null>(null);
const activeTab = ref('valves');

watch(
  () => props.initialLineId,
  (val) => {
    if (val) {
      targetType.value = 'line';
      targetId.value = val;
    }
  },
  { immediate: true }
);

watch(
  () => props.initialNodeId,
  (val) => {
    if (val && !props.initialLineId) {
      targetType.value = 'node';
      targetId.value = val;
    }
  },
  { immediate: true }
);

const runSimulation = async () => {
  if (!targetId.value) return;
  loading.value = true;
  errorMessage.value = '';
  try {
    const payload =
      targetType.value === 'line'
        ? { line_id: targetId.value }
        : { node_id: targetId.value };
    const res = await fastApiService.simulateValveIsolation(payload);
    result.value = res;
    emit('show-on-map', res);
  } catch (err: any) {
    errorMessage.value = err?.detail || err?.message || 'Ошибка моделирования отключения';
    result.value = null;
  } finally {
    loading.value = false;
  }
};

const emitShowOnMap = () => {
  if (result.value) {
    emit('show-on-map', result.value);
  }
};

const emitClearHighlight = () => {
  emit('clear-highlight');
};

const focusCoords = (lng: number, lat: number) => {
  emit('focus-coords', lng, lat);
};

const exportCsv = () => {
  if (!result.value) return;
  const rows = [
    ['Тип объекта', 'ID', 'Наименование', 'Параметр 1', 'Параметр 2', 'Координаты'],
  ];

  for (const v of result.value.valves_to_close) {
    rows.push([
      'Задвижка',
      String(v.id),
      v.display_name,
      `Ду=${v.nominal_diameter}мм`,
      v.state_name,
      v.lng && v.lat ? `${v.lng}, ${v.lat}` : '',
    ]);
  }

  for (const c of result.value.affected_consumers) {
    rows.push([
      `Потребитель (${c.consumer_type})`,
      String(c.id),
      `"${c.name.replace(/"/g, '""')}"`,
      `Qсум=${c.total_load} Гкал/ч`,
      `Узел ${c.node_id}`,
      c.longitude && c.latitude ? `${c.longitude}, ${c.latitude}` : '',
    ]);
  }

  const csvContent =
    '\uFEFF' + rows.map((r) => r.join(';')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute(
    'download',
    `Аварийное_отключение_${targetType.value}_${targetId.value}_${Date.now()}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const openDialog = (scope?: { lineId?: number; nodeId?: number }) => {
  if (scope?.lineId) {
    targetType.value = 'line';
    targetId.value = scope.lineId;
  } else if (scope?.nodeId) {
    targetType.value = 'node';
    targetId.value = scope.nodeId;
  }
  visible.value = true;
  if (targetId.value) {
    runSimulation();
  }
};

defineExpose({ openDialog });
</script>

<style scoped>
.outage-dialog {
  max-height: 90vh;
}
</style>
