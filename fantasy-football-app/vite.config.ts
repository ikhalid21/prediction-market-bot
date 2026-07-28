import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Served from https://<user>.github.io/prediction-market-bot/ in production,
  // but keep the dev server at the site root for local development.
  base: command === 'build' ? '/prediction-market-bot/' : '/',
  plugins: [react(), tailwindcss()],
}))
