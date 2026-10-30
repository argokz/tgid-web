<template>
  <v-dialog
    v-model="visible"
    :max-width="980"
    :fullscreen="isMobile"
    scrollable
  >
    <v-card>
      <v-card-title class="d-flex align-center py-3 px-4">
        <v-icon
          class="mr-2"
          color="primary"
        >
          mdi-comment-text-outline
        </v-icon>
        <span class="text-h6 flex-grow-1">Комментарии на карте</span>
        <v-btn
          color="primary"
          variant="tonal"
          prepend-icon="mdi-plus"
          class="mr-2"
          @click="startPick"
        >
          Новый
        </v-btn>
        <HintTip text="Закрыть">
          <template #default="{ props: tip }">
            <v-btn
              v-bind="tip"
              icon="mdi-close"
              variant="text"
              size="small"
              aria-label="Закрыть"
              @click="visible = false"
            />
          </template>
        </HintTip>
      </v-card-title>
      <v-divider />

      <v-card-text class="pa-4">
        <v-alert
          v-if="errorMessage"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-3"
          closable
          @click:close="errorMessage = ''"
        >
          {{ errorMessage }}
        </v-alert>

        <!-- новая ветка: точка уже выбрана на карте -->
        <div
          v-if="draft"
          class="mc-compose mb-3"
        >
          <div class="text-subtitle-2 mb-1">
            Новый комментарий
          </div>
          <div class="text-caption text-medium-emphasis mb-2">
            Точка {{ draft.lat.toFixed(5) }}, {{ draft.lon.toFixed(5) }} · ссылка на ветку откроет карту здесь
          </div>
          <v-textarea
            ref="draftInput"
            v-model="draft.body"
            label="Что обсудить"
            placeholder="Например: здесь парит, @логин проверьте камеру"
            rows="3"
            auto-grow
            variant="outlined"
            :maxlength="MAX_BODY"
            hide-details="auto"
            class="mb-2"
            @keydown.ctrl.enter="createThread"
          />
          <div class="d-flex align-center ga-2">
            <MentionMenu
              :people="people"
              @pick="(login: string) => draft && (draft.body = addMention(draft.body, login))"
            />
            <v-spacer />
            <v-btn
              variant="text"
              @click="draft = null"
            >
              Отмена
            </v-btn>
            <v-btn
              color="primary"
              variant="flat"
              :loading="saving"
              :disabled="!draft.body.trim()"
              @click="createThread"
            >
              Опубликовать
            </v-btn>
          </div>
        </div>

        <div class="d-flex flex-wrap align-center ga-2 mb-3">
          <v-btn-toggle
            v-model="status"
            mandatory
            divided
            density="compact"
            variant="outlined"
          >
            <v-btn value="open">
              Открытые · {{ list?.counts.open ?? 0 }}
            </v-btn>
            <v-btn value="resolved">
              Решённые · {{ list?.counts.resolved ?? 0 }}
            </v-btn>
            <v-btn value="all">
              Все
            </v-btn>
          </v-btn-toggle>
          <v-chip
            :variant="scope === 'mine' ? 'flat' : 'outlined'"
            :color="scope === 'mine' ? 'primary' : undefined"
            @click="scope = scope === 'mine' ? 'all' : 'mine'"
          >
            Мне
            <v-badge
              v-if="(list?.unread ?? 0) > 0"
              :content="list?.unread"
              color="deep-orange"
              inline
            />
          </v-chip>
          <v-text-field
            v-model="search"
            prepend-inner-icon="mdi-magnify"
            placeholder="Поиск по тексту"
            density="compact"
            variant="outlined"
            hide-details
            clearable
            class="mc-search"
          />
          <v-switch
            :model-value="commentPinsEnabled"
            label="Точки на карте"
            color="primary"
            density="compact"
            hide-details
            inset
            @update:model-value="setCommentPins(Boolean($event))"
          />
        </div>

        <div class="mc-body">
          <div
            v-if="!isMobile || !current"
            class="mc-list"
          >
            <v-progress-linear
              v-if="loading"
              indeterminate
              class="mb-2"
            />
            <div
              v-if="!loading && !list?.items.length"
              class="text-body-2 text-medium-emphasis pa-4 text-center"
            >
              {{ scope === 'mine' ? 'Вас не упоминали и вы не писали в таких ветках.' : 'Комментариев нет. «Новый» — выбрать место на карте.' }}
            </div>
            <button
              v-for="t in list?.items ?? []"
              :key="t.id"
              type="button"
              class="mc-item"
              :class="{ 'mc-item--active': current?.id === t.id }"
              @click="openThread(t.id, true)"
            >
              <div class="d-flex align-center ga-1">
                <span
                  v-if="t.unread"
                  class="mc-dot"
                  aria-label="Есть новое"
                />
                <span class="text-caption text-medium-emphasis flex-grow-1">
                  {{ t.created_by || '—' }} · {{ timeAgo(t.last_at) }}
                </span>
                <v-chip
                  v-if="t.resolved"
                  size="x-small"
                  variant="tonal"
                >
                  решено
                </v-chip>
                <span class="text-caption">
                  <v-icon size="14">mdi-comment-text-outline</v-icon> {{ t.comment_count }}
                </span>
              </div>
              <div class="text-body-2 mc-snippet">
                {{ t.snippet || 'сообщение удалено' }}
              </div>
            </button>
          </div>

          <div
            v-if="current"
            class="mc-thread"
          >
            <div class="d-flex align-center ga-1 mb-2">
              <v-btn
                v-if="isMobile"
                icon="mdi-arrow-left"
                variant="text"
                size="small"
                aria-label="К списку"
                @click="current = null"
              />
              <span class="text-subtitle-2 flex-grow-1">
                Ветка №{{ current.id }}<span
                  v-if="current.object_kind"
                  class="text-caption text-medium-emphasis"
                > · {{ current.object_kind === 'line' ? 'участок' : 'узел' }} {{ current.object_id }}</span>
              </span>
              <HintTip text="Показать на карте">
                <template #default="{ props: tip }">
                  <v-btn
                    v-bind="tip"
                    icon="mdi-crosshairs-gps"
                    variant="text"
                    size="small"
                    aria-label="Показать на карте"
                    @click="emit('focus-coords', current.lon, current.lat)"
                  />
                </template>
              </HintTip>
              <HintTip text="Скопировать ссылку на ветку">
                <template #default="{ props: tip }">
                  <v-btn
                    v-bind="tip"
                    icon="mdi-link-variant"
                    variant="text"
                    size="small"
                    aria-label="Скопировать ссылку на ветку"
                    @click="copyLink(current)"
                  />
                </template>
              </HintTip>
              <v-btn
                size="small"
                :variant="current.resolved ? 'tonal' : 'flat'"
                :color="current.resolved ? undefined : 'success'"
                :prepend-icon="current.resolved ? 'mdi-restore' : 'mdi-check'"
                :loading="saving"
                @click="toggleResolved(current)"
              >
                {{ current.resolved ? 'Открыть снова' : 'Решено' }}
              </v-btn>
            </div>
            <div
              v-if="current.resolved"
              class="text-caption text-medium-emphasis mb-2"
            >
              Решено: {{ current.resolved_by }}, {{ formatDateTime(current.resolved_at) }}. Ответ откроет ветку снова.
            </div>

            <div class="mc-comments mb-2">
              <div
                v-for="c in current.comments ?? []"
                :key="c.id"
                class="mc-comment"
              >
                <div class="d-flex align-center ga-1">
                  <span class="text-body-2 font-weight-medium">{{ c.author || '—' }}</span>
                  <span class="text-caption text-medium-emphasis flex-grow-1">
                    {{ formatDateTime(c.created_at) }}<span v-if="c.edited_at"> · изменено</span>
                  </span>
                  <template v-if="!c.deleted && isMine(c)">
                    <v-btn
                      icon="mdi-pencil-outline"
                      size="x-small"
                      variant="text"
                      aria-label="Изменить сообщение"
                      @click="startEdit(c)"
                    />
                    <v-btn
                      icon="mdi-delete-outline"
                      size="x-small"
                      variant="text"
                      aria-label="Удалить сообщение"
                      @click="removeComment(c)"
                    />
                  </template>
                </div>
                <div
                  v-if="c.deleted"
                  class="text-body-2 text-medium-emphasis font-italic"
                >
                  Сообщение удалено
                </div>
                <template v-else-if="editingId === c.id">
                  <v-textarea
                    v-model="editText"
                    rows="2"
                    auto-grow
                    variant="outlined"
                    density="compact"
                    :maxlength="MAX_BODY"
                    hide-details
                    class="mb-1"
                  />
                  <div class="d-flex justify-end ga-1">
                    <v-btn
                      size="small"
                      variant="text"
                      @click="editingId = null"
                    >
                      Отмена
                    </v-btn>
                    <v-btn
                      size="small"
                      color="primary"
                      variant="flat"
                      :disabled="!editText.trim()"
                      @click="saveEdit(c)"
                    >
                      Сохранить
                    </v-btn>
                  </div>
                </template>
                <div
                  v-else
                  class="text-body-2 mc-pre"
                >
                  <template
                    v-for="(s, i) in splitMentions(c.body, c.mentions)"
                    :key="i"
                  >
                    <span
                      v-if="s.mention"
                      class="mc-mention"
                    >{{ s.text }}</span>
                    <template v-else>
                      {{ s.text }}
                    </template>
                  </template>
                </div>
              </div>
            </div>

            <v-textarea
              v-model="replyText"
              label="Ответ"
              rows="2"
              auto-grow
              variant="outlined"
              density="compact"
              :maxlength="MAX_BODY"
              hide-details
              class="mb-1"
              @keydown.ctrl.enter="sendReply"
            />
            <div class="d-flex align-center ga-2">
              <MentionMenu
                :people="people"
                @pick="(login: string) => (replyText = addMention(replyText, login))"
              />
              <span class="text-caption text-medium-emphasis flex-grow-1">Ctrl+Enter — отправить</span>
              <v-btn
                color="primary"
                variant="flat"
                prepend-icon="mdi-send"
                :loading="saving"
                :disabled="!replyText.trim()"
                @click="sendReply"
              >
                Ответить
              </v-btn>
            </div>
          </div>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import HintTip from '~/components/HintTip.vue';
import MentionMenu from '~/components/MentionMenu.vue';
import {
  commentPinsEnabled,
  commentPinsStatus,
  commentsUnread,
  refreshCommentPins,
  setCommentPins,
} from '~/composables/useMapCommentPins';
import { cancelMapPointPick, pickMapPoint } from '~/composables/useMapPointPick';
import { useMobile } from '~/composables/useMobile';
import { useNotification } from '~/composables/useNotification';
import { fastApiService } from '~/services/fastApiService';
import { useAuthStore } from '~/stores/authStore';
import { useMapStore } from '~/stores/mapStore';
import { formatApiError } from '~/utils/apiError';
import {
  addMention,
  splitMentions,
  threadLink,
  timeAgo,
  type CommentPerson,
  type CommentScope,
  type CommentStatus,
  type MapComment,
  type MapThread,
  type MapThreadList,
} from '~/utils/mapComments';
import { formatDateTime } from '~/utils/workOrders';

/**
 * Комментарии на карте (фаза 2, п. 4 плана, по образцу Felt): ветка обсуждения в точке карты, @упоминания,
 * «решено», ссылка на ветку. Точки веток рисует MapViewer (useMapCommentPins) — и при закрытом окне;
 * клик по точке открывает ветку здесь.
 */
const emit = defineEmits<{ 'focus-coords': [lng: number, lat: number] }>();

const MAX_BODY = 4000;
const SEARCH_DEBOUNCE_MS = 300;

const visible = defineModel<boolean>({ default: false });
const { isMobile } = useMobile();
const authStore = useAuthStore();
const mapStore = useMapStore();
const { showInfo, showSuccess } = useNotification();

const loading = ref(false);
const saving = ref(false);
const errorMessage = ref('');
const list = ref<MapThreadList | null>(null);
const current = ref<MapThread | null>(null);
const status = ref<CommentStatus>('open');
const scope = ref<CommentScope>('all');
const search = ref('');
const people = ref<CommentPerson[]>([]);
const draft = ref<{ lon: number; lat: number; zoom: number; body: string } | null>(null);
const replyText = ref('');
const editingId = ref<number | null>(null);
const editText = ref('');
const picking = ref(false);

const fail = (err: unknown, what: string) => {
  errorMessage.value = formatApiError(err, what);
};

const isMine = (c: MapComment) => authStore.authDisabled || c.author === authStore.username;

async function loadList(): Promise<void> {
  loading.value = true;
  try {
    list.value = await fastApiService.getMapThreads({ status: status.value, scope: scope.value, q: search.value });
    commentsUnread.value = list.value.unread;
  } catch (err: unknown) {
    fail(err, 'Комментарии не загружены');
  } finally {
    loading.value = false;
  }
}

async function openThread(id: number, focus = false): Promise<void> {
  replyText.value = '';
  editingId.value = null;
  try {
    current.value = await fastApiService.getMapThread(id);
    if (focus) emit('focus-coords', current.value.lon, current.value.lat);
    // открыта — прочитана: точка на карте и счётчик «Мне» без неё
    const item = list.value?.items.find((t) => t.id === id);
    if (item?.unread) {
      item.unread = false;
      refreshCommentPins();
      if (list.value) list.value.unread = Math.max(0, list.value.unread - 1);
    }
  } catch (err: unknown) {
    current.value = null;
    fail(err, 'Ветка не открылась');
  }
}

/** После записи: ветка из ответа, список и точки на карте — заново */
async function applied(thread: MapThread | null): Promise<void> {
  current.value = thread;
  await loadList();
  refreshCommentPins();
}

/** «Новый»: окно уступает карту, клик — место ветки, Esc — отмена */
async function startPick(): Promise<void> {
  if (picking.value) return;
  picking.value = true;
  visible.value = false;
  showInfo('Кликните место комментария на карте (Esc — отмена)');
  const point = await pickMapPoint(mapStore.map);
  picking.value = false;
  visible.value = true;
  if (!point) return;
  current.value = null;
  draft.value = { ...point, body: '' };
}

async function createThread(): Promise<void> {
  const d = draft.value;
  if (!d?.body.trim() || saving.value) return;
  saving.value = true;
  try {
    const thread = await fastApiService.createMapThread({ lon: d.lon, lat: d.lat, zoom: d.zoom, body: d.body.trim() });
    draft.value = null;
    if (!commentPinsEnabled.value) setCommentPins(true);
    await applied(thread);
  } catch (err: unknown) {
    fail(err, 'Комментарий не опубликован');
  } finally {
    saving.value = false;
  }
}

async function sendReply(): Promise<void> {
  const t = current.value;
  const text = replyText.value.trim();
  if (!t || !text || saving.value) return;
  saving.value = true;
  try {
    await applied(await fastApiService.replyMapThread(t.id, text));
    replyText.value = '';
  } catch (err: unknown) {
    fail(err, 'Ответ не отправлен');
  } finally {
    saving.value = false;
  }
}

async function toggleResolved(t: MapThread): Promise<void> {
  saving.value = true;
  try {
    await applied(await fastApiService.setMapThreadResolved(t.id, !t.resolved));
  } catch (err: unknown) {
    fail(err, 'Отметка не сохранилась');
  } finally {
    saving.value = false;
  }
}

function startEdit(c: MapComment): void {
  editingId.value = c.id;
  editText.value = c.body;
}

async function saveEdit(c: MapComment): Promise<void> {
  try {
    await applied(await fastApiService.editMapComment(c.id, editText.value.trim()));
    editingId.value = null;
  } catch (err: unknown) {
    fail(err, 'Сообщение не изменено');
  }
}

async function removeComment(c: MapComment): Promise<void> {
  const last = (current.value?.comments ?? []).filter((x) => !x.deleted).length <= 1;
  if (!window.confirm(last ? 'Это единственное сообщение — ветка удалится целиком. Удалить?' : 'Удалить сообщение?')) return;
  try {
    const res = await fastApiService.deleteMapComment(c.id);
    await applied(res.thread);
  } catch (err: unknown) {
    fail(err, 'Сообщение не удалено');
  }
}

async function copyLink(t: MapThread): Promise<void> {
  const link = threadLink(window.location.href, t);
  try {
    await navigator.clipboard.writeText(link);
    showSuccess('Ссылка на ветку скопирована');
  } catch {
    window.prompt('Ссылка на ветку', link);
  }
}

watch([status, scope], () => {
  commentPinsStatus.value = status.value === 'resolved' ? 'resolved' : status.value === 'all' ? 'all' : 'open';
  void loadList();
});
let searchTimer: ReturnType<typeof setTimeout> | null = null;
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => void loadList(), SEARCH_DEBOUNCE_MS);
});

watch(visible, async (open) => {
  if (!open) {
    if (!picking.value) cancelMapPointPick();
    return;
  }
  await loadList();
  if (!people.value.length) {
    try {
      people.value = (await fastApiService.getCommentPeople()).items;
    } catch {
      // без списка упоминания пишутся вручную: @логин
    }
  }
}, { immediate: true });

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer);
});

/** Открыть окно; threadId — сразу ветку (клик по точке на карте, ссылка на ветку) */
const openDialog = (payload?: { threadId?: number }) => {
  visible.value = true;
  if (payload?.threadId) void openThread(payload.threadId);
};

defineExpose({ openDialog });
</script>

<style scoped>
.mc-search { flex: 1 1 200px; }
.mc-body { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); gap: var(--space-4, 16px); }
.mc-list { max-height: 60vh; overflow-y: auto; }
.mc-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  margin-bottom: 6px;
  border-radius: 8px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  color: inherit;
}
.mc-item--active { border-color: rgb(var(--v-theme-primary)); background: rgba(var(--v-theme-primary), 0.06); }
.mc-item:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
.mc-snippet { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }
.mc-dot { width: 8px; height: 8px; border-radius: 50%; background: #f4511e; flex-shrink: 0; }
.mc-thread { min-width: 0; }
.mc-comments { max-height: 45vh; overflow-y: auto; }
.mc-comment { padding: 6px 0; border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); }
.mc-pre { white-space: pre-wrap; overflow-wrap: anywhere; }
.mc-mention { color: rgb(var(--v-theme-primary)); font-weight: 500; }
.mc-compose { padding: 10px 12px; border-radius: 10px; background: rgba(var(--v-theme-primary), 0.05); }
@media (max-width: 720px) {
  .mc-body { grid-template-columns: minmax(0, 1fr); }
}
</style>
