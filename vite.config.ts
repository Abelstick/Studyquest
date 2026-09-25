import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'StudyQuest',
        short_name: 'StudyQuest',
        description: 'Estudia, crea hábitos y sube de nivel como en tus juegos favoritos.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#5c94fc',
        theme_color: '#5c94fc',
        categories: ['education', 'productivity'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Nueva tarea', url: '/tareas?nuevo=1', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Hábitos de hoy', url: '/habitos', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,woff}'],
        // El SDK de Gemini solo se descarga cuando se usa la IA (que necesita conexión): no se precachea.
        globIgnores: ['**/genai-*.js'],
        navigateFallback: '/index.html',
        // Manejo de notificaciones push (public/push-sw.js) dentro del mismo service worker.
        importScripts: ['push-sw.js'],
        // Las llamadas a Supabase nunca se cachean: los datos siempre vienen frescos.
        runtimeCaching: [{ urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co'), handler: 'NetworkOnly' }],
      },
    }),
  ],
  // `npm start` (solo si se despliega como Web Service en Render): sirve /dist en el puerto que asigne la plataforma.
  preview: { host: true, port: Number(process.env.PORT) || 4173, strictPort: true, allowedHosts: true },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'supabase', test: /node_modules[\/]@supabase/ },
            { name: 'genai', test: /node_modules[\/]@google[\/]genai/ },
            // El motor 3D del héroe va aparte: solo lo pide esa pantalla.
            { name: 'three', test: /node_modules[\/]three[\/]/ },
            { name: 'react', test: /node_modules[\/](react|react-dom|react-router|react-router-dom|scheduler)[\/]/ },
          ],
        },
      },
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
