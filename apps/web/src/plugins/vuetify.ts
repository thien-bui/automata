import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';

import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import { aliases, mdi } from 'vuetify/iconsets/mdi';

export const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'light',
    variations: {
      colors: ['primary', 'secondary'],
      lighten: 2,
      darken: 2,
    },
    themes: {
      light: {
        colors: {
          primary: '#1e88e5',
          secondary: '#ffb300',
          surface: '#fafafa',
          background: '#f5f5f5',
        },
      },
      dark: {
        dark: true,
        colors: {
          primary: '#007acc',
          secondary: '#ff7858',
          surface: '#2d2d30',
          background: '#1e1e1e',
        },
      },
    },
  },
  defaults: {
    VBtn: {
      color: 'primary',
      ripple: true,
    },
    VCard: {
      elevation: 2,
    },
  },
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: {
      mdi,
    },
  },
  display: {
    mobileBreakpoint: 'sm',
  },
});
