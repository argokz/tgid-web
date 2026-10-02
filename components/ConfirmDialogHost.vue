<template>
  <v-dialog
    :model-value="confirmState.visible"
    max-width="460"
    @update:model-value="(open: boolean) => { if (!open) settleConfirm(false) }"
  >
    <v-card data-testid="confirm-dialog">
      <v-card-title class="text-subtitle-1">
        {{ confirmState.title }}
      </v-card-title>
      <v-card-text style="white-space: pre-line">
        {{ confirmState.text }}
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          variant="text"
          data-testid="confirm-cancel"
          @click="settleConfirm(false)"
        >
          {{ confirmState.cancel }}
        </v-btn>
        <v-btn
          :color="confirmState.color"
          variant="flat"
          data-testid="confirm-ok"
          @click="settleConfirm(true)"
        >
          {{ confirmState.action }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { confirmState, settleConfirm } from '~/composables/useConfirm';
</script>
