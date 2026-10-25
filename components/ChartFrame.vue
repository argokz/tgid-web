<template>
  <figure
    class="chart-frame"
    :aria-label="label"
  >
    <div
      class="chart-frame__tools"
      role="toolbar"
      :aria-label="`Масштаб и выгрузка: ${label}`"
    >
      <slot name="tools" />
      <HintTip
        v-if="zoomable"
        :text="selecting ? 'Отменить выделение' : 'Масштаб выделением'"
        hint="Протяните по графику — покажется выделенный участок; колесо мыши тоже масштабирует"
        location="bottom"
      >
        <template #default="{ props: tip }">
          <v-btn
            v-bind="tip"
            icon
            size="small"
            variant="text"
            :color="selecting ? 'primary' : undefined"
            :aria-pressed="selecting"
            aria-label="Масштаб выделением"
            @click="toggleSelecting"
          >
            <v-icon size="18">mdi-selection-drag</v-icon>
          </v-btn>
        </template>
      </HintTip>
      <HintTip
        v-if="zoomable"
        text="Сбросить масштаб"
        location="bottom"
      >
        <template #default="{ props: tip }">
          <v-btn
            v-bind="tip"
            icon
            size="small"
            variant="text"
            aria-label="Сбросить масштаб"
            @click="resetZoom"
          >
            <v-icon size="18">mdi-magnify-minus-outline</v-icon>
          </v-btn>
        </template>
      </HintTip>
      <HintTip
        text="Сохранить картинкой (PNG)"
        location="bottom"
      >
        <template #default="{ props: tip }">
          <v-btn
            v-bind="tip"
            icon
            size="small"
            variant="text"
            aria-label="Сохранить график картинкой"
            @click="exportPng"
          >
            <v-icon size="18">mdi-image-outline</v-icon>
          </v-btn>
        </template>
      </HintTip>
    </div>
    <div
      class="chart-frame__canvas"
      :style="{ height: typeof height === 'number' ? `${height}px` : height }"
    >
      <VChart
        ref="chartRef"
        v-bind="$attrs"
        :theme="theme ?? chartTheme"
        class="chart-frame__chart"
        :option="frameOption"
        autoresize
        @brush-end="onBrushEnd"
      />
    </div>
    <figcaption
      v-if="summary"
      class="chart-frame__summary"
    >
      {{ summary }}
    </figcaption>
  </figure>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BrushComponent, DataZoomComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { useTheme } from 'vuetify'
import HintTip from '~/components/HintTip.vue'
import { useChartTheme } from '~/composables/useChartTheme'
import { brushForZoom, brushRangeToZoom } from '~/utils/chartOptions'

/**
 * Рамка графика (docs/ui-primitives.md, этап 6): тема из токенов (`useChartTheme`), кнопки «масштаб
 * выделением» (кисть по оси X → зум), «сбросить масштаб» и «PNG», подпись-описание для чтения с экрана.
 * Типы серий регистрирует владелец (`use([LineChart])`); события графика (`@click`, `@mouseover`) проходят
 * насквозь в `v-chart`.
 */
defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  option: Record<string, unknown>
  /** Название графика: для чтения с экрана, кнопок и имени файла */
  label: string
  /** Высота области графика: число — px или CSS-значение */
  height?: number | string
  /** Текстовое описание (итог, диапазоны) — видно под графиком и читается с экрана */
  summary?: string
  /** Имя PNG без расширения (по умолчанию — label) */
  exportName?: string
  /** Кнопки масштаба (у графиков без осей не нужны) */
  zoomable?: boolean
  /** Своя тема вместо темы приложения */
  theme?: Record<string, unknown> | null
}>(), {
  height: 420,
  summary: '',
  exportName: '',
  zoomable: true,
  theme: null
})

use([CanvasRenderer, BrushComponent, DataZoomComponent, GridComponent, LegendComponent, TooltipComponent])

const { chartTheme } = useChartTheme()
const vuetifyTheme = useTheme()
const chartRef = ref<InstanceType<typeof VChart> | null>(null)
const selecting = ref(false)

/** Кисть добавляется к опциям владельца только для «масштаба выделением» — без кнопок тулбокса */
const frameOption = computed(() => (props.zoomable ? { ...props.option, brush: brushForZoom() } : props.option))

const chart = () => chartRef.value

const stopSelecting = () => {
  selecting.value = false
  chart()?.dispatchAction({ type: 'brush', areas: [] })
  chart()?.dispatchAction({ type: 'takeGlobalCursor', key: 'brush', brushOption: { brushType: false } })
}
const toggleSelecting = () => {
  if (selecting.value) {
    stopSelecting()
    return
  }
  selecting.value = true
  chart()?.dispatchAction({ type: 'takeGlobalCursor', key: 'brush', brushOption: { brushType: 'lineX', brushMode: 'single' } })
}
/** Выделение закончено — зум на выделенный участок, кисть убрать */
const onBrushEnd = (event: { areas?: Array<{ coordRange?: unknown }> }) => {
  const xAxis = (chart()?.getOption() as { xAxis?: Array<{ type?: string; data?: unknown[] }> } | undefined)?.xAxis?.[0]
  const range = brushRangeToZoom(event?.areas, { type: xAxis?.type, data: xAxis?.data })
  if (range) chart()?.dispatchAction({ type: 'dataZoom', ...range })
  stopSelecting()
}
const resetZoom = () => {
  if (selecting.value) stopSelecting()
  chart()?.dispatchAction({ type: 'dataZoom', start: 0, end: 100 })
}

const exportPng = () => {
  const background = vuetifyTheme.current.value.colors.surface || '#FFFFFF'
  const url = chart()?.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: background })
  if (!url) return
  const link = document.createElement('a')
  link.href = url
  link.download = `${(props.exportName || props.label).replace(/[\\/:*?"<>|]+/g, '_')}.png`
  document.body.appendChild(link)
  link.click()
  link.remove()
}

defineExpose({ resetZoom, exportPng, chart })
</script>

<style scoped>
.chart-frame { position: relative; margin: 0; display: flex; flex-direction: column; min-width: 0; }
.chart-frame__tools {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: 2px;
  border-radius: var(--radius-2, 8px);
  background: rgba(var(--v-theme-surface), 0.85);
}
.chart-frame__canvas { width: 100%; min-height: 0; }
.chart-frame__chart { width: 100%; height: 100%; }
.chart-frame__summary {
  margin-top: var(--space-2);
  font-size: var(--text-xs, 0.75rem);
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-variant-numeric: tabular-nums;
}
</style>

<style>
/* Тултип ECharts — HTML внутри контейнера графика, вне scoped-области */
.chart-tip__title { font-weight: 600; margin-bottom: 2px; }
.chart-tip__sub { opacity: 0.7; margin-bottom: 4px; }
.chart-tip__row { display: flex; align-items: center; gap: 6px; line-height: 1.6; }
.chart-tip__name { flex: 1; }
.chart-tip__value { margin-left: 12px; font-variant-numeric: tabular-nums; }
</style>
