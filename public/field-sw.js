/*
 * Service worker полевого приложения (pages/field.vue): страница бригады открывается без связи.
 * Регистрирует его только страница /field; область — путь приложения, но обрабатывается лишь:
 *   - переход на <путь>/field — сначала сеть, без неё — сохранённая страница;
 *   - файлы приложения (_nuxt/…), запрошенные со страницы /field, и иконки/manifest — сначала сеть, без неё — копия.
 * Всё остальное (API, тайлы, основное приложение) идёт мимо: данные без связи держит сама страница (IndexedDB).
 * Сначала сеть — чтобы после выкатки бригада сразу получала новую версию, а не старую из кеша.
 */
const CACHE = 'tgid-field-v1';
const BASE = new URL('./', self.location.href).pathname; // например /itwin-map/ или /tgid/almaty/
const FIELD_PAGE = BASE + 'field';
const STATIC_FILES = /\.(?:png|ico|svg|webmanifest|woff2)$/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll([FIELD_PAGE, BASE + 'field.webmanifest', BASE + 'icon-192.png']))
      .catch(() => undefined) // без связи при установке — страница сохранится при следующем открытии
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('tgid-field-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isFieldUrl(url) {
  const path = new URL(url).pathname;
  return path === FIELD_PAGE || path === FIELD_PAGE + '/';
}

async function networkFirst(request, cacheKey) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') await cache.put(cacheKey || request, response.clone());
    return response;
  } catch (error) {
    // ignoreVary: файлы статичные, а «Vary: Origin» иначе разводит запрос <link crossorigin> и сохранённый fetch()
    const cached = await cache.match(cacheKey || request, { ignoreSearch: Boolean(cacheKey), ignoreVary: true });
    if (cached) return cached;
    throw error;
  }
}

/**
 * Файл приложения запросила страница бригады. Стили и скрипты из <head> запрашиваются до того, как страница
 * становится «клиентом» (clients.get её ещё не видит), — их узнаём по referrer.
 */
async function fromFieldClient(event) {
  const referrer = event.request.referrer;
  if (referrer && isFieldUrl(referrer)) return true;
  if (!event.clientId) return false;
  const client = await self.clients.get(event.clientId);
  return Boolean(client && isFieldUrl(client.url));
}

// страница бригады присылает файлы, загруженные до того, как service worker начал её обслуживать
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type !== 'cache-urls' || !Array.isArray(data.urls)) return;
  const urls = data.urls.filter((u) => {
    try {
      const url = new URL(u);
      return url.origin === self.location.origin && url.pathname.startsWith(BASE + '_nuxt/');
    } catch {
      return false;
    }
  }).slice(0, 2000);
  event.waitUntil(caches.open(CACHE).then(async (cache) => {
    for (const u of urls) {
      if (await cache.match(u)) continue;
      try {
        const response = await fetch(u);
        if (response.ok) await cache.put(u, response);
      } catch {
        return; // связь пропала — остальное сохранится при следующем открытии
      }
    }
  }));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;

  if (request.mode === 'navigate') {
    // ?brigade=… и прочие параметры — одна сохранённая страница
    if (isFieldUrl(request.url)) event.respondWith(networkFirst(request, FIELD_PAGE));
    return;
  }

  const appFile = url.pathname.startsWith(BASE + '_nuxt/');
  if (!appFile && !STATIC_FILES.test(url.pathname)) return;
  event.respondWith((async () => {
    if (await fromFieldClient(event)) return networkFirst(request);
    return fetch(request);
  })());
});
