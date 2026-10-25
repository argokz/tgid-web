<template>
  <div
    class="ai-panel"
    :class="{ 'ai-panel--loading': loading }"
  >
    <div class="ai-panel__head">
      <v-icon
        size="18"
        color="primary"
        class="mr-1"
      >
        mdiCreation
      </v-icon>
      <span class="ai-panel__title">{{ title }}</span>
      <span
        v-if="cached"
        class="ai-panel__cached"
        title="Ответ сохранён при прошлом запросе; «Обновить» спросит модель заново"
      >из кеша</span>
      <v-spacer />
      <v-btn
        v-if="!loading"
        size="x-small"
        variant="text"
        title="Спросить модель заново"
        @click="emit('refresh')"
      >
        <v-icon size="14">
          mdiRefresh
        </v-icon>
      </v-btn>
      <HintTip
        text="Скрыть объяснение"
      >
        <template #default="{ props: tip }">
          <v-btn
            v-bind="tip"
            size="x-small"
            variant="text"
            icon
            aria-label="Скрыть объяснение"
            @click="emit('close')"
          >
            <v-icon size="14">
              mdiClose
            </v-icon>
          </v-btn>
        </template>
      </HintTip>
    </div>

    <div
      v-if="loading"
      class="ai-panel__loading"
    >
      <v-progress-circular
        indeterminate
        size="16"
        width="2"
        class="mr-2"
      />
      Помощник разбирает протокол…
    </div>
    <div
      v-else-if="error"
      class="ai-panel__error"
    >
      {{ error }}
    </div>
    <template v-else-if="answer">
      <p class="ai-panel__summary">
        {{ answer.summary }}
      </p>

      <ol
        v-if="answer.root_causes.length"
        class="ai-panel__causes"
      >
        <li
          v-for="(cause, i) in answer.root_causes"
          :key="i"
          class="ai-cause"
        >
          <div class="ai-cause__title">
            {{ cause.title }}
            <span class="ai-cause__category">{{ categoryLabel(cause.category) }}</span>
          </div>
          <div class="ai-cause__why">
            {{ cause.why }}
          </div>
          <div class="ai-cause__action">
            <strong>Что сделать:</strong> {{ cause.action }}
          </div>
          <div
            v-if="cause.objects.length || cause.fix"
            class="ai-cause__objects"
          >
            <v-chip
              v-for="o in cause.objects.slice(0, 6)"
              :key="objectKey(o)"
              size="x-small"
              variant="outlined"
              class="mr-1 mb-1"
              title="Показать на карте"
              @click="emit('object', o)"
            >
              <v-icon
                size="12"
                class="mr-1"
              >
                mdiCrosshairsGps
              </v-icon>
              {{ o.label || objectKey(o) }}
            </v-chip>
            <v-btn
              v-if="cause.fix"
              size="x-small"
              variant="tonal"
              color="primary"
              :title="fixHint(cause.fix)"
              @click="emit('fix', cause)"
            >
              <v-icon
                size="12"
                class="mr-1"
              >
                mdiHammerWrench
              </v-icon>
              {{ fixLabel(cause.fix) }}
            </v-btn>
          </div>
        </li>
      </ol>

      <div
        v-if="regulators.length"
        class="ai-panel__regulators"
      >
        <div class="ai-panel__subtitle">
          Регуляторы с отклонением от уставки
        </div>
        <table class="ai-regs">
          <thead>
            <tr>
              <th>Регулятор</th>
              <th>Задано, м</th>
              <th>Получено, м</th>
              <th>Отклонение, м</th>
              <th>Расход, т/ч</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in regulators.slice(0, 12)"
              :key="r.seq ?? r.label"
              :class="r.deficit > 0 ? 'ai-regs--short' : 'ai-regs--over'"
              :title="r.state"
              @click="r.objects[0] && emit('object', r.objects[0])"
            >
              <td>{{ r.kind }} {{ r.label }}</td>
              <td>{{ fmt(r.setpoint) }}</td>
              <td>{{ fmt(r.actual) }}</td>
              <td>{{ r.deficit > 0 ? '−' : '+' }}{{ fmt(Math.abs(r.deficit)) }}</td>
              <td>{{ r.flow == null ? '—' : fmt(r.flow) }}</td>
            </tr>
          </tbody>
        </table>
        <div
          v-if="answer.regulators_note"
          class="ai-panel__note"
        >
          {{ answer.regulators_note }}
        </div>
      </div>

      <div
        v-if="answer.next_run.length"
        class="ai-panel__next"
      >
        <div class="ai-panel__subtitle">
          Что попробовать при следующем запуске
        </div>
        <ul>
          <li
            v-for="f in answer.next_run"
            :key="f.flag"
          >
            <code>{{ f.flag }}</code> — {{ f.reason }}
          </li>
        </ul>
      </div>

      <div
        v-if="answer.data_quality.length"
        class="ai-panel__next"
      >
        <div class="ai-panel__subtitle">
          Замечания к данным
        </div>
        <ul>
          <li
            v-for="(d, i) in answer.data_quality"
            :key="i"
          >
            {{ d }}
          </li>
        </ul>
      </div>
      <div class="ai-panel__foot">
        Ответ модели {{ model || 'Claude' }}: проверяйте числа по протоколу, решения принимает инженер.
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { AiObjectRef } from '~/services/aiService';
import type { ProtocolExplanation, ProtocolRegulator, RootCause } from '~/services/aiService';
import { FIX_HINTS, FIX_LABELS, type ProtocolFix } from '~/utils/calcProtocol';
import HintTip from '~/components/HintTip.vue';

/**
 * Ответ помощника ИИ по протоколу расчёта: сводка, причины с объектами и кнопкой «что открыть»,
 * регуляторы с дефицитом (посчитаны на сервере), флаги для следующего запуска.
 * Объекты и fix отдаёт наружу — переход по карте делает владелец (CalculationProtocol.goTo/runFix).
 */
const props = withDefaults(defineProps<{
  answer: ProtocolExplanation | null
  regulators?: ProtocolRegulator[]
  loading?: boolean
  error?: string
  cached?: boolean
  model?: string
  title?: string
  categoryLabels?: Record<string, string>
}>(), {
  regulators: () => [],
  loading: false,
  error: '',
  cached: false,
  model: '',
  title: 'Объяснение помощника ИИ',
  categoryLabels: () => ({}),
});

const emit = defineEmits<{
  object: [o: AiObjectRef]
  fix: [cause: RootCause]
  refresh: []
  close: []
}>();

const objectKey = (o: AiObjectRef): string =>
  o.kind === 'line2' ? `line2:${o.id1}-${o.id2}` : `${o.kind}:${o.id}`;
const categoryLabel = (c: string): string => props.categoryLabels[c] || c;
const fixLabel = (fix: string): string => FIX_LABELS[fix as ProtocolFix] || 'Открыть';
const fixHint = (fix: string): string => FIX_HINTS[fix as ProtocolFix] || '';
const fmt = (v: number): string => (Number.isFinite(v) ? v.toLocaleString('ru-RU', { maximumFractionDigits: 2 }) : '—');
</script>

<style scoped>
.ai-panel {
  margin: 4px 8px 8px;
  padding: 8px 10px;
  border: 1px solid rgba(var(--v-theme-primary), 0.35);
  border-radius: 6px;
  background: rgba(var(--v-theme-primary), 0.04);
  font-size: 12px;
  line-height: 1.4;
}
.ai-panel__head {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
}
.ai-panel__title {
  font-weight: 600;
}
.ai-panel__cached {
  margin-left: 8px;
  opacity: 0.6;
  font-size: 11px;
}
.ai-panel__loading,
.ai-panel__error {
  display: flex;
  align-items: center;
  padding: 4px 0;
}
.ai-panel__error {
  color: rgb(var(--v-theme-error));
}
.ai-panel__summary {
  margin: 0 0 6px;
}
.ai-panel__causes {
  margin: 0 0 6px;
  padding-left: 18px;
}
.ai-cause {
  margin-bottom: 6px;
}
.ai-cause__title {
  font-weight: 600;
}
.ai-cause__category {
  margin-left: 6px;
  font-weight: 400;
  opacity: 0.6;
  font-size: 11px;
}
.ai-cause__objects {
  margin-top: 2px;
}
.ai-panel__subtitle {
  font-weight: 600;
  margin: 6px 0 2px;
}
.ai-regs {
  border-collapse: collapse;
  width: 100%;
}
.ai-regs th,
.ai-regs td {
  padding: 1px 6px;
  text-align: right;
  border-bottom: 1px solid rgba(var(--v-border-color), 0.2);
}
.ai-regs th:first-child,
.ai-regs td:first-child {
  text-align: left;
}
.ai-regs tbody tr {
  cursor: pointer;
}
.ai-regs--short td:nth-child(4) {
  color: rgb(var(--v-theme-error));
}
.ai-regs--over td:nth-child(4) {
  color: rgb(var(--v-theme-warning));
}
.ai-panel__note {
  margin-top: 4px;
}
.ai-panel__next ul {
  margin: 0;
  padding-left: 18px;
}
.ai-panel__foot {
  margin-top: 6px;
  opacity: 0.6;
  font-size: 11px;
}
</style>
