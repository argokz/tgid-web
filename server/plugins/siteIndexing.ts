import { siteIndexingWarnings } from '../../utils/siteIndexing';

/** При запуске сервера — предупредить о нераспознанном флаге индексации или неверном каноническом адресе */
export default defineNitroPlugin(() => {
  const config = useRuntimeConfig();
  for (const warning of siteIndexingWarnings(config.public.siteIndexable, config.public.siteUrl)) {
    console.warn(`[site-indexing] ${warning}`);
  }
});
