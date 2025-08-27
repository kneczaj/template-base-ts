/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig, type UserConfig } from 'vite';
import type { ViteUserConfig as VitestUserConfig } from 'vitest/config';

const test: VitestUserConfig['test'] = {
  clearMocks: true,
  coverage: {
    provider: 'v8',
  },
  environment: 'jsdom',
  globals: true,
  setupFiles: ['./src/test/setup.ts'],
};

const config: UserConfig = {
  plugins: [react()],
};

export default defineConfig({
  ...config,
  test,
} as UserConfig);
