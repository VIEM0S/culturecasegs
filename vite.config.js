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
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,ico}"],
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
});
