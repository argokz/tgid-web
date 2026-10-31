<template>
  <v-dialog
    v-model="visible"
    :max-width="900"
    :fullscreen="isMobile"
    scrollable
  >
    <v-card>
      <v-card-title class="d-flex align-center py-3 px-4">
        <v-icon
          class="mr-2"
          color="primary"
        >
          mdi-book-open-page-variant-outline
        </v-icon>
        <span class="text-h6 flex-grow-1">Схема теплоснабжения: глава «Электронная модель»</span>
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          aria-label="Закрыть"
          @click="visible = false"
        />
      </v-card-title>
      <v-divider />
      <v-card-text>
        <p class="text-body-2 mb-2">
          Черновик главы 3 по данным города: по каждому подпункту п. 55 Требований к схемам теплоснабжения
          (ПП РФ № 154) — как требование выполняет ТГИД и состояние данных. «Частично» и «нет данных»
          дорабатывает разработчик схемы.
        </p>
        <v-alert
          v-if="errorMessage"
          type="error"
          density="compact"
          variant="tonal"
          closable
          class="mb-2"
          @click:close="errorMessage = ''"
        >
          {{ errorMessage }}
        </v-alert>
        <div class="d-flex align-center flex-wrap ga-2 mb-3">
          <v-btn-toggle
            v-model="scope"
            density="compact"
            mandatory
            variant="outlined"
            divided
          >
            <v-btn value="all">
              Все фрагменты, кроме копий
            </v-btn>
            <v-btn
              value="visible"
              :disabled="!visibleIds.length"
            >
              На карте ({{ visibleIds.length }})
            </v-btn>
          </v-btn-toggle>
          <v-spacer />
          <v-btn
            size="small"
            variant="tonal"
            prepend-icon="mdi-refresh"
            :loading="busy === 'collect'"
            :disabled="!!busy"
            @click="collect"
          >
            Собрать
          </v-btn>
          <v-btn
            v-if="canExport"
            size="small"
            color="primary"
            variant="flat"
            prepend-icon="mdi-file-word-outline"
            :loading="busy === 'docx'"
            :disabled="!!busy || !chapter"
            @click="downloadDocx"
          >
            Word
          </v-btn>
        </div>
        <v-progress-linear
          v-if="busy === 'collect'"
          indeterminate
          class="mb-2"
        />
        <template v-if="chapter">
          <p class="text-body-2 mb-1">
            {{ modelText }}
          </p>
          <p
            v-if="chapter.copies.length"
            class="text-caption text-medium-emphasis mb-2"
          >
            Не вошли — копии более новых фрагментов: {{ copiesText }}.
          </p>
          <v-expansion-panels
            variant="accordion"
            class="mb-2"
          >
            <v-expansion-panel
              v-for="s in chapter.sections"
              :key="s.key"
            >
              <v-expansion-panel-title>
                <span class="em-key mr-2">«{{ s.key }}»</span>
                <span class="flex-grow-1">{{ s.title }}</span>
                <v-chip
                  size="x-small"
                  :color="EM_STATUS_COLOR[s.status]"
                  variant="tonal"
                  class="ml-2"
                >
                  {{ s.status }}
                </v-chip>
              </v-expansion-panel-title>
              <v-expansion-panel-text>
                <p
                  v-for="(t, i) in s.text"
                  :key="i"
                  class="text-body-2 mb-2"
                >
                  {{ t }}
                </p>
                <template
                  v-for="tab in s.tables"
                  :key="tab.title"
                >
                  <div class="text-subtitle-2 mt-2 mb-1">
                    {{ tab.title }}
                  </div>
                  <v-table
                    density="compact"
                    class="em-table"
                  >
                    <thead>
                      <tr>
                        <th
                          v-for="h in tab.header"
                          :key="h"
                        >
                          {{ h }}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="(row, ri) in tab.rows"
                        :key="ri"
                      >
                        <td
                          v-for="(v, ci) in row"
                          :key="ci"
                        >
                          {{ v }}
                        </td>
                      </tr>
                    </tbody>
                  </v-table>
                </template>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </template>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useMobile } from '~/composables/useMobile';
import { fastApiService } from '~/services/fastApiService';
import { useAuthStore } from '~/stores/authStore';
import { useFragmentStore } from '~/stores/fragmentStore';
import { formatApiError } from '~/utils/apiError';
import { EM_STATUS_COLOR, statusCounts, type EmChapter } from '~/utils/emChapter';
import { downloadBlob } from '~/utils/printRender';

/**
 * Глава «Электронная модель системы теплоснабжения» (itwin-api database/em_chapter.py): соответствие подпунктам
 * п. 55 Требований ПП РФ № 154 по данным города и выгрузка черновика в Word.
 */
const visible = defineModel<boolean>({ default: false });
const { isMobile } = useMobile();
const authStore = useAuthStore();
const fragmentStore = useFragmentStore();

const scope = ref<'all' | 'visible'>('all');
const chapter = ref<EmChapter | null>(null);
const busy = ref<'' | 'collect' | 'docx'>('');
const errorMessage = ref('');

const canExport = computed(() => (authStore.permissions.general as string[]).includes('export'));
const visibleIds = computed(() => [...fragmentStore.visibleFragments] as number[]);
const fileids = computed(() => (scope.value === 'visible' ? visibleIds.value : undefined));
const num = (v: number, digits = 0) => v.toLocaleString('ru-RU', { maximumFractionDigits: digits });
const modelText = computed(() => {
  const c = chapter.value;
  if (!c) return '';
  const n = statusCounts(c);
  return `В модели: фрагментов — ${num(c.fragments.length)}, участков — ${num(c.lines)}, длина — ${num(c.km, 1)} км. `
    + `Подпунктов выполняется — ${n['выполняется']}, частично — ${n['частично']}, нет данных — ${n['нет данных']}.`;
});
const copiesText = computed(() => (chapter.value?.copies ?? [])
  .map((c) => `${c.name ?? `№ ${c.id}`} (${Math.round(c.share * 100)} %)`).join('; '));

const collect = async () => {
  busy.value = 'collect';
  errorMessage.value = '';
  try {
    chapter.value = await fastApiService.getEmChapter(fileids.value);
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Данные главы не собраны');
  } finally {
    busy.value = '';
  }
};

const downloadDocx = async () => {
  busy.value = 'docx';
  errorMessage.value = '';
  try {
    const city = authStore.cityLabel || '';
    const blob = await fastApiService.getEmChapterDocx(city, fileids.value);
    downloadBlob(blob, `Глава 3 Электронная модель${city ? ` — ${city}` : ''}.docx`);
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Word не выгрузился');
  } finally {
    busy.value = '';
  }
};

// сборка — при открытии окна и смене охвата
watch([visible, scope], ([open]) => {
  if (open) void collect();
}, { immediate: true });

const openDialog = () => {
  visible.value = true;
};

defineExpose({ openDialog });
</script>

<style scoped>
.em-key { min-width: 2.2em; font-weight: 600; }
.em-table { font-size: var(--text-sm, 0.8125rem); }
</style>
