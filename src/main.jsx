import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// ── Service Worker — géré par vite-plugin-pwa ────────────────────────────────
import { registerSW } from "virtual:pwa-register";

registerSW({
  onNeedRefresh() {
    // Informe App qu'une mise à jour est disponible → bannière de mise à jour
    window.dispatchEvent(new CustomEvent("sw-update-available"));
  },
  onOfflineReady() {
    // AMÉLIORATION : informe App que la PWA est prête hors ligne → toast discret
    // (remplace le console.log silencieux de l'ancienne version)
    window.dispatchEvent(new CustomEvent("pwa-offline-ready"));
  },
});
