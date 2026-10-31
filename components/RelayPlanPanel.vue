<template>
  <div>
    <p class="text-body-2 mb-2">
      Что переложить в пределах бюджета, чтобы снять больше ожидаемых повреждений: польза трассы — вероятность
      повреждения × последствия (износ, расход через участок), единица — трасса между развилками.
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
    <div class="d-flex align-center flex-wrap ga-2 mb-2">
      <v-text-field
        v-model.number="budget"
        type="number"
        :label="unit === 'km' ? 'Бюджет, км' : `Бюджет, ${currency}`"
        :min="0"
        density="compact"
        variant="outlined"
        hide-details
        class="rp-num"
      />
      <v-btn-toggle
        v-model="unit"
        density="compact"
        mandatory
        variant="outlined"
        divided
      >
        <v-btn value="km">
          км
        </v-btn>
        <v-btn
          value="money"
          :disabled="!prices.length"
        >
          деньги
        </v-btn>
      </v-btn-toggle>
      <v-text-field
        v-model.number="overhead"
        type="number"
        label="Затраты объекта, м трубы"
        :min="0"
        density="compact"
        variant="outlined"
        hide-details
        class="rp-num"
      />
      <v-btn
        size="small"
        color="primary"
        variant="flat"
        :loading="busy === 'plan'"
        :disabled="!run || !!busy || !(budget > 0)"
        @click="makePlan"
      >
        Составить план
      </v-btn>
    </div>
    <p class="text-caption text-medium-emphasis mb-2">
      Затраты объекта — вскрытие, отключение, благоустройство в метрах трубы: без них в план попадают обрезки
      по 2 м. В деньгах — после заполнения расценок ниже.
    </p>

    <template v-if="plan">
      <v-alert
        type="info"
        density="compact"
        variant="tonal"
        class="mb-2"
      >
        {{ summaryText }}
      </v-alert>
      <p
        v-if="plan.consequence_values <= 1"
        class="text-caption text-medium-emphasis mb-2"
      >
        Последствия в паспортах участков одинаковы (не заполнены) — польза различается только по расходу через
        участок (известен у {{ plan.flow_known.toLocaleString('ru-RU') }} из {{ plan.population.toLocaleString('ru-RU') }}).
      </p>
      <div class="d-flex align-center mb-1">
        <div class="text-subtitle-2">
          Объекты перекладки
        </div>
        <v-spacer />
        <v-btn
          size="small"
          variant="tonal"
          prepend-icon="mdi-map"
          @click="emit('show', planFrame(plan))"
        >
          На карте
        </v-btn>
      </div>
      <v-table
        density="compact"
        class="rp-table"
      >
        <thead>
          <tr>
            <th>№</th>
            <th>Фрагмент</th>
            <th class="text-right">
              Участков
            </th>
            <th class="text-right">
              Длина, м
            </th>
            <th class="text-right">
              Ø, мм
            </th>
            <th class="text-right">
              Ожид. повр.
            </th>
            <th class="text-right">
              {{ plan.unit === 'km' ? 'км' : plan.currency }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="o in plan.objects.slice(0, LIST_LIMIT)"
            :key="o.n"
          >
            <td>{{ o.n }}</td>
            <td class="text-caption">
              {{ o.fragment || '—' }}
            </td>
            <td class="text-right">
              {{ o.lines }}
            </td>
            <td class="text-right">
              {{ num(o.length_m, 0) }}
            </td>
            <td class="text-right">
              {{ o.dn_min === o.dn_max ? num(o.dn_min, 0) : `${num(o.dn_min, 0)}–${num(o.dn_max, 0)}` }}
            </td>
            <td class="text-right">
              {{ num(o.expected_failures, 3) }}
            </td>
            <td class="text-right">
              {{ num(o.cost, plan.unit === 'km' ? 3 : 0) }}
            </td>
          </tr>
        </tbody>
      </v-table>
      <p
        v-if="plan.objects.length > LIST_LIMIT"
        class="text-caption text-medium-emphasis"
      >
        Показаны {{ LIST_LIMIT }} объектов из {{ plan.objects.length }}; все — на карте.
      </p>
    </template>

    <div class="text-subtitle-2 mt-4 mb-1">
      Расценки перекладки за метр
    </div>
    <p
      v-if="!prices.length && !canEdit"
      class="text-caption text-medium-emphasis"
    >
      Расценки не заполнены — план считается в километрах.
    </p>
    <div
      v-for="(p, i) in priceRows"
      :key="i"
      class="d-flex align-center ga-2 mb-1"
    >
      <v-text-field
        v-model.number="p.dn_max_mm"
        type="number"
        label="Ø до, мм"
        :readonly="!canEdit"
        density="compact"
        variant="outlined"
        hide-details
        class="rp-num"
      />
      <v-text-field
        v-model.number="p.price_per_m"
        type="number"
        label="Цена за м"
        :readonly="!canEdit"
        density="compact"
        variant="outlined"
        hide-details
        class="rp-num"
      />
      <v-text-field
        v-model="p.currency"
        label="Валюта"
        :readonly="!canEdit"
        density="compact"
        variant="outlined"
        hide-details
        class="rp-cur"
      />
      <v-btn
        v-if="canEdit"
        size="x-small"
        variant="text"
        icon="mdi-delete-outline"
        aria-label="Удалить класс"
        @click="priceRows.splice(i, 1)"
      />
    </div>
    <div
      v-if="canEdit"
      class="d-flex ga-2 mt-1"
    >
      <v-btn
        size="small"
        variant="text"
        prepend-icon="mdi-plus"
        @click="priceRows.push({ dn_max_mm: 0, price_per_m: 0, currency: priceRows[0]?.currency || 'KZT' })"
      >
        Класс диаметра
      </v-btn>
      <v-btn
        size="small"
        variant="tonal"
        :loading="busy === 'prices'"
        :disabled="!!busy || !pricesValid"
        @click="savePrices"
      >
        Сохранить расценки
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { fastApiService } from '~/services/fastApiService';
import { formatApiError } from '~/utils/apiError';
import { pctText, planFrame, type FailureRun, type RelayPlan, type RelayPrice } from '~/utils/failureForecast';

/**
 * План перекладок (itwin-api database/relay_plan.py): бюджет в км или деньгах, постоянные затраты объекта,
 * объекты перекладки с ожидаемыми повреждениями, сравнение с «самыми старыми первыми», расценки по диаметру.
 */
const props = defineProps<{ run: FailureRun | null; canEdit: boolean }>();
const emit = defineEmits<{ show: [data: GeoJSON.FeatureCollection] }>();

const LIST_LIMIT = 30;
const budget = ref(5);
const unit = ref<'km' | 'money'>('km');
const overhead = ref(25);
const plan = ref<RelayPlan | null>(null);
const prices = ref<RelayPrice[]>([]);
const priceRows = ref<RelayPrice[]>([]);
const busy = ref<'' | 'plan' | 'prices'>('');
const errorMessage = ref('');

const currency = computed(() => prices.value[0]?.currency ?? 'KZT');
const pricesValid = computed(() => priceRows.value.every((p) => p.dn_max_mm > 0 && p.price_per_m > 0 && p.currency)
  && new Set(priceRows.value.map((p) => p.dn_max_mm)).size === priceRows.value.length);
const num = (v: number | null | undefined, digits = 1) => (v == null ? '—'
  : v.toLocaleString('ru-RU', { maximumFractionDigits: digits }));
const summaryText = computed(() => {
  const p = plan.value;
  if (!p) return '';
  const spent = p.unit === 'km' ? `${num(p.length_km, 2)} км` : `${num(p.spent, 0)} ${p.currency} (${num(p.length_km, 2)} км)`;
  return `${p.objects.length} объектов, ${p.lines} участков, ${spent}: снимают ${num(p.expected_failures, 1)} из `
    + `ожидаемых повреждений за ${p.horizon_years} года (${pctText(p.expected_failures_share)}). `
    + `«Самые старые первыми» в том же бюджете — ${pctText(p.oldest_first.expected_failures_share)}.`;
});

const loadPrices = async () => {
  try {
    prices.value = await fastApiService.getRelayPrices();
    priceRows.value = prices.value.map((p) => ({ ...p }));
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Расценки не загрузились');
  }
};

const makePlan = async () => {
  busy.value = 'plan';
  errorMessage.value = '';
  try {
    plan.value = await fastApiService.getRelayPlan(budget.value, unit.value, overhead.value);
    emit('show', planFrame(plan.value));
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'План не составлен');
  } finally {
    busy.value = '';
  }
};

const savePrices = async () => {
  busy.value = 'prices';
  try {
    prices.value = await fastApiService.setRelayPrices(
      [...priceRows.value].sort((a, b) => a.dn_max_mm - b.dn_max_mm));
    priceRows.value = prices.value.map((p) => ({ ...p }));
    if (!prices.value.length) unit.value = 'km';
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Расценки не сохранены');
  } finally {
    busy.value = '';
  }
};

watch(() => props.run?.id, () => {
  plan.value = null;
}, { immediate: false });
void loadPrices();
</script>

<style scoped>
.rp-num { max-width: 170px; }
.rp-cur { max-width: 90px; }
.rp-table { font-size: var(--text-sm, 0.8125rem); }
</style>
