import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

function deploymentMetadata(): Plugin {
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? 'unknown'
  return {
    name: 'deployment-metadata',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'deployment.json',
        source: `${JSON.stringify({ commitSha })}\n`,
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), deploymentMetadata()],
  // Vercel serves only the static frontend; the private FastAPI host keeps voice.
  define: {
    __VOICE_PRIVATE_BUILD__: JSON.stringify(process.env.VERCEL !== '1'),
    __GOOGLE_PHOTOS_PUBLIC_BUILD__: JSON.stringify(process.env.VERCEL === '1'),
  },
  preview: {
    allowedHosts: ['smora-precision-3550.taildf8f08.ts.net'],
  },
})
