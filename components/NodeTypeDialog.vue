<template>
  <!-- Тип узла (как «Изменить тип объекта» десктопа), заданный напор и подпитка -->
  <v-dialog
    v-model="open"
    max-width="560"
  >
    <v-card rounded="lg">
      <v-card-title class="d-flex align-center bg-primary text-white pa-3">
        <v-icon class="me-2">
          mdi-swap-horizontal
        </v-icon>
        <span class="text-subtitle-1">Тип узла {{ nodeId }}</span>
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

        <template v-else-if="info">
          <v-alert
            v-if="error"
            type="error"
            variant="tonal"
            density="compact"
            class="mb-3"
          >
            {{ error }}
          </v-alert>
          <v-alert
            v-if="info.conflict"
            type="warning"
            variant="tonal"
            density="compact"
            class="mb-3"
          >
            У узла карточки нескольких типов — смена типа оставит одну.
          </v-alert>

          <div class="text-body-2 mb-1">
            Сейчас: <b>{{ info.label }}</b>
            <span v-if="info.inner_nodes"> · внутренняя схема: узлов {{ info.inner_nodes }}</span>
          </div>
          <v-radio-group
            v-model="target"
            density="compact"
            hide-details
            :disabled="busy"
          >
            <v-radio
              v-for="t in NODE_TYPE_ITEMS"
              :key="t.value"
              :value="t.value"
              :disabled="blocked(t.value)"
            >
              <template #label>
                <v-icon
                  size="18"
                  class="me-1"
                >
                  {{ t.icon }}
                </v-icon>
                {{ t.title }}
                <span
                  v-if="blocked(t.value)"
                  class="text-caption text-medium-emphasis ms-1"
                >— нельзя: у узла внутренняя схема</span>
              </template>
            </v-radio>
          </v-radio-group>

          <div
            v-if="previewLoading"
            class="text-caption text-medium-emphasis mt-2"
          >
            Проверка…
          </div>
          <v-alert
            v-else-if="preview && losses.length"
            type="warning"
            variant="tonal"
            density="compact"
            class="mt-2"
          >
            Будет удалено (можно отменить кнопкой «Отменить»):
            <ul class="ms-4">
              <li
                v-for="l in losses"
                :key="l"
              >
                {{ l }}
              </li>
            </ul>
          </v-alert>
          <div
            v-else-if="preview"
            class="text-caption text-medium-emphasis mt-2"
          >
            Новая карточка — с умолчаниями, как в десктопе. Заполните её после смены типа.
          </div>

          <v-divider class="my-3" />
          <div class="text-subtitle-2 mb-1">
            Дополнения узла
          </div>
          <div
            v-for="f in NODE_FLAG_ITEMS"
            :key="f.value"
            class="d-flex align-center ga-2 mb-1"
          >
            <v-icon
              size="18"
              :color="info.flags[f.value] ? 'success' : 'grey'"
            >
              {{ info.flags[f.value] ? 'mdi-check-circle' : 'mdi-circle-outline' }}
            </v-icon>
            <span class="text-body-2 flex-grow-1">{{ f.title }}</span>
            <v-btn
              v-if="info.flags[f.value]"
              size="small"
              variant="text"
              color="primary"
              :disabled="busy"
              @click="emit('edit-card', { kind: f.kind, table: f.table, id: nodeId, title: `${f.title}: узел ${nodeId}` })"
            >
              Карточка
            </v-btn>
            <v-btn
              size="small"
              variant="outlined"
              :color="info.flags[f.value] ? 'error' : 'primary'"
              :loading="flagBusy === f.value"
              :disabled="busy"
              @click="toggleFlag(f.value, !info.flags[f.value])"
            >
              {{ info.flags[f.value] ? 'Удалить' : 'Добавить' }}
            </v-btn>
          </div>
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
          :disabled="!preview || busy || previewLoading"
          :loading="applying"
          @click="apply"
        >
          Сменить тип
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { fastApiService } from '~/services/fastApiService';
import { formatApiError } from '~/utils/apiError';
import { confirmAction } from '~/composables/useConfirm';
import {
  CONSUMER_TYPES,
  NODE_FLAG_ITEMS,
  NODE_TYPE_ITEMS,
  nodeTypeLosses,
  nodeTypeTitle,
  type NodeFlag,
  type NodeType,
  type NodeTypeChangeResult,
  type NodeTypeInfo,
} from '~/utils/nodeTypes';
import type { CardKind } from '~/utils/objectCard';

const open = defineModel<boolean>({ default: false });
const props = defineProps<{ nodeId: number }>();
const emit = defineEmits<{
  /** операция выполнена: текст уведомления (слои и «Отменить» обновит родитель) */
  changed: [message: string]
  /** открыть карточку дополнения узла (заданный напор, подпитка) */
  'edit-card': [target: { kind: CardKind; table: string; id: number; title: string }]
}>();

const info = ref<NodeTypeInfo | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const target = ref<NodeType | null>(null);
const preview = ref<NodeTypeChangeResult | null>(null);
const previewLoading = ref(false);
const applying = ref(false);
const flagBusy = ref<NodeFlag | null>(null);
const busy = computed(() => applying.value || flagBusy.value != null);
const losses = computed(() => (preview.value ? nodeTypeLosses(preview.value) : []));

/** десктоп: узел с внутренней схемой нельзя сделать потребителем */
const blocked = (t: NodeType) =>
  Boolean(info.value?.inner_nodes) && !CONSUMER_TYPES.has(info.value!.type) && CONSUMER_TYPES.has(t);

const load = async () => {
  loading.value = true;
  error.value = null;
  preview.value = null;
  try {
    info.value = await fastApiService.getNodeType(props.nodeId);
    target.value = info.value.type;
  } catch (err) {
    error.value = formatApiError(err, 'Не удалось прочитать тип узла');
  } finally {
    loading.value = false;
  }
};

watch(open, (v) => { if (v) void load(); }, { immediate: true });

let seq = 0;
watch(target, async (t) => {
  preview.value = null;
  error.value = null;
  const cur = info.value;
  if (!cur || !t || (t === cur.type && !cur.conflict)) return;
  const my = ++seq;
  previewLoading.value = true;
  try {
    const res = await fastApiService.changeNodeType(props.nodeId, t, { dryRun: true, version: cur.version });
    if (my === seq) preview.value = res;
  } catch (err) {
    if (my === seq) error.value = formatApiError(err, 'Смена типа невозможна');
  } finally {
    if (my === seq) previewLoading.value = false;
  }
});

const apply = async () => {
  const cur = info.value;
  const t = target.value;
  if (!cur || !t || !preview.value) return;
  applying.value = true;
  try {
    const res = await fastApiService.changeNodeType(props.nodeId, t, { version: cur.version });
    emit('changed', `Узел ${props.nodeId}: ${nodeTypeTitle(res.old_type)} → ${nodeTypeTitle(res.new_type)}`);
    await load();
  } catch (err) {
    error.value = formatApiError(err, 'Не удалось сменить тип узла');
  } finally {
    applying.value = false;
  }
};

const toggleFlag = async (flag: NodeFlag, on: boolean) => {
  const cur = info.value;
  if (!cur) return;
  const title = NODE_FLAG_ITEMS.find((f) => f.value === flag)?.title ?? flag;
  if (!on && !(await confirmAction({ text: `Удалить «${title}» у узла ${props.nodeId} вместе со значениями?`, action: 'Удалить' }))) {
    return;
  }
  flagBusy.value = flag;
  error.value = null;
  try {
    await fastApiService.setNodeFlag(props.nodeId, flag, on, cur.version);
    emit('changed', `${title}: ${on ? 'добавлен' : 'удалён'} (узел ${props.nodeId})`);
    await load();
  } catch (err) {
    error.value = formatApiError(err, `Не удалось изменить «${title}»`);
  } finally {
    flagBusy.value = null;
  }
};
</script>
