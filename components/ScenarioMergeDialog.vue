<template>
  <v-dialog
    v-model="open"
    max-width="760"
    scrollable
    :persistent="applying"
  >
    <v-card rounded="lg">
      <v-card-title class="d-flex align-center ga-3 px-4 py-3">
        <v-icon color="primary">
          mdi-source-merge
        </v-icon>
        <div
          class="flex-grow-1"
          style="min-width: 0"
        >
          <div class="text-subtitle-1 font-weight-bold text-truncate">
            Перенести сценарий в основу
          </div>
          <div class="text-caption text-medium-emphasis text-truncate">
            «{{ scenario.name }}» → {{ scenario.base_name ?? 'фрагмент' }} (#{{ scenario.base_fileid }})
          </div>
        </div>
      </v-card-title>
      <v-divider />

      <v-card-text class="pa-4">
        <StateView
          variant="list"
          :rows="5"
          :loading="previewLoading && !preview"
          :error="previewError"
          error-title="Не удалось подготовить перенос"
          @retry="loadPreview"
        >
          <template v-if="preview">
            <p class="text-body-2 mb-2">
              Изменятся объекты основы — их видят десктоп и все пользователи. Перенос — одна операция:
              её можно отменить в «Истории правок», пока объекты не правили после него.
            </p>
            <div
              v-if="nothingToMerge"
              class="text-body-2 text-medium-emphasis mb-2"
            >
              Переносить нечего: правок сценария нет{{ conflicts.length ? ' (кроме конфликтов, оставленных за основой)' : '' }}.
            </div>
            <ul
              v-else
              class="merge-counts mb-3"
            >
              <li
                v-for="line in countsText"
                :key="line"
              >
                {{ line }}
              </li>
            </ul>

            <template v-if="conflicts.length">
              <div class="text-subtitle-2 mb-1">
                Конфликты ({{ conflicts.length }}): объект правили и в сценарии, и в основе
              </div>
              <div class="merge-conflicts mb-3">
                <div
                  v-for="c in conflicts"
                  :key="c.key"
                  class="merge-conflict"
                >
                  <div class="merge-conflict__text">
                    <div class="font-weight-medium">
                      {{ scenarioObjectTitle({ table: c.table, base_id: c.base_id, copy_id: c.copy_id, name: null }) }}
                    </div>
                    <div class="text-caption text-medium-emphasis">
                      основа → сценарий: {{ scenarioFieldsText(c.fields) }}
                    </div>
                  </div>
                  <v-btn-toggle
                    :model-value="resolutions[c.key] ?? 'base'"
                    density="compact"
                    mandatory
                    variant="outlined"
                    divided
                    :disabled="applying"
                    @update:model-value="(v: 'base' | 'scenario') => setResolution(c.key, v)"
                  >
                    <v-btn
                      value="base"
                      size="small"
                    >
                      Основа
                    </v-btn>
                    <v-btn
                      value="scenario"
                      size="small"
                    >
                      Сценарий
                    </v-btn>
                  </v-btn-toggle>
                </div>
              </div>
            </template>

            <v-alert
              v-if="preview.check.total > 0"
              :type="preview.check.errors > 0 ? 'error' : 'warning'"
              variant="tonal"
              density="compact"
            >
              Проверка связности после переноса: {{ topologyCheckSummary(preview.check) }}.
              <ul class="mt-1 merge-issues">
                <li
                  v-for="issue in preview.check.issues.slice(0, ISSUES_SHOWN)"
                  :key="`${issue.type}-${issue.object_type}-${issue.object_id}`"
                >
                  {{ topologyFaultTitle(issue) }} — {{ issue.description }}
                </li>
              </ul>
            </v-alert>
            <div
              v-else
              class="text-caption text-success"
            >
              Проверка связности области переноса: замечаний нет
            </div>
          </template>
        </StateView>
      </v-card-text>

      <v-divider />
      <v-card-actions class="px-4 py-3">
        <span
          v-if="previewLoading && preview"
          class="text-caption text-medium-emphasis"
        >Пересчёт предпросмотра…</span>
        <v-spacer />
        <v-btn
          variant="text"
          :disabled="applying"
          @click="open = false"
        >
          Отмена
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :loading="applying"
          :disabled="!preview || previewLoading || nothingToMerge"
          @click="apply"
        >
          Перенести
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import StateView from '~/components/StateView.vue'
import { fastApiService, type Scenario, type ScenarioMergeReport, type ScenarioSkippedConflict } from '~/services/fastApiService'
import { useNotificationStore } from '~/stores/notificationStore'
import { formatApiErrorWith } from '~/utils/apiError'
import { scenarioFieldsText, scenarioMergeCountsText, scenarioObjectTitle } from '~/utils/scenarios'
import { topologyCheckSummary, topologyFaultTitle } from '~/utils/topologyDiagnostics'

/**
 * Перенос правок сценария в основу (POST api/v1/scenarios/{id}/merge): предпросмотр с откатом —
 * что изменится, конфликты с выбором «основа / сценарий», правила связности области; затем перенос
 * одной операцией журнала (уведомление с «Отменить»).
 */
const ISSUES_SHOWN = 5

const props = defineProps<{ scenario: Scenario }>()
const emit = defineEmits<{ merged: [report: ScenarioMergeReport] }>()
const open = defineModel<boolean>({ default: false })

const preview = ref<ScenarioMergeReport | null>(null)
const previewLoading = ref(false)
const previewError = ref('')
const applying = ref(false)
const resolutions = ref<Record<string, 'scenario' | 'base'>>({})
// конфликты первого предпросмотра: решённый в пользу сценария из следующего отчёта пропадает
const conflicts = ref<ScenarioSkippedConflict[]>([])
const notificationStore = useNotificationStore()
let seq = 0

const countsText = computed(() => scenarioMergeCountsText(preview.value?.counts))
const nothingToMerge = computed(() =>
  !!preview.value && preview.value.updated + preview.value.inserted + preview.value.removed === 0)

const loadPreview = async () => {
  const mySeq = ++seq
  previewLoading.value = true
  previewError.value = ''
  try {
    const res = await fastApiService.mergeScenario(props.scenario.id, { dryRun: true, resolutions: resolutions.value })
    if (mySeq !== seq) return
    if (!preview.value) conflicts.value = res.skipped_conflicts
    preview.value = res
  } catch (err: unknown) {
    if (mySeq === seq) previewError.value = formatApiErrorWith('Не удалось подготовить перенос', err)
  } finally {
    if (mySeq === seq) previewLoading.value = false
  }
}

const setResolution = (key: string, value: 'base' | 'scenario') => {
  resolutions.value = { ...resolutions.value, [key]: value }
  void loadPreview()
}

const apply = async () => {
  if (applying.value) return
  applying.value = true
  try {
    const res = await fastApiService.mergeScenario(props.scenario.id, { dryRun: false, resolutions: resolutions.value })
    // уведомление с «Отменить» показывает родитель: это окно сейчас закроется и размонтируется
    emit('merged', res)
    open.value = false
  } catch (err: unknown) {
    notificationStore.showError(formatApiErrorWith('Не удалось перенести сценарий', err))
  } finally {
    applying.value = false
  }
}

watch(open, (value) => {
  if (!value) return
  preview.value = null
  conflicts.value = []
  resolutions.value = {}
  void loadPreview()
}, { immediate: true })
</script>

<style scoped>
.merge-counts { padding-left: 20px; font-size: var(--text-sm, 0.875rem); }
.merge-conflicts { display: flex; flex-direction: column; gap: var(--space-2); max-height: 260px; overflow-y: auto; }
.merge-conflict {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  border-radius: var(--radius-2, 8px);
  background: rgba(var(--v-theme-on-surface), 0.03);
}
.merge-conflict__text { flex: 1; min-width: 0; }
.merge-issues { padding-left: 18px; }
@media (max-width: 599.98px) {
  .merge-conflict { flex-direction: column; align-items: stretch; }
}
</style>
