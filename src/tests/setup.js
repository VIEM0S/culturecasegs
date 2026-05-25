// ── Setup global pour tous les tests ─────────────────────────────────────────
// crypto.randomUUID est disponible dans Node 19+ / jsdom récent
// On le polyfill au cas où
if (!globalThis.crypto?.randomUUID) {
  globalThis.crypto = {
    randomUUID: () => Math.random().toString(36).slice(2) + Date.now().toString(36),
  };
}
