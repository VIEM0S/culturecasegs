import { useCallback, useEffect } from "react";
import { uid } from "./utils.js";
import {
  sheetAddSales, sheetCancelSales,
  sheetAddMovements, sheetSyncProducts,
  sheetSyncHistory, setSheetsProductsCache,
} from "./googleSheets.js";

// ── Hook : toutes les actions métier sur les données ─────────────────────────
// (produits, ventes, mouvements, paramètres, migration)
export function useStockActions({ data, persist, confirm }) {

  // Garder le cache produits à jour pour enrichir les données Sheets
  useEffect(() => {
    if (data?.products) setSheetsProductsCache(data.products);
  }, [data?.products]);

  // ── Produits ──────────────────────────────────────────────────────────────
  const saveProduct = useCallback((product) => {
    const list = Array.isArray(product) ? product : [product];
    let products = [...data.products];
    list.forEach((p) => {
      const exists = products.find((x) => x.id === p.id);
      if (exists) products = products.map((x) => (x.id === p.id ? p : x));
      else products = [...products, p];
    });
    persist({ ...data, products });
    sheetSyncProducts(products); // Sync Google Sheets
  }, [data, persist]);

  const deleteProduct = useCallback(async (id) => {
    const ok = await confirm("Supprimer ce produit ?");
    if (!ok) return;
    persist({ ...data, products: data.products.filter((p) => p.id !== id) });
  }, [data, persist, confirm]);

  // ── Mouvements ────────────────────────────────────────────────────────────
  const addMovement = useCallback((movs) => {
    const list = Array.isArray(movs) ? movs : [movs];
    let products = [...data.products];
    for (const mov of list) {
      products = products.map((p) => {
        if (p.id !== mov.productId) return p;
        return {
          ...p,
          stock: mov.type === "in"
            ? p.stock + mov.qty
            : Math.max(0, p.stock - mov.qty),
        };
      });
    }
    persist({ ...data, products, movements: [...data.movements, ...list] });
    sheetAddMovements(list);   // Sync Google Sheets
    sheetSyncProducts(products);
  }, [data, persist]);

  // ── Ventes ────────────────────────────────────────────────────────────────
  //
  // Cas particulier : livraison à domicile.
  // Le stock part avec le livreur immédiatement (on le déduit tout de suite,
  // comme avant), mais la vente n'est PAS comptée dans `data.sales` tant que
  // la livraison n'est pas confirmée — elle attend dans `data.pendingSales`.
  // → Plus besoin d'annuler après coup si le client refuse à la livraison :
  //   il suffit de rejeter la livraison en attente (le stock revient).
  // → Le CA / l'historique / les rapports ne voient la vente qu'une fois
  //   confirmée, donc aucun autre écran n'a besoin de filtrer un statut.
  const addSale = useCallback((sales) => {
    const list = Array.isArray(sales) ? sales : [sales];
    const isDelivery = !!list[0]?.delivery;
    console.log("[addSale] delivery reçu sur la vente :", list[0]?.delivery, "→ isDelivery =", isDelivery, list);

    let products = [...data.products];
    const newMovements = [];
    for (const sale of list) {
      products = products.map((p) =>
        p.id === sale.productId ? { ...p, stock: Math.max(0, p.stock - sale.qty) } : p
      );
      newMovements.push({
        id: uid(),
        productId: sale.productId,
        type: "out",
        qty: sale.qty,
        reason: isDelivery ? "Vente (livraison en attente)" : "Vente",
        date: sale.date,
        note: sale.client || "",
      });
    }

    if (isDelivery) {
      // En attente de confirmation du livreur — pas encore une vente "réelle".
      const pendingSales = [...(data.pendingSales || []), ...list];
      persist({
        ...data,
        products,
        pendingSales,
        movements: [...data.movements, ...newMovements],
      });
      return;
    }

    const allSales = [...data.sales, ...list];
    persist({
      ...data,
      products,
      sales: allSales,
      movements: [...data.movements, ...newMovements],
    });
    sheetAddSales(list);                              // Sync Google Sheets
    sheetSyncProducts(products);
    sheetSyncHistory(allSales, products);
  }, [data, persist]);

  // ── Livraisons en attente : confirmation / rejet ──────────────────────────
  //
  // Confirmer : le livreur a remis la commande → la vente devient réelle
  // (passe dans data.sales, sync Sheets). Le stock a déjà été déduit à la
  // création, donc aucun mouvement de stock supplémentaire ici.
  const confirmDelivery = useCallback((pendingGroup) => {
    const list = Array.isArray(pendingGroup) ? pendingGroup : [pendingGroup];
    const confirmedIds = new Set(list.map(s => s.id));
    const remainingPending = (data.pendingSales || []).filter(s => !confirmedIds.has(s.id));
    const allSales = [...data.sales, ...list];

    persist({
      ...data,
      sales: allSales,
      pendingSales: remainingPending,
    });
    sheetAddSales(list);                              // Sync Google Sheets
    sheetSyncProducts(data.products);
    sheetSyncHistory(allSales, data.products);
  }, [data, persist]);

  // Rejeter : le client n'a pas reçu / a refusé la commande → le stock
  // revient, et la vente disparaît sans jamais avoir compté nulle part.
  const cancelPendingDelivery = useCallback((pendingGroup) => {
    const list = Array.isArray(pendingGroup) ? pendingGroup : [pendingGroup];
    const cancelledIds = new Set(list.map(s => s.id));
    let products = [...data.products];
    const newMovements = [];
    for (const sale of list) {
      products = products.map(p =>
        p.id === sale.productId ? { ...p, stock: p.stock + sale.qty } : p
      );
      newMovements.push({
        id: uid(),
        productId: sale.productId,
        type: "in",
        qty: sale.qty,
        reason: "Livraison annulée",
        date: new Date().toISOString(),
        note: sale.client ? `Non reçu — ${sale.client}` : "Livraison non reçue",
      });
    }
    const remainingPending = (data.pendingSales || []).filter(s => !cancelledIds.has(s.id));
    persist({
      ...data,
      products,
      pendingSales: remainingPending,
      movements: [...data.movements, ...newMovements],
    });
    sheetSyncProducts(products);
  }, [data, persist]);

  const cancelSale = useCallback((saleGroup) => {
    const list = Array.isArray(saleGroup) ? saleGroup : [saleGroup];
    const cancelledIds = new Set(list.map(s => s.id));
    let products = [...data.products];
    const newMovements = [];
    for (const sale of list) {
      products = products.map(p =>
        p.id === sale.productId ? { ...p, stock: p.stock + sale.qty } : p
      );
      newMovements.push({
        id: uid(),
        productId: sale.productId,
        type: "in",
        qty: sale.qty,
        reason: "Annulation vente",
        date: new Date().toISOString(),
        note: sale.client ? `Remboursement ${sale.client}` : "Vente annulée",
      });
    }
    const allSales = data.sales.filter(s => !cancelledIds.has(s.id));
    persist({
      ...data,
      products,
      sales: allSales,
      movements: [...data.movements, ...newMovements],
    });
    sheetCancelSales(list);                           // Sync Google Sheets
    sheetSyncProducts(products);
    sheetSyncHistory(allSales, products);
  }, [data, persist]);

  // ── Paramètres ────────────────────────────────────────────────────────────
  const saveSettings = useCallback(async (newSettings) => {
    const oldSettings = data.settings;
    let products = [...data.products];

    // Renommage de modèles
    const oldModels = oldSettings.models || [];
    const newModels = newSettings.models || [];
    oldModels.forEach((oldName, i) => {
      const newName = newModels[i];
      if (newName && newName !== oldName) {
        products = products.map((p) => p.model === oldName ? { ...p, model: newName } : p);
      }
    });
    const deletedModels = oldModels.filter((m) => !newModels.includes(m));
    if (deletedModels.length > 0) {
      const nb = products.filter((p) => deletedModels.includes(p.model)).length;
      const ok = await confirm(`Supprimer aussi les ${nb} produit${nb > 1 ? "s" : ""} liés aux modèles supprimés ?`);
      if (ok) products = products.filter((p) => !deletedModels.includes(p.model));
    }

    // Renommage de designs
    const oldDesigns = oldSettings.designs || [];
    const newDesigns = newSettings.designs || [];
    oldDesigns.forEach((oldD) => {
      const newD = newDesigns.find((d) => d.id === oldD.id);
      if (newD && newD.name !== oldD.name) {
        products = products.map((p) => p.design === oldD.name ? { ...p, design: newD.name } : p);
      }
    });
    const deletedDesignNames = oldDesigns
      .filter((d) => !newDesigns.find((nd) => nd.id === d.id))
      .map((d) => d.name);
    if (deletedDesignNames.length > 0) {
      const nb = products.filter((p) => deletedDesignNames.includes(p.design)).length;
      const ok = await confirm(`Supprimer aussi les ${nb} produit${nb > 1 ? "s" : ""} liés aux designs supprimés ?`);
      if (ok) products = products.filter((p) => !deletedDesignNames.includes(p.design));
    }

    persist({ ...data, settings: newSettings, products });
  }, [data, persist, confirm]);

  // ── Migration one-shot : groupId sur les anciennes ventes ─────────────────
  useEffect(() => {
    if (!data?.sales) return;
    const needsMigration = data.sales.some(s => !s.groupId);
    if (!needsMigration) return;

    const genId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    const migratedSales = [...data.sales];
    const groups = new Map();

    migratedSales.forEach((s, idx) => {
      if (s.groupId) return;
      const phone = (s.phone || "").trim();
      const name  = (s.client || "").trim();
      const clientKey = phone || name;
      if (!clientKey) return;
      const dateKey = (s.date || "").slice(0, 10);
      const key = `${clientKey}__${dateKey}`;
      if (!groups.has(key)) groups.set(key, { groupId: genId(), indices: [] });
      groups.get(key).indices.push(idx);
    });

    let changed = false;
    groups.forEach(({ groupId, indices }) => {
      const gid = indices.length >= 2 ? groupId : migratedSales[indices[0]].id;
      indices.forEach(idx => { migratedSales[idx] = { ...migratedSales[idx], groupId: gid }; changed = true; });
    });
    migratedSales.forEach((s, idx) => {
      if (!s.groupId) { migratedSales[idx] = { ...s, groupId: s.id }; changed = true; }
    });

    if (changed) {
      console.log("[Migration] groupId ajouté sur les anciennes ventes.");
      persist({ ...data, sales: migratedSales });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.sales?.length, !!data]);

  return {
    saveProduct, deleteProduct, addMovement,
    addSale, cancelSale,
    confirmDelivery, cancelPendingDelivery,
    saveSettings,
  };
}
