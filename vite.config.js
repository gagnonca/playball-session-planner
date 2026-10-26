import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // `npm run dev` serves the app; the API comes from `vercel dev --listen 3000`
  // (whose own SPA rewrite breaks Vite's module requests).
  server: {
    proxy: { '/api': 'http://localhost:3000' },
  },
})
