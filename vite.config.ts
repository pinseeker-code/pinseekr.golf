import path from "node:path";

import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vitest/config";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    // Bind to all IPv4 interfaces to avoid IPv6-only binding issues on some Windows setups
    host: '0.0.0.0',
    port: 8080,
  },
  plugins: [
    react(),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    onConsoleLog(log) {
      return !log.includes("React Router Future Flag Warning");
    },
    env: {
      DEBUG_PRINT_LIMIT: '0', // Suppress DOM output that exceeds AI context windows
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Improve dependency pre-bundling and reduce duplicate dynamic import warnings
  optimizeDeps: {
    include: ['nostr-tools'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Isolate nostr-tools for better caching and smaller main bundle
          if (id.includes('nostr-tools')) return 'nostr-tools';

          // Create focused vendor chunks for very large libraries to avoid one huge index bundle
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) return 'react-vendor';
            if (id.includes('@tanstack/react-query')) return 'query';
            if (id.includes('@nostrify/react')) return 'nostrify';
            if (id.includes('react-router-dom')) return 'router';
            if (id.includes('react-hook-form')) return 'react-hook-form';
            if (id.includes('@hookform/resolvers')) return 'hookform-resolvers';
            if (id.includes('zod')) return 'zod';
            if (id.includes('@getalby/sdk')) return 'alby-sdk';
            if (id.includes('recharts')) return 'recharts';
            if (id.includes('@radix-ui') || id.includes('@radix-ui')) return 'radix-ui';
            if (id.includes('lucide-react')) return 'icons';
            if (id.includes('date-fns')) return 'date-fns';
            if (id.includes('qrcode')) return 'qrcode';
          }
          // Otherwise let Rollup handle chunking
        }
      }
    }
  }
}));