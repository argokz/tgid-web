<template>
  <div>
    <p class="text-body-2 mb-2">
      Сеть режется по участкам с расходомерами подачи и обратки — получаются зоны. Приток в зону — водоразбор и
      утечки; модель уже учитывает водоразбор открытой системы, остаток — небаланс. Погрешность расходомеров
      (±{{ result?.accuracy_pct ?? 2 }} % каждого) на магистрали — сотни т/ч, поэтому новую утечку лучше видно по
      ночному расходу (с {{ nightFrom }} до {{ nightTo }} ч): последняя ночь против медианы прошлых — постоянная
      ошибка расходомера в разности сокращается. Расходы — т/ч.
    </p>
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
      v-if="loading && !result"
      indeterminate
    />
    <p
      v-else-if="result && !result.zones.length"
      class="text-body-2 text-medium-emphasis"
    >
      Зон нет: поставьте расходомеры подачи и обратки на один участок (вывод источника, ввод квартала, ЦТП) —
      вкладка «Датчики».
    </p>
    <v-table
      v-else-if="result"
      density="compact"
      class="fb-table"
    >
      <thead>
        <tr>
          <th>Зона</th>
          <th class="text-right">
            Приток
          </th>
          <th class="text-right">
            Небаланс
          </th>
          <th class="text-right">
            Ночь
          </th>
          <th>Вывод</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="z in result.zones"
          :key="z.key"
        >
          <td>
            {{ ZONE_KIND_LABELS[z.kind] }}
            <div class="text-caption text-medium-emphasis">
              узлов {{ z.nodes }} · потребителей {{ z.consumers }} · {{ z.length_km.toLocaleString('ru-RU') }} км ·
              участки {{ z.boundary.join(', ') }}
            </div>
          </td>
          <td class="text-right text-no-wrap">
            <template v-if="z.fact != null">
              {{ flowText(z.model) }} → {{ flowText(z.fact) }}
              <div class="text-caption text-medium-emphasis">
                модель → факт
              </div>
            </template>
            <template v-else>
              —
            </template>
          </td>
          <td class="text-right text-no-wrap">
            <template v-if="z.excess != null">
              {{ flowText(z.excess, true) }}
              <div class="text-caption text-medium-emphasis">
                ±{{ flowText(z.uncertainty) }}
              </div>
            </template>
            <template v-else>
              —
            </template>
          </td>
          <td class="text-right text-no-wrap">
            <template v-if="z.night">
              {{ flowText(z.night.baseline) }} → {{ flowText(z.night.value) }}
              <div class="text-caption text-medium-emphasis">
                {{ flowText(z.night.growth, true) }} (порог {{ flowText(z.night.threshold) }})
              </div>
            </template>
            <template v-else-if="z.fact != null">
              <span class="text-caption text-medium-emphasis">мало ночей</span>
            </template>
            <template v-else>
              —
            </template>
          </td>
          <td>
            <span :style="{ color: BALANCE_META[z.status].color }">{{ BALANCE_META[z.status].label }}</span>
            <div class="text-caption text-medium-emphasis fb-text">
              {{ z.text }}<template v-if="z.missing.length">
                : {{ z.missing.join('; ') }}
              </template>
            </div>
          </td>
          <td>
            <v-btn
              size="x-small"
              variant="text"
              icon="mdi-map-marker-path"
              :loading="mapLoading === z.key"
              :aria-label="`Зона ${z.key} на карте`"
              @click="showZone(z)"
            />
          </td>
        </tr>
      </tbody>
    </v-table>
    <div
      v-if="result?.skipped.length"
      class="text-caption text-medium-emphasis mt-2"
    >
      Не участвуют: {{ result.skipped.join('; ') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { fastApiService } from '~/services/fastApiService';
import { formatApiError } from '~/utils/apiError';
import {
  BALANCE_META,
  flowText,
  ZONE_KIND_LABELS,
  zoneFeature,
  type BalanceResult,
  type BalanceZone,
} from '~/utils/flowBalance';

/**
 * Баланс расхода по зонам между расходомерами (фаза 3): приток факт / модель, небаланс с погрешностью
 * расходомеров, ночной расход последней ночи против прошлых, зона на карте.
 */
const emit = defineEmits<{ 'show-on-map': [data: GeoJSON.FeatureCollection] }>();

const result = ref<BalanceResult | null>(null);
const loading = ref(false);
const mapLoading = ref<number | null>(null);
const errorMessage = ref('');
const nightFrom = computed(() => result.value?.night_hours?.[0] ?? 2);
const nightTo = computed(() => result.value?.night_hours?.[1] ?? 5);

const load = async () => {
  loading.value = true;
  try {
    result.value = await fastApiService.getFlowBalance();
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Баланс расхода не рассчитался');
  } finally {
    loading.value = false;
  }
};

const showZone = async (zone: BalanceZone) => {
  mapLoading.value = zone.key;
  try {
    const geom = await fastApiService.getBalanceZoneGeometry(zone.key);
    emit('show-on-map', zoneFeature(zone, geom));
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Зона не показана');
  } finally {
    mapLoading.value = null;
  }
};

onMounted(() => void load());
defineExpose({ load });
</script>

<style scoped>
.fb-table { font-size: var(--text-sm, 0.8125rem); }
.fb-text { white-space: normal; max-width: 280px; }
</style>
