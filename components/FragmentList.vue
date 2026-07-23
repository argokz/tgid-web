<template>
  <client-only>
    <v-card flat class="mb-4">
      <v-card-title class="text-subtitle-2 py-2 d-flex align-center">
        <v-icon start color="primary">mdi-puzzle</v-icon>
        Фрагменты (районы сети)
      </v-card-title>
      <v-card-text class="pa-0">
        <template v-if="loading">
          <v-skeleton-loader type="list-item-two-line" class="pa-2" />
          <v-skeleton-loader type="list-item-two-line" class="pa-2" />
        </template>
        <template v-else-if="loadError">
          <v-alert type="error" variant="tonal" class="ma-2" density="compact">
            {{ loadError }}
            <template #append>
              <v-btn variant="text" color="error" size="small" @click="retryLoad">Повторить</v-btn>
            </template>
          </v-alert>
        </template>
        <template v-else-if="fragments.length === 0">
          <div class="text-caption text-medium-emphasis pa-3 text-center">Фрагменты не найдены</div>
        </template>
        <v-list v-else density="compact" select-strategy="leaf">
          <v-list-item
            v-for="fragment in fragments"
            :key="fragment.id"
            :value="fragment.id"
            :active="isFragmentVisible(fragment.id)"
            @click="toggleFragment(fragment.id)"
          >
            <template #prepend>
              <v-checkbox-btn
                :model-value="isFragmentVisible(fragment.id)"
                color="primary"
                density="compact"
              />
            </template>
            <v-list-item-title class="text-body-2">{{ fragment.name }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-card-text>
    </v-card>
  </client-only>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useFragmentStore } from '~/stores/fragmentStore';

const fragmentStore = useFragmentStore();
const loading = ref(false);
const loadError = ref<string | null>(null);

const fragments = computed(() => fragmentStore.fragments);

const isFragmentVisible = (id: number) => {
  return fragmentStore.visibleFragments.includes(id);
};

const toggleFragment = (id: number) => {
  fragmentStore.toggleFragment(id);
};

const retryLoad = async () => {
  loading.value = true;
  loadError.value = null;
  try {
    await fragmentStore.loadFragments();
  } catch (err: any) {
    loadError.value = 'Ошибка загрузки фрагментов';
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  if (fragmentStore.fragments.length === 0) {
    await retryLoad();
  }
});
</script>
