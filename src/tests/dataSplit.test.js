import { describe, it, expect, vi, beforeEach } from "vitest";

// Firestore simulé : un "serveur" en mémoire + un batch qui enregistre les écritures.
const store = new Map();
const committed = [];
vi.mock("../firebase.js", () => {
  const doc = (_db, col, id) => `${col}/${id}`;
  const snap = (path) => ({ exists: () => store.has(path), data: () => structuredClone(store.get(path)) });
  return {
    getDB: () => ({}),
    doc,
    getDocFromServer: async (path) => snap(path),
    onSnapshot: vi.fn(),
    writeBatch: () => {
      const ops = [];
      return {
        set: (path, value) => ops.push({ type: "set", path, value }),
        delete: (path) => ops.push({ type: "delete", path }),
        commit: async () => {
          committed.push(ops);
          for (const o of ops) o.type === "set" ? store.set(o.path, structuredClone(o.value)) : store.delete(o.path);
        },
      };
    },
  };
});

import { saveData, migrateLegacyIfNeeded } from "../data.js";
import { mergeAdminData } from "../privateSplit.js";

const fullData = () => ({
  products: [{ id: "p1", model: "iPhone 12", design: "Afro", stock: 5, price: 3500 }],
  settings: { models: ["iPhone 12"], designs: [] },
  sales: [{ id: "s1", groupId: "g1", productId: "p1", qty: 1, total: 3500, date: "2026-05-19", client: "Fatoumata Diallo", phone: "70112233", quartier: "Hamdallaye" }],
  pendingSales: [],
  movements: [{ id: "m1", productId: "p1", type: "out", qty: 1, reason: "Vente", date: "2026-05-19", note: "Fatoumata Diallo" }],
  payments: [],
  _chunkCount: 1,
});

beforeEach(() => { store.clear(); committed.length = 0; });

describe("saveData — séparation public / privé", () => {
  it("n'écrit AUCUNE identité dans data/*, tout dans private/main, dans un seul batch", async () => {
    await saveData(fullData());
    expect(committed).toHaveLength(1); // atomique : un seul commit

    const publicJson = JSON.stringify([...store].filter(([p]) => p.startsWith("data/")));
    for (const needle of ["Fatoumata", "Diallo", "70112233", "Hamdallaye"]) {
      expect(publicJson).not.toContain(needle);
    }
    expect(JSON.stringify(store.get("private/main"))).toContain("Fatoumata Diallo");
  });

  it("main et private partagent le même tampon", async () => {
    await saveData(fullData());
    expect(store.get("data/main")._privSavedAt).toBeTruthy();
    expect(store.get("data/main")._privSavedAt).toBe(store.get("private/main")._savedAt);
  });

  it("aller-retour : ce que l'admin relit est identique à ce qu'il a sauvegardé", async () => {
    const original = fullData();
    await saveData(original);
    const r = mergeAdminData(store.get("data/main"), store.get("private/main"));
    expect(r.status).toBe("ok");
    expect(r.data.sales).toEqual(original.sales);
    expect(r.data.movements).toEqual(original.movements);
  });

  it("deux sauvegardes successives n'accumulent pas de tampon périmé", async () => {
    await saveData(fullData());
    const first = store.get("data/main")._privSavedAt;
    const reread = mergeAdminData(store.get("data/main"), store.get("private/main")).data;
    await saveData(reread);
    expect(store.get("data/main")._privSavedAt).not.toBe(first);
    expect(store.get("data/main")._privSavedAt).toBe(store.get("private/main")._savedAt);
  });
});

describe("migrateLegacyIfNeeded", () => {
  // État "avant la mise à jour" : data/main contient les ventes complètes
  const seedLegacy = () => {
    const d = fullData();
    store.set("data/main", { ...d, products: [], _chunkCount: 1 });
    store.set("data/products_0", { items: d.products });
  };

  it("bascule l'ancien format : data/main nettoyé, private/main complet, produits intacts", async () => {
    seedLegacy();
    expect(await migrateLegacyIfNeeded()).toBe(true);

    expect(JSON.stringify(store.get("data/main"))).not.toContain("Fatoumata");
    expect(JSON.stringify(store.get("data/main"))).not.toContain("70112233");
    expect(store.get("private/main").sales[0].client).toBe("Fatoumata Diallo");
    expect(store.get("data/products_0").items).toEqual(fullData().products);
  });

  it("ne fait rien si c'est déjà migré (idempotent)", async () => {
    seedLegacy();
    await migrateLegacyIfNeeded();
    committed.length = 0;
    expect(await migrateLegacyIfNeeded()).toBe(false);
    expect(committed).toHaveLength(0);
  });

  it("n'écrit rien si la lecture des produits est incomplète (chunk manquant)", async () => {
    seedLegacy();
    store.delete("data/products_0");
    expect(await migrateLegacyIfNeeded()).toBe(false);
    expect(committed).toHaveLength(0);
    expect(JSON.stringify(store.get("data/main"))).toContain("Fatoumata"); // rien de détruit
  });

  it("ne fait rien si data/main n'existe pas", async () => {
    expect(await migrateLegacyIfNeeded()).toBe(false);
  });
});
