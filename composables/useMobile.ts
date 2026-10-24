/**
 * Composable для определения мобильных устройств и адаптивности.
 * Границы — utils/breakpoints.ts (одни и те же в TS и SCSS): isMobile < 960, isTablet 960–1279, иначе десктоп.
 */
import { ref, computed, onMounted, onUnmounted, type Ref } from 'vue'
import { deviceClass } from '~/utils/breakpoints'

export const useMobile = () => {
  if (typeof window === 'undefined') {
    return {
      isMobile: ref(false),
      isTablet: ref(false),
      isMobileOrTablet: ref(false),
      isLandscape: ref(false),
      isTouchDevice: ref(false),
      screenWidth: ref(0),
      screenHeight: ref(0)
    }
  }

  const screenWidth = ref(window.innerWidth)
  const screenHeight = ref(window.innerHeight)

  const device = computed(() => deviceClass(screenWidth.value))
  const isMobile = computed(() => device.value === 'phone')
  const isTablet = computed(() => device.value === 'tablet')
  const isMobileOrTablet = computed(() => device.value !== 'desktop')
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

  return { isMobile, isTablet, isMobileOrTablet, isLandscape, isTouchDevice, screenWidth, screenHeight }
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
