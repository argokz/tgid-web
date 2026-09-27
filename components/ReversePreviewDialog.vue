<template>
  <v-dialog v-model="open" max-width="540" persistent>
    <v-card rounded="lg">
      <v-card-title class="d-flex align-center bg-primary text-white pa-3">
        <v-icon class="me-2">mdi-swap-horizontal</v-icon>
        <span class="text-subtitle-1">Развернуть участок {{ lineId }}?</span>
      </v-card-title>

      <v-card-text class="pa-4">
        <div v-if="loading" class="d-flex align-center justify-center py-6">
          <v-progress-circular indeterminate color="primary" size="32" />
          <span class="ms-3 text-body-2">Проверка оборудования…</span>
        </div>

        <template v-else-if="report">
          <v-table density="compact" class="mb-3 text-body-2">
            <tbody>
              <tr>
                <td class="text-medium-emphasis">Узлы</td>
                <td>{{ report.before.nodeid1 }} → {{ report.before.nodeid2 }}</td>
                <td><v-icon size="16">mdi-arrow-right-bold</v-icon></td>
                <td class="font-weight-medium">{{ report.after.nodeid1 }} → {{ report.after.nodeid2 }}</td>
              </tr>
              <tr v-if="report.before.externalsignlineid !== report.after.externalsignlineid">
                <td class="text-medium-emphasis">Признак</td>
                <td>{{ externalSignLineLabel(report.before.externalsignlineid) }}</td>
                <td><v-icon size="16">mdi-arrow-right-bold</v-icon></td>
                <td class="font-weight-medium">{{ externalSignLineLabel(report.after.externalsignlineid) }}</td>
              </tr>
              <tr>
                <td class="text-medium-emphasis">Геометрия</td>
                <td colspan="3">
                  <template v-if="report.geometry.reversed">
                    разворачивается ({{ report.geometry.points }} точек<span v-if="report.geometry.length_m != null">, {{ report.geometry.length_m }} м</span>)
                  </template>
                  <template v-else>нет геометрии</template>
                </td>
              </tr>
            </tbody>
          </v-table>

          <!-- Парная труба (подача ↔ обратка): как в десктопе, разворачивается вместе -->
          <div v-if="report.pair" class="mb-3">
            <v-alert type="info" variant="tonal" density="compact" class="mb-1">
              Парная труба {{ report.pair.line_id }}
              ({{ externalSignLineLabel(report.pair.before.externalsignlineid) }},
              {{ report.pair.matched_by === 'coords' ? 'та же трасса' : `трасса в пределах ${report.pair.deviation_m ?? 0} м` }}):
              узлы {{ report.pair.before.nodeid1 }} → {{ report.pair.before.nodeid2 }}
              станут {{ report.pair.after.nodeid1 }} → {{ report.pair.after.nodeid2 }}.
            </v-alert>
            <v-checkbox
              v-model="withPair"
              density="compact"
              hide-details
              label="Развернуть вместе с парной трубой (подача и обратка)"
            />
          </div>

          <!-- Зависит от направления: требует подтверждения -->
          <div v-if="directionalList.length" class="mb-3">
            <v-alert type="warning" variant="tonal" density="compact" class="mb-2">
              Направление действия этого оборудования задаётся направлением участка и
              изменится вместе с ним:
              {{ directionalList.map((r) => `${topologyTableLabel(r.key)} ×${r.count}`).join(', ') }}.
            </v-alert>
            <div v-for="row in nodeBoundRows" :key="row.key" class="text-caption mb-1">
              {{ row.text }}
            </div>
            <v-checkbox
              v-model="accepted"
              density="compact"
              hide-details
              color="warning"
              label="Понимаю, что направление действия оборудования изменится"
            />
          </div>

          <!-- Не зависит от направления -->
          <div class="mb-2">
            <div class="d-flex align-center mb-1">
              <v-icon size="18" color="success" class="me-1">mdi-check</v-icon>
              <span class="text-caption font-weight-bold text-uppercase">Остаётся без изменений</span>
            </div>
            <template v-if="neutralList.length">
              <v-chip
                v-for="row in neutralList"
                :key="row.key"
                size="small"
                color="success"
                variant="tonal"
                class="me-1 mb-1"
              >
                {{ topologyTableLabel(row.key) }}: {{ row.count }}
              </v-chip>
              <div v-if="diaphragmLocations" class="text-caption text-medium-emphasis mt-1">
                Места установки диафрагм — функциональные, не «начало/конец»: {{ diaphragmLocations }}
              </div>
            </template>
            <div v-else-if="!directionalList.length" class="text-caption text-medium-emphasis">
              На участке нет оборудования — разворот безопасен.
            </div>
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
          :disabled="loading || !!error || !report || (needsConfirmation && !accepted)"
          @click="emit('confirm', { acceptDirectionChange: accepted, includePair: withPair && !!report?.pair })"
        >
          Развернуть
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { ReverseLineReport } from '~/services/fastApiService';
import { countList, endPositionLabel, externalSignLineLabel, topologyTableLabel } from '~/utils/topologyLabels';

const open = defineModel<boolean>({ default: false });
const props = defineProps<{
  lineId: number | null;
  report: ReverseLineReport | null;
  loading: boolean;
  confirming: boolean;
  error: string | null;
}>();
const emit = defineEmits<{
  confirm: [options: { acceptDirectionChange: boolean; includePair: boolean }];
  cancel: [];
}>();

const accepted = ref(false);
const withPair = ref(true);
watch(() => props.report, () => {
  accepted.value = false;
  withPair.value = true;
});

/** Оборудование, меняющее направление: участок + парная труба, если она разворачивается */
const directionalCounts = computed(() => {
  const own = { ...(props.report?.equipment.directional || {}) };
  if (withPair.value && props.report?.pair) {
    for (const [table, n] of Object.entries(props.report.pair.equipment.directional || {})) {
      own[table] = (own[table] || 0) + Number(n || 0);
    }
  }
  return own;
});
const needsConfirmation = computed(() => Object.keys(directionalCounts.value).length > 0);
const directionalList = computed(() => countList(directionalCounts.value));
const neutralList = computed(() => countList(props.report?.equipment.neutral));
const diaphragmLocations = computed(() =>
  Object.entries(props.report?.equipment.diaphragm_locations || {})
    .map(([loc, n]) => `${loc} ×${n}`)
    .join(', ')
);

/** Регуляторы привязаны к узлу: узел сохраняется, меняется его положение на участке */
const nodeBoundRows = computed(() =>
  Object.entries(props.report?.equipment.node_bound || {}).flatMap(([table, items]) =>
    items.map((item) => ({
      key: `${table}:${item.id}`,
      text:
        `${topologyTableLabel(table)} ${item.id}: регулируемый узел ${item.nodeid ?? '—'} сохраняется ` +
        `(${endPositionLabel(item.position_before)} → ${endPositionLabel(item.position_after)} участка)`,
    }))
  )
);

const onCancel = () => {
  open.value = false;
  emit('cancel');
};
</script>
