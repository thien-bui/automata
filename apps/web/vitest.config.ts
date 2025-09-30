import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@automata/types': path.resolve(__dirname, '../../packages/types/src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/setup/vitest.setup.ts'],
    globals: true,
    coverage: {
      reporter: ['text', 'html'],
    },
    exclude: ['tests/e2e/**', 'playwright.config.ts'],
  },
});
