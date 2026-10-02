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
      <v-btn
        v-if="navCollapsed"
        icon
        variant="text"
        class="ms-1"
        aria-label="Открыть меню"
        :aria-expanded="mainMenuOpen"
        @click="mainMenuOpen = !mainMenuOpen"
      >
        <v-icon>mdi-menu</v-icon>
      </v-btn>

      <!-- Брендинг -->
      <div
        class="app-brand d-flex align-center"
        :class="navCollapsed ? 'ms-1 me-2' : 'ms-3 me-4'"
      >
        <v-icon
          size="26"
          color="primary"
          class="brand-icon"
        >mdi-layers</v-icon>
        <span class="brand-title ms-2">ITwin</span>
        <span class="brand-subtitle">Map</span>
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
                :subtitle="child.subtitle"
                :prepend-icon="child.icon"
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

      <!-- Пользователь -->
      <v-menu
        location="bottom end"
        :close-on-content-click="true"
        transition="scale-transition"
      >
        <template #activator="{ props: menuProps }">
          <v-btn
            v-bind="menuProps"
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
              :title="authStore.username"
              :subtitle="roleLabel"
              prepend-icon="mdi-account-check"
            />
            <v-list-item
              v-else
              prepend-icon="mdi-login"
              title="Войти"
              @click="showLogin = true"
            />
            <v-list-item
              prepend-icon="mdi-account-outline"
              title="Профиль"
              disabled
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
              @click="authStore.logout()"
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
            <template #activator="{ props }">
              <v-list-item
                v-bind="props"
                :prepend-icon="item.icon"
                :title="item.title"
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
              :subtitle="child.subtitle"
              :prepend-icon="child.icon"
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

    <v-main class="app-main">
      <slot />
    </v-main>

    <LoginDialog v-model="showLogin" />
    <ConfirmDialogHost />

    <!-- Модальное окно расчета -->
    <PlanningCalculationModal
      v-if="isHydrated && authStore.canCalculate"
      v-model="showCalculationModal"
      @protocol-log="onCalculationLog"
      @show-protocol="showProtocol = $event"
    />

    <!-- Окно протокола -->
    <CalculationProtocol
      ref="protocolRef"
      v-model:show="showProtocol"
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
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          aria-label="Закрыть"
          @click="notificationStore.hide()"
        />
      </template>
    </v-snackbar>
  </v-app>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useMobile } from '~/composables/useMobile';
import { apiHealth, describeExcelReportTruncation, fastApiService, refreshApiHealth } from '~/services/fastApiService';
import { useNotificationStore } from '~/stores/notificationStore';
import { useAuthStore } from '~/stores/authStore';
import { useFragmentStore } from '~/stores/fragmentStore';
import { useUiStore } from '~/stores/uiStore';
import PlanningCalculationModal from '~/components/PlanningCalculationModal.vue';
import CalculationProtocol from '~/components/CalculationProtocol.vue';
import LoginDialog from '~/components/LoginDialog.vue';
import ConfirmDialogHost from '~/components/ConfirmDialogHost.vue';
import { formatApiErrorWith } from '~/utils/apiError';
import { ROLE_LABELS, type Role } from '~/utils/permissions';
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
const notificationStore = useNotificationStore();
const uiStore = useUiStore();
const mainMenuOpen = ref(false);
const showLogin = ref(false);
const showCalculationModal = ref(false);
const showProtocol = ref(false);
const exportingShp = ref(false);
const exportingDxf = ref(false);
const exportingGeoJson = ref(false);
const protocolRef = ref<{ addLog: (log: any) => void } | null>(null);

onMounted(() => {
  isHydrated.value = true;
  authStore.hydrate();
  void refreshApiHealth();
});

const roleLabel = computed(() => ROLE_LABELS[authStore.role as Role] || authStore.role || 'пользователь');

// Роль понизили или вышли из учётной записи — окно расчёта закрывается
watch(() => authStore.canCalculate, (allowed) => {
  if (!allowed) showCalculationModal.value = false;
});

// Экран расширили — меню гамбургера больше не нужно
watch(navCollapsed, (collapsed) => {
  if (!collapsed) mainMenuOpen.value = false;
});

// Временный v-navigation-drawer сам по Esc не закрывается
const onMenuKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') mainMenuOpen.value = false;
};
watch(mainMenuOpen, (open) => {
  if (open) window.addEventListener('keydown', onMenuKeydown);
  else window.removeEventListener('keydown', onMenuKeydown);
});
onBeforeUnmount(() => window.removeEventListener('keydown', onMenuKeydown));

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

const isItemBusy = (item: HeaderMenuItem) =>
  item.id === 'export' && (exportingShp.value || exportingDxf.value || exportingGeoJson.value);

const runMenuAction = (item: HeaderMenuItem) => {
  const action = item.action;
  if (!action) return;
  switch (action.kind) {
    case 'route': return; // переход делает :to
    case 'calculation': showCalculationModal.value = true; return;
    case 'protocol': showProtocol.value = !showProtocol.value; return;
    case 'tools': uiStore.toggleToolsPanel(); return;
    case 'export':
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

const onCalculationLog = (log: any) => {
  if (protocolRef.value) {
    protocolRef.value.addLog(log);
  }
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
    const { blob, filename } = await fastApiService.downloadShpExport(fragmentIds);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    useNotificationStore().showSuccess(`Экспорт SHP (фрагменты: ${fragmentIds.join(', ')})`);
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
    const { blob, filename } = await fastApiService.downloadDxfExport(fragmentIds);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    useNotificationStore().showSuccess(`Экспорт DXF (фрагменты: ${fragmentIds.join(', ')})`);
  } catch (err: any) {
    useNotificationStore().showError(formatApiErrorWith('Ошибка экспорта DXF', err));
  } finally {
    exportingDxf.value = false;
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
    const { blob, filename } = await fastApiService.downloadGeoJsonExport(fragmentIds, withAttrs);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    useNotificationStore().showSuccess(
      `Экспорт GeoJSON${withAttrs ? ' с атрибутами' : ''} (фрагменты: ${fragmentIds.join(', ')})`
    );
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
  z-index: 2000;
  max-width: min(760px, calc(100vw - 32px));
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
}

.app-brand {
  user-select: none;
}
.brand-title {
  font-weight: 700;
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
}
</style>
