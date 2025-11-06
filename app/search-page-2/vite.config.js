import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(__dirname, 'components/ScheduleSelector/index.tsx'),
      name: 'ScheduleSelector',
      fileName: () => 'schedule-selector.js',
      formats: ['umd'],
    },
    rollupOptions: {
      // Externalize dependencies that will be loaded via CDN
      external: ['react', 'react-dom', 'styled-components', 'framer-motion'],
      output: {
        // Global variable names for externalized deps
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'styled-components': 'styled',
          'framer-motion': 'FramerMotion',
        },
        // Ensure consistent output
        assetFileNames: 'schedule-selector.[ext]',
      },
    },
    outDir: 'dist',
    emptyOutDir: false, // Don't delete other files in dist/
    sourcemap: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
    },
  },
});
