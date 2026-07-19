import { describe, it, expect, vi } from "vitest";

// useWebOrders.js importe ./firebase.js au chargement du module, ce qui
// déclenche getAuth(app) et plante en environnement de test (pas de vraies
// clés Firebase). On ne teste ici que la logique pure (normalize,
// resolveOrderItems), donc on mocke le module firebase pour l'isoler.
vi.mock("../firebase.js", () => ({ getDB: () => ({}) }));

import { normalize, resolveOrderItems } from "../useWebOrders.js";

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeProduct(overrides = {}) {
  return {
    id: "p1",
    model: "iPhone 12",
    design: "Afro Queen",
    stock: 10,
    price: 3500,
    ...overrides,
  };
}

function makeOrder(items) {
  return { id: "order1", items };
}

// ── normalize ────────────────────────────────────────────────────────────────
describe("normalize", () => {
  it("met en majuscules et trim", () => {
    expect(normalize("  afro queen  ")).toBe("AFRO QUEEN");
  });

  it("uniformise les apostrophes typographiques", () => {
    expect(normalize("Reine d’Afrique")).toBe("REINE D'AFRIQUE");
  });

  it("réduit les espaces multiples", () => {
    expect(normalize("Afro    Queen")).toBe("AFRO QUEEN");
  });

  it("gère une valeur vide/undefined sans planter", () => {
    expect(normalize(undefined)).toBe("");
    expect(normalize("")).toBe("");
  });
});

// ── resolveOrderItems ────────────────────────────────────────────────────────
describe("resolveOrderItems", () => {
  it("résout un item qui matche exactement design + modèle", () => {
    const products = [makeProduct()];
    const order = makeOrder([{ designName: "Afro Queen", model: "iPhone 12", qty: 2 }]);
    const result = resolveOrderItems(order, products);
    expect(result.error).toBeUndefined();
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual({ prod: products[0], qty: 2 });
  });

  it("matche malgré une casse et des espaces différents sur le design", () => {
    const products = [makeProduct()];
    const order = makeOrder([{ designName: "  afro   queen ", model: "iPhone 12", qty: 1 }]);
    const result = resolveOrderItems(order, products);
    expect(result.error).toBeUndefined();
    expect(result.items[0].prod.id).toBe("p1");
  });

  it("renvoie une erreur si le design n'existe plus au catalogue", () => {
    const products = [makeProduct()];
    const order = makeOrder([{ designName: "Design Disparu", model: "iPhone 12", qty: 1 }]);
    const result = resolveOrderItems(order, products);
    expect(result.error).toMatch(/introuvable au catalogue/);
    expect(result.items).toBeUndefined();
  });

  it("renvoie une erreur si le modèle ne matche pas (design identique)", () => {
    const products = [makeProduct({ model: "iPhone 12" })];
    const order = makeOrder([{ designName: "Afro Queen", model: "Samsung A54", qty: 1 }]);
    const result = resolveOrderItems(order, products);
    expect(result.error).toMatch(/introuvable au catalogue/);
  });

  it("renvoie une erreur si le stock est insuffisant", () => {
    const products = [makeProduct({ stock: 1 })];
    const order = makeOrder([{ designName: "Afro Queen", model: "iPhone 12", qty: 5 }]);
    const result = resolveOrderItems(order, products);
    expect(result.error).toMatch(/Stock insuffisant/);
    expect(result.error).toMatch(/1 dispo, 5 demandé/);
  });

  it("accepte une commande qui demande exactement le stock restant", () => {
    const products = [makeProduct({ stock: 3 })];
    const order = makeOrder([{ designName: "Afro Queen", model: "iPhone 12", qty: 3 }]);
    const result = resolveOrderItems(order, products);
    expect(result.error).toBeUndefined();
  });

  it("résout plusieurs items dans la même commande", () => {
    const products = [
      makeProduct({ id: "p1", design: "Afro Queen", model: "iPhone 12" }),
      makeProduct({ id: "p2", design: "Bogolan", model: "Samsung A54", stock: 5 }),
    ];
    const order = makeOrder([
      { designName: "Afro Queen", model: "iPhone 12", qty: 1 },
      { designName: "Bogolan", model: "Samsung A54", qty: 2 },
    ]);
    const result = resolveOrderItems(order, products);
    expect(result.error).toBeUndefined();
    expect(result.items).toHaveLength(2);
    expect(result.items.map((i) => i.prod.id)).toEqual(["p1", "p2"]);
  });

  it("s'arrête au premier item invalide sans résoudre les suivants", () => {
    const products = [makeProduct({ id: "p1", design: "Afro Queen", model: "iPhone 12" })];
    const order = makeOrder([
      { designName: "Design Disparu", model: "iPhone 12", qty: 1 },
      { designName: "Afro Queen", model: "iPhone 12", qty: 1 },
    ]);
    const result = resolveOrderItems(order, products);
    expect(result.error).toMatch(/introuvable au catalogue/);
  });

  it("gère une commande sans items", () => {
    const result = resolveOrderItems(makeOrder([]), [makeProduct()]);
    expect(result.error).toBeUndefined();
    expect(result.items).toEqual([]);
  });

  it("gère un catalogue produits vide", () => {
    const order = makeOrder([{ designName: "Afro Queen", model: "iPhone 12", qty: 1 }]);
    const result = resolveOrderItems(order, []);
    expect(result.error).toMatch(/introuvable au catalogue/);
  });

  // ── Fallback renommage (previousNames) ───────────────────────────────────
  it("matche via previousNames si le design a été renommé depuis la commande", () => {
    const products = [makeProduct({ design: "Reine du Sahel" })]; // nouveau nom
    const designs = [{ id: "d1", name: "Reine du Sahel", previousNames: ["Afro Queen"] }];
    const order = makeOrder([{ designName: "Afro Queen", model: "iPhone 12", qty: 1 }]); // ancien nom envoyé par le site
    const result = resolveOrderItems(order, products, designs);
    expect(result.error).toBeUndefined();
    expect(result.items[0].prod.design).toBe("Reine du Sahel");
  });

  it("ignore le fallback si aucun design ne référence ce previousName", () => {
    const products = [makeProduct({ design: "Reine du Sahel" })];
    const designs = [{ id: "d1", name: "Reine du Sahel", previousNames: ["Autre Ancien Nom"] }];
    const order = makeOrder([{ designName: "Afro Queen", model: "iPhone 12", qty: 1 }]);
    const result = resolveOrderItems(order, products, designs);
    expect(result.error).toMatch(/introuvable au catalogue/);
  });

  it("fonctionne sans argument designs (rétrocompatibilité)", () => {
    const products = [makeProduct()];
    const order = makeOrder([{ designName: "Afro Queen", model: "iPhone 12", qty: 1 }]);
    const result = resolveOrderItems(order, products);
    expect(result.error).toBeUndefined();
  });
});
