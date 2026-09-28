import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import vuetify from 'vite-plugin-vuetify';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // .vue для компонентных тестов (tests/components); Vuetify — автоимпорт, как в nuxt.config
  plugins: [vue(), vuetify({ autoImport: true })],
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['tests/**/*.spec.ts'],
    server: { deps: { inline: ['vuetify'] } },
    coverage: {
      reporter: ['text', 'html'],
    },
  },
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
});
