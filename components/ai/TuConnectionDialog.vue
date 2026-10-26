<template>
  <v-dialog
    v-model="visible"
    max-width="980"
    scrollable
  >
    <v-card rounded="lg">
      <v-card-title class="d-flex align-center ga-2 px-4 py-3">
        <v-icon color="cyan-darken-3">
          mdiMapMarkerRadius
        </v-icon>
        <span class="text-subtitle-1 font-weight-bold">Точка подключения для ТУ</span>
        <v-spacer />
        <HintTip
          text="Закрыть"
        >
          <template #default="{ props: tip }">
            <v-btn
              v-bind="tip"
              icon
              variant="text"
              aria-label="Закрыть"
              @click="visible = false"
            >
              <v-icon>mdiClose</v-icon>
            </v-btn>
          </template>
        </HintTip>
      </v-card-title>
      <v-divider />
      <v-card-text class="pt-3">
        <div class="d-flex flex-wrap ga-2 align-center">
          <v-text-field
            v-model="address"
            density="compact"
            variant="outlined"
            hide-details
            label="Адрес объекта"
            placeholder="ул. Абая 10"
            class="tu-conn__address"
            :loading="geocoding"
            @keyup.enter="geocode"
          />
          <v-btn
            size="small"
            variant="tonal"
            :disabled="address.trim().length < 3"
            :loading="geocoding"
            @click="geocode"
          >
            Найти адрес
          </v-btn>
          <v-btn
            size="small"
            variant="tonal"
            title="Взять координаты центра карты"
            @click="useMapCenter"
          >
            Центр карты
          </v-btn>
          <span
            v-if="point"
            class="text-caption text-medium-emphasis"
          >{{ point.lat.toFixed(5) }}, {{ point.lon.toFixed(5) }}</span>
        </div>
        <div class="d-flex flex-wrap ga-2 mt-2">
          <v-text-field
            v-model.number="loadGcal"
            density="compact"
            variant="outlined"
            hide-details
            type="number"
            min="0"
            step="0.01"
            label="Нагрузка, Гкал/ч"
            class="tu-conn__num"
          />
          <v-text-field
            v-model.number="floors"
            density="compact"
            variant="outlined"
            hide-details
            type="number"
            min="1"
            label="Этажей"
            class="tu-conn__num"
          />
          <v-text-field
            v-model.number="areaM2"
            density="compact"
            variant="outlined"
            hide-details
            type="number"
            min="0"
            label="Площадь застройки, м²"
            class="tu-conn__num"
          />
          <v-text-field
            v-model.number="radiusM"
            density="compact"
            variant="outlined"
            hide-details
            type="number"
            min="20"
            max="2000"
            label="Радиус, м"
            class="tu-conn__num"
          />
          <v-btn
            size="small"
            variant="text"
            :disabled="!floors"
            :loading="estimating"
            title="Оценка нагрузки по аналогам АЛСЕКО (этажность, площадь)"
            @click="estimate"
          >
            Оценить нагрузку
          </v-btn>
        </div>
        <div
          v-if="loadEstimate"
          class="text-caption mt-1"
        >
          Оценка по аналогам: <strong>{{ fmt(loadEstimate.load_gcal_h, 3) }} Гкал/ч</strong> ({{ loadEstimate.basis }})
          <v-btn
            v-if="loadEstimate.load_gcal_h != null"
            size="x-small"
            variant="text"
            @click="loadGcal = loadEstimate.load_gcal_h"
          >
            подставить
          </v-btn>
        </div>
        <v-textarea
          v-if="canUseAi"
          v-model="requestText"
          density="compact"
          variant="outlined"
          hide-details
          rows="2"
          auto-grow
          class="mt-2"
          label="Текст заявки (для помощника ИИ)"
          placeholder="Жилой дом 9 этажей, 2 подъезда, ул. Абая 10; отопление и ГВС"
        />
        <div class="d-flex ga-2 mt-3">
          <v-btn
            color="cyan-darken-3"
            variant="flat"
            :disabled="!point"
            :loading="searching"
            @click="search"
          >
            Подобрать точки
          </v-btn>
          <v-btn
            v-if="canUseAi"
            variant="tonal"
            :disabled="!point"
            :loading="recommending"
            @click="recommend"
          >
            <v-icon
              size="small"
              class="mr-1"
            >
              mdiCreation
            </v-icon>
            Рекомендация ИИ
          </v-btn>
          <v-btn
            v-if="candidates?.items.length"
            variant="text"
            @click="showAllOnMap"
          >
            Все на карте
          </v-btn>
        </div>
        <v-alert
          v-if="error"
          type="error"
          density="compact"
          variant="tonal"
          class="mt-3"
        >
          {{ error }}
        </v-alert>

        <div
          v-if="recommendation"
          class="tu-conn__ai mt-3"
        >
          <div class="font-weight-bold mb-1">
            <v-icon
              size="16"
              color="primary"
              class="mr-1"
            >
              mdiCreation
            </v-icon>
            Рекомендация помощника
          </div>
          <p class="mb-1">
            {{ recommendation.explanation }}
          </p>
          <div
            v-if="chosen"
            class="text-body-2"
          >
            Точка: <strong>{{ chosen.name }}</strong> ({{ chosen.distance_m }} м), источник {{ chosen.source_name || '—' }}
          </div>
          <div
            v-if="recommendation.draft.prirost_nagruzki != null"
            class="text-body-2"
          >
            Черновик ТУ: источник «{{ recommendation.draft.istochnik || '—' }}», камера «{{ recommendation.draft.kamera || '—' }}»,
            прирост {{ fmt(recommendation.draft.prirost_nagruzki, 3) }} Гкал/ч
            (отопление {{ fmt(recommendation.draft.otoplenie, 3) }}, вентиляция {{ fmt(recommendation.draft.ventilyatsiya, 3) }}, ГВС {{ fmt(recommendation.draft.gvs, 3) }})
            <v-btn
              size="x-small"
              variant="text"
              @click="copyDraft"
            >
              скопировать
            </v-btn>
          </div>
          <ul
            v-if="recommendation.risks.length"
            class="mt-1 pl-4 text-body-2"
          >
            <li
              v-for="(r, i) in recommendation.risks"
              :key="i"
            >
              {{ r }}
            </li>
          </ul>
        </div>

        <v-table
          v-if="candidates"
          density="compact"
          class="mt-3 tu-conn__table"
        >
          <thead>
            <tr>
              <th>#</th>
              <th>Узел</th>
              <th>Фрагмент</th>
              <th class="text-right">
                м
              </th>
              <th class="text-right">
                Ø, мм
              </th>
              <th class="text-right">
                Hрасп, м
              </th>
              <th class="text-right">
                v → v', м/с
              </th>
              <th>Источник</th>
              <th class="text-right">
                Балл
              </th>
              <th>Причины</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(c, i) in candidates.items"
              :key="c.node_id"
              :class="{ 'tu-conn__chosen': recommendation?.chosen_index === i }"
              class="tu-conn__row"
              @click="showOnMap(c)"
            >
              <td>{{ i + 1 }}</td>
              <td>{{ c.name || c.node_id }}</td>
              <td>{{ c.fragment_name || c.fragment_id || '—' }}</td>
              <td class="text-right">
                {{ fmt(c.distance_m, 0) }}
              </td>
              <td class="text-right">
                {{ fmt(c.diameter_mm, 0) }}
              </td>
              <td class="text-right">
                {{ fmt(c.available_head, 1) }}
              </td>
              <td class="text-right">
                {{ fmt(c.velocity, 2) }} → {{ fmt(c.velocity_after, 2) }}
              </td>
              <td>{{ c.source_name || '—' }}</td>
              <td class="text-right">
                {{ fmt(c.score, 0) }}
              </td>
              <td class="text-caption">
                {{ c.reasons.join('; ') }}
              </td>
            </tr>
          </tbody>
        </v-table>
        <div
          v-if="candidates?.note"
          class="text-caption mt-2"
        >
          {{ candidates.note }}
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useNominatim } from '~/composables/useNominatim';
import { useLocateMarkers } from '~/composables/useLocateMarkers';
import { useAuthStore } from '~/stores/authStore';
import { useMapStore } from '~/stores/mapStore';
import { useNotificationStore } from '~/stores/notificationStore';
import { formatApiErrorWith } from '~/utils/apiError';
import {
  tuConnectionService,
  type ConnectionCandidate,
  type ConnectionCandidates,
  type LoadEstimate,
  type TuRecommendation,
} from '~/services/tuConnectionService';
import HintTip from '~/components/HintTip.vue';

/**
 * Подбор точки подключения для заявки на ТУ: точка объекта (адрес через Nominatim или центр карты),
 * кандидаты с режимом по последнему расчёту (сервер), маркеры на карте, рекомендация помощника ИИ.
 */
const visible = defineModel<boolean>({ default: false });

const authStore = useAuthStore();
const mapStore = useMapStore();
const notify = useNotificationStore();
const { searchAddress } = useNominatim();
const markers = useLocateMarkers(() => mapStore.map);

const canUseAi = computed(() => authStore.canUseAi);

const address = ref('');
const point = ref<{ lon: number; lat: number } | null>(null);
const loadGcal = ref<number | null>(null);
const floors = ref<number | null>(null);
const areaM2 = ref<number | null>(null);
const radiusM = ref(300);
const requestText = ref('');

const geocoding = ref(false);
const estimating = ref(false);
const searching = ref(false);
const recommending = ref(false);
const error = ref('');

const candidates = ref<ConnectionCandidates | null>(null);
const loadEstimate = ref<LoadEstimate | null>(null);
const recommendation = ref<TuRecommendation | null>(null);
const chosen = ref<ConnectionCandidate | null>(null);

const fmt = (v: number | null | undefined, digits: number): string =>
  v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('ru-RU', { maximumFractionDigits: digits, minimumFractionDigits: 0 });

const geocode = async () => {
  if (address.value.trim().length < 3) return;
  geocoding.value = true;
  try {
    const found = await searchAddress(address.value);
    if (!found.length) {
      notify.showWarning('Адрес не найден (Nominatim в пределах города)');
      return;
    }
    point.value = { lon: Number(found[0].lon), lat: Number(found[0].lat) };
    mapStore.map?.flyTo?.({ center: [point.value.lon, point.value.lat], zoom: 17 });
  } finally {
    geocoding.value = false;
  }
};

const useMapCenter = () => {
  const center = mapStore.map?.getCenter?.();
  if (!center) {
    notify.showWarning('Карта ещё не загружена');
    return;
  }
  point.value = { lon: center.lng, lat: center.lat };
};

const estimate = async () => {
  if (!floors.value) return;
  estimating.value = true;
  error.value = '';
  try {
    loadEstimate.value = await tuConnectionService.loadEstimate({ floors: floors.value, area_m2: areaM2.value || undefined });
  } catch (err) {
    error.value = formatApiErrorWith('Оценка нагрузки не выполнена', err);
  } finally {
    estimating.value = false;
  }
};

const query = () => ({
  lon: point.value!.lon,
  lat: point.value!.lat,
  load_gcal_h: loadGcal.value || undefined,
  radius_m: radiusM.value || 300,
});

const search = async () => {
  if (!point.value) return;
  searching.value = true;
  error.value = '';
  recommendation.value = null;
  chosen.value = null;
  try {
    candidates.value = await tuConnectionService.candidates(query());
  } catch (err) {
    candidates.value = null;
    error.value = formatApiErrorWith('Подбор точек не выполнен', err);
  } finally {
    searching.value = false;
  }
};

const recommend = async () => {
  if (!point.value) return;
  recommending.value = true;
  error.value = '';
  try {
    const result = await tuConnectionService.recommend({
      ...query(),
      request_text: requestText.value,
      floors: floors.value || undefined,
      area_m2: areaM2.value || undefined,
    });
    candidates.value = result.candidates;
    loadEstimate.value = result.load_estimate;
    recommendation.value = result.recommendation;
    chosen.value = result.chosen;
    if (result.chosen) showOnMap(result.chosen);
  } catch (err) {
    error.value = formatApiErrorWith('Помощник ИИ не ответил', err);
  } finally {
    recommending.value = false;
  }
};

const spec = { zoom: 17, color: '#00838f', popupText: (p: { label?: string }) => p.label || '' };

const showOnMap = (c: ConnectionCandidate) => {
  if (c.longitude == null || c.latitude == null) return;
  markers.locate('tu-candidate', { longitude: c.longitude, latitude: c.latitude, id: c.node_id, label: `${c.name} · ${c.distance_m} м` }, spec);
};

const showAllOnMap = () => {
  const items = candidates.value?.items ?? [];
  items.forEach((c, i) => {
    if (c.longitude == null || c.latitude == null) return;
    markers.locate(`tu-candidate-${i}`, { longitude: c.longitude, latitude: c.latitude, id: c.node_id, label: `${i + 1}. ${c.name}` },
      { ...spec, zoom: 16 });
  });
};

const copyDraft = async () => {
  const d = recommendation.value?.draft;
  if (!d) return;
  const text = `Источник: ${d.istochnik || ''}\nКамера: ${d.kamera || ''}\nПрирост: ${d.prirost_nagruzki ?? ''} Гкал/ч`
    + ` (отопление ${d.otoplenie ?? ''}, вентиляция ${d.ventilyatsiya ?? ''}, ГВС ${d.gvs ?? ''})`;
  try {
    await navigator.clipboard.writeText(text);
    notify.showInfo('Черновик ТУ скопирован');
  } catch {
    notify.showWarning('Буфер обмена недоступен');
  }
};

watch(visible, (open) => {
  if (!open) markers.clearAll();
});
</script>

<style scoped>
.tu-conn__address {
  min-width: 260px;
  flex: 1 1 260px;
}
.tu-conn__num {
  width: 150px;
  flex: 0 0 150px;
}
.tu-conn__ai {
  padding: 8px 10px;
  border: 1px solid rgba(var(--v-theme-primary), 0.35);
  border-radius: 6px;
  background: rgba(var(--v-theme-primary), 0.04);
}
.tu-conn__row {
  cursor: pointer;
}
.tu-conn__chosen {
  background: rgba(var(--v-theme-primary), 0.1);
}
.tu-conn__table td {
  white-space: nowrap;
}
.tu-conn__table td:last-child {
  white-space: normal;
  min-width: 220px;
}
</style>
