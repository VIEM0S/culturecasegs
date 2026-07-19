import { describe, it, expect, vi } from "vitest";

// data.js importe ./firebase.js au chargement, ce qui plante en environnement
// de test (pas de vraies clés Firebase). On ne teste ici que la logique pure.
vi.mock("../firebase.js", () => ({
  getDB: () => ({}),
  doc: () => ({}),
  getDoc: () => Promise.resolve({ exists: () => false, metadata: { fromCache: false } }),
  onSnapshot: () => () => {},
  writeBatch: () => ({ set: () => {}, delete: () => {}, commit: () => Promise.resolve() }),
}));

import { shouldBlockForConflict } from "../data.js";

describe("shouldBlockForConflict", () => {
  it("ne bloque jamais hors-ligne (fromCache), même si les versions diffèrent", () => {
    expect(shouldBlockForConflict({ localVersion: 3, serverVersion: 7, fromCache: true })).toBe(false);
  });

  it("ne bloque pas en ligne si les versions correspondent", () => {
    expect(shouldBlockForConflict({ localVersion: 5, serverVersion: 5, fromCache: false })).toBe(false);
  });

  it("bloque en ligne si le serveur a une version plus récente", () => {
    expect(shouldBlockForConflict({ localVersion: 5, serverVersion: 6, fromCache: false })).toBe(true);
  });

  it("bloque aussi si le serveur a une version plus ancienne (incohérence à signaler)", () => {
    expect(shouldBlockForConflict({ localVersion: 6, serverVersion: 5, fromCache: false })).toBe(true);
  });

  it("gère le tout premier enregistrement (version 0 des deux côtés)", () => {
    expect(shouldBlockForConflict({ localVersion: 0, serverVersion: 0, fromCache: false })).toBe(false);
  });
});
