<template>
  <Teleport to="body">
    <template v-if="current">
      <!-- Рамка вокруг зоны: без затемнения, карта остаётся рабочей -->
      <div
        class="first-run__ring"
        :style="ringStyle"
        aria-hidden="true"
      />
      <section
        ref="cardEl"
        class="first-run"
        role="dialog"
        aria-modal="false"
        :aria-labelledby="titleId"
        :aria-describedby="textId"
        :style="cardStyle"
      >
        <header class="first-run__head">
          <span class="first-run__step">{{ index + 1 }} из {{ steps.length }}</span>
          <HintTip
            text="Закрыть подсказки"
            hotkey="Esc"
            location="top"
          >
            <template #default="{ props: tip }">
              <v-btn
                v-bind="tip"
                icon="mdi-close"
                variant="text"
                size="x-small"
                aria-label="Закрыть подсказки"
                @click="finish"
              />
            </template>
          </HintTip>
        </header>
        <!-- фокус остаётся на «Далее» — новый шаг читалке экрана объявляет live-область -->
        <div aria-live="polite">
          <h2
            :id="titleId"
            class="first-run__title"
          >
            {{ current.title }}
          </h2>
          <p
            :id="textId"
            class="first-run__text"
          >
            {{ current.text }}
          </p>
        </div>
        <footer class="first-run__actions">
          <v-btn
            v-if="index > 0"
            variant="text"
            size="small"
            @click="go(-1)"
          >
            Назад
          </v-btn>
          <v-spacer />
          <v-btn
            ref="nextBtn"
            color="primary"
            variant="flat"
            size="small"
            @click="index < steps.length - 1 ? go(1) : finish()"
          >
            {{ index < steps.length - 1 ? 'Далее' : 'Понятно' }}
          </v-btn>
        </footer>
      </section>
    </template>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import HintTip from '~/components/HintTip.vue';
import { useEscapeClose } from '~/composables/useEscape';
import { useNotificationStore } from '~/stores/notificationStore';
import { appStorage } from '~/utils/appStorage';
import {
  FIRST_RUN_STEPS,
  FIRST_RUN_STORAGE_KEY,
  FIRST_RUN_VERSION,
  placeHintCard,
  type FirstRunStep,
  type HintRect,
} from '~/utils/firstRunHints';

/**
 * Подсказка первого запуска по зонам экрана (этап 8): показывается один раз после входа, закрывается
 * крестиком, Esc или «Понятно» и больше не возвращается (флаг в appStorage). Снова — из меню пользователя
 * («Подсказки по экрану»): start().
 */
const props = withDefaults(defineProps<{
  /** Через сколько после монтирования показать (карта и шапка успевают встать) */
  delayMs?: number;
  /** Показать при первом входе; false — только по start() */
  auto?: boolean;
  /** Экран готов (карта показала первый кадр): до этого зоны закрыты экраном загрузки */
  ready?: boolean;
  /** Куда вернуть фокус, если элемент, с которого запустили, уже снят (пункт закрывшегося меню) */
  focusFallback?: string;
}>(), {
  focusFallback: '[aria-label="Меню пользователя"]',
  delayMs: 1500,
  auto: true,
  ready: true,
});

const steps = ref<FirstRunStep[]>([]);
const index = ref(-1);
const anchorRect = ref<HintRect | null>(null);
const cardEl = ref<HTMLElement | null>(null);
const nextBtn = ref<{ $el?: HTMLElement } | null>(null);
const cardSize = ref({ w: 300, h: 160 });
const view = ref({ w: 0, h: 0 });
const titleId = `first-run-title-${useId()}`;
const textId = `first-run-text-${useId()}`;
let returnFocus: HTMLElement | null = null;
let startTimer: ReturnType<typeof setTimeout> | null = null;

const current = computed(() => (index.value >= 0 ? steps.value[index.value] ?? null : null));

const isOnScreen = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
};

/** Первый видимый элемент зоны (у одной зоны бывают скрытые двойники — телефон и десктоп) */
const visibleAnchor = (step: FirstRunStep): HTMLElement | null => {
  for (const selector of step.anchors) {
    const el = Array.from(document.querySelectorAll<HTMLElement>(selector)).find(isOnScreen);
    if (el) return el;
  }
  return null;
};

const measure = () => {
  view.value = { w: window.innerWidth, h: window.innerHeight };
  const step = current.value;
  const el = step && visibleAnchor(step);
  if (!el) {
    anchorRect.value = null;
    return;
  }
  const r = el.getBoundingClientRect();
  anchorRect.value = { left: r.left, top: r.top, width: r.width, height: r.height };
  if (cardEl.value) cardSize.value = { w: cardEl.value.offsetWidth, h: cardEl.value.offsetHeight };
};

const RING_PAD_PX = 4;
const ringStyle = computed(() => {
  const r = anchorRect.value;
  if (!r) return { display: 'none' };
  return {
    left: `${r.left - RING_PAD_PX}px`,
    top: `${r.top - RING_PAD_PX}px`,
    width: `${r.width + RING_PAD_PX * 2}px`,
    height: `${r.height + RING_PAD_PX * 2}px`,
  };
});

const cardStyle = computed(() => {
  const r = anchorRect.value;
  const step = current.value;
  if (!r || !step) return { left: '50%', bottom: '24px', transform: 'translateX(-50%)' };
  const p = placeHintCard(r, cardSize.value, view.value, step.side);
  return { left: `${p.x}px`, top: `${p.y}px` };
});

const readDone = (): boolean => {
  try {
    return appStorage.getItem(FIRST_RUN_STORAGE_KEY) === FIRST_RUN_VERSION;
  } catch {
    return false; // хранилище закрыто (приватный режим) — подсказка покажется, но это не мешает работе
  }
};

const markDone = () => {
  try {
    appStorage.setItem(FIRST_RUN_STORAGE_KEY, FIRST_RUN_VERSION);
  } catch {
    // не сохранилось — в следующий раз подсказка покажется снова
  }
};

const show = async (i: number) => {
  index.value = i;
  await nextTick();
  measure();
  // второй проход: размер карточки известен только после отрисовки нового текста
  await nextTick();
  measure();
};

/** manual — из меню: без зон на экране сказать об этом, а не молчать */
const start = async (manual = true) => {
  steps.value = FIRST_RUN_STEPS.filter((s) => visibleAnchor(s));
  if (!steps.value.length) {
    if (manual) useNotificationStore().showInfo('На этом экране подсказок по зонам нет — откройте карту');
    return;
  }
  // повторный запуск поверх открытой подсказки — фокус возвращать туда же, куда и раньше
  if (index.value < 0) {
    const active = document.activeElement;
    returnFocus = active instanceof HTMLElement && !cardEl.value?.contains(active) ? active : null;
  }
  await show(0);
  // сама (первый вход) — фокус не перехватывать; из меню — на «Далее»
  if (manual) nextBtn.value?.$el?.focus({ preventScroll: true });
};

const go = (delta: number) => {
  const next = index.value + delta;
  if (next < 0 || next >= steps.value.length) return;
  void show(next);
};

const finish = () => {
  if (index.value < 0) return;
  index.value = -1;
  anchorRect.value = null;
  markDone();
  // пункт меню, с которого запустили, к этому времени уже снят — тогда на кнопку меню пользователя
  const target = returnFocus?.isConnected && returnFocus.offsetParent !== null
    ? returnFocus
    : document.querySelector<HTMLElement>(props.focusFallback);
  target?.focus({ preventScroll: true });
  returnFocus = null;
};

useEscapeClose({ open: () => index.value >= 0, close: finish });

/** Фокус в поле ввода или открыт диалог/меню — автоподсказка не перехватывает фокус */
const isUserBusy = (): boolean => {
  const active = document.activeElement;
  if (active instanceof HTMLElement && (active.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))) return true;
  return Boolean(document.querySelector('.v-overlay--active'));
};

const onResize = () => {
  if (index.value >= 0) measure();
};

onMounted(() => {
  window.addEventListener('resize', onResize);
  if (!props.auto || readDone()) return;
  // один раз: когда экран готов, через паузу; пользователь печатает или открыт диалог — позже
  const schedule = () => {
    startTimer = setTimeout(() => {
      if (isUserBusy()) schedule();
      else void start(false);
    }, props.delayMs);
  };
  if (props.ready) {
    schedule();
    return;
  }
  const stop = watch(() => props.ready, (ready) => {
    if (!ready) return;
    stop();
    schedule();
  });
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
  if (startTimer) clearTimeout(startTimer);
});

defineExpose({ start, finish });
</script>

<style scoped>
.first-run__ring {
  position: fixed;
  z-index: var(--z-popover, 2000);
  border: 2px solid rgb(var(--v-theme-primary));
  border-radius: var(--radius-md, 8px);
  pointer-events: none;
  transition:
    left var(--duration-base) var(--ease-out),
    top var(--duration-base) var(--ease-out),
    width var(--duration-base) var(--ease-out),
    height var(--duration-base) var(--ease-out);
}

.first-run {
  position: fixed;
  z-index: var(--z-popover, 2000);
  width: min(300px, calc(100vw - 24px));
  padding: 12px 12px 8px 16px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  border-radius: var(--radius-lg, 12px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  transition:
    left var(--duration-base) var(--ease-out),
    top var(--duration-base) var(--ease-out);
}

.first-run__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.first-run__step {
  font-size: var(--text-xs, 12px);
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-variant-numeric: tabular-nums;
}

.first-run__title {
  margin: 2px 0 4px;
  font-size: var(--text-md, 15px);
  font-weight: 600;
  line-height: 1.4;
}

.first-run__text {
  margin: 0 0 8px;
  font-size: var(--text-sm, 14px);
  line-height: 1.45;
}

.first-run__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
