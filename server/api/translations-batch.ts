import { defineEventHandler, readBody, getQuery } from 'h3';

interface ColumnTranslation {
  column: string;
  russian_name: string;
  description: string;
}

export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig();
    const mapApiBaseUrl = (
      config.public?.mapApiBaseUrl ||
      config.public?.externalApiUrl ||
      'http://localhost:8000'
    )
      .toString()
      .replace(/\/+$/, '');

    let columns: string[] = [];

    if (event.method === 'POST') {
      const body = await readBody(event).catch(() => null);
      columns = Array.isArray(body?.columns) ? body.columns : [];
    } else {
      const query = getQuery(event);
      const raw = query.columns;
      if (typeof raw === 'string') {
        columns = raw.split(',').map((c) => c.trim()).filter(Boolean);
      }
    }

    if (!columns.length) {
      return {};
    }

    const results: Record<string, ColumnTranslation> = {};

    const promises = columns.map(async (column) => {
      try {
        const url = `${mapApiBaseUrl}/russian-names/column/${encodeURIComponent(column)}`;
        const data = await $fetch<ColumnTranslation>(url, { timeout: 5000 });
        results[column] = data;
      } catch {
        results[column] = { column, russian_name: column, description: '' };
      }
    });

    await Promise.all(promises);
    return results;
  } catch (e) {
    console.error('[translations-batch]', e);
    return {};
  }
});
