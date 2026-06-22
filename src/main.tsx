import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';

// Define a Trusted Types policy to allow YouTube Player script URL injection under strict policies (Edge/Chrome)
if (typeof window !== 'undefined' && 'trustedTypes' in window && (window as any).trustedTypes.createPolicy) {
  try {
    if (!(window as any).trustedTypes.defaultPolicy) {
      (window as any).trustedTypes.createPolicy('default', {
        createScriptURL: (url: string) => {
          // Allow resolving any script URL as TrustedScriptURL for compatibility with YouTube Widget API
          return url;
        }
      });
    }
  } catch (e) {
    console.warn('[Trusted Types] Failed to register default policy:', e);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
