import { describe, it, expect } from "vitest";
import {
  toPublicData, toPrivateDoc, mergeAdminData, hasIdentity, newStamp,
  anonymizeSale, anonymizeMovement,
} from "../privateSplit.js";

// ── Données de test avec de l'identité client PARTOUT où elle peut se cacher ──
const makeData = () => ({
  products: [{ id: "p1", model: "iPhone 12", design: "Afro", stock: 5, price: 3500 }],
  settings: { models: ["iPhone 12"], designs: [], viewerCode: "x" },
  sales: [
    { id: "s1", groupId: "g1", productId: "p1", qty: 2, price: 3500, total: 7000, totalAfterDiscount: 6500,
      discountType: "amount", discountPercent: 0, discountAmount: 500, discountReason: "ami de Moussa Traoré",
      date: "2026-05-19T14:00:00.000Z", delivery: true, pendingPayment: false, paid: 6500,
      client: "Fatoumata Diallo", phone: "+22370112233", quartier: "Hamdallaye", remarque: "sonner 2 fois",
      webOrderId: "AbCdEf123456TOKEN" },
  ],
  pendingSales: [
    { id: "s2", groupId: "g2", productId: "p1", qty: 1, price: 3500, total: 3500, date: "2026-05-20T10:00:00.000Z",
      delivery: true, client: "Oumar Keita", phone: "76001122", quartier: "Badalabougou", webOrderId: "TOKEN2" },
  ],
  movements: [
    { id: "m1", productId: "p1", type: "in", qty: 2, reason: "Annulation vente", date: "2026-05-20T10:00:00.000Z", note: "Remboursement Fatoumata Diallo" },
  ],
  payments: [{ id: "pay1", groupId: "g1", amount: 1000, date: "2026-05-21T10:00:00.000Z" }],
  _chunkCount: 1,
});

const PII = ["Fatoumata", "Diallo", "70112233", "Hamdallaye", "sonner", "TOKEN", "Moussa", "Oumar", "76001122", "Badalabougou"];

describe("toPublicData — rien d'identifiant ne doit sortir", () => {
  const pub = toPublicData(makeData());
  const json = JSON.stringify(pub);

  it.each(PII)("ne contient pas « %s »", (needle) => {
    expect(json).not.toContain(needle);
  });

  it("garde les chiffres utiles au tableau de bord partenaire", () => {
    expect(pub.sales[0]).toMatchObject({ id: "s1", productId: "p1", qty: 2, total: 7000, totalAfterDiscount: 6500, delivery: true });
    expect(pub.movements[0]).toMatchObject({ type: "in", qty: 2, reason: "Annulation vente" });
    expect(pub.payments).toEqual(makeData().payments);
    expect(pub.settings.models).toEqual(["iPhone 12"]);
  });

  it("liste blanche : un champ inconnu ajouté plus tard reste privé", () => {
    expect(anonymizeSale({ id: "s", qty: 1, email: "a@b.c", nouveauChamp: "secret" })).toEqual({ id: "s", qty: 1 });
    expect(anonymizeMovement({ id: "m", type: "in", note: "nom du client" })).toEqual({ id: "m", type: "in" });
  });

  it("est idempotent (ré-anonymiser du déjà anonyme ne change rien)", () => {
    expect(toPublicData(pub)).toEqual(pub);
  });

  it("ne plante pas sur des tableaux absents", () => {
    expect(toPublicData({ products: [] })).toMatchObject({ sales: [], pendingSales: [], movements: [], payments: [] });
  });
});

describe("hasIdentity", () => {
  it("détecte l'ancien format et pas le nouveau", () => {
    expect(hasIdentity(makeData())).toBe(true);
    expect(hasIdentity(toPublicData(makeData()))).toBe(false);
  });
  it("une vente sans nom (client de passage) n'est pas une identité", () => {
    expect(hasIdentity({ sales: [{ id: "s", client: "", phone: "" }] })).toBe(false);
  });
});

describe("mergeAdminData", () => {
  const stamp = "T1";
  const full = makeData();
  const main = { ...toPublicData(full), products: [], _privSavedAt: stamp };
  const priv = toPrivateDoc(full, stamp);

  it("ok : recompose exactement les données d'origine, sans tampon résiduel", () => {
    const r = mergeAdminData(main, priv);
    expect(r.status).toBe("ok");
    expect(r.data.sales).toEqual(full.sales);
    expect(r.data.pendingSales).toEqual(full.pendingSales);
    expect(r.data.movements).toEqual(full.movements);
    expect(r.data.payments).toEqual(full.payments);
    expect(r.data._privSavedAt).toBeUndefined();
  });

  it("wait : tampons différents → jamais d'état mélangé", () => {
    expect(mergeAdminData(main, { ...priv, _savedAt: "T0" }).status).toBe("wait");
  });

  it("wait : main récent mais privé absent", () => {
    expect(mergeAdminData(main, null).status).toBe("wait");
  });

  it("legacy : main sans tampon (ancien format) → les données de main sont conservées", () => {
    const r = mergeAdminData(makeData(), null);
    expect(r.status).toBe("legacy");
    expect(r.data.sales[0].client).toBe("Fatoumata Diallo");
  });

  it("legacy : vieil onglet qui a réécrit un main anonymisé → le privé fait foi", () => {
    const staleAnon = { ...toPublicData(full), products: [] }; // pas de tampon
    const r = mergeAdminData(staleAnon, priv);
    expect(r.status).toBe("legacy");
    expect(r.data.sales[0].client).toBe("Fatoumata Diallo");
  });

  it("legacy : main sans tampon MAIS avec identités → main fait foi (on ne l'écrase pas par un privé périmé)", () => {
    const r = mergeAdminData(makeData(), { ...priv, sales: [] });
    expect(r.data.sales).toHaveLength(1);
  });
});

describe("toPrivateDoc / newStamp", () => {
  it("contient le tampon et les 4 tableaux complets", () => {
    const d = toPrivateDoc(makeData(), "S");
    expect(d._savedAt).toBe("S");
    expect(d.sales[0].phone).toBe("+22370112233");
    expect(Object.keys(d).sort()).toEqual(["_savedAt", "movements", "payments", "pendingSales", "sales"]);
  });
  it("newStamp est unique à chaque appel", () => {
    expect(new Set(Array.from({ length: 50 }, newStamp)).size).toBe(50);
  });
});
