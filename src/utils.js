export function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function sanitize(str, maxLen = 200) {
  if (typeof str !== "string") return "";
  return str.trim().slice(0, maxLen);
}

export function validateImageUrl(url) {
  if (!url) return true;
  if (url.startsWith("data:image/")) return true;
  if (url.startsWith("idb:")) return true;
  try { new URL(url); return true; } catch { return false; }
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

export function getProductImageUrl(p) {
  if (!p) return "";
  const first = p.designs?.[0];
  return first?.image || "";
}

/** Date ISO YYYY-MM-DD — pour stocker et comparer les dates en base */
export function today() {
  return new Date().toISOString().slice(0, 10);
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

export async function exportBackup(data) {
  try {
    const date = today();
    const backup = JSON.parse(JSON.stringify(data));
    delete backup.auth;
    const blob = new Blob([JSON.stringify({ version: 2, data: backup }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `culturecase_backup_${date}.json`;
    a.click();
    return true;
  } catch {
    return false;
  }
}
