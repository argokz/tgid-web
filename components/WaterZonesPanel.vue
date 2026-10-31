<template>
  <div class="wz">
    <div class="d-flex align-center flex-wrap ga-2 mb-1">
      <div class="text-subtitle-2">
        Зоны водоучёта (DMA)
      </div>
      <v-spacer />
      <v-switch
        v-model="onMap"
        label="Зоны на карте"
        density="compact"
        hide-details
        color="primary"
        class="flex-grow-0"
      />
    </div>
    <p class="text-caption text-medium-emphasis mb-2">
      Зона — часть сети между насосами, арматурой, закрытыми трубами и трубами с расходомерами. Минимальный ночной
      расход (МНР) — признак утечек: расчёт с утечкой сравнивается с базовым, видно, в какой зоне её заметят расходомеры.
    </p>

    <div class="d-flex align-start flex-wrap ga-2 mb-2">
      <v-autocomplete
        v-model="meters"
        :items="pipeIds"
        :readonly="!canEdit"
        label="Трубы с расходомерами"
        multiple
        chips
        :closable-chips="canEdit"
        density="compact"
        hide-details
        variant="outlined"
        class="wz-meters"
      />
      <v-btn
        v-if="canEdit"
        size="small"
        variant="tonal"
        class="mt-1"
        :loading="busy === 'meters'"
        :disabled="!metersDirty || !!busy"
        @click="saveMeters"
      >
        Сохранить
      </v-btn>
    </div>

    <v-alert
      v-if="errorMessage"
      type="error"
      density="compact"
      variant="tonal"
      closable
      class="mb-2"
      @click:close="errorMessage = ''"
    >
      {{ errorMessage }}
    </v-alert>

    <v-progress-linear
      v-if="loading"
      indeterminate
      class="mb-2"
    />
    <v-table
      v-if="rows.length"
      density="compact"
      class="wz-table mb-2"
    >
      <thead>
        <tr>
          <th>Зона</th>
          <th class="text-right">
            Узлы
          </th>
          <th class="text-right">
            Подача, л/с
          </th>
          <th class="text-right">
            МНР, л/с
          </th>
          <th class="text-right">
            МНР / средн.
          </th>
          <template v-if="hasLeaks">
            <th class="text-right">
              Утечка, л/с
            </th>
            <th class="text-right">
              Рост МНР
            </th>
            <th>По расходомерам</th>
          </template>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="r in rows"
          :key="r.index"
        >
          <td>
            <span
              class="wz-dot"
              :style="{ background: colors[r.index] }"
            />{{ r.name }}
            <div class="text-caption text-medium-emphasis">
              {{ ZONE_KIND_LABEL[r.kind] }}<template v-if="r.sources.length">
                · ёмкости: {{ r.sources.join(', ') }}
              </template>
            </div>
          </td>
          <td class="text-right">
            {{ r.junctions }}
          </td>
          <td class="text-right">
            {{ num(r.supply) }}
          </td>
          <td class="text-right">
            {{ num(r.mnf) }}
            <div
              v-if="r.mnfTime != null"
              class="text-caption text-medium-emphasis"
            >
              в {{ stepTime(r.mnfTime) }}
            </div>
          </td>
          <td class="text-right">
            {{ r.mnfShare == null ? '—' : `${Math.round(r.mnfShare * 100)} %` }}
          </td>
          <template v-if="hasLeaks">
            <td class="text-right">
              {{ num(r.leak) }}
            </td>
            <td class="text-right">
              {{ r.detection ? signed(r.detection.d_mnf_ls) : '—' }}
              <div
                v-if="r.detection && r.kind === 'dma'"
                class="text-caption text-medium-emphasis"
              >
                порог {{ num(r.detection.threshold_ls) }}
              </div>
            </td>
            <td class="text-no-wrap">
              <template v-if="r.detection && r.kind === 'dma'">
                <v-icon
                  size="small"
                  :color="r.detection.detected ? 'warning' : undefined"
                  :icon="r.detection.detected ? 'mdi-alert-circle-outline' : 'mdi-minus-circle-outline'"
                />
                {{ r.detection.detected ? 'заметна' : 'не заметна' }}
              </template>
            </td>
          </template>
        </tr>
      </tbody>
    </v-table>
    <p
      v-else-if="!loading && zones"
      class="text-body-2 text-medium-emphasis"
    >
      Зон нет.
    </p>

    <div
      v-for="leak in leakNotes"
      :key="leak.node"
      class="text-body-2 mb-1"
    >
      {{ leak.text }}
    </div>
    <div
      v-if="balance?.meter_changes.length"
      class="text-caption text-medium-emphasis mb-2"
    >
      Расходомеры (средний расход, изменение против расчёта №{{ balance.baseline_id }}):
      <span
        v-for="m in balance.meter_changes"
        :key="m.link"
        class="mr-3 text-no-wrap"
      >{{ m.link }} ({{ zoneName(m.from_zone) }} → {{ zoneName(m.to_zone) }}): {{ num(m.avg_ls) }}, {{ signed(m.d_avg_ls) }}</span>
    </div>
    <p
      v-if="hasLeaks && balance && balance.baseline_id == null"
      class="text-caption text-medium-emphasis mb-2"
    >
      Нет базового расчёта без утечек с тем же периодом — сравнивать не с чем: рассчитайте сутки без утечки.
    </p>

    <div
      v-if="canCalc"
      class="d-flex align-center flex-wrap ga-2 mt-2"
    >
      <v-autocomplete
        v-model="leakNode"
        :items="junctionIds"
        label="Утечка в узле"
        density="compact"
        hide-details
        variant="outlined"
        class="wz-node"
      />
      <v-text-field
        v-model.number="leakArea"
        type="number"
        label="Отверстие, см²"
        :min="0.1"
        :max="MAX_LEAK_AREA_CM2"
        :step="0.5"
        density="compact"
        hide-details
        variant="outlined"
        class="wz-area"
      />
      <v-btn
        size="small"
        variant="tonal"
        :loading="busy === 'leak'"
        :disabled="!leakValid || !!busy || !engineAvailable"
        @click="runLeak"
      >
        Рассчитать с утечкой
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { fastApiService } from '~/services/fastApiService';
import { formatApiError } from '~/utils/apiError';
import {
  stepTime,
  ZONE_KIND_LABEL,
  zoneColors,
  type WaterBalance,
  type WaterDetection,
  type WaterRun,
  type WaterZoneKind,
  type WaterZones,
} from '~/utils/water';

/**
 * Зоны водоучёта модели водопровода (itwin-api database/water_zones.py): расходомеры — границы зон, баланс подачи
 * и минимальный ночной расход по зонам расчёта, сценарий утечки против базового расчёта.
 */
const props = defineProps<{
  modelId: number;
  run: WaterRun | null;
  network: GeoJSON.FeatureCollection | null;
  canEdit: boolean;
  canCalc: boolean;
  engineAvailable: boolean;
}>();
const emit = defineEmits<{
  /** Зоны для карты (null — карта снова по давлению и скорости) */
  zones: [zones: WaterZones | null];
  /** Выполнен расчёт со сценарием утечки */
  ran: [runId: number];
}>();

const MAX_LEAK_AREA_CM2 = 500;
const zones = ref<WaterZones | null>(null);
const balance = ref<WaterBalance | null>(null);
const meters = ref<string[]>([]);
const onMap = ref(false);
const loading = ref(false);
const busy = ref<'' | 'meters' | 'leak'>('');
const errorMessage = ref('');
const leakNode = ref<string | null>(null);
const leakArea = ref<number>(5);

const byName = (a: string, b: string) => a.localeCompare(b, 'ru', { numeric: true });
const networkIds = (pick: (p: Record<string, any>) => boolean) => (props.network?.features ?? [])
  .map((f) => f.properties ?? {})
  .filter(pick)
  .map((p) => String(p.id))
  .sort(byName);
const pipeIds = computed(() => networkIds((p) => p.kind === 'link' && p.type === 'Pipe'));
const junctionIds = computed(() => networkIds((p) => p.kind === 'node' && p.type === 'Junction'));
const colors = computed(() => zoneColors(zones.value?.zones ?? []));
const metersDirty = computed(() => [...meters.value].sort().join('|') !== [...(zones.value?.meters ?? [])].sort().join('|'));
const leakValid = computed(() => !!leakNode.value && leakArea.value > 0 && leakArea.value <= MAX_LEAK_AREA_CM2);
const hasLeaks = computed(() => !!balance.value?.leaks.length);

interface Row {
  index: number;
  name: string;
  kind: WaterZoneKind;
  sources: string[];
  junctions: number;
  supply: number | null;
  mnf: number | null;
  mnfTime: number | null;
  mnfShare: number | null;
  leak: number | null;
  detection: WaterDetection | null;
}

const rows = computed<Row[]>(() => {
  const list = zones.value?.zones ?? [];
  const bal = new Map((balance.value?.zones ?? []).map((z) => [z.index, z]));
  const det = new Map((balance.value?.detection ?? []).map((d) => [d.index, d]));
  return list.map((z) => {
    const b = bal.get(z.index);
    return {
      index: z.index, name: z.name, kind: z.kind, sources: z.sources, junctions: z.junctions,
      supply: b?.supply_avg_ls ?? null, mnf: b?.mnf_ls ?? null, mnfTime: b?.mnf_time_s ?? null,
      mnfShare: b?.mnf_share ?? null, leak: b?.leak_avg_ls ?? null, detection: det.get(z.index) ?? null,
    };
  });
});

const num = (v: number | null | undefined) => (v == null ? '—' : (Math.round(v * 10) / 10 || 0).toLocaleString('ru-RU'));
const signed = (v: number) => {
  const r = Math.round(v * 10) / 10;
  return r === 0 ? '0' : `${r > 0 ? '+' : ''}${num(r)}`;
};
const zoneName = (index: number | null | undefined) => zones.value?.zones.find((z) => z.index === index)?.name ?? '—';

const leakNotes = computed(() => (balance.value?.leaks ?? []).map((l) => {
  const det = balance.value?.detection.find((d) => d.index === l.zone);
  const zone = zoneName(l.zone);
  let verdict = '';
  if (det) {
    verdict = det.detected
      ? ` Ночной расход зоны вырос на ${num(det.d_mnf_ls)} л/с при пороге ${num(det.threshold_ls)} — расходомеры зоны её заметят.`
      : ` Ночной расход зоны вырос на ${num(det.d_mnf_ls)} л/с, порог ${num(det.threshold_ls)} — по расходомерам зоны не заметна: зону стоит разделить.`;
  }
  return {
    node: l.node,
    text: `Утечка в узле ${l.node} (${zone}): ${num(l.avg_ls)} л/с, ${num(l.volume_m3)} м³ за период.${verdict}`,
  };
}));

const publish = () => emit('zones', onMap.value ? zones.value : null);

const loadZones = async () => {
  loading.value = true;
  try {
    zones.value = await fastApiService.getWaterZones(props.modelId);
    meters.value = [...zones.value.meters];
    publish();
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Зоны водоучёта не загрузились');
  } finally {
    loading.value = false;
  }
};

let balanceKey = '';
/** Баланс расчёта; один и тот же (модель, расчёт, расходомеры) не запрашивается дважды */
const loadBalance = async () => {
  if (props.run && !zones.value) return; // ждёт зоны модели: баланс считается по их расходомерам
  const key = props.run ? `${props.modelId}:${props.run.id}:${zones.value?.meters.join('|') ?? ''}` : '';
  if (key === balanceKey) return;
  balanceKey = key;
  balance.value = null;
  if (!props.run) return;
  loading.value = true;
  try {
    balance.value = await fastApiService.getWaterBalance(props.modelId, props.run.id);
  } catch (err: unknown) {
    balanceKey = '';
    errorMessage.value = formatApiError(err, 'Баланс по зонам не посчитан');
  } finally {
    loading.value = false;
  }
};

const saveMeters = async () => {
  busy.value = 'meters';
  try {
    zones.value = await fastApiService.setWaterMeters(props.modelId, meters.value);
    meters.value = [...zones.value.meters];
    publish();
    await loadBalance();
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Расходомеры не сохранены');
  } finally {
    busy.value = '';
  }
};

const runLeak = async () => {
  if (!leakNode.value) return;
  busy.value = 'leak';
  try {
    const res = await fastApiService.runWaterModel(props.modelId, 24, 1, [{ node: leakNode.value, area_cm2: leakArea.value }]);
    emit('ran', res.id);
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Расчёт с утечкой не выполнен');
  } finally {
    busy.value = '';
  }
};

watch(() => props.modelId, async () => {
  errorMessage.value = '';
  zones.value = null;
  balance.value = null;
  balanceKey = '';
  await loadZones();
  await loadBalance();
}, { immediate: true });
watch(() => props.run?.id, () => void loadBalance());
watch(onMap, publish);
</script>

<style scoped>
.wz-meters { min-width: 260px; flex: 1 1 260px; }
.wz-node { max-width: 180px; }
.wz-area { max-width: 140px; }
.wz-table { font-size: var(--text-sm, 0.8125rem); }
.wz-dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 6px; }
</style>
