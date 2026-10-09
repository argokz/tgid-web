<script setup lang="ts">
import robotoCyrillic from '~/assets/fonts/roboto-cyrillic-wght-normal.woff2?url'
import robotoLatin from '~/assets/fonts/roboto-latin-wght-normal.woff2?url'

// Иконка от app.baseURL: путь приложения задаётся при запуске (NUXT_APP_BASE_URL)
const baseURL = useRuntimeConfig().app.baseURL

useHead({
  link: [
    { rel: 'icon', type: 'image/x-icon', href: `${baseURL.replace(/\/?$/, '/')}favicon.ico` },
    { rel: 'preload', href: robotoLatin, as: 'font', type: 'font/woff2', crossorigin: 'anonymous' },
    { rel: 'preload', href: robotoCyrillic, as: 'font', type: 'font/woff2', crossorigin: 'anonymous' },
  ],
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
