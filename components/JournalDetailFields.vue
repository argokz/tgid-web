<template>
  <v-expansion-panels
    ref="rootRef"
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
            :class="{ 'journal-detail-focus': focusLabel && field.label === focusLabel }"
            :label="field.label"
            :readonly="!editable(field.key)"
            :dirty="editable(field.key) && isFieldDirty(field.key)"
            :span="field.type === 'textarea'"
            :required="editable(field.key) && requiredKeys.includes(field.key!)"
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
import { computed, nextTick, ref, watch } from 'vue';
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
  /** Значения формы (в правке); читается по ключу поля, меняется родителем по `update:field` */
  model: Record<string, any>;
  editable: (key?: string | null) => boolean;
  isFieldDirty: (key?: string | null) => boolean;
  requiredKeys?: readonly string[];
  /** Какие панели раскрыты; по умолчанию первые две */
  openPanels?: readonly number[];
  minWidth?: number;
  /**
   * Подпись поля, к которому привели (переход из протокола расчёта: «что исправить»): его группа раскрыта,
   * поле подсвечено и прокручено в видимую часть, в правке — курсор в нём
   */
  focusLabel?: string | null;
}>(), {
  requiredKeys: () => [],
  openPanels: () => [0, 1],
  minWidth: 220,
  focusLabel: null,
});

/** Одно поле изменилось: родитель сам обновляет свою модель (несколько событий в одном тике не теряются) */
const emit = defineEmits<{ 'update:field': [key: string, value: unknown] }>();

const setField = (key: string, value: unknown) => {
  emit('update:field', key, value);
};

const focusGroup = computed(() =>
  props.focusLabel ? props.groups.findIndex((g) => g.fields.some((f) => f.label === props.focusLabel)) : -1);

const openPanels = computed(() => {
  const open = [...props.openPanels];
  if (focusGroup.value >= 0 && !open.includes(focusGroup.value)) open.push(focusGroup.value);
  return open;
});

const rootRef = ref<{ $el?: HTMLElement } | null>(null);

/** Прокрутить к подсвеченному полю (после раскрытия группы) и поставить курсор, если оно правится */
const revealFocus = async () => {
  if (focusGroup.value < 0) return;
  await nextTick();
  // панель раскрывается с анимацией — ждём кадр, чтобы поле уже имело размер
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  const cell = rootRef.value?.$el?.querySelector?.('.journal-detail-focus') as HTMLElement | null;
  if (!cell) return;
  cell.scrollIntoView({ block: 'center', behavior: 'smooth' });
  cell.querySelector<HTMLElement>('input, textarea, [role="combobox"]')?.focus({ preventScroll: true });
};

/** Поле фокуса сейчас правится (editable — функция, её ссылка не меняется при входе в правку) */
const focusEditable = computed(() => {
  const field = props.groups.flatMap((g) => g.fields).find((f) => f.label === props.focusLabel);
  return Boolean(field && props.editable(field.key));
});

// Подпись поля, группы (загрузилась карточка) или режим правки сменились — показать поле заново
watch(() => [props.focusLabel, props.groups, focusEditable.value], () => { void revealFocus(); }, { flush: 'post' });
</script>

<style scoped>
/* Поле, к которому привели из протокола расчёта: акцент «что исправить» */
.journal-detail-focus {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
  background: var(--accent-soft);
}

.journal-detail-value {
  color: rgb(var(--v-theme-on-surface));
  font-size: 0.9rem;
  overflow-wrap: anywhere;
}
</style>
