<template>
  <v-dialog
    v-model="visible"
    :fullscreen="mobile"
    :max-width="mobile ? undefined : 1150"
    scrollable
  >
    <v-card :rounded="mobile ? '0' : 'lg'">
      <v-card-title class="d-flex align-center ga-2 py-2">
        <v-icon>mdi-map-marker-path</v-icon>
        Участки ПТС
        <v-btn-toggle
          v-model="kind"
          mandatory
          density="compact"
          color="primary"
          variant="outlined"
          class="ml-3"
        >
          <v-btn value="ms">МС</v-btn>
          <v-btn value="rs">РС</v-btn>
        </v-btn-toggle>
        <v-spacer />
        <v-btn
          icon="mdi-close"
          variant="text"
          density="compact"
          aria-label="Закрыть"
          @click="visible = false"
        />
      </v-card-title>

      <v-card-text class="pt-0">
        <v-alert
          v-if="!canEditData"
          type="info"
          variant="tonal"
          density="compact"
          class="mb-2"
        >
          Просмотр участков и паспорта доступны всем; правка и привязка труб — редактору при включённой записи (MUTATIONS_ENABLED).
        </v-alert>
        <v-alert
          v-if="error"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-2"
          closable
          @click:close="error = ''"
        >
          {{ error }}
        </v-alert>

        <div class="d-flex flex-wrap ga-3">
          <!-- Дерево участков -->
          <div class="sites-col">
            <div class="d-flex ga-2 mb-2">
              <v-text-field
                v-model="query"
                density="compact"
                variant="outlined"
                hide-details
                clearable
                prepend-inner-icon="mdi-magnify"
                label="Поиск участка"
              />
              <v-btn
                v-if="canEditData"
                icon="mdi-plus"
                color="primary"
                variant="tonal"
                title="Новый участок"
                aria-label="Новый участок"
                @click="startCreate"
              />
            </div>
            <div class="text-caption text-medium-emphasis mb-1">
              Участков: {{ sites.length }} · с трубами: {{ sitesWithPipes }} · труб привязано: {{ pipesTotal }}
            </div>
            <v-progress-linear
              v-if="loadingList"
              indeterminate
              color="primary"
              class="mb-1"
            />
            <v-list
              density="compact"
              class="sites-list"
              nav
            >
              <template
                v-for="group in groups"
                :key="group.key"
              >
                <v-list-subheader class="d-flex align-center">
                  <v-icon
                    size="small"
                    class="mr-1"
                  >mdi-account-tie</v-icon>{{ group.title }}
                </v-list-subheader>
                <v-list-item
                  v-for="item in group.items"
                  :key="item.id"
                  :active="selectedId === item.id"
                  color="primary"
                  @click="selectSite(item.id)"
                >
                  <v-list-item-title class="text-body-2">{{ siteTitle(item, kind) }}</v-list-item-title>
                  <v-list-item-subtitle v-if="item.magistral_name">{{ item.magistral_name }}</v-list-item-subtitle>
                  <template #append>
                    <v-chip
                      size="x-small"
                      :color="item.pipes ? 'success' : undefined"
                      variant="tonal"
                    >{{ item.pipes }}</v-chip>
                  </template>
                </v-list-item>
              </template>
            </v-list>
          </div>

          <!-- Участок -->
          <div class="site-col">
            <div
              v-if="!card && !creating"
              class="text-medium-emphasis pa-4"
            >
              Выберите участок слева или создайте новый. Трубы привязываются выбором на карте или цепочкой узлов
              (как «Участок МС/РС» в свойствах трубы десктопа).
            </div>

            <template v-if="card">
              <div class="d-flex align-center flex-wrap ga-2 mb-2">
                <div class="text-subtitle-1 font-weight-medium">{{ cardTitle }}</div>
                <v-spacer />
                <v-btn
                  size="small"
                  variant="tonal"
                  prepend-icon="mdi-crosshairs-gps"
                  :disabled="!card.stats.pipes"
                  @click="showOnMap"
                >
                  На карте
                </v-btn>
                <v-btn
                  size="small"
                  variant="tonal"
                  color="success"
                  prepend-icon="mdi-file-excel-box"
                  :loading="downloading"
                  :disabled="!card.stats.pipes"
                  @click="downloadPassport"
                >
                  Паспорт
                </v-btn>
                <v-btn
                  v-if="canEditData"
                  size="small"
                  variant="text"
                  color="error"
                  prepend-icon="mdi-delete"
                  @click="removeSite"
                >
                  Удалить
                </v-btn>
              </div>
              <div class="text-body-2 mb-3">
                Труб: <b>{{ card.stats.pipes }}</b> · длина {{ card.stats.length.toLocaleString('ru-RU') }} м
                <span v-if="card.stats.fragment_ids.length"> · фрагменты: {{ card.stats.fragment_ids.join(', ') }}</span>
              </div>

              <!-- Привязка труб -->
              <div class="text-subtitle-2 mb-1">Привязка труб</div>
              <div class="d-flex flex-wrap ga-2 mb-2">
                <v-btn
                  size="small"
                  color="orange-darken-3"
                  variant="tonal"
                  prepend-icon="mdi-cursor-default-click-outline"
                  :disabled="!canEditData"
                  @click="pickLines('assign')"
                >
                  Выбрать трубы на карте
                </v-btn>
                <v-btn
                  size="small"
                  color="orange-darken-3"
                  variant="tonal"
                  prepend-icon="mdi-source-branch"
                  :disabled="!canEditData"
                  @click="pickChain"
                >
                  Цепочка узлов
                </v-btn>
                <v-btn
                  size="small"
                  variant="tonal"
                  prepend-icon="mdi-link-variant-off"
                  :disabled="!canEditData || !card.stats.pipes"
                  @click="pickLines('unassign')"
                >
                  Снять с выбранных
                </v-btn>
                <v-btn
                  size="small"
                  variant="text"
                  prepend-icon="mdi-link-variant-off"
                  :disabled="!canEditData || !card.stats.pipes"
                  @click="runPreview({ action: 'unassign', all_pipes: true })"
                >
                  Снять со всех
                </v-btn>
              </div>

              <v-alert
                v-if="chainInfo"
                type="info"
                variant="tonal"
                density="compact"
                class="mb-2"
              >
                Цепочка из {{ chainInfo.node_ids.length }} узлов: труб на пути {{ chainInfo.line_ids.length }}<span
                  v-if="chainInfo.other_lines"
                >, прочих линейных объектов (арматура и т.п.) {{ chainInfo.other_lines }} — не привязываются</span>.
              </v-alert>

              <v-card
                v-if="preview"
                variant="outlined"
                class="pa-2 mb-3"
              >
                <div class="text-body-2 mb-1">{{ previewText }}</div>
                <div
                  v-for="w in preview.warnings"
                  :key="w"
                  class="text-caption text-warning"
                >{{ w }}</div>
                <div
                  v-if="preview.missing_ids.length"
                  class="text-caption text-medium-emphasis"
                >
                  Не найдены (удалены или не трубы): {{ preview.missing_ids.slice(0, 20).join(', ') }}
                </div>
                <div class="d-flex ga-2 mt-2">
                  <v-btn
                    size="small"
                    color="primary"
                    variant="flat"
                    :loading="applying"
                    :disabled="!preview.changes"
                    @click="applyPipes"
                  >
                    Применить
                  </v-btn>
                  <v-btn
                    size="small"
                    variant="text"
                    @click="clearPreview"
                  >Отмена</v-btn>
                </div>
              </v-card>

              <v-alert
                v-if="lastResult"
                type="success"
                variant="tonal"
                density="compact"
                class="mb-3"
              >
                Изменено строк: {{ lastResult.changed }}.
                <v-btn
                  v-if="!lastUndone"
                  size="x-small"
                  variant="text"
                  prepend-icon="mdi-undo"
                  :loading="undoing"
                  @click="undoLast"
                >
                  Отменить
                </v-btn>
                <span v-else>Отменено.</span>
              </v-alert>
            </template>

            <!-- Характеристика -->
            <template v-if="card || creating">
              <div class="text-subtitle-2 mb-1">{{ creating ? `Новый ${kind === 'ms' ? 'участок МС' : 'участок РС'}` : 'Характеристика' }}</div>
              <v-progress-linear
                v-if="loadingFields"
                indeterminate
                class="mb-2"
              />
              <div class="card-grid">
                <template
                  v-for="field in fields"
                  :key="field.name"
                >
                  <v-autocomplete
                    v-if="field.ref"
                    v-model="form[field.name]"
                    :items="lookups[field.name] || []"
                    item-title="title"
                    item-value="value"
                    :label="field.label"
                    :readonly="!canEditData"
                    density="compact"
                    variant="outlined"
                    hide-details
                    clearable
                    @focus="loadLookup(field)"
                  />
                  <v-checkbox
                    v-else-if="field.kind === 'bool'"
                    v-model="form[field.name]"
                    :label="field.label"
                    :readonly="!canEditData"
                    density="compact"
                    hide-details
                  />
                  <v-text-field
                    v-else
                    v-model="form[field.name]"
                    :type="inputType(field)"
                    :label="field.label"
                    :readonly="!canEditData"
                    :maxlength="field.max_length || undefined"
                    density="compact"
                    variant="outlined"
                    hide-details
                  />
                </template>
              </div>
              <div
                v-if="canEditData"
                class="d-flex ga-2 mt-2"
              >
                <v-btn
                  color="primary"
                  variant="flat"
                  size="small"
                  prepend-icon="mdi-content-save"
                  :loading="saving"
                  :disabled="!creating && !dirty"
                  @click="saveCard"
                >
                  {{ creating ? 'Создать' : 'Сохранить' }}
                </v-btn>
                <v-btn
                  v-if="creating"
                  size="small"
                  variant="text"
                  @click="creating = false"
                >Отмена</v-btn>
              </div>
            </template>
          </div>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { confirmAction } from '~/composables/useConfirm';
import { computed, reactive, ref, watch } from 'vue';
import { useMobile } from '~/composables/useMobile';
import { useJournalMapBridge } from '~/composables/useJournalMapBridge';
import { fastApiService } from '~/services/fastApiService';
import { groupSettersService } from '~/services/groupSettersService';
import {
  ptsService,
  type CardField,
  type PtsChain,
  type PtsPipesChange,
  type PtsPipesPreview,
  type PtsPipesResult,
  type PtsSiteCard,
  type PtsSiteItem,
  type SiteKind,
} from '~/services/ptsService';
import { useAuthStore } from '~/stores/authStore';
import { useNotificationStore } from '~/stores/notificationStore';
import { useFragmentStore } from '~/stores/fragmentStore';
import { apiErrorText } from '~/utils/groupSetters';
import { cardPayload, describePipesChange, groupSitesByChief, inputType, siteTitle, toFormValue } from '~/utils/ptsSites';

const { isMobile: mobile } = useMobile();
const authStore = useAuthStore();
const bridge = useJournalMapBridge();
const notify = useNotificationStore();

const visible = ref(false);
const kind = ref<SiteKind>('ms');
const query = ref('');
const error = ref('');
const loadingList = ref(false);
const loadingFields = ref(false);
const saving = ref(false);
const applying = ref(false);
const undoing = ref(false);
const downloading = ref(false);
const creating = ref(false);
const sites = ref<PtsSiteItem[]>([]);
const selectedId = ref<number | null>(null);
const card = ref<PtsSiteCard | null>(null);
const fields = ref<CardField[]>([]);
const form = reactive<Record<string, unknown>>({});
const lookups = reactive<Record<string, Array<{ value: number | string; title: string }>>>({});
const pending = ref<PtsPipesChange | null>(null);
const preview = ref<PtsPipesPreview | null>(null);
const chainInfo = ref<PtsChain | null>(null);
const lastResult = ref<PtsPipesResult | null>(null);
const lastUndone = ref(false);
const fieldsCache: Partial<Record<SiteKind, CardField[]>> = {};

const canEditData = computed(() => authStore.canEditPts);
const groups = computed(() => groupSitesByChief(sites.value, query.value || ''));
const pipesTotal = computed(() => sites.value.reduce((s, i) => s + (i.pipes || 0), 0));
const sitesWithPipes = computed(() => sites.value.filter((i) => i.pipes > 0).length);
const cardTitle = computed(() => {
  if (!card.value) return '';
  const item = sites.value.find((s) => s.id === card.value?.id);
  return siteTitle({ id: card.value.id, name: item?.name ?? null }, kind.value);
});
const payload = computed(() => cardPayload(fields.value, form, creating.value ? null : card.value?.values || null));
const dirty = computed(() => Object.keys(payload.value).length > 0);
const previewText = computed(() =>
  preview.value && pending.value
    ? describePipesChange(pending.value.action, preview.value.changes, preview.value.objects, cardTitle.value)
    : '',
);

const fail = (e: any, fallback: string) => {
  error.value = apiErrorText(e, fallback);
};

const loadSites = async () => {
  loadingList.value = true;
  try {
    sites.value = (await ptsService.sites(kind.value)).items;
  } catch (e: any) {
    fail(e, 'Не удалось загрузить участки');
  } finally {
    loadingList.value = false;
  }
};

const loadFields = async () => {
  const cached = fieldsCache[kind.value];
  if (cached) {
    fields.value = cached;
    return;
  }
  loadingFields.value = true;
  try {
    const list = (await ptsService.fields(kind.value)).fields;
    fieldsCache[kind.value] = list;
    fields.value = list;
  } catch (e: any) {
    fail(e, 'Не удалось загрузить поля карточки');
  } finally {
    loadingFields.value = false;
  }
};

const fillForm = (values: Record<string, unknown> | null) => {
  for (const key of Object.keys(form)) delete form[key];
  for (const field of fields.value) form[field.name] = toFormValue(field, values ? values[field.name] : null);
  for (const field of fields.value) {
    if (field.ref && values && values[field.name] !== null && values[field.name] !== undefined) loadLookup(field);
  }
};

const loadLookup = async (field: CardField) => {
  if (!field.ref || lookups[field.name]) return;
  try {
    lookups[field.name] = (await ptsService.lookup(field.ref)).data;
  } catch {
    lookups[field.name] = [];
  }
};

const clearPreview = () => {
  preview.value = null;
  pending.value = null;
  chainInfo.value = null;
};

const selectSite = async (id: number) => {
  selectedId.value = id;
  creating.value = false;
  clearPreview();
  lastResult.value = null;
  await loadFields();
  try {
    card.value = await ptsService.site(kind.value, id);
    fillForm(card.value.values);
  } catch (e: any) {
    fail(e, 'Не удалось открыть участок');
  }
};

const startCreate = async () => {
  await loadFields();
  card.value = null;
  selectedId.value = null;
  creating.value = true;
  clearPreview();
  fillForm(null);
};

const saveCard = async () => {
  saving.value = true;
  error.value = '';
  try {
    if (creating.value) {
      const created = await ptsService.create(kind.value, payload.value);
      creating.value = false;
      await loadSites();
      await selectSite(created.id);
      notify.showSuccess(`Участок ${created.id} создан`);
    } else if (card.value) {
      const res = await ptsService.update(kind.value, card.value.id, payload.value, card.value.version);
      card.value = res.site;
      fillForm(res.site.values);
      await loadSites();
      notify.showSuccess('Характеристика сохранена');
    }
  } catch (e: any) {
    if (e?.status === 409 || e?.statusCode === 409) error.value = 'Участок изменён другим пользователем — карточка перечитана.';
    else fail(e, 'Не удалось сохранить');
    if (card.value && !creating.value) await selectSite(card.value.id);
  } finally {
    saving.value = false;
  }
};

const removeSite = async () => {
  if (!card.value) return;
  const pipes = card.value.stats.pipes;
  const text = pipes
    ? `К участку «${cardTitle.value}» привязано труб: ${pipes}. Снять привязку и удалить участок?`
    : `Удалить участок «${cardTitle.value}»?`;
  if (!(await confirmAction({ text, action: 'Удалить' }))) return;
  try {
    await ptsService.remove(kind.value, card.value.id, pipes > 0);
    card.value = null;
    selectedId.value = null;
    bridge.clearContour();
    await loadSites();
    notify.showSuccess('Участок удалён');
  } catch (e: any) {
    fail(e, 'Не удалось удалить участок');
  }
};

const showOnMap = async () => {
  if (!card.value) return;
  try {
    const data = await ptsService.pipes(kind.value, card.value.id);
    bridge.showContour({ label: cardTitle.value, geojson: data.geojson, bbox: data.bbox });
    visible.value = false;
  } catch (e: any) {
    fail(e, 'Не удалось показать участок');
  }
};

const downloadPassport = async () => {
  if (!card.value) return;
  downloading.value = true;
  try {
    const { blob, filename } = await fastApiService.downloadPassport(kind.value, card.value.id, {
      fragments: useFragmentStore().visibleFragments,
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (e: any) {
    fail(e, 'Не удалось сформировать паспорт');
  } finally {
    downloading.value = false;
  }
};

const runPreview = async (change: PtsPipesChange) => {
  if (!card.value) return;
  error.value = '';
  lastResult.value = null;
  try {
    preview.value = await ptsService.previewPipes(kind.value, card.value.id, change);
    pending.value = change;
  } catch (e: any) {
    preview.value = null;
    pending.value = null;
    fail(e, 'Предпросмотр не удался');
  }
};

const pickLines = async (action: 'assign' | 'unassign') => {
  if (!card.value) return;
  clearPreview();
  visible.value = false;
  const label = `${action === 'assign' ? 'Привязка к' : 'Снятие с'} ${cardTitle.value}`;
  const ids = await bridge.startPick([], label, 'line');
  visible.value = true;
  if (ids?.length) await runPreview({ action, line_ids: ids });
};

const pickChain = async () => {
  if (!card.value) return;
  clearPreview();
  visible.value = false;
  const ids = await bridge.startPick([], `Цепочка узлов → ${cardTitle.value} (кликайте по порядку)`, 'node');
  if (!ids || ids.length < 2) {
    visible.value = true;
    if (ids) error.value = 'Выберите минимум два узла цепочки';
    return;
  }
  try {
    const chain = await ptsService.chain(ids);
    chainInfo.value = chain;
    bridge.showContour({ label: `Цепочка: ${chain.line_ids.length} труб`, geojson: chain.geojson, bbox: chain.bbox });
    visible.value = true;
    await runPreview({ action: 'assign', node_ids: ids });
    chainInfo.value = chain;
  } catch (e: any) {
    visible.value = true;
    fail(e, 'Не удалось построить путь по цепочке');
  }
};

const applyPipes = async () => {
  if (!card.value || !pending.value || !preview.value) return;
  applying.value = true;
  try {
    const result = await ptsService.applyPipes(kind.value, card.value.id, pending.value, preview.value.changes);
    clearPreview();
    await Promise.all([loadSites(), selectSite(card.value.id)]);
    lastResult.value = result;
    lastUndone.value = false;
    notify.showSuccess(`Изменено строк: ${result.changed}`);
  } catch (e: any) {
    fail(e, 'Не удалось применить');
  } finally {
    applying.value = false;
  }
};

const undoLast = async () => {
  if (!lastResult.value || !card.value) return;
  undoing.value = true;
  try {
    const res = await groupSettersService.undo(lastResult.value.change_group_id, false);
    lastUndone.value = true;
    notify.showSuccess(`Восстановлено строк: ${res.restorable}`);
    const keep = lastResult.value;
    await Promise.all([loadSites(), selectSite(card.value.id)]);
    lastResult.value = keep;
  } catch (e: any) {
    fail(e, 'Не удалось отменить');
  } finally {
    undoing.value = false;
  }
};

watch(kind, () => {
  card.value = null;
  selectedId.value = null;
  creating.value = false;
  clearPreview();
  for (const key of Object.keys(lookups)) delete lookups[key];
  loadSites();
});

const openDialog = () => {
  visible.value = true;
  if (!sites.value.length) loadSites();
};

defineExpose({ openDialog });
</script>

<style scoped>
.sites-col {
  flex: 1 1 320px;
  min-width: 260px;
  max-width: 420px;
}
.site-col {
  flex: 2 1 480px;
  min-width: 280px;
}
.sites-list {
  max-height: 560px;
  overflow-y: auto;
}
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 8px;
}
</style>
