// SPDX-License-Identifier: MPL-2.0

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/ui'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
});
