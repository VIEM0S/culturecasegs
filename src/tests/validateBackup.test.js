import { describe, it, expect } from "vitest";

// ── On teste validateBackup en la réexportant via un helper ──────────────────
// validateBackup est privée dans data.js — on la duplique ici pour les tests
// (alternative : l'exporter avec un underscore _ en convention de test)

function validateBackup(parsed) {
  const errors = [];
  if (!parsed || typeof parsed !== "object") return ["Le fichier n'est pas un objet JSON valide."];
  if (!Array.isArray(parsed.products))  errors.push("Champ 'products' manquant ou invalide.");
  if (!Array.isArray(parsed.sales))     errors.push("Champ 'sales' manquant ou invalide.");
  if (!Array.isArray(parsed.movements)) errors.push("Champ 'movements' manquant (sera vide).");
  if (typeof parsed.settings !== "object" || parsed.settings === null) errors.push("Champ 'settings' manquant ou invalide.");
  if (errors.length) return errors;

  parsed.products.forEach((p, i) => {
    if (!p.id)    errors.push(`Produit #${i+1} : champ 'id' manquant.`);
    if (!p.model) errors.push(`Produit #${i+1} : champ 'model' manquant.`);
    if (typeof p.stock !== "number" || p.stock < 0) errors.push(`Produit #${i+1} : stock invalide (${p.stock}).`);
  });
  parsed.sales.forEach((s, i) => {
    if (!s.id)        errors.push(`Vente #${i+1} : champ 'id' manquant.`);
    if (!s.productId) errors.push(`Vente #${i+1} : champ 'productId' manquant.`);
    if (!s.date)      errors.push(`Vente #${i+1} : champ 'date' manquant.`);
    if (typeof s.qty !== "number" || s.qty < 1) errors.push(`Vente #${i+1} : quantité invalide (${s.qty}).`);
  });
  parsed.movements.forEach((m, i) => {
    if (!m.id)        errors.push(`Mouvement #${i+1} : champ 'id' manquant.`);
    if (!m.productId) errors.push(`Mouvement #${i+1} : champ 'productId' manquant.`);
    if (!["in", "out"].includes(m.type)) errors.push(`Mouvement #${i+1} : type invalide (${m.type}).`);
  });

  const productIds = new Set(parsed.products.map(p => p.id));
  const orphanSales = parsed.sales.filter(s => !productIds.has(s.productId));
  if (orphanSales.length > 0) errors.push(`${orphanSales.length} vente(s) référencent des produits inexistants.`);

  return errors.slice(0, 5);
}

// ─────────────────────────────────────────────────────────────────────────────
const validBackup = {
  products:  [{ id: "p1", model: "iPhone 12", design: "Afro Queen", stock: 5 }],
  sales:     [{ id: "s1", productId: "p1", date: "2026-05-19", qty: 2, total: 7000 }],
  movements: [{ id: "m1", productId: "p1", type: "in", qty: 5 }],
  settings:  { models: ["iPhone 12"] },
};

describe("validateBackup", () => {
  it("accepte un backup valide sans erreur", () => {
    expect(validateBackup(validBackup)).toEqual([]);
  });

  it("rejette null", () => {
    expect(validateBackup(null).length).toBeGreaterThan(0);
  });

  it("rejette un backup sans products", () => {
    const { products, ...rest } = validBackup;
    expect(validateBackup(rest)).toContain("Champ 'products' manquant ou invalide.");
  });

  it("rejette un backup sans sales", () => {
    const { sales, ...rest } = validBackup;
    expect(validateBackup(rest)).toContain("Champ 'sales' manquant ou invalide.");
  });

  it("rejette un backup sans movements", () => {
    const { movements, ...rest } = validBackup;
    expect(validateBackup(rest)).toContain("Champ 'movements' manquant (sera vide).");
  });

  it("rejette un backup sans settings", () => {
    const { settings, ...rest } = validBackup;
    expect(validateBackup(rest)).toContain("Champ 'settings' manquant ou invalide.");
  });

  it("rejette un produit sans id", () => {
    const backup = { ...validBackup, products: [{ model: "iPhone 12", stock: 5 }] };
    const errors = validateBackup(backup);
    expect(errors.some(e => e.includes("id"))).toBe(true);
  });

  it("rejette un produit avec stock négatif", () => {
    const backup = { ...validBackup, products: [{ id: "p1", model: "iPhone 12", stock: -1 }] };
    const errors = validateBackup(backup);
    expect(errors.some(e => e.includes("stock invalide"))).toBe(true);
  });

  it("rejette une vente orpheline (productId inexistant)", () => {
    const backup = {
      ...validBackup,
      sales: [{ id: "s1", productId: "INEXISTANT", date: "2026-05-19", qty: 1 }],
    };
    const errors = validateBackup(backup);
    expect(errors.some(e => e.includes("produits inexistants"))).toBe(true);
  });

  it("rejette un mouvement avec type invalide", () => {
    const backup = {
      ...validBackup,
      movements: [{ id: "m1", productId: "p1", type: "invalid" }],
    };
    const errors = validateBackup(backup);
    expect(errors.some(e => e.includes("type invalide"))).toBe(true);
  });

  it("limite à 5 erreurs maximum", () => {
    const backup = {
      products: [
        { model: "A", stock: -1 }, // id manquant + stock invalide
        { model: "B", stock: -1 },
        { model: "C", stock: -1 },
        { model: "D", stock: -1 },
      ],
      sales: [], movements: [], settings: {},
    };
    expect(validateBackup(backup).length).toBeLessThanOrEqual(5);
  });
});
