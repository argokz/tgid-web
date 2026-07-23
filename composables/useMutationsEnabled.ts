/** Feature flag: journal/attribute write UI. Keep false until AUTH + MUTATIONS_ENABLED. */
export function useMutationsEnabled() {
  const config = useRuntimeConfig()
  return computed(() => Boolean(config.public.mutationsEnabled))
}
