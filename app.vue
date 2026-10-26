<script setup lang="ts">
import robotoCyrillic from '~/assets/fonts/roboto-cyrillic-wght-normal.woff2?url'
import robotoLatin from '~/assets/fonts/roboto-latin-wght-normal.woff2?url'

// Иконки и manifest от app.baseURL: путь приложения задаётся при запуске (NUXT_APP_BASE_URL).
// Знак ITwin Map — docs/brand, растр — scripts/brand/render-icons.mjs
const config = useRuntimeConfig()
const base = config.app.baseURL.replace(/\/?$/, '/')
// Стенды закрыты от поисковиков, у прода — канонический адрес (utils/siteIndexing.ts)
const site = { indexable: parseIndexable(config.public.siteIndexable), siteUrl: String(config.public.siteUrl || '') }
const robots = robotsMetaContent(site)
const canonical = canonicalUrl(site)

useHead({
  meta: robots ? [{ name: 'robots', content: robots }] : [],
  link: [
    ...(canonical ? [{ rel: 'canonical', href: canonical }] : []),
    { rel: 'icon', type: 'image/svg+xml', href: `${base}favicon.svg` },
    { rel: 'icon', type: 'image/x-icon', href: `${base}favicon.ico`, sizes: '16x16 32x32' },
    { rel: 'apple-touch-icon', href: `${base}apple-touch-icon.png` },
    { rel: 'manifest', href: `${base}manifest.webmanifest` },
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
