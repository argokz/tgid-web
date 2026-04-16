<template>
  <v-dialog
    v-model="isOpen"
    max-width="500px"
    persistent
  >
    <v-card>
      <v-card-title class="primary-text d-flex align-center py-2">
        <v-icon class="mr-2">
          mdi-puzzle
        </v-icon>
        Выбор фрагмента
        <v-spacer />
        <v-btn
          icon
          density="compact"
          @click="close"
        >
          <v-icon>mdiClose</v-icon>
        </v-btn>
      </v-card-title>
      <v-card-text>
        <v-radio-group v-model="selectedId">
          <v-radio
            v-for="fragment in fragments"
            :key="fragment.id"
            :label="fragment.name"
            :value="fragment.id"
          />
        </v-radio-group>
      </v-card-text>
      <v-card-actions class="pa-3">
        <v-spacer />
        <v-btn
          color="primary"
          variant="elevated"
          :disabled="selectedId === null"
          @click="select"
        >
          Выбрать
        </v-btn>
        <v-btn
          variant="outlined"
          @click="close"
        >
          Отмена
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useFragmentStore } from '~/stores/fragmentStore';
import type { Fragment } from '~/types';

const props = defineProps<{
  modelValue: boolean,
  modelValueId: number | null
}>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean],
  'update:modelValueId': [value: number | null]
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
});

const fragmentStore = useFragmentStore();
const fragments = computed(() => fragmentStore.getFragments);

const selectedId = ref<number | null>(props.modelValueId ?? null);
watch(() => props.modelValueId, (v) => selectedId.value = v);

const close = () => {
  isOpen.value = false;
};
const select = () => {
  emit('update:modelValueId', selectedId.value);
  close();
};
</script> 