<template>
  <v-app>
    <v-app-bar
      app
      color="surface"
      elevation="0"
      height="56"
      border="b"
      tag="header"
    >
      <HintTip
        v-if="navCollapsed"
        text="Открыть главное меню"
      >
        <template #default="{ props: tip }">
          <v-btn
            v-bind="tip"
            icon
            variant="text"
            class="ms-1"
            aria-label="Открыть меню"
            :aria-expanded="mainMenuOpen"
            @click="mainMenuOpen = !mainMenuOpen"
          >
            <v-icon>mdi-menu</v-icon>
          </v-btn>
        </template>
      </HintTip>

      <!-- Брендинг -->
      <div
        class="app-brand d-flex align-center"
        :class="navCollapsed ? 'ms-1 me-2' : 'ms-3 me-4'"
      >
        <AppLogo
          size="26"
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
      >
        <template
          v-for="(item, index) in menuItems"
          :key="item.id"
        >
          <v-menu
            v-if="item.children"
            offset-y
          >
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                :prepend-icon="item.icon"
                :class="['nav-btn', { 'ms-1': index > 0 }]"
                variant="text"
                rounded="lg"
                size="small"
                :loading="isItemBusy(item)"
              >
                {{ item.title }}
              </v-btn>
            </template>
            <v-list density="compact">
              <v-list-item
                v-for="child in item.children"
                :key="child.id"
                :title="child.title"
                :subtitle="childSubtitle(child)"
                :prepend-icon="child.icon"
                :disabled="isChildBusy(child)"
                @click="runMenuAction(child)"
              />
            </v-list>
          </v-menu>
          <v-btn
            v-else
            :to="routeOf(item)"
            :prepend-icon="item.icon"
            :color="isItemActive(item) ? 'primary' : undefined"
            :class="['nav-btn', { 'ms-1': index > 0, 'active-link': isItemActive(item) }]"
            variant="text"
            rounded="lg"
            size="small"
            @click="runMenuAction(item)"
          >
            {{ item.title }}
          </v-btn>
        </template>
      </nav>

      <v-spacer />

      <!-- Палитра команд: журналы, инструменты, узлы, адреса (после входа: поиск узлов идёт в GeoServer) -->
      <HintTip
        v-if="paletteAvailable"
        text="Команды и поиск"
        hotkey="Ctrl+K"
        hint="Журналы, инструменты, узлы сети и адреса"
        location="bottom"
      >
        <template #default="{ props: tip }">
          <v-btn
            v-bind="tip"
            icon
            variant="text"
            size="small"
            class="me-1"
            data-first-run="palette"
            aria-label="Команды и поиск (Ctrl+K)"
            @click="paletteOpen = true"
          >
            <v-icon size="22">mdi-magnify</v-icon>
          </v-btn>
        </template>
      </HintTip>

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
                class="user-avatar-btn me-2"
                aria-label="Меню пользователя"
              >
                <v-avatar
                  size="34"
                  color="primary"
                >
                  <v-icon
                    color="white"
                    size="20"
                  >mdi-account</v-icon>
                </v-avatar>
              </v-btn>
            </template>
          </HintTip>
        </template>
        <v-card
          min-width="240"
          rounded="lg"
          elevation="4"
        >
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
      v-model="mainMenuOpen"
      temporary
      location="left"
      width="300"
      class="main-menu-drawer"
      aria-label="Главное меню"
    >
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
            <v-list-item
              v-for="child in item.children"
              :key="child.id"
              :title="child.title"
              :subtitle="childSubtitle(child)"
              :prepend-icon="child.icon"
              :disabled="isChildBusy(child)"
              @click="onDrawerItem(child)"
            />
          </v-list-group>
          <v-list-item
            v-else
            :to="routeOf(item)"
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
import { ref, reactive, computed, mergeProps, onBeforeUnmount, onMounted, watch } from 'vue';
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
import FirstRunHints from '~/components/FirstRunHints.vue';
import AppLogo from '~/components/AppLogo.vue';
import AppSplash from '~/components/AppSplash.vue';
import { useMapStore } from '~/stores/mapStore';
import { formatApiErrorWith } from '~/utils/apiError';
import { ROLE_LABELS, type Role } from '~/utils/permissions';
import { deviceClass } from '~/utils/breakpoints';
import { buildPageTitle } from '~/utils/pageTitle';
import { buildHeaderMenu, isHeaderNavCollapsed, type HeaderMenuItem } from '~/utils/headerMenu';

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

const routeOf = (item: HeaderMenuItem) => (item.action?.kind === 'route' ? item.action.to : undefined);

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
    case 'route': return; // переход делает :to
    case 'calculation': showCalculationModal.value = true; return;
    case 'protocol': showProtocol.value = !showProtocol.value; return;
    case 'tools': uiStore.toggleToolsPanel(); return;
    case 'export':
      if (exportBusy.value) {
        useNotificationStore().showInfo('Выгрузка уже идёт — дождитесь её окончания');
        return;
      }
      if (action.format === 'shp') void downloadShp();
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

const downloadShp = async () => {
  exportingShp.value = true;
  try {
    const fragmentIds = resolveExportFragmentIds();
    if (!fragmentIds?.length) {
      useNotificationStore().showError('Выберите фрагмент на карте перед экспортом SHP');
      return;
    }
    const { blob, filename, meta } = await fastApiService.downloadShpExport(fragmentIds);
    saveBlob(blob, filename);
    notifyNetworkExport('SHP', fragmentIds, meta);
  } catch (err: any) {
    useNotificationStore().showError(formatApiErrorWith('Ошибка экспорта SHP', err));
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
.api-health-alert {
  position: fixed;
  top: 60px;
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
  font-size: var(--text-xs);
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
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
  font-size: 1.1rem;
  letter-spacing: -0.02em;
}
.brand-subtitle {
  font-weight: 400;
  font-size: 0.85rem;
  opacity: 0.7;
  margin-left: 3px;
}
.nav-links {
  gap: 4px;
}
.nav-btn {
  font-weight: 500;
  letter-spacing: 0.01em;
}
.active-link {
  font-weight: 600;
}
.app-main {
  min-height: calc(100vh - 56px);
  min-height: calc(100dvh - 56px);
  /* Шапка (56 px) есть всегда, а Vuetify считает --v-layout-top только после монтирования: в серверном HTML
     он 0, и экран загрузки уходил под шапку с полосой снизу */
  padding-top: max(var(--v-layout-top, 0px), 56px);
}
.login-required-backdrop {
  min-height: calc(100vh - 56px);
  min-height: calc(100dvh - 56px);
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at 20% 20%, rgb(var(--v-theme-primary), 0.10), transparent 45%),
    radial-gradient(circle at 80% 85%, rgb(var(--v-theme-primary), 0.08), transparent 40%),
    rgb(var(--v-theme-surface));
}
</style>
