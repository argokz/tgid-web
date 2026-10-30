<template>
  <v-menu
    v-if="live.connected || others.length"
    location="bottom end"
    :close-on-content-click="false"
    max-width="360"
  >
    <template #activator="{ props: menuProps }">
      <HintTip :text="others.length ? `Сейчас на карте: ${others.length}` : 'На карте только вы'">
        <template #default="{ props: tip }">
          <v-btn
            v-bind="mergeProps(menuProps, tip)"
            icon
            variant="text"
            class="header-icon-btn"
            :aria-label="`Кто на карте: ${others.length}`"
          >
            <v-badge
              :model-value="others.length > 0"
              :content="others.length"
              color="success"
              floating
            >
              <v-icon :icon="others.length ? 'mdi-account-multiple' : 'mdi-account-multiple-outline'" />
            </v-badge>
          </v-btn>
        </template>
      </HintTip>
    </template>

    <v-card>
      <v-card-title class="text-subtitle-1 pb-1">
        Сейчас на карте
      </v-card-title>
      <v-card-text class="pt-0">
        <p
          v-if="!others.length"
          class="text-body-2 text-medium-emphasis mb-2"
        >
          Кроме вас никого.
        </p>
        <v-list
          v-else
          density="compact"
          class="py-0"
        >
          <v-list-item
            v-for="p in others"
            :key="p.key"
            class="px-0"
          >
            <template #prepend>
              <v-avatar
                size="28"
                color="primary"
                variant="tonal"
                class="mr-2"
              >
                {{ initials(p.username) }}
              </v-avatar>
            </template>
            <v-list-item-title>{{ p.username }}</v-list-item-title>
            <v-list-item-subtitle
              v-if="p.editing"
              class="lp-sub"
            >
              правит: {{ p.editing.label || `${p.editing.kind} ${p.editing.id}` }}
            </v-list-item-subtitle>
            <template #append>
              <v-btn
                v-if="p.center"
                size="small"
                variant="text"
                icon="mdi-crosshairs-gps"
                :aria-label="`Показать, где смотрит ${p.username}`"
                @click="flyTo(p)"
              />
            </template>
          </v-list-item>
        </v-list>

        <template v-if="recent.length">
          <v-divider class="my-2" />
          <div class="text-caption text-medium-emphasis mb-1">
            Последние правки
          </div>
          <div
            v-for="(c, i) in recent"
            :key="`${c.at}-${c.table}-${c.by}-${i}`"
            class="d-flex align-center ga-1 lp-change"
          >
            <span class="flex-grow-1">{{ changeText(c) }}</span>
            <span class="text-caption text-medium-emphasis">{{ time(c.at) }}</span>
            <v-btn
              v-if="c.bbox"
              size="x-small"
              variant="text"
              icon="mdi-crosshairs-gps"
              aria-label="Показать на карте"
              @click="fit(c)"
            />
          </div>
        </template>
        <div
          v-if="!live.connected"
          class="text-caption text-warning mt-2"
        >
          Нет связи с сервером — переподключаемся…
        </div>
      </v-card-text>
    </v-card>
  </v-menu>
</template>

<script setup lang="ts">
import { computed, mergeProps } from 'vue';
import HintTip from '~/components/HintTip.vue';
import { useLiveStore } from '~/stores/liveStore';
import { useMapStore } from '~/stores/mapStore';
import { changeText, othersOnline, type LiveChange, type LivePresence } from '~/utils/liveStream';

/**
 * Присутствие (фаза 2, п. 11): кто ещё работает с картой города, что правит, где смотрит; последние правки
 * других пользователей и десктопа. Данные — useLiveStore (поток /api/v1/live/stream).
 */
const live = useLiveStore();
const mapStore = useMapStore();
const RECENT = 8;

const others = computed(() => othersOnline(live.presence, live.selfKey));
const recent = computed(() => live.changes.slice(0, RECENT));

const initials = (name: string) => name.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ')
  .map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase() || '?';
const time = (iso: string) => new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

const flyTo = (p: LivePresence) => {
  if (!p.center) return;
  mapStore.map?.flyTo({ center: p.center, zoom: p.zoom ?? mapStore.map.getZoom() });
};

const fit = (c: LiveChange) => {
  if (!c.bbox) return;
  const [x1, y1, x2, y2] = c.bbox;
  mapStore.map?.fitBounds([[x1, y1], [x2, y2]], { padding: 80, maxZoom: 18 });
};
</script>

<style scoped>
.lp-sub { white-space: normal; }
.lp-change { font-size: var(--text-sm, 0.8125rem); }
</style>
