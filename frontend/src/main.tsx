import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initMercadoPago } from '@mercadopago/sdk-react';
import './index.css';
import App from './App';

const mpPublic = import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY;
if (typeof mpPublic === 'string' && mpPublic.trim().length > 0) {
  initMercadoPago(mpPublic.trim());
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
