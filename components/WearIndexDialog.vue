<template>
  <v-dialog
    v-model="visible"
    max-width="1100"
    scrollable
  >
    <v-card rounded="lg">
      <v-card-title class="d-flex align-center ga-2 px-4 py-3">
        <v-icon color="brown-darken-2">
          mdiPipeWrench
        </v-icon>
        <div class="flex-grow-1">
          <div class="text-subtitle-1 font-weight-bold">
            Износ участков и план ремонтов
          </div>
          <div class="text-caption text-medium-emphasis">
            Методика десктопа ТГИД (8 факторов, баллы 1–5); приоритет = износ × последствия × расход
          </div>
        </div>
        <v-btn
          v-if="authStore.canCalculate"
          color="brown-darken-2"
          variant="flat"
          :loading="calculating"
          title="Рассчитать износ по всей сети (или по выбранным фрагментам карты)"
          @click="calculate"
        >
          Рассчитать
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
        <div class="d-flex flex-wrap ga-2 align-center">
          <AppSelect
            v-model="calculationId"
            :items="runItems"
            item-title="title"
            item-value="id"
            label="Расчёт износа"
            class="wear__run"
            :clearable="false"
            @update:model-value="load"
          />
          <AppSelect
            v-model="order"
            :items="orderItems"
            label="Сортировка"
            class="wear__order"
            :clearable="false"
            @update:model-value="loadSections"
          />
          <AppSelect
            v-model="minCategory"
            :items="categoryItems"
            label="Категория от"
            class="wear__order"
            @update:model-value="loadSections"
          />
          <v-switch
            v-model="onlyVisibleFragments"
            density="compact"
            hide-details
            label="Только видимые фрагменты"
            @update:model-value="loadSections"
          />
          <v-spacer />
          <v-btn
            size="small"
            variant="tonal"
            :disabled="!calculationId"
            :color="overlayShown ? 'brown-darken-2' : undefined"
            @click="overlayShown ? clearOverlay() : showOverlay()"
          >
            {{ overlayShown ? 'Скрыть слой' : 'Слой износа на карте' }}
          </v-btn>
          <v-btn
            v-if="authStore.canUseAi"
            size="small"
            color="primary"
            variant="tonal"
            :disabled="!calculationId"
            :loading="planning"
            @click="makePlan"
          >
            <v-icon
              size="small"
              class="mr-1"
            >
              mdiCreation
            </v-icon>
            Записка к плану
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
          v-if="progress"
          class="text-caption mt-2"
        >
          {{ progress }}
        </div>

        <div
          v-if="summary?.calculation_id"
          class="wear__summary mt-3"
        >
          <div class="d-flex flex-wrap ga-4">
            <div><strong>Участков:</strong> {{ summary.lines }}</div>
            <div><strong>Средний износ:</strong> {{ fmt(summary.avg_wear, 1) }} %</div>
            <div><strong>Без даты прокладки:</strong> {{ summary.no_date }}</div>
            <div><strong>С повреждениями:</strong> {{ summary.with_defects }}</div>
            <div><strong>С расходом по расчёту:</strong> {{ summary.with_flow }}</div>
          </div>
          <div class="d-flex flex-wrap ga-2 mt-2">
            <v-chip
              v-for="c in categories"
              :key="c.id"
              size="small"
              :color="CATEGORY_COLORS[c.id]"
              variant="flat"
              :title="c.label"
            >
              {{ c.id }}: {{ c.count }}
            </v-chip>
          </div>
          <div
            v-if="filledNote"
            class="text-caption text-medium-emphasis mt-1"
          >
            {{ filledNote }}
          </div>
        </div>
        <div
          v-else-if="summary && !summary.calculation_id"
          class="text-body-2 mt-3"
        >
          Расчёт износа ещё не выполнялся — нажмите «Рассчитать».
        </div>

        <div
          v-if="plan"
          class="wear__plan mt-3"
        >
          <div class="font-weight-bold mb-1">
            <v-icon
              size="16"
              color="primary"
              class="mr-1"
            >
              mdiCreation
            </v-icon>
            Пояснительная записка помощника
          </div>
          <p class="mb-2">
            {{ plan.plan.summary }}
          </p>
          <div
            v-for="(g, i) in plan.plan.groups"
            :key="i"
            class="wear__group"
          >
            <div class="font-weight-medium">
              {{ g.title }}
              <v-chip
                size="x-small"
                :color="URGENCY_COLORS[g.urgency]"
                variant="flat"
                class="ml-1"
              >
                {{ URGENCY_LABELS[g.urgency] }}
              </v-chip>
            </div>
            <div class="text-body-2">
              {{ g.reason }} <strong>Действие:</strong> {{ g.recommended_action }}
            </div>
            <div class="mt-1">
              <v-chip
                v-for="id in g.line_ids.slice(0, 12)"
                :key="id"
                size="x-small"
                variant="outlined"
                class="mr-1 mb-1"
                @click="locateLine(id)"
              >
                участок {{ id }}
              </v-chip>
              <span
                v-if="g.line_ids.length > 12"
                class="text-caption"
              >… ещё {{ g.line_ids.length - 12 }}</span>
            </div>
          </div>
          <div
            v-if="plan.plan.data_quality.length"
            class="text-body-2 mt-2"
          >
            <strong>Данные:</strong>
            <ul class="pl-4">
              <li
                v-for="(d, i) in plan.plan.data_quality"
                :key="i"
              >
                {{ d }}
              </li>
            </ul>
          </div>
          <div
            v-if="plan.plan.next_steps.length"
            class="text-body-2 mt-1"
          >
            <strong>Шаги:</strong>
            <ol class="pl-4">
              <li
                v-for="(s, i) in plan.plan.next_steps"
                :key="i"
              >
                {{ s }}
              </li>
            </ol>
          </div>
        </div>

        <v-table
          v-if="sections.length"
          density="compact"
          class="mt-3 wear__table"
        >
          <thead>
            <tr>
              <th>Участок</th>
              <th>Фрагмент</th>
              <th class="text-right">
                Ø, мм
              </th>
              <th class="text-right">
                L, м
              </th>
              <th class="text-right">
                Срок, лет
              </th>
              <th class="text-right">
                Повр.
              </th>
              <th class="text-right">
                Факторов
              </th>
              <th class="text-right">
                Износ, %
              </th>
              <th>Кат.</th>
              <th class="text-right">
                Расход, т/ч
              </th>
              <th class="text-right">
                Приоритет
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="s in sections"
              :key="s.lineid"
              class="wear__row"
              :title="`Баллы: срок ${s.srok_ball ?? '—'}, повреждаемость ${s.koef_povr_ball ?? '—'}, вид ${s.vnesniivid}, оборудование ${s.sostoborudovania}, категория ${s.kategorii}, коррозия ${s.vnesnkorrozia}/${s.vnunrenkorrozia}, конструкции ${s.sostkonstrukz}`"
              @click="locateLine(s.lineid)"
            >
              <td>{{ s.node1 || '?' }} — {{ s.node2 || '?' }} <span class="text-caption text-medium-emphasis">#{{ s.lineid }}</span></td>
              <td>{{ s.fragment_name || s.fileid || '—' }}</td>
              <td class="text-right">
                {{ fmt(s.diameter, 0) }}
              </td>
              <td class="text-right">
                {{ fmt(s.length_m, 0) }}
              </td>
              <td class="text-right">
                {{ fmt(s.age_years, 1) }}
              </td>
              <td class="text-right">
                {{ s.n_defects }}
              </td>
              <td class="text-right">
                {{ s.factors_filled }}/8
              </td>
              <td class="text-right">
                {{ fmt(s.wear_pct_known, 1) }}
              </td>
              <td>
                <v-chip
                  v-if="s.category"
                  size="x-small"
                  :color="CATEGORY_COLORS[s.category]"
                  variant="flat"
                >
                  {{ s.category }}
                </v-chip>
              </td>
              <td class="text-right">
                {{ fmt(s.flow_t_h, 0) }}
              </td>
              <td class="text-right">
                {{ fmt(s.priority, 3) }}
              </td>
            </tr>
          </tbody>
        </v-table>
        <div
          v-if="total > sections.length"
          class="text-caption mt-1"
        >
          Показано {{ sections.length }} из {{ total }}
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import AppSelect from '~/components/AppSelect.vue';
import { computed, onBeforeUnmount, ref } from 'vue';
import { useOverlayLayer } from '~/composables/useOverlayLayer';
import { useDialogMapOverlay } from '~/composables/useDialogMapOverlay';
import { useAuthStore } from '~/stores/authStore';
import { useFragmentStore } from '~/stores/fragmentStore';
import { useMapStore } from '~/stores/mapStore';
import { useNotificationStore } from '~/stores/notificationStore';
import { formatApiErrorWith } from '~/utils/apiError';
import { wearService, type WearOrder, type WearPlan, type WearSection, type WearSummary } from '~/services/wearService';
import { fastApiService } from '~/services/fastApiService';
import HintTip from '~/components/HintTip.vue';

/**
 * Износ участков (формула gid6 tgid_iznos.sql) и приоритет ремонта: запуск расчёта (Celery),
 * сводка по категориям, таблица участков, тематический слой на карте, записка помощника ИИ.
 */
const visible = ref(false);
const authStore = useAuthStore();
const mapStore = useMapStore();
const fragmentStore = useFragmentStore();
const notify = useNotificationStore();

const CATEGORY_COLORS: Record<number, string> = { 1: 'green', 2: 'light-green-darken-1', 3: 'amber-darken-2', 4: 'deep-orange', 5: 'red-darken-2' };
const CATEGORY_HEX: Record<number, string> = { 1: '#43a047', 2: '#7cb342', 3: '#ffa000', 4: '#f4511e', 5: '#c62828' };
const URGENCY_LABELS: Record<number, string> = { 1: 'в этот сезон', 2: 'в следующий сезон', 3: 'наблюдение' };
const URGENCY_COLORS: Record<number, string> = { 1: 'red-darken-2', 2: 'amber-darken-2', 3: 'grey' };

const runs = ref<Array<{ id: number; title: string }>>([]);
const calculationId = ref<number | null>(null);
const summary = ref<WearSummary | null>(null);
const sections = ref<WearSection[]>([]);
const total = ref(0);
const order = ref<WearOrder>('priority');
const minCategory = ref<number | null>(null);
const onlyVisibleFragments = ref(false);
const plan = ref<WearPlan | null>(null);
const error = ref('');
const progress = ref('');
const calculating = ref(false);
const planning = ref(false);

const orderItems = [
  { title: 'По приоритету', value: 'priority' },
  { title: 'По износу', value: 'wear' },
  { title: 'По сроку', value: 'age' },
  { title: 'По повреждениям', value: 'defects' },
];
const categoryItems = [1, 2, 3, 4, 5].map((c) => ({ title: `${c}`, value: c }));
const runItems = computed(() => runs.value);
const categories = computed(() => {
  const by = summary.value?.by_category ?? {};
  const labels = summary.value?.category_labels ?? {};
  return [1, 2, 3, 4, 5].map((id) => ({ id, count: by[String(id)] ?? 0, label: labels[String(id)] ?? '' }));
});
const filledNote = computed(() => {
  const f = summary.value?.factors_filled;
  if (!f) return '';
  return 'Заполнено факторов из 8 → участков: ' + Object.entries(f).map(([k, v]) => `${k}: ${v}`).join(', ');
});

const fmt = (v: number | null | undefined, digits: number): string =>
  v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('ru-RU', { maximumFractionDigits: digits });

// Тематический слой: линии по категории износа
const overlay = useOverlayLayer(() => mapStore.map, 'wear-index');
const dialogOverlay = useDialogMapOverlay(visible, () => overlay.clear());
const overlayShown = computed(() => dialogOverlay.shown.value);

const fragmentFilter = () => {
  if (!onlyVisibleFragments.value) return undefined;
  const ids = fragmentStore.visibleFragments ?? [];
  return ids.length === 1 ? ids[0] : undefined;
};

const loadRuns = async () => {
  const { items } = await wearService.runs();
  runs.value = items.map((r) => ({
    id: r.id,
    title: `#${r.id} ${r.name || ''} — ${r.lines} уч., износ ${fmt(r.avg_wear, 1)} %`,
  }));
  if (!calculationId.value && items.length) calculationId.value = items[0].id;
};

const loadSections = async () => {
  if (!calculationId.value) {
    sections.value = [];
    total.value = 0;
    return;
  }
  const res = await wearService.sections(calculationId.value, {
    order: order.value, min_category: minCategory.value ?? undefined, fragment_id: fragmentFilter(), limit: 200,
  });
  sections.value = res.items;
  total.value = res.total;
};

const load = async () => {
  error.value = '';
  plan.value = null;
  try {
    if (!calculationId.value) {
      summary.value = await wearService.latest();
      calculationId.value = summary.value.calculation_id;
    } else {
      summary.value = await wearService.summary(calculationId.value);
    }
    await loadSections();
    if (overlayShown.value) await showOverlay();
  } catch (err) {
    error.value = formatApiErrorWith('Износ не загружен', err);
  }
};

const open = async () => {
  visible.value = true;
  try {
    await loadRuns();
    await load();
  } catch (err) {
    error.value = formatApiErrorWith('Износ не загружен', err);
  }
};

const POLL_MS = 2000;
const calculate = async () => {
  calculating.value = true;
  error.value = '';
  try {
    const ids = fragmentStore.visibleFragments ?? [];
    const body = onlyVisibleFragments.value && ids.length ? { fragment_ids: ids } : {};
    const { task_id } = await wearService.calculate(body);
    progress.value = 'Расчёт износа запущен…';
    for (let i = 0; i < 600; i += 1) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      const st = await wearService.taskStatus(task_id);
      if (st.status === 'SUCCESS') {
        const result = st.result as { status?: string; message?: string; error?: string; calculation_id?: number } | undefined;
        if (result?.status === 'error') throw new Error(result.error || result.message || 'ошибка расчёта');
        progress.value = '';
        notify.showSuccess(result?.message || 'Износ рассчитан');
        await loadRuns();
        calculationId.value = result?.calculation_id ?? calculationId.value;
        await load();
        return;
      }
      if (st.status === 'FAILURE') throw new Error(st.error || 'задача завершилась с ошибкой');
    }
    throw new Error('расчёт не завершился за отведённое время');
  } catch (err) {
    progress.value = '';
    error.value = formatApiErrorWith('Расчёт износа не выполнен', err);
  } finally {
    calculating.value = false;
  }
};

const showOverlay = async () => {
  if (!calculationId.value) return;
  try {
    const geojson = await wearService.geojson(calculationId.value, { min_category: minCategory.value ?? undefined, fragment_id: fragmentFilter() });
    const colorExpr: unknown[] = ['match', ['get', 'category']];
    for (const [cat, hex] of Object.entries(CATEGORY_HEX)) colorExpr.push(Number(cat), hex);
    colorExpr.push('#9e9e9e');
    const ok = overlay.show(geojson, [{
      id: 'wear-index-lines',
      type: 'line',
      paint: { 'line-color': colorExpr as any, 'line-width': 3, 'line-opacity': 0.85 },
    }]);
    if (ok) dialogOverlay.markShown();
  } catch (err) {
    error.value = formatApiErrorWith('Слой износа не построен', err);
  }
};

const clearOverlay = () => {
  overlay.clear();
  dialogOverlay.markCleared();
};

const makePlan = async () => {
  if (!calculationId.value) return;
  planning.value = true;
  error.value = '';
  try {
    plan.value = await wearService.plan({ calculation_id: calculationId.value, fragment_id: fragmentFilter() });
  } catch (err) {
    error.value = formatApiErrorWith('Помощник ИИ не ответил', err);
  } finally {
    planning.value = false;
  }
};

/** Перелёт к участку и подсветка (геометрия — как у объектов протокола расчёта) */
const locateLine = async (lineId: number) => {
  try {
    const loc = await fastApiService.locateProtocolObjects([{ kind: 'line', id: lineId, label: '' }]);
    const geometry = loc.lines[String(lineId)]?.geometry;
    const coords = geometry?.coordinates?.[0];
    if (!geometry || !coords) {
      notify.showWarning(`Нет геометрии участка ${lineId}`);
      return;
    }
    const first = Array.isArray(coords[0]) ? coords[0] : coords;
    mapStore.map?.flyTo?.({ center: first, zoom: 17 });
    mapStore.selectionTarget = { geometry };
  } catch (err) {
    notify.showWarning(formatApiErrorWith('Участок не найден', err));
  }
};

onBeforeUnmount(() => overlay.clear());

defineExpose({ open, openDialog: open, close: () => { visible.value = false; } });
</script>

<style scoped>
.wear__run {
  min-width: 320px;
  flex: 1 1 320px;
}
.wear__order {
  width: 180px;
  flex: 0 0 180px;
}
.wear__summary,
.wear__plan {
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(var(--v-theme-on-surface), 0.04);
}
.wear__plan {
  border: 1px solid rgba(var(--v-theme-primary), 0.35);
  background: rgba(var(--v-theme-primary), 0.04);
}
.wear__group {
  margin-top: 6px;
}
.wear__row {
  cursor: pointer;
}
.wear__table td {
  white-space: nowrap;
}
</style>
