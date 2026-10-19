<template>
  <v-dialog
    v-model="open"
    max-width="720"
  >
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon
          start
          size="20"
        >
          mdi-keyboard-outline
        </v-icon>
        Горячие клавиши редактора сети
        <v-spacer />
        <v-btn
          icon
          variant="text"
          size="small"
          aria-label="Закрыть"
          @click="open = false"
        >
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>
      <v-card-text>
        <div class="hotkeys-grid">
          <section
            v-for="g in EDITOR_HOTKEYS"
            :key="g.title"
          >
            <div class="text-subtitle-2 mb-1">
              {{ g.title }}
            </div>
            <div
              v-for="item in g.items"
              :key="item.text"
              class="hotkeys-row"
            >
              <span class="hotkeys-keys">
                <template
                  v-for="(k, i) in item.keys"
                  :key="k"
                >
                  <span v-if="i">/</span><kbd>{{ k }}</kbd>
                </template>
              </span>
              <span>{{ item.text }}</span>
            </div>
          </section>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { EDITOR_HOTKEYS } from '~/utils/editorTools';

const open = defineModel<boolean>({ default: false });
</script>

<style scoped>
.hotkeys-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px 24px;
}
.hotkeys-row {
  display: flex;
  gap: 10px;
  font-size: 13px;
  padding: 2px 0;
}
.hotkeys-keys {
  flex: 0 0 130px;
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  align-items: center;
}
kbd {
  padding: 0 5px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.35);
  border-bottom-width: 2px;
  border-radius: 4px;
  font-size: 11px;
  font-family: inherit;
  white-space: nowrap;
}
</style>
