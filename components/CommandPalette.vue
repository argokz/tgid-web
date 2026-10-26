<template>
  <v-dialog
    v-model="open"
    :max-width="mobile ? undefined : 640"
    :fullscreen="mobile"
    scrollable
    content-class="command-palette"
    :transition="mobile ? 'dialog-bottom-transition' : 'dialog-transition'"
  >
    <v-card
      :rounded="mobile ? '0' : 'lg'"
      class="command-palette__card"
      aria-label="Команды и поиск"
      @keydown.capture="onKeydown"
    >
      <div class="px-3 pt-3 pb-2">
        <SearchField
          v-model="query"
          placeholder="Команда, журнал, узел или адрес…"
          aria-label="Команда, журнал, узел или адрес"
          autofocus
          :debounce="150"
          :loading="busy"
          :result-count="query.trim() ? flat.length : null"
          @search="onSearch"
          @escape="open = false"
        />
      </div>
      <v-divider />
      <v-card-text
        ref="listEl"
        class="command-palette__list pa-0"
        role="listbox"
        aria-label="Результаты"
      >
        <div
          v-for="section in sections"
          :key="section.kind"
          role="group"
          :aria-labelledby="`cp-section-${section.kind}`"
        >
          <div
            :id="`cp-section-${section.kind}`"
            class="command-palette__section section-label px-4 pt-3 pb-1"
          >
            {{ section.title }}
          </div>
          <button
            v-for="item in section.items"
            :id="`cp-${item.id}`"
            :key="item.id"
            type="button"
            role="option"
            tabindex="-1"
            class="command-palette__item"
            :class="{ 'command-palette__item--active': item.id === activeId }"
            :aria-selected="item.id === activeId"
            @click="run(item)"
            @mousemove="activeId = item.id"
          >
            <v-icon
              size="18"
              class="command-palette__icon"
            >{{ item.icon }}</v-icon>
            <span class="command-palette__text">
              <span class="command-palette__title">{{ item.title }}</span>
              <span
                v-if="item.subtitle"
                class="command-palette__subtitle"
              >{{ item.subtitle }}</span>
            </span>
          </button>
        </div>
        <StateView
          v-if="!sections.length"
          :loading="busy"
          :empty="!busy"
          :rows="3"
          :empty-title="query.trim() ? 'Ничего не найдено' : 'Начните вводить'"
          :empty-text="query.trim() ? 'Попробуйте другое название, номер узла или адрес' : 'Журналы, инструменты, узлы сети и адреса — в одной строке'"
          empty-icon="mdi-magnify"
          loading-label="Ищем…"
        />
      </v-card-text>
      <v-divider />
      <div class="command-palette__footer px-4 py-2 text-caption text-medium-emphasis">
        <span><kbd>↑</kbd><kbd>↓</kbd> выбрать</span>
        <span><kbd>Enter</kbd> выполнить</span>
        <span><kbd>Esc</kbd> закрыть</span>
      </div>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import SearchField from '~/components/SearchField.vue';
import StateView from '~/components/StateView.vue';
import { useLocateMarkers } from '~/composables/useLocateMarkers';
import { useMobile } from '~/composables/useMobile';
import { useNominatim } from '~/composables/useNominatim';
import { useAuthStore } from '~/stores/authStore';
import { useMapStore } from '~/stores/mapStore';
import { useNotificationStore } from '~/stores/notificationStore';
import { useUiStore } from '~/stores/uiStore';
import { appStorage } from '~/utils/appStorage';
import { getCityConfig } from '~/utils/cityConfig';
import { KIND_TITLES, pushRecent, rankCommands, readRecent, type CommandItem, type CommandKind, type RecentEntry } from '~/utils/commandPalette';
import { findNodesUrl, geometryCenter, getNodeFragment, getNodeRsCode, getNodeSubtitle, getNodeTitle, getNodeType, nodeGeometryUrl, type NodeRecord } from '~/utils/nodeSearch';
import { filterByRole } from '~/utils/permissions';
import { TOOL_GROUPS } from '~/utils/toolCatalog';

/**
 * Палитра команд Ctrl+K (docs/ui-zones.md): журналы и инструменты из `toolCatalog` (по правам),
 * действия (панели, справка), узлы сети (WFS `find_node`, как в окне поиска узлов), адреса (геокодер —
 * внешний сервис, только по явному пункту «Искать адрес»), недавние команды. Открывает диалоги через
 * `uiStore.requestToolDialog`, к объектам перелетает с маркером `useLocateMarkers`.
 */
const open = defineModel<boolean>({ default: false });
const emit = defineEmits<{ 'open-hotkeys': [] }>();

const { isMobile: mobile } = useMobile();
const ui = useUiStore();
const authStore = useAuthStore();
const mapStore = useMapStore();
const notify = useNotificationStore();
const config = useRuntimeConfig();
const { searchAddress } = useNominatim();
const locateMarkers = useLocateMarkers(() => mapStore.map);

const NODE_QUERY_MIN = 2;
const ADDRESS_QUERY_MIN = 3;
const NODE_ZOOM = 17;
const ADDRESS_ZOOM = 16;
const MAX_PER_SECTION = 8;
const RECENT_PREFIX = 'recent:';
const ADDRESS_SEARCH_ID = 'address-search';

const query = ref('');
/** Запрос, для которого показаны узлы (результаты старого запроса не показываются) */
const searched = ref('');
const loading = ref(false);
const nodeItems = ref<CommandItem[]>([]);
/** Запрос, для которого искали адреса (по явному действию) */
const addressQuery = ref('');
const addressItems = ref<CommandItem[]>([]);
const addressLoading = ref(false);
const recent = ref<RecentEntry[]>([]);
const activeId = ref<string | null>(null);
const listEl = ref<{ $el?: HTMLElement } | null>(null);

const geoServerUrl = () => String((config.public as { geoserver?: { url?: string } }).geoserver?.url || '');
const trimmed = computed(() => query.value.trim());
/** Узлы ещё ищутся или ждут паузы ввода — не показывать «ничего не найдено» раньше времени */
const busy = computed(() => loading.value || addressLoading.value
  || (trimmed.value.length >= NODE_QUERY_MIN && searched.value !== trimmed.value));

/** Перелёт к точке с маркером палитры */
const goTo = (center: [number, number], label: string, zoom: number) => {
  if (!mapStore.map) {
    notify.showInfo('Карта ещё не готова');
    return;
  }
  locateMarkers.locate('palette', { longitude: center[0], latitude: center[1], label }, { zoom, popupText: () => label });
};

const actionItems = computed<CommandItem[]>(() => [
  { id: 'action:tools', kind: 'action', title: 'Инструменты', subtitle: 'Журналы, реестры, отчёты, диагностика', icon: 'mdi-toolbox-outline', run: () => ui.toggleToolsPanel(true) },
  { id: 'action:draw', kind: 'action', title: 'Измерения на карте', subtitle: 'Расстояние, площадь, профиль высот', icon: 'mdi-ruler', run: () => ui.toggleDrawPanel(true) },
  { id: 'action:hotkeys', kind: 'action', title: 'Горячие клавиши', subtitle: 'Справка по клавиатуре (?)', icon: 'mdi-keyboard-outline', run: () => emit('open-hotkeys') },
]);

/** Инструменты каталога по правам пользователя — те же, что в панели «Инструменты» */
const toolItems = computed<CommandItem[]>(() =>
  filterByRole(TOOL_GROUPS, authStore.permissions).flatMap((group) =>
    group.items.map((tool) => ({
      id: `tool:${tool.event}`,
      kind: 'tool' as const,
      title: tool.label,
      subtitle: tool.hint,
      keywords: group.title,
      icon: tool.icon,
      run: () => ui.requestToolDialog(tool.dialog),
    }))),
);

const staticItems = computed(() => [...actionItems.value, ...toolItems.value]);

/** Недавние — как команды: статические по id, узлы и адреса — по сохранённым координатам */
const recentItems = computed<CommandItem[]>(() => recent.value.flatMap((entry) => {
  // свой id у «недавнего» — иначе подсветка активного падала бы и на такую же команду в списке ниже
  const known = staticItems.value.find((i) => i.id === entry.id);
  if (known) return [{ ...known, id: RECENT_PREFIX + known.id }];
  if (!entry.center) return [];
  const center = entry.center;
  return [{
    id: RECENT_PREFIX + entry.id,
    kind: entry.kind,
    title: entry.title,
    subtitle: entry.subtitle,
    icon: entry.kind === 'node' ? 'mdi-map-marker-radius-outline' : 'mdi-map-search-outline',
    run: () => goTo(center, entry.title, entry.kind === 'node' ? NODE_ZOOM : ADDRESS_ZOOM),
  }];
}));

/** Явный пункт «Искать адрес»: геокодер — внешний сервис, по нему не ищем на каждую паузу ввода */
const addressSearchItem = computed<CommandItem | null>(() => (trimmed.value.length >= ADDRESS_QUERY_MIN && addressQuery.value !== trimmed.value
  ? {
    id: ADDRESS_SEARCH_ID,
    kind: 'address',
    title: `Искать адрес «${trimmed.value}»`,
    subtitle: 'Геокодер OpenStreetMap — внешний сервис',
    icon: 'mdi-map-search-outline',
    keepOpen: true,
    run: () => loadAddresses(trimmed.value),
  }
  : null));

interface Section {
  kind: CommandKind | 'recent';
  title: string;
  items: CommandItem[];
}

const sections = computed<Section[]>(() => {
  const q = trimmed.value;
  const out: Section[] = [];
  if (!q) {
    if (recentItems.value.length) out.push({ kind: 'recent', title: 'Недавние', items: recentItems.value });
    out.push({ kind: 'action', title: KIND_TITLES.action, items: actionItems.value });
    out.push({ kind: 'tool', title: KIND_TITLES.tool, items: toolItems.value.slice(0, MAX_PER_SECTION) });
    return out;
  }
  const actions = rankCommands(q, actionItems.value);
  const tools = rankCommands(q, toolItems.value).slice(0, MAX_PER_SECTION);
  if (actions.length) out.push({ kind: 'action', title: KIND_TITLES.action, items: actions });
  if (tools.length) out.push({ kind: 'tool', title: KIND_TITLES.tool, items: tools });
  // результаты — только для текущего запроса: иначе Enter выполнил бы узел от прежнего текста
  if (searched.value === q && nodeItems.value.length) out.push({ kind: 'node', title: KIND_TITLES.node, items: nodeItems.value });
  const addresses = [
    ...(addressQuery.value === q ? addressItems.value : []),
    ...(addressSearchItem.value ? [addressSearchItem.value] : []),
  ];
  if (addresses.length) out.push({ kind: 'address', title: KIND_TITLES.address, items: addresses });
  return out;
});

const flat = computed(() => sections.value.flatMap((s) => s.items));

watch(flat, (items) => {
  if (!items.some((i) => i.id === activeId.value)) activeId.value = items[0]?.id ?? null;
});

const nodeSubtitle = (node: NodeRecord) =>
  [getNodeType(node), getNodeRsCode(node), getNodeFragment(node) && `фрагмент ${getNodeFragment(node)}`, getNodeSubtitle(node)]
    .filter(Boolean).join(' · ');

const goToNode = async (node: NodeRecord, title: string) => {
  const base = geoServerUrl();
  if (!base || node.id == null) {
    notify.showError('Не удалось получить координаты узла');
    return;
  }
  try {
    const response = await fetch(nodeGeometryUrl(base, getCityConfig().workspace, node.id));
    const data = response.ok && response.headers.get('content-type')?.includes('json') ? await response.json() : null;
    const center = geometryCenter(data?.features?.[0]?.geometry);
    if (!center) {
      notify.showError('Не удалось получить координаты узла');
      return;
    }
    pushRecent(appStorage, { id: `node:${node.id}`, kind: 'node', title, subtitle: nodeSubtitle(node), center });
    goTo(center, title, NODE_ZOOM);
  } catch (error) {
    notify.showError(`Не удалось получить координаты узла: ${error instanceof Error ? error.message : String(error)}`);
  }
};

let abort: AbortController | null = null;

/** Узлы (WFS find_node) — после паузы ввода; результаты только для последнего запроса и открытой палитры */
const onSearch = async (q: string) => {
  abort?.abort();
  abort = null;
  if (!open.value) return;
  if (q.length < NODE_QUERY_MIN) {
    nodeItems.value = [];
    searched.value = q;
    loading.value = false;
    return;
  }
  const base = geoServerUrl();
  if (!base) {
    nodeItems.value = [];
    searched.value = q;
    return;
  }
  const controller = new AbortController();
  abort = controller;
  loading.value = true;
  try {
    const response = await fetch(findNodesUrl(base, getCityConfig().workspace, q), { signal: controller.signal });
    const ok = response.ok && response.headers.get('content-type')?.includes('json');
    const data = ok ? await response.json() : { features: [] };
    if (controller.signal.aborted) return;
    const nodes: NodeRecord[] = data.features?.map((f: { properties: NodeRecord }) => f.properties) || [];
    nodeItems.value = nodes.slice(0, MAX_PER_SECTION).map((node) => {
      const title = getNodeTitle(node);
      return { id: `node:${node.id}`, kind: 'node' as const, title, subtitle: nodeSubtitle(node), icon: 'mdi-map-marker-radius-outline', run: () => goToNode(node, title) };
    });
    searched.value = q;
  } catch (error) {
    if ((error as Error).name === 'AbortError') return;
    notify.showWarning('Поиск узлов недоступен');
    nodeItems.value = [];
    searched.value = q;
  } finally {
    if (abort === controller) {
      loading.value = false;
      abort = null;
    }
  }
};

/** Адреса — только по явному пункту; геокодера в интранете может не быть, тогда раздел пуст */
const loadAddresses = async (q: string) => {
  addressLoading.value = true;
  try {
    const results = await searchAddress(q);
    if (!open.value || trimmed.value !== q) return;
    addressItems.value = results.slice(0, MAX_PER_SECTION).map((r) => {
      const center: [number, number] = [Number(r.lon), Number(r.lat)];
      return {
        id: `addr:${r.place_id}`,
        kind: 'address' as const,
        title: r.display_name,
        icon: 'mdi-map-search-outline',
        run: () => {
          pushRecent(appStorage, { id: `addr:${r.place_id}`, kind: 'address', title: r.display_name, center });
          goTo(center, r.display_name, ADDRESS_ZOOM);
        },
      };
    });
    addressQuery.value = q;
    if (!results.length) notify.showInfo('Адрес не найден (или геокодер недоступен)');
  } finally {
    addressLoading.value = false;
  }
};

const run = async (item: CommandItem) => {
  const id = item.id.startsWith(RECENT_PREFIX) ? item.id.slice(RECENT_PREFIX.length) : item.id;
  if (item.kind === 'action' || item.kind === 'tool') pushRecent(appStorage, { id, kind: item.kind, title: item.title, subtitle: item.subtitle });
  if (!item.keepOpen) open.value = false;
  await item.run();
};

const scrollActiveIntoView = () => {
  const root = listEl.value?.$el;
  const el = root?.querySelector<HTMLElement>(`#cp-${CSS.escape(activeId.value ?? '')}`);
  el?.scrollIntoView({ block: 'nearest' });
};

/**
 * Стрелки, Home/End, Enter — по плоскому списку (capture: Enter перехватывается раньше SearchField, иначе
 * она запускала бы ещё один поиск); Esc закрывает диалог сам Vuetify.
 */
const onKeydown = (e: KeyboardEvent) => {
  const items = flat.value;
  if (!items.length) return;
  const current = Math.max(0, items.findIndex((i) => i.id === activeId.value));
  const step: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };
  if (e.key in step) {
    activeId.value = items[(current + step[e.key] + items.length) % items.length].id;
  } else if (e.key === 'Home') {
    activeId.value = items[0].id;
  } else if (e.key === 'End') {
    activeId.value = items[items.length - 1].id;
  } else if (e.key === 'Enter') {
    const item = items.find((i) => i.id === activeId.value);
    if (item) void run(item);
  } else {
    return;
  }
  e.preventDefault();
  e.stopPropagation();
  scrollActiveIntoView();
};

watch(open, (isOpen) => {
  abort?.abort();
  abort = null;
  loading.value = false;
  addressLoading.value = false;
  if (!isOpen) return;
  query.value = '';
  searched.value = '';
  nodeItems.value = [];
  addressItems.value = [];
  addressQuery.value = '';
  recent.value = readRecent(appStorage);
  activeId.value = flat.value[0]?.id ?? null;
}, { immediate: true });

defineExpose({ sections, activeId, onSearch, loadAddresses });
</script>

<style>
/* Палитра — у верха экрана, как в редакторах кода; оверлей Vuetify — без scoped */
.command-palette {
  align-self: flex-start;
  margin-top: 8vh;
}
@media (max-width: 959px) {
  .command-palette {
    margin-top: 0;
  }
}
</style>

<style scoped>
.command-palette__card {
  display: flex;
  flex-direction: column;
  max-height: min(70vh, 640px);
}

.command-palette__list {
  min-height: 160px;
  overflow: auto;
  overscroll-behavior: contain;
}

.command-palette__item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-2) var(--space-4);
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.command-palette__item--active,
.command-palette__item:focus-visible {
  background: var(--accent-soft);
  outline: none;
}

.command-palette__icon {
  flex: 0 0 auto;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.command-palette__item--active .command-palette__icon {
  color: var(--accent-text);
}

.command-palette__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.command-palette__title {
  font-size: var(--text-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.command-palette__subtitle {
  font-size: var(--text-xs);
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.command-palette__footer {
  display: flex;
  gap: var(--space-4);
}

.command-palette__footer kbd {
  margin-right: 2px;
  padding: 0 4px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.3);
  border-radius: 4px;
  font: inherit;
  font-size: 11px;
}
</style>
