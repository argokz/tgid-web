<template>
  <!-- Окно-помощник поля, как в десктопе: строка таблицы (сортамент труб, справочник) или местные сопротивления -->
  <v-dialog
    :model-value="modelValue"
    max-width="820"
    scrollable
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card class="chd">
      <v-card-title class="chd-title">
        <span>{{ helper?.title || 'Выбор значения' }}</span>
        <v-spacer />
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          aria-label="Закрыть"
          @click="emit('update:modelValue', false)"
        />
      </v-card-title>
      <div
        v-if="helper?.type === 'pick' && helper.subtitle && helper.subtitle !== helper.title"
        class="px-4 text-caption text-medium-emphasis"
      >{{ helper.subtitle }}</div>
      <v-divider />

      <v-card-text
        v-if="loading"
        class="chd-state"
      >
        <v-progress-circular
          indeterminate
          color="primary"
          size="28"
        />
      </v-card-text>
      <v-card-text
        v-else-if="error"
        class="chd-state text-error"
      >{{ error }}</v-card-text>

      <!-- Строка таблицы -->
      <template v-else-if="helper?.type === 'pick'">
        <div class="px-4 pt-3">
          <v-text-field
            v-model="search"
            density="compact"
            variant="outlined"
            hide-details
            clearable
            prepend-inner-icon="mdi-magnify"
            placeholder="Поиск"
            autofocus
          />
          <div
            v-if="helper.cell_pick"
            class="text-caption text-medium-emphasis mt-1"
          >Щелчок по строке — значение из выделенной колонки; по числу в строке — это число.</div>
        </div>
        <v-card-text class="chd-body">
          <table class="chd-table">
            <thead>
              <tr>
                <th
                  v-for="c in helper.columns"
                  :key="c.key"
                  :class="{ 'chd-th--ret': retColumns.has(c.key) }"
                >{{ c.title }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(r, ri) in filteredRows"
                :key="String(r.id ?? ri)"
                class="chd-tr"
                @click="pickRow(r)"
              >
                <td
                  v-for="c in helper.columns"
                  :key="c.key"
                  :class="{ 'chd-td--ret': retColumns.has(c.key), 'chd-td--num': typeof r[c.key] === 'number' }"
                  @click.stop="pickCell(r, c.key)"
                >{{ cellText(r[c.key]) }}</td>
              </tr>
              <tr v-if="!filteredRows.length">
                <td
                  :colspan="helper.columns.length"
                  class="text-medium-emphasis text-center py-4"
                >Нет строк</td>
              </tr>
            </tbody>
          </table>
        </v-card-text>
      </template>

      <!-- Местные сопротивления (MestSopr3): количество и коэффициент по видам, сумма -->
      <template v-else-if="helper?.type === 'mestn'">
        <div class="px-4 pt-3">
          <v-text-field
            v-model="search"
            density="compact"
            variant="outlined"
            hide-details
            clearable
            prepend-inner-icon="mdi-magnify"
            placeholder="Поиск"
          />
        </div>
        <v-card-text class="chd-body">
          <div class="chd-mrow chd-mrow--head">
            <span>Вид сопротивления</span>
            <span>Количество</span>
            <span>Коэффициент</span>
          </div>
          <div
            v-for="it in filteredMestn"
            :key="it.id"
            class="chd-mrow"
            :class="{ 'chd-mrow--off': !(mestn[it.id]?.k > 0) }"
          >
            <span class="chd-mname">{{ mestnName(it) }}</span>
            <v-text-field
              :model-value="mestn[it.id]?.k ?? 0"
              type="number"
              min="0"
              density="compact"
              variant="outlined"
              hide-details
              @update:model-value="setK(it, $event)"
            />
            <v-text-field
              :model-value="mestn[it.id]?.v ?? it.min"
              type="number"
              :min="it.min"
              :max="it.max"
              :step="0.01"
              density="compact"
              variant="outlined"
              hide-details
              :disabled="!(mestn[it.id]?.k > 0) || it.min === it.max"
              @update:model-value="setV(it, $event)"
            />
          </div>
        </v-card-text>
      </template>

      <v-divider />
      <v-card-actions>
        <span
          v-if="helper?.type === 'mestn'"
          class="text-body-2 ml-2"
        >Сумма коэффициентов местных сопротивлений: <b>{{ formatDesktopNumber(mestnTotal.sum) }}</b></span>
        <v-spacer />
        <v-btn
          variant="text"
          @click="emit('update:modelValue', false)"
        >Отмена</v-btn>
        <v-btn
          v-if="helper?.type === 'mestn'"
          color="primary"
          variant="flat"
          @click="applyMestn"
        >Ок</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { formatDesktopNumber } from '~/utils/desktopNumber';
import { mestnResult, parseMestn, type CardHelper, type CardHelperMestn } from '~/utils/objectCard';

const props = defineProps<{
  modelValue: boolean
  helper: CardHelper | null
  loading?: boolean
  error?: string
  /** текущее значение поля списка местных сопротивлений (mestn) */
  mestnText?: unknown
}>();
const emit = defineEmits<{
  'update:modelValue': [open: boolean]
  /** поле карточки → значение (в той же колонке) */
  apply: [values: Record<string, unknown>]
}>();

const search = ref('');
const needle = computed(() => (search.value || '').trim().toLowerCase());

// --- строка таблицы ---
const retColumns = computed(() => new Set(props.helper?.type === 'pick' ? Object.values(props.helper.set) : []));
const filteredRows = computed(() => {
  if (props.helper?.type !== 'pick') return [];
  const cols = props.helper.columns.map((c) => c.key);
  if (!needle.value) return props.helper.rows;
  return props.helper.rows.filter((r) => cols.some((c) => String(r[c] ?? '').toLowerCase().includes(needle.value)));
});
const cellText = (v: unknown) => (v === null || v === undefined ? '' : typeof v === 'number' ? formatDesktopNumber(v) : String(v));

const pickRow = (r: Record<string, unknown>) => {
  if (props.helper?.type !== 'pick') return;
  const values: Record<string, unknown> = {};
  for (const [field, col] of Object.entries(props.helper.set)) values[field] = r[col] ?? null;
  emit('apply', values);
  emit('update:modelValue', false);
};
const pickCell = (r: Record<string, unknown>, key: string) => {
  const h = props.helper;
  if (h?.type !== 'pick') return;
  const fields = Object.keys(h.set);
  if (h.cell_pick && fields.length === 1 && typeof r[key] === 'number') {
    emit('apply', { [fields[0]]: r[key] });
    emit('update:modelValue', false);
    return;
  }
  pickRow(r);
};

// --- местные сопротивления ---
const mestn = ref<Record<number, { k: number; v: number }>>({});
const mestnItems = computed(() => (props.helper?.type === 'mestn' ? props.helper.items : []));
const filteredMestn = computed(() => (needle.value
  ? mestnItems.value.filter((i) => i.name.toLowerCase().includes(needle.value))
  : mestnItems.value));
const mestnName = (it: CardHelperMestn['items'][number]) => (it.min === it.max ? `${it.name} ${it.min}` : `${it.name} ${it.min}-${it.max}`);

const initMestn = () => {
  const parsed = parseMestn(props.mestnText);
  const out: Record<number, { k: number; v: number }> = {};
  for (const it of mestnItems.value) {
    const p = parsed.get(it.id);
    out[it.id] = { k: p?.k ?? 0, v: p ? Math.min(Math.max(p.v, it.min), it.max) : it.min };
  }
  mestn.value = out;
};
const setK = (it: CardHelperMestn['items'][number], v: unknown) => {
  const k = Math.max(0, Math.trunc(Number(v) || 0));
  mestn.value = { ...mestn.value, [it.id]: { k, v: mestn.value[it.id]?.v ?? it.min } };
};
const setV = (it: CardHelperMestn['items'][number], v: unknown) => {
  const n = Number(String(v).replace(',', '.'));
  const val = Number.isFinite(n) ? Math.min(Math.max(n, it.min), it.max) : it.min;
  mestn.value = { ...mestn.value, [it.id]: { k: mestn.value[it.id]?.k ?? 0, v: val } };
};
const mestnTotal = computed(() => mestnResult(mestnItems.value.map((it) => ({ id: it.id, ...(mestn.value[it.id] ?? { k: 0, v: it.min }) }))));
const applyMestn = () => {
  const h = props.helper;
  if (h?.type !== 'mestn') return;
  emit('apply', { [h.set.sum]: mestnTotal.value.sum, [h.set.list]: mestnTotal.value.list || null });
  emit('update:modelValue', false);
};

watch(() => [props.modelValue, props.helper], () => {
  if (!props.modelValue) return;
  search.value = '';
  if (props.helper?.type === 'mestn') initMestn();
}, { immediate: true });
</script>

<style scoped>
.chd-title {
  display: flex;
  align-items: center;
  font-size: 16px;
}
.chd-state {
  padding: 32px 16px;
  text-align: center;
}
.chd-body {
  max-height: 60vh;
  padding-top: 8px;
}
.chd-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.chd-table th {
  position: sticky;
  top: 0;
  background: rgb(var(--v-theme-surface));
  text-align: left;
  font-weight: 600;
  font-size: 12px;
  padding: 6px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  vertical-align: bottom;
}
.chd-th--ret {
  color: rgb(var(--v-theme-primary));
}
.chd-table td {
  padding: 5px 6px;
  border-bottom: 1px solid rgba(var(--v-border-color), 0.08);
}
.chd-td--num {
  text-align: right;
  white-space: nowrap;
}
.chd-td--ret {
  font-weight: 600;
}
.chd-tr {
  cursor: pointer;
}
.chd-tr:hover {
  background: rgba(var(--v-theme-primary), 0.08);
}
.chd-mrow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 110px 120px;
  gap: 8px;
  align-items: center;
  padding: 3px 0;
}
.chd-mrow--head {
  font-size: 12px;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.chd-mrow--off .chd-mname {
  color: rgba(var(--v-theme-on-surface), 0.5);
}
.chd-mname {
  font-size: 13px;
}
@media (max-width: 600px) {
  .chd-mrow {
    grid-template-columns: minmax(0, 1fr) 76px 86px;
  }
}
</style>
