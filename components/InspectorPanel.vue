<template>
  <ObjectCardShell
    :model-value="modelValue"
    :mobile="mobile"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div
      class="inspector"
      :class="{ 'inspector--mobile': mobile }"
    >
      <header
        class="inspector__header"
        :class="mobile ? 'pa-3' : 'pa-4'"
        data-card-drag
      >
        <div class="inspector__heading">
          <v-avatar
            v-if="icon"
            size="40"
            :color="iconColor"
            class="inspector__avatar flex-shrink-0"
          >
            <v-icon
              size="20"
              color="white"
            >
              {{ icon }}
            </v-icon>
          </v-avatar>
          <div style="min-width: 0">
            <div
              class="text-subtitle-1 font-weight-bold text-truncate inspector__title"
              :title="title"
            >
              {{ title }}
            </div>
            <div
              v-if="subtitle"
              class="text-caption text-medium-emphasis text-truncate"
            >
              {{ subtitle }}
            </div>
          </div>
        </div>
        <!-- у участка до 14 кнопок: переносятся, а не сжимают заголовок в столбик -->
        <div class="inspector__actions">
          <slot name="actions" />
          <HintTip
            v-if="!mobile && modeToggle"
            :text="layout.mode === 'panel' ? 'Открепить в отдельное окно' : 'Закрепить панелью справа'"
            hint="Карта остаётся рабочей в обоих режимах"
            location="bottom"
          >
            <template #default="{ props: tip }">
              <v-btn
                v-bind="tip"
                icon
                variant="text"
                size="small"
                color="secondary"
                :aria-label="layout.mode === 'panel' ? 'Открепить в отдельное окно' : 'Закрепить панелью справа'"
                @click="toggleMode"
              >
                <v-icon size="18">
                  {{ layout.mode === 'panel' ? 'mdi-dock-window' : 'mdi-dock-right' }}
                </v-icon>
              </v-btn>
            </template>
          </HintTip>
          <HintTip
            text="Закрыть"
            hotkey="Esc"
            location="bottom"
          >
            <template #default="{ props: tip }">
              <v-btn
                v-bind="tip"
                icon
                variant="text"
                size="small"
                color="secondary"
                aria-label="Закрыть"
                @click="close"
              >
                <v-icon>mdi-close</v-icon>
              </v-btn>
            </template>
          </HintTip>
        </div>
      </header>
      <v-divider />

      <slot name="subheader" />

      <div
        v-if="searchable"
        class="inspector__search pa-3 pb-2"
      >
        <SearchField
          :model-value="search"
          :placeholder="searchPlaceholder"
          :debounce="150"
          :result-count="searchCount"
          aria-label="Поиск по полям"
          @update:model-value="emit('update:search', $event)"
        />
      </div>

      <template v-if="tabs.length">
        <v-tabs
          :model-value="tab"
          bg-color="surface"
          color="primary"
          density="compact"
          slider-color="primary"
          class="inspector__tabs"
          @update:model-value="emit('update:tab', $event as string | number)"
        >
          <v-tab
            v-for="item in tabs"
            :key="String(item.value)"
            :value="item.value"
            class="inspector__tab"
          >
            {{ item.label }}
            <v-chip
              v-if="item.count != null"
              size="x-small"
              color="primary"
              variant="tonal"
              class="ml-1 num"
              style="pointer-events: none"
            >
              {{ item.count }}
            </v-chip>
          </v-tab>
        </v-tabs>
        <v-divider />
      </template>

      <div class="inspector__body">
        <slot />
      </div>

      <div
        v-if="$slots.footer"
        class="inspector__footer"
      >
        <v-divider />
        <slot name="footer" />
      </div>
    </div>
  </ObjectCardShell>
</template>

<script setup lang="ts">
import HintTip from '~/components/HintTip.vue'
import SearchField from '~/components/SearchField.vue'
import ObjectCardShell from '~/components/objectCard/ObjectCardShell.vue'
import { useObjectCardLayout } from '~/composables/useObjectCardLayout'

/** Вкладка инспектора: значение, подпись и счётчик полей */
export interface InspectorTab {
  value: string | number
  label: string
  count?: number | null
}

/**
 * Инспектор объекта (docs/ui-primitives.md): панель справа или плавающее окно (`ObjectCardShell` +
 * `useObjectCardLayout`), единая шапка (иконка, название, подпись, действия, режим панель/окно, закрыть),
 * поиск по полям, вкладки со счётчиками, прокручиваемое тело и подвал. Содержимое — слоты; какие поля
 * показывать и как закрывать (подтверждение правок) решает владелец.
 */
const props = withDefaults(defineProps<{
  modelValue: boolean
  mobile?: boolean
  title: string
  subtitle?: string
  icon?: string
  iconColor?: string
  /** Показывать поле поиска (значение — `v-model:search`) */
  searchable?: boolean
  search?: string
  searchPlaceholder?: string
  /** Число найденных полей: показывается справа в поле, null — не показывать */
  searchCount?: number | null
  tabs?: InspectorTab[]
  tab?: string | number
  /** Кнопка «панель / окно» (на телефоне её нет) */
  modeToggle?: boolean
  /** Закрытие только через событие `close` — владелец сам решает (подтверждение несохранённых правок) */
  manualClose?: boolean
}>(), {
  mobile: false,
  subtitle: '',
  icon: '',
  iconColor: 'primary',
  searchable: false,
  search: '',
  searchPlaceholder: 'Поиск по полям…',
  searchCount: null,
  tabs: () => [],
  tab: 0,
  modeToggle: true,
  manualClose: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:search': [value: string]
  'update:tab': [value: string | number]
  close: []
}>()

const layout = useObjectCardLayout()
const toggleMode = () => {
  layout.mode = layout.mode === 'panel' ? 'float' : 'panel'
}
const close = () => {
  emit('close')
  if (!props.manualClose) emit('update:modelValue', false)
}
</script>

<style scoped>
.inspector {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100%;
  min-height: 0;
  background: rgb(var(--v-theme-surface));
}
.inspector--mobile { max-height: 100dvh; }
.inspector__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-shrink: 0;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  background: rgb(var(--v-theme-surface));
}
.inspector__heading {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex: 1 1 200px;
  min-width: 200px;
}
.inspector__avatar :deep(svg),
.inspector__avatar :deep(path) { fill: white; color: white; }
.inspector__title { font-size: 0.9rem; max-width: 340px; }
.inspector__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-1);
  flex: 0 1 auto;
  min-width: 0;
}
.inspector__search { flex-shrink: 0; background: rgb(var(--v-theme-surface)); }
.inspector__tabs { flex-shrink: 0; }
.inspector__tab { font-size: 0.8rem; min-width: 0; padding: 0 12px; }
/* колонка: формы со своей прокруткой (правка, оборудование) тянутся flex: 1, простое содержимое прокручивается тут */
.inspector__body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(var(--v-theme-on-surface), 0.15) transparent;
}
.inspector__body::-webkit-scrollbar { width: 5px; }
.inspector__body::-webkit-scrollbar-thumb { background: rgba(var(--v-theme-on-surface), 0.15); border-radius: 4px; }
.inspector__footer { flex-shrink: 0; }
@media (max-width: 600px) {
  .inspector__title { max-width: 200px; font-size: 0.85rem; }
}
</style>
