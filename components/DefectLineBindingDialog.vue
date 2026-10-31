<template>
  <v-dialog
    v-model="visible"
    max-width="760"
    scrollable
  >
    <v-card>
      <v-card-title class="d-flex align-center ga-2">
        <span>Привязка нарушений к участкам</span>
        <v-spacer />
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          aria-label="Закрыть"
          @click="visible = false"
        />
      </v-card-title>
      <v-card-text>
        <v-progress-linear
          v-if="loading"
          indeterminate
        />
        <v-alert
          v-if="errorMessage"
          type="error"
          density="compact"
          variant="tonal"
          class="mb-2"
        >
          {{ errorMessage }}
        </v-alert>
        <template v-if="plan">
          <p class="text-body-2 mb-2">
            Нарушения без участка привязываются по месту: {{ plan.rule }}. Участок запишется в журнал нарушений —
            его увидит и десктоп. Записывается одной операцией, её можно отменить.
          </p>
          <div class="d-flex flex-wrap ga-4 mb-2 text-body-2">
            <span>Без участка: <b>{{ plan.unplaced }}</b></span>
            <span>Привяжется: <b>{{ plan.to_bind }}</b></span>
            <span>Дальше {{ plan.snap_m }} м от сети: <b>{{ plan.far }}</b></span>
            <span>На трубе с копиями во фрагментах: <b>{{ plan.with_copies }}</b></span>
            <span v-if="plan.without_place">Без места на карте: <b>{{ plan.without_place }}</b></span>
          </div>
          <div
            v-if="Object.keys(plan.by_fragment).length"
            class="text-caption text-medium-emphasis mb-2"
          >
            По фрагментам: {{ Object.entries(plan.by_fragment).map(([f, n]) => `${f} — ${n}`).join(', ') }}
          </div>
          <v-table
            v-if="plan.items.length"
            density="compact"
            class="lb-table"
          >
            <thead>
              <tr>
                <th>Нарушение</th>
                <th>Участок</th>
                <th>Фрагмент</th>
                <th class="text-right">
                  м
                </th>
                <th class="text-right">
                  Копий
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="i in plan.items"
                :key="i.defect_id"
              >
                <td>№ {{ i.defect_id }}</td>
                <td>{{ i.line_id }}</td>
                <td>{{ i.fragment || i.fileid }}</td>
                <td class="text-right">
                  {{ i.distance_m.toLocaleString('ru-RU') }}
                </td>
                <td class="text-right">
                  {{ i.copies }}
                </td>
              </tr>
            </tbody>
          </v-table>
          <div
            v-if="plan.to_bind > plan.items.length"
            class="text-caption text-medium-emphasis mt-1"
          >
            Показаны первые {{ plan.items.length }} из {{ plan.to_bind }}.
          </div>
        </template>
        <v-alert
          v-if="done"
          type="success"
          density="compact"
          variant="tonal"
          class="mt-2"
        >
          {{ done }}
        </v-alert>
      </v-card-text>
      <v-card-actions class="px-4 pb-3">
        <v-btn
          v-if="lastGroup"
          variant="text"
          :loading="undoing"
          @click="undo"
        >
          Отменить запись
        </v-btn>
        <v-spacer />
        <v-btn
          color="primary"
          variant="flat"
          :disabled="!plan || !plan.to_bind"
          :loading="applying"
          @click="apply"
        >
          Записать {{ plan?.to_bind ?? '' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { confirmAction } from '~/composables/useConfirm';
import { fastApiService } from '~/services/fastApiService';
import { formatApiError } from '~/utils/apiError';
import type { LineBindingPlan } from '~/utils/defectSimilarity';

/** Запись участка в журнал нарушений: предпросмотр привязки по месту, запись одной операцией, отмена. */
const visible = defineModel<boolean>({ default: false });
const emit = defineEmits<{ changed: [] }>();

const plan = ref<LineBindingPlan | null>(null);
const loading = ref(false);
const applying = ref(false);
const undoing = ref(false);
const errorMessage = ref('');
const done = ref('');
const lastGroup = ref<string | null>(null);

const load = async () => {
  loading.value = true;
  errorMessage.value = '';
  try {
    plan.value = await fastApiService.getLineBindingPreview();
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Предпросмотр привязки не загрузился');
  } finally {
    loading.value = false;
  }
};

const apply = async () => {
  if (!plan.value) return;
  const ok = await confirmAction({
    title: 'Записать участки в журнал?',
    text: `${plan.value.to_bind} нарушениям будет записан участок. Изменение увидит десктоп; его можно отменить.`,
    action: 'Записать',
  });
  if (!ok) return;
  applying.value = true;
  errorMessage.value = '';
  try {
    const res = await fastApiService.applyLineBinding();
    lastGroup.value = res.change_group_id;
    done.value = `Записано: ${res.bound}` + (res.far ? `; дальше от сети, без участка: ${res.far}` : '');
    emit('changed');
    await load();
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Участки не записаны');
  } finally {
    applying.value = false;
  }
};

const undo = async () => {
  if (!lastGroup.value) return;
  undoing.value = true;
  try {
    const res = await fastApiService.undoLineBinding(lastGroup.value);
    done.value = `Отменено: ${res.unbound}` + (res.changed_since ? `; изменены после записи, не тронуты: ${res.changed_since}` : '');
    lastGroup.value = null;
    emit('changed');
    await load();
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Отмена не выполнена');
  } finally {
    undoing.value = false;
  }
};

watch(visible, (v) => {
  if (v) {
    done.value = '';
    void load();
  }
});
</script>

<style scoped>
.lb-table { font-size: var(--text-sm, 0.8125rem); }
</style>
