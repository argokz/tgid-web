<template>
  <v-dialog v-model="open" max-width="520" persistent>
    <v-card rounded="lg">
      <v-card-title class="d-flex align-center bg-primary text-white pa-3">
        <v-icon class="me-2">mdi-content-cut</v-icon>
        <span class="text-subtitle-1">Разрезать участок {{ lineId }}?</span>
      </v-card-title>

      <v-card-text class="pa-4">
        <div v-if="loading" class="d-flex align-center justify-center py-6">
          <v-progress-circular indeterminate color="primary" size="32" />
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
              <v-icon size="18" color="success" class="me-1">mdi-arrow-right-bold</v-icon>
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
            <div v-else class="text-caption text-medium-emphasis">
              Нет объектов для автоматического переноса
            </div>
          </div>

          <!-- Требует ручной проверки -->
          <div v-if="reviewList.length" class="mb-2">
            <div class="d-flex align-center mb-1">
              <v-icon size="18" color="warning" class="me-1">mdi-hand-back-right</v-icon>
              <span class="text-caption font-weight-bold text-uppercase">Проверьте вручную</span>
            </div>
            <v-alert type="warning" variant="tonal" density="compact" class="mb-2">
              У этого оборудования нет узла установки — оно останется на первой
              половине. После разрезания проверьте, к какой половине оно относится.
            </v-alert>
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

          <div v-if="!movedList.length && !reviewList.length" class="text-caption text-medium-emphasis">
            На участке нет зависимого оборудования — разрезание безопасно.
          </div>
        </template>

        <v-alert v-else-if="error" type="error" variant="tonal" density="compact">
          {{ error }}
        </v-alert>
      </v-card-text>

      <v-divider />
      <v-card-actions class="pa-3">
        <v-spacer />
        <v-btn variant="text" :disabled="confirming" @click="onCancel">Отмена</v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :loading="confirming"
          :disabled="loading || !!error"
          @click="onConfirm"
        >
          Разрезать
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SplitTransferReport } from '~/services/fastApiService';

const open = defineModel<boolean>({ default: false });
const props = defineProps<{
  lineId: number | null;
  report: SplitTransferReport | null;
  loading: boolean;
  confirming: boolean;
  error: string | null;
}>();
const emit = defineEmits<{ confirm: []; cancel: [] }>();

const TABLE_LABELS: Record<string, string> = {
  pressregulators: 'Регуляторы давления',
  consumptregulators: 'Регуляторы расхода',
  pressdropregulators: 'Регуляторы перепада',
  dampers: 'Задвижки',
  diaphragms: 'Диафрагмы',
  elevators: 'Элеваторы',
  systemradiators: 'Радиаторы',
  pumps: 'Насосы',
  heatexchangers: 'Теплообменники',
  airheaters: 'Калориферы',
};

const tableLabel = (t: string) => TABLE_LABELS[t] || t;

const toList = (rec: Record<string, number> | undefined) =>
  Object.entries(rec || {})
    .filter(([, n]) => n > 0)
    .map(([table, count]) => ({ table, count }));

const movedList = computed(() => toList(props.report?.moved));
const reviewList = computed(() => toList(props.report?.review));

const onConfirm = () => emit('confirm');
const onCancel = () => {
  open.value = false;
  emit('cancel');
};
</script>
