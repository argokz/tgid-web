type PerfDetails = Record<string, string | number | boolean | null | undefined>;

const DEV = import.meta.dev;

export const markPerf = (name: string): void => {
  if (!process.client || !DEV || typeof performance === 'undefined') return;
  performance.mark(name);
};

export const measurePerf = (name: string, startMark: string, endMark?: string, details?: PerfDetails): number | null => {
  if (!process.client || !DEV || typeof performance === 'undefined') return null;

  try {
    performance.measure(name, startMark, endMark);
    const entries = performance.getEntriesByName(name, 'measure');
    const entry = entries[entries.length - 1];
    if (!entry) return null;

    const extra = details ? ` ${JSON.stringify(details)}` : '';
    console.debug(`[perf] ${name}: ${entry.duration.toFixed(2)}ms${extra}`);
    return entry.duration;
  } catch {
    return null;
  }
};

export const timeAsync = async <T>(
  metricName: string,
  task: () => Promise<T>,
  details?: PerfDetails
): Promise<T> => {
  if (!process.client || !DEV || typeof performance === 'undefined') {
    return task();
  }

  const start = `${metricName}:start:${Date.now()}`;
  const end = `${metricName}:end:${Date.now()}`;
  markPerf(start);

  try {
    return await task();
  } finally {
    markPerf(end);
    measurePerf(metricName, start, end, details);
  }
};
