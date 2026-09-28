<template>
  <v-dialog
    v-model="dialog"
    max-width="800"
    scrollable
  >
    <v-card>
      <v-card-title class="d-flex align-center bg-primary text-white">
        Отчеты и Паспорта участков
        <v-spacer />
        <v-btn
          icon="mdi-close"
          variant="text"
          @click="dialog = false"
        />
      </v-card-title>
      
      <v-card-text
        class="pa-0"
        style="height: 600px;"
      >
        <v-alert
          v-if="diagnostics && !diagnostics.ready_for_passport"
          type="warning"
          variant="tonal"
          density="compact"
          class="ma-3"
        >
          <div class="text-body-2 font-weight-medium mb-1">Привязки участков в БД не заполнены</div>
          <div
            class="text-caption"
            v-for="(b, i) in diagnostics.blockers"
            :key="i"
          >• {{ b }}</div>
          <div class="text-caption mt-1">
            HPS с MS/RS: {{ diagnostics.counts?.heatpipesections_with_magistral_site || 0 }} /
            {{ diagnostics.counts?.heatpipesections_with_dist_site || 0 }}
          </div>
        </v-alert>
        <v-container
          v-if="loading"
          class="d-flex justify-center align-center h-100"
        >
          <v-progress-circular
            indeterminate
            color="primary"
          />
        </v-container>
        
        <v-list
          v-else
          v-model:opened="open"
        >
          <template
            v-for="item in hierarchy"
            :key="item.id"
          >
            <v-list-group :value="item.id">
              <template #activator="{ props }">
                <v-list-item
                  v-bind="props"
                  prepend-icon="mdi-folder-network"
                  :title="item.name"
                />
              </template>
              
              <template
                v-for="nach in item.children"
                :key="nach.id"
              >
                <v-list-group :value="nach.id">
                  <template #activator="{ props }">
                    <v-list-item
                      v-bind="props"
                      prepend-icon="mdi-account-tie"
                      :title="nach.name"
                    />
                  </template>

                  <v-list-item
                    v-for="uch in nach.children"
                    :key="uch.id"
                    :title="uch.name"
                    prepend-icon="mdi-pipe"
                    :disabled="downloadingSiteId === uch.id"
                    :subtitle="downloadingSiteId === uch.id ? progressText : undefined"
                    @click="downloadPassport(uch.ms_rs, uch.site_id)"
                  >
                    <template #append>
                      <v-progress-circular
                        v-if="downloadingSiteId === uch.id"
                        indeterminate
                        color="success"
                        size="20"
                        width="2"
                      />
                      <v-btn
                        v-else
                        icon="mdi-file-excel-box"
                        color="success"
                        size="small"
                        variant="text"
                      />
                    </template>
                  </v-list-item>
                </v-list-group>
              </template>
            </v-list-group>
          </template>
        </v-list>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useNotificationStore } from '~/stores/notificationStore'
import {
  describeFileJobProgress,
  fastApiService,
  type PassportHierarchyGroup,
  type PassportSite
} from '~/services/fastApiService'

const dialog = ref(false)
const loading = ref(false)
const hierarchy = ref<PassportHierarchyGroup[]>([])
const open = ref<string[]>([])
const downloadingSiteId = ref<string | null>(null)
const progressText = ref('')
const diagnostics = ref<{
  ready_for_passport: boolean
  blockers: string[]
  counts: Record<string, number>
} | null>(null)
const notificationStore = useNotificationStore()

const fetchHierarchy = async () => {
  loading.value = true
  try {
    const [hier, diag] = await Promise.all([
      fastApiService.getPassportHierarchy(),
      fastApiService.getPassportDiagnostics().catch(() => null),
    ])
    hierarchy.value = hier
    diagnostics.value = diag
  } catch (e: any) {
    notificationStore.showError('Ошибка загрузки паспортов: ' + e.message)
  } finally {
    loading.value = false
  }
}

const openDialog = () => {
  dialog.value = true
  if (hierarchy.value.length === 0) {
    fetchHierarchy()
  }
}

const downloadPassport = async (msRs: PassportSite['ms_rs'], id: number) => {
  const siteKey = `${msRs}_${id}`
  downloadingSiteId.value = siteKey
  try {
    progressText.value = ''
    const { blob, filename } = await fastApiService.downloadPassport(msRs, id, {
      onProgress: (p) => {
        progressText.value = describeFileJobProgress(p)
      },
    })
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(objectUrl)
    notificationStore.showSuccess(`Паспорт «${filename}» сформирован`)
  } catch (e: any) {
    notificationStore.showError('Ошибка формирования паспорта: ' + e.message)
  } finally {
    downloadingSiteId.value = null
  }
}

defineExpose({
  openDialog
})
</script>
