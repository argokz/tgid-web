<template>
  <v-menu
    v-model="open"
    :close-on-content-click="false"
    location="top start"
  >
    <template #activator="{ props: menu }">
      <v-btn
        v-bind="menu"
        size="small"
        variant="text"
        prepend-icon="mdi-at"
      >
        Упомянуть
      </v-btn>
    </template>
    <v-card
      min-width="240"
      max-width="320"
    >
      <v-text-field
        v-model="filter"
        placeholder="Логин"
        density="compact"
        variant="plain"
        hide-details
        autofocus
        class="px-3"
      />
      <v-divider />
      <v-list
        density="compact"
        max-height="260"
      >
        <v-list-item
          v-for="p in shown"
          :key="p.login"
          :title="`@${p.login}`"
          @click="pick(p.login)"
        />
        <v-list-item
          v-if="!shown.length"
          :title="people.length ? 'Никого не нашлось' : 'Список пользователей недоступен — напишите @логин сами'"
          disabled
        />
      </v-list>
    </v-card>
  </v-menu>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { CommentPerson } from '~/utils/mapComments';

/** Выбор, кого упомянуть в комментарии (@логин): список пользователей города с поиском */
const props = defineProps<{ people: CommentPerson[] }>();
const emit = defineEmits<{ pick: [login: string] }>();

const MAX_SHOWN = 50;
const open = ref(false);
const filter = ref('');

const shown = computed(() => {
  const q = filter.value.trim().toLowerCase();
  return props.people.filter((p) => !q || p.login.toLowerCase().includes(q)).slice(0, MAX_SHOWN);
});

function pick(login: string): void {
  emit('pick', login);
  open.value = false;
  filter.value = '';
}
</script>
