import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { FarmProvider } from './context/FarmContext';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

createRoot(container).render(
  <StrictMode>
    <FarmProvider>
      <App />
    </FarmProvider>
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[PrintFarm OS] Service worker registration failed', err);
    });
  });
}
