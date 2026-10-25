<template>
  <Teleport to="body">
    <Transition name="fade">
      <v-card
        v-if="mapStore.featureMenuVisible"
        ref="cardRef"
        class="feature-menu"
        :class="menuSizeClass"
        :style="menuStyle"
        elevation="16"
        rounded="xl"
      >
        <v-card-title class="feature-menu__header py-3">
          <div class="d-flex align-center justify-space-between">
            <div class="d-flex align-center">
              <v-icon
                class="mr-2"
                color="primary"
                size="22"
              >mdi-cursor-default-click</v-icon>
              <span class="text-subtitle-1 font-weight-bold">Выберите объект</span>
            </div>
            <v-chip
              size="small"
              color="primary"
              variant="tonal"
              class="font-weight-bold num"
            >
              {{ mapStore.potentialFeatures.length }}
            </v-chip>
          </div>
        </v-card-title>

        <v-divider />

        <div class="feature-menu__body">
          <div
            v-if="groupedFeatures.length === 0"
            class="empty-state d-flex flex-column align-center justify-center text-center px-6 py-10"
          >
            <v-icon
              size="36"
              color="blue-lighten-2"
              class="mb-3"
            >mdi-layers-off</v-icon>
            <div class="text-body-1 font-weight-medium mb-1">
              Нет объектов для отображения
            </div>
          </div>
          <div
            v-else
            class="layer-group-list"
          >
            <div
              v-for="group in groupedFeatures"
              :key="group.workspaceId"
            >
              <div class="layer-header">
                <div class="d-flex align-center">
                  <v-avatar
                    size="32"
                    color="blue-lighten-4"
                    class="mr-3"
                  >
                    <v-icon
                      color="blue-darken-2"
                      size="18"
                    >mdi-layers</v-icon>
                  </v-avatar>
                  <div>
                    <div class="text-body-1 font-weight-medium">
                      {{ group.workspaceName }}
                    </div>
                    <div class="text-caption text-grey-darken-1">
                      {{ formatLayerSummary(group.features.length) }}
                    </div>
                  </div>
                </div>
              </div>

              <v-list
                density="comfortable"
                class="py-1"
                max-height="220"
                style="overflow-y: auto;"
              >
                <v-virtual-scroll
                  :items="group.features"
                  :height="220"
                  :item-height="76"
                >
                  <template #default="{ item }">
                    <v-list-item
                      :key="item._key"
                      class="menu-item"
                      @click.stop="selectFeature(item.feature, item.index)"
                    >
                      <template #prepend>
                        <v-avatar
                          size="36"
                          color="blue-lighten-5"
                          class="menu-avatar"
                        >
                          <v-icon
                            color="blue-darken-2"
                            size="small"
                          >
                            {{ getFeatureIcon(item.feature) }}
                          </v-icon>
                        </v-avatar>
                      </template>
                      <v-list-item-title class="text-body-1 font-weight-medium">
                        {{ formatFeatureName(item.feature) }}
                      </v-list-item-title>
                      <v-list-item-subtitle class="text-caption mt-1">
                        {{ formatFeatureDetails(item.feature) }}
                      </v-list-item-subtitle>
                      <template #append>
                        <v-icon
                          size="small"
                          color="blue-darken-1"
                        >mdi-chevron-right</v-icon>
                      </template>
                    </v-list-item>
                  </template>
                </v-virtual-scroll>
              </v-list>

              <v-divider
                v-if="group !== groupedFeatures[groupedFeatures.length - 1]"
                class="my-2"
              />
            </div>
          </div>
        </div>

        <v-divider />

        <v-card-actions class="pa-3">
          <span class="text-caption text-medium-emphasis me-auto">↑↓ — по списку, Esc — закрыть</span>
          <v-btn
            size="small"
            variant="text"
            @click.stop="mapStore.featureMenuVisible = false"
          >
            <v-icon class="mr-1">mdi-close</v-icon>
            Закрыть
          </v-btn>
        </v-card-actions>
      </v-card>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import type { CSSProperties } from 'vue'
import { useMapStore } from '~/stores/mapStore'
import { describeMenuFeature } from '~/utils/networkFeature'
import { getCityConfig } from '~/utils/cityConfig'
import { BREAKPOINTS } from '~/utils/breakpoints'
import { registerHotkeys } from '~/composables/useHotkeys'
import { holdsEscape } from '~/utils/escapeKey'

const mapStore = useMapStore()

const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)
const viewportHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 768)

const updateViewport = () => {
  if (typeof window === 'undefined') return
  viewportWidth.value = window.innerWidth
  viewportHeight.value = window.innerHeight
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    updateViewport()
    window.addEventListener('resize', updateViewport, { passive: true })
  }
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateViewport)
  }
})

const isMobile = computed(() => viewportWidth.value < BREAKPOINTS.sm)
const isTablet = computed(() => viewportWidth.value >= BREAKPOINTS.sm && viewportWidth.value < BREAKPOINTS.md)

const menuSizeClass = computed(() => {
  if (isMobile.value) return 'feature-menu--mobile'
  if (isTablet.value) return 'feature-menu--tablet'
  return 'feature-menu--desktop'
})

const menuStyle = computed<CSSProperties>(() => {
  const vh = viewportHeight.value || 900
  const pos = mapStore.featureMenuPosition

  if (isMobile.value) {
    const maxHeight = Math.round(vh * 0.75)
    return {
      position: 'fixed',
      left: '12px',
      right: '12px',
      bottom: '12px',
      maxHeight: `${maxHeight}px`,
      zIndex: 'var(--z-popover)'
    }
  }

  const menuWidth = isTablet.value ? 360 : 420
  const maxHeight = Math.min(Math.round(vh * 0.8), 640)

  let left = pos.x + 12
  let top = pos.y + 12

  if (left + menuWidth > viewportWidth.value) {
    left = pos.x - menuWidth - 12
  }

  if (top + maxHeight > vh) {
    top = vh - maxHeight - 12
  }

  return {
    position: 'fixed',
    left: `${Math.max(12, left)}px`,
    top: `${Math.max(12, top)}px`,
    maxHeight: `${maxHeight}px`,
    zIndex: 'var(--z-popover)'
  }
})

const groupedFeatures = computed(() => {
  const map = new Map<string, { workspaceId: string; workspaceName: string; features: Array<{ feature: any; index: number; _key: string }> }>()

  mapStore.potentialFeatures.forEach((feature, index) => {
    const p = feature.properties || {}
    const workspaceId = feature.workspace || p.__workspaceId || getCityConfig().workspace
    const workspaceName = feature.workspaceName || p.__workspaceName || workspaceId
    const key = `${workspaceId}__${workspaceName}`

    if (!map.has(key)) {
      map.set(key, {
        workspaceId,
        workspaceName,
        features: []
      })
    }

    map.get(key)!.features.push({
      feature,
      index,
      _key: `${key}_${index}`
    })
  })

  return Array.from(map.values())
})

const parseFeatureId = (featureId: string | number) => {
  const idStr = String(featureId)
  if (idStr.includes('.')) {
    const [tableName, idPart] = idStr.split('.')
    return { tableName, id: parseInt(idPart, 10) }
  }
  return { tableName: '', id: parseInt(idStr, 10) }
}

const formatFeatureName = (feature: any) => {
  const p = feature.properties || {}
  
  if ('code2' in p && p.code2) {
    const parts = []
    if (p.code) parts.push(p.code)
    if (p.code2) parts.push(p.code2)
    if (p.name) parts.push(p.name)
    if (p.fileid) parts.push(p.fileid)
    return parts.join(' ').trim() || 'Без названия'
  }
  
  const { tableName } = parseFeatureId(feature.id || '')
  const parts = []
  if (tableName) parts.push(tableName)
  if (p.name) parts.push(p.name)
  return parts.join(' ').trim() || 'Без названия'
}

const formatFeatureDetails = (feature: any) => {
  const p = feature.properties || {}
  // фрагмент и id объекта сети: копии участка в разных фрагментах иначе неразличимы (QA F69)
  const parts: string[] = describeMenuFeature(feature)
  if (p.code2 && !formatFeatureName(feature).includes(p.code2)) {
    parts.push(`Код: ${p.code2}`)
  }
  
  return parts.join(' • ') || 'Нет дополнительной информации'
}

const formatLayerSummary = (count: number) => {
  const abs = Math.abs(count) % 100
  const digit = abs % 10
  let word = 'объектов'
  if (abs > 10 && abs < 20) word = 'объектов'
  else if (digit === 1) word = 'объект'
  else if (digit >= 2 && digit <= 4) word = 'объекта'
  return `${count} ${word}`
}

const getFeatureIcon = (feature: any) => {
  const geomType = feature.geometry?.type
  if (geomType === 'Point' || geomType === 'MultiPoint') return 'mdi-map-marker'
  if (geomType === 'LineString' || geomType === 'MultiLineString') return 'mdi-vector-polyline'
  if (geomType === 'Polygon' || geomType === 'MultiPolygon') return 'mdi-vector-polygon'
  return 'mdi-shape'
}

/** Меню открыто инструментом (редактор, пьезометр) — выбор уходит ему, карточка не открывается */
const selectFeature = (feature: any, index: number) => {
  if (mapStore.hasPendingFeatureChoice()) {
    mapStore.resolveFeatureChoice(index)
    return
  }
  mapStore.selectFeature(feature, { anchor: mapStore.identifyAnchor })
}

// Меню объекта над картой — не v-overlay: Esc берёт сам, раньше инструментов (область popover реестра хоткеев)
const disposeHotkeys = registerHotkeys({
  id: 'feature-menu-escape',
  area: 'popover',
  enabled: () => mapStore.featureMenuVisible,
  allowInInput: true, // пустое поле Esc отпускает — решает holdsEscape
  handle: (ev) => {
    if (ev.key !== 'Escape' || holdsEscape(ev.target)) return false
    mapStore.featureMenuVisible = false
    return true
  },
})
onBeforeUnmount(disposeHotkeys)

// Меню закрыто без выбора («Закрыть», новый identify) — инструмент получает отказ; фокус возвращается туда,
// где был (холст карты). Открылось — фокус на первый пункт (стрелки v-list и Enter работают сразу),
// пока v-virtual-scroll его не отрисовал — на саму карточку
const cardRef = ref<{ $el?: HTMLElement } | null>(null)
let focusBefore: HTMLElement | null = null
watch(() => mapStore.featureMenuVisible, async (visible) => {
  if (!visible) {
    mapStore.cancelFeatureChoice()
    focusBefore?.focus?.()
    focusBefore = null
    return
  }
  focusBefore = document.activeElement instanceof HTMLElement ? document.activeElement : null
  await nextTick()
  const card = cardRef.value?.$el
  if (!card) return
  const first = card.querySelector<HTMLElement>('.menu-item')
  if (first) first.focus()
  else {
    card.tabIndex = -1
    card.focus()
  }
})
</script>

<style scoped>
.feature-menu {
  animation: slideIn var(--duration-base) var(--ease-out);
  box-shadow: var(--shadow-3) !important;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.feature-menu--desktop { width: 420px; }
.feature-menu--tablet { width: 360px; }
.feature-menu--mobile {
  width: auto;
  border-radius: 20px !important;
}

.feature-menu__body {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0 8px;
}

.layer-group-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 6px 6px;
}

.layer-header { margin: 4px 4px 6px; }

.feature-menu__header {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.menu-item {
  transition: background-color var(--duration-fast) var(--ease-out);
  margin: 2px 8px;
  border-radius: var(--radius-md) !important;
  cursor: pointer;
}

.menu-item:hover {
  background: rgba(var(--v-theme-primary), 0.06);
}

.menu-item:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

/* растёт из точки щелчка — объясняет, откуда появилось; prefers-reduced-motion обнуляет длительность */
@keyframes slideIn {
  from { opacity: 0; transform: scale(0.95) translateY(-10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.fade-enter-active, .fade-leave-active { transition: opacity var(--duration-base) var(--ease-out); }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
