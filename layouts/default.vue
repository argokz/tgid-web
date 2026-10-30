<template>
  <v-app>
    <!-- Шапка в духе Felt (этап 10): 48 px стекла поверх карты, тень вместо границы; высота = токен --shell-top.
         Телефон (< 960, 10г): полосы нет — меню со знаком, поиск и профиль плавают в углах (стили ниже, по ширине
         экрана: сервер ширину не знает, поэтому без переключения разметки после гидрации) -->
    <v-app-bar
      app
      flat
      height="48"
      tag="header"
      class="app-header"
      :class="{ 'app-header--covered': mainMenuOpen || uiStore.toolsPanelOpen }"
    >
      <HintTip
        v-if="navCollapsed"
        text="Открыть главное меню"
        hint="Разделы, инструменты, город и роль"
      >
        <template #default="{ props: tip }">
          <!-- знак приложения с «▾» — меню, как у Felt: и бренд, и вход в разделы -->
          <v-btn
            v-bind="tip"
            variant="text"
            class="corner-btn corner-btn--menu"
            aria-label="Открыть меню"
            aria-controls="main-menu"
            :aria-expanded="mainMenuOpen"
            @click="mainMenuOpen = !mainMenuOpen"
          >
            <AppLogo
              size="22"
              class="text-primary"
            />
            <v-icon
              size="16"
              class="corner-btn__chevron"
            >mdi-chevron-down</v-icon>
          </v-btn>
        </template>
      </HintTip>

      <!-- Брендинг -->
      <div
        class="app-brand d-flex align-center"
        :class="navCollapsed ? 'ms-1 me-2' : 'ms-2 me-2'"
      >
        <AppLogo
          size="22"
          class="brand-icon text-primary"
        />
        <span class="brand-title ms-2">ITwin</span>
        <span class="brand-subtitle">Map</span>
      </div>

      <!-- Город и роль видны всегда; на узком экране роль остаётся в меню пользователя -->
      <div
        v-if="isHydrated && (authStore.isAuthenticated || authStore.authDisabled) && authStore.cityLabel"
        class="app-context d-flex align-center me-2"
        :title="`${authStore.cityLabel} · ${roleLabel}`"
      >
        <v-icon
          size="16"
          class="me-1"
          aria-hidden="true"
        >mdi-map-marker</v-icon>
        <span class="app-context__city">{{ authStore.cityLabel }}</span>
        <span class="app-context__role d-none d-md-inline">· {{ roleLabel }}</span>
      </div>

      <!-- Навигация: кнопки в шапке, на узком экране — в выдвижном меню (QA F1, F57) -->
      <nav
        v-if="!navCollapsed"
        class="nav-links d-flex align-center"
        aria-label="Разделы"
      >
        <template
          v-for="item in navItems"
          :key="item.id"
        >
          <v-menu
            v-if="item.children"
            location="bottom start"
          >
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                :prepend-icon="item.icon"
                append-icon="mdi-chevron-down"
                class="nav-btn"
                variant="text"
                height="32"
                :loading="isItemBusy(item)"
              >
                {{ item.title }}
              </v-btn>
            </template>
            <v-list
              density="compact"
              class="nav-submenu"
            >
              <template
                v-for="(group, gi) in groupMenuChildren(item.children)"
                :key="group.title ?? gi"
              >
                <v-list-subheader
                  v-if="group.title"
                  class="section-label"
                >
                  {{ group.title }}
                </v-list-subheader>
                <v-list-item
                  v-for="child in group.items"
                  :key="child.id"
                  :title="child.title"
                  :subtitle="childSubtitle(child)"
                  :prepend-icon="child.icon"
                  :disabled="isChildBusy(child)"
                  @click="runMenuAction(child)"
                />
              </template>
            </v-list>
          </v-menu>
          <v-btn
            v-else
            :prepend-icon="item.icon"
            :active="isItemActive(item)"
            :class="['nav-btn', { 'active-link': isItemActive(item) }]"
            variant="text"
            height="32"
            @click="runMenuAction(item)"
          >
            {{ item.title }}
          </v-btn>
        </template>
      </nav>

      <v-spacer />

      <!-- Палитра команд — единственный поиск: журналы, инструменты, узлы, адреса. Выглядит как поле, хоткей виден -->
      <HintTip
        v-if="paletteAvailable"
        text="Команды и поиск"
        hotkey="Ctrl+K"
        hint="Журналы, инструменты, узлы сети и адреса"
        location="bottom"
      >
        <template #default="{ props: tip }">
          <button
            v-bind="tip"
            type="button"
            class="header-search corner-btn me-1"
            data-first-run="palette"
            aria-label="Поиск: узел, адрес, журнал, команда"
            aria-keyshortcuts="Control+K"
            @click="paletteOpen = true"
          >
            <v-icon
              size="18"
              aria-hidden="true"
            >mdi-magnify</v-icon>
            <span class="header-search__text">Узел, адрес, журнал, команда</span>
            <kbd class="header-search__kbd">Ctrl K</kbd>
          </button>
        </template>
      </HintTip>

      <!-- Пункты справа иконками: «Инструменты» (журналы, реестры, отчёты) -->
      <HintTip
        v-for="item in endItems"
        :key="item.id"
        :text="item.title"
        hint="Журналы, реестры, отчёты"
        location="bottom"
      >
        <template #default="{ props: tip }">
          <v-btn
            v-bind="tip"
            :icon="item.icon"
            :active="isItemActive(item)"
            variant="text"
            class="header-icon-btn header-end-btn"
            :aria-label="item.title"
            :aria-pressed="isItemActive(item)"
            @click="runMenuAction(item)"
          />
        </template>
      </HintTip>

      <!-- Кто ещё на карте (живая карта) -->
      <LivePresence />

      <!-- Пользователь -->
      <v-menu
        location="bottom end"
        :close-on-content-click="true"
        transition="scale-transition"
      >
        <template #activator="{ props: menuProps }">
          <HintTip text="Открыть меню пользователя">
            <template #default="{ props: tip }">
              <v-btn
                v-bind="mergeProps(menuProps, tip)"
                icon
                variant="text"
                class="header-icon-btn user-avatar-btn corner-btn me-1"
                aria-label="Меню пользователя"
              >
                <v-avatar
                  size="28"
                  class="user-avatar"
                >
                  <span
                    v-if="userInitials"
                    class="user-avatar__initials"
                  >{{ userInitials }}</span>
                  <v-icon
                    v-else
                    size="18"
                  >mdi-account</v-icon>
                </v-avatar>
              </v-btn>
            </template>
          </HintTip>
        </template>
        <v-card min-width="240">
          <v-list
            density="compact"
            class="py-1"
          >
            <v-list-item
              v-if="authStore.isAuthenticated"
              :title="authStore.displayName || authStore.username"
              :subtitle="authStore.cityLabel ? `${roleLabel} · ${authStore.cityLabel}` : roleLabel"
              prepend-icon="mdi-account-check"
            />
            <v-list-item
              v-else
              prepend-icon="mdi-login"
              title="Войти"
              @click="showLogin = true"
            />
            <v-list-item
              prepend-icon="mdi-card-account-details-outline"
              title="Личный кабинет"
              @click="openAccount('profile')"
            />
            <!-- Другие города, доступные пользователю: свой веб у каждого, вход — отдельно -->
            <v-list-item
              v-for="c in otherCities"
              :key="c.code"
              :href="c.path"
              prepend-icon="mdi-swap-horizontal"
              :title="`Перейти: ${c.label}`"
            />
            <v-list-item
              v-if="authStore.isAdmin && !authStore.authDisabled"
              prepend-icon="mdi-account-cog"
              title="Пользователи"
              @click="openAccount('users')"
            />
            <v-list-item
              v-if="authStore.canChangeOwnPassword"
              prepend-icon="mdi-lock-reset"
              title="Сменить пароль"
              @click="showChangePassword = true"
            />
            <v-list-item
              prepend-icon="mdi-help-circle-outline"
              title="Подсказки по экрану"
              @click="firstRunHints?.start()"
            />
            <v-list-item
              prepend-icon="mdi-cog-outline"
              title="Настройки"
              disabled
            />
            <v-divider class="my-1" />
            <v-list-item
              prepend-icon="mdi-logout"
              title="Выйти"
              color="error"
              :disabled="!authStore.isAuthenticated"
              @click="logout"
            />
          </v-list>
        </v-card>
      </v-menu>
    </v-app-bar>

    <!-- Меню гамбургера: те же пункты и права, что у кнопок шапки -->
    <v-navigation-drawer
      v-if="navCollapsed"
      id="main-menu"
      v-model="mainMenuOpen"
      temporary
      location="left"
      width="300"
      class="main-menu-drawer"
      aria-label="Главное меню"
    >
      <!-- На телефоне шапки нет: знак, город и роль — здесь -->
      <div class="main-menu-head">
        <div class="d-flex align-center">
          <AppLogo
            size="22"
            class="text-primary"
          />
          <span class="brand-title ms-2">ITwin</span>
          <span class="brand-subtitle">Map</span>
        </div>
        <div
          v-if="isHydrated && (authStore.isAuthenticated || authStore.authDisabled) && authStore.cityLabel"
          class="main-menu-head__context"
        >
          {{ authStore.cityLabel }} · {{ roleLabel }}
        </div>
      </div>
      <v-list
        density="comfortable"
        nav
        color="primary"
      >
        <template
          v-for="item in menuItems"
          :key="item.id"
        >
          <v-list-group
            v-if="item.children"
            :value="item.id"
          >
            <template #activator="{ props, isOpen }">
              <!-- заголовок группы — раскрывашка: без роли Vuetify ставит ему недопустимый aria-selected -->
              <v-list-item
                v-bind="props"
                :prepend-icon="item.icon"
                :title="item.title"
                role="button"
                :aria-expanded="isOpen"
                :aria-selected="undefined"
              >
                <template
                  v-if="isItemBusy(item)"
                  #append
                >
                  <v-progress-circular
                    indeterminate
                    size="18"
                    width="2"
                    class="me-2"
                  />
                </template>
              </v-list-item>
            </template>
            <template
              v-for="(group, gi) in groupMenuChildren(item.children)"
              :key="group.title ?? gi"
            >
              <v-list-subheader
                v-if="group.title"
                class="section-label"
              >
                {{ group.title }}
              </v-list-subheader>
              <v-list-item
                v-for="child in group.items"
                :key="child.id"
                :title="child.title"
                :subtitle="childSubtitle(child)"
                :prepend-icon="child.icon"
                :disabled="isChildBusy(child)"
                @click="onDrawerItem(child)"
              />
            </template>
          </v-list-group>
          <v-list-item
            v-else
            :prepend-icon="item.icon"
            :title="item.title"
            :active="isItemActive(item)"
            @click="onDrawerItem(item)"
          />
        </template>
      </v-list>
    </v-navigation-drawer>

    <!-- Деградация API: видно сразу, а не через пустые диалоги -->
    <v-alert
      v-if="!apiHealth.reachable || apiHealth.outdatedRoutes || !apiHealth.redisOk"
      :type="apiHealth.reachable ? 'warning' : 'error'"
      variant="tonal"
      density="compact"
      class="api-health-alert"
      :icon="apiHealth.reachable ? 'mdi-alert-outline' : 'mdi-lan-disconnect'"
    >
      <span class="text-body-2">{{ apiHealth.lastError }}</span>
    </v-alert>
    <!-- Транспорт повторяет запрос после сбоя (ретраи только для чтения): пользователь видит, что ждём не зря -->
    <v-alert
      v-else-if="apiHealth.retrying > 0"
      type="info"
      variant="tonal"
      density="compact"
      class="api-health-alert"
      icon="mdi-refresh"
      role="status"
    >
      <span class="text-body-2">Сервер не ответил — повторяем запрос…</span>
    </v-alert>

    <v-main class="app-main">
      <!-- Карту монтируем, только когда ясно, что вход не нужен (или он уже выполнен): иначе она
           успевала показаться (панель слоёв и т. п.) и исчезала за формой входа -->
      <slot v-if="!appLocked" />
      <div
        v-else
        class="login-required-backdrop"
      >
        <AppSplash
          v-if="!authStore.loginRequired"
          label="Проверка входа…"
        />
      </div>
    </v-main>

    <!-- Диалоги шапки монтируются при первом открытии и остаются (ленивые чанки не входят в критический путь) -->
    <LazyLoginDialog
      v-if="mountedOnce.login"
      v-model="showLogin"
      :required="authStore.loginRequired"
    />
    <LazyChangePasswordDialog
      v-if="mountedOnce.changePassword"
      v-model="showChangePassword"
    />
    <LazyAccountDialog
      v-if="mountedOnce.account"
      v-model="showAccount"
      :initial-tab="accountTab"
      @change-password="showChangePassword = true"
      @logout="logout"
    />
    <ConfirmDialogHost />

    <LazyCommandPalette
      v-if="mountedOnce.palette"
      v-model="paletteOpen"
      @open-hotkeys="hotkeysHelpOpen = true"
    />

    <!-- «?» — справка по клавишам (вне редактора; в редакторе — его экземпляр в MapViewer) -->
    <LazyHotkeysHelp
      v-if="mountedOnce.hotkeys"
      v-model="hotkeysHelpOpen"
    />

    <!-- Подсказка по зонам экрана: один раз после входа; снова — из меню пользователя -->
    <FirstRunHints
      v-if="isHydrated && (authStore.isAuthenticated || authStore.authDisabled)"
      ref="firstRunHints"
      :ready="route.path !== '/' || mapStore.firstFrameShown"
    />

    <!-- Модальное окно расчёта -->
    <LazyPlanningCalculationModal
      v-if="mountedOnce.calculation && authStore.canCalculate"
      ref="calculationModalRef"
      v-model="showCalculationModal"
      @protocol-log="onCalculationLog"
      @show-protocol="showProtocol = $event"
      @protocol-ready="onProtocolReady"
      @open-protocol="protocolRef?.loadByCalculation($event)"
    />

    <!-- Окно протокола: анализ ошибок с переходом к объектам, «Исправить», «Пересчитать» -->
    <LazyCalculationProtocol
      v-if="mountedOnce.protocol"
      ref="protocolRef"
      v-model:show="showProtocol"
      :can-recalculate="!!calculationModalRef?.canRerun"
      @open-calculation="showCalculationModal = true"
      @recalculate="calculationModalRef?.rerun()"
    />

    <!-- Глобальные уведомления (notificationStore); с действием — дольше и с кнопкой -->
    <v-snackbar
      v-model="notificationStore.show"
      :color="notificationStore.type"
      location="bottom"
      multi-line
      :timeout="notificationStore.action ? 15000 : 5000"
    >
      {{ notificationStore.message }}
      <template #actions>
        <v-btn
          v-if="notificationStore.action"
          variant="text"
          @click="notificationStore.runAction()"
        >
          {{ notificationStore.action.label }}
        </v-btn>
        <HintTip
          text="Закрыть"
        >
          <template #default="{ props: tip }">
            <v-btn
              v-bind="tip"
              icon="mdi-close"
              variant="text"
              size="small"
              aria-label="Закрыть"
              @click="notificationStore.hide()"
            />
          </template>
        </HintTip>
      </template>
    </v-snackbar>
  </v-app>
</template>

<script setup lang="ts">
import { ref, reactive, computed, mergeProps, nextTick, onBeforeUnmount, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useMobile } from '~/composables/useMobile';
import { useEscapeClose, useGlobalEscape } from '~/composables/useEscape';
import { registerHotkeys } from '~/composables/useHotkeys';
import {
  apiHealth,
  describeExcelReportTruncation,
  describeFileJobProgress,
  describeNetworkExportTruncation,
  fastApiService,
  refreshApiHealth,
  type NetworkExportMeta,
} from '~/services/fastApiService';
import { useNotificationStore } from '~/stores/notificationStore';
import { useAuthStore } from '~/stores/authStore';
import { useFragmentStore } from '~/stores/fragmentStore';
import { useUiStore } from '~/stores/uiStore';
import type PlanningCalculationModal from '~/components/PlanningCalculationModal.vue';
import type CalculationProtocol from '~/components/CalculationProtocol.vue';
import ConfirmDialogHost from '~/components/ConfirmDialogHost.vue';
import HintTip from '~/components/HintTip.vue';
import LivePresence from '~/components/LivePresence.vue';
import FirstRunHints from '~/components/FirstRunHints.vue';
import AppLogo from '~/components/AppLogo.vue';
import AppSplash from '~/components/AppSplash.vue';
import { useMapStore } from '~/stores/mapStore';
import { formatApiErrorWith } from '~/utils/apiError';
import { ROLE_LABELS, type Role } from '~/utils/permissions';
import { deviceClass } from '~/utils/breakpoints';
import { buildPageTitle } from '~/utils/pageTitle';
import { NETWORK_FILE_FORMATS, buildHeaderMenu, groupMenuChildren, isHeaderNavCollapsed, type HeaderMenuItem, type NetworkFileFormat } from '~/utils/headerMenu';

const { screenWidth } = useMobile();
// SSR не знает ширину окна и рендерит десктопную шапку; до монтирования клиент
// обязан отрисовать то же самое, иначе гидратация расходится (кнопка меню,
// классы брендинга, кнопки навигации). Мобильная раскладка и кнопки по роли
// (роль/флаги сервера приходят из localStorage и /auth/config) — только после mount.
const isHydrated = ref(false);
// Пункты шапки не помещаются уже на планшете: ниже порога — гамбургер и выдвижное меню
const navCollapsed = computed(() => isHydrated.value && isHeaderNavCollapsed(screenWidth.value));
const route = useRoute();
const authStore = useAuthStore();
const mapStore = useMapStore();
const notificationStore = useNotificationStore();
const uiStore = useUiStore();
const fragmentStore = useFragmentStore();
const mainMenuOpen = ref(false);
const showLogin = ref(false);
const showCalculationModal = ref(false);
const showProtocol = ref(false);
const exportingShp = ref(false);
const exportingDxf = ref(false);
const exportingGeoJson = ref(false);
const protocolRef = ref<InstanceType<typeof CalculationProtocol> | null>(null);
const calculationModalRef = ref<InstanceType<typeof PlanningCalculationModal> | null>(null);

/**
 * Диалоги шапки — ленивые чанки, монтируются при первом открытии и дальше живут (v-dialog сохраняет
 * состояние и анимацию закрытия). До этого в entry-чанк шапки входили протокол расчёта (1 400 строк),
 * окно расчёта, вход, кабинет и смена пароля — замер S0 этапа 0 (docs/performance-baseline.md).
 * Протокол монтируется вместе с окном расчёта: лог расчёта (addLog) приходит в него ещё до показа.
 */
const mountedOnce = reactive({ login: false, changePassword: false, account: false, calculation: false, protocol: false, hotkeys: false, palette: false });
const hotkeysHelpOpen = ref(false);
watch(hotkeysHelpOpen, (v) => { if (v) mountedOnce.hotkeys = true; });
const paletteOpen = ref(false);
const firstRunHints = ref<InstanceType<typeof FirstRunHints> | null>(null);
watch(paletteOpen, (v) => { if (v) mountedOnce.palette = true; });
const paletteAvailable = computed(() => isHydrated.value && (authStore.isAuthenticated || authStore.authDisabled));
watch(paletteAvailable, (ok) => { if (!ok) paletteOpen.value = false; });
watch(showLogin, (v) => { if (v) mountedOnce.login = true; }, { immediate: true });
watch(showCalculationModal, (v) => { if (v) { mountedOnce.calculation = true; mountedOnce.protocol = true; } }, { immediate: true });
watch(showProtocol, (v) => { if (v) mountedOnce.protocol = true; }, { immediate: true });

onMounted(() => {
  isHydrated.value = true;
  authStore.hydrate();
  void refreshApiHealth();
});

const otherCities = computed(() =>
  authStore.isAuthenticated ? authStore.cities.filter((c) => c.code !== authStore.city) : [],
);
const roleLabel = computed(() => ROLE_LABELS[authStore.role as Role] || authStore.role || 'пользователь');

// Класс устройства для менеджера панелей (телефон — одна панель на экране); на рендер не влияет, 0 — окно ещё не измерено (SSR)
watch(screenWidth, (w) => {
  if (w > 0) uiStore.setViewport(deviceClass(w));
}, { immediate: true });

// Заголовок вкладки: открытая панель или текущий фрагмент — город — ITwin Map
const titleContext = computed(() => {
  if (uiStore.drawPanelOpen) return 'Измерения';
  if (uiStore.toolsPanelOpen) return 'Инструменты';
  const id = fragmentStore.selectedFragmentId;
  return id == null ? null : fragmentStore.fragments.find((f) => Number(f.id) === Number(id))?.name ?? null;
});
useHead({
  title: computed(() => buildPageTitle({ context: titleContext.value, city: isHydrated.value ? authStore.cityLabel : '' })),
});

// Сессия истекла (exp или 401) — открыть форму входа (QA F71)
watch(() => authStore.loginPrompt, () => {
  showLogin.value = true;
});

// Сервер требует вход (AUTH_REQUIRED_GET), а сессии нет: форма входа без «Отмены».
// Карта (client-only) монтируется после mount, когда известно, нужен ли вход: есть сохранённый
// токен, или /auth/config ответил (или не ответил — тогда как раньше, с баннером недоступности API).
// SSR и гидратация рисуют одинаковую заглушку. Истёкшая сессия карту не сбрасывает.
// Cookie доступа к GeoServer выдаёт /auth/me до того, как вход откроет карту (authStore.login).
const appUnlocked = ref(false);
const appLocked = computed(() => !appUnlocked.value);
watch(
  () => [isHydrated.value, authStore.accessToken, authStore.configSettled, authStore.loginRequired] as const,
  ([hydrated, token, settled, required]) => {
    if (!hydrated) return;
    if (token || (settled && !required)) appUnlocked.value = true;
    if (required) showLogin.value = true;
  },
  { immediate: true },
);

// Личный кабинет: профиль, права, смена пароля; администратору — пользователи
const showAccount = ref(false);
const accountTab = ref<'profile' | 'users'>('profile');
const openAccount = (tab: 'profile' | 'users') => {
  accountTab.value = tab;
  showAccount.value = true;
};

/** Выход; если без входа сервер данных не отдаёт — перезагрузить, чтобы не оставлять их на экране */
const logout = () => {
  const reload = authStore.authRequiredGet && !authStore.authDisabled;
  authStore.logout();
  showAccount.value = false;
  if (reload && process.client) window.location.reload();
};

// Смена пароля; временный пароль от администратора (AUTH_BACKEND=pg) — предложить сразу после входа
const showChangePassword = ref(false);
// showAccount и showChangePassword объявлены ниже mountedOnce — наблюдатели здесь
watch(showAccount, (v) => { if (v) mountedOnce.account = true; }, { immediate: true });
watch(showChangePassword, (v) => { if (v) mountedOnce.changePassword = true; }, { immediate: true });
watch(() => authStore.mustChangePassword, (must) => {
  if (must) showChangePassword.value = true;
});

// Роль понизили или вышли из учётной записи — окно расчёта закрывается
watch(() => authStore.canCalculate, (allowed) => {
  if (!allowed) showCalculationModal.value = false;
});

// Экран расширили — меню гамбургера больше не нужно
watch(navCollapsed, (collapsed) => {
  if (!collapsed) mainMenuOpen.value = false;
});

// Временный v-navigation-drawer сам по Esc не закрывается — меню в стеке Esc менеджера панелей (docs/ui-zones.md)
useEscapeClose({ open: mainMenuOpen, close: () => { mainMenuOpen.value = false; } });

// Телефон: открытое меню прячет угловые кнопки (layouts — .app-header--covered), а с ними и кнопку меню, на которой
// был фокус. Фокус — в меню, после закрытия — обратно на кнопку (если его не забрало открытое из меню окно)
watch(mainMenuOpen, async (open) => {
  await nextTick();
  if (open) {
    document.querySelector<HTMLElement>('#main-menu .v-list-item')?.focus();
    return;
  }
  const active = document.activeElement;
  if (!active || active === document.body || active.closest('#main-menu')) {
    document.querySelector<HTMLElement>('.corner-btn--menu')?.focus();
  }
});
useGlobalEscape();
// Глобальные клавиши: «?» — справка (в редакторе её берёт сам редактор); Ctrl/Cmd+K — палитра команд,
// в том числе из поля ввода и поверх диалога (это и есть способ переключиться)
const disposeGlobalHotkeys: (() => void)[] = [];
onMounted(() => {
  disposeGlobalHotkeys.push(registerHotkeys({
    id: 'hotkeys-help',
    area: 'global',
    handle: (ev) => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return false;
      if (ev.key !== '?' && !(ev.shiftKey && ev.code === 'Slash')) return false;
      hotkeysHelpOpen.value = true;
      return true;
    },
  }));
  disposeGlobalHotkeys.push(registerHotkeys({
    id: 'command-palette',
    area: 'global',
    allowInInput: true,
    allowInOverlay: true,
    handle: (ev) => {
      if (!(ev.ctrlKey || ev.metaKey) || ev.altKey || ev.shiftKey || ev.code !== 'KeyK') return false;
      if (!paletteAvailable.value) return false;
      paletteOpen.value = !paletteOpen.value;
      return true;
    },
  }));
});
onBeforeUnmount(() => disposeGlobalHotkeys.forEach((d) => d()));

const menuItems = computed(() => buildHeaderMenu(
  { canCalculate: isHydrated.value && authStore.canCalculate },
  { protocolOpen: showProtocol.value },
));

// Навигация слева — пункты без placement, справа иконками — `placement: 'end'`; в выдвижном меню — все
const navItems = computed(() => menuItems.value.filter((item) => item.placement !== 'end'));
const endItems = computed(() => menuItems.value.filter((item) => item.placement === 'end'));

// Инициалы в аватаре: «Анна Демидова» → «АД», «admin» → «AD»; без входа — значок
const userInitials = computed(() => {
  if (!isHydrated.value || !authStore.isAuthenticated) return '';
  const name = String(authStore.displayName || authStore.username || '').trim();
  const words = name.split(/[\s._-]+/).filter(Boolean);
  if (!words.length) return '';
  const letters = words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2);
  return letters.toUpperCase();
});

const isItemActive = (item: HeaderMenuItem): boolean => {
  switch (item.action?.kind) {
    case 'route': return route.path === item.action.to;
    case 'calculation': return showCalculationModal.value;
    case 'protocol': return showProtocol.value;
    case 'tools': return uiStore.toolsPanelOpen;
    default: return false;
  }
};

const exportBusy = computed(() => exportingShp.value || exportingDxf.value || exportingGeoJson.value);
// прогресс фоновой выгрузки DXF (file-job): «Формирование файла… 7 с»
const exportProgress = ref('');

const isItemBusy = (item: HeaderMenuItem) => item.id === 'export' && exportBusy.value;

// Пока идёт выгрузка, пункты экспорта заблокированы: без параллельных повторных выгрузок (QA F77)
const isChildBusy = (child: HeaderMenuItem) => child.action?.kind === 'export' && exportBusy.value;
const childSubtitle = (child: HeaderMenuItem) =>
  child.action?.kind === 'export' && child.action.format === 'dxf' && exportingDxf.value && exportProgress.value
    ? exportProgress.value
    : child.subtitle;

const saveBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

/** Итог выгрузки сети: предупреждение, если упёрлись в предел объектов (QA F84) */
const notifyNetworkExport = (format: string, fragmentIds: number[], meta: NetworkExportMeta | undefined) => {
  const truncation = describeNetworkExportTruncation(format, meta);
  if (truncation) useNotificationStore().showWarning(truncation);
  else useNotificationStore().showSuccess(`Экспорт ${format} (фрагменты: ${fragmentIds.join(', ')})`);
};

const runMenuAction = (item: HeaderMenuItem) => {
  const action = item.action;
  if (!action) return;
  switch (action.kind) {
    case 'route': return; // пунктов-переходов в шапке нет (страница одна); вид действия оставлен для меню
    case 'calculation': showCalculationModal.value = true; return;
    case 'protocol': showProtocol.value = !showProtocol.value; return;
    case 'tools': uiStore.toggleToolsPanel(); return;
    case 'export':
      if (exportBusy.value) {
        useNotificationStore().showInfo('Выгрузка уже идёт — дождитесь её окончания');
        return;
      }
      if (isNetworkFileFormat(action.format)) void downloadNetworkFile(action.format);
      else if (action.format === 'dxf') void downloadDxf();
      else void downloadGeoJson(action.format === 'geojson-attrs');
      return;
    case 'excel': void downloadExcel(action.docType); return;
  }
};

const onDrawerItem = (item: HeaderMenuItem) => {
  mainMenuOpen.value = false;
  runMenuAction(item);
};

// Протокол — ленивый чанк: пока он грузится, строки лога и id протоколов копятся и отдаются после монтирования
const pendingProtocolLogs: any[] = [];
let pendingProtocolIds: number[] | null = null;
watch(protocolRef, (panel) => {
  if (!panel) return;
  for (const log of pendingProtocolLogs.splice(0)) panel.addLog(log);
  if (pendingProtocolIds) {
    const ids = pendingProtocolIds;
    pendingProtocolIds = null;
    void panel.loadProtocols(ids, { keepPrevious: true });
  }
});

const onCalculationLog = (log: any) => {
  if (protocolRef.value) protocolRef.value.addLog(log);
  else pendingProtocolLogs.push(log);
};

/** Расчёт сохранил протоколы — панель переходит к анализу (сравнение с прошлым запуском тех же фрагментов) */
const onProtocolReady = (ids: number[]) => {
  showProtocol.value = true;
  if (protocolRef.value) void protocolRef.value.loadProtocols(ids, { keepPrevious: true });
  else pendingProtocolIds = ids;
};

const resolveExportFragmentIds = (): number[] | undefined => {
  const fragmentStore = useFragmentStore();
  if (fragmentStore.selectedFragmentId != null) return [fragmentStore.selectedFragmentId];
  if (fragmentStore.visibleFragments.length) return [...fragmentStore.visibleFragments];
  return undefined;
};

const NETWORK_FILE_LABELS: Record<NetworkFileFormat, string> = { gpkg: 'GeoPackage', fgb: 'FlatGeobuf', shp: 'SHP' };
const isNetworkFileFormat = (format: string): format is NetworkFileFormat =>
  (NETWORK_FILE_FORMATS as readonly string[]).includes(format);

/** Сеть фрагментов файлом ГИС (узлы и участки): GeoPackage, FlatGeobuf, SHP — /api/export/network */
const downloadNetworkFile = async (format: NetworkFileFormat) => {
  const label = NETWORK_FILE_LABELS[format];
  exportingShp.value = true;
  try {
    const fragmentIds = resolveExportFragmentIds();
    if (!fragmentIds?.length) {
      useNotificationStore().showError(`Выберите фрагмент на карте перед экспортом ${label}`);
      return;
    }
    const { blob, filename, meta } = await fastApiService.downloadNetworkExport(format, fragmentIds);
    saveBlob(blob, filename);
    notifyNetworkExport(label, fragmentIds, meta);
  } catch (err: any) {
    useNotificationStore().showError(formatApiErrorWith(`Ошибка экспорта ${label}`, err));
  } finally {
    exportingShp.value = false;
  }
};

const downloadDxf = async () => {
  exportingDxf.value = true;
  try {
    const fragmentIds = resolveExportFragmentIds();
    if (!fragmentIds?.length) {
      useNotificationStore().showError('Выберите фрагмент на карте перед экспортом DXF');
      return;
    }
    useNotificationStore().showInfo('DXF: формирование файла, это может занять до минуты…');
    exportProgress.value = 'Формирование файла…';
    const { blob, filename, meta } = await fastApiService.downloadDxfExport(fragmentIds, {
      onProgress: (p) => { exportProgress.value = describeFileJobProgress(p); },
    });
    saveBlob(blob, filename);
    notifyNetworkExport('DXF', fragmentIds, meta);
  } catch (err: any) {
    useNotificationStore().showError(formatApiErrorWith('Ошибка экспорта DXF', err));
  } finally {
    exportingDxf.value = false;
    exportProgress.value = '';
  }
};

const downloadGeoJson = async (withAttrs: boolean) => {
  exportingGeoJson.value = true;
  try {
    const fragmentIds = resolveExportFragmentIds();
    if (!fragmentIds?.length) {
      useNotificationStore().showError('Выберите фрагмент на карте перед экспортом GeoJSON');
      return;
    }
    const { blob, filename, meta } = await fastApiService.downloadGeoJsonExport(fragmentIds, withAttrs);
    saveBlob(blob, filename);
    notifyNetworkExport(`GeoJSON${withAttrs ? ' с атрибутами' : ''}`, fragmentIds, meta);
  } catch (err: any) {
    useNotificationStore().showError(formatApiErrorWith('Ошибка экспорта GeoJSON', err));
  } finally {
    exportingGeoJson.value = false;
  }
};

// Ведомость по выбранным фрагментам (как экспорт SHP/GeoJSON); без выбора — по всей сети
const downloadExcel = async (docType: string) => {
  try {
    const fragmentIds = resolveExportFragmentIds();
    const { blob, filename, meta } = await fastApiService.downloadExcelReport(docType, undefined, {}, fragmentIds);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url)
    const scope = fragmentIds?.length ? ` (фрагменты: ${fragmentIds.join(', ')})` : ' (вся сеть)';
    const truncation = describeExcelReportTruncation(meta);
    if (truncation) useNotificationStore().showWarning(`Ведомость ${docType.toUpperCase()}${scope}: ${truncation}`);
    else useNotificationStore().showSuccess(`Ведомость ${docType.toUpperCase()}${scope} скачана`);
  } catch (err: any) {
    useNotificationStore().showError(formatApiErrorWith('Ошибка скачивания ведомости', err));
  }
};
</script>

<style scoped>
/* Стекло уровня 1 поверх карты: на время движения карты .map-moving делает его плотным (_tokens.scss) */
.app-header {
  background: var(--glass-1-bg) !important;
  -webkit-backdrop-filter: var(--glass-1-filter);
  backdrop-filter: var(--glass-1-filter);
  box-shadow: var(--shadow-1) !important;
}

/* Поле-кнопка поиска: выглядит как поле ввода (аффорданс), хоткей виден сразу */
.header-search {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  width: 280px;
  height: 32px;
  padding: 0 6px 0 10px;
  border-radius: var(--radius-sm);
  background: rgba(var(--shadow-ink), 0.05);
  /* не --text-faint: шапка полупрозрачная, над тёмной подложкой контраст faint падает ниже 4,5:1 */
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-out);
}
.header-search:hover {
  background: rgba(var(--shadow-ink), 0.09);
}
.header-search:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}
.header-search .v-icon {
  color: var(--text-muted);
}
.header-search__text {
  flex: 1;
  min-width: 0;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.header-search__kbd {
  font-family: inherit;
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  color: var(--text-muted);
  background: rgb(var(--v-theme-surface));
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  padding: 3px 5px;
}
/* Палец: зона нажатия не меньше --touch-target (у v-btn это делает _device.scss, здесь — нативная кнопка) */
@media (pointer: coarse) {
  .header-search {
    position: relative;
  }
  .header-search::before {
    content: '';
    position: absolute;
    inset: calc((32px - var(--touch-target, 44px)) / 2) 0;
  }
}
/* Узкая шапка: от поля остаётся лупа */
@media (max-width: 1279px) {
  .header-search {
    width: 40px;
    justify-content: center;
    padding: 0;
    background: transparent;
  }
  .header-search__text,
  .header-search__kbd {
    display: none;
  }
}

/* Иконки справа — 40 × 40, без подложки, серые; активная — подложка */
.header-icon-btn {
  width: 40px !important;
  height: 40px !important;
  border-radius: var(--radius-sm) !important;
  color: var(--text-muted);
}
.user-avatar {
  background: var(--surface-pressed);
  color: var(--text-strong);
}
.user-avatar__initials {
  font-size: 11px;
  font-weight: 600;
}

.api-health-alert {
  position: fixed;
  /* на линии строки режимов: под шапкой, на телефоне — под угловыми кнопками */
  top: calc(var(--shell-top) + var(--modes-offset));
  left: 50%;
  transform: translateX(-50%);
  z-index: var(--z-popover); /* над картой и карточкой, под диалогами */
  max-width: min(760px, calc(100vw - 32px));
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
}

.app-brand {
  user-select: none;
}
.app-context {
  flex: 0 0 auto; /* не сжимается: иначе flex прятал город, оставляя одну роль */
  height: 26px;
  padding: 0 10px 0 6px;
  border-radius: 13px;
  background: var(--surface-hover);
  font-size: var(--text-xs);
  color: var(--text-muted);
  white-space: nowrap;
}
.app-context__city {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.app-context__role {
  margin-left: 4px;
}
.brand-title {
  font-weight: 600;
  font-size: 15px;
  color: var(--text-strong);
}
.brand-subtitle {
  font-weight: 400;
  font-size: 15px;
  color: var(--text-muted);
  margin-left: 4px;
}
.nav-links {
  gap: 2px;
}
.nav-btn {
  padding: 0 10px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-strong);
}
.nav-btn :deep(.v-btn__prepend),
.nav-btn :deep(.v-btn__append) {
  color: var(--text-muted);
}
.nav-btn :deep(.v-icon) {
  font-size: 18px;
}
.active-link :deep(.v-btn__prepend) {
  color: rgb(var(--v-theme-primary));
}
.app-main {
  min-height: calc(100vh - var(--shell-top));
  min-height: calc(100dvh - var(--shell-top));
  /* Шапка есть всегда, а Vuetify считает --v-layout-top только после монтирования: в серверном HTML он 0, и экран
     загрузки уходил под шапку с полосой снизу. Высота шапки — токен --shell-top (карта продлевается под стекло сама,
     MapViewer.vue .map-canvas-host) */
  padding-top: max(var(--v-layout-top, 0px), var(--shell-top));
}
.login-required-backdrop {
  min-height: calc(100vh - var(--shell-top));
  min-height: calc(100dvh - var(--shell-top));
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at 20% 20%, rgb(var(--v-theme-primary), 0.10), transparent 45%),
    radial-gradient(circle at 80% 85%, rgb(var(--v-theme-primary), 0.08), transparent 40%),
    rgb(var(--v-theme-surface));
}
/* Шапка меню на телефоне: знак, город и роль */
.main-menu-head {
  padding: var(--space-4) var(--space-4) var(--space-3);
  border-bottom: 1px solid var(--border-subtle);
}
.main-menu-head__context {
  margin-top: var(--space-1);
  font-size: 12px;
  line-height: 16px;
  color: var(--text-faint);
}

/* Телефон (< 960, = HEADER_NAV_MIN_WIDTH и utils/breakpoints md): полосы шапки нет — её кнопки плавают в углах
   белыми плашками (--corner-btn), карта на весь экран (--shell-top: 0). Сама полоса прозрачна для пальца */
@media (max-width: 959.98px) {
  .app-header {
    background: transparent !important;
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
    box-shadow: none !important;
    overflow: visible;
    pointer-events: none;
  }
  .app-header :deep(.v-toolbar__content) {
    align-items: flex-start;
    gap: var(--shell-gap);
    /* вырез экрана уже учтён отступами самой полосы (assets/styles/_device.scss) */
    padding: var(--shell-inset) var(--shell-inset) 0;
    overflow: visible;
  }
  /* бренд, город и «Инструменты» — в меню; разделы там же */
  .app-brand,
  .app-context,
  .nav-links,
  .header-end-btn {
    display: none !important;
  }
  .corner-btn {
    pointer-events: auto;
    width: var(--corner-btn) !important;
    min-width: var(--corner-btn) !important;
    height: var(--corner-btn) !important;
    margin: 0 !important;
    padding: 0 !important;
    border-radius: var(--radius-md) !important;
    background: rgb(var(--v-theme-surface)) !important;
    box-shadow: var(--shadow-2);
    color: var(--text-muted);
  }
  .corner-btn--menu {
    width: auto !important;
    padding: 0 var(--space-2) 0 var(--space-3) !important;
  }
  .corner-btn--menu :deep(.v-btn__content) {
    gap: 2px;
  }
  .corner-btn__chevron {
    color: var(--text-muted);
  }
  .header-search::before {
    display: none;
  }
  /* меню и «Инструменты» выезжают поверх углов: угловые кнопки (Vuetify держит полосу выше drawer'ов) прячутся */
  .app-header--covered {
    visibility: hidden;
  }
  /* Меню выезжает от верха экрана: полосы, под которую Vuetify его ставит, на телефоне нет */
  .main-menu-drawer {
    top: 0 !important;
    height: 100% !important;
  }
  .app-main {
    padding-top: 0;
  }
}
</style>
