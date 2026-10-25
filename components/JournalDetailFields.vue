<template>
  <v-expansion-panels
    multiple
    variant="accordion"
    :model-value="openPanels"
  >
    <v-expansion-panel
      v-for="(group, groupIndex) in groups"
      :key="group.title"
      :value="groupIndex"
    >
      <v-expansion-panel-title>{{ group.title }}</v-expansion-panel-title>
      <v-expansion-panel-text>
        <FieldGrid :min-width="minWidth">
          <FieldCell
            v-for="field in group.fields"
            :key="field.label"
            :label="field.label"
            :readonly="!editable(field.key)"
            :dirty="editable(field.key) && isFieldDirty(field.key)"
            :span="field.type === 'textarea'"
            :required="Boolean(field.key) && requiredKeys.includes(field.key!)"
            :units="field.units"
            :hint="field.hint"
          >
            <template #default="{ id }">
              <template v-if="editable(field.key)">
                <AppSelect
                  v-if="field.type === 'select'"
                  :id="id"
                  :model-value="model[field.key!]"
                  :items="field.items ?? []"
                  item-title="name"
                  item-value="id"
                  @update:model-value="setField(field.key!, $event)"
                />
                <v-text-field
                  v-else-if="field.type === 'date' || field.type === 'time'"
                  :id="id"
                  :model-value="model[field.key!]"
                  :type="field.type"
                  density="compact"
                  hide-details
                  variant="outlined"
                  @update:model-value="setField(field.key!, $event)"
                />
                <v-textarea
                  v-else-if="field.type === 'textarea'"
                  :id="id"
                  :model-value="model[field.key!]"
                  rows="2"
                  auto-grow
                  density="compact"
                  hide-details
                  variant="outlined"
                  @update:model-value="setField(field.key!, $event)"
                />
                <v-text-field
                  v-else
                  :id="id"
                  :model-value="model[field.key!]"
                  :type="field.type === 'number' ? 'number' : 'text'"
                  :class="{ num: field.type === 'number' }"
                  density="compact"
                  hide-details
                  variant="outlined"
                  @update:model-value="setField(field.key!, $event)"
                />
              </template>
              <div
                v-else
                :id="id"
                class="journal-detail-value"
                :class="{ num: field.type === 'number' }"
              >
                {{ field.value }}
              </div>
            </template>
          </FieldCell>
        </FieldGrid>
      </v-expansion-panel-text>
    </v-expansion-panel>
    <slot />
  </v-expansion-panels>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AppSelect from '~/components/AppSelect.vue';
import FieldCell from '~/components/FieldCell.vue';
import FieldGrid from '~/components/FieldGrid.vue';

/** Поле карточки журнала: подпись, показ, ключ записи и тип поля правки */
export interface JournalDetailField {
  label: string;
  value: string;
  rawValue?: unknown;
  key?: string;
  type: string;
  items?: readonly unknown[];
  units?: string;
  hint?: string;
}

export interface JournalDetailGroup {
  title: string;
  fields: JournalDetailField[];
}

/**
 * Поля карточки записи журнала группами (аккордеон, как в десктопных карточках): просмотр — значение под
 * подписью, правка — поле по типу (`select` → AppSelect, date/time, textarea, number/text). Какие поля правятся
 * и какие изменены, решает журнал (`useJournalEdit`): `editable(key)`, `isFieldDirty(key)`. Дополнительные
 * панели (связи, документы) — в слот.
 */
const props = withDefaults(defineProps<{
  groups: readonly JournalDetailGroup[];
  /** Значения формы (в правке); читается по ключу поля */
  model: Record<string, any>;
  editable: (key?: string | null) => boolean;
  isFieldDirty: (key?: string | null) => boolean;
  requiredKeys?: readonly string[];
  /** Какие панели раскрыты; по умолчанию первые две */
  openPanels?: readonly number[];
  minWidth?: number;
}>(), {
  requiredKeys: () => [],
  openPanels: () => [0, 1],
  minWidth: 220,
});

const emit = defineEmits<{ 'update:model': [value: Record<string, any>] }>();

const setField = (key: string, value: unknown) => {
  emit('update:model', { ...props.model, [key]: value });
};

const openPanels = computed(() => [...props.openPanels]);
</script>

<style scoped>
.journal-detail-value {
  color: rgb(var(--v-theme-on-surface));
  font-size: 0.9rem;
  overflow-wrap: anywhere;
}
</style>
