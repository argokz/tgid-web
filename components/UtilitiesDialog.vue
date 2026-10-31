<template>
  <v-dialog
    v-model="visible"
    :max-width="860"
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
        <span class="text-h6 flex-grow-1">Сети: сближения и раскопки</span>
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          aria-label="Закрыть"
          @click="visible = false"
        />
      </v-card-title>
      <v-tabs
        v-model="tab"
        density="compact"
        class="px-2"
      >
        <v-tab value="conflicts">
          Сближения и пересечения
        </v-tab>
        <v-tab value="dig">
          Раскопки
        </v-tab>
      </v-tabs>
      <v-divider />

      <v-card-text class="pa-4">
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

        <template v-if="tab === 'conflicts'">
          <p class="text-body-2 mb-2">
            Водопровод (модель) против теплосети города: трассы, пересекающиеся в плане, и участки ближе нормы по
            горизонтали в свету (от наружных стенок труб).
          </p>
          <div class="d-flex align-center flex-wrap ga-2 mb-2">
            <v-select
              v-model="modelId"
              :items="models.map((m) => ({ title: m.name, value: m.id }))"
              label="Модель водопровода"
              density="compact"
              variant="outlined"
              hide-details
              class="ud-model"
            />
            <v-btn
              size="small"
              color="primary"
              variant="flat"
              :loading="busy === 'conflicts'"
              :disabled="!modelId || !!busy"
              @click="findConflicts"
            >
              Найти
            </v-btn>
          </div>
          <div
            v-if="norm"
            class="text-caption text-medium-emphasis mb-2"
          >
            Норма «водопровод — теплосеть»: {{ norm.horizontal_m == null ? 'не задана' : `${num(norm.horizontal_m)} м` }}
            по горизонтали<span v-if="norm.source"> ({{ norm.source }})</span>.
            <template v-if="canEditNorm">
              <v-text-field
                v-model.number="normValue"
                type="number"
                label="м"
                :min="0"
                :step="0.1"
                density="compact"
                variant="outlined"
                hide-details
                class="ud-norm d-inline-flex mx-1"
              />
              <v-btn
                size="x-small"
                variant="tonal"
                :disabled="normValue === norm.horizontal_m || !!busy"
                @click="saveNorm"
              >
                Изменить
              </v-btn>
            </template>
          </div>
          <template v-if="conflicts">
            <div class="d-flex flex-wrap ga-4 text-body-2 mb-1">
              <span><span
                class="ud-dot"
                :style="{ background: CONFLICT_META.crossing.color }"
              />Пересечений: {{ conflicts.summary.crossings }}</span>
              <span><span
                class="ud-dot"
                :style="{ background: CONFLICT_META.close.color }"
              />Ближе нормы: {{ conflicts.summary.close }} ({{ num(conflicts.summary.close_length_m) }} м)</span>
            </div>
            <p
              v-if="conflicts.depth_note"
              class="text-caption text-medium-emphasis mb-2"
            >
              {{ conflicts.depth_note }}. Расстояние по вертикали в пересечениях проверяется по исполнительной съёмке.
            </p>
            <v-table
              v-if="closeRows.length"
              density="compact"
              class="ud-table mb-2"
            >
              <thead>
                <tr>
                  <th>Водопровод</th>
                  <th>Теплосеть</th>
                  <th class="text-right">
                    В свету
                  </th>
                  <th class="text-right">
                    На длине, м
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="c in closeRows"
                  :key="`${c.water_link}-${c.heat_line}`"
                >
                  <td>{{ c.water_link }} <span class="text-caption text-medium-emphasis">Ø{{ num(c.water_d_mm) }}</span></td>
                  <td>
                    участок {{ c.heat_line }} <span class="text-caption text-medium-emphasis">Ø{{ num(c.heat_d_mm) }}<template
                      v-if="c.heat_pipes > 1"
                    > · {{ c.heat_pipes }} тр.</template></span>
                  </td>
                  <td class="text-right">
                    {{ clearanceText(c.clearance_m) }}
                  </td>
                  <td class="text-right">
                    {{ num(c.near_length_m) }}
                  </td>
                </tr>
              </tbody>
            </v-table>
            <p
              v-if="conflicts.close.length > LIST_LIMIT"
              class="text-caption text-medium-emphasis"
            >
              Показаны {{ LIST_LIMIT }} самых близких из {{ conflicts.close.length }}; все — на карте.
            </p>
          </template>
        </template>

        <template v-else>
          <p class="text-body-2 mb-2">
            Сети в зоне работ: точка раскопки — центр карты (наведите карту на место), отступ — радиус поиска.
            Список — для согласования: участки, владельцы, расстояние до места работ.
          </p>
          <div class="d-flex align-center flex-wrap ga-2 mb-2">
            <v-text-field
              v-model.number="bufferM"
              type="number"
              label="Радиус, м"
              :min="0"
              :max="200"
              density="compact"
              variant="outlined"
              hide-details
              class="ud-buffer"
            />
            <v-btn
              size="small"
              color="primary"
              variant="flat"
              prepend-icon="mdi-shovel"
              :loading="busy === 'dig'"
              :disabled="!!busy || !(bufferM >= 0 && bufferM <= 200)"
              @click="checkDig"
            >
              Проверить место в центре карты
            </v-btn>
          </div>
          <template v-if="dig">
            <div class="text-body-2 mb-1">
              Теплосеть: {{ dig.heat.length }} участк. · водопровод: {{ dig.water.length }} тр.
              <template v-if="ownersText">
                · владельцы: {{ ownersText }}
              </template>
            </div>
            <p
              v-if="dig.depth_note && dig.heat.length"
              class="text-caption text-medium-emphasis mb-1"
            >
              {{ dig.depth_note }}.
            </p>
            <v-table
              v-if="dig.heat.length || dig.water.length"
              density="compact"
              class="ud-table"
            >
              <thead>
                <tr>
                  <th>Сеть</th>
                  <th>Участок</th>
                  <th>Владелец / модель</th>
                  <th class="text-right">
                    Ø, мм
                  </th>
                  <th class="text-right">
                    До места, м
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="h in dig.heat"
                  :key="`h${h.id}`"
                >
                  <td>
                    <span
                      class="ud-line"
                      :style="{ background: NET_COLOR.heat }"
                    />{{ UTILITY_KIND_LABEL.heat }}
                  </td>
                  <td>
                    {{ h.id }}<template v-if="h.pipes > 1">
                      ({{ h.pipes }} тр.)
                    </template>
                    <div class="text-caption text-medium-emphasis">
                      {{ h.fragment }}
                    </div>
                  </td>
                  <td>{{ h.owner || '—' }}</td>
                  <td class="text-right">
                    {{ num(h.d_mm) }}
                  </td>
                  <td class="text-right">
                    {{ num(h.distance_m) }}
                  </td>
                </tr>
                <tr
                  v-for="w in dig.water"
                  :key="`w${w.model_id}-${w.link}`"
                >
                  <td>
                    <span
                      class="ud-line"
                      :style="{ background: NET_COLOR.water }"
                    />{{ UTILITY_KIND_LABEL.water }}
                  </td>
                  <td>{{ w.link }}</td>
                  <td>{{ w.model }}</td>
                  <td class="text-right">
                    {{ num(w.d_mm) }}
                  </td>
                  <td class="text-right">
                    {{ num(w.distance_m) }}
                  </td>
                </tr>
              </tbody>
            </v-table>
            <p
              v-else
              class="text-body-2 text-medium-emphasis"
            >
              В зоне работ сетей нет.
            </p>
          </template>
        </template>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useDialogMapOverlay } from '~/composables/useDialogMapOverlay';
import { useMobile } from '~/composables/useMobile';
import { fastApiService } from '~/services/fastApiService';
import { useAuthStore } from '~/stores/authStore';
import { useMapStore } from '~/stores/mapStore';
import { formatApiError } from '~/utils/apiError';
import {
  clearanceText,
  CONFLICT_META,
  conflictsFrame,
  excavationFrame,
  NET_COLOR,
  pointGeometry,
  UTILITY_KIND_LABEL,
  type UtilityConflicts,
  type UtilityExcavation,
  type UtilityNorm,
} from '~/utils/utilities';
import type { WaterModel } from '~/utils/water';

/**
 * Общая карта коммуникаций (фаза 4): сближения и пересечения водопровода с теплосетью по нормам расстояний,
 * сети в зоне раскопок — для согласования работ.
 */
const visible = defineModel<boolean>({ default: false });
const emit = defineEmits<{
  'show-on-map': [data: GeoJSON.FeatureCollection];
  'clear-highlight': [];
}>();
const overlay = useDialogMapOverlay(visible, () => emit('clear-highlight'));
const { isMobile } = useMobile();
const authStore = useAuthStore();
const mapStore = useMapStore();

const LIST_LIMIT = 30;
const tab = ref<'conflicts' | 'dig'>('conflicts');
const models = ref<WaterModel[]>([]);
const modelId = ref<number | null>(null);
const norm = ref<UtilityNorm | null>(null);
const normValue = ref<number | null>(null);
const conflicts = ref<UtilityConflicts | null>(null);
const dig = ref<UtilityExcavation | null>(null);
const bufferM = ref(10);
const busy = ref<'' | 'conflicts' | 'dig' | 'norm'>('');
const errorMessage = ref('');

const canEditNorm = computed(() => authStore.canEditData && (authStore.permissions.general as string[]).includes('refs'));
const closeRows = computed(() => [...(conflicts.value?.close ?? [])]
  .sort((a, b) => a.clearance_m - b.clearance_m).slice(0, LIST_LIMIT));
const ownersText = computed(() => Object.entries(dig.value?.owners ?? {}).map(([o, n]) => `${o} (${n})`).join(', '));
const num = (v: number | null | undefined) => (v == null ? '—' : (Math.round(v * 10) / 10 || 0).toLocaleString('ru-RU'));

const show = (fc: GeoJSON.FeatureCollection) => {
  emit('show-on-map', fc);
  overlay.markShown();
};

const load = async () => {
  try {
    const [list, norms] = await Promise.all([fastApiService.getWaterModels(), fastApiService.getUtilityNorms()]);
    models.value = list;
    if (!modelId.value && list.length) modelId.value = list[0].id;
    norm.value = norms.find((n) => n.kind_a === 'heat' && n.kind_b === 'water') ?? null;
    normValue.value = norm.value?.horizontal_m ?? null;
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Модели и нормы не загрузились');
  }
};

const findConflicts = async () => {
  if (!modelId.value) return;
  busy.value = 'conflicts';
  errorMessage.value = '';
  try {
    conflicts.value = await fastApiService.getUtilityConflicts(modelId.value);
    show(conflictsFrame(conflicts.value));
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Сближения не найдены');
  } finally {
    busy.value = '';
  }
};

const saveNorm = async () => {
  if (!norm.value) return;
  busy.value = 'norm';
  try {
    norm.value = await fastApiService.setUtilityNorm({ ...norm.value, horizontal_m: normValue.value });
    if (conflicts.value) await findConflicts();
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Норма не сохранена');
  } finally {
    if (busy.value === 'norm') busy.value = '';
  }
};

const checkDig = async () => {
  const center = mapStore.map?.getCenter();
  if (!center) {
    errorMessage.value = 'Карта ещё не готова';
    return;
  }
  busy.value = 'dig';
  errorMessage.value = '';
  try {
    dig.value = await fastApiService.checkExcavation(pointGeometry(center.lng, center.lat), bufferM.value);
    show(excavationFrame(dig.value));
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Место не проверено');
  } finally {
    busy.value = '';
  }
};

watch(visible, (v) => {
  if (v) void load();
}, { immediate: true });

const openDialog = () => {
  visible.value = true;
};

defineExpose({ openDialog });
</script>

<style scoped>
.ud-model { max-width: 300px; }
.ud-buffer { max-width: 140px; }
.ud-norm { width: 90px; vertical-align: middle; }
.ud-table { font-size: var(--text-sm, 0.8125rem); }
.ud-dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 6px; }
.ud-line { display: inline-block; width: 14px; height: 4px; border-radius: 2px; margin-right: 6px; vertical-align: middle; }
</style>
