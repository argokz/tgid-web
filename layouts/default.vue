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

      <!-- Логотип -->
      <div class="app-brand d-flex align-center" :class="mobile ? 'ms-1 me-2' : 'ms-3 me-4'">
        <v-icon size="26" color="primary" class="brand-icon">mdi-layers</v-icon>
        <span class="brand-title ms-2">ITwin</span>
        <span class="brand-subtitle">Map</span>
      </div>

      <!-- Навигация (десктоп) -->
      <nav v-if="!mobile" class="nav-links d-flex align-center">
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

        <v-btn
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
      </nav>

      <v-spacer />

      <!-- Меню пользователя -->
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
            class="me-2 user-menu-btn"
            aria-label="Меню пользователя"
          >
            <v-avatar size="32" color="primary" class="user-avatar">
              <v-icon size="20">mdi-account</v-icon>
            </v-avatar>
          </v-btn>
        </template>

        <v-card min-width="220" elevation="8" rounded="xl" class="user-dropdown mt-1">
          <!-- Шапка пользователя -->
          <div class="user-dropdown__header pa-4 pb-3">
            <div class="d-flex align-center" style="gap: 12px;">
              <v-avatar size="42" color="primary" class="user-avatar">
                <v-icon size="22">mdi-account</v-icon>
              </v-avatar>
              <div>
                <div class="text-body-2 font-weight-semibold">Пользователь</div>
                <div class="text-caption text-medium-emphasis">ITwin Map</div>
              </div>
            </div>
          </div>

          <v-divider />

          <v-list density="compact" nav class="pa-2">
            <v-list-item
              prepend-icon="mdi-account-circle-outline"
              title="Профиль"
              rounded="lg"
              class="user-menu-item"
            />
            <v-list-item
              prepend-icon="mdi-cog-outline"
              title="Настройки"
              rounded="lg"
              class="user-menu-item"
            />
          </v-list>

          <v-divider class="mx-3" />

          <v-list density="compact" nav class="pa-2">
            <v-list-item
              prepend-icon="mdi-logout"
              title="Выйти"
              rounded="lg"
              class="user-menu-item user-menu-item--danger"
            />
          </v-list>
        </v-card>
      </v-menu>
    </v-app-bar>

    <!-- Навигация: выдвижная панель на мобильных -->
    <v-navigation-drawer
      v-model="mainMenuOpen"
      location="start"
      temporary
      width="300"
      class="main-nav-drawer"
    >
      <v-list nav density="comfortable" class="pt-2">
        <v-list-subheader class="text-uppercase text-caption font-weight-bold">
          Меню
        </v-list-subheader>
        <v-list-item
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          :prepend-icon="link.icon"
          :title="link.text"
          :active="isActive(link.to)"
          rounded="lg"
          @click="mainMenuOpen = false"
        />
        <v-list-item
          prepend-icon="mdi-calculator-variant"
          title="Расчет"
          rounded="lg"
          :active="showCalculationModal"
          @click="onDrawerOpenCalculation"
        />
        <v-list-item
          :prepend-icon="showProtocol ? 'mdi-console' : 'mdi-console-line'"
          :title="showProtocol ? 'Скрыть протокол' : 'Протокол'"
          rounded="lg"
          :active="showProtocol"
          @click="onDrawerToggleProtocol"
        />
      </v-list>
    </v-navigation-drawer>

    <!-- Контент страницы: фиксированная min-height под app-bar — меньше CLS от v-container при гидрации -->
    <v-main tag="main">
      <v-container class="pa-0 layout-content-root" fluid>
        <slot />
        <!-- Протокол расчета -->
        <CalculationProtocol
          v-if="showProtocol"
          ref="protocolRef"
          :show="showProtocol"
          @update:show="showProtocol = $event"
          @open-calculation="showCalculationModal = true"
        />
      </v-container>
    </v-main>

    <!-- Модальное окно расчета -->
    <PlanningCalculationModal
      v-if="showCalculationModal"
      v-model="showCalculationModal"
      @calculate="handleCalculate"
      @protocol-log="handleProtocolLog"
      @show-protocol="showProtocol = $event"
    />

    <!-- Глобальные уведомления -->
    <v-snackbar
      v-model="notificationStore.show"
      :color="notificationStore.type"
      location="bottom"
      multi-line
      timeout="5000"
    >
      {{ notificationStore.message }}
    </v-snackbar>
  </v-app>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router';
import { defineAsyncComponent, ref } from 'vue';
import { useDisplay } from 'vuetify';
import { useNotificationStore } from '~/stores/notificationStore';

const PlanningCalculationModal = defineAsyncComponent(() => import('~/components/PlanningCalculationModal.vue'));
const CalculationProtocol = defineAsyncComponent(() => import('~/components/CalculationProtocol.vue'));

interface NavLink {
  text: string;
  to: string;
  icon: string;
}

const links: NavLink[] = [
  { text: 'Главная', to: '/', icon: 'mdi-home-outline' },
];

const route = useRoute();
const isActive = (path: string) => route.path === path;

const { mobile } = useDisplay();
const mainMenuOpen = ref(false);

const notificationStore = useNotificationStore();

const showCalculationModal = ref(false);
const showProtocol = ref(false);
const protocolRef = ref();

const onDrawerOpenCalculation = () => {
  mainMenuOpen.value = false;
  showCalculationModal.value = true;
};

const onDrawerToggleProtocol = () => {
  showProtocol.value = !showProtocol.value;
  mainMenuOpen.value = false;
};

const handleCalculate = () => {
  showProtocol.value = true;
};

const handleProtocolLog = (log: { timestamp: string; message: string; type: string }) => {
  protocolRef.value?.addLog(log);
};
</script>

<style scoped>
/* Одна высота с первого кадра (v-app-bar = 56px), без flex-схлопывания → меньше CLS Lighthouse */
.layout-content-root {
  display: block;
  width: 100%;
  box-sizing: border-box;
  /* Только min-height: не конкурируем с внутренней геометрией v-main (padding под app-bar) */
  min-height: calc(100svh - 56px);
}

.app-brand {
  user-select: none;
  text-decoration: none;
}

.brand-icon {
  flex-shrink: 0;
}

.brand-title {
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: -0.3px;
  color: #1565c0;
  line-height: 1;
}

.brand-subtitle {
  font-weight: 300;
  font-size: 1.1rem;
  color: #546e7a;
  line-height: 1;
  margin-left: 1px;
}

.nav-links {
  gap: 2px;
}

.nav-btn {
  font-size: 0.8125rem;
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0;
  color: #546e7a;
}

.nav-btn:hover {
  color: #1565c0;
}

/* Иконка в активной nav-кнопке синяя (SVG fill:currentColor) */
.nav-btn.active-link :deep(svg),
.nav-btn.active-link :deep(path) {
  fill: #1565c0;
  color: #1565c0;
}

.active-link {
  position: relative;
}

.active-link::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 60%;
  height: 2px;
  background-color: #1565c0;
  border-radius: 2px 2px 0 0;
}

/* ── Аватар пользователя — белая иконка через CSS (SVG fill:currentColor) ── */
.user-avatar :deep(svg),
.user-avatar :deep(path) {
  fill: white;
  color: white;
}

/* ── Выпадающее меню пользователя ── */
.user-dropdown {
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.14) !important;
  overflow: hidden;
}

.user-dropdown__header {
  background: linear-gradient(135deg, #1565c0 0%, #1976d2 100%);
  color: white;
}

.user-dropdown__header :deep(.text-medium-emphasis) {
  color: rgba(255, 255, 255, 0.75) !important;
}

/* Иконка аватара в шапке dropdown тоже белая */
.user-dropdown__header .user-avatar :deep(svg),
.user-dropdown__header .user-avatar :deep(path) {
  fill: white;
  color: white;
}

.user-menu-item {
  transition: background 0.15s, color 0.15s;
  border-radius: 8px !important;
  margin-bottom: 2px;
}

.user-menu-item:hover {
  background: rgba(21, 101, 192, 0.07) !important;
}

.user-menu-item--danger :deep(.v-list-item__prepend .v-icon),
.user-menu-item--danger :deep(.v-list-item-title) {
  color: #e53935 !important;
}

.user-menu-item--danger:hover {
  background: rgba(229, 57, 53, 0.07) !important;
}
</style>
