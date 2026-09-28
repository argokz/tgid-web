<template>
  <v-dialog
    v-model="open"
    max-width="560"
    persistent
  >
    <v-card rounded="lg">
      <v-card-title class="d-flex align-center bg-primary text-white pa-3">
        <v-icon class="me-2">mdi-call-merge</v-icon>
        <span class="text-subtitle-1">Слить узел {{ sourceId }} в узел {{ targetId }}?</span>
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
            Узел <strong>{{ sourceId }}</strong> будет удалён, всё, что на него ссылается, перейдёт
            на узел <strong>{{ targetId }}</strong>. Концы участков встанут в точку целевого узла
            <span v-if="report.distance_m != null">(расстояние между узлами {{ report.distance_m }} м)</span>.
          </p>

          <!-- Что блокирует -->
          <v-alert
            v-if="blockerLines.length"
            type="error"
            variant="tonal"
            density="compact"
            class="mb-3"
          >
            <div class="font-weight-bold mb-1">Слияние невозможно:</div>
            <div
              v-for="line in blockerLines"
              :key="line"
              class="text-caption"
            >{{ line }}</div>
          </v-alert>

          <!-- Перенос ссылок -->
          <div class="mb-3">
            <div class="d-flex align-center mb-1">
              <v-icon
                size="18"
                color="success"
                class="me-1"
              >mdi-arrow-right-bold</v-icon>
              <span class="text-caption font-weight-bold text-uppercase">Перенос на узел {{ targetId }}</span>
            </div>
            <template v-if="transferList.length">
              <v-chip
                v-for="row in transferList"
                :key="row.key"
                size="small"
                color="success"
                variant="tonal"
                class="me-1 mb-1"
              >
                {{ topologyRefLabel(row.key) }}: {{ row.count }}
              </v-chip>
            </template>
            <div
              v-else
              class="text-caption text-medium-emphasis"
            >На узле нет зависимых объектов</div>
          </div>

          <!-- Участки -->
          <div class="mb-3 text-body-2">
            <div v-if="report.relinked_lines.length">
              <v-icon
                size="16"
                class="me-1"
              >mdi-vector-polyline</v-icon>
              Перепривязываются участки: {{ report.relinked_lines.join(', ') }}
            </div>
            <div v-if="report.removed_lines.length">
              <v-icon
                size="16"
                color="warning"
                class="me-1"
              >mdi-delete</v-icon>
              Снимаются участки между узлами: {{ report.removed_lines.join(', ') }}
            </div>
          </div>

          <v-alert
            v-if="report.warnings?.parallel_lines_with?.length"
            type="warning"
            variant="tonal"
            density="compact"
            class="mb-2"
          >
            После слияния появятся параллельные участки к узлам:
            {{ report.warnings.parallel_lines_with.join(', ') }}
          </v-alert>

          <div
            v-if="resultsList.length"
            class="text-caption text-medium-emphasis"
          >
            Не переносятся (устареют до следующего расчёта):
            {{ resultsList.map((r) => `${topologyRefLabel(r.key)} ×${r.count}`).join(', ') }}
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
          :disabled="loading || !!error || !report || blockerLines.length > 0"
          @click="emit('confirm')"
        >
          Объединить
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { MergeNodesReport } from '~/services/fastApiService';
import { countList, topologyRefLabel } from '~/utils/topologyLabels';

const open = defineModel<boolean>({ default: false });
const props = defineProps<{
  targetId: number | null;
  sourceId: number | null;
  report: MergeNodesReport | null;
  loading: boolean;
  confirming: boolean;
  error: string | null;
}>();
const emit = defineEmits<{ confirm: []; cancel: [] }>();

const transferList = computed(() => countList(props.report?.transfer));
const resultsList = computed(() => countList(props.report?.results_skipped));

/** Блокеры сервера → понятные строки */
const blockerLines = computed(() => {
  const b = props.report?.blockers || {};
  const lines: string[] = [];
  if (b.different_fragments) {
    lines.push(`узлы из разных фрагментов (${b.different_fragments.target} и ${b.different_fragments.source})`);
  }
  if (b.different_internal_scheme) lines.push('узлы относятся к разным внутренним схемам');
  if (b.target_without_geometry) lines.push('у целевого узла нет геометрии на карте');
  for (const [lineId, deps] of Object.entries<Record<string, number>>(b.connecting_lines || {})) {
    const what = Object.entries(deps).map(([t, n]) => `${topologyRefLabel(t)} ×${n}`).join(', ');
    lines.push(`на участке ${lineId} между узлами есть оборудование: ${what}`);
  }
  for (const [ref, n] of Object.entries<{ source: number; target: number }>(b.conflicting_references || {})) {
    lines.push(`${topologyRefLabel(ref)}: есть у обоих узлов (${n.source} и ${n.target}) — выберите вручную`);
  }
  return lines;
});

const onCancel = () => {
  open.value = false;
  emit('cancel');
};
</script>
