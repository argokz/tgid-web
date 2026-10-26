import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'
import { en, ru } from 'vuetify/locale'
import { h } from 'vue'
import { resolveMdiSvgPath } from '~/utils/mdiSvgPaths'

// import { mdiDotsVertical, mdiBook, mdiExitToApp, mdiPencil } from '@mdi/js';
// aliases['dotsVertical'] = mdiDotsVertical
// aliases['book'] = mdiBook
// aliases['exit'] = mdiExitToApp
// aliases['pencil'] = mdiPencil

export default defineNuxtPlugin((app) => {
  const vuetify = createVuetify({
    // Тема одна — светлая (решение этапа 2 модернизации UI, docs/ui-primitives.md): тёмной палитры
    // и переключателя нет. Остальные токены (отступы, тени, движение, стекло) — assets/styles/_tokens.scss
    theme: {
        defaultTheme: 'light',
        themes: {
          light: {
            dark: false,
            colors: {
              primary: '#1565C0',
              secondary: '#546E7A',
              // акцент «живой сети»: активный инструмент, выделенный объект, прогресс — и больше нигде
              accent: '#D97706',
              surface: '#FFFFFF',
              background: '#F5F7FA',
            },
            // Подписи полей, подсказки и вторичный текст: при 0,6 по умолчанию — 4,22:1 на #FAFAFA (axe, этап 9),
            // 0,68 даёт ≥ 4,5:1 (WCAG AA)
            variables: {
              'medium-emphasis-opacity': 0.68,
            },
          },
        },
      },
    // ssr: {
    //   clientWidth: 1280,
    //   clientHeight: 720
    // },
    ssr: true,
    icons: {
      defaultSet: 'mdi',
      aliases,
      sets: {
        mdi: {
          ...mdi,
          component: (props: any) => {
            const rawName: string = props.icon || ''
            const path = resolveMdiSvgPath(rawName)
            return h('svg', {
              xmlns: 'http://www.w3.org/2000/svg',
              viewBox: '0 0 24 24',
              style: 'display:inline-block;width:1em;height:1em;vertical-align:-0.125em;fill:currentColor;',
              ...props
            }, [h('path', { d: path })])
          },
        }
      }
    },
    // Русские подписи встроенных компонентов: пагинация таблиц («Строк на странице»),
    // «Нет данных» и т. п. (QA F63, F32)
    locale: {
      locale: 'ru',
      fallback: 'en',
      messages: { ru, en },
    },
    defaults: {
      VCard: {
        elevation: 5
      },
      // По умолчанию Vuetify прячет стрелки вкладок при ширине < 1280 («мобильный»
      // режим), и мышью до вкладок за краем не добраться: «Бланк» калькулятора
      // на 1024, вкладки 2–4 и каталог насосов на 375 (QA F58). true — стрелки
      // при переполнении на любой ширине.
      VTabs: {
        showArrows: true
      }
    }
  })
  
  app.vueApp.use(vuetify)
})