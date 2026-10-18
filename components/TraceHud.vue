<template>
  <!-- Бейдж у курсора при рисовании трассы: привязка и длины -->
  <div
    v-if="position"
    class="trace-hud"
    :style="{ left: `${position.x + 16}px`, top: `${position.y + 16}px` }"
  >
    <div
      v-if="snapText"
      class="trace-hud__snap"
    >
      {{ snapText }}
    </div>
    <div v-if="drawing">
      {{ formatMeters(lengths.lastM) }}
      <span
        v-if="lengths.segmentM !== lengths.lastM"
        class="trace-hud__dim"
      >· участок {{ formatMeters(lengths.segmentM) }}</span>
      <span
        v-if="lengths.totalM !== lengths.segmentM"
        class="trace-hud__dim"
      >· всего {{ formatMeters(lengths.totalM) }}</span>
    </div>
    <div
      v-if="hint"
      class="trace-hud__dim"
    >
      {{ hint }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { formatMeters } from '~/utils/cadGeometry';
import { snapLabel, type SnapResult } from '~/utils/cadSnap';

const props = defineProps<{
  position: { x: number; y: number } | null
  snap: SnapResult | null
  drawing: boolean
  lengths: { totalM: number; segmentM: number; lastM: number }
  hint?: string
}>();

const snapText = computed(() => {
  if (!props.snap) return '';
  const label = snapLabel(props.snap);
  return props.snap.lineId != null && props.snap.kind !== 'node' && props.snap.pipe === false
    ? `${label} (оборудование — врезка невозможна)`
    : label;
});
</script>

<style scoped>
.trace-hud {
  position: absolute;
  z-index: 6;
  pointer-events: none;
  padding: 3px 8px;
  border-radius: 6px;
  background: rgba(33, 33, 33, 0.85);
  color: #fff;
  font-size: 12px;
  line-height: 1.4;
  white-space: nowrap;
}
.trace-hud__snap {
  font-weight: 600;
}
.trace-hud__dim {
  opacity: 0.75;
}
</style>
