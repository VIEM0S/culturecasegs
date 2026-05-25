import { describe, it, expect, vi, beforeEach } from "vitest";

// ── On teste la logique pure des actions, sans React ─────────────────────────
// On extrait directement les fonctions pures de useStockActions
// sans passer par renderHook (pas besoin de React ici)

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

function makeData(overrides = {}) {
  return {
    products: [makeProduct()],
    sales: [],
    movements: [],
    settings: { models: ["iPhone 12"], designs: [] },
    ...overrides,
  };
}

function makeSale(overrides = {}) {
  return {
    id: "s1",
    groupId: "g1",
    productId: "p1",
    qty: 2,
    price: 3500,
    total: 7000,
    totalAfterDiscount: 7000,
    date: "2026-05-19T14:00:00.000Z",
    client: "Fatou",
    ...overrides,
  };
}

// ── Logique pure extraite de useStockActions ──────────────────────────────────
// Ces fonctions sont la logique métier pure, testable sans hooks React.

function applyAddSale(data, sales) {
  const list = Array.isArray(sales) ? sales : [sales];
  let products = [...data.products];
  const newMovements = [];
  for (const sale of list) {
    products = products.map(p =>
      p.id === sale.productId ? { ...p, stock: Math.max(0, p.stock - sale.qty) } : p
    );
    newMovements.push({
      id: "mov-" + sale.id,
      productId: sale.productId,
      type: "out",
      qty: sale.qty,
      reason: "Vente",
      date: sale.date,
      note: sale.client || "",
    });
  }
  return { ...data, products, sales: [...data.sales, ...list], movements: [...data.movements, ...newMovements] };
}

function applyCancelSale(data, saleGroup) {
  const list = Array.isArray(saleGroup) ? saleGroup : [saleGroup];
  const cancelledIds = new Set(list.map(s => s.id));
  let products = [...data.products];
  const newMovements = [];
  for (const sale of list) {
    products = products.map(p =>
      p.id === sale.productId ? { ...p, stock: p.stock + sale.qty } : p
    );
    newMovements.push({
      id: "mov-cancel-" + sale.id,
      productId: sale.productId,
      type: "in",
      qty: sale.qty,
      reason: "Annulation vente",
      date: new Date().toISOString(),
      note: sale.client ? `Remboursement ${sale.client}` : "Vente annulée",
    });
  }
  return {
    ...data,
    products,
    sales: data.sales.filter(s => !cancelledIds.has(s.id)),
    movements: [...data.movements, ...newMovements],
  };
}

function applyAddMovement(data, movs) {
  const list = Array.isArray(movs) ? movs : [movs];
  let products = [...data.products];
  for (const mov of list) {
    products = products.map(p => {
      if (p.id !== mov.productId) return p;
      return {
        ...p,
        stock: mov.type === "in"
          ? p.stock + mov.qty
          : Math.max(0, p.stock - mov.qty),
      };
    });
  }
  return { ...data, products, movements: [...data.movements, ...list] };
}

function applySaveProduct(data, product) {
  const list = Array.isArray(product) ? product : [product];
  let products = [...data.products];
  list.forEach(p => {
    const exists = products.find(x => x.id === p.id);
    if (exists) products = products.map(x => x.id === p.id ? p : x);
    else products = [...products, p];
  });
  return { ...data, products };
}

// ─────────────────────────────────────────────────────────────────────────────
// addSale
// ─────────────────────────────────────────────────────────────────────────────
describe("addSale — logique pure", () => {
  it("décrémente le stock du produit vendu", () => {
    const data   = makeData();
    const sale   = makeSale({ qty: 3 });
    const result = applyAddSale(data, sale);
    expect(result.products[0].stock).toBe(7); // 10 - 3
  });

  it("ne passe pas en dessous de 0", () => {
    const data   = makeData({ products: [makeProduct({ stock: 1 })] });
    const sale   = makeSale({ qty: 5 });
    const result = applyAddSale(data, sale);
    expect(result.products[0].stock).toBe(0);
  });

  it("ajoute la vente dans data.sales", () => {
    const data   = makeData();
    const sale   = makeSale();
    const result = applyAddSale(data, sale);
    expect(result.sales).toHaveLength(1);
    expect(result.sales[0].id).toBe("s1");
  });

  it("ajoute un mouvement de sortie automatique", () => {
    const data   = makeData();
    const sale   = makeSale({ qty: 2 });
    const result = applyAddSale(data, sale);
    expect(result.movements).toHaveLength(1);
    expect(result.movements[0].type).toBe("out");
    expect(result.movements[0].qty).toBe(2);
    expect(result.movements[0].reason).toBe("Vente");
  });

  it("gère une liste de ventes multi-produits", () => {
    const data = makeData({
      products: [
        makeProduct({ id: "p1", stock: 10 }),
        makeProduct({ id: "p2", stock: 5, design: "BLM" }),
      ],
    });
    const sales = [
      makeSale({ id: "s1", productId: "p1", qty: 2 }),
      makeSale({ id: "s2", productId: "p2", qty: 3 }),
    ];
    const result = applyAddSale(data, sales);
    expect(result.products.find(p => p.id === "p1").stock).toBe(8);
    expect(result.products.find(p => p.id === "p2").stock).toBe(2);
    expect(result.sales).toHaveLength(2);
    expect(result.movements).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cancelSale
// ─────────────────────────────────────────────────────────────────────────────
describe("cancelSale — logique pure", () => {
  it("remet le stock à son niveau avant vente", () => {
    const sale   = makeSale({ qty: 3 });
    const data   = makeData({ sales: [sale], products: [makeProduct({ stock: 7 })] });
    const result = applyCancelSale(data, sale);
    expect(result.products[0].stock).toBe(10); // 7 + 3
  });

  it("retire la vente de data.sales", () => {
    const sale   = makeSale();
    const data   = makeData({ sales: [sale] });
    const result = applyCancelSale(data, sale);
    expect(result.sales).toHaveLength(0);
  });

  it("ajoute un mouvement d'entrée (remboursement)", () => {
    const sale   = makeSale({ qty: 2, client: "Fatou" });
    const data   = makeData({ sales: [sale] });
    const result = applyCancelSale(data, sale);
    expect(result.movements).toHaveLength(1);
    expect(result.movements[0].type).toBe("in");
    expect(result.movements[0].qty).toBe(2);
    expect(result.movements[0].reason).toBe("Annulation vente");
    expect(result.movements[0].note).toContain("Fatou");
  });

  it("gère l'annulation sans nom de client", () => {
    const sale   = makeSale({ client: "" });
    const data   = makeData({ sales: [sale] });
    const result = applyCancelSale(data, sale);
    expect(result.movements[0].note).toBe("Vente annulée");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// addMovement
// ─────────────────────────────────────────────────────────────────────────────
describe("addMovement — logique pure", () => {
  it("entrée : incrémente le stock", () => {
    const data = makeData();
    const mov  = { id: "m1", productId: "p1", type: "in", qty: 5, reason: "Réapprovisionnement", date: "2026-05-19" };
    const result = applyAddMovement(data, mov);
    expect(result.products[0].stock).toBe(15);
  });

  it("sortie : décrémente le stock", () => {
    const data = makeData();
    const mov  = { id: "m1", productId: "p1", type: "out", qty: 4, reason: "Casse", date: "2026-05-19" };
    const result = applyAddMovement(data, mov);
    expect(result.products[0].stock).toBe(6);
  });

  it("sortie : ne passe pas en dessous de 0", () => {
    const data = makeData({ products: [makeProduct({ stock: 2 })] });
    const mov  = { id: "m1", productId: "p1", type: "out", qty: 10, reason: "Casse", date: "2026-05-19" };
    const result = applyAddMovement(data, mov);
    expect(result.products[0].stock).toBe(0);
  });

  it("ajoute le mouvement dans data.movements", () => {
    const data   = makeData();
    const mov    = { id: "m1", productId: "p1", type: "in", qty: 3, reason: "Test", date: "2026-05-19" };
    const result = applyAddMovement(data, mov);
    expect(result.movements).toHaveLength(1);
    expect(result.movements[0].id).toBe("m1");
  });

  it("n'affecte pas les autres produits", () => {
    const data = makeData({
      products: [
        makeProduct({ id: "p1", stock: 10 }),
        makeProduct({ id: "p2", stock: 5, design: "BLM" }),
      ],
    });
    const mov    = { id: "m1", productId: "p1", type: "out", qty: 3, reason: "Test", date: "2026-05-19" };
    const result = applyAddMovement(data, mov);
    expect(result.products.find(p => p.id === "p2").stock).toBe(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// saveProduct
// ─────────────────────────────────────────────────────────────────────────────
describe("saveProduct — logique pure", () => {
  it("met à jour un produit existant", () => {
    const data    = makeData();
    const updated = makeProduct({ stock: 20, design: "Afro Queen Updated" });
    const result  = applySaveProduct(data, updated);
    expect(result.products).toHaveLength(1);
    expect(result.products[0].stock).toBe(20);
    expect(result.products[0].design).toBe("Afro Queen Updated");
  });

  it("ajoute un nouveau produit s'il n'existe pas", () => {
    const data       = makeData();
    const newProduct = makeProduct({ id: "p2", design: "BLM" });
    const result     = applySaveProduct(data, newProduct);
    expect(result.products).toHaveLength(2);
    expect(result.products[1].id).toBe("p2");
  });

  it("gère une liste de produits", () => {
    const data     = makeData();
    const products = [
      makeProduct({ stock: 20 }),
      makeProduct({ id: "p2", design: "BLM", stock: 5 }),
    ];
    const result = applySaveProduct(data, products);
    expect(result.products).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cohérence : addSale → cancelSale = stock initial
// ─────────────────────────────────────────────────────────────────────────────
describe("cohérence addSale + cancelSale", () => {
  it("annuler une vente remet exactement le stock initial", () => {
    const stockInitial = 10;
    const data  = makeData({ products: [makeProduct({ stock: stockInitial })] });
    const sale  = makeSale({ qty: 4 });

    const afterSale   = applyAddSale(data, sale);
    expect(afterSale.products[0].stock).toBe(6);

    const afterCancel = applyCancelSale({ ...afterSale, sales: afterSale.sales }, sale);
    expect(afterCancel.products[0].stock).toBe(stockInitial);
  });
});
