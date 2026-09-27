<template>
  <v-dialog v-model="visible" max-width="760" scrollable>
    <v-card>
      <v-card-title class="d-flex align-center ga-2">
        <v-icon color="teal-darken-2">mdi-stamper</v-icon>
        <span class="text-subtitle-1 font-weight-bold">Утверждение плана: {{ title }}</span>
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" aria-label="Закрыть" @click="visible = false" />
      </v-card-title>
      <v-divider />
      <v-card-text>
        <v-row dense>
          <v-col cols="6" sm="4">
            <v-text-field v-model="dateFrom" type="date" label="Начало по плану с" density="compact" variant="outlined" hide-details />
          </v-col>
          <v-col cols="6" sm="4">
            <v-text-field v-model="dateTo" type="date" label="по" density="compact" variant="outlined" hide-details />
          </v-col>
          <v-col cols="12" sm="4" class="d-flex align-center">
            <v-btn variant="tonal" prepend-icon="mdi-refresh" :loading="loading" @click="loadCandidates">Показать</v-btn>
          </v-col>
        </v-row>
        <v-alert v-if="error" type="error" variant="tonal" density="compact" class="my-2">{{ error }}</v-alert>
        <div class="d-flex align-center mt-3 mb-1">
          <span class="text-subtitle-2">Неутверждённые планы: {{ candidates.length }}</span>
          <v-spacer />
          <v-btn size="small" variant="text" :disabled="!candidates.length" @click="toggleAll">
            {{ selectedIds.length && selectedIds.length === candidates.length ? 'Снять все' : 'Выбрать все' }}
          </v-btn>
        </div>
        <div class="candidate-list">
          <v-checkbox v-for="item in candidates" :key="item.id" v-model="selectedIds" :value="item.id" density="compact" hide-details
            :label="`№ ${item.id} · ${item.name || 'без названия'} · начало ${formatDate(item.planned_start)}`" />
          <div v-if="!candidates.length && !loading" class="text-caption text-medium-emphasis pa-2">Нет планов для утверждения.</div>
        </div>
        <v-divider class="my-3" />
        <v-row dense>
          <v-col cols="12" sm="4">
            <v-text-field v-model="approvedOn" type="date" label="Дата утверждения *" density="compact" variant="outlined" hide-details />
          </v-col>
          <v-col v-for="(signer, key) in schema?.approval?.signers || {}" :key="key" cols="12" sm="4">
            <v-select v-if="signer.ref === 'dolzhnosti'" v-model="signers[key]" :items="schema?.positions || []" item-title="name"
              item-value="id" :label="signer.label" density="compact" variant="outlined" clearable hide-details />
            <v-select v-else-if="signer.ref === 'subdivisions'" v-model="signers[key]" :items="schema?.subdivisions || []"
              item-title="name" item-value="id" :label="signer.label" density="compact" variant="outlined" clearable hide-details />
            <v-text-field v-else v-model="signers[key]" :label="signer.label" density="compact" variant="outlined" hide-details />
          </v-col>
        </v-row>
        <div v-if="result" class="mt-3">
          <v-alert v-if="result.approved.length" type="success" variant="tonal" density="compact" class="mb-2">
            Утверждено: {{ result.approved.join(', ') }}
          </v-alert>
          <v-alert v-for="(reason, id) in result.rejected" :key="id" type="warning" variant="tonal" density="compact" class="mb-1">
            № {{ id }}: {{ describeRejection(reason) }}
          </v-alert>
        </div>
      </v-card-text>
      <v-divider />
      <v-card-actions>
        <span class="text-caption text-medium-emphasis">Выбрано {{ selectedIds.length }}</span>
        <v-spacer />
        <v-btn variant="text" @click="visible = false">Закрыть</v-btn>
        <v-btn color="teal" variant="flat" :disabled="!selectedIds.length || !approvedOn" :loading="approving" @click="approve">
          Утвердить выбранные
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { journalWriteService, type ApproveResult, type JournalKey, type JournalSchema } from '~/services/journalWriteService';
import { useNotificationStore } from '~/stores/notificationStore';
import { describeRejection, formatJournalError } from '~/utils/journalWrite';

const props = defineProps<{ journal: JournalKey }>();
const emit = defineEmits<{ approved: [ids: number[]] }>();

const notifications = useNotificationStore();
const visible = ref(false);
const loading = ref(false);
const approving = ref(false);
const error = ref('');
const schema = ref<JournalSchema | null>(null);
const candidates = ref<Array<{ id: number; name: string | null; planned_start: string | null }>>([]);
const selectedIds = ref<number[]>([]);
const approvedOn = ref(new Date().toISOString().slice(0, 10));
const signers = reactive<Record<string, any>>({});
const result = ref<ApproveResult | null>(null);

/** Отопительный сезон по умолчанию: с 1 мая текущего года до 30 апреля следующего (как сезон в gid6) */
const season = () => {
  const now = new Date();
  const year = now.getMonth() >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  return { from: `${year}-05-01`, to: `${year + 1}-04-30` };
};
const dateFrom = ref(season().from);
const dateTo = ref(season().to);

const title = computed(() => schema.value?.title || props.journal);
const formatDate = (value: unknown) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : '—';
};

const loadCandidates = async () => {
  loading.value = true;
  error.value = '';
  try {
    candidates.value = (await journalWriteService.approvalCandidates(props.journal, dateFrom.value, dateTo.value)).items;
    selectedIds.value = selectedIds.value.filter((id) => candidates.value.some((item) => item.id === id));
  } catch (e: any) {
    error.value = formatJournalError(e, schema.value, 'Не удалось загрузить планы');
  } finally {
    loading.value = false;
  }
};

const toggleAll = () => {
  selectedIds.value = selectedIds.value.length && selectedIds.value.length === candidates.value.length ? [] : candidates.value.map((item) => item.id);
};

const approve = async () => {
  if (!window.confirm(`Утвердить ${selectedIds.value.length} план(ов) датой ${formatDate(approvedOn.value)}?`)) return;
  approving.value = true;
  try {
    const cleanSigners = Object.fromEntries(Object.entries(signers).filter(([, v]) => v !== '' && v !== null && v !== undefined));
    result.value = await journalWriteService.approveBatch(props.journal, selectedIds.value, approvedOn.value, cleanSigners);
    if (result.value.approved.length) {
      notifications.showSuccess(`Утверждено планов: ${result.value.approved.length}`);
      emit('approved', result.value.approved);
    } else {
      notifications.showWarning('Ни один план не утверждён — см. причины');
    }
    selectedIds.value = [];
    await loadCandidates();
  } catch (e: any) {
    notifications.showError(formatJournalError(e, schema.value, 'Планы не утверждены'));
  } finally {
    approving.value = false;
  }
};

const open = async () => {
  visible.value = true;
  result.value = null;
  try {
    schema.value = await journalWriteService.getSchema(props.journal);
  } catch (e: any) {
    error.value = formatJournalError(e, null, 'Описание журнала недоступно');
  }
  await loadCandidates();
};

defineExpose({ open });
</script>

<style scoped>
.candidate-list {
  max-height: 260px;
  overflow-y: auto;
}
</style>
