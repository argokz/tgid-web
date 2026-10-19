<template>
  <v-menu
    v-model="open"
    :target="menu ? [menu.clientX, menu.clientY] : undefined"
    location="bottom start"
    :close-on-content-click="true"
  >
    <v-list
      v-if="menu"
      density="compact"
      min-width="240"
      class="editor-context-menu"
    >
      <v-list-subheader>{{ title }}</v-list-subheader>
      <template
        v-for="item in items"
        :key="item.action"
      >
        <v-divider v-if="item.divider" />
        <v-list-item
          v-else
          :prepend-icon="item.icon"
          :title="item.title"
          :subtitle="item.hint"
          :disabled="item.disabled"
          :base-color="item.danger ? 'error' : undefined"
          @click="emit('action', item.action)"
        />
      </template>
    </v-list>
  </v-menu>
</template>

<script setup lang="ts">
/** Правый щелчок в правке сети: действия с узлом, участком или точкой карты (по правам пользователя) */
import { computed } from 'vue'
import { useAuthStore } from '~/stores/authStore'
import { canDo, type PermKind } from '~/utils/permissions'
import type { EditorContextAction, EditorContextTarget } from '~/utils/editorTools'

const props = defineProps<{ menu: EditorContextTarget | null }>()
const emit = defineEmits<{ action: [action: EditorContextAction] }>()
const open = defineModel<boolean>({ default: false })

const authStore = useAuthStore()
const p = computed(() => authStore.permissions)
const nodeKinds: PermKind[] = ['node', 'consumer', 'source']
const anyNode = (a: 'edit' | 'create' | 'move' | 'delete') => nodeKinds.some((k) => canDo(p.value, k, a))

const title = computed(() => {
  const m = props.menu
  if (!m) return ''
  if (m.kind === 'node') return `Узел ${m.id}`
  if (m.kind === 'line') return `Участок ${m.id}`
  return 'Точка карты'
})

interface Item {
  action: EditorContextAction
  title: string
  icon?: string
  hint?: string
  disabled?: boolean
  danger?: boolean
  divider?: boolean
}

const items = computed<Item[]>(() => {
  const m = props.menu
  if (!m) return []
  const common: Item[] = [
    { action: 'copy', title: 'Копировать координаты', icon: 'mdi-content-copy', hint: 'широта, долгота' },
  ]
  if (m.kind === 'node') {
    return [
      { action: 'props', title: 'Свойства', icon: 'mdi-card-text-outline' },
      { action: 'trace-from', title: 'Начать трассу отсюда', icon: 'mdi-vector-polyline-plus', disabled: !canDo(p.value, 'line', 'create') },
      { action: 'merge-into', title: 'Слить другой узел в этот…', icon: 'mdi-call-merge', disabled: !anyNode('delete') },
      { action: 'node-type', title: 'Тип узла, ЗН, подпитка…', icon: 'mdi-shape-outline', disabled: !anyNode('edit') && !canDo(p.value, 'regime', 'edit') },
      { action: 'focus', title: 'Показать', icon: 'mdi-image-filter-center-focus', hint: 'F' },
      ...common,
      { action: 'divider', title: '', divider: true },
      { action: 'dissolve', title: 'Убрать узел, соединив трубы…', icon: 'mdi-vector-polyline-remove', disabled: !anyNode('delete') },
      { action: 'delete', title: 'Удалить…', icon: 'mdi-delete-outline', hint: 'Del', danger: true, disabled: !anyNode('delete') },
    ]
  }
  if (m.kind === 'line') {
    return [
      { action: 'props', title: 'Свойства', icon: 'mdi-card-text-outline' },
      { action: 'vertices', title: 'Изломы', icon: 'mdi-vector-polyline-edit', hint: 'E', disabled: !canDo(p.value, 'line', 'move') },
      { action: 'split-here', title: 'Врезать узел здесь…', icon: 'mdi-source-branch-plus', disabled: !canDo(p.value, 'line', 'move') },
      { action: 'line-type', title: 'Тип линии (участок ↔ оборудование)…', icon: 'mdi-pipe-valve', disabled: !canDo(p.value, 'line', 'edit') },
      { action: 'bends', title: 'Отводы → местные сопротивления…', icon: 'mdi-vector-polyline', disabled: !canDo(p.value, 'line', 'edit') },
      { action: 'trace-from', title: 'Начать трассу отсюда (врезка)', icon: 'mdi-vector-polyline-plus', disabled: !canDo(p.value, 'line', 'create') },
      { action: 'focus', title: 'Показать', icon: 'mdi-image-filter-center-focus', hint: 'F' },
      ...common,
      { action: 'divider', title: '', divider: true },
      { action: 'delete', title: 'Удалить…', icon: 'mdi-delete-outline', hint: 'Del', danger: true, disabled: !canDo(p.value, 'line', 'delete') },
    ]
  }
  return [
    { action: 'node-here', title: 'Новый узел здесь', icon: 'mdi-circle-medium', disabled: !anyNode('create') },
    { action: 'trace-from', title: 'Начать трассу здесь', icon: 'mdi-vector-polyline-plus', disabled: !canDo(p.value, 'line', 'create') },
    ...common,
  ]
})
</script>
