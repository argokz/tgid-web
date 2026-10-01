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
        v-if="mobile"
        icon
        variant="text"
        class="ms-1"
        aria-label="Открыть меню"
        @click="mainMenuOpen = true"
      >
        <v-icon>mdi-menu</v-icon>
      </v-btn>

      <!-- Брендинг -->
      <div
        class="app-brand d-flex align-center"
        :class="mobile ? 'ms-1 me-2' : 'ms-3 me-4'"
      >
        <v-icon
          size="26"
          color="primary"
          class="brand-icon"
        >mdi-layers</v-icon>
        <span class="brand-title ms-2">ITwin</span>
        <span class="brand-subtitle">Map</span>
      </div>

      <!-- Навигация (десктоп) -->
      <nav
        v-if="!mobile"
        class="nav-links d-flex align-center"
      >
        <v-btn
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          :prepend-icon="link.icon"
          :color="isActive(link.to) ? 'primary' : undefined"
          :class="['nav-btn', { 'active-link': isActive(link.to) }]"
          variant="text"
          rounded="lg"
          size="small"
        >
          {{ link.text }}
        </v-btn>

        <!-- Запуск расчёта sety: роль calculator+ (сервер проверяет то же) -->
        <v-btn
          v-if="isHydrated && authStore.canCalculate"
          prepend-icon="mdi-calculator-variant"
          :color="showCalculationModal ? 'primary' : undefined"
          :class="['nav-btn', 'ms-1', { 'active-link': showCalculationModal }]"
          variant="text"
          rounded="lg"
          size="small"
          @click="showCalculationModal = true"
        >
          Расчет
        </v-btn>

        <v-btn
          prepend-icon="mdi-console-line"
          :color="showProtocol ? 'primary' : undefined"
          :class="['nav-btn', 'ms-1', { 'active-link': showProtocol }]"
          variant="text"
          rounded="lg"
          size="small"
          @click="showProtocol = !showProtocol"
        >
          {{ showProtocol ? 'Скрыть протокол' : 'Протокол' }}
        </v-btn>

        <v-btn
          prepend-icon="mdi-toolbox-outline"
          :color="uiStore.toolsPanelOpen ? 'primary' : undefined"
          :class="['nav-btn', 'ms-1', { 'active-link': uiStore.toolsPanelOpen }]"
          variant="text"
          rounded="lg"
          size="small"
          @click="uiStore.toggleToolsPanel()"
        >
          Инструменты
        </v-btn>

        <v-menu offset-y>
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              prepend-icon="mdi-export"
              class="nav-btn ms-1"
              variant="text"
              rounded="lg"
              size="small"
              :loading="exportingShp || exportingDxf || exportingGeoJson"
            >
              Экспорт
            </v-btn>
          </template>
          <v-list density="compact">
            <v-list-item
              title="SHP (узлы и участки, zip)"
              prepend-icon="mdi-export"
              @click="downloadShp"
            />
            <v-list-item
              title="DXF (линии участков)"
              prepend-icon="mdi-vector-polyline"
              @click="downloadDxf"
            />
            <v-list-item
              title="GeoJSON (геометрия и паспорт)"
              prepend-icon="mdi-code-json"
              @click="downloadGeoJson(false)"
            />
            <v-list-item
              title="GeoJSON с атрибутами (L, D, K_E)"
              subtitle="Для ZuluGIS/QGIS: короткие имена полей"
              prepend-icon="mdi-code-json"
              @click="downloadGeoJson(true)"
            />
          </v-list>
        </v-menu>

        <v-menu offset-y>
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              prepend-icon="mdi-file-excel"
              class="nav-btn ms-1"
              variant="text"
              rounded="lg"
              size="small"
            >
              Ведомости Excel
            </v-btn>
          </template>
          <v-list density="compact">
            <v-list-item
              title="Участки теплопроводов"
              prepend-icon="mdi-pipe"
              @click="downloadExcel('ut')"
            />
            <v-list-item
              title="Задвижки и арматура"
              prepend-icon="mdi-valve"
              @click="downloadExcel('zd')"
            />
            <v-list-item
              title="Байпасы"
              prepend-icon="mdi-dip-switch"
              @click="downloadExcel('bp')"
            />
            <v-list-item
              title="Насосные агрегаты"
              prepend-icon="mdi-water-pump"
              @click="downloadExcel('ns')"
            />
            <v-list-item
              title="Потребители"
              prepend-icon="mdi-home-city"
              @click="downloadExcel('pt')"
            />
            <v-list-item
              title="Технические условия"
              prepend-icon="mdi-file-certificate-outline"
              @click="downloadExcel('tu')"
            />
          </v-list>
        </v-menu>
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
import { ref, computed, onMounted, watch } from 'vue';
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
import { ROLE_LABELS, type Role } from '~/utils/permissions';

const { isMobile } = useMobile();
// SSR не знает ширину окна и рендерит десктопную шапку; до монтирования клиент
// обязан отрисовать то же самое, иначе гидратация расходится (кнопка меню,
// классы брендинга, кнопки навигации). Мобильная раскладка и кнопки по роли
// (роль/флаги сервера приходят из localStorage и /auth/config) — только после mount.
const isHydrated = ref(false);
const mobile = computed(() => isHydrated.value && isMobile.value);
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

const links = [
  { text: 'Карта', to: '/', icon: 'mdi-map' }
];

const isActive = (to: string) => route.path === to;

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
    useNotificationStore().showError('Ошибка экспорта SHP: ' + err.message);
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
    useNotificationStore().showError('Ошибка экспорта DXF: ' + err.message);
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
    useNotificationStore().showError('Ошибка экспорта GeoJSON: ' + err.message);
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
    useNotificationStore().showError('Ошибка скачивания ведомости: ' + err.message);
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
