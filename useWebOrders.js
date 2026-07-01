import { useEffect, useRef, useState, useCallback } from "react";
import {
  collection, query, where, orderBy, onSnapshot, deleteDoc, doc,
} from "firebase/firestore";
import { getDB } from "./firebase.js";
import { uid, today } from "./utils.js";

// ── Normalisation pour matcher design du site ↔ design du catalogue ─────────
// Le site envoie designId + designName (en MAJUSCULES, cf. firebase-init.js).
// Le catalogue CultureCaseGS stocke product.design comme nom libre.
// On matche d'abord par nom normalisé + modèle (le site n'a pas connaissance
// du productId interne — c'est volontaire, ça découple les deux systèmes).
const normalize = (s) =>
  (s || "").toUpperCase().trim().replace(/['’]/g, "'").replace(/\s+/g, " ");

// ── Commandes du site en attente de validation ───────────────────────────────
//
// Différent de "Livraisons en attente de validation" (data.pendingSales) :
// ici, la commande n'a PAS encore été acceptée par l'admin — aucun stock
// n'est déduit tant que validateWebOrder() n'a pas été appelé. L'admin peut
// rejeter une commande (spam, infos invalides, rupture) sans aucun impact
// sur le stock ou les stats.
//
// Une fois validée, ça passe par exactement le même chemin qu'une vente
// saisie à la main (onSale/addSale) — donc si la commande demandait une
// livraison, elle atterrit ensuite normalement dans "Livraisons en attente
// de validation" comme n'importe quelle autre vente avec livraison.
export function useWebOrders({ data, addSale, toast }) {
  const [webOrders, setWebOrders] = useState([]);
  const [processing, setProcessing] = useState({}); // { [orderId]: true }
  const firstSnapshot = useRef(true);
  const knownIds = useRef(new Set());

  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const playBeep = useCallback(() => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.55);
      // Petit second bip pour que ce soit reconnaissable
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(1180, ctx.currentTime);
        gain2.gain.setValueAtTime(0.001, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.45);
      }, 160);
    } catch (e) { /* silencieux si audio indisponible */ }
  }, []);

  useEffect(() => {
    const db = getDB();
    const q = query(
      collection(db, "webOrders"),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      if (!firstSnapshot.current) {
        const newOnes = list.filter((o) => !knownIds.current.has(o.id));
        if (newOnes.length > 0) {
          playBeep();
          newOnes.forEach((o) => {
            const label = o.client?.nom ? `de ${o.client.nom}` : "";
            toast?.(`🛒 Nouvelle commande site ${label} — ${o.items?.length || 0} article(s)`, "info");
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              try {
                new Notification("Nouvelle commande CultureCase", {
                  body: `${o.client?.nom || "Client"} — ${o.items?.length || 0} article(s)`,
                  tag: "cc-weborder-" + o.id,
                });
              } catch (e) { /* ignore */ }
            }
          });
        }
      }
      knownIds.current = new Set(list.map((o) => o.id));
      firstSnapshot.current = false;
      setWebOrders(list);
    }, (err) => {
      console.error("[CultureCase] Erreur webOrders:", err);
    });
    return unsub;
  }, [playBeep, toast]);

  const rejectWebOrder = useCallback(async (order) => {
    setProcessing((p) => ({ ...p, [order.id]: true }));
    try {
      await deleteDoc(doc(getDB(), "webOrders", order.id));
      toast?.("↩️ Commande site rejetée.", "info");
    } catch (e) {
      console.error("[CultureCase] Erreur rejet commande site:", e);
      toast?.("❌ Erreur lors du rejet — réessaie.", "error");
    } finally {
      setProcessing((p) => { const np = { ...p }; delete np[order.id]; return np; });
    }
  }, [toast]);

  // Résout chaque item de la commande site (designId/designName + model)
  // vers un produit réel du catalogue. Retourne null si un item ne matche
  // pas ou si le stock est insuffisant (la commande reste en attente —
  // rien n'est modifié).
  const resolveOrderItems = useCallback((order) => {
    const products = data?.products || [];
    const resolved = [];
    for (const item of order.items || []) {
      const prod = products.find((p) =>
        normalize(p.design) === normalize(item.designName) && p.model === item.model
      );
      if (!prod) {
        return { error: `Produit introuvable au catalogue : "${item.designName} — ${item.model}". Vérifie que le design/modèle existe toujours, puis réessaie.` };
      }
      if (prod.stock < item.qty) {
        return { error: `Stock insuffisant pour "${prod.model} — ${prod.design}" (${prod.stock} dispo, ${item.qty} demandé). Réapprovisionne ou ajuste avant de valider.` };
      }
      resolved.push({ prod, qty: item.qty });
    }
    return { items: resolved };
  }, [data]);

  const validateWebOrder = useCallback(async (order) => {
    const { items, error } = resolveOrderItems(order);
    if (error) {
      toast?.("❌ " + error, "error");
      return false;
    }

    setProcessing((p) => ({ ...p, [order.id]: true }));
    const groupId = uid();
    const saleDate = today();
    const newSales = items.map(({ prod, qty }) => ({
      id: uid(), groupId, date: saleDate,
      productId: prod.id, qty,
      price: prod.price, total: prod.price * qty,
      discountType: "none", discountPercent: 0, discountAmount: 0,
      totalAfterDiscount: prod.price * qty,
      discountReason: "",
      client: order.client?.nom || "", phone: order.client?.tel || "",
      quartier: order.client?.quartier || "",
      delivery: !!order.delivery,
      remarque: "Commande passée depuis le site",
    }));

    try {
      addSale(newSales);
      await deleteDoc(doc(getDB(), "webOrders", order.id));
      toast?.(
        order.delivery
          ? "✅ Commande validée — en attente de confirmation de livraison."
          : "✅ Commande validée — vente enregistrée.",
        "success",
      );
      return true;
    } catch (e) {
      console.error("[CultureCase] Erreur validation commande site:", e);
      toast?.("❌ Erreur lors de la validation — réessaie.", "error");
      return false;
    } finally {
      setProcessing((p) => { const np = { ...p }; delete np[order.id]; return np; });
    }
  }, [addSale, resolveOrderItems, toast]);

  return { webOrders, processing, validateWebOrder, rejectWebOrder };
}
