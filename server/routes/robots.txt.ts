import { robotsTxt } from '../../utils/siteIndexing';

/** robots.txt по окружению: стенды закрыты от индексации, прод — по NUXT_PUBLIC_SITE_INDEXABLE (utils/siteIndexing.ts) */
export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event);
  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8');
  return robotsTxt({ indexable: Boolean(config.public.siteIndexable) }, config.app.baseURL);
});
