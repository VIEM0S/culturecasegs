import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Même transformation JSX que le build (runtime automatique) — nécessaire
  // pour tester des composants React, pas seulement des fonctions pures.
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/tests/setup.js"],
  },
});
