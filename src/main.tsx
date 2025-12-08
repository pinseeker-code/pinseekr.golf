import { createRoot } from 'react-dom/client';

// Import polyfills first
import './lib/polyfills.ts';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import App from './App.tsx';
import './index.css';

// TODO: Add custom font support in the future

// register service worker only in production builds
if (import.meta.env && import.meta.env.PROD && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      if (typeof console !== 'undefined' && typeof console.log === 'function') {
        console.log('SW registered', reg.scope);
      }
    }).catch((err) => {
      if (typeof console !== 'undefined' && typeof console.warn === 'function') {
        console.warn('SW registration failed', err);
      }
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
