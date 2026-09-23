import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Vercel serves only the static frontend; the private FastAPI host keeps voice.
  define: {
    __VOICE_PRIVATE_BUILD__: JSON.stringify(process.env.VERCEL !== '1'),
    __GOOGLE_PHOTOS_PUBLIC_BUILD__: JSON.stringify(process.env.VERCEL === '1'),
  },
  preview: {
    allowedHosts: ['smora-precision-3550.taildf8f08.ts.net'],
  },
})
