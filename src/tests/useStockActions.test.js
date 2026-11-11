import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";

// Ces tests exécutent le VRAI hook useStockActions (pas une copie de sa
// logique) : si le code change ou casse, ils le voient. Seule la sync
// Google Sheets est neutralisée (réseau).
vi.mock("../googleSheets.js", () => ({
  sheetAddSales: vi.fn(), sheetCancelSales: vi.fn(), sheetAddMovements: vi.fn(),
  sheetSyncProducts: vi.fn(), sheetSyncHistory: vi.fn(), setSheetsProductsCache: vi.fn(),
}));

import { useStockActions } from "../useStockActions.js";
import { computeCreances } from "../utils.js";

// ── Helpers ──────────────────────────────────────────────────────────────────
const product = (o = {}) => ({ id: "p1", model: "iPhone 12", design: "Afro Queen", stock: 10, price: 3500, ...o });
const sale = (o = {}) => ({
  id: "s1", groupId: "g1", productId: "p1", qty: 2, price: 3500, total: 7000, totalAfterDiscount: 7000,
  date: "2026-05-19T14:00:00.000Z", client: "Fatou", ...o,
});
const makeData = (o = {}) => ({
  products: [product()], sales: [], pendingSales: [], movements: [], payments: [],
  settings: { models: ["iPhone 12"], designs: [] }, ...o,
});

function setup(data, confirm = async () => true) {
  const persist = vi.fn();
  const { result } = renderHook(() => useStockActions({ data, persist, confirm }));
  return {
    a: result.current,
    persist,
    saved: () => persist.mock.calls.at(-1)[0],
    stock: (id = "p1") => persist.mock.calls.at(-1)[0].products.find((p) => p.id === id).stock,
  };
}

// ── addSale ──────────────────────────────────────────────────────────────────
describe("addSale", () => {
  it("décrémente le stock, ajoute la vente et un mouvement de sortie", () => {
    const t = setup(makeData());
    t.a.addSale([sale({ qty: 3 })]);
    expect(t.stock()).toBe(7);
    expect(t.saved().sales).toHaveLength(1);
    expect(t.saved().movements[0]).toMatchObject({ type: "out", qty: 3, reason: "Vente", note: "Fatou" });
  });

  it("ne passe jamais le stock sous 0", () => {
    const t = setup(makeData({ products: [product({ stock: 2 })] }));
    t.a.addSale([sale({ qty: 5 })]);
    expect(t.stock()).toBe(0);
  });

  it("gère plusieurs produits dans la même vente", () => {
    const t = setup(makeData({ products: [product(), product({ id: "p2", stock: 4 })] }));
    t.a.addSale([sale({ qty: 1 }), sale({ id: "s2", productId: "p2", qty: 2 })]);
    expect(t.stock("p1")).toBe(9);
    expect(t.stock("p2")).toBe(2);
    expect(t.saved().movements).toHaveLength(2);
  });

  it("livraison : va dans pendingSales (pas sales), stock déduit tout de suite", () => {
    const t = setup(makeData());
    t.a.addSale([sale({ delivery: true })]);
    expect(t.saved().sales).toHaveLength(0);
    expect(t.saved().pendingSales).toHaveLength(1);
    expect(t.stock()).toBe(8);
    expect(t.saved().movements[0].reason).toBe("Vente (livraison en attente)");
  });

  it("retrait non payé (pendingPayment) : va aussi dans pendingSales, avec son propre libellé", () => {
    const t = setup(makeData());
    t.a.addSale([sale({ pendingPayment: true })]);
    expect(t.saved().sales).toHaveLength(0);
    expect(t.saved().pendingSales).toHaveLength(1);
    expect(t.saved().movements[0].reason).toBe("Vente (retrait en attente de paiement)");
  });

  it("vente normale : jamais dans pendingSales", () => {
    const t = setup(makeData());
    t.a.addSale([sale()]);
    expect(t.saved().pendingSales).toHaveLength(0);
  });
});

// ── confirmDelivery / cancelPendingDelivery ──────────────────────────────────
describe("confirmDelivery", () => {
  it("déplace de pendingSales vers sales sans toucher au stock", () => {
    const p = sale({ delivery: true });
    const t = setup(makeData({ pendingSales: [p], products: [product({ stock: 8 })] }));
    t.a.confirmDelivery([p]);
    expect(t.saved().sales).toHaveLength(1);
    expect(t.saved().pendingSales).toHaveLength(0);
    expect(t.stock()).toBe(8);
  });

  it("ne confirme que le groupe demandé", () => {
    const g1 = sale({ id: "a", delivery: true });
    const g2 = sale({ id: "b", groupId: "g2", delivery: true });
    const t = setup(makeData({ pendingSales: [g1, g2] }));
    t.a.confirmDelivery([g1]);
    expect(t.saved().pendingSales.map((s) => s.id)).toEqual(["b"]);
  });
});

describe("cancelPendingDelivery", () => {
  it("rend le stock, retire l'attente, ne crée aucune vente", () => {
    const p = sale({ delivery: true });
    const t = setup(makeData({ pendingSales: [p], products: [product({ stock: 8 })] }));
    t.a.cancelPendingDelivery([p]);
    expect(t.stock()).toBe(10);
    expect(t.saved().pendingSales).toHaveLength(0);
    expect(t.saved().sales).toHaveLength(0);
    expect(t.saved().movements[0]).toMatchObject({ type: "in", qty: 2, reason: "Livraison annulée", note: "Non reçu — Fatou" });
  });

  it("note générique quand il n'y a pas de nom de client", () => {
    const p = sale({ delivery: true, client: "" });
    const t = setup(makeData({ pendingSales: [p] }));
    t.a.cancelPendingDelivery([p]);
    expect(t.saved().movements[0].note).toBe("Livraison non reçue");
  });
});

// ── editPendingDelivery ──────────────────────────────────────────────────────
describe("editPendingDelivery", () => {
  const pending = (o = {}) => sale({ id: "old1", delivery: true, quartier: "Hamdallaye", phone: "70112233", remarque: "2 sonneries", ...o });

  it("échange le produit : ancien stock rendu, nouveau déduit", () => {
    const t = setup(makeData({
      pendingSales: [pending()],
      products: [product({ stock: 8 }), product({ id: "p2", design: "Bogolan", stock: 5 })],
    }));
    const r = t.a.editPendingDelivery([pending()], [{ productId: "p2", qty: 3 }]);
    expect(r.error).toBeNull();
    expect(t.stock("p1")).toBe(10);
    expect(t.stock("p2")).toBe(2);
    expect(t.saved().pendingSales).toHaveLength(1);
    expect(t.saved().pendingSales[0]).toMatchObject({ productId: "p2", qty: 3, groupId: "g1", client: "Fatou", quartier: "Hamdallaye", delivery: true });
  });

  it("garder le même produit ne fait pas croire que le stock manque", () => {
    // 8 en rayon + 2 déjà réservés par cette livraison → on peut passer à 10
    const t = setup(makeData({ pendingSales: [pending()], products: [product({ stock: 8 })] }));
    const r = t.a.editPendingDelivery([pending()], [{ productId: "p1", qty: 10 }]);
    expect(r.error).toBeNull();
    expect(t.stock()).toBe(0);
  });

  it("stock insuffisant : erreur ET aucune sauvegarde (jamais d'état intermédiaire)", () => {
    const t = setup(makeData({ pendingSales: [pending()], products: [product({ stock: 8 })] }));
    const r = t.a.editPendingDelivery([pending()], [{ productId: "p1", qty: 11 }]);
    expect(r.error).toMatch(/Stock insuffisant/);
    expect(t.persist).not.toHaveBeenCalled();
  });

  it("produit introuvable : erreur sans sauvegarde", () => {
    const t = setup(makeData({ pendingSales: [pending()] }));
    expect(t.a.editPendingDelivery([pending()], [{ productId: "nope", qty: 1 }]).error).toMatch(/introuvable/);
    expect(t.persist).not.toHaveBeenCalled();
  });

  it("conserve la remise négociée (le % est recalculé sur le nouveau total)", () => {
    const old = pending({ discountType: "custom", discountPercent: 10, discountAmount: 700, discountReason: "fidèle" });
    const t = setup(makeData({ pendingSales: [old], products: [product({ stock: 8 })] }));
    t.a.editPendingDelivery([old], [{ productId: "p1", qty: 4 }]);
    expect(t.saved().pendingSales[0]).toMatchObject({
      discountType: "custom", discountPercent: 10, discountReason: "fidèle",
      total: 14000, discountAmount: 1400, totalAfterDiscount: 12600,
    });
  });

  it("conserve le lien vers la commande du site (sinon l'annulation n'atteint plus le client)", () => {
    const old = pending({ webOrderId: "TOKEN123", pendingPayment: true });
    const t = setup(makeData({ pendingSales: [old], products: [product({ stock: 8 })] }));
    t.a.editPendingDelivery([old], [{ productId: "p1", qty: 1 }]);
    expect(t.saved().pendingSales[0]).toMatchObject({ webOrderId: "TOKEN123", pendingPayment: true });
  });

  it("RÉGRESSION : une livraison à crédit (paid:false) reste à crédit après modification", () => {
    const old = pending({ paid: false });
    const t = setup(makeData({ pendingSales: [old], products: [product({ stock: 8 })] }));
    t.a.editPendingDelivery([old], [{ productId: "p1", qty: 2 }]);
    const line = t.saved().pendingSales[0];
    expect(line.paid).toBe(false);
    // …et une fois livrée, la dette apparaît bien dans les créances
    expect(computeCreances([line], [])).toHaveLength(1);
  });

  it("une vente payée n'acquiert pas de flag paid", () => {
    const t = setup(makeData({ pendingSales: [pending()], products: [product({ stock: 8 })] }));
    t.a.editPendingDelivery([pending()], [{ productId: "p1", qty: 2 }]);
    expect("paid" in t.saved().pendingSales[0]).toBe(false);
  });

  it("journalise une entrée par ancienne ligne et une sortie par nouvelle", () => {
    const t = setup(makeData({ pendingSales: [pending()], products: [product({ stock: 8 })] }));
    t.a.editPendingDelivery([pending()], [{ productId: "p1", qty: 1 }, { productId: "p1", qty: 1 }]);
    const mv = t.saved().movements;
    expect(mv.filter((m) => m.type === "in")).toHaveLength(1);
    expect(mv.filter((m) => m.type === "out")).toHaveLength(2);
  });
});

// ── cancelSale ───────────────────────────────────────────────────────────────
describe("cancelSale", () => {
  it("rend le stock, retire la vente, ajoute un mouvement de remboursement", () => {
    const s = sale();
    const t = setup(makeData({ sales: [s], products: [product({ stock: 8 })] }));
    t.a.cancelSale([s]);
    expect(t.stock()).toBe(10);
    expect(t.saved().sales).toHaveLength(0);
    expect(t.saved().movements[0]).toMatchObject({ type: "in", reason: "Annulation vente", note: "Remboursement Fatou" });
  });

  it("note générique sans nom de client", () => {
    const s = sale({ client: "" });
    const t = setup(makeData({ sales: [s] }));
    t.a.cancelSale([s]);
    expect(t.saved().movements[0].note).toBe("Vente annulée");
  });

  it("n'annule que les lignes demandées", () => {
    const a = sale({ id: "a" });
    const b = sale({ id: "b", productId: "p2" });
    const t = setup(makeData({ sales: [a, b], products: [product(), product({ id: "p2", stock: 1 })] }));
    t.a.cancelSale([a]);
    expect(t.saved().sales.map((s) => s.id)).toEqual(["b"]);
    expect(t.stock("p2")).toBe(1);
  });

  it("COMPORTEMENT CONNU : les règlements déjà encaissés sont conservés (trace d'un argent reçu, à rembourser)", () => {
    const s = sale({ paid: false });
    const pay = { id: "pay1", groupId: "g1", amount: 1000, date: "2026-05-20" };
    const t = setup(makeData({ sales: [s], payments: [pay] }));
    t.a.cancelSale([s]);
    expect(t.saved().payments).toEqual([pay]);
    expect(computeCreances(t.saved().sales, t.saved().payments)).toHaveLength(0); // plus de dette affichée
  });
});

// ── exchangeSale ─────────────────────────────────────────────────────────────
describe("exchangeSale", () => {
  const two = (o = {}) => makeData({
    products: [product({ stock: 8 }), product({ id: "p2", design: "Bogolan", stock: 5 })], ...o,
  });

  it("reprend l'ancien produit, déduit le nouveau, garde prix et chiffre d'affaires", () => {
    const s = sale({ totalAfterDiscount: 6500, discountAmount: 500 });
    const t = setup(two({ sales: [s] }));
    expect(t.a.exchangeSale(s, "p2").error).toBeNull();
    expect(t.stock("p1")).toBe(10);
    expect(t.stock("p2")).toBe(3);
    const after = t.saved().sales[0];
    expect(after).toMatchObject({ productId: "p2", exchangedFrom: "p1", price: 3500, totalAfterDiscount: 6500, qty: 2 });
    expect(after.exchangedAt).toBeTruthy();
    expect(t.saved().sales).toHaveLength(1); // le CA ne bouge pas
  });

  it("refuse si le nouveau produit n'a pas assez de stock (aucune sauvegarde)", () => {
    const s = sale({ qty: 6 });
    const t = setup(two({ sales: [s] }));
    expect(t.a.exchangeSale(s, "p2").error).toMatch(/Stock insuffisant/);
    expect(t.persist).not.toHaveBeenCalled();
  });

  it("refuse le même produit et un produit inconnu", () => {
    const s = sale();
    const t = setup(two({ sales: [s] }));
    expect(t.a.exchangeSale(s, "p1").error).toMatch(/déjà/);
    expect(t.a.exchangeSale(s, "zzz").error).toMatch(/introuvable/);
    expect(t.persist).not.toHaveBeenCalled();
  });

  it("journalise reprise + remplacement", () => {
    const s = sale();
    const t = setup(two({ sales: [s] }));
    t.a.exchangeSale(s, "p2");
    expect(t.saved().movements.map((m) => m.reason)).toEqual(["Échange — reprise", "Échange — remplacement"]);
  });

  it("cohérence : échanger puis annuler remet le stock sur le NOUVEAU produit", () => {
    const s = sale();
    const t1 = setup(two({ sales: [s] }));
    t1.a.exchangeSale(s, "p2");
    const afterExchange = t1.saved();
    const t2 = setup(afterExchange);
    t2.a.cancelSale([afterExchange.sales[0]]);
    expect(t2.stock("p2")).toBe(5); // 3 + 2
    expect(t2.stock("p1")).toBe(10);
  });
});

// ── addPayment (ventes à crédit) ─────────────────────────────────────────────
describe("addPayment + créances", () => {
  const credit = sale({ paid: false, total: 7000, totalAfterDiscount: 7000 });

  it("ajoute un règlement daté sans toucher aux ventes", () => {
    const t = setup(makeData({ sales: [credit] }));
    t.a.addPayment("g1", 2500);
    expect(t.saved().payments).toHaveLength(1);
    expect(t.saved().payments[0]).toMatchObject({ groupId: "g1", amount: 2500 });
    expect(t.saved().payments[0].date).toBeTruthy();
    expect(t.saved().sales).toEqual([credit]);
  });

  it("règlements partiels successifs : le reste dû diminue, puis la créance disparaît", () => {
    let data = makeData({ sales: [credit] });
    const pay = (amount) => { const t = setup(data); t.a.addPayment("g1", amount); data = t.saved(); };

    pay(2500);
    expect(computeCreances(data.sales, data.payments)[0]).toMatchObject({ paidAmount: 2500, remaining: 4500 });
    pay(4500);
    expect(computeCreances(data.sales, data.payments)).toHaveLength(0);
  });

  it("fonctionne même si data.payments est absent (anciennes données)", () => {
    const d = makeData({ sales: [credit] });
    delete d.payments;
    const t = setup(d);
    t.a.addPayment("g1", 100);
    expect(t.saved().payments).toHaveLength(1);
  });
});

// ── addMovement / saveProduct / deleteProduct / saveSettings ─────────────────
describe("addMovement", () => {
  it("entrée +, sortie −, jamais sous 0, autres produits intacts", () => {
    const base = makeData({ products: [product(), product({ id: "p2", stock: 3 })] });
    const inn = setup(base); inn.a.addMovement({ id: "m", productId: "p1", type: "in", qty: 5 });
    expect(inn.stock("p1")).toBe(15);
    expect(inn.stock("p2")).toBe(3);
    const out = setup(base); out.a.addMovement({ id: "m", productId: "p1", type: "out", qty: 99 });
    expect(out.stock("p1")).toBe(0);
    expect(out.saved().movements).toHaveLength(1);
  });
});

describe("saveProduct / deleteProduct", () => {
  it("met à jour un produit existant et ajoute un nouveau", () => {
    const t = setup(makeData());
    t.a.saveProduct([product({ price: 4000 }), product({ id: "p9", stock: 1 })]);
    expect(t.saved().products).toHaveLength(2);
    expect(t.saved().products.find((p) => p.id === "p1").price).toBe(4000);
  });

  it("deleteProduct : supprime si confirmé, ne fait rien sinon", async () => {
    const yes = setup(makeData(), async () => true);
    await yes.a.deleteProduct("p1");
    expect(yes.saved().products).toHaveLength(0);

    const no = setup(makeData(), async () => false);
    await no.a.deleteProduct("p1");
    expect(no.persist).not.toHaveBeenCalled();
  });
});

describe("saveSettings", () => {
  it("renommer un modèle renomme aussi les produits", async () => {
    const t = setup(makeData());
    await t.a.saveSettings({ models: ["iPhone 12 Pro"], designs: [] });
    expect(t.saved().products[0].model).toBe("iPhone 12 Pro");
  });

  it("supprimer un modèle demande confirmation avant de supprimer ses produits", async () => {
    const yes = setup(makeData(), async () => true);
    await yes.a.saveSettings({ models: [], designs: [] });
    expect(yes.saved().products).toHaveLength(0);

    const no = setup(makeData(), async () => false);
    await no.a.saveSettings({ models: [], designs: [] });
    expect(no.saved().products).toHaveLength(1); // réglage enregistré, produits conservés
  });

  it("renommer un design (même id) renomme les produits", async () => {
    const d = makeData({ settings: { models: ["iPhone 12"], designs: [{ id: "D1", name: "Afro Queen" }] } });
    const t = setup(d);
    await t.a.saveSettings({ models: ["iPhone 12"], designs: [{ id: "D1", name: "Afro Reine" }] });
    expect(t.saved().products[0].design).toBe("Afro Reine");
  });
});
