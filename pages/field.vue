<template>
  <v-app class="fld">
    <header class="fld-bar">
      <v-btn
        v-if="selected"
        icon="mdi-arrow-left"
        variant="text"
        aria-label="К списку нарядов"
        @click="closeOrder"
      />
      <v-icon
        v-else
        class="ms-3 me-1"
        aria-hidden="true"
      >
        mdi-account-hard-hat
      </v-icon>
      <div class="fld-bar__title">
        <div class="text-subtitle-1 font-weight-medium">
          {{ selected ? selected.number : 'Наряды бригады' }}
        </div>
        <div
          v-if="authStore.cityLabel"
          class="text-caption text-medium-emphasis"
        >
          {{ authStore.cityLabel }}<span v-if="authStore.username"> · {{ authStore.username }}</span>
        </div>
      </div>
      <v-chip
        v-if="!online"
        size="small"
        color="warning"
        prepend-icon="mdi-cloud-off-outline"
        class="me-1"
      >
        Нет связи
      </v-chip>
      <v-btn
        :icon="queue.length ? undefined : 'mdi-sync'"
        variant="text"
        :loading="syncing"
        :aria-label="queue.length ? `Не отправлено: ${queue.length}. Отправить` : 'Обновить'"
        @click="refreshAll"
      >
        <v-badge
          v-if="queue.length"
          :content="queue.length"
          :color="hasProblems ? 'error' : 'warning'"
        >
          <v-icon>mdi-sync</v-icon>
        </v-badge>
      </v-btn>
      <v-btn
        v-if="authStore.isAuthenticated"
        icon="mdi-logout"
        variant="text"
        aria-label="Выйти"
        @click="logout"
      />
    </header>

    <main class="fld-main">
      <!-- Не отправлено: что ждёт сети и что требует решения бригады -->
      <section
        v-if="queue.length"
        class="fld-queue"
        aria-label="Не отправлено"
      >
        <div class="text-body-2 mb-1">
          <template v-if="hasProblems">
            Не все действия приняты — посмотрите ниже.
          </template>
          <template v-else>
            Ждут отправки: {{ queue.length }}. Уйдут сами, когда появится связь.
          </template>
        </div>
        <div
          v-for="a in queue"
          :key="a.id"
          class="fld-queue__item"
          :class="`fld-queue__item--${a.state}`"
        >
          <div class="flex-grow-1 min-w-0">
            <div class="text-body-2 text-truncate">
              {{ describeAction(a, statusLabel) }}
            </div>
            <div
              v-if="a.error"
              class="text-caption text-error"
            >
              {{ a.error }}
            </div>
          </div>
          <v-btn
            v-if="a.state === 'conflict' && a.kind === 'transition'"
            size="small"
            variant="tonal"
            :disabled="!online"
            @click="retryOnCurrent(a)"
          >
            Ещё раз
          </v-btn>
          <v-btn
            v-if="a.state !== 'pending'"
            icon="mdi-delete-outline"
            size="small"
            variant="text"
            aria-label="Убрать из очереди"
            @click="dropAction(a)"
          />
        </div>
      </section>

      <v-alert
        v-if="notice"
        :type="notice.type"
        variant="tonal"
        density="compact"
        closable
        class="mb-3"
        @click:close="notice = null"
      >
        {{ notice.text }}
      </v-alert>

      <!-- Список -->
      <template v-if="!selected">
        <div class="d-flex align-center ga-2 mb-3">
          <v-select
            v-model="brigadeId"
            :items="brigadeItems"
            item-title="name"
            item-value="id"
            label="Бригада"
            density="comfortable"
            variant="outlined"
            hide-details
            class="flex-grow-1"
          />
        </div>
        <template v-if="canEdit">
          <v-btn
            block
            size="large"
            color="error"
            variant="tonal"
            prepend-icon="mdi-alert-outline"
            class="mb-2"
            @click="openDefect(null)"
          >
            Дефект на обходе
          </v-btn>
          <div class="fld-track mb-3">
            <v-switch
              :model-value="trackOn"
              color="primary"
              density="compact"
              hide-details
              inset
              label="Передавать местоположение"
              @update:model-value="setTrack(Boolean($event))"
            />
            <div class="text-caption text-medium-emphasis">
              <template v-if="trackOn">
                Пока страница открыта и экран включён<span v-if="trackLastAt">
                  · точка {{ timeText(trackLastAt) }}</span>
              </template>
              <template v-else>
                Диспетчер увидит бригаду на карте
              </template>
              <span v-if="trackUnsent"> · не отправлено точек: {{ trackUnsent }}</span>
            </div>
            <div
              v-if="trackError"
              class="text-caption text-warning"
            >
              {{ trackError }}
            </div>
          </div>
        </template>
        <div
          v-if="cachedAt"
          class="text-caption text-medium-emphasis mb-2"
        >
          Без связи — список от {{ cachedAt }}
        </div>
        <v-progress-linear
          v-if="loading && !orders.length"
          indeterminate
          class="mb-3"
        />
        <div
          v-if="!loading && !shownOrders.length"
          class="text-body-2 text-medium-emphasis pa-4 text-center"
        >
          Открытых нарядов нет.
        </div>
        <button
          v-for="o in shownOrders"
          :key="o.id"
          type="button"
          class="fld-card"
          @click="openOrder(o.id)"
        >
          <div class="d-flex align-center ga-2">
            <span class="text-caption text-medium-emphasis">{{ o.number }}</span>
            <v-chip
              size="x-small"
              :color="STATUS_META[o.status]?.color"
              variant="flat"
            >
              {{ statusLabel(o.status) }}
            </v-chip>
            <v-chip
              v-if="o.priority < 3"
              size="x-small"
              :color="PRIORITY_COLORS[o.priority]"
              variant="tonal"
            >
              {{ o.priority_label }}
            </v-chip>
            <v-icon
              v-if="pendingFor(o.id)"
              size="16"
              color="warning"
              class="ms-auto"
              aria-label="Есть неотправленные действия"
            >
              mdi-cloud-off-outline
            </v-icon>
          </div>
          <div class="text-body-1 font-weight-medium mt-1">
            {{ o.title }}
          </div>
          <div class="text-caption text-medium-emphasis">
            {{ placeText(o) }}<span v-if="o.planned_finish"> · до {{ formatDateTime(o.planned_finish) }}</span>
            <span
              v-if="o.overdue"
              class="text-error"
            > · просрочен</span>
          </div>
        </button>
      </template>

      <!-- Карточка наряда -->
      <template v-else>
        <div class="d-flex align-center ga-2 flex-wrap mb-1">
          <v-chip
            size="small"
            :color="STATUS_META[selected.status]?.color"
            variant="flat"
          >
            {{ statusLabel(selected.status) }}
          </v-chip>
          <span class="text-caption text-medium-emphasis">{{ selected.kind_label }} · {{ selected.priority_label }}</span>
          <span
            v-if="selected.arrived_at"
            class="text-caption text-success"
          >· на месте с {{ timeText(selected.arrived_at) }}</span>
        </div>
        <h1 class="text-h6 mb-1">
          {{ selected.title }}
        </h1>
        <div class="text-body-2 text-medium-emphasis mb-2">
          {{ placeText(selected) }}<span v-if="selected.planned_finish"> · срок {{ formatDateTime(selected.planned_finish) }}</span>
        </div>
        <p
          v-if="selected.description"
          class="text-body-2 mb-3 fld-pre"
        >
          {{ selected.description }}
        </p>

        <ClientOnly v-if="selected.lat != null && selected.lon != null">
          <LazyFieldOrderMap
            :key="selected.id"
            :order="selected"
            :network="network"
            :route="shownRoute"
            :online="online"
            class="mb-2"
          />
        </ClientOnly>
        <div
          v-if="selected.lat != null && selected.lon != null"
          class="d-flex ga-2 mb-4 flex-wrap"
        >
          <v-btn
            :href="routeLink(selected.lat, selected.lon, selected.number)"
            prepend-icon="mdi-navigation-variant"
            variant="tonal"
          >
            Маршрут
          </v-btn>
          <v-btn
            :href="mapLink(selected)"
            prepend-icon="mdi-map-marker"
            variant="text"
          >
            На карте сети
          </v-btn>
        </div>

        <!-- Обход по контуру осмотра: узлы по порядку, отметка «осмотрен» или дефект узла -->
        <section
          v-if="shownRoute"
          class="fld-route mb-4"
          aria-label="Обход"
        >
          <div class="d-flex align-center ga-2 mb-1">
            <h2 class="text-subtitle-2 flex-grow-1">
              Обход «{{ shownRoute.inspection.name }}»
            </h2>
            <span class="text-caption">{{ shownRoute.progress.ok + shownRoute.progress.defect }} из {{ shownRoute.progress.total }}</span>
          </div>
          <v-progress-linear
            :model-value="routePercent"
            color="success"
            height="6"
            rounded
            class="mb-1"
          />
          <div class="text-caption text-medium-emphasis mb-2">
            С дефектами: {{ shownRoute.progress.defect }}<template v-if="nextRoutePoint">
              · <a
                :href="routeLink(nextRoutePoint.lat, nextRoutePoint.lon, nextRoutePoint.name)"
                class="text-primary"
              >к следующему: {{ nextRoutePoint.name }}</a>
            </template>
          </div>
          <div
            v-for="p in shownRoute.points"
            :key="p.node_id"
            class="fld-point"
            :class="{ 'fld-point--next': nextRoutePoint?.node_id === p.node_id }"
          >
            <span
              class="fld-point__dot"
              :style="{ background: CHECK_COLORS[p.state ?? 'none'] }"
              aria-hidden="true"
            />
            <div class="flex-grow-1 min-w-0">
              <div class="text-body-2 text-truncate">
                {{ p.name }}
              </div>
              <div class="text-caption text-medium-emphasis">
                {{ p.node_type || 'узел' }}<span v-if="p.state"> · {{ CHECK_LABELS[p.state] }}</span><span
                  v-if="p.pending"
                  class="text-warning"
                > · не отправлено</span>
              </div>
            </div>
            <template v-if="canEdit && routeOpen">
              <v-btn
                v-if="orderForm?.scope === 'point'"
                icon="mdi-form-select"
                size="small"
                :color="formFilledNodes.has(p.node_id) ? 'primary' : undefined"
                :variant="formFilledNodes.has(p.node_id) ? 'flat' : 'tonal'"
                :aria-label="`${p.name}: форма «${orderForm.name}»`"
                @click="openForm(p)"
              />
              <v-btn
                icon="mdi-check"
                size="small"
                color="success"
                :variant="p.state === 'ok' ? 'flat' : 'tonal'"
                :aria-label="`${p.name}: осмотрен`"
                @click="queueCheck(p, 'ok')"
              />
              <v-btn
                icon="mdi-alert-outline"
                size="small"
                color="error"
                :variant="p.state === 'defect' ? 'flat' : 'tonal'"
                :aria-label="`${p.name}: дефект`"
                @click="reportNodeDefect(p)"
              />
            </template>
          </div>
          <div
            v-if="shownRoute.truncated"
            class="text-caption text-warning mt-1"
          >
            Контур большой — показана не вся часть маршрута.
          </div>
        </section>

        <!-- Форма обхода наряда: раз на наряд — кнопка здесь, на каждом узле — у узлов обхода -->
        <section
          v-if="orderForm"
          class="fld-form mb-4"
          aria-label="Форма обхода"
        >
          <div class="d-flex align-center ga-2">
            <v-icon
              icon="mdi-form-select"
              size="small"
            />
            <div class="flex-grow-1 min-w-0">
              <div class="text-subtitle-2 text-truncate">
                {{ orderForm.name }}
              </div>
              <div class="text-caption text-medium-emphasis">
                {{ formStatusText }}
              </div>
            </div>
            <v-btn
              v-if="canEdit && (orderForm.scope === 'order' || (!shownRoute && selected?.node_id))"
              color="primary"
              variant="tonal"
              prepend-icon="mdi-pencil"
              @click="openForm(null)"
            >
              Заполнить
            </v-btn>
          </div>
        </section>

        <!-- Действия бригады: только вперёд по цепочке «Начать» → «Выполнено» -->
        <div
          v-if="canEdit"
          class="mb-4"
        >
          <v-btn
            v-if="selected.next.includes('in_progress') && selected.status !== 'done'"
            block
            size="large"
            color="primary"
            prepend-icon="mdi-play"
            :loading="busy"
            @click="queueTransition('in_progress')"
          >
            Начать работу
          </v-btn>
          <template v-if="selected.status === 'in_progress'">
            <v-textarea
              v-model="resultText"
              label="Что сделано"
              rows="3"
              auto-grow
              variant="outlined"
              hide-details="auto"
              class="mb-2"
            />
            <v-btn
              v-if="shownRoute"
              size="small"
              variant="text"
              prepend-icon="mdi-format-list-checks"
              class="mb-2"
              @click="resultText = routeSummary(shownRoute)"
            >
              Итог обхода
            </v-btn>
            <v-btn
              block
              size="large"
              color="success"
              prepend-icon="mdi-check"
              :disabled="!resultText.trim() && !selected.result"
              :loading="busy"
              @click="queueTransition('done')"
            >
              Выполнено
            </v-btn>
          </template>
          <div
            v-if="selected.status === 'done'"
            class="text-body-2"
          >
            Выполнено{{ selected.result ? `: ${selected.result}` : '' }}. Закроет диспетчер.
          </div>
        </div>
        <v-alert
          v-else
          type="info"
          variant="tonal"
          density="compact"
          class="mb-4"
        >
          Отмечать работу может пользователь с правом «Журналы».
        </v-alert>

        <!-- Фото -->
        <h2 class="text-subtitle-2 mb-2">
          Фото
        </h2>
        <div class="fld-photos mb-2">
          <a
            v-for="p in photoTiles"
            :key="p.key"
            :href="p.url || undefined"
            target="_blank"
            rel="noopener"
            class="fld-photo"
            :class="{ 'fld-photo--pending': p.pending }"
            :title="p.caption"
          >
            <img
              v-if="p.url"
              :src="p.url"
              :alt="p.caption || 'Фото с места работ'"
              loading="lazy"
            >
            <v-icon v-else>mdi-image-outline</v-icon>
          </a>
        </div>
        <div
          v-if="canEdit"
          class="d-flex ga-2 align-center mb-4"
        >
          <v-text-field
            v-model="photoCaption"
            label="Подпись к фото"
            density="compact"
            variant="outlined"
            hide-details
            maxlength="500"
          />
          <v-btn
            prepend-icon="mdi-camera"
            variant="tonal"
            :loading="photoBusy"
            @click="photoInput?.click()"
          >
            Снять
          </v-btn>
          <input
            ref="photoInput"
            type="file"
            accept="image/*"
            capture="environment"
            class="d-none"
            @change="onPhoto"
          >
        </div>

        <!-- Комментарий -->
        <div
          v-if="canEdit"
          class="d-flex ga-2 align-start mb-4"
        >
          <v-textarea
            v-model="commentText"
            label="Комментарий"
            rows="1"
            auto-grow
            variant="outlined"
            density="compact"
            hide-details
            maxlength="2000"
          />
          <v-btn
            icon="mdi-comment-text-outline"
            variant="tonal"
            aria-label="Добавить комментарий"
            :disabled="!commentText.trim()"
            @click="queueComment"
          />
        </div>

        <h2 class="text-subtitle-2 mb-1">
          История
        </h2>
        <div
          v-if="!selected.events"
          class="text-caption text-medium-emphasis"
        >
          Откроется, когда будет связь.
        </div>
        <div
          v-for="(e, i) in [...(selected.events ?? [])].reverse()"
          :key="`${e.at}-${i}`"
          class="fld-event"
        >
          <div class="text-caption text-medium-emphasis">
            {{ formatDateTime(e.at) }} · {{ e.by_user || '—' }}
          </div>
          <div class="text-body-2">
            <b v-if="e.to_label">{{ e.to_label }}. </b>{{ e.note }}
          </div>
        </div>
      </template>
    </main>

    <LazyFieldFormDialog
      v-if="formOpen"
      v-model="formOpen"
      :form="orderForm"
      :subtitle="formSubtitle"
      @save="queueForm"
    />

    <LazyFieldDefectDialog
      v-if="defectOpen"
      v-model="defectOpen"
      :sources="defectLookups.sources"
      :categories="defectLookups.categories"
      :node="defectNode"
      @submit="queueDefect"
    />

    <LazyLoginDialog
      v-if="loginOpen"
      v-model="loginOpen"
      :required="!authStore.authDisabled"
    />
  </v-app>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { fastApiService } from '~/services/fastApiService';
import { ApiError } from '~/services/api/http';
import { useAuthStore } from '~/stores/authStore';
import { useFieldTrack } from '~/composables/useFieldTrack';
import { appStorage } from '~/utils/appStorage';
import { defectAction, defectRefs, type DefectRef, type FieldDefectDraft, type RouteNodeRef } from '~/utils/fieldDefect';
import {
  CHECK_COLORS,
  CHECK_LABELS,
  applyPendingChecks,
  nextPoint,
  routeSummary,
  type RouteCheckState,
  type RoutePoint,
  type WorkOrderRoute,
} from '~/utils/fieldRoute';
import { currentPosition, downscalePhoto, routeLink } from '~/utils/fieldPhoto';
import {
  applyPending,
  describeAction,
  flushQueue,
  newActionId,
  type FieldAction,
} from '~/utils/fieldQueue';
import { isFresh, networkSpec, resultToFeatures, type FieldNetwork } from '~/utils/fieldNetwork';
import { fieldStore } from '~/utils/fieldStore';
import type { FormRow } from '~/utils/forms';
import type { FieldFormResult } from '~/components/FieldFormDialog.vue';
import { getMaplibreDefault } from '~/utils/maplibreLoader';
import { formatPermalinkHash } from '~/utils/mapPermalink';
import {
  PRIORITY_COLORS,
  STATUS_META,
  formatDateTime,
  placeText,
  type WorkOrder,
  type WorkOrderLookups,
  type WorkOrderStatus,
} from '~/utils/workOrders';

definePageMeta({ layout: false });
useHead({
  title: 'Наряды бригады — ITwin Map',
  // «На главный экран» открывает сразу страницу бригады (ключ — тот же, что у manifest в app.vue)
  link: [{ key: 'manifest', rel: 'manifest', href: `${String(useRuntimeConfig().app.baseURL || '/').replace(/\/?$/, '/')}field.webmanifest` }],
});

/** Пока есть неотправленное — пробовать раз в 30 с (событие online приходит не всегда) */
const SYNC_INTERVAL_MS = 30_000;
const BRIGADE_KEY = 'field:brigade';
const LOOKUPS_KEY = 'field:lookups';
const SAVED_AT_KEY = 'field:savedAt';
const CAN_EDIT_KEY = 'field:canEdit';
const DEFECT_LOOKUPS_KEY = 'field:defectLookups';
/** Действующие формы обходов — на телефоне, чтобы заполнять без связи */
const FORMS_KEY = 'field:forms';
const ALL = 0;
const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

const authStore = useAuthStore();
const config = useRuntimeConfig();

const online = ref(true);
const loading = ref(false);
const syncing = ref(false);
const busy = ref(false);
const photoBusy = ref(false);
const loginOpen = ref(false);
const defectOpen = ref(false);
const formOpen = ref(false);
const formPoint = ref<RoutePoint | null>(null);
const fieldForms = ref<FormRow[]>([]);
/** Узлы наряда, по которым форма уже отправлена (с сервера) */
const formSentNodes = ref<Set<number>>(new Set());
const formSentCount = ref(0);
/** дефект с узла маршрута обхода (null — дефект просто на обходе) */
const defectNode = ref<RouteNodeRef | null>(null);
const notice = ref<{ type: 'success' | 'info' | 'warning' | 'error'; text: string } | null>(null);
const cachedAt = ref('');

const lookups = ref<WorkOrderLookups | null>(null);
/** справочники журнала дефектов для «Дефект на обходе» (сохранённые — на случай без связи) */
const defectLookups = ref<{ sources: DefectRef[]; categories: DefectRef[] }>({ sources: [], categories: [] });
const orders = ref<WorkOrder[]>([]);
const queue = ref<FieldAction[]>([]);
const brigadeId = ref<number>(ALL);
const selectedId = ref<number | null>(null);
const resultText = ref('');
const commentText = ref('');
const photoCaption = ref('');
const photoInput = ref<HTMLInputElement | null>(null);
/** сеть вокруг открытого наряда (карта места работ) */
const network = ref<FieldNetwork | null>(null);
let prefetching = false;
/** id фото → object URL (фото отдаются с токеном, поэтому через blob) */
const photoUrls = ref<Record<number, string>>({});
const pendingUrls = new Map<string, string>();

/**
 * Право отмечать работу считается по настройкам сервера (/auth/config), а без связи их нет — тогда последнее
 * известное право (сервер всё равно проверит его при отправке очереди)
 */
const savedCanEdit = ref(false);
const canEdit = computed(() => (authStore.configLoaded ? authStore.canEditData : savedCanEdit.value));
watch(() => [authStore.configLoaded, authStore.canEditData], () => {
  if (!authStore.configLoaded) return;
  savedCanEdit.value = authStore.canEditData;
  appStorage.setItem(CAN_EDIT_KEY, authStore.canEditData ? '1' : '0');
});
const brigadeItems = computed(() => [{ id: ALL, name: 'Все бригады' }, ...(lookups.value?.brigades ?? [])]);
const transitions = computed(() => lookups.value?.transitions ?? ({} as Record<WorkOrderStatus, WorkOrderStatus[]>));
const hasProblems = computed(() => queue.value.some((a) => a.state !== 'pending'));

const statusLabel = (s: WorkOrderStatus): string =>
  lookups.value?.statuses.find((x) => x.value === s)?.label ?? s;

const shownOrders = computed(() =>
  orders.value
    .map((o) => applyPending(o, queue.value, transitions.value))
    .sort((a, b) => a.priority - b.priority || (a.planned_finish ?? '9').localeCompare(b.planned_finish ?? '9')),
);
const selected = computed(() => shownOrders.value.find((o) => o.id === selectedId.value) ?? null);
/** Форма наряда — из сохранённых на телефоне; выключили или ещё не загрузили — раздела нет */
const orderForm = computed(() => {
  const id = selected.value?.form_id;
  return id ? fieldForms.value.find((f) => f.id === id) ?? null : null;
});
const pendingForms = computed(() => queue.value.filter((a) => a.kind === 'form' && a.orderId === selectedId.value));
/** Узлы с заполненной формой: отправленные и ждущие отправки */
const formFilledNodes = computed(() => new Set([...formSentNodes.value,
  ...pendingForms.value.map((a) => a.nodeId).filter((n): n is number => n != null)]));
const formStatusText = computed(() => {
  const f = orderForm.value;
  if (!f) return '';
  const waiting = pendingForms.value.length ? ` · ждёт отправки: ${pendingForms.value.length}` : '';
  if (f.scope === 'point' && shownRoute.value) return `Заполняется на узлах обхода: ${formFilledNodes.value.size}${waiting}`;
  return `${formSentCount.value ? `Заполнена: ${formSentCount.value}` : 'Ещё не заполнена'}${waiting}`;
});
const formSubtitle = computed(() => [selected.value?.number, formPoint.value?.name].filter(Boolean).join(' · '));
const pendingFor = (orderId: number) => queue.value.some((a) => a.orderId === orderId);

/** Маршрут обхода открытого наряда с отметками, ещё не отправленными */
const shownRoute = computed<WorkOrderRoute | null>(() => {
  const route = network.value?.orderId === selectedId.value ? network.value?.route : null;
  return route ? applyPendingChecks(route, queue.value) : null;
});
const nextRoutePoint = computed(() => (shownRoute.value ? nextPoint(shownRoute.value) : null));
const routePercent = computed(() => {
  const p = shownRoute.value?.progress;
  return p?.total ? Math.round(((p.ok + p.defect) / p.total) * 100) : 0;
});
const routeOpen = computed(() => Boolean(selected.value && !['closed', 'cancelled'].includes(selected.value.status)));

const photoTiles = computed(() => {
  const o = selected.value;
  if (!o) return [];
  const saved = (o.photos ?? []).map((p) => ({
    key: `s${p.id}`, url: photoUrls.value[p.id] ?? '', caption: p.caption, pending: false,
  }));
  const waiting = queue.value
    .filter((a) => a.orderId === o.id && a.kind === 'photo' && a.photo)
    .map((a) => ({ key: a.id, url: pendingUrl(a), caption: a.caption ?? '', pending: true }));
  return [...saved, ...waiting];
});

function pendingUrl(a: FieldAction): string {
  let url = pendingUrls.get(a.id);
  if (!url && a.photo) {
    url = URL.createObjectURL(a.photo);
    pendingUrls.set(a.id, url);
  }
  return url ?? '';
}

function mapLink(o: WorkOrder): string {
  const base = String(config.app.baseURL || '/').replace(/\/?$/, '/');
  return `${base}${formatPermalinkHash({ view: { center: [o.lon as number, o.lat as number], zoom: 18, bearing: 0, pitch: 0 } })}`;
}

function errorInfo(error: unknown): { status: number; message: string } {
  if (error instanceof ApiError) return { status: error.status, message: error.userMessage };
  return { status: 0, message: error instanceof Error ? error.message : 'Нет связи' };
}

const cacheKey = () => `orders:${brigadeId.value || 'all'}`;
const signedIn = () => authStore.isAuthenticated || authStore.authDisabled;

const {
  enabled: trackOn, unsent: trackUnsent, lastAt: trackLastAt, error: trackError,
  setEnabled: setTrack, flush: flushTrack, forget: forgetTrack,
} = useFieldTrack({ brigadeId: computed(() => brigadeId.value || null), online, canSend: signedIn, errorInfo });

const timeText = (iso: string): string =>
  new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

async function loadOrders(): Promise<void> {
  // сервер ответил, что нужен вход, — сначала вход; сервер недоступен (настройки не пришли) — показать сохранённое
  if (!signedIn() && authStore.configLoaded) return;
  loading.value = true;
  // сохранённое — сразу: без связи запрос с повторами отвечает отказом через несколько секунд
  if (!orders.value.length) orders.value = (await fieldStore.loadOrders(cacheKey())) ?? [];
  try {
    // справочники — каждый раз при связи (бригады правят), сохранённые — только на случай без сети
    lookups.value = await fastApiService.getWorkOrderLookups();
    appStorage.setItem(LOOKUPS_KEY, JSON.stringify(lookups.value));
    void loadDefectLookups();
    void loadForms();
    if (brigadeId.value !== ALL && !lookups.value.brigades.some((b) => b.id === brigadeId.value)) {
      brigadeId.value = ALL; // бригаду удалили — список заново загрузит наблюдатель
      return;
    }
    const list = await fastApiService.getWorkOrders({ open_only: true, brigade_id: brigadeId.value || null });
    // карточки, открытые раньше (с историей и фото), не теряем — список отдаёт наряды без них
    const known = new Map(orders.value.map((o) => [o.id, o]));
    orders.value = list.items.map((o) => ({ ...known.get(o.id), ...o }));
    cachedAt.value = '';
    await saveCache();
    void prefetchForOffline(orders.value.filter((o) => o.lon != null && o.lat != null));
  } catch (error) {
    const { status, message } = errorInfo(error);
    if (status === 401) {
      loginOpen.value = true;
      return;
    }
    const cached = await fieldStore.loadOrders(cacheKey());
    if (cached) {
      orders.value = cached;
      cachedAt.value = formatDateTime(appStorage.getItem(SAVED_AT_KEY));
    } else {
      notice.value = { type: 'error', text: `Список не загрузился: ${message}` };
    }
  } finally {
    loading.value = false;
  }
}

/** Действующие формы обходов: при связи — с сервера, без связи — сохранённые */
async function loadForms(): Promise<void> {
  try {
    fieldForms.value = await fastApiService.getForms(true);
    appStorage.setItem(FORMS_KEY, JSON.stringify(fieldForms.value));
  } catch {
    // без связи — сохранённые с прошлого раза
  }
}

/** Что по форме наряда уже дошло до сервера (узлы обхода, число заполнений) */
async function loadFormStatus(order: WorkOrder): Promise<void> {
  formSentNodes.value = new Set();
  formSentCount.value = 0;
  if (!order.form_id) return;
  try {
    const sent = await fastApiService.getWorkOrderForms(order.id);
    formSentCount.value = sent.length;
    formSentNodes.value = new Set(sent.map((s) => s.node_id).filter((n): n is number => n != null));
  } catch {
    // без связи — видны только ждущие отправки
  }
}

function openForm(point: RoutePoint | null): void {
  formPoint.value = point;
  formOpen.value = true;
}

/** Форма — в очередь: сначала её фото (как фото наряда, с ключами из ответа), затем сами ответы */
async function queueForm(result: FieldFormResult): Promise<void> {
  const o = selected.value;
  const f = orderForm.value;
  if (!o || !f) return;
  const point = formPoint.value;
  try {
    const pos = await currentPosition();
    const base = { orderId: o.id, orderNumber: o.number, createdAt: new Date().toISOString(),
      lon: pos?.lon ?? null, lat: pos?.lat ?? null, state: 'pending' as const };
    for (const p of result.photos) {
      await fieldStore.putAction({ ...base, id: p.id, kind: 'photo', photo: p.blob, caption: p.caption, takenAt: p.takenAt });
    }
    await fieldStore.putAction({
      ...base, id: newActionId(), kind: 'form', formId: f.id, formVersion: f.current_version, formName: f.name,
      answers: result.answers,
      // форма «на каждом узле» в наряде без маршрута обхода — по узлу самого наряда
      nodeId: point?.node_id ?? (f.scope === 'point' ? o.node_id ?? undefined : undefined), nodeName: point?.name,
    });
    await reloadQueue();
    await sync();
    notice.value = { type: 'success', text: `Форма «${f.name}» сохранена${online.value ? '' : ' — уйдёт, когда появится связь'}` };
  } catch (error) {
    notice.value = { type: 'error', text: `Форма не сохранилась: ${errorInfo(error).message}` };
  }
}

/** Справочники для «Дефект на обходе»; не пришли — окно работает без них (источник и категория пустые) */
async function loadDefectLookups(): Promise<void> {
  try {
    const res = await fastApiService.getDefectLookups();
    defectLookups.value = { sources: defectRefs(res.sources), categories: defectRefs(res.categories) };
    appStorage.setItem(DEFECT_LOOKUPS_KEY, JSON.stringify(defectLookups.value));
  } catch {
    // без связи — сохранённые с прошлого раза
  }
}

/** Список — на телефон, чтобы открыть без связи; не вышло — работать можно, но предупредить */
async function saveCache(): Promise<void> {
  try {
    await fieldStore.saveOrders(cacheKey(), orders.value);
    appStorage.setItem(SAVED_AT_KEY, new Date().toISOString());
  } catch (error) {
    notice.value = { type: 'warning', text: `Список не сохранился на телефоне: ${errorInfo(error).message}` };
  }
}

function mergeOrder(order: WorkOrder): void {
  const i = orders.value.findIndex((o) => o.id === order.id);
  if (i >= 0) orders.value.splice(i, 1, order);
  else orders.value.push(order);
  void saveCache();
}

async function openOrder(id: number): Promise<void> {
  selectedId.value = id;
  resultText.value = '';
  commentText.value = '';
  photoCaption.value = '';
  window.scrollTo({ top: 0 });
  network.value = await fieldStore.loadNetwork(id);
  try {
    mergeOrder(await fastApiService.getWorkOrder(id));
  } catch {
    // без связи — карточка из сохранённого списка
  }
  void loadPhotos();
  const o = orders.value.find((x) => x.id === id);
  if (o) void loadFormStatus(o);
  if (o && !isFresh(network.value)) {
    const fresh = await fetchNetwork(o);
    if (fresh && selectedId.value === id) network.value = fresh;
  } else if (o?.inspection_id) {
    await refreshRoute(o.id);
  }
}

/** Маршрут обхода с сервера — в сохранённую сеть наряда; нет связи — остаётся сохранённый */
async function refreshRoute(orderId: number): Promise<void> {
  if (!online.value) return;
  try {
    await saveRoute(await fastApiService.getWorkOrderRoute(orderId));
  } catch {
    // без связи или сервер занят — отметки покажет сохранённый маршрут и очередь
  }
}

async function saveRoute(route: WorkOrderRoute): Promise<void> {
  const net = (network.value?.orderId === route.order_id ? network.value : null)
    ?? await fieldStore.loadNetwork(route.order_id)
    ?? { orderId: route.order_id, savedAt: new Date().toISOString(), lines: EMPTY_FC, nodes: EMPTY_FC, truncated: false };
  const next = { ...net, route };
  await fieldStore.saveNetwork(next);
  if (selectedId.value === route.order_id) network.value = next;
}

/** Сеть вокруг наряда — с сервера на телефон; не вышло (нет связи, сервер занят) — остаётся сохранённая */
async function fetchNetwork(o: WorkOrder): Promise<FieldNetwork | null> {
  if (o.lon == null || o.lat == null || !online.value) return null;
  try {
    const lines = await fastApiService.runNetworkSelect(networkSpec(o, 'lines'));
    const nodes = await fastApiService.runNetworkSelect(networkSpec(o, 'nodes'));
    const route = o.inspection_id ? await fastApiService.getWorkOrderRoute(o.id) : null;
    const net: FieldNetwork = {
      orderId: o.id,
      savedAt: new Date().toISOString(),
      lines: resultToFeatures(lines),
      nodes: resultToFeatures(nodes),
      route,
      truncated: lines.truncated || nodes.truncated,
    };
    await fieldStore.saveNetwork(net);
    return net;
  } catch {
    return null;
  }
}

/**
 * После загрузки списка: сеть вокруг каждого открытого наряда — на телефон (по одному: у выборок лимит на
 * пользователя), сеть закрытых — долой; заодно — карта (maplibre), чтобы service worker сохранил её файлы.
 */
async function prefetchForOffline(list: WorkOrder[]): Promise<void> {
  if (prefetching) return;
  prefetching = true;
  try {
    void getMaplibreDefault().then(() => import('maplibre-gl/dist/maplibre-gl.css')).catch(() => undefined);
    // окна дефекта и формы грузятся при первом открытии — без связи оно бы не удалось: файлы — в кеш сейчас
    void import('~/components/FieldDefectDialog.vue').catch(() => undefined);
    void import('~/components/FieldFormDialog.vue').catch(() => undefined);
    for (const o of list) {
      if (!online.value) break;
      if (!isFresh(await fieldStore.loadNetwork(o.id))) await fetchNetwork(o);
    }
    await fieldStore.pruneNetwork(list.map((o) => o.id));
  } finally {
    prefetching = false;
  }
}

/** Страница открывается без связи: service worker хранит её и файлы приложения (public/field-sw.js) */
function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  const base = String(config.app.baseURL || '/').replace(/\/?$/, '/');
  navigator.serviceWorker.register(`${base}field-sw.js`, { scope: base }).catch((error: unknown) => {
    notice.value = { type: 'warning', text: `Работа без связи недоступна: ${errorInfo(error).message}` };
  });
  // при первом открытии файлы страницы загрузились раньше service worker — передать ему их список
  void navigator.serviceWorker.ready.then((reg) => {
    const urls = performance.getEntriesByType('resource').map((e) => e.name).filter((u) => u.includes('/_nuxt/'));
    reg.active?.postMessage({ type: 'cache-urls', urls });
  });
}

function closeOrder(): void {
  selectedId.value = null;
}

async function loadPhotos(): Promise<void> {
  for (const p of selected.value?.photos ?? []) {
    if (photoUrls.value[p.id]) continue;
    try {
      const blob = await fastApiService.getWorkOrderPhoto(p.id);
      photoUrls.value = { ...photoUrls.value, [p.id]: URL.createObjectURL(blob) };
    } catch {
      return; // нет связи — плитки без картинки, догрузятся при следующем открытии
    }
  }
}

async function reloadQueue(): Promise<void> {
  queue.value = await fieldStore.listActions();
}

async function enqueue(partial: Omit<FieldAction, 'id' | 'createdAt' | 'lon' | 'lat' | 'state'>): Promise<void> {
  // время — в момент нажатия: замер GPS идёт до 8 с, следующее действие не должно его обогнать
  const createdAt = new Date().toISOString();
  const pos = await currentPosition();
  const action: FieldAction = {
    ...partial,
    id: newActionId(),
    createdAt,
    lon: pos?.lon ?? null,
    lat: pos?.lat ?? null,
    state: 'pending',
  };
  await fieldStore.putAction(action);
  await reloadQueue();
  void sync();
}

async function queueTransition(to: WorkOrderStatus): Promise<void> {
  const o = selected.value;
  if (!o || busy.value) return;
  busy.value = true;
  try {
    await enqueue({
      orderId: o.id, orderNumber: o.number, kind: 'transition', to, revision: o.revision,
      result: to === 'done' ? (resultText.value.trim() || o.result) : undefined,
    });
    resultText.value = '';
  } finally {
    busy.value = false;
  }
}

async function queueComment(): Promise<void> {
  const o = selected.value;
  const note = commentText.value.trim();
  if (!o || !note) return;
  commentText.value = '';
  await enqueue({ orderId: o.id, orderNumber: o.number, kind: 'comment', note });
}

function openDefect(node: RouteNodeRef | null): void {
  defectNode.value = node;
  defectOpen.value = true;
}

function reportNodeDefect(p: RoutePoint): void {
  if (selected.value) openDefect({ orderId: selected.value.id, nodeId: p.node_id, name: p.name });
}

/** Отметка узла обхода — в очередь; карточка показывает её сразу (applyPendingChecks) */
async function queueCheck(p: RoutePoint, state: RouteCheckState): Promise<void> {
  const o = selected.value;
  if (!o) return;
  await enqueue({ orderId: o.id, orderNumber: o.number, kind: 'check', nodeId: p.node_id, nodeName: p.name, checkState: state });
}

/** Дефект с обхода — в очередь; место — из окна (уже замерено), заявку по нему создаст сервер */
async function queueDefect(draft: FieldDefectDraft): Promise<void> {
  try {
    const action = defectAction(draft, { id: newActionId(), photoId: newActionId() }, new Date().toISOString());
    await fieldStore.putAction(action);
    await reloadQueue();
    await sync();
    // сервер недоступен (а браузер считает, что сеть есть) — сказать, что дефект не потерялся
    if (queue.value.some((a) => a.id === action.id && a.state === 'pending')) {
      notice.value = { type: 'info', text: 'Дефект записан на телефоне — уйдёт, когда появится связь.' };
    }
  } catch (error) {
    notice.value = { type: 'error', text: `Дефект не сохранился: ${errorInfo(error).message}` };
  }
}

async function onPhoto(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  const o = selected.value;
  if (!file || !o) return;
  photoBusy.value = true;
  try {
    const photo = await downscalePhoto(file);
    await enqueue({
      orderId: o.id, orderNumber: o.number, kind: 'photo', photo,
      caption: photoCaption.value.trim(), takenAt: new Date(file.lastModified || Date.now()).toISOString(),
    });
    photoCaption.value = '';
  } catch (error) {
    notice.value = { type: 'error', text: errorInfo(error).message };
  } finally {
    photoBusy.value = false;
  }
}

async function send(a: FieldAction): Promise<WorkOrder | null> {
  const stamp = { client_id: a.id, lon: a.lon, lat: a.lat };
  if (a.kind === 'form') {
    // повтор после обрыва: сервер узнаёт заполнение по ключу и второй раз не записывает
    await fastApiService.submitForm({
      form_id: a.formId as number, version: a.formVersion as number, work_order_id: a.orderId,
      node_id: a.nodeId ?? null, answers: a.answers ?? {}, filled_at: a.createdAt, ...stamp,
    });
    if (a.orderId === selectedId.value && selected.value) void loadFormStatus(selected.value);
    return null;
  }
  if (a.kind === 'check') {
    await saveRoute(await fastApiService.checkRoutePoint(a.orderId, {
      node_id: a.nodeId as number, state: a.checkState ?? 'ok', ...stamp,
    }));
    return null;
  }
  if (a.kind === 'defect') {
    // повтор после обрыва: сервер узнаёт дефект и фото по их ключам и вернёт ту же заявку
    const order = await fastApiService.reportFieldDefect({
      lon: a.lon as number, lat: a.lat as number, description: a.description ?? '', source_id: a.sourceId ?? null,
      category_id: a.categoryId ?? null, priority: a.priority ?? 2, found_at: a.createdAt, client_id: a.id,
      order_id: a.routeOrderId ?? null, node_id: a.nodeId ?? null,
    });
    if (!a.photo) return order;
    return fastApiService.addWorkOrderPhoto(order.id, a.photo, {
      caption: a.caption, takenAt: a.takenAt, client_id: a.photoId, lon: a.lon, lat: a.lat,
    });
  }
  if (a.kind === 'transition') {
    return fastApiService.transitionWorkOrder(a.orderId, {
      to: a.to as WorkOrderStatus, revision: a.revision as number, note: a.note ?? '', result: a.result ?? null, ...stamp,
    });
  }
  if (a.kind === 'comment') return fastApiService.commentWorkOrder(a.orderId, a.note ?? '', stamp);
  return fastApiService.addWorkOrderPhoto(a.orderId, a.photo as Blob, { caption: a.caption, takenAt: a.takenAt, ...stamp });
}

async function sync(): Promise<void> {
  if (syncing.value || !online.value) return;
  // страница открылась без связи — настроек входа нет; связь вернулась — сначала они
  if (!signedIn() && !authStore.configLoaded) await authStore.loadConfig();
  if (!signedIn()) return;
  syncing.value = true;
  try {
    const result = await flushQueue(queue.value, send, errorInfo);
    for (const id of result.sent) {
      await fieldStore.deleteAction(id);
      const url = pendingUrls.get(id);
      if (url) URL.revokeObjectURL(url);
      pendingUrls.delete(id);
    }
    for (const m of result.marked) {
      const a = queue.value.find((x) => x.id === m.id);
      if (a) await fieldStore.putAction({ ...a, state: m.state, error: m.error });
    }
    result.orders.forEach((o) => mergeOrder(o));
    if (result.stopped === 'auth') loginOpen.value = true;
    if (result.sent.length && !result.stopped) notice.value = { type: 'success', text: `Отправлено: ${result.sent.length}` };
    void flushTrack();
  } finally {
    await reloadQueue();
    syncing.value = false;
  }
  if (selected.value) void loadPhotos();
  // дефект с узла обхода отмечает узел на сервере — маршрут заново
  if (selected.value?.inspection_id) void refreshRoute(selected.value.id);
}

/** Конфликт перехода: наряд изменил диспетчер — повторить по его текущей версии, если переход ещё возможен */
async function retryOnCurrent(a: FieldAction): Promise<void> {
  try {
    const fresh = await fastApiService.getWorkOrder(a.orderId);
    mergeOrder(fresh);
    if (!a.to || !fresh.next.includes(a.to)) {
      notice.value = { type: 'warning', text: `Наряд уже «${fresh.status_label}» — этот переход больше не нужен, уберите его.` };
      return;
    }
    await fieldStore.putAction({ ...a, revision: fresh.revision, state: 'pending', error: undefined });
    await reloadQueue();
    await sync();
  } catch (error) {
    notice.value = { type: 'error', text: errorInfo(error).message };
  }
}

async function dropAction(a: FieldAction): Promise<void> {
  await fieldStore.deleteAction(a.id);
  await reloadQueue();
}

async function refreshAll(): Promise<void> {
  await sync();
  await loadOrders();
  if (selectedId.value) await openOrder(selectedId.value);
}

async function logout(): Promise<void> {
  // неотправленное уйдёт от того, кто войдёт следующим, — предупредить
  if (queue.value.length
    && !window.confirm(`Не отправлено: ${queue.value.length}. Это уйдёт от имени того, кто войдёт следующим. Выйти?`)) {
    return;
  }
  await forgetTrack();
  authStore.logout();
  appStorage.removeItem(CAN_EDIT_KEY);
  savedCanEdit.value = false;
  await fieldStore.clearOrders();
  orders.value = [];
  selectedId.value = null;
  loginOpen.value = !authStore.authDisabled;
}

const setOnline = () => {
  online.value = navigator.onLine;
  if (online.value) void refreshAll();
};
const onVisible = () => {
  if (document.visibilityState === 'visible' && queue.value.length) void sync();
};
let timer: ReturnType<typeof setInterval> | null = null;

watch(brigadeId, (id) => {
  appStorage.setItem(BRIGADE_KEY, String(id));
  void loadOrders();
});

// вход выполнен (или сессия восстановлена) — данные и отправка накопленного
watch(() => authStore.isAuthenticated || authStore.authDisabled, (ok) => {
  if (!ok) return;
  loginOpen.value = false;
  void loadOrders();
  void sync();
});

watch(() => authStore.configSettled, (settled) => {
  // настройки не пришли (нет связи) — форму входа не показывать: работаем с сохранённым
  if (settled && authStore.configLoaded && !signedIn()) loginOpen.value = true;
});

onMounted(async () => {
  online.value = navigator.onLine;
  try {
    const raw = appStorage.getItem(LOOKUPS_KEY);
    if (raw) lookups.value = JSON.parse(raw) as WorkOrderLookups;
  } catch {
    appStorage.removeItem(LOOKUPS_KEY);
  }
  savedCanEdit.value = appStorage.getItem(CAN_EDIT_KEY) === '1';
  try {
    const raw = appStorage.getItem(DEFECT_LOOKUPS_KEY);
    if (raw) defectLookups.value = JSON.parse(raw) as typeof defectLookups.value;
  } catch {
    appStorage.removeItem(DEFECT_LOOKUPS_KEY);
  }
  try {
    const raw = appStorage.getItem(FORMS_KEY);
    if (raw) fieldForms.value = JSON.parse(raw) as FormRow[];
  } catch {
    appStorage.removeItem(FORMS_KEY);
  }
  const saved = Number(appStorage.getItem(BRIGADE_KEY));
  if (Number.isInteger(saved) && saved > 0) brigadeId.value = saved;
  // пришли из приложения — сессия уже в сторе, наблюдатель входа не сработает
  const wasSignedIn = signedIn();
  authStore.hydrate();
  registerServiceWorker();
  await reloadQueue();
  // без связи — сохранённый список; 401 — форма входа (loadOrders)
  void loadOrders();
  if (wasSignedIn) void sync();
  if (!(await fieldStore.persistent())) {
    notice.value = { type: 'warning', text: 'Браузер не даёт хранилище: неотправленное пропадёт при закрытии вкладки.' };
  }
  window.addEventListener('online', setOnline);
  window.addEventListener('offline', setOnline);
  document.addEventListener('visibilitychange', onVisible);
  timer = setInterval(() => {
    if (queue.value.some((a) => a.state === 'pending')) void sync();
  }, SYNC_INTERVAL_MS);
});

onBeforeUnmount(() => {
  window.removeEventListener('online', setOnline);
  window.removeEventListener('offline', setOnline);
  document.removeEventListener('visibilitychange', onVisible);
  if (timer) clearInterval(timer);
  Object.values(photoUrls.value).forEach((u) => URL.revokeObjectURL(u));
  pendingUrls.forEach((u) => URL.revokeObjectURL(u));
});
</script>

<style scoped>
.fld {
  min-height: 100svh;
  background: rgb(var(--v-theme-background));
}
.fld-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 56px;
  padding: 0 4px;
  padding-top: env(safe-area-inset-top);
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}
.fld-bar__title {
  flex: 1;
  min-width: 0;
  line-height: 1.2;
}
.fld-main {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 12px 16px calc(24px + env(safe-area-inset-bottom));
}
.fld-card {
  display: block;
  width: 100%;
  text-align: left;
  padding: 12px 14px;
  margin-bottom: 8px;
  border-radius: 12px;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  color: inherit;
}
.fld-card:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}
.fld-queue {
  padding: 10px 12px;
  margin-bottom: 12px;
  border-radius: 12px;
  background: rgba(var(--v-theme-warning), 0.10);
}
.fld-queue__item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.fld-queue__item--conflict,
.fld-queue__item--failed {
  color: rgb(var(--v-theme-error));
}
.fld-photos {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
  gap: 6px;
}
.fld-photo {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 8px;
  background: rgba(var(--v-theme-on-surface), 0.06);
}
.fld-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.fld-photo--pending {
  outline: 2px dashed rgb(var(--v-theme-warning));
  outline-offset: -2px;
}
.fld-event {
  padding: 6px 0;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.fld-pre {
  white-space: pre-wrap;
}
.fld-route {
  padding: 10px 12px;
  border-radius: 12px;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.fld-point {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.fld-point--next {
  background: rgba(var(--v-theme-primary), 0.06);
}
.fld-point__dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}
.fld-track {
  padding: 4px 12px 8px;
  border-radius: 12px;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.min-w-0 {
  min-width: 0;
}
</style>
