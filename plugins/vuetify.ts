import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'
import { h } from 'vue'
import { resolveMdiSvgPath } from '~/utils/mdiSvgPaths'

// import { mdiDotsVertical, mdiBook, mdiExitToApp, mdiPencil } from '@mdi/js';
// aliases['dotsVertical'] = mdiDotsVertical
// aliases['book'] = mdiBook
// aliases['exit'] = mdiExitToApp
// aliases['pencil'] = mdiPencil

export default defineNuxtPlugin((app) => {
  const vuetify = createVuetify({
    theme: {
        defaultTheme: 'light', // Указываем тему по умолчанию
        themes: {
          light: {
            dark: false,
            colors: {
              primary: '#1565C0',
              secondary: '#546E7A',
              accent: '#82B1FF',
              surface: '#FFFFFF',
              background: '#F5F7FA',
            },
          },
          dark: {
            dark: true,
            colors: {
              primary: '#90CAF9',
              secondary: '#80CBC4',
              surface: '#1E1E2E',
              background: '#121212',
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
    defaults: {
      VCard: {
        elevation: 5
      }
    }
  })
  
  app.vueApp.use(vuetify)
})