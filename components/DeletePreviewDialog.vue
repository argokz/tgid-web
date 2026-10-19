<template>
  <v-dialog
    v-model="open"
    max-width="560"
    scrollable
  >
    <v-card v-if="target">
      <v-card-title class="d-flex align-center">
        <v-icon
          start
          color="error"
          size="20"
        >
          mdi-delete-outline
        </v-icon>
        {{ target.kind === 'node' ? `Удалить узел ${target.id}` : `Удалить участок ${target.id}` }}
      </v-card-title>
      <v-card-text>
        <div
          v-if="loading"
          class="d-flex justify-center py-6"
        >
          <v-progress-circular
            indeterminate
            color="primary"
          />
        </div>
        <v-alert
          v-else-if="error"
          type="error"
          variant="tonal"
          density="compact"
        >
          {{ error }}
        </v-alert>

        <!-- Узел -->
        <template v-else-if="nodePreview">
          <v-radio-group
            v-model="nodeMode"
            hide-details
            class="mb-2"
          >
            <v-radio
              value="dissolve"
              :disabled="!nodePreview.dissolve.ok"
            >
              <template #label>
                <div>
                  <b>Убрать узел, соединив трубы</b>
                  <div
                    v-if="nodePreview.dissolve.ok"
                    class="text-caption"
                  >
                    <span
                      v-for="j in nodePreview.dissolve.joins"
                      :key="j.keep"
                      class="d-block"
                    >
                      участки {{ j.keep }} + {{ j.remove }} → один участок {{ j.keep }}, {{ fmtM(j.length_m) }}
                      ({{ signName(j.sign) }})
                    </span>
                  </div>
                  <div
                    v-else
                    class="text-caption text-medium-emphasis"
                  >
                    Нельзя: {{ nodePreview.dissolve.reasons.join('; ') }}
                  </div>
                </div>
              </template>
            </v-radio>
            <v-radio value="cascade">
              <template #label>
                <div>
                  <b>{{ nodePreview.lines.length ? `Удалить узел и участков: ${nodePreview.lines.length}` : 'Удалить узел' }}</b>
                  <div
                    v-if="nodePreview.lines.length"
                    class="text-caption"
                  >
                    {{ nodePreview.lines.map((l) => `${l.id} (${fmtM(l.length_m)})`).join(', ') }}
                  </div>
                </div>
              </template>
            </v-radio>
          </v-radio-group>
          <v-alert
            v-if="refs.length"
            type="warning"
            variant="tonal"
            density="compact"
            class="mt-2"
          >
            На узел ссылаются: {{ refs.map((r) => `${topologyRefLabel(r.key)} — ${r.count}`).join(', ') }}.
            Записи сохранятся, но будут указывать на удалённый узел.
          </v-alert>
        </template>

        <!-- Участок -->
        <template v-else-if="linePreview">
          <div class="text-body-2 mb-2">
            {{ signName(linePreview.sign) }} участок {{ linePreview.nodeid1 }} → {{ linePreview.nodeid2 }},
            {{ fmtM(linePreview.length_m) }}<template v-if="linePreview.du">, Ду {{ linePreview.du }} мм</template>;
            паспорт трубы снимается вместе с ним.
          </div>
          <v-checkbox
            v-if="linePreview.pair_line_id"
            v-model="withPair"
            density="compact"
            hide-details
            :label="`Вместе с парной трубой ${linePreview.pair_line_id} (${linePreview.sign === 2 ? 'обратка' : 'подача'}, та же трасса)`"
          />
          <v-alert
            v-if="equipment.length"
            type="warning"
            variant="tonal"
            density="compact"
            class="mt-2"
          >
            Оборудование на участке: {{ equipment.map((e) => `${topologyTableLabel(e.key)} — ${e.count}`).join(', ') }}.
            Оно сохранится, но будет на снятом участке.
          </v-alert>
        </template>
        <div class="text-caption text-medium-emphasis mt-3">
          Удаление можно отменить: Ctrl+Z или «Отменить» в уведомлении.
        </div>
      </v-card-text>
      <v-card-actions class="justify-end">
        <v-btn
          variant="text"
          @click="open = false"
        >
          Отмена
        </v-btn>
        <v-btn
          color="error"
          variant="flat"
          :loading="busy"
          :disabled="loading || Boolean(error)"
          @click="confirm"
        >
          {{ confirmLabel }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
/** Удаление узла или участка с предпросмотром: «убрать узел, соединив трубы» или удаление с участками; пара П/О */
import { computed, ref, watch } from 'vue'
import { formatApiErrorWith } from '~/utils/apiError'
import {
  fastApiService,
  type LineDeletePreview,
  type NodeDeletePreview,
} from '~/services/fastApiService'
import { countList, topologyRefLabel, topologyTableLabel } from '~/utils/topologyLabels'
import type { DeleteDone, DeleteTarget } from '~/utils/editorTools'


const props = defineProps<{ target: DeleteTarget | null }>()
const emit = defineEmits<{ done: [result: DeleteDone]; failed: [err: unknown] }>()
const open = defineModel<boolean>({ default: false })

const loading = ref(false)
const busy = ref(false)
const error = ref('')
const nodePreview = ref<NodeDeletePreview | null>(null)
const linePreview = ref<LineDeletePreview | null>(null)
const nodeMode = ref<'dissolve' | 'cascade'>('dissolve')
const withPair = ref(true)

const SIGNS: Record<number, string> = { 1: 'Общий', 2: 'Подающий', 3: 'Обратный', 4: 'Подпиточный', 5: 'Перемычка' }
const signName = (s: number) => SIGNS[s] || `Признак ${s}`
const fmtM = (m: number | null | undefined) => (m == null ? '—' : `${m.toFixed(2).replace('.', ',')} м`)
const refs = computed(() => countList(nodePreview.value?.references))
const equipment = computed(() => countList({
  ...(linePreview.value?.equipment || {}),
  ...(withPair.value ? linePreview.value?.pair_equipment || {} : {}),
}))
const confirmLabel = computed(() => {
  if (nodePreview.value) return nodeMode.value === 'dissolve' ? 'Соединить трубы' : 'Удалить'
  return withPair.value && linePreview.value?.pair_line_id ? 'Удалить оба' : 'Удалить'
})

watch([open, () => props.target], async ([isOpen]) => {
  if (!isOpen || !props.target) return
  const { kind, id } = props.target
  loading.value = true
  error.value = ''
  nodePreview.value = null
  linePreview.value = null
  withPair.value = true
  try {
    if (kind === 'node') {
      nodePreview.value = await fastApiService.getNodeDeletePreview(id)
      nodeMode.value = nodePreview.value.dissolve.ok ? 'dissolve' : 'cascade'
    } else {
      linePreview.value = await fastApiService.getLineDeletePreview(id)
    }
  } catch (e) {
    error.value = formatApiErrorWith('Не удалось подготовить удаление', e)
  } finally {
    loading.value = false
  }
}, { immediate: true })

const confirm = async () => {
  const t = props.target
  if (!t) return
  busy.value = true
  try {
    let done: DeleteDone
    if (t.kind === 'node' && nodeMode.value === 'dissolve') {
      const r = await fastApiService.dissolveNode(t.id, false, t.version)
      const joined = (r.joined || []).map((j) => `${j.line_id} (${fmtM(j.length_m)})`).join(', ')
      done = { message: `Узел ${t.id} убран, трубы соединены: ${joined}`, operationId: r.operation_id ?? null, kind: 'node', id: t.id }
    } else if (t.kind === 'node') {
      const r = await fastApiService.deleteNode(t.id, t.version, true)
      const n = r?.removed_lines?.length ?? 0
      done = { message: n ? `Узел ${t.id} и участков: ${n} удалены` : `Узел ${t.id} удалён`, operationId: r?.operation_id ?? null, kind: 'node', id: t.id }
    } else {
      const pair = withPair.value && linePreview.value?.pair_line_id ? linePreview.value.pair_line_id : null
      const r = await fastApiService.deleteLine(t.id, t.version, t.expectedSectionId, Boolean(pair))
      done = { message: pair ? `Участки ${t.id} и ${pair} удалены` : `Участок ${t.id} удалён`, operationId: r?.operation_id ?? null, kind: 'line', id: t.id }
    }
    open.value = false
    emit('done', done)
  } catch (e) {
    open.value = false
    emit('failed', e)
  } finally {
    busy.value = false
  }
}
</script>
