<script setup lang="ts">
import { computed } from 'vue';
import type { TopologyAreaCheck, TopologyAreaIssue } from '~/services/fastApiService';
import { topologyCheckSummary, topologyFaultMeta, topologyFaultTitle } from '~/utils/topologyDiagnostics';

/** Сколько замечаний показать сразу: правка затрагивает несколько объектов, длинный список — уже диагностика */
const SHOWN_LIMIT = 6;

const props = defineProps<{ check: TopologyAreaCheck }>();
const emit = defineEmits<{
  locate: [issue: TopologyAreaIssue];
  undo: [];
  close: [];
}>();

const summary = computed(() => topologyCheckSummary(props.check));
const shown = computed(() => props.check.issues.slice(0, SHOWN_LIMIT));
const hidden = computed(() => props.check.issues.length - shown.value.length);
</script>

<template>
  <section
    class="topo-check"
    role="status"
    aria-live="polite"
    aria-label="Проверка правки"
  >
    <header class="topo-check__head">
      <v-icon
        :color="check.errors ? 'error' : 'warning'"
        size="18"
      >
        {{ check.errors ? 'mdi-alert-octagon' : 'mdi-alert-outline' }}
      </v-icon>
      <div class="topo-check__title">
        Проверка правки: {{ summary }}
      </div>
      <HintTip text="Скрыть">
        <template #default="{ props: tip }">
          <v-btn
            v-bind="tip"
            icon="mdi-close"
            size="x-small"
            variant="text"
            aria-label="Скрыть проверку правки"
            @click="emit('close')"
          />
        </template>
      </HintTip>
    </header>

    <ul class="topo-check__list">
      <li
        v-for="issue in shown"
        :key="`${issue.type}:${issue.object_type}:${issue.object_id}`"
      >
        <button
          type="button"
          class="topo-check__item"
          :disabled="issue.lat == null || issue.lng == null"
          :title="issue.title"
          @click="emit('locate', issue)"
        >
          <v-icon
            :color="topologyFaultMeta(issue.type).color"
            size="16"
            class="topo-check__icon"
          >
            {{ topologyFaultMeta(issue.type).icon }}
          </v-icon>
          <span class="topo-check__text">
            <span class="topo-check__name">{{ topologyFaultTitle(issue) }}</span>
            <span class="topo-check__desc">{{ issue.description }}</span>
          </span>
        </button>
      </li>
    </ul>
    <div
      v-if="hidden > 0"
      class="topo-check__note"
    >
      Ещё {{ hidden }} — в «Диагностике топологии» фрагмента
    </div>

    <footer
      v-if="check.operation_id"
      class="topo-check__foot"
    >
      <span class="topo-check__note">Правка сохранена; замечания не мешают работе</span>
      <v-btn
        size="small"
        variant="text"
        prepend-icon="mdi-undo"
        @click="emit('undo')"
      >
        Отменить правку
      </v-btn>
    </footer>
  </section>
</template>

<style scoped>
.topo-check {
  position: absolute;
  /* справа внизу, левее кнопок зума; легенда расчёта занимает левый нижний угол */
  right: calc(var(--map-right-inset, 0px) + var(--shell-inset) + var(--corner-btn, 40px) + var(--shell-gap, 8px));
  bottom: calc(44px + var(--safe-bottom, 0px));
  z-index: var(--z-hud);
  width: 340px;
  max-width: calc(100% - 32px);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-2, 8px);
  background: rgba(var(--v-theme-surface), 0.96);
  box-shadow: var(--shadow-2, 0 2px 8px rgba(0, 0, 0, 0.16));
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  font-size: var(--text-xs, 0.75rem);
}
.topo-check__head { display: flex; align-items: center; gap: var(--space-1); }
.topo-check__title { flex: 1; font-weight: 600; font-size: var(--text-sm, 0.875rem); }
.topo-check__list { list-style: none; margin: var(--space-1) 0 0; padding: 0; max-height: 240px; overflow-y: auto; }
.topo-check__item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  width: 100%;
  padding: 4px 6px;
  border-radius: 6px;
  text-align: left;
  color: inherit;
}
.topo-check__item:hover:not(:disabled) { background: rgba(var(--v-theme-on-surface), 0.06); }
.topo-check__item:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); }
.topo-check__item:disabled { cursor: default; }
.topo-check__icon { margin-top: 1px; flex-shrink: 0; }
.topo-check__text { display: flex; flex-direction: column; min-width: 0; }
.topo-check__name { font-weight: 600; }
.topo-check__desc,
.topo-check__note { color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity)); }
.topo-check__note { margin-top: var(--space-1); }
.topo-check__foot { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); margin-top: var(--space-1); }
/* телефон: над нижними угловыми кнопками, во всю ширину между отступами */
@media (max-width: 959.98px) {
  .topo-check {
    right: var(--shell-inset);
    left: var(--shell-inset);
    width: auto;
    max-width: none;
    bottom: calc(var(--shell-inset) + 32px + var(--corner-btn) + var(--shell-gap) + var(--safe-bottom, 0px));
  }
}
</style>
