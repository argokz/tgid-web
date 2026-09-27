<template>
  <div class="journal-record-panels">
    <v-alert v-if="schemaError" type="warning" variant="tonal" density="compact" class="mb-3">{{ schemaError }}</v-alert>

    <!-- Утверждение плана (gid6: «Утверждение плана ремонтов/шурфовок») -->
    <v-card v-if="schema?.approval" variant="outlined" class="mb-3">
      <v-card-title class="text-subtitle-2 d-flex align-center ga-2">
        <v-icon size="18" color="teal-darken-2">mdi-stamper</v-icon>
        Утверждение плана
        <v-spacer />
        <v-chip v-if="approval" size="small" variant="tonal" :color="approvalColor">{{ approvalLabel }}</v-chip>
      </v-card-title>
      <v-card-text class="pt-0">
        <v-progress-linear v-if="approvalLoading" indeterminate color="teal" class="mb-2" />
        <template v-if="approval">
          <div v-if="approval.last_action" class="text-caption text-medium-emphasis mb-1">
            {{ approval.last_action.operation === 'APPROVE' ? 'Утвердил' : 'Снял утверждение' }}:
            {{ approval.last_action.by }} · {{ formatDateTime(approval.last_action.at) }}
          </div>
          <div v-if="signerSummary" class="text-caption mb-1">{{ signerSummary }}</div>
          <v-alert v-if="!approval.approved && !approval.not_applicable && approval.missing_fields.length"
            type="info" variant="tonal" density="compact" class="my-2">
            Для утверждения заполните: {{ approval.missing_fields.map(labelOf).join(', ') }}
          </v-alert>
          <v-alert v-if="!approval.approved && schema.approval.require_contour && approval.contour_size === 0"
            type="info" variant="tonal" density="compact" class="my-2">
            Контур пуст — выберите участки, затем утверждайте план.
          </v-alert>
        </template>
        <template v-if="canEdit && approval && !approval.not_applicable">
          <div v-if="!approval.approved && approveFormOpen" class="approve-form mt-2">
            <v-row dense>
              <v-col cols="12" sm="4">
                <v-text-field v-model="approveForm.approved_on" type="date" label="Дата утверждения"
                  density="compact" variant="outlined" hide-details />
              </v-col>
              <v-col v-for="(signer, key) in schema.approval.signers" :key="key" cols="12" sm="4">
                <v-select v-if="signer.ref === 'dolzhnosti'" v-model="approveForm.signers[key]" :items="schema.positions || []"
                  item-title="name" item-value="id" :label="signer.label" density="compact" variant="outlined" clearable hide-details />
                <v-select v-else-if="signer.ref === 'subdivisions'" v-model="approveForm.signers[key]" :items="schema.subdivisions || []"
                  item-title="name" item-value="id" :label="signer.label" density="compact" variant="outlined" clearable hide-details />
                <v-text-field v-else v-model="approveForm.signers[key]" :label="signer.label"
                  density="compact" variant="outlined" hide-details />
              </v-col>
            </v-row>
          </div>
          <div class="d-flex flex-wrap ga-2 mt-2">
            <template v-if="!approval.approved">
              <v-btn v-if="!approveFormOpen" size="small" color="teal" variant="tonal" prepend-icon="mdi-stamper"
                @click="openApproveForm">Утвердить…</v-btn>
              <template v-else>
                <v-btn size="small" color="teal" variant="flat" :loading="approving" @click="askApprove">Утвердить план</v-btn>
                <v-btn size="small" variant="text" @click="approveFormOpen = false">Отмена</v-btn>
              </template>
            </template>
            <v-btn v-else size="small" color="warning" variant="tonal" prepend-icon="mdi-stamper" :loading="approving"
              @click="askUnapprove">Снять утверждение</v-btn>
          </div>
        </template>
      </v-card-text>
    </v-card>

    <!-- Контур (remont2Deployed / opresDeployed / osmotrDeployed) -->
    <v-card v-if="schema?.has_contour" variant="outlined" class="mb-3">
      <v-card-title class="text-subtitle-2 d-flex align-center ga-2">
        <v-icon size="18" color="deep-purple">mdi-vector-polyline</v-icon>
        Контур: {{ contourIds.length }} участков
        <v-chip v-if="contourDirty" size="x-small" color="warning" variant="tonal">не сохранён</v-chip>
        <v-spacer />
        <v-btn size="small" variant="text" prepend-icon="mdi-map-search-outline" :disabled="!contour?.bbox || contourDirty"
          @click="showOnMap">На карте</v-btn>
      </v-card-title>
      <v-card-text class="pt-0">
        <v-progress-linear v-if="contourLoading" indeterminate color="deep-purple" class="mb-2" />
        <v-alert v-for="warning in contour?.warnings || []" :key="warning" type="warning" variant="tonal"
          density="compact" class="mb-2 text-caption">{{ warning }}</v-alert>
        <div v-if="contourIds.length" class="contour-list">
          <div v-for="lineId in contourIds" :key="lineId" class="contour-line d-flex align-center ga-2">
            <v-icon size="16" :color="lineInfo(lineId)?.removed ? 'error' : 'deep-purple'">mdi-pipe</v-icon>
            <span class="font-weight-medium">{{ lineId }}</span>
            <span class="text-caption text-medium-emphasis text-truncate">{{ lineCaption(lineId) }}</span>
            <v-spacer />
            <v-btn v-if="canEdit" icon="mdi-close" size="x-small" variant="text" :aria-label="`Убрать участок ${lineId}`"
              @click="removeLine(lineId)" />
          </div>
        </div>
        <div v-else-if="!contourLoading" class="text-caption text-medium-emphasis">Участки не выбраны.</div>
        <template v-if="canEdit">
          <div class="d-flex flex-wrap align-center ga-2 mt-3">
            <v-btn size="small" color="deep-purple" variant="tonal" prepend-icon="mdi-cursor-default-click-outline"
              @click="pickOnMap">Выбрать на карте</v-btn>
            <v-text-field v-model="lineIdsText" density="compact" variant="outlined" hide-details
              placeholder="ID участков через запятую" class="line-ids-input" @keyup.enter="addTypedLines" />
            <v-btn size="small" variant="text" :disabled="!lineIdsText.trim()" @click="addTypedLines">Добавить</v-btn>
            <v-checkbox v-model="includePairs" density="compact" hide-details label="с парной трубой (подача/обратка)" />
          </div>
          <div v-if="contourDirty" class="d-flex ga-2 mt-2">
            <v-btn size="small" color="deep-purple" variant="flat" :loading="contourSaving" @click="askSaveContour">Сохранить контур</v-btn>
            <v-btn size="small" variant="text" @click="resetContour">Отменить изменения</v-btn>
          </div>
        </template>
      </v-card-text>
    </v-card>

    <!-- Документы (remontDocuments / opresDocuments / …) -->
    <v-card v-if="schema?.has_documents" variant="outlined" class="mb-3">
      <v-card-title class="text-subtitle-2 d-flex align-center ga-2">
        <v-icon size="18" color="blue-grey">mdi-file-document-multiple-outline</v-icon>
        Документы ({{ documents.length }})
        <v-spacer />
        <v-btn v-if="canEdit && !docForm.open" size="small" variant="text" prepend-icon="mdi-plus" @click="openDocForm()">Добавить</v-btn>
      </v-card-title>
      <v-card-text class="pt-0">
        <v-progress-linear v-if="docsLoading" indeterminate color="blue-grey" class="mb-2" />
        <div v-for="doc in documents" :key="doc.id" class="d-flex align-center ga-2 doc-row">
          <v-icon size="16">mdi-file-document-outline</v-icon>
          <div class="flex-grow-1" style="min-width: 0">
            <div class="text-body-2 text-truncate">{{ doc.document_type_name || 'Документ' }} · {{ formatDate(doc.date_doc) }}</div>
            <a v-if="isLink(doc.path)" :href="String(doc.path)" target="_blank" rel="noopener noreferrer"
              class="text-caption text-truncate d-block">{{ doc.path }}</a>
            <div v-else class="text-caption text-medium-emphasis text-truncate">{{ doc.path }}</div>
          </div>
          <template v-if="canEdit">
            <v-btn icon="mdi-pencil" size="x-small" variant="text" aria-label="Изменить документ" @click="openDocForm(doc)" />
            <v-btn icon="mdi-delete" size="x-small" variant="text" color="error" aria-label="Удалить документ" @click="askDeleteDoc(doc)" />
          </template>
        </div>
        <div v-if="!documents.length && !docsLoading" class="text-caption text-medium-emphasis">Документов нет.</div>
        <div v-if="docForm.open" class="mt-3">
          <v-row dense>
            <v-col cols="12" sm="4">
              <v-select v-model="docForm.document_type_id" :items="schema.document_types || []" item-title="name" item-value="id"
                label="Вид документа" density="compact" variant="outlined" clearable hide-details />
            </v-col>
            <v-col cols="12" sm="3">
              <v-text-field v-model="docForm.date_doc" type="date" label="Дата" density="compact" variant="outlined" hide-details />
            </v-col>
            <v-col cols="12" sm="5">
              <v-text-field v-model="docForm.path" label="Файл (сетевой путь) или ссылка *" density="compact" variant="outlined"
                :error-messages="docFormError ? [docFormError] : []" hide-details="auto" />
            </v-col>
          </v-row>
          <div class="d-flex ga-2 mt-2">
            <v-btn size="small" color="primary" variant="flat" :loading="docSaving" @click="saveDoc">
              {{ docForm.id ? 'Сохранить документ' : 'Добавить документ' }}
            </v-btn>
            <v-btn size="small" variant="text" @click="docForm.open = false">Отмена</v-btn>
          </div>
        </div>
      </v-card-text>
    </v-card>

    <v-dialog v-model="confirm.visible" max-width="460">
      <v-card>
        <v-card-title class="text-subtitle-1">{{ confirm.title }}</v-card-title>
        <v-card-text>{{ confirm.text }}</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirm.visible = false">Отмена</v-btn>
          <v-btn :color="confirm.color" variant="flat" @click="runConfirm">{{ confirm.action }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useMutationsEnabled } from '~/composables/useMutationsEnabled';
import { useJournalMapBridge } from '~/composables/useJournalMapBridge';
import { useNotificationStore } from '~/stores/notificationStore';
import {
  journalWriteService,
  type ApprovalInfo,
  type ContourResponse,
  type JournalDocument,
  type JournalKey,
  type JournalSchema,
} from '~/services/journalWriteService';
import { formatJournalError, parseLineIds } from '~/utils/journalWrite';

const props = defineProps<{
  journal: JournalKey
  recordId: number
  recordLabel?: string
}>();

const emit = defineEmits<{
  /** Запись изменилась (утверждение, контур) — перечитать карточку */
  changed: []
  /** Скрыть диалоги журнала, чтобы открыть карту */
  hide: []
  /** Вернуть диалоги после выбора на карте */
  restore: []
}>();

const canEdit = useMutationsEnabled();
const notifications = useNotificationStore();
const bridge = useJournalMapBridge();

const schema = ref<JournalSchema | null>(null);
const schemaError = ref('');

const approval = ref<ApprovalInfo | null>(null);
const approvalLoading = ref(false);
const approving = ref(false);
const approveFormOpen = ref(false);
const today = () => new Date().toISOString().slice(0, 10);
const approveForm = reactive<{ approved_on: string; signers: Record<string, any> }>({ approved_on: today(), signers: {} });

const contour = ref<ContourResponse | null>(null);
const contourIds = ref<number[]>([]);
const contourLoading = ref(false);
const contourSaving = ref(false);
const includePairs = ref(true);
const lineIdsText = ref('');

const documents = ref<JournalDocument[]>([]);
const docsLoading = ref(false);
const docSaving = ref(false);
const docFormError = ref('');
const docForm = reactive({ open: false, id: 0, document_type_id: null as number | null, date_doc: '', path: '' });

const confirm = reactive({ visible: false, title: '', text: '', action: 'Да', color: 'primary', run: null as null | (() => Promise<void>) });

const labelOf = (key: string) => schema.value?.fields[key]?.label || key;
const formatDate = (value: unknown) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : '—';
};
const formatDateTime = (value: unknown) => {
  const text = String(value || '');
  const time = text.match(/T(\d{2}:\d{2})/);
  return `${formatDate(text)}${time ? ` ${time[1]}` : ''}`;
};
const isLink = (path: unknown) => /^https?:\/\//i.test(String(path || ''));

const approvalLabel = computed(() => {
  if (!approval.value) return '';
  if (approval.value.not_applicable) return 'Текущий ремонт — без утверждения';
  return approval.value.approved ? `Утверждено ${formatDate(approval.value.approved_on)}` : 'Не утверждено';
});
const approvalColor = computed(() => (approval.value?.approved ? 'success' : approval.value?.not_applicable ? 'grey' : 'warning'));
const signerSummary = computed(() => {
  if (!approval.value || !schema.value?.approval) return '';
  const lookup = (ref: string | null, value: unknown) => {
    const list = ref === 'dolzhnosti' ? schema.value?.positions : ref === 'subdivisions' ? schema.value?.subdivisions : null;
    return list ? list.find((item) => item.id === value)?.name || value : value;
  };
  return Object.entries(schema.value.approval.signers)
    .map(([key, info]) => {
      const value = approval.value?.signers[key];
      return value === null || value === undefined || value === '' ? '' : `${info.label}: ${lookup(info.ref, value)}`;
    })
    .filter(Boolean)
    .join(' · ');
});

const contourDirty = computed(() => {
  const saved = (contour.value?.lines || []).map((line) => line.line_id);
  return saved.length !== contourIds.value.length || saved.some((id, index) => id !== contourIds.value[index]);
});
const lineInfo = (lineId: number) => contour.value?.lines.find((line) => line.line_id === lineId);
const lineCaption = (lineId: number) => {
  const line = lineInfo(lineId);
  if (!line) return 'новый — сохраните контур';
  if (!line.exists) return 'нет в сети';
  const nodes = [line.start_node_name, line.end_node_name].filter(Boolean).join(' — ');
  const params = [line.diameter && `Ду ${line.diameter}`, line.length && `${Math.round(Number(line.length))} м`].filter(Boolean).join(', ');
  return [nodes, params, line.removed ? 'удалён' : ''].filter(Boolean).join(' · ') || '—';
};

const ask = (title: string, text: string, action: string, color: string, run: () => Promise<void>) => {
  Object.assign(confirm, { visible: true, title, text, action, color, run });
};
const runConfirm = async () => {
  const run = confirm.run;
  confirm.visible = false;
  if (run) await run();
};

const loadSchema = async () => {
  try {
    schema.value = await journalWriteService.getSchema(props.journal);
    schemaError.value = '';
  } catch (error: any) {
    schemaError.value = formatJournalError(error, null, 'Не удалось загрузить описание журнала');
  }
};

const loadApproval = async () => {
  if (!schema.value?.approval) return;
  approvalLoading.value = true;
  try {
    approval.value = await journalWriteService.getApproval(props.journal, props.recordId);
  } catch (error: any) {
    notifications.showError(formatJournalError(error, schema.value, 'Не удалось загрузить утверждение'));
  } finally {
    approvalLoading.value = false;
  }
};

const loadContour = async () => {
  if (!schema.value?.has_contour) return;
  contourLoading.value = true;
  try {
    contour.value = await journalWriteService.getContour(props.journal, props.recordId);
    contourIds.value = contour.value.lines.map((line) => line.line_id);
  } catch (error: any) {
    notifications.showError(formatJournalError(error, schema.value, 'Не удалось загрузить контур'));
  } finally {
    contourLoading.value = false;
  }
};

const loadDocuments = async () => {
  if (!schema.value?.has_documents) return;
  docsLoading.value = true;
  try {
    documents.value = (await journalWriteService.listDocuments(props.journal, props.recordId)).items;
  } catch (error: any) {
    notifications.showError(formatJournalError(error, schema.value, 'Не удалось загрузить документы'));
  } finally {
    docsLoading.value = false;
  }
};

const loadAll = async () => {
  await loadSchema();
  await Promise.all([loadApproval(), loadContour(), loadDocuments()]);
};

// --- утверждение ---
const openApproveForm = () => {
  approveForm.approved_on = today();
  approveForm.signers = { ...(approval.value?.signers || {}) };
  approveFormOpen.value = true;
};

const askApprove = () => {
  if (!approveForm.approved_on) {
    notifications.showWarning('Укажите дату утверждения');
    return;
  }
  ask('Утверждение плана', `Утвердить «${props.recordLabel || props.recordId}» датой ${formatDate(approveForm.approved_on)}?`,
    'Утвердить', 'teal', approve);
};

const approve = async () => {
  approving.value = true;
  try {
    const signers = Object.fromEntries(Object.entries(approveForm.signers).filter(([, v]) => v !== '' && v !== undefined));
    await journalWriteService.approve(props.journal, props.recordId, approveForm.approved_on, signers);
    notifications.showSuccess('План утверждён');
    approveFormOpen.value = false;
    await loadApproval();
    emit('changed');
  } catch (error: any) {
    notifications.showError(formatJournalError(error, schema.value, 'План не утверждён'));
  } finally {
    approving.value = false;
  }
};

const askUnapprove = () =>
  ask('Снять утверждение', `Снять утверждение плана «${props.recordLabel || props.recordId}»?`, 'Снять', 'warning', async () => {
    approving.value = true;
    try {
      await journalWriteService.unapprove(props.journal, props.recordId);
      notifications.showSuccess('Утверждение снято');
      await loadApproval();
      emit('changed');
    } catch (error: any) {
      notifications.showError(formatJournalError(error, schema.value, 'Не удалось снять утверждение'));
    } finally {
      approving.value = false;
    }
  });

// --- контур ---
const removeLine = (lineId: number) => {
  contourIds.value = contourIds.value.filter((id) => id !== lineId);
};
const addTypedLines = () => {
  const ids = parseLineIds(lineIdsText.value);
  if (!ids.length) {
    notifications.showWarning('Введите номера участков (ID) через запятую');
    return;
  }
  contourIds.value = [...contourIds.value, ...ids.filter((id) => !contourIds.value.includes(id))];
  lineIdsText.value = '';
};
const resetContour = () => {
  contourIds.value = (contour.value?.lines || []).map((line) => line.line_id);
};

const pickOnMap = async () => {
  emit('hide');
  const ids = await bridge.startPick(contourIds.value, props.recordLabel || `Запись ${props.recordId}`);
  emit('restore');
  if (ids) contourIds.value = ids;
};

const askSaveContour = () => {
  const removing = !contourIds.value.length;
  ask('Сохранение контура',
    removing
      ? 'Контур не выделен — после сохранения он будет удалён. Вы уверены?'
      : `Сохранить контур из ${contourIds.value.length} участков${includePairs.value ? ' (с парными трубами)' : ''}?`,
    'Сохранить', removing ? 'error' : 'deep-purple', saveContour);
};

const saveContour = async () => {
  contourSaving.value = true;
  try {
    const result = await journalWriteService.saveContour(props.journal, props.recordId, contourIds.value, includePairs.value);
    const pairs = result.pairs_added.length ? `, парных труб добавлено: ${result.pairs_added.length}` : '';
    notifications.showSuccess(`Контур сохранён: ${result.total} участков${pairs}`);
    await Promise.all([loadContour(), loadApproval()]);
    emit('changed');
  } catch (error: any) {
    notifications.showError(formatJournalError(error, schema.value, 'Контур не сохранён'));
  } finally {
    contourSaving.value = false;
  }
};

const showOnMap = () => {
  if (!contour.value?.bbox) return;
  bridge.showContour({ label: props.recordLabel || `Контур ${props.recordId}`, geojson: contour.value.geojson, bbox: contour.value.bbox });
  emit('hide');
};

// --- документы ---
const openDocForm = (doc?: JournalDocument) => {
  docFormError.value = '';
  Object.assign(docForm, {
    open: true,
    id: doc?.id || 0,
    document_type_id: doc?.document_type_id ?? null,
    date_doc: doc?.date_doc ? String(doc.date_doc).slice(0, 10) : today(),
    path: doc?.path || '',
  });
};

const saveDoc = async () => {
  if (!docForm.path.trim()) {
    docFormError.value = 'Укажите путь к файлу или ссылку';
    return;
  }
  docSaving.value = true;
  try {
    const fields = { document_type_id: docForm.document_type_id, date_doc: docForm.date_doc || null, path: docForm.path.trim() };
    if (docForm.id) await journalWriteService.updateDocument(props.journal, props.recordId, docForm.id, fields);
    else await journalWriteService.addDocument(props.journal, props.recordId, fields);
    notifications.showSuccess(docForm.id ? 'Документ сохранён' : 'Документ добавлен');
    docForm.open = false;
    await loadDocuments();
  } catch (error: any) {
    docFormError.value = formatJournalError(error, schema.value, 'Документ не сохранён');
  } finally {
    docSaving.value = false;
  }
};

const askDeleteDoc = (doc: JournalDocument) =>
  ask('Удаление документа', `Удалить документ «${doc.document_type_name || doc.path}»?`, 'Удалить', 'error', async () => {
    try {
      await journalWriteService.deleteDocument(props.journal, props.recordId, doc.id);
      notifications.showSuccess('Документ удалён');
      await loadDocuments();
    } catch (error: any) {
      notifications.showError(formatJournalError(error, schema.value, 'Документ не удалён'));
    }
  });

watch(() => props.recordId, () => {
  approveFormOpen.value = false;
  docForm.open = false;
  void loadAll();
});
onMounted(loadAll);

defineExpose({ reload: loadAll });
</script>

<style scoped>
.contour-list {
  max-height: 220px;
  overflow-y: auto;
}
.contour-line {
  padding: 2px 0;
  min-width: 0;
}
.line-ids-input {
  max-width: 260px;
  min-width: 180px;
}
.doc-row {
  padding: 4px 0;
}
</style>
