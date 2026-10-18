<template>
  <!-- Схема присоединения потребителя, как окно CPotrcxemaDialog десктопа (fun_schemeNum) -->
  <v-dialog
    :model-value="modelValue"
    max-width="520"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="csd-title">
        <span>Схема присоединения</span>
        <v-spacer />
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          aria-label="Закрыть"
          @click="emit('update:modelValue', false)"
        />
      </v-card-title>
      <v-divider />
      <v-card-text class="csd-body">
        <div class="csd-group">
          <v-checkbox
            v-model="o.otop"
            label="Отопление"
            density="compact"
            hide-details
          />
          <v-radio-group
            v-model="o.dependent"
            :disabled="!o.otop"
            density="compact"
            hide-details
            inline
            class="csd-indent"
          >
            <v-radio
              :value="true"
              label="Зависимое"
            />
            <v-radio
              :value="false"
              label="Независимое"
            />
          </v-radio-group>
          <v-radio-group
            v-model="o.elevator"
            :disabled="!o.otop || !o.dependent"
            density="compact"
            hide-details
            inline
            class="csd-indent"
          >
            <v-radio
              :value="true"
              label="Элеваторное"
            />
            <v-radio
              :value="false"
              label="Безэлеваторное"
            />
          </v-radio-group>
        </div>
        <div class="csd-group">
          <v-checkbox
            v-model="o.gvs"
            label="Горячее водоснабжение"
            density="compact"
            hide-details
          />
          <v-radio-group
            v-model="o.gvsType"
            :disabled="!o.gvs"
            density="compact"
            hide-details
            class="csd-indent"
          >
            <v-radio
              v-for="t in GVS_TYPES"
              :key="t.value"
              :value="t.value"
              :label="t.title"
            />
          </v-radio-group>
        </div>
        <div class="csd-group">
          <v-checkbox
            v-model="o.vent"
            label="Вентиляция"
            density="compact"
            hide-details
          />
          <v-checkbox
            v-model="o.rez"
            :disabled="!rezAllowed(o)"
            label="Рециркуляция ГВС (при отоплении и открытой ГВС)"
            density="compact"
            hide-details
          />
        </div>
        <div class="csd-result">
          <span class="text-medium-emphasis">Номер схемы:</span>
          <b class="csd-number">{{ number }}</b>
          <span
            v-if="scheme && number !== scheme"
            class="text-medium-emphasis"
          >(было {{ scheme }})</span>
        </div>
        <div class="text-caption text-medium-emphasis">{{ schemeSummary(number) }}</div>
        <div
          v-if="scheme && number !== scheme"
          class="text-caption mt-2"
        >
          Нагрузки (расчётные и договорные) перейдут в поля новой схемы, остальные нагрузки станут 0 — как в десктопе.
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          variant="text"
          @click="emit('update:modelValue', false)"
        >Отмена</v-btn>
        <v-btn
          color="primary"
          variant="flat"
          @click="apply"
        >Ок</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { rezAllowed, schemeNumber, schemeOptions, schemeSummary, type SchemeOptions } from '~/utils/consumerScheme';

const props = defineProps<{
  modelValue: boolean
  /** текущий номер схемы */
  scheme: string
}>();
const emit = defineEmits<{
  'update:modelValue': [open: boolean]
  apply: [scheme: string]
}>();

const GVS_TYPES: { value: SchemeOptions['gvsType']; title: string }[] = [
  { value: 'op', title: 'Открытая, водоразбор из подающего' },
  { value: 'oo', title: 'Открытая, водоразбор из обратного' },
  { value: 'pr', title: 'Закрытая параллельная' },
  { value: 'sm', title: 'Закрытая смешанная' },
  { value: 'ps', title: 'Закрытая последовательная' },
  { value: 'pw', title: 'Закрытая предвключённая' },
];

const o = ref<SchemeOptions>(schemeOptions(props.scheme));
watch(() => [props.modelValue, props.scheme], () => {
  if (props.modelValue) o.value = schemeOptions(props.scheme);
});
// рециркуляция недоступна — снимается, как в окне десктопа
watch(() => rezAllowed(o.value), (ok) => { if (!ok) o.value.rez = false; });

const number = computed(() => schemeNumber(o.value));

const apply = () => {
  emit('apply', number.value);
  emit('update:modelValue', false);
};
</script>

<style scoped>
.csd-title {
  display: flex;
  align-items: center;
  font-size: 16px;
}
.csd-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.csd-group {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 6px;
  padding: 4px 8px 6px;
}
.csd-indent {
  margin-left: 32px;
}
.csd-result {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 4px;
}
.csd-number {
  font-size: 18px;
}
</style>
