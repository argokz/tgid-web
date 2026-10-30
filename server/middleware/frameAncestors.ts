import { frameHeaders } from '../../utils/frameAncestors';

/** Запрет показа приложения во фрейме на чужих сайтах, кроме /embed и /outages (utils/frameAncestors.ts) */
export default defineEventHandler((event) => {
  const headers = frameHeaders(event.path, useRuntimeConfig().app.baseURL);
  for (const [name, value] of Object.entries(headers)) setResponseHeader(event, name, value);
});
