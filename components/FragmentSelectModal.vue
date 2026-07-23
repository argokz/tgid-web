<template>
  <v-dialog
    v-model="isOpen"
    :max-width="mobile ? undefined : 500"
    :fullscreen="mobile"
    scrollable
    persistent
    :transition="mobile ? 'dialog-bottom-transition' : 'dialog-transition'"
  >
    <v-card :rounded="mobile ? '0' : undefined">
      <v-card-title class="primary-text d-flex align-center py-3 px-4 bg-primary text-white">
        <v-icon class="mr-2">
          mdi-puzzle
        </v-icon>
        Выбор фрагмента (района)
        <v-spacer />
        <v-btn
          icon="mdi-close"
          variant="text"
          density="compact"
          @click="close"
        />
      </v-card-title>
      <v-card-text class="pa-4">
        <v-radio-group v-model="selectedId">
          <v-radio
            v-for="fragment in fragments"
            :key="fragment.id"
            :label="fragment.name"
            :value="fragment.id"
            color="primary"
          />
        </v-radio-group>
      </v-card-text>
      <v-card-actions class="pa-3 bg-grey-lighten-4 border-top">
        <v-spacer />
        <v-btn
          color="primary"
          variant="elevated"
          :disabled="selectedId === null"
          @click="apply"
        >
          Применить
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useFragmentStore } from '~/stores/fragmentStore';
import { useMobile } from '~/composables/useMobile';

const isOpen = ref(false);
const selectedId = ref<number | null>(null);
const fragmentStore = useFragmentStore();
const { isMobile: mobile } = useMobile();

const fragments = computed(() => fragmentStore.fragments);

const openDialog = () => {
  isOpen.value = true;
  selectedId.value = fragmentStore.selectedFragmentId;
};

const close = () => {
  isOpen.value = false;
};

const apply = () => {
  if (selectedId.value !== null) {
    fragmentStore.applyVisibleFragmentsSelection([selectedId.value]);
  }
  close();
};

defineExpose({ openDialog });
</script>
