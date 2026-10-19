<template>
  <!-- Отводы по геометрии участка → «Местные сопротивления» паспорта (предпросмотр и запись) -->
  <v-dialog
    v-model="open"
    max-width="720"
    scrollable
  >
    <v-card rounded="lg">
      <v-card-title class="d-flex align-center bg-primary text-white pa-3">
        <v-icon class="me-2">
          mdi-vector-polyline
        </v-icon>
        <span class="text-subtitle-1">Отводы → местные сопротивления: уч. {{ lineId }}</span>
      </v-card-title>

      <v-card-text class="pa-4">
        <div
          v-if="loading"
          class="d-flex align-center justify-center py-6"
        >
          <v-progress-circular
            indeterminate
            color="primary"
            size="28"
          />
        </div>

        <template v-else-if="data">
          <v-alert
            v-if="error"
            type="error"
            variant="tonal"
            density="compact"
            class="mb-3"
          >
            {{ error }}
          </v-alert>

          <div
            v-if="!data.has_shape"
            class="text-body-2"
          >
            У участка нет геометрии на карте — отводы не определить.
          </div>
          <template v-else>
            <div class="text-body-2 mb-2">
              Поворотов трассы: <b>{{ data.bends.length }}</b>
              <span class="text-caption text-medium-emphasis">
                (не считаются изломы меньше {{ data.thresholds.min_angle_deg }}° и вершины ближе
                {{ String(data.thresholds.min_segment_m).replace('.', ',') }} м)
              </span>
            </div>
            <div
              v-if="data.bends.length"
              class="d-flex flex-wrap ga-1 mb-3"
            >
              <v-chip
                v-for="b in data.bends"
                :key="b.vertex"
                size="small"
                variant="tonal"
              >
                в. {{ b.vertex + 1 }}: {{ String(b.angle).replace('.', ',') }}° → {{ classTitle(b.cls) }}{{ b.count > 1 ? ` ×${b.count}` : '' }}
              </v-chip>
            </div>

            <template v-if="usedClasses.length">
              <div class="text-subtitle-2 mb-1">
                Вид отвода
              </div>
              <div
                v-for="c in usedClasses"
                :key="c.cls"
                class="d-flex align-center ga-2 mb-2"
              >
                <span class="text-body-2 bend-cls">{{ c.title }} × {{ c.count }}</span>
                <v-select
                  v-model="choice[c.cls]"
                  :items="c.options"
                  item-title="name"
                  item-value="id"
                  density="compact"
                  variant="outlined"
                  hide-details
                  :disabled="saving"
                >
                  <template #item="{ props: p, item }">
                    <v-list-item
                      v-bind="p"
                      :subtitle="`ζ = ${formatCoef(item.raw.v)}`"
                    />
                  </template>
                </v-select>
              </div>

              <v-radio-group
                v-model="mode"
                density="compact"
                hide-details
                :disabled="saving"
              >
                <v-radio
                  value="missing"
                  label="Добавить недостающие отводы (уже записанные отводы остаются)"
                />
                <v-radio
                  value="replace"
                  label="Заменить отводы в списке посчитанными по трассе"
                />
              </v-radio-group>
              <v-checkbox
                v-if="anyUnlisted"
                v-model="keepUnlisted"
                density="compact"
                hide-details
                :disabled="saving"
                label="Сохранить часть суммы, не расписанную по видам (введена без списка)"
              />
            </template>

            <div
              v-for="p in plans"
              :key="p.passport.id"
              class="mt-3"
            >
              <div class="d-flex align-center ga-2">
                <v-checkbox-btn
                  v-if="plans.length > 1"
                  v-model="selected"
                  :value="p.passport.id"
                  density="compact"
                  :disabled="saving"
                />
                <span class="text-subtitle-2">
                  Паспорт уч. {{ p.passport.line_id }}{{ p.passport.line_id === data.pair_line_id ? ' (парная труба)' : '' }}
                </span>
                <v-spacer />
                <span class="text-body-2">
                  Σζ: {{ formatCoef(p.beforeSum) }} → <b>{{ formatCoef(p.afterSum) }}</b>
                </span>
              </div>
              <v-table
                density="compact"
                class="bend-table"
              >
                <tbody>
                  <tr
                    v-for="r in p.after"
                    :key="r.id"
                    :class="{ 'bend-added': r.added }"
                  >
                    <td>{{ r.name }}</td>
                    <td class="text-right">
                      {{ r.k }}{{ r.added ? ` (+${r.added})` : '' }}
                    </td>
                    <td class="text-right">
                      ζ {{ formatCoef(r.v) }}
                    </td>
                  </tr>
                  <tr v-if="p.unlisted && keepUnlisted">
                    <td class="text-medium-emphasis">
                      Не расписано по видам
                    </td>
                    <td />
                    <td class="text-right">
                      {{ formatCoef(p.unlisted) }}
                    </td>
                  </tr>
                  <tr v-if="!p.after.length && !(p.unlisted && keepUnlisted)">
                    <td
                      colspan="3"
                      class="text-medium-emphasis"
                    >
                      Список пуст
                    </td>
                  </tr>
                </tbody>
              </v-table>
              <div
                v-if="!p.changed"
                class="text-caption text-medium-emphasis"
              >
                Без изменений
              </div>
            </div>
          </template>
        </template>
      </v-card-text>

      <v-card-actions class="pa-3">
        <v-spacer />
        <v-btn
          variant="text"
          @click="open = false"
        >
          Закрыть
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :disabled="!toSave.length"
          :loading="saving"
          @click="save"
        >
          Записать в паспорт
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { fastApiService } from '~/services/fastApiService';
import { formatApiError } from '~/utils/apiError';
import {
  bendChanges,
  formatCoef,
  planBendResistances,
  type BendMode,
  type LineBendsData,
} from '~/utils/bends';

const open = defineModel<boolean>({ default: false });
const props = defineProps<{ lineId: number }>();
const emit = defineEmits<{ saved: [changed: number] }>();

const data = ref<LineBendsData | null>(null);
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const choice = reactive<Record<number, number>>({});
const mode = ref<BendMode>('missing');
const keepUnlisted = ref(true);
const selected = ref<number[]>([]);

const classTitle = (cls: number) => data.value?.classes.find((c) => c.cls === cls)?.title ?? `${cls}°`;
const usedClasses = computed(() => data.value?.classes.filter((c) => c.count > 0) ?? []);
const plans = computed(() => {
  const d = data.value;
  if (!d) return [];
  return d.passports.map((p) => planBendResistances(d, p, choice, mode.value, keepUnlisted.value));
});
const anyUnlisted = computed(() => plans.value.some((p) => p.unlisted > 0));
const toSave = computed(() => plans.value.filter((p) => p.changed && selected.value.includes(p.passport.id)));

const load = async () => {
  loading.value = true;
  error.value = null;
  try {
    const d = await fastApiService.getLineBends(props.lineId);
    for (const c of d.classes) choice[c.cls] = c.default;
    // парная труба — та же трасса: по умолчанию записывается вместе
    selected.value = d.passports.map((p) => p.id);
    data.value = d;
  } catch (err) {
    error.value = formatApiError(err, 'Не удалось посчитать отводы');
  } finally {
    loading.value = false;
  }
};

watch(open, (v) => { if (v) void load(); }, { immediate: true });

const save = async () => {
  const body = bendChanges(toSave.value);
  if (!body.changes.length) return;
  saving.value = true;
  error.value = null;
  try {
    const res = await fastApiService.saveCardEdit(body);
    emit('saved', res.rows.reduce((n, r) => n + Object.keys(r.changed ?? {}).length, 0));
    open.value = false;
  } catch (err) {
    const msg = formatApiError(err, 'Не удалось записать местные сопротивления');
    // версия паспорта устарела (409) — пересчитать по свежим данным
    if ((err as { status?: number })?.status === 409) await load();
    error.value = msg;
  } finally {
    saving.value = false;
  }
};
</script>

<style scoped>
.bend-cls {
  width: 80px;
  flex: 0 0 auto;
}
.bend-table td {
  font-size: 13px;
}
.bend-added td {
  font-weight: 600;
}
</style>
