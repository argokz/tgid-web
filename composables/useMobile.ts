/**
 * Composable для определения мобильных устройств и адаптивности
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'

export const useMobile = () => {
  if (typeof window === 'undefined') {
    return {
      isMobile: ref(false),
      isTablet: ref(false),
      isMobileOrTablet: ref(false),
      isSmallMobile: ref(false),
      isLandscape: ref(false),
      isTouchDevice: ref(false),
      screenWidth: ref(0),
      screenHeight: ref(0)
    }
  }

  const screenWidth = ref(window.innerWidth)
  const screenHeight = ref(window.innerHeight)

  const MOBILE_MAX = 768
  const TABLET_MAX = 1024
  const MOBILE_SMALL = 375

  const isMobile = computed(() => screenWidth.value <= MOBILE_MAX)
  const isTablet = computed(() => screenWidth.value > MOBILE_MAX && screenWidth.value <= TABLET_MAX)
  const isMobileOrTablet = computed(() => screenWidth.value <= TABLET_MAX)
  const isSmallMobile = computed(() => screenWidth.value <= MOBILE_SMALL)
  const isLandscape = computed(() => screenWidth.value > screenHeight.value)

  const isTouchDevice = computed(() => {
    if (typeof window === 'undefined') return false
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0
  })

  const updateScreenSize = () => {
    screenWidth.value = window.innerWidth
    screenHeight.value = window.innerHeight
  }

  onMounted(() => {
    updateScreenSize()
    window.addEventListener('resize', updateScreenSize)
    window.addEventListener('orientationchange', updateScreenSize)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', updateScreenSize)
    window.removeEventListener('orientationchange', updateScreenSize)
  })

  return { isMobile, isTablet, isMobileOrTablet, isSmallMobile, isLandscape, isTouchDevice, screenWidth, screenHeight }
}

export const useSwipe = (
  element: Ref<HTMLElement | null>,
  options: {
    onSwipeLeft?: () => void
    onSwipeRight?: () => void
    threshold?: number
  } = {}
) => {
  if (typeof window === 'undefined') return

  const threshold = options.threshold || 50
  let touchStartX = 0
  let touchEndX = 0

  const handleTouchStart = (e: TouchEvent) => { touchStartX = e.changedTouches[0].screenX }
  const handleTouchEnd = (e: TouchEvent) => {
    touchEndX = e.changedTouches[0].screenX
    const diff = touchEndX - touchStartX
    if (Math.abs(diff) > threshold) {
      if (diff > 0) options.onSwipeRight?.()
      else options.onSwipeLeft?.()
    }
  }

  onMounted(() => {
    const el = element.value
    if (el) {
      el.addEventListener('touchstart', handleTouchStart, { passive: true })
      el.addEventListener('touchend', handleTouchEnd, { passive: true })
    }
  })

  onUnmounted(() => {
    const el = element.value
    if (el) {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchend', handleTouchEnd)
    }
  })
}
