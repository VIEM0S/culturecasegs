import { useEffect, useRef, useState, useCallback } from "react";
import {
  collection, query, where, orderBy, onSnapshot, updateDoc, doc, serverTimestamp,
  getDocs, addDoc, deleteDoc,
} from "firebase/firestore";
import { getDB } from "./firebase.js";
import { uid, today } from "./utils.js";

const ARCHIVE_AFTER_DAYS = 30;
const REMIND_DAY_1 = 5;
const REMIND_DAY_2 = 10;
const AUTO_REJECT_DAY = 15;
const CLEANUP_THROTTLE_KEY = "cc_admin_last_web_order_cleanup";
const DAY_MS = 24 * 60 * 60 * 1000;

function notifyAdmin(title, body) {
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try { new Notification(title, { body }); } catch (e) { /* ignore */ }
  }
}

// ── Commandes "pending" oubliées : relance à 5j, relance à 10j, rejet
// automatique à 15j ─────────────────────────────────────────────────────────
// Une commande jamais traitée par l'admin (spam, oubli) resterait sinon en
// attente indéfiniment, avec les coordonnées complètes du client. On
// prévient deux fois puis on tranche : rejet auto (motif explicite, visible
// par le client sur son suivi), qui rejoint ensuite le nettoyage 30j normal.
async function checkStalePendingOrders(db, toast) {
  const q = query(collection(db, "webOrders"), where("status", "==", "pending"));
  const snap = await getDocs(q);
  const now = Date.now();

  for (const d of snap.docs) {
    const order = d.data();
    const createdAt = order.createdAt?.toDate?.();
    if (!createdAt) continue;
    const ageDays = (now - createdAt.getTime()) / DAY_MS;
    const nom = order.client?.nom || "Client sans nom";

    if (ageDays >= AUTO_REJECT_DAY) {
      await updateDoc(d.ref, {
        status: "rejected",
        rejectReason: "Non traitée sous 15 jours — rejet automatique.",
        rejectedAt: serverTimestamp(),
        rejectedBy: "auto",
      });
      toast?.(`⏱️ Commande de ${nom} rejetée automatiquement (non traitée depuis 15 jours).`, "info");
      notifyAdmin("Commande auto-rejetée", `${nom} — non traitée depuis 15 jours.`);
    } else if (ageDays >= REMIND_DAY_2 && !order.notifiedDay10) {
      await updateDoc(d.ref, { notifiedDay10: true });
      toast?.(`⚠️ Commande de ${nom} en attente depuis 10 jours — rejet auto dans 5 jours si rien n'est fait.`, "info");
      notifyAdmin("Commande site en attente (10j)", `${nom} — rejet auto dans 5 jours si non traitée.`);
    } else if (ageDays >= REMIND_DAY_1 && !order.notifiedDay5) {
      await updateDoc(d.ref, { notifiedDay5: true });
      toast?.(`⏰ Commande de ${nom} en attente depuis 5 jours — pense à la traiter.`, "info");
      notifyAdmin("Commande site en attente (5j)", `${nom} — en attente depuis 5 jours.`);
    }
  }
}

// ── Nettoyage auto des commandes site traitées (accepted/rejected/
// cancelled) depuis 30j+ ────────────────────────────────────────────────────
// Objectif : ne pas garder indéfiniment les coordonnées client (nom,
// téléphone) dans webOrders une fois la commande traitée et le lien de
// suivi devenu sans intérêt. Avant suppression, un résumé léger (sans le
// nom) part dans webOrdersArchive — utile pour repérer les zones fortes/
// faibles avant une campagne pub, sans garder l'identité complète.
async function archiveResolvedOrders(db) {
  const q = query(
    collection(db, "webOrders"),
    where("status", "in", ["accepted", "rejected", "cancelled"]),
  );
  const snap = await getDocs(q);
  const cutoff = Date.now() - ARCHIVE_AFTER_DAYS * DAY_MS;

  for (const d of snap.docs) {
    const order = d.data();
    const resolvedAt = (order.cancelledAt || order.rejectedAt || order.acceptedAt)?.toDate?.();
    if (!resolvedAt || resolvedAt.getTime() > cutoff) continue;

    await addDoc(collection(db, "webOrdersArchive"), {
      date: order.createdAt || null,
      quartier: order.client?.quartier || "",
      tel: order.client?.tel || "",
      delivery: !!order.delivery,
      items: (order.items || []).map((it) => ({
        designName: it.designName || "", model: it.model || "", qty: it.qty || 0,
      })),
      total: order.total || 0,
      status: order.status,
      archivedAt: serverTimestamp(),
    });
    await deleteDoc(d.ref);
  }
}

// Se déclenche une seule fois par jour et par appareil admin (throttle
// localStorage) à l'ouverture du backoffice — pas de Cloud Function, pas
// de config Firebase externe, donc gratuit.
async function runWebOrdersCleanup(toast) {
  try {
    const lastRun = localStorage.getItem(CLEANUP_THROTTLE_KEY);
    const todayStr = new Date().toISOString().slice(0, 10);
    if (lastRun === todayStr) return;
    localStorage.setItem(CLEANUP_THROTTLE_KEY, todayStr);

    const db = getDB();
    await checkStalePendingOrders(db, toast);
    await archiveResolvedOrders(db);
  } catch (e) {
    console.error("[CultureCase] Erreur nettoyage webOrders:", e);
  }
}

// ── Normalisation pour matcher design du site ↔ design du catalogue ─────────
// Le site envoie designId + designName (en MAJUSCULES, cf. firebase-init.js).
// Le catalogue CultureCaseGS stocke product.design comme nom libre.
// On matche d'abord par nom normalisé + modèle (le site n'a pas connaissance
// du productId interne — c'est volontaire, ça découple les deux systèmes).
export const normalize = (s) =>
  (s || "").toUpperCase().trim().replace(/['’]/g, "'").replace(/\s+/g, " ");

// ── Résolution pure (testable indépendamment du hook React) ─────────────────
// Résout chaque item de la commande site (designId/designName + model)
// vers un produit réel du catalogue. Retourne { error } si un item ne matche
// pas ou si le stock est insuffisant (la commande reste en attente —
// rien n'est modifié), sinon { items: [{ prod, qty }] }.
//
// `designs` (optionnel) : liste settings.designs, utilisée en repli quand le
// nom envoyé par le site ne matche plus aucun produit — cas d'un design
// renommé côté catalogue après que la commande a été passée sur le site.
// Chaque design peut porter un historique `previousNames` (voir
// SettingsPage.jsx confirmEditDesign) permettant de retrouver son nom actuel.
export function resolveOrderItems(order, products, designs = []) {
  const resolved = [];
  for (const item of order.items || []) {
    let prod = products.find((p) =>
      normalize(p.design) === normalize(item.designName) && p.model === item.model
    );

    if (!prod) {
      const renamedDesign = designs.find((d) =>
        (d.previousNames || []).some((n) => normalize(n) === normalize(item.designName))
      );
      if (renamedDesign) {
        prod = products.find((p) =>
          normalize(p.design) === normalize(renamedDesign.name) && p.model === item.model
        );
      }
    }

    if (!prod) {
      return { error: `Produit introuvable au catalogue : "${item.designName} — ${item.model}". Vérifie que le design/modèle existe toujours, puis réessaie.` };
    }
    if (prod.stock < item.qty) {
      return { error: `Stock insuffisant pour "${prod.model} — ${prod.design}" (${prod.stock} dispo, ${item.qty} demandé). Réapprovisionne ou ajuste avant de valider.` };
    }
    resolved.push({ prod, qty: item.qty });
  }
  return { items: resolved };
}

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

  useEffect(() => {
    runWebOrdersCleanup(toast);
  }, [toast]);

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

  // Le document n'est plus supprimé (delete) mais conservé avec son statut
  // changé — nécessaire pour que la page de suivi client continue de
  // fonctionner après la décision de l'admin (le jeton de suivi pointe
  // toujours vers ce document).
  const rejectWebOrder = useCallback(async (order, reason) => {
    setProcessing((p) => ({ ...p, [order.id]: true }));
    try {
      await updateDoc(doc(getDB(), "webOrders", order.id), {
        status: "rejected",
        rejectReason: reason || "",
        rejectedAt: serverTimestamp(),
      });
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
  const resolveOrder = useCallback((order) => resolveOrderItems(order, data?.products || [], data?.settings?.designs || []), [data]);

  const validateWebOrder = useCallback(async (order) => {
    const { items, error } = resolveOrder(order);
    if (error) {
      toast?.("❌ " + error, "error");
      return false;
    }

    setProcessing((p) => ({ ...p, [order.id]: true }));
    const groupId = uid();
    const saleDate = today();
    const newSales = items.map(({ prod, qty }) => ({
      id: uid(), groupId, date: saleDate,
      webOrderId: order.id, // relie la vente à sa commande site d'origine —
      // permet de reporter une annulation faite après coup (ex. livraison
      // annulée) sur le statut du suivi client, voir cancelWebOrderStatus.
      productId: prod.id, qty,
      price: prod.price, total: prod.price * qty,
      discountType: "none", discountPercent: 0, discountAmount: 0,
      totalAfterDiscount: prod.price * qty,
      discountReason: "",
      client: order.client?.nom || "", phone: order.client?.tel || "",
      quartier: order.client?.quartier || "",
      delivery: !!order.delivery,
      // Une commande du site n'est jamais payée à l'acceptation — que ce
      // soit une livraison (payée à la remise) ou un retrait en magasin
      // (payé à la venue du client) — donc toujours en attente, pas une
      // vente confirmée tant que l'argent n'est pas réellement encaissé.
      pendingPayment: true,
      remarque: "Commande passée depuis le site",
    }));

    try {
      addSale(newSales);
      await updateDoc(doc(getDB(), "webOrders", order.id), {
        status: "accepted",
        acceptedAt: serverTimestamp(),
      });
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
  }, [addSale, resolveOrder, toast]);

  // Une commande site déjà acceptée devient une vente normale, déconnectée
  // du webOrders d'origine dans le flux habituel — donc si cette livraison
  // est ensuite annulée (client non venu / livraison non reçue), le suivi
  // client resterait bloqué sur "Confirmée" pour toujours sans ce pont.
  // Silencieux si ça échoue : l'annulation de la livraison elle-même a déjà
  // réussi et ne doit pas être bloquée par ce report côté suivi.
  const cancelWebOrderStatus = useCallback(async (webOrderId) => {
    if (!webOrderId) return;
    try {
      await updateDoc(doc(getDB(), "webOrders", webOrderId), {
        status: "cancelled",
        cancelledAt: serverTimestamp(),
        cancelledBy: "admin",
      });
    } catch (e) {
      console.error("[CultureCase] Erreur report annulation sur webOrders:", e);
    }
  }, []);

  return { webOrders, processing, validateWebOrder, rejectWebOrder, cancelWebOrderStatus };
}
