import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './base.css'
import App from './App.tsx'

if (import.meta.env.PROD && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/service-worker.js').catch(() => undefined)
  }, { once: true })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
