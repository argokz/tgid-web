<template>
  <v-dialog
    v-model="open"
    max-width="600"
    persistent
  >
    <v-card rounded="lg">
      <v-card-title class="d-flex align-center bg-primary text-white pa-3">
        <v-icon class="me-2">mdi-content-cut</v-icon>
        <span class="text-subtitle-1">Разрезать участок {{ lineId }}?</span>
      </v-card-title>

      <v-card-text class="pa-4">
        <div
          v-if="loading"
          class="d-flex align-center justify-center py-6"
        >
          <v-progress-circular
            indeterminate
            color="primary"
            size="32"
          />
          <span class="ms-3 text-body-2">Проверка зависимостей…</span>
        </div>

        <template v-else-if="report">
          <p class="text-body-2 mb-3">
            Будет создан новый узел и вторая половина участка.
            Паспорт трубы клонируется автоматически.
          </p>

          <!-- Автоматически переносится -->
          <div class="mb-3">
            <div class="d-flex align-center mb-1">
              <v-icon
                size="18"
                color="success"
                class="me-1"
              >mdi-arrow-right-bold</v-icon>
              <span class="text-caption font-weight-bold text-uppercase">Перенос на новую половину</span>
            </div>
            <template v-if="movedList.length">
              <v-chip
                v-for="row in movedList"
                :key="row.table"
                size="small"
                color="success"
                variant="tonal"
                class="me-1 mb-1"
              >
                {{ tableLabel(row.table) }}: {{ row.count }}
              </v-chip>
            </template>
            <div
              v-else
              class="text-caption text-medium-emphasis"
            >
              Нет объектов для автоматического переноса
            </div>
          </div>

          <!-- Решение оператора: оборудование без узла и позиции (B2) -->
          <div
            v-if="reviewItems.length"
            class="mb-2"
          >
            <div class="d-flex align-center mb-1">
              <v-icon
                size="18"
                color="warning"
                class="me-1"
              >mdi-hand-back-right</v-icon>
              <span class="text-caption font-weight-bold text-uppercase">Выберите половину</span>
            </div>
            <v-alert
              type="warning"
              variant="tonal"
              density="compact"
              class="mb-2"
            >
              У этого оборудования нет узла установки и положения на участке — система
              не угадывает. Укажите для каждого объекта, на какой половине он окажется:
              первая — от начала участка до точки разреза, вторая — от точки разреза до конца.
            </v-alert>
            <div class="d-flex ga-2 mb-2">
              <v-btn
                size="x-small"
                variant="outlined"
                @click="setAll('first')"
              >Все на первую</v-btn>
              <v-btn
                size="x-small"
                variant="outlined"
                @click="setAll('second')"
              >Все на вторую</v-btn>
            </div>
            <div
              v-for="item in reviewItems"
              :key="item.key"
              class="d-flex align-center justify-space-between py-1 review-row"
            >
              <div class="text-body-2 me-2">
                <span class="text-medium-emphasis">{{ tableLabel(item.table) }}</span>
                {{ item.label }}
              </div>
              <v-btn-toggle
                v-model="decisions[item.key]"
                density="compact"
                variant="outlined"
                divided
                color="primary"
              >
                <v-btn
                  value="first"
                  size="small"
                >1-я</v-btn>
                <v-btn
                  value="second"
                  size="small"
                >2-я</v-btn>
              </v-btn-toggle>
            </div>
            <div
              v-if="undecided"
              class="text-caption text-warning mt-1"
            >
              Не выбрано: {{ undecided }}
            </div>
          </div>
          <div
            v-else-if="reviewList.length"
            class="mb-2"
          >
            <v-chip
              v-for="row in reviewList"
              :key="row.table"
              size="small"
              color="warning"
              variant="tonal"
              class="me-1 mb-1"
            >
              {{ tableLabel(row.table) }}: {{ row.count }}
            </v-chip>
          </div>

          <div
            v-if="!movedList.length && !reviewList.length"
            class="text-caption text-medium-emphasis"
          >
            На участке нет зависимого оборудования — разрезание безопасно.
          </div>
        </template>

        <v-alert
          v-else-if="error"
          type="error"
          variant="tonal"
          density="compact"
        >
          {{ error }}
        </v-alert>
      </v-card-text>

      <v-divider />
      <v-card-actions class="pa-3">
        <v-spacer />
        <v-btn
          variant="text"
          :disabled="confirming"
          @click="onCancel"
        >Отмена</v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :loading="confirming"
          :disabled="loading || !!error || undecided > 0"
          @click="onConfirm"
        >
          Разрезать
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import type { SplitReviewDecision, SplitTransferReport } from '~/services/fastApiService';
import { reviewItemLabel, topologyTableLabel } from '~/utils/topologyLabels';

const open = defineModel<boolean>({ default: false });
const props = defineProps<{
  lineId: number | null;
  report: SplitTransferReport | null;
  loading: boolean;
  confirming: boolean;
  error: string | null;
}>();
const emit = defineEmits<{ confirm: [reviewToNew: SplitReviewDecision]; cancel: [] }>();

const tableLabel = topologyTableLabel;

const toList = (rec: Record<string, number> | undefined) =>
  Object.entries(rec || {})
    .filter(([, n]) => n > 0)
    .map(([table, count]) => ({ table, count }));

const movedList = computed(() => toList(props.report?.moved));
const reviewList = computed(() => toList(props.report?.review));

/** Объекты «на выбор» поштучно; решение по каждому — «first» | «second» */
const reviewItems = computed(() =>
  Object.entries(props.report?.review_items || {}).flatMap(([table, items]) =>
    items.map((item) => ({ key: `${table}:${item.id}`, table, id: item.id, label: reviewItemLabel(item) }))
  )
);
const decisions = reactive<Record<string, 'first' | 'second' | undefined>>({});
watch(reviewItems, (items) => {
  for (const k of Object.keys(decisions)) delete decisions[k];
  for (const item of items) decisions[item.key] = undefined;
}, { immediate: true });
const undecided = computed(() => reviewItems.value.filter((i) => !decisions[i.key]).length);
const setAll = (half: 'first' | 'second') => {
  for (const item of reviewItems.value) decisions[item.key] = half;
};

const onConfirm = () => {
  const toNew: SplitReviewDecision = {};
  for (const item of reviewItems.value) {
    if (decisions[item.key] === 'second') (toNew[item.table] ||= []).push(item.id);
  }
  emit('confirm', toNew);
};
const onCancel = () => {
  open.value = false;
  emit('cancel');
};
</script>

<style scoped>
.review-row + .review-row {
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>
