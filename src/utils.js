// ── ID unique cryptographiquement sûr (CRITIQUE : remplace Math.random) ──────
export function uid() {
  return crypto.randomUUID();
}

export function sanitize(str, maxLen = 200) {
  if (typeof str !== "string") return "";
  return str.trim().slice(0, maxLen);
}

// ── Seules les URLs https:// sont valides (les formats data: et idb: sont dépréciés) ──
export function validateImageUrl(url) {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateProductForm(form) {
  const errors = {};
  if (!form.model) errors.model = "Modèle requis";
  if (!form.designs || form.designs.length === 0) errors.designs = "Au moins un design requis";
  if (form.stock < 0) errors.stock = "Stock invalide";
  return errors;
}

export function validateSaleForm(form, selectedProduct, qty) {
  const errors = {};
  if (!form.productId) errors.productId = "Produit requis";
  if (!qty || qty < 1) errors.qty = "Quantité invalide";
  if (selectedProduct && qty > selectedProduct.stock) errors.qty = "Stock insuffisant";
  return errors;
}

export function validateMovementForm(form) {
  const errors = {};
  if (!form.lines || form.lines.length === 0) errors.lines = "Ajoutez au moins une ligne";
  form.lines?.forEach((l, i) => {
    if (!l.productId) errors[`line_${i}_product`] = "Produit requis";
    if (!l.qty || l.qty < 1) errors[`line_${i}_qty`] = "Quantité invalide";
  });
  return errors;
}

/**
 * Retourne l'URL de l'image d'un produit.
 * Priorité : image dans settings.designs (source de vérité) → designImage stocké sur le produit.
 * Passer `designs` (settings.designs) pour un résultat toujours à jour.
 */
export function getProductImageUrl(p, designs) {
  if (!p) return "";
  // Chercher dans la liste des designs des paramètres (source de vérité)
  if (designs && Array.isArray(designs)) {
    const found = designs.find(d => d.name === p.design);
    if (found?.image) return found.image;
  }
  // Fallback : image copiée sur le produit au moment de sa création
  return p.designImage || "";
}

/** Date ISO complète avec heure — pour stocker et trier les ventes intra-journalières */
export function today() {
  return new Date().toISOString(); // "2025-05-19T14:32:00.000Z"
}

/** Extrait uniquement la date YYYY-MM-DD d'un ISO string ou d'une date courte */
export function toDateStr(iso) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

/** Date formatée pour l'affichage dans la topbar */
export function todayDisplay() {
  return new Date().toLocaleDateString("fr-FR", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

export function fmtMoney(n, currency = "FCFA") {
  if (!n && n !== 0) return "—";
  return n.toLocaleString("fr-FR") + " " + currency;
}

export function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export function fmtDateTime(d) {
  if (!d) return "—";
  const date = new Date(d);
  const datePart = date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  // Affiche l'heure seulement si la date contient une heure (ISO complet)
  if (d.length > 10) {
    const timePart = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    return `${datePart} ${timePart}`;
  }
  return datePart;
}

// ── exportBackup est défini dans data.js — ne pas dupliquer ici ──────────────
// Importer depuis data.js : import { exportData } from "./data.js";
