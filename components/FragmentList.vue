<template>
  <client-only>
    <v-card
      flat
      class="mb-4"
    >
      <v-card-title class="text-subtitle-2 py-2">
        <v-icon start>
          mdi-puzzle
        </v-icon>
        Фрагменты
      </v-card-title>
      <v-card-text class="pa-0">
        <template v-if="loading">
          <v-skeleton-loader
            type="list-item-two-line"
            class="pa-2"
          />
          <v-skeleton-loader
            type="list-item-two-line"
            class="pa-2"
          />
          <v-skeleton-loader
            type="list-item-two-line"
            class="pa-2"
          />
        </template>
        <template v-else-if="loadError">
          <v-alert
            type="error"
            variant="tonal"
            class="ma-2"
            density="compact"
          >
            {{ loadError }}
            <template #append>
              <v-btn
                variant="text"
                color="error"
                size="small"
                @click="loadFragments"
              >
                Повторить
              </v-btn>
            </template>
          </v-alert>
        </template>
        <v-list
          v-else
          density="compact"
          class="pa-0"
        >
          <template v-if="fragments.length">
            <v-list-item
              v-for="fragment in fragments"
              :key="fragment.id"
              :class="{ 'fragment-active': isFragmentVisible(fragment.id) }"
            >
              <template #prepend>
                <v-checkbox
                  v-model="visibleFragments"
                  :value="fragment.id"
                  hide-details
                  density="compact"
                  @update:model-value="() => toggleFragment(fragment.id)"
                />
              </template>

              <v-list-item-title class="text-body-2">
                {{ fragment.name }}
              </v-list-item-title>
            </v-list-item>
          </template>
          <v-list-item v-else>
            <v-list-item-title class="text-caption">
              Нет доступных фрагментов
            </v-list-item-title>
          </v-list-item>
        </v-list>
      </v-card-text>
    </v-card>
  </client-only>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useFragmentStore } from '~/stores/fragmentStore';
import { fastApiService } from '~/services/fastApiService';
import type { Fragment } from '~/types';

// Store
const fragmentStore = useFragmentStore();

// State
const visibleFragments = ref<number[]>([]);
const loading = ref(false);
const loadError = ref<string | null>(null);

// Computed
const fragments = computed(() => fragmentStore.getFragments);

// Methods
const isFragmentVisible = (fragmentId: number): boolean => {
  return fragmentStore.getVisibleFragments.includes(fragmentId);
};

const toggleFragment = (fragmentId: number): void => {
  fragmentStore.toggleFragment(fragmentId);
};

const loadFragments = async () => {
  if (!process.client) return;
  loading.value = true;
  loadError.value = null;
  try {
    const { data } = await fastApiService.getFragments();
    fragmentStore.fragments = data;
  } catch (error) {
    console.error('Failed to load fragments:', error);
    loadError.value = 'Не удалось загрузить фрагменты';
    useNotificationStore().showError('Не удалось загрузить фрагменты');
  } finally {
    loading.value = false;
  }
};

// Sync visibleFragments with store
watch(() => fragmentStore.getVisibleFragments, (newValue) => {
  visibleFragments.value = [...newValue];
}, { immediate: true });

onMounted(() => {
  if (process.client) {
    visibleFragments.value = [...fragmentStore.getVisibleFragments];
    loadFragments();
  }
});
</script>

<style lang="scss" scoped>
.fragment-active {
  background-color: rgba(var(--v-theme-primary), 0.05);
}

:deep(.v-list-item) {
  min-height: 40px !important;
}
</style> 