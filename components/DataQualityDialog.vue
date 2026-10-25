<template>
  <v-dialog
    v-model="visible"
    max-width="1000"
    scrollable
  >
    <v-card rounded="lg">
      <v-card-title class="d-flex align-center ga-2 px-4 py-3">
        <v-icon color="teal-darken-3">
          mdiDatabaseSearch
        </v-icon>
        <div class="flex-grow-1">
          <div class="text-subtitle-1 font-weight-bold">
            Качество исходных данных
          </div>
          <div class="text-caption text-medium-emphasis">
            Проверки считаются по текущим данным: нагрузки, фрагменты, отметки, длины, диаметры, источники
          </div>
        </div>
        <v-switch
          v-model="onlyVisibleFragment"
          density="compact"
          hide-details
          label="Видимый фрагмент"
          class="mr-2"
          :disabled="visibleFragmentId == null"
          @update:model-value="reload"
        />
        <v-btn
          v-if="authStore.canUseAi"
          size="small"
          color="primary"
          variant="tonal"
          :loading="explaining"
          class="mr-2"
          @click="explain"
        >
          <v-icon
            size="small"
            class="mr-1"
          >
            mdiCreation
          </v-icon>
          Объяснить
        </v-btn>
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
        <v-alert
          v-if="error"
          type="error"
          density="compact"
          variant="tonal"
          class="mb-3"
        >
          {{ error }}
        </v-alert>
        <div
          v-if="summary"
          class="text-body-2 mb-2"
        >
          Ошибок: <strong>{{ summary.total_errors }}</strong>, предупреждений: <strong>{{ summary.total_warnings }}</strong>
          <span v-if="summary.fragment_id"> (фрагмент {{ summary.fragment_id }})</span>
        </div>
        <v-progress-linear
          v-if="loading"
          indeterminate
          class="mb-2"
        />

        <v-table
          v-if="summary"
          density="compact"
          class="dq__rules"
        >
          <thead>
            <tr>
              <th />
              <th>Проверка</th>
              <th class="text-right">
                Записей
              </th>
              <th>Исправлять</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in summary.items"
              :key="r.rule"
              class="dq__rule"
              :class="{ 'dq__rule--active': r.rule === activeRule }"
              @click="openRule(r)"
            >
              <td>
                <v-chip
                  size="x-small"
                  :color="SEVERITY_COLORS[r.severity]"
                  variant="flat"
                >
                  {{ SEVERITY_LABELS[r.severity] }}
                </v-chip>
              </td>
              <td>{{ r.label }}</td>
              <td class="text-right">
                <template v-if="r.count != null">
                  {{ r.count.toLocaleString('ru-RU') }}
                  <span
                    v-if="r.sum_gcal_h != null"
                    class="text-caption text-medium-emphasis"
                  >({{ r.sum_gcal_h.toLocaleString('ru-RU') }} Гкал/ч)</span>
                </template>
                <span
                  v-else
                  class="text-caption text-medium-emphasis"
                  :title="r.error || ''"
                >нет данных</span>
              </td>
              <td class="text-caption">
                {{ r.fix_label }}
              </td>
            </tr>
          </tbody>
        </v-table>

        <div
          v-if="advice"
          class="dq__advice mt-3"
        >
          <div class="font-weight-bold mb-1">
            <v-icon
              size="16"
              color="primary"
              class="mr-1"
            >
              mdiCreation
            </v-icon>
            Объяснение помощника
          </div>
          <p class="mb-2">
            {{ advice.advice.summary }}
          </p>
          <div
            v-for="a in advice.advice.rules"
            :key="a.rule"
            class="dq__advice-rule"
          >
            <div class="font-weight-medium">
              {{ ruleLabel(a.rule) }}
              <v-chip
                size="x-small"
                variant="outlined"
                class="ml-1"
              >
                приоритет {{ a.priority }}
              </v-chip>
            </div>
            <div class="text-body-2">
              <strong>Причина:</strong> {{ a.cause }} <strong>Последствия:</strong> {{ a.impact }}
            </div>
            <div class="text-body-2">
              <strong>Инструмент:</strong> {{ FIX_TOOL_LABELS[a.fix_tool] || a.fix_tool }}
              <ol
                v-if="a.fix_steps.length"
                class="pl-4"
              >
                <li
                  v-for="(s, i) in a.fix_steps"
                  :key="i"
                >
                  {{ s }}
                </li>
              </ol>
            </div>
          </div>
          <ul
            v-if="advice.advice.notes.length"
            class="pl-4 text-body-2 mt-1"
          >
            <li
              v-for="(n, i) in advice.advice.notes"
              :key="i"
            >
              {{ n }}
            </li>
          </ul>
        </div>

        <div
          v-if="issues"
          class="mt-3"
        >
          <div class="d-flex align-center ga-2">
            <span class="font-weight-medium">{{ issues.label }}</span>
            <span class="text-caption text-medium-emphasis">{{ issues.total.toLocaleString('ru-RU') }} записей</span>
            <v-spacer />
            <v-btn
              v-if="hasCoords"
              size="x-small"
              variant="tonal"
              :color="overlayShown ? 'teal-darken-3' : undefined"
              @click="overlayShown ? clearOverlay() : showOverlay()"
            >
              {{ overlayShown ? 'Скрыть точки' : 'Точки на карте' }}
            </v-btn>
          </div>
          <v-table
            density="compact"
            class="dq__issues"
          >
            <thead>
              <tr>
                <th>ID</th>
                <th>Объект</th>
                <th>Фрагмент</th>
                <th class="text-right">
                  Значение
                </th>
                <th>Подробности</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="it in issues.items"
                :key="`${it.id}-${it.kind ?? ''}`"
                class="dq__issue"
                @click="locate(it)"
              >
                <td>{{ it.id }}</td>
                <td>{{ it.name || it.node1 || '—' }}<span v-if="it.node2"> — {{ it.node2 }}</span></td>
                <td>{{ it.fragment_id ?? '—' }}</td>
                <td class="text-right">
                  {{ fmt(it.value) }}
                </td>
                <td class="text-caption text-medium-emphasis">
                  {{ details(it) }}
                </td>
              </tr>
            </tbody>
          </v-table>
          <div
            v-if="issues.total > issues.items.length"
            class="text-caption mt-1"
          >
            Показано {{ issues.items.length }} из {{ issues.total }}
          </div>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { useOverlayLayer } from '~/composables/useOverlayLayer';
import { useDialogMapOverlay } from '~/composables/useDialogMapOverlay';
import { useAuthStore } from '~/stores/authStore';
import { useFragmentStore } from '~/stores/fragmentStore';
import { useMapStore } from '~/stores/mapStore';
import { formatApiErrorWith } from '~/utils/apiError';
import {
  dataQualityService,
  type DqAdvice,
  type DqIssue,
  type DqIssues,
  type DqRuleSummary,
  type DqSummary,
} from '~/services/dataQualityService';
import HintTip from '~/components/HintTip.vue';

/**
 * Качество исходных данных: сводка по правилам (сервер считает на лету), список записей правила,
 * точки на карте, объяснение и шаги исправления от помощника ИИ.
 */
const visible = ref(false);
const authStore = useAuthStore();
const mapStore = useMapStore();
const fragmentStore = useFragmentStore();

const SEVERITY_COLORS = { error: 'red-darken-2', warning: 'amber-darken-2', info: 'grey' } as const;
const SEVERITY_LABELS = { error: 'ошибка', warning: 'предупр.', info: 'справ.' } as const;
const FIX_TOOL_LABELS: Record<string, string> = {
  card: 'Карточка объекта', group_setters: 'Групповые установщики', topology: 'Редактор / диагностика топологии',
  alseko: 'АЛСЕКО: сверка и привязка', import: 'Импорт из файла',
};

const summary = ref<DqSummary | null>(null);
const issues = ref<DqIssues | null>(null);
const advice = ref<DqAdvice | null>(null);
const activeRule = ref<string | null>(null);
const onlyVisibleFragment = ref(false);
const loading = ref(false);
const explaining = ref(false);
const error = ref('');

const visibleFragmentId = computed(() => {
  const ids = fragmentStore.visibleFragments ?? [];
  return ids.length === 1 ? ids[0] : null;
});
const fragmentParam = () => (onlyVisibleFragment.value && visibleFragmentId.value != null ? visibleFragmentId.value : undefined);
const hasCoords = computed(() => Boolean(issues.value?.items.some((i) => i.longitude != null && i.latitude != null)));

const overlay = useOverlayLayer(() => mapStore.map, 'data-quality');
const dialogOverlay = useDialogMapOverlay(visible, () => overlay.clear());
const overlayShown = computed(() => dialogOverlay.shown.value);

const fmt = (v: unknown): string => (typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('ru-RU', { maximumFractionDigits: 2 }) : '—');
const ruleLabel = (rule: string) => summary.value?.items.find((r) => r.rule === rule)?.label || rule;
const details = (it: DqIssue): string => {
  const skip = new Set(['id', 'name', 'node1', 'node2', 'fragment_id', 'value', 'longitude', 'latitude']);
  return Object.entries(it)
    .filter(([k, v]) => !skip.has(k) && v != null && v !== '')
    .map(([k, v]) => `${k}: ${typeof v === 'number' ? fmt(v) : String(v)}`)
    .join('; ');
};

const reload = async () => {
  loading.value = true;
  error.value = '';
  issues.value = null;
  activeRule.value = null;
  try {
    summary.value = await dataQualityService.summary(fragmentParam());
  } catch (err) {
    error.value = formatApiErrorWith('Проверки не выполнены', err);
  } finally {
    loading.value = false;
  }
};

const openRule = async (r: DqRuleSummary) => {
  if (r.count == null) return;
  activeRule.value = r.rule;
  error.value = '';
  try {
    issues.value = await dataQualityService.issues(r.rule, { fragment_id: fragmentParam(), limit: 200 });
    if (overlayShown.value) await showOverlay();
  } catch (err) {
    error.value = formatApiErrorWith('Список не загружен', err);
  }
};

const showOverlay = async () => {
  if (!activeRule.value) return;
  try {
    const geojson = await dataQualityService.geojson(activeRule.value, { fragment_id: fragmentParam() });
    const color = issues.value?.severity === 'error' ? '#c62828' : issues.value?.severity === 'warning' ? '#ff8f00' : '#607d8b';
    const ok = overlay.show(geojson, [{
      id: 'data-quality-points',
      type: 'circle',
      paint: { 'circle-radius': 6, 'circle-color': color, 'circle-opacity': 0.8, 'circle-stroke-width': 1.5, 'circle-stroke-color': '#ffffff' },
    }]);
    if (ok) dialogOverlay.markShown();
  } catch (err) {
    error.value = formatApiErrorWith('Точки не построены', err);
  }
};

const clearOverlay = () => {
  overlay.clear();
  dialogOverlay.markCleared();
};

const locate = (it: DqIssue) => {
  if (it.longitude == null || it.latitude == null) return;
  mapStore.map?.flyTo?.({ center: [Number(it.longitude), Number(it.latitude)], zoom: 17 });
};

const explain = async () => {
  explaining.value = true;
  error.value = '';
  try {
    advice.value = await dataQualityService.explain(fragmentParam());
    summary.value = advice.value.summary;
  } catch (err) {
    error.value = formatApiErrorWith('Помощник ИИ не ответил', err);
  } finally {
    explaining.value = false;
  }
};

const open = async () => {
  visible.value = true;
  advice.value = null;
  await reload();
};

onBeforeUnmount(() => overlay.clear());
defineExpose({ open, openDialog: open, close: () => { visible.value = false; } });
</script>

<style scoped>
.dq__rule,
.dq__issue {
  cursor: pointer;
}
.dq__rule--active {
  background: rgba(var(--v-theme-primary), 0.08);
}
.dq__advice {
  padding: 8px 10px;
  border: 1px solid rgba(var(--v-theme-primary), 0.35);
  border-radius: 6px;
  background: rgba(var(--v-theme-primary), 0.04);
}
.dq__advice-rule {
  margin-top: 6px;
}
.dq__issues td {
  white-space: nowrap;
}
.dq__issues td:last-child {
  white-space: normal;
}
</style>
