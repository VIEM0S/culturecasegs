import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

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
          // ✅ SVG pour les navigateurs modernes
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
          // ✅ PNG 192 pour iOS Safari et Android legacy (à générer depuis icon.svg)
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          // ✅ PNG 512 pour splash screen et maskable Android
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "unsplash-cache", expiration: { maxEntries: 50 } }
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "fonts-cache" }
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // ✅ FIX: sépare Firebase du bundle principal (~300 Ko économisés au 1er chargement)
        manualChunks: {
          "firebase": [
            "firebase/app",
            "firebase/firestore",
            "firebase/auth",
          ],
        },
      },
    },
  },
});
