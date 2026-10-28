<script setup lang="ts">
/**
 * «Внешние слои» на вкладке «Слои»: подложки и данные чужих серверов (WMS, WMTS, XYZ) под сетью ТГИД.
 * Логика — stores/externalLayerStore.ts, разбор адресов и GetCapabilities — utils/externalLayers.ts.
 */
import { computed, onMounted, ref, watch } from 'vue'
import HintTip from '~/components/HintTip.vue'
import { useExternalLayerStore } from '~/stores/externalLayerStore'
import { useNotificationStore } from '~/stores/notificationStore'
import {
  ExternalLayerError,
  normalizeServiceUrl,
  xyzTileUrl,
  type ExternalLayerKind,
  type ServiceLayerOption,
} from '~/utils/externalLayers'

const store = useExternalLayerStore()
const notificationStore = useNotificationStore()
const collapsed = ref(false)

const KIND_LABELS: Record<ExternalLayerKind, string> = { wms: 'WMS', wmts: 'WMTS', xyz: 'XYZ' }
const KIND_HINTS: Record<ExternalLayerKind, string> = {
  wms: 'Адрес WMS-сервиса, например https://gis.example.kz/geoserver/wms',
  wmts: 'Адрес WMTS-сервиса, например https://gis.example.kz/geoserver/gwc/service/wmts',
  xyz: 'Шаблон тайлов с {z}, {x}, {y}, например https://tile.example.kz/{z}/{x}/{y}.png',
}

const dialog = ref(false)
const kind = ref<ExternalLayerKind>('wms')
const url = ref('')
const name = ref('')
const options = ref<ServiceLayerOption[]>([])
const picked = ref<string | null>(null)
const busy = ref(false)
const error = ref('')

const pickedOption = computed(() => options.value.find((o) => o.name === picked.value) ?? null)
const canAdd = computed(() => !busy.value && url.value.trim() !== '' && (kind.value === 'xyz' || pickedOption.value !== null))

onMounted(() => store.load())

watch([kind, url], () => {
  options.value = []
  picked.value = null
  error.value = ''
})
watch(pickedOption, (o) => {
  if (o) name.value = o.title
})

const openDialog = () => {
  kind.value = 'wms'
  url.value = ''
  name.value = ''
  options.value = []
  picked.value = null
  error.value = ''
  dialog.value = true
}

const messageOf = (e: unknown): string =>
  e instanceof ExternalLayerError ? e.message : 'Не удалось обработать ответ сервера'

const discover = async () => {
  if (kind.value === 'xyz') return
  error.value = ''
  busy.value = true
  try {
    normalizeServiceUrl(url.value)
    options.value = await store.discover(kind.value, url.value)
    picked.value = options.value[0]?.name ?? null
  } catch (e) {
    error.value = messageOf(e)
  } finally {
    busy.value = false
  }
}

const add = () => {
  error.value = ''
  try {
    if (kind.value === 'xyz') {
      const tileUrl = xyzTileUrl(url.value)
      store.add({ kind: 'xyz', name: name.value.trim() || new URL(tileUrl.replace(/[{}]/g, '')).host, url: url.value.trim(), tileUrl })
    } else {
      const o = pickedOption.value
      if (!o) return
      store.add({
        kind: kind.value,
        name: name.value.trim() || o.title,
        url: normalizeServiceUrl(url.value),
        layer: o.name,
        tileUrl: o.tileUrl,
        minzoom: o.minzoom,
        maxzoom: o.maxzoom,
      })
    }
    dialog.value = false
    notificationStore.showSuccess('Слой добавлен на карту')
  } catch (e) {
    error.value = messageOf(e)
  }
}
</script>

<template>
  <div class="external-layers">
    <div class="group-header px-3 py-1">
      <v-icon
        size="13"
        class="me-1"
        color="secondary"
      >
        mdi-layers-plus
      </v-icon>
      <span class="section-label">Внешние слои</span>
      <v-spacer />
      <HintTip text="Добавить слой WMS, WMTS или XYZ с другого сервера">
        <template #default="{ props: tip }">
          <v-btn
            v-bind="tip"
            icon
            size="x-small"
            variant="text"
            aria-label="Добавить внешний слой"
            @click.stop="openDialog"
          >
            <v-icon size="14">
              mdi-plus
            </v-icon>
          </v-btn>
        </template>
      </HintTip>
      <v-btn
        icon
        size="x-small"
        variant="text"
        :aria-label="collapsed ? 'Развернуть внешние слои' : 'Свернуть внешние слои'"
        @click.stop="collapsed = !collapsed"
      >
        <v-icon size="14">
          {{ collapsed ? 'mdi-chevron-down' : 'mdi-chevron-up' }}
        </v-icon>
      </v-btn>
    </div>

    <div
      v-show="!collapsed"
      class="px-3 pb-2"
    >
      <p
        v-if="!store.layers.length"
        class="text-caption text-medium-emphasis mb-0"
      >
        Подложки и данные других серверов: ГИС «Панорама», ArcGIS, акиматы. Нажмите «+».
      </p>
      <div
        v-for="layer in store.layers"
        :key="layer.id"
        class="ext-row"
      >
        <div class="ext-row__head">
          <v-checkbox-btn
            :model-value="layer.visible"
            color="primary"
            density="compact"
            :aria-label="`Показать на карте: ${layer.name}`"
            @update:model-value="(v) => store.setVisible(layer.id, Boolean(v))"
          />
          <div class="ext-row__title">
            <span class="ext-row__name">{{ layer.name }}</span>
            <span class="ext-row__kind">{{ KIND_LABELS[layer.kind] }}{{ layer.layer ? ` · ${layer.layer}` : '' }}</span>
          </div>
          <v-btn
            icon
            size="x-small"
            variant="text"
            :aria-label="`Удалить слой ${layer.name}`"
            @click="store.remove(layer.id)"
          >
            <v-icon size="14">
              mdi-delete-outline
            </v-icon>
          </v-btn>
        </div>
        <v-slider
          :model-value="layer.opacity"
          :min="0"
          :max="1"
          :step="0.05"
          density="compact"
          hide-details
          color="primary"
          class="ext-row__opacity"
          :aria-label="`Прозрачность слоя ${layer.name}`"
          @update:model-value="(v) => store.setOpacity(layer.id, Number(v))"
        />
        <div
          v-if="store.errors[layer.id]"
          class="ext-row__error text-caption"
          role="status"
        >
          <v-icon
            size="13"
            color="error"
          >
            mdi-alert-circle-outline
          </v-icon>
          {{ store.errors[layer.id] }}
        </div>
      </div>
    </div>

    <v-dialog
      v-model="dialog"
      max-width="520"
    >
      <v-card title="Добавить внешний слой">
        <v-card-text class="d-flex flex-column ga-3">
          <v-btn-toggle
            v-model="kind"
            mandatory
            density="comfortable"
            color="primary"
            variant="outlined"
            divided
          >
            <v-btn value="wms">
              WMS
            </v-btn>
            <v-btn value="wmts">
              WMTS
            </v-btn>
            <v-btn value="xyz">
              XYZ
            </v-btn>
          </v-btn-toggle>
          <v-text-field
            id="external-layer-url"
            v-model="url"
            :label="kind === 'xyz' ? 'Шаблон тайлов' : 'Адрес сервиса'"
            :hint="KIND_HINTS[kind]"
            persistent-hint
            density="comfortable"
            autocomplete="off"
            @keydown.enter="kind === 'xyz' ? add() : discover()"
          />
          <v-btn
            v-if="kind !== 'xyz'"
            :loading="busy"
            :disabled="!url.trim()"
            variant="tonal"
            prepend-icon="mdi-magnify"
            @click="discover"
          >
            Найти слои на сервере
          </v-btn>
          <v-select
            v-if="options.length"
            id="external-layer-pick"
            v-model="picked"
            :items="options"
            item-title="title"
            item-value="name"
            label="Слой"
            density="comfortable"
          >
            <template #item="{ props: itemProps, item }">
              <v-list-item
                v-bind="itemProps"
                :subtitle="item.raw.name"
              />
            </template>
          </v-select>
          <v-text-field
            id="external-layer-name"
            v-model="name"
            label="Название в списке слоёв"
            density="comfortable"
            autocomplete="off"
          />
          <v-alert
            v-if="error"
            type="error"
            variant="tonal"
            density="compact"
          >
            {{ error }}
          </v-alert>
          <p class="text-caption text-medium-emphasis mb-0">
            Карта показывает только слои в Web Mercator (EPSG:3857). Слой виден только вам в этом
            браузере; сервер должен разрешать запросы с этого сайта (CORS).
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="dialog = false"
          >
            Отмена
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :disabled="!canAdd"
            @click="add"
          >
            Добавить
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
/* как заголовки блоков MapSidebarPanel; .section-label — общий стиль */
.group-header {
  display: flex;
  align-items: center;
  min-height: 32px;
  margin-top: var(--space-3);
}
.ext-row {
  padding: 4px 0;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.ext-row:last-child {
  border-bottom: 0;
}
.ext-row__head {
  display: flex;
  align-items: center;
  gap: 4px;
}
.ext-row__title {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.ext-row__name {
  font-size: 0.85rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ext-row__kind {
  font-size: 0.72rem;
  color: rgb(var(--v-theme-on-surface), 0.6);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ext-row__opacity {
  margin: 0 6px 0 40px;
}
.ext-row__error {
  display: flex;
  gap: 4px;
  align-items: flex-start;
  color: rgb(var(--v-theme-error));
  margin-left: 40px;
}
</style>
