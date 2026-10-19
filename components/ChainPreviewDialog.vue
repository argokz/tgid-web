<template>
  <v-dialog
    v-model="open"
    max-width="620"
    persistent
  >
    <v-card rounded="lg">
      <v-card-title class="d-flex align-center bg-primary text-white pa-3">
        <v-icon class="me-2">
          mdi-vector-polyline-plus
        </v-icon>
        <span class="text-subtitle-1">{{ note ? 'Ввод в здание' : 'Новая трасса' }}</span>
        <v-spacer />
        <span
          v-if="result"
          class="text-body-2"
        >{{ formatMeters(result.total_length_m) }}</span>
      </v-card-title>

      <v-card-text class="pa-4">
        <v-alert
          v-if="note"
          type="info"
          variant="tonal"
          density="compact"
          class="mb-3"
        >
          {{ note }}
        </v-alert>
        <div
          v-if="addressText != null"
          class="mb-3"
        >
          <v-text-field
            v-model="addressText"
            label="Подпись потребителя (адрес)"
            density="compact"
            variant="outlined"
            hide-details="auto"
            maxlength="50"
            counter="50"
            :disabled="saving"
          />
          <v-checkbox
            v-model="addressWrite"
            :disabled="saving || !addressText?.trim()"
            density="compact"
            hide-details
            label="Записать в карточку потребителя (имя и номер дома)"
          />
        </div>
        <div
          v-if="loading"
          class="d-flex align-center justify-center py-6"
        >
          <v-progress-circular
            indeterminate
            color="primary"
            size="32"
          />
          <span class="ms-3 text-body-2">Проверка трассы…</span>
        </div>

        <v-alert
          v-else-if="error"
          type="error"
          variant="tonal"
          density="compact"
        >
          {{ error }}
        </v-alert>

        <template v-else-if="result">
          <div class="text-caption text-medium-emphasis mb-1">
            {{ pipeModeTitle }}{{ result.fileid ? ` · фрагмент ${result.fileid}` : '' }}
          </div>
          <v-table
            density="compact"
            class="mb-3"
          >
            <thead>
              <tr>
                <th>Участок</th>
                <th>Трубы (признак)</th>
                <th class="text-right">
                  Длина
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="s in result.segments"
                :key="s.segment"
              >
                <td>{{ s.segment }}</td>
                <td>{{ s.sign_names.join(' + ') }}</td>
                <td class="text-right">
                  {{ formatMeters(s.length_m) }}
                </td>
              </tr>
            </tbody>
          </v-table>

          <div
            v-if="result.taps.length"
            class="mb-3"
          >
            <div
              v-for="t in result.taps"
              :key="t.line_id"
              class="text-body-2"
            >
              <v-icon
                size="16"
                color="error"
                class="me-1"
              >
                mdi-source-branch
              </v-icon>
              Врезка в участок {{ t.line_id }}{{ t.pair_line_id ? ` и парную трубу ${t.pair_line_id}` : '' }}:
              труба будет разрезана, паспорт и оборудование перенесутся на половины
            </div>
          </div>

          <v-alert
            v-for="(i, k) in result.issues"
            :key="k"
            :type="i.level === 'error' ? 'error' : i.level === 'warning' ? 'warning' : 'info'"
            variant="tonal"
            density="compact"
            class="mb-2"
          >
            {{ i.message }}
          </v-alert>

          <div
            v-if="result.ok && !result.issues.length"
            class="text-body-2 text-success"
          >
            <v-icon
              size="16"
              color="success"
              class="me-1"
            >
              mdi-check-circle
            </v-icon>
            Проверки пройдены. Длина в базе — по местной системе координат, как в десктопе.
          </div>
          <div
            v-if="!result.ok"
            class="text-body-2 mt-2"
          >
            Исправьте трассу: «Назад к трассе», затем Backspace убирает последнюю точку.
          </div>
        </template>
      </v-card-text>

      <v-card-actions class="pa-3">
        <v-btn
          variant="text"
          color="error"
          :disabled="saving"
          @click="emit('discard')"
        >
          Сбросить трассу
        </v-btn>
        <v-spacer />
        <v-btn
          variant="text"
          :disabled="saving"
          @click="emit('back')"
        >
          Назад к трассе
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :loading="saving"
          :disabled="loading || !result?.ok"
          @click="emit('confirm')"
        >
          Создать
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ChainResult } from '~/services/fastApiService';
import { formatMeters } from '~/utils/cadGeometry';
import { PIPE_MODE_ITEMS } from '~/utils/cadChain';

const open = defineModel<boolean>({ default: false });
const props = defineProps<{
  result: ChainResult | null
  loading: boolean
  saving: boolean
  error: string | null
  /** ввод в здание: что построено по подложке (номер дома — только для сверки) */
  note?: string | null
}>();
const emit = defineEmits<{ confirm: []; back: []; discard: [] }>();
/** ввод в здание: подпись потребителя по адресу с карты (null — поле не показывается) и согласие записать её */
const addressText = defineModel<string | null>('addressText', { default: null });
const addressWrite = defineModel<boolean>('addressWrite', { default: false });

const pipeModeTitle = computed(
  () => PIPE_MODE_ITEMS.find((m) => m.value === props.result?.pipe_mode)?.title ?? '',
);
</script>
