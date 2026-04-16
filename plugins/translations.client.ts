// Плагин для предзагрузки переводов атрибутов
export default defineNuxtPlugin(async () => {
  if (process.client) {
    // Импортируем сервис API
    const { fastApiService } = await import('~/services/fastApiService');
    
    // Предзагружаем часто используемые переводы
    try {
      await fastApiService.preloadCommonTranslations();
      console.log('Common translations preloaded successfully');
    } catch (error) {
      console.error('Error preloading common translations:', error);
    }
  }
});
