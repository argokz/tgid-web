<template>
  <div class="sidebar-inner">
    <!-- Шапка -->
    <div class="sidebar-header">
      <div class="d-flex align-center" style="gap: 12px;">
        <v-avatar size="34" color="primary">
          <v-icon color="white" size="18">{{ sidebarIcon }}</v-icon>
        </v-avatar>
        <div>
          <div class="text-subtitle-2 font-weight-semibold">{{ sidebarTitle }}</div>
          <div class="text-caption text-medium-emphasis">{{ tabSubtitle }}</div>
        </div>
      </div>
      <v-btn
        icon
        variant="text"
        color="grey-darken-1"
        size="small"
        aria-label="Закрыть панель"
        @click="$emit('close')"
      >
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </div>

    <!-- Табы -->
    <v-tabs
      v-model="activeTabLocal"
      bg-color="white"
      color="primary"
      density="compact"
      class="sidebar-tabs"
    >
      <v-tab value="layers" density="compact">
        <v-icon class="me-1" size="16">mdi-layers</v-icon>Слои
      </v-tab>
      <v-tab value="fragments" density="compact">
        <v-icon class="me-1" size="16">mdi-map-marker-multiple</v-icon>Фрагменты
        <v-chip
          v-if="pendingFragments.length > 0"
          size="x-small"
          color="primary"
          class="ms-1"
        >
          {{ pendingFragments.length }}
        </v-chip>
      </v-tab>
      <v-tab value="labels" density="compact">
        <v-icon class="me-1" size="16">mdi-label-multiple</v-icon>Подписи
        <v-chip
          v-if="pendingLabels.length > 0"
          size="x-small"
          color="primary"
          class="ms-1"
        >
          {{ pendingLabels.length }}
        </v-chip>
      </v-tab>
    </v-tabs>
    <v-divider />

    <v-window v-model="activeTabLocal" class="sidebar-window">

      <!-- ── СЛОИ ── -->
      <v-window-item value="layers">
        <div class="tab-content">
          <div class="content-area">
            <div class="group-header px-3 py-2 mt-1">
              <v-icon size="13" class="me-1" color="grey-darken-2">mdi-earth</v-icon>
              <span class="text-caption font-weight-bold text-grey-darken-2 text-uppercase">
                Слои контекста
              </span>
              <v-spacer />
              <v-btn
                icon
                size="x-small"
                variant="text"
                :aria-label="contextSectionCollapsed ? 'Развернуть блок слоёв контекста' : 'Свернуть блок слоёв контекста'"
                @click.stop="contextSectionCollapsed = !contextSectionCollapsed"
              >
                <v-icon size="14">
                  {{ contextSectionCollapsed ? 'mdi-chevron-down' : 'mdi-chevron-up' }}
                </v-icon>
              </v-btn>
            </div>
            <div v-show="!contextSectionCollapsed" class="px-3 pb-1">
              <v-switch
                :model-value="contextHoverInspectEnabled"
                class="context-hover-switch"
                density="comfortable"
                color="primary"
                hide-details
                @update:model-value="(v) => mapStore.setContextHoverInspectMode(Boolean(v))"
              >
                <template #label>
                  <span class="text-caption">Режим наведения (атрибуты)</span>
                </template>
              </v-switch>
            </div>
            <div
              v-show="!contextSectionCollapsed"
              v-if="!mapTilerReady"
              class="px-3 pb-2 text-caption text-medium-emphasis"
            >
              Задайте NUXT_PUBLIC_MAPTILER_KEY в .env, чтобы включить подложки MapTiler.
            </div>
            <v-list v-show="!contextSectionCollapsed" density="compact" class="py-0 mb-2 compact-list">
              <v-list-item
                v-for="row in contextLayerRows"
                :key="row.key"
                class="layer-item compact-layer-item"
                :class="{ active: isPendingContextLayerVisible(row.key) }"
              >
                <template #prepend>
                  <v-checkbox-btn
                    :model-value="isPendingContextLayerVisible(row.key)"
                    color="primary"
                    :disabled="!mapTilerReady"
                    :aria-label="`Показать на карте: ${row.title}. ${row.subtitle}`"
                    @click.stop="togglePendingContextLayer(row.key)"
                  />
                </template>
                <v-list-item-title class="text-body-2">
                  {{ row.title }}
                </v-list-item-title>
                <v-list-item-subtitle class="text-caption text-grey compact-subtitle">
                  {{ row.subtitle }}
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>

            <v-dialog
              :model-value="planetStyleTarget !== null"
              :max-width="planetStyleDialogWidth"
              scroll-strategy="reposition"
              @update:model-value="(v) => { if (!v) planetStyleTarget = null }"
            >
              <v-card v-if="planetStyleTarget" density="compact" class="planet-style-card">
                <v-card-title class="text-subtitle-2 py-2 px-3 d-flex align-center">
                  <span class="text-truncate">{{ planetStyleTarget.label }}</span>
                  <v-spacer />
                  <v-btn icon size="x-small" variant="text" aria-label="Закрыть" @click="planetStyleTarget = null">
                    <v-icon size="18">mdi-close</v-icon>
                  </v-btn>
                </v-card-title>
                <v-divider />
                <v-card-text class="py-2 px-3">
                  <div v-if="planetStyleCaps?.hasColor" class="mb-2">
                    <div class="text-caption text-medium-emphasis mb-1">Цвет</div>
                    <div class="d-flex align-center" style="gap: 8px;">
                      <input
                        v-model="planetStyleForm.color"
                        type="color"
                        class="planet-color-input"
                        aria-label="Цвет слоя"
                      >
                      <v-text-field
                        v-model="planetStyleForm.color"
                        density="compact"
                        hide-details
                        variant="outlined"
                        class="flex-grow-1"
                      />
                    </div>
                  </div>
                  <div v-if="planetStyleCaps?.hasOpacity" class="mb-1">
                    <div class="d-flex justify-space-between text-caption text-medium-emphasis mb-0">
                      <span>Прозрачность</span>
                      <span>{{ planetStyleForm.opacity }}%</span>
                    </div>
                    <v-slider
                      v-model="planetStyleForm.opacity"
                      density="compact"
                      hide-details
                      :min="0"
                      :max="100"
                      :step="1"
                      color="primary"
                    />
                  </div>
                  <div v-if="planetStyleCaps?.hasTextSize" class="mb-1">
                    <div class="d-flex justify-space-between text-caption text-medium-emphasis mb-0">
                      <span>Размер подписи</span>
                      <span>{{ planetStyleForm.textSize }}px</span>
                    </div>
                    <v-slider
                      v-model="planetStyleForm.textSize"
                      density="compact"
                      hide-details
                      :min="8"
                      :max="24"
                      :step="1"
                      color="primary"
                    />
                  </div>
                </v-card-text>
                <v-divider />
                <v-card-actions class="px-3 py-2 justify-end" style="gap: 6px;">
                  <v-btn size="small" variant="text" @click="onPlanetStyleReset">Сброс</v-btn>
                  <v-btn size="small" color="primary" variant="flat" @click="onPlanetStyleApply">OK</v-btn>
                </v-card-actions>
              </v-card>
            </v-dialog>

            <!-- ── Planet V4 слои ── -->
            <template v-if="mapStore.selectedBaseLayer === 'planet-v4'">
              <div class="group-header px-3 py-2 mt-1">
                <v-icon size="13" class="me-1" color="grey-darken-2">mdi-earth</v-icon>
                <span class="text-caption font-weight-bold text-grey-darken-2 text-uppercase">
                  Слои Planet V4
                </span>
                <v-spacer />
                <v-btn
                  icon
                  size="x-small"
                  variant="text"
                  :aria-label="planetSectionCollapsed ? 'Развернуть блок слоёв Planet V4' : 'Свернуть блок слоёв Planet V4'"
                  @click.stop="planetSectionCollapsed = !planetSectionCollapsed"
                >
                  <v-icon size="14">
                    {{ planetSectionCollapsed ? 'mdi-chevron-down' : 'mdi-chevron-up' }}
                  </v-icon>
                </v-btn>
              </div>
              <div v-show="!planetSectionCollapsed">
                <div
                  v-for="pg in planetLayerGroups"
                  :key="pg.group"
                  class="mb-0"
                >
                  <div class="group-header px-3 py-1" style="background: transparent;">
                    <v-icon size="12" class="me-1" color="grey-darken-1">{{ pg.icon }}</v-icon>
                    <span class="text-caption font-weight-medium text-grey-darken-1">
                      {{ pg.label }}
                    </span>
                    <v-spacer />
                    <v-btn
                      icon
                      size="x-small"
                      variant="text"
                      class="mr-n1"
                      :aria-label="`Включить или отключить все слои группы «${pg.label}»`"
                      @click.stop="togglePlanetGroupAll(pg)"
                    >
                      <v-icon size="12">
                        {{ isPlanetGroupAllVisible(pg) ? 'mdi-checkbox-marked' : isPlanetGroupPartial(pg) ? 'mdi-minus-box' : 'mdi-checkbox-blank-outline' }}
                      </v-icon>
                    </v-btn>
                    <v-btn
                      icon
                      size="x-small"
                      variant="text"
                      :aria-label="isPlanetGroupCollapsed(pg.group) ? `Развернуть группу «${pg.label}»` : `Свернуть группу «${pg.label}»`"
                      @click.stop="togglePlanetGroupCollapsed(pg.group)"
                    >
                      <v-icon size="14">
                        {{ isPlanetGroupCollapsed(pg.group) ? 'mdi-chevron-down' : 'mdi-chevron-up' }}
                      </v-icon>
                    </v-btn>
                  </div>
                  <v-list
                    v-show="!isPlanetGroupCollapsed(pg.group)"
                    density="compact"
                    class="py-0 compact-list"
                  >
                    <v-list-item
                      v-for="pl in pg.layers"
                      :key="pl.sourceLayer"
                      class="layer-item compact-layer-item"
                      style="min-height: 28px;"
                    >
                      <template #prepend>
                        <v-checkbox-btn
                          :model-value="mapStore.visiblePlanetLayers.includes(pl.sourceLayer)"
                          color="primary"
                          density="compact"
                          :aria-label="`Показать слой Planet: ${pl.label}`"
                          @click.stop="mapStore.setPlanetLayerVisible(pl.sourceLayer, !mapStore.visiblePlanetLayers.includes(pl.sourceLayer))"
                        />
                      </template>
                      <v-list-item-title class="text-body-2" style="font-size: 0.8rem !important;">
                        {{ pl.label }}
                      </v-list-item-title>
                      <template #append>
                        <v-btn
                          icon
                          size="x-small"
                          variant="text"
                          class="ms-n1"
                          :aria-label="`Стиль слоя: ${pl.label}`"
                          @click.stop="openPlanetStyleDialog(pl)"
                        >
                          <v-icon size="16">mdi-palette-outline</v-icon>
                        </v-btn>
                      </template>
                    </v-list-item>
                  </v-list>
                </div>
              </div>
            </template>

            <div class="px-3 pt-2 pb-1">
              <v-text-field
                v-model="layerSearchLocal"
                density="compact"
                variant="outlined"
                hide-details
                clearable
                prepend-inner-icon="mdi-magnify"
                placeholder="Поиск слоя…"
                aria-label="Поиск по слоям"
              />
            </div>

            <div
              v-for="group in layerGroups"
              :key="group.name"
              class="mb-1"
            >
              <div
                v-if="group.name !== 'default'"
                class="group-header px-3 py-1"
              >
                <v-icon size="13" class="me-1" color="grey-darken-2">mdi-folder-outline</v-icon>
                <span class="text-caption font-weight-bold text-grey-darken-2 text-uppercase">
                  {{ formatGroupName(group.name) }}
                </span>
                <v-spacer />
                <v-btn
                  icon
                  size="x-small"
                  variant="text"
                  :aria-label="isGroupCollapsed(group.name) ? `Развернуть группу «${formatGroupName(group.name)}»` : `Свернуть группу «${formatGroupName(group.name)}»`"
                  @click.stop="toggleGroupCollapsed(group.name)"
                >
                  <v-icon size="14">
                    {{ isGroupCollapsed(group.name) ? 'mdi-chevron-down' : 'mdi-chevron-up' }}
                  </v-icon>
                </v-btn>
              </div>

              <v-list
                v-show="!isGroupCollapsed(group.name)"
                density="compact"
                class="py-0 compact-list working-layers-list"
              >
                <v-list-item
                  v-for="layer in group.layers"
                  :key="layer.layerId"
                  class="layer-item compact-layer-item tight-left-item working-layer-item"
                  :class="{ active: pendingVisible.includes(layer.layerId) }"
                >
                  <template #prepend>
                    <div class="d-flex align-center layer-prepend">
                      <v-chip size="x-small" color="grey-lighten-3" class="me-1 order-chip working-order-chip">
                        {{ getLayerOrder(layer.layerId) }}
                      </v-chip>
                      <v-checkbox-btn
                        class="layer-checkbox"
                        density="compact"
                        :model-value="pendingVisible.includes(layer.layerId)"
                        color="primary"
                        :aria-label="`Показать слой: ${layer.label || layer.displayName || layer.sourceLayer}`"
                        @click.stop="togglePendingLayer(layer.layerId)"
                      />
                    </div>
                  </template>

                  <v-list-item-title class="text-body-2 text-truncate layer-name">
                    {{ layer.label || layer.displayName || layer.sourceLayer }}
                  </v-list-item-title>
                  <v-list-item-subtitle class="text-caption text-grey text-truncate compact-subtitle working-subtitle">
                    {{ layer.workspace }} / {{ layer.sourceLayer }}
                  </v-list-item-subtitle>

                  <div
                    v-if="layerSupportsFormatToggle(layer)"
                    class="format-row mt-1"
                    @click.stop
                  >
                    <v-btn-toggle
                      :model-value="getPendingFormat(layer.layerId)"
                      density="compact"
                      color="primary"
                      variant="outlined"
                      mandatory
                      rounded="lg"
                      class="format-toggle"
                      @update:model-value="(fmt) => fmt && setPendingFormat(layer.layerId, fmt)"
                    >
                      <v-btn value="mvt" size="x-small" class="format-btn">MVT</v-btn>
                      <v-btn value="wms" size="x-small" class="format-btn">WMS</v-btn>
                    </v-btn-toggle>
                  </div>

                  <div
                    v-if="pendingVisible.includes(layer.layerId)"
                    class="opacity-row mt-1"
                    @click.stop
                  >
                    <div class="d-flex align-center justify-space-between mb-1">
                      <span class="text-caption text-grey-darken-1">Прозрачность</span>
                      <span class="text-caption font-weight-medium">
                        {{ Math.round((layerOpacities[layer.layerId] ?? 1) * 100) }}%
                      </span>
                    </div>
                    <v-slider
                      :model-value="layerOpacities[layer.layerId] ?? 1"
                      :min="0"
                      :max="1"
                      :step="0.05"
                      color="primary"
                      hide-details
                      density="compact"
                      :name="`Прозрачность: ${layer.label || layer.displayName || layer.sourceLayer}`"
                      @update:model-value="(v) => $emit('opacity-change', layer.layerId, v)"
                    />
                  </div>

                  <template #append>
                    <div class="d-flex flex-column" style="gap: 2px;">
                      <v-btn
                        icon
                        size="x-small"
                        variant="text"
                        :disabled="getLayerOrder(layer.layerId) === 1"
                        :aria-label="`Переместить слой «${layer.label || layer.displayName || layer.sourceLayer}» вверх`"
                        @click.stop="$emit('move-up', layer.layerId)"
                      >
                        <v-icon size="16">mdi-chevron-up</v-icon>
                      </v-btn>
                      <v-btn
                        icon
                        size="x-small"
                        variant="text"
                        :disabled="getLayerOrder(layer.layerId) === layerStore.geoServerLayers.length"
                        :aria-label="`Переместить слой «${layer.label || layer.displayName || layer.sourceLayer}» вниз`"
                        @click.stop="$emit('move-down', layer.layerId)"
                      >
                        <v-icon size="16">mdi-chevron-down</v-icon>
                      </v-btn>
                    </div>
                  </template>
                </v-list-item>
              </v-list>
            </div>
          </div>
          <div class="sidebar-footer">
            <v-divider />
            <div class="px-3 py-2 d-flex align-center" style="gap: 8px;">
              <v-spacer />
              <v-btn
                class="apply-btn"
                color="primary"
                size="small"
                variant="flat"
                :disabled="!hasPendingLayerChanges || layersApplying"
                :loading="layersApplying"
                @click="applyPendingLayers"
              >
                Применить
              </v-btn>
            </div>
          </div>
        </div>
      </v-window-item>

      <!-- ── ФРАГМЕНТЫ ── -->
      <v-window-item value="fragments">
        <div class="tab-content">
          <div class="px-3 pt-1 pb-1 text-caption text-medium-emphasis">
            Выберите фрагменты и нажмите «Применить».
          </div>
          <div class="search-section pa-3 pb-2">
            <v-text-field
              v-model="fragmentSearchLocal"
              prepend-inner-icon="mdi-magnify"
              label="Поиск фрагментов..."
              variant="outlined"
              density="compact"
              hide-details
              clearable
              rounded="lg"
            />
          </div>
          <div class="content-area">
            <v-list v-if="filteredFragments.length > 0" density="comfortable">
              <v-list-item
                v-for="item in filteredFragments"
                :key="item.id"
                class="layer-item"
                :class="{ active: pendingFragments.includes(item.id) }"
                @click="togglePendingFragment(item.id)"
              >
                <template #prepend>
                  <v-checkbox-btn
                    :model-value="pendingFragments.includes(item.id)"
                    color="primary"
                    :aria-label="`Выбрать фрагмент: ${item.name}`"
                    @click.stop="togglePendingFragment(item.id)"
                  />
                </template>
                <v-list-item-title class="text-body-2">{{ item.name }}</v-list-item-title>
                <v-list-item-subtitle class="text-caption">ID: {{ item.id }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>

            <div
              v-else-if="fragmentsLoading"
              class="pa-8 text-center"
            >
              <v-progress-circular
                indeterminate
                size="40"
                color="primary"
                aria-label="Загрузка списка фрагментов"
              />
              <div class="text-body-2 text-grey mt-3">Загрузка...</div>
            </div>
            <div
              v-else-if="fragmentStore.fragments.length === 0"
              class="pa-8 text-center text-grey"
            >
              <v-icon size="44" color="grey-lighten-2">mdi-map-marker-multiple-outline</v-icon>
              <div class="text-body-2 mt-2">Фрагменты не загружены</div>
              <v-btn
                size="small"
                color="primary"
                variant="tonal"
                class="mt-3"
                @click="$emit('load-fragments')"
              >
                Загрузить
              </v-btn>
            </div>
            <div
              v-else
              class="pa-8 text-center text-grey"
            >
              <v-icon size="44" color="grey-lighten-2">mdi-filter-off</v-icon>
              <div class="text-body-2 mt-2">Ничего не найдено</div>
            </div>
          </div>
          <div class="sidebar-footer">
            <v-divider />
            <div class="px-3 py-2 d-flex align-center flex-wrap" style="gap: 8px;">
              <span class="text-caption text-grey">
                В черновике: <strong>{{ pendingFragments.length }}</strong>
                / {{ fragmentStore.fragments.length }}
              </span>
              <v-spacer />
              <v-btn
                size="x-small"
                variant="text"
                color="error"
                :disabled="pendingFragments.length === 0"
                @click="clearPendingFragments"
              >
                Сбросить
              </v-btn>
              <v-btn
                color="primary"
                size="small"
                variant="flat"
                :disabled="!hasPendingFragmentChanges || fragmentsApplying"
                :loading="fragmentsApplying"
                @click="applyPendingFragments"
              >
                Применить
              </v-btn>
            </div>
          </div>
        </div>
      </v-window-item>

      <!-- ── ПОДПИСИ ── -->
      <v-window-item value="labels">
        <div class="tab-content">
          <div class="px-3 pt-1 pb-1 text-caption text-medium-emphasis">
            Выберите подписи и нажмите «Применить».
          </div>
          <div class="search-section pa-3 pb-2">
            <v-text-field
              v-model="labelSearchLocal"
              prepend-inner-icon="mdi-magnify"
              label="Поиск подписей..."
              variant="outlined"
              density="compact"
              hide-details
              clearable
              rounded="lg"
            />
          </div>
          <div class="content-area">
            <v-list density="comfortable">
              <v-list-item
                v-for="item in filteredLabels"
                :key="item.id"
                class="layer-item"
                :class="{ active: pendingLabels.includes(item.id) }"
                @click="togglePendingLabel(item.id)"
              >
                <template #prepend>
                  <v-checkbox-btn
                    :model-value="pendingLabels.includes(item.id)"
                    color="primary"
                    :aria-label="`Подпись на карте: ${item.label}`"
                    @click.stop="togglePendingLabel(item.id)"
                  />
                </template>
                <v-list-item-title class="d-flex align-center text-body-2">
                  <v-icon
                    :color="pendingLabels.includes(item.id) ? 'primary' : getLabelIconColor(item.id)"
                    size="16"
                    class="me-2"
                  >
                    {{ item.icon }}
                  </v-icon>
                  {{ item.label }}
                </v-list-item-title>
                <v-list-item-subtitle class="text-caption" style="padding-left: 24px;">
                  {{ item.id }}
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
            <div
              v-if="filteredLabels.length === 0 && labelSearchLocal"
              class="pa-8 text-center text-grey"
            >
              <v-icon size="44" color="grey-lighten-2">mdi-file-search-outline</v-icon>
              <div class="text-body-2 mt-2">Ничего не найдено</div>
            </div>
          </div>
          <div class="sidebar-footer">
            <v-divider />
            <div class="px-3 py-2 d-flex align-center flex-wrap" style="gap: 8px;">
              <span class="text-caption text-grey">
                В черновике: <strong>{{ pendingLabels.length }}</strong>
                / {{ AVAILABLE_LABELS.length }}
              </span>
              <v-spacer />
              <v-btn
                size="x-small"
                variant="text"
                color="error"
                :disabled="pendingLabels.length === 0"
                @click="clearPendingLabels"
              >
                Сбросить
              </v-btn>
              <v-btn
                color="primary"
                size="small"
                variant="flat"
                :disabled="!hasPendingLabelChanges || labelsApplying"
                :loading="labelsApplying"
                @click="applyPendingLabels"
              >
                Применить
              </v-btn>
            </div>
          </div>
        </div>
      </v-window-item>
    </v-window>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useDisplay } from 'vuetify'
import { storeToRefs } from 'pinia'
import { useLayerStore } from '~/stores/layerStore'
import { useMapStore } from '~/stores/mapStore'
import { useFragmentStore } from '~/stores/fragmentStore'
import { useLabelStore } from '~/stores/labelStore'
import type { ContextLayerKey } from '~/utils/contextMapLayers'
import { getMapTilerKey } from '~/utils/maptiler'
import {
  getPlanetLayersByGroup,
  getPlanetLayerUiCaps,
  type PlanetLayerGroup,
  type PlanetLayerDef,
  type PlanetLayerStyleOverride,
} from '~/utils/planetV4Layers'

const { mobile } = useDisplay()
const planetStyleDialogWidth = computed(() =>
  mobile.value ? 'min(340px, calc(100vw - 24px))' : 340
)

const props = defineProps<{
  layerOpacities: Record<string, number>
  fragmentsLoading?: boolean
  activeTab?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'layers-applied'): void
  (e: 'fragments-applied'): void
  (e: 'labels-applied'): void
  (e: 'move-up', layerId: string): void
  (e: 'move-down', layerId: string): void
  (e: 'change-format', layerId: string, format: string): void
  (e: 'opacity-change', layerId: string, opacity: number): void
  (e: 'load-fragments'): void
  (e: 'update:active-tab', tab: string): void
}>()

const layerStore = useLayerStore()
const { visibleGeoServerLayers, visibleContextLayers } = storeToRefs(layerStore)
const mapStore = useMapStore()
const contextHoverInspectEnabled = computed(() => mapStore.contextHoverInspectEnabled)
const planetLayerStyleOverrides = computed(() => mapStore.planetLayerStyleOverrides)

const mapTilerReady = computed(() => Boolean(getMapTilerKey()))

const contextLayerRows: { key: ContextLayerKey; title: string; subtitle: string }[] = [
  { key: 'contours', title: 'Контуры', subtitle: 'MapTiler · изолинии рельефа' },
  { key: 'buildings', title: 'Здания', subtitle: 'MapTiler · объёмы зданий' },
  { key: 'hillshade', title: 'Затенение рельефа', subtitle: 'MapTiler · рельеф (hillshade)' },
  { key: 'terrain3d', title: 'Рельеф и 3D', subtitle: 'MapTiler · Terrain RGB' },
]

const contextSectionCollapsed = ref(false)
const planetSectionCollapsed = ref(false)
const planetGroupCollapsed = ref<Record<string, boolean>>({})
const planetLayerGroups = getPlanetLayersByGroup()

const planetStyleTarget = ref<PlanetLayerDef | null>(null)
const planetStyleForm = ref({ color: '#1976d2', opacity: 100, textSize: 12 })
const planetStyleCaps = computed(() =>
  planetStyleTarget.value ? getPlanetLayerUiCaps(planetStyleTarget.value) : null,
)

function openPlanetStyleDialog(pl: PlanetLayerDef) {
  planetStyleTarget.value = pl
  const o = planetLayerStyleOverrides.value[pl.sourceLayer]
  planetStyleForm.value = {
    color: typeof o?.color === 'string' && o.color.length ? o.color : '#1976d2',
    opacity: o?.opacity != null ? Math.round(Number(o.opacity) * 100) : 100,
    textSize: o?.textSize != null ? Number(o.textSize) : 12,
  }
}

function onPlanetStyleApply() {
  if (!planetStyleTarget.value) return
  const caps = getPlanetLayerUiCaps(planetStyleTarget.value)
  const pl = planetStyleTarget.value
  const patch: PlanetLayerStyleOverride = {}
  if (caps.hasColor) patch.color = planetStyleForm.value.color
  if (caps.hasOpacity) patch.opacity = planetStyleForm.value.opacity / 100
  if (caps.hasTextSize) patch.textSize = planetStyleForm.value.textSize
  mapStore.setPlanetLayerStyleOverride(pl.sourceLayer, patch)
  planetStyleTarget.value = null
}

function onPlanetStyleReset() {
  if (planetStyleTarget.value) mapStore.resetPlanetLayerStyle(planetStyleTarget.value.sourceLayer)
  planetStyleTarget.value = null
}

function isPlanetGroupCollapsed(group: string) {
  return planetGroupCollapsed.value[group] !== false
}
function togglePlanetGroupCollapsed(group: string) {
  planetGroupCollapsed.value = { ...planetGroupCollapsed.value, [group]: !isPlanetGroupCollapsed(group) }
}
function isPlanetGroupAllVisible(pg: { layers: PlanetLayerDef[] }) {
  return pg.layers.every((l) => mapStore.visiblePlanetLayers.includes(l.sourceLayer))
}
function isPlanetGroupPartial(pg: { layers: PlanetLayerDef[] }) {
  const vis = pg.layers.filter((l) => mapStore.visiblePlanetLayers.includes(l.sourceLayer))
  return vis.length > 0 && vis.length < pg.layers.length
}
function togglePlanetGroupAll(pg: { group: PlanetLayerGroup; layers: PlanetLayerDef[] }) {
  const allOn = isPlanetGroupAllVisible(pg)
  mapStore.setPlanetGroupVisible(pg.layers.map((l) => l.sourceLayer), !allOn)
}

const collapsedGroups = ref<Record<string, boolean>>({})

function isGroupCollapsed(groupName: string) {
  const explicit = collapsedGroups.value[groupName]
  if (explicit !== undefined) return explicit
  // Группы вспомогательных слоёв по умолчанию свёрнуты
  return groupName.endsWith(SERVICE_GROUP_SUFFIX)
}

function toggleGroupCollapsed(groupName: string) {
  collapsedGroups.value = {
    ...collapsedGroups.value,
    [groupName]: !isGroupCollapsed(groupName),
  }
}

const pendingContextLayers = ref<ContextLayerKey[]>([])

function isPendingContextLayerVisible(key: ContextLayerKey) {
  return pendingContextLayers.value.includes(key)
}

function togglePendingContextLayer(key: ContextLayerKey) {
  const set = new Set<ContextLayerKey>(pendingContextLayers.value)
  if (set.has(key)) set.delete(key)
  else set.add(key)
  pendingContextLayers.value = contextLayerRows.map((row) => row.key).filter((k) => set.has(k))
}
const fragmentStore = useFragmentStore()
const { visibleFragments } = storeToRefs(fragmentStore)
const labelStore = useLabelStore()
const { globalLabels } = storeToRefs(labelStore)

/** Черновик видимости слоёв до кнопки «Применить» */
const pendingVisible = ref<string[]>([])
const layersApplying = ref(false)
const pendingFormats = ref<Record<string, 'mvt' | 'wms'>>({})

const sortIdsByListOrder = (ids: string[]): string[] =>
  layerStore.geoServerLayers.map((l: { layerId: string }) => l.layerId).filter((id: string) => ids.includes(id))

watch(
  visibleGeoServerLayers,
  (v: string[]) => {
    pendingVisible.value = sortIdsByListOrder([...v])
  },
  { deep: true, immediate: true }
)

watch(
  visibleContextLayers,
  (v: ContextLayerKey[]) => {
    const set = new Set<ContextLayerKey>(v)
    pendingContextLayers.value = contextLayerRows.map((row) => row.key).filter((k) => set.has(k))
  },
  { deep: true, immediate: true }
)

function layerSupportsFormatToggle(layer: { supportedFormats?: { mvt?: boolean; wms?: boolean } }) {
  const s = layer.supportedFormats
  if (!s) return true
  const m = s.mvt !== false
  const w = s.wms !== false
  return m && w
}

watch(
  () => layerStore.geoServerLayers,
  (layers: Array<{ layerId: string; renderFormat?: string; supportedFormats?: { mvt?: boolean; wms?: boolean } }>) => {
    const next: Record<string, 'mvt' | 'wms'> = {}
    for (const layer of layers) {
      const key = layer.layerId
      const s = layer.supportedFormats
      const onlyWms = s && s.mvt === false && s.wms === true
      const onlyMvt = s && s.mvt === true && s.wms === false
      let current = layer.renderFormat === 'wms' ? 'wms' : 'mvt'
      if (onlyWms) current = 'wms'
      if (onlyMvt) current = 'mvt'
      next[key] = pendingFormats.value[key] ?? current
    }
    pendingFormats.value = next
  },
  { deep: true, immediate: true }
)

const getPendingFormat = (layerId: string): 'mvt' | 'wms' =>
  pendingFormats.value[layerId] ?? 'mvt'

const setPendingFormat = (layerId: string, format: string) => {
  const next = format === 'wms' ? 'wms' : 'mvt'
  pendingFormats.value = { ...pendingFormats.value, [layerId]: next }
}

const hasPendingLayerChanges = computed(() => {
  const a = sortIdsByListOrder([...pendingVisible.value]).join('\0')
  const b = sortIdsByListOrder([...layerStore.visibleGeoServerLayers]).join('\0')
  const contextA = JSON.stringify([...pendingContextLayers.value])
  const contextB = JSON.stringify([...visibleContextLayers.value])
  const formatChanged = layerStore.geoServerLayers.some((layer: { layerId: string; renderFormat?: string; supportedFormats?: { mvt?: boolean; wms?: boolean } }) => {
    if (!layerSupportsFormatToggle(layer)) return false
    const current = layer.renderFormat === 'wms' ? 'wms' : 'mvt'
    return getPendingFormat(layer.layerId) !== current
  })
  return a !== b || formatChanged || contextA !== contextB
})

function togglePendingLayer(layerId: string) {
  const set = new Set(pendingVisible.value)
  if (set.has(layerId)) set.delete(layerId)
  else set.add(layerId)
  pendingVisible.value = sortIdsByListOrder(Array.from(set) as string[])
}

async function applyPendingLayers() {
  if (!hasPendingLayerChanges.value) return
  layersApplying.value = true
  try {
    for (const layer of layerStore.geoServerLayers) {
      if (!layerSupportsFormatToggle(layer)) continue
      const desired = getPendingFormat(layer.layerId)
      const current = layer.renderFormat === 'wms' ? 'wms' : 'mvt'
      if (desired !== current) {
        await layerStore.changeLayerFormat(layer.layerId, desired)
      }
    }

    const pendingContextSet = new Set<ContextLayerKey>(pendingContextLayers.value)
    for (const row of contextLayerRows) {
      layerStore.setContextLayerVisible(row.key, pendingContextSet.has(row.key))
    }

    await layerStore.applyVisibleLayersSelection(pendingVisible.value)
    emit('layers-applied')
  } finally {
    layersApplying.value = false
  }
}

/** Черновик фрагментов / подписей */
const pendingFragments = ref<number[]>([])
const pendingLabels = ref<string[]>([])
const fragmentsApplying = ref(false)
const labelsApplying = ref(false)

watch(
  visibleFragments,
  (v: number[]) => {
    pendingFragments.value = [...v]
  },
  { deep: true, immediate: true }
)

watch(
  globalLabels,
  (v: string[]) => {
    pendingLabels.value = [...v]
  },
  { deep: true, immediate: true }
)

const sortedNumsJson = (ids: number[]) => JSON.stringify([...ids].sort((a, b) => a - b))
const sortedStrJson = (ids: string[]) => JSON.stringify([...ids].sort())

const hasPendingFragmentChanges = computed(
  () => sortedNumsJson(pendingFragments.value) !== sortedNumsJson(fragmentStore.visibleFragments)
)

const hasPendingLabelChanges = computed(
  () => sortedStrJson(pendingLabels.value) !== sortedStrJson(labelStore.globalLabels)
)

function togglePendingFragment(id: number) {
  const set = new Set<number>(pendingFragments.value)
  if (set.has(id)) set.delete(id)
  else set.add(id)
  pendingFragments.value = [...set].sort((a: number, b: number) => a - b)
}

function clearPendingFragments() {
  pendingFragments.value = []
}

async function applyPendingFragments() {
  if (!hasPendingFragmentChanges.value) return
  fragmentsApplying.value = true
  try {
    fragmentStore.applyVisibleFragmentsSelection(pendingFragments.value)
    emit('fragments-applied')
  } finally {
    fragmentsApplying.value = false
  }
}

function togglePendingLabel(id: string) {
  const set = new Set(pendingLabels.value)
  if (set.has(id)) set.delete(id)
  else set.add(id)
  pendingLabels.value = [...set].sort()
}

function clearPendingLabels() {
  pendingLabels.value = []
}

async function applyPendingLabels() {
  if (!hasPendingLabelChanges.value) return
  labelsApplying.value = true
  try {
    labelStore.applyGlobalLabelsSelection(pendingLabels.value)
    emit('labels-applied')
  } finally {
    labelsApplying.value = false
  }
}

const activeTabLocal = computed({
  get: () => props.activeTab || 'layers',
  set: (tab: string) => emit('update:active-tab', tab)
})
const fragmentSearchLocal = ref('')
const labelSearchLocal    = ref('')

const AVAILABLE_LABELS = [
  { id: 'NAPOR',  label: 'Напор, H, м.вод.ст.',              icon: 'mdi-gauge' },
  { id: 'RAS',    label: 'Расход, G, т/ч',                   icon: 'mdi-water-pump' },
  { id: 'RAS_U',  label: 'Узловой расход, G, т/ч',           icon: 'mdi-water' },
  { id: 'DLINA',  label: 'Длина, L, м',                      icon: 'mdi-ruler' },
  { id: 'DIAM_V', label: 'Диаметр вн., мм',                  icon: 'mdi-diameter' },
  { id: 'DIAM_U', label: 'Диаметр усл., мм',                 icon: 'mdi-diameter-variant' },
  { id: 'TEMP',   label: 'Температура, t, °C',               icon: 'mdi-thermometer' },
  { id: 'T_POD',  label: 'Т под., °C',                       icon: 'mdi-thermometer-chevron-up' },
  { id: 'T_OBR',  label: 'Т обр., °C',                       icon: 'mdi-thermometer-chevron-down' },
  { id: 'P_POD',  label: 'Р под., атм',                      icon: 'mdi-gauge' },
  { id: 'P_OBR',  label: 'Р обр., атм',                      icon: 'mdi-gauge' },
  { id: 'SKOR',   label: 'Скорость, w, м/c',                 icon: 'mdi-speedometer' },
  { id: 'UD_POT', label: 'Удельные потери, R, мм.вод.ст./м', icon: 'mdi-chart-line-variant' },
  { id: 'NAGR',   label: 'Нагрузка, G, Гкал/ч',             icon: 'mdi-fire' },
  { id: 'RASP',   label: 'Расп. напор, dH, м',              icon: 'mdi-water-plus' },
  { id: 'H_OST',  label: 'Ост. напор, м',                   icon: 'mdi-water-check' },
  { id: 'GEOD',   label: 'Геод. отметка, h, м',             icon: 'mdi-elevation-rise' },
  { id: 'NAGR_U', label: 'Нагрузка на участках, Q, Гкал/ч', icon: 'mdi-calculator' },
  { id: 'NAPOR2', label: 'Полный напор, H, м.вод.ст.',      icon: 'mdi-gauge-full' },
]

const tabMeta: Record<string, { title: string; subtitle: string; icon: string }> = {
  layers:    { title: 'Слои',      subtitle: 'Видимость и порядок',    icon: 'mdi-layers' },
  fragments: { title: 'Фрагменты', subtitle: 'Фильтрация по участкам', icon: 'mdi-map-marker-multiple' },
  labels:    { title: 'Подписи',   subtitle: 'Атрибуты на карте',      icon: 'mdi-label-multiple' },
}

const sidebarTitle = computed(() => tabMeta[activeTabLocal.value]?.title    ?? 'Меню')
const tabSubtitle  = computed(() => tabMeta[activeTabLocal.value]?.subtitle  ?? '')
const sidebarIcon  = computed(() => tabMeta[activeTabLocal.value]?.icon      ?? 'mdi-menu')

// Layer groups
interface LayerGroup { name: string; layers: typeof layerStore.geoServerLayers }

const layerSearchLocal = ref('')

const SERVICE_GROUP_SUFFIX = ' — вспомогательные'

const layerGroups = computed((): LayerGroup[] => {
  const s = (layerSearchLocal.value || '').trim().toLowerCase()
  const matchesSearch = (layer: any) =>
    !s ||
    String(layer.label || '').toLowerCase().includes(s) ||
    String(layer.displayName || '').toLowerCase().includes(s) ||
    String(layer.sourceLayer || '').toLowerCase().includes(s)

  const groups = new Map<string, typeof layerStore.geoServerLayers>()
  for (const layer of layerStore.geoServerLayers) {
    if (!matchesSearch(layer)) continue
    const ws = (layer as any).workspace || (layer as any).groupName || 'default'
    // Вспомогательные слои (fragments, find_node, city_center, file…) — отдельной группой в конце
    const key = (layer as any).role === 'service' ? `${ws}${SERVICE_GROUP_SUFFIX}` : ws
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(layer)
  }
  return Array.from(groups.entries())
    .map(([name, layers]) => ({ name, layers }))
    .sort((a, b) =>
      Number(a.name.endsWith(SERVICE_GROUP_SUFFIX)) - Number(b.name.endsWith(SERVICE_GROUP_SUFFIX))
    )
})

// Пробел только на границе слов: AlmatyGIS → Almaty GIS (а не A l m a t y …)
const formatGroupName = (n: string) => n.replace(/([a-zа-яё0-9])([A-ZА-ЯЁ])/g, '$1 $2').trim()

const layerOrderMap = computed(() => {
  const m: Record<string, number> = {}
  layerStore.geoServerLayers.forEach((l: { layerId: string }, i: number) => { m[l.layerId] = i + 1 })
  return m
})
const getLayerOrder = (id: string) => layerOrderMap.value[id] ?? 1

// Fragments
const filteredFragments = computed(() => {
  if (!fragmentSearchLocal.value) return fragmentStore.fragments
  const s = fragmentSearchLocal.value.toLowerCase()
  return fragmentStore.fragments.filter((f: { name: unknown; id: unknown }) =>
    String(f.name).toLowerCase().includes(s) || String(f.id).toLowerCase().includes(s)
  )
})

// Labels
const filteredLabels = computed(() => {
  if (!labelSearchLocal.value) return AVAILABLE_LABELS
  const s = labelSearchLocal.value.toLowerCase()
  return AVAILABLE_LABELS.filter(l =>
    l.label.toLowerCase().includes(s) || l.id.toLowerCase().includes(s)
  )
})

const getLabelIconColor = (id: string) => {
  const k = id.toLowerCase()
  if (k.includes('napor') || k.includes('pressure')) return 'red'
  if (k.includes('ras')   || k.includes('flow'))     return 'cyan'
  if (k.includes('temp'))                             return 'orange'
  if (k.includes('diam'))                             return 'indigo'
  if (k.includes('dlina') || k.includes('length'))   return 'teal'
  if (k.includes('skor')  || k.includes('speed'))    return 'green'
  return 'grey'
}
</script>

<style scoped>
.sidebar-inner {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  flex-shrink: 0;
}

/* Иконка внутри аватара всегда белая (SVG использует fill:currentColor) */
.sidebar-header :deep(.v-avatar svg),
.sidebar-header :deep(.v-avatar path) {
  fill: white;
  color: white;
}

.sidebar-tabs {
  flex-shrink: 0;
}

.sidebar-window {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

:deep(.v-window__container) {
  height: 100%;
  display: flex;
  flex-direction: column;
}

:deep(.v-window-item) {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.tab-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  height: 100%;
}

.content-area {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.15) transparent;
}

.search-section {
  background: #f8f9fa;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  flex-shrink: 0;
}

.sidebar-footer {
  flex-shrink: 0;
  background: #fff;
}

.context-hover-switch {
  margin: 0;
}

.context-hover-switch :deep(.v-selection-control) {
  min-height: 28px;
}

.context-hover-switch :deep(.v-label) {
  opacity: 1;
}

.apply-btn {
  flex-shrink: 0;
}

.group-header {
  display: flex;
  align-items: center;
  background: rgba(0, 0, 0, 0.03);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.layer-item {
  transition: background 0.15s;
  border-radius: 6px;
  margin: 1px 6px;
}

.compact-list {
  --v-list-item-padding-y: 2px;
}

.compact-layer-item {
  margin: 0 6px;
  min-height: 32px;
}

.working-layer-item {
  padding-top: 1px !important;
  padding-bottom: 1px !important;
  min-height: 28px !important;
}

.tight-left-item :deep(.v-list-item__prepend) {
  margin-inline-start: -12px;
  margin-inline-end: 4px;
}

.layer-prepend {
  gap: 1px;
}

.layer-checkbox {
  margin-inline-start: -4px;
}

.compact-subtitle {
  font-size: 0.68rem !important;
  line-height: 1.15 !important;
}

.layer-item.active {
  background: rgba(var(--v-theme-primary), 0.05);
}

.layer-name {
  font-size: 0.78rem !important;
  font-weight: 500 !important;
  line-height: 1.1 !important;
}

.order-chip {
  min-width: 22px;
  justify-content: center;
}

.working-order-chip {
  min-width: 18px;
  height: 16px;
  font-size: 0.62rem;
}

.working-subtitle {
  display: none !important;
}

.format-row {
  padding-left: 2px;
  margin-top: 2px !important;
}

.format-toggle {
  height: 20px;
}

.format-btn {
  min-width: 34px;
  padding: 0 6px;
  font-size: 0.62rem;
  letter-spacing: 0;
}

.format-toggle :deep(.v-btn) {
  min-height: 20px;
}

.opacity-row {
  padding: 3px 2px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 6px;
  max-width: 190px;
  margin-top: 2px !important;
}

.working-layers-list :deep(.v-list-item__content) {
  overflow: hidden;
}

.planet-style-card {
  border-radius: 10px;
}

.planet-color-input {
  width: 36px;
  height: 32px;
  padding: 0;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 6px;
  cursor: pointer;
  flex-shrink: 0;
}
</style>
