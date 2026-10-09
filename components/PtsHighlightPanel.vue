<template>
  <div class="tab-content">
    <div class="px-3 pt-1 pb-1 text-caption text-medium-emphasis">
      Подсветка труб на карте, как в доке ПТС программы: начальник участка — все его участки МС и РС,
      или один участок.
    </div>

    <div
      v-if="layerStore.ptsHighlight"
      class="px-3 pb-2"
    >
      <v-card
        variant="tonal"
        color="amber-darken-3"
        rounded="lg"
        class="pa-2"
      >
        <div class="d-flex align-center ga-2">
          <v-icon size="18">mdi-marker</v-icon>
          <div class="text-body-2 font-weight-medium flex-grow-1 min-w-0 text-truncate">
            {{ layerStore.ptsHighlight.title }}
          </div>
          <v-btn
            size="x-small"
            variant="text"
            :loading="extentLoading"
            :disabled="!extent?.bbox"
            prepend-icon="mdi-crosshairs-gps"
            @click="fitExtent"
          >Показать</v-btn>
          <v-btn
            size="x-small"
            variant="text"
            prepend-icon="mdi-close"
            @click="clear"
          >Снять</v-btn>
        </div>
        <div
          v-if="extent && !extent.pipes"
          class="text-caption mt-1"
        >
          Трубы к участку не привязаны — подсвечивать нечего.
        </div>
        <div
          v-else-if="hiddenFragments.length"
          class="text-caption mt-1"
        >
          Трубы во фрагментах {{ hiddenFragments.join(', ') }} — они не подключены на карте.
          <v-btn
            size="x-small"
            variant="flat"
            color="amber-darken-3"
            class="mt-1"
            @click="showHiddenFragments"
          >Подключить</v-btn>
        </div>
      </v-card>
    </div>

    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      density="compact"
      class="mx-3 mb-2"
      closable
      @click:close="error = ''"
    >{{ error }}</v-alert>

    <div class="search-section px-3 pb-2">
      <v-text-field
        v-model="query"
        prepend-inner-icon="mdi-magnify"
        label="Начальник, участок, магистраль..."
        variant="outlined"
        density="compact"
        hide-details
        clearable
        rounded="lg"
      />
    </div>

    <div class="content-area">
      <div
        v-if="loading"
        class="pa-8 text-center"
      >
        <v-progress-circular
          indeterminate
          size="40"
          color="primary"
          aria-label="Загрузка участков"
        />
      </div>
      <v-list
        v-else-if="tree.length"
        density="compact"
      >
        <template
          v-for="node in tree"
          :key="node.key"
        >
          <v-list-item
            class="layer-item"
            :active="isActive('nach', node.nachId)"
            color="amber-darken-3"
            :title="node.title"
            :subtitle="`МС ${node.ms.length} · РС ${node.rs.length}`"
            @click="node.nachId ? select('nach', node.nachId, node.title) : toggle(node.key)"
          >
            <template #prepend>
              <v-icon size="18">mdi-account-tie</v-icon>
            </template>
            <template #append>
              <v-btn
                icon
                size="x-small"
                variant="text"
                :aria-label="isOpen(node.key) ? 'Свернуть участки' : 'Показать участки'"
                @click.stop="toggle(node.key)"
              >
                <v-icon>{{ isOpen(node.key) ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
              </v-btn>
            </template>
          </v-list-item>
          <template v-if="isOpen(node.key)">
            <v-list-item
              v-for="site in sitesOf(node)"
              :key="`${site.kind}${site.s.id}`"
              class="site-item"
              :active="isActive(site.kind, site.s.id)"
              color="amber-darken-3"
              @click="select(site.kind, site.s.id, siteTitle(site.s, site.kind))"
            >
              <v-list-item-title class="text-body-2">{{ siteTitle(site.s, site.kind) }}</v-list-item-title>
              <v-list-item-subtitle v-if="site.s.magistral_name">{{ site.s.magistral_name }}</v-list-item-subtitle>
              <template #append>
                <v-chip
                  size="x-small"
                  variant="tonal"
                  :color="site.s.pipes ? 'success' : undefined"
                >{{ site.s.pipes }}</v-chip>
              </template>
            </v-list-item>
          </template>
        </template>
      </v-list>
      <div
        v-else
        class="pa-8 text-center text-grey text-body-2"
      >
        {{ query ? 'Ничего не найдено' : 'Участки МС/РС не заведены' }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useLayerStore } from '~/stores/layerStore';
import { useFragmentStore } from '~/stores/fragmentStore';
import { useMapStore } from '~/stores/mapStore';
import { ptsService, type PtsHighlightExtent, type PtsSiteItem } from '~/services/ptsService';
import { chiefTree, hiddenHighlightFragments, type ChiefNode, type PtsHighlightKind } from '~/utils/ptsHighlight';
import { siteTitle } from '~/utils/ptsSites';
import { apiErrorText } from '~/utils/groupSetters';

const layerStore = useLayerStore();
const fragmentStore = useFragmentStore();
const mapStore = useMapStore();

const ms = ref<PtsSiteItem[]>([]);
const rs = ref<PtsSiteItem[]>([]);
const loading = ref(false);
const error = ref('');
const query = ref('');
const opened = ref(new Set<string>());
const extent = ref<PtsHighlightExtent | null>(null);
const extentLoading = ref(false);

const tree = computed(() => chiefTree(ms.value, rs.value, query.value || ''));
const hiddenFragments = computed(() =>
  hiddenHighlightFragments(extent.value?.fragment_ids ?? [], fragmentStore.visibleFragments),
);

const sitesOf = (node: ChiefNode) => [
  ...node.ms.map((s) => ({ kind: 'ms' as const, s })),
  ...node.rs.map((s) => ({ kind: 'rs' as const, s })),
];

// При поиске участки раскрыты — иначе совпадение не видно
const isOpen = (key: string) => Boolean(query.value) || opened.value.has(key);
const toggle = (key: string) => {
  const next = new Set(opened.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  opened.value = next;
};
const isActive = (kind: PtsHighlightKind, id: number | null) =>
  layerStore.ptsHighlight?.kind === kind && layerStore.ptsHighlight.id === id;

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [m, r] = await Promise.all([ptsService.sites('ms'), ptsService.sites('rs')]);
    ms.value = m.items;
    rs.value = r.items;
  } catch (e) {
    error.value = apiErrorText(e, 'Не удалось загрузить участки');
  } finally {
    loading.value = false;
  }
}

function fitExtent() {
  const b = extent.value?.bbox;
  if (!b || !mapStore.map) return;
  mapStore.map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 60, maxZoom: 16, duration: 800 });
}

async function loadExtent() {
  const h = layerStore.ptsHighlight;
  extent.value = null;
  if (!h) return;
  extentLoading.value = true;
  try {
    const res = await ptsService.highlight(h.kind, h.id);
    if (layerStore.ptsHighlight !== h) return; // выбрали другое, пока шёл запрос
    extent.value = res;
    fitExtent();
  } catch (e) {
    error.value = apiErrorText(e, 'Не удалось получить охват участка');
  } finally {
    extentLoading.value = false;
  }
}

function select(kind: PtsHighlightKind, id: number, title: string) {
  if (isActive(kind, id)) {
    fitExtent();
    return;
  }
  layerStore.setPtsHighlight({ kind, id, title });
}

function clear() {
  layerStore.setPtsHighlight(null);
}

function showHiddenFragments() {
  fragmentStore.applyVisibleFragmentsSelection([...fragmentStore.visibleFragments, ...hiddenFragments.value], false);
}

watch(() => layerStore.ptsHighlight, loadExtent, { immediate: true });
onMounted(load);
</script>

<style scoped>
/* как вкладки MapSidebarPanel: список прокручивается, шапка на месте */
.tab-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  height: 100%;
}
.search-section {
  flex-shrink: 0;
}
.content-area {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  scrollbar-width: thin;
}
.layer-item,
.site-item {
  border-radius: 6px;
  margin: 1px 6px;
}
.site-item {
  padding-left: 40px !important;
}
.min-w-0 {
  min-width: 0;
}
</style>
