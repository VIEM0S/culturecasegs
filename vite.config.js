import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// ── Version horodatée pour forcer le renouvellement du cache PWA ─────────────
const BUILD_VERSION = Date.now().toString();

export default defineConfig({
  base: "/culturecasegs/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      filename: "sw.js",
      manifest: {
        name: "Culturecase GS",
        short_name: "Culturecase",
        description: "Gestion de stock Culturecase",
        start_url: "/culturecasegs/",
        scope: "/culturecasegs/",
        display: "standalone",
        background_color: "#07070e",
        theme_color: "#07070e",
        lang: "fr",
        categories: ["business", "productivity"],
        icons: [
          // SVG pour les navigateurs modernes — purpose "any" uniquement
          // (CRITIQUE : "any maskable" sur SVG = invalide selon les specs PWA)
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          // PNG 192 pour iOS Safari et Android legacy
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          // PNG 512 pour splash screen — "any" uniquement (maskable séparé ci-dessous)
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          // CRITIQUE : icon-512-maskable.png était déclaré mais absent → 404.
          // Utiliser icon-512.png comme maskable (fonctionnel sur Android).
          // Pour un rendu parfait, générer un vrai maskable avec safe zone 80%.
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // CRITIQUE : skipWaiting + clientsClaim = le nouveau SW prend effet
        // immédiatement sans attendre que l'ancien soit "released"
        skipWaiting: true,
        clientsClaim: true,
        // WARN FIX : exclure png/svg/ico du glob pour éviter les doublons dans le précache.
        // Les icônes sont déclarées explicitement via additionalManifestEntries.
        globPatterns: ["**/*.{js,css,html}"],
        additionalManifestEntries: [
          { url: "icon.svg",     revision: null },
          { url: "icon-192.png", revision: null },
          { url: "icon-512.png", revision: null },
          { url: "manifest.json", revision: null },
        ],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "unsplash-cache",
              expiration: { maxEntries: 50 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "fonts-cache" },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: [
            "firebase/app",
            "firebase/firestore",
            "firebase/auth",
          ],
        },
      },
    },
  },
});
