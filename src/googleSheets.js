// ── Google Sheets Sync — CultureCase GS ──────────────────────────────────────
//
// SETUP (une seule fois) :
// 1. Ouvre le Google Sheet → Extensions → Apps Script
// 2. Colle le script "doPost" ci-dessous → Déployer → Nouvelle application web
//    → Accès : "Tout le monde" → Copie l'URL de déploiement
// 3. Mets l'URL dans VITE_SHEETS_WEBHOOK_URL dans ton .env
//
// ── Apps Script à coller (copie tout ce bloc) ────────────────────────────────
//
// const SHEET_ID = "1kX-rQApHPwv5zKKU4OcJc8etIx6t6pGOFtgYQUa6QJM";
//
// function doPost(e) {
//   try {
//     const payload = JSON.parse(e.postData.contents);
//     const ss = SpreadsheetApp.openById(SHEET_ID);
//     const action = payload.action;
//
//     if (action === "init_sheets")    return initSheets(ss);
//     if (action === "add_sale")       return addSaleRow(ss, payload.data);
//     if (action === "cancel_sale")    return cancelSaleRow(ss, payload.data);
//     if (action === "add_movement")   return addMovementRow(ss, payload.data);
//     if (action === "sync_products")  return syncProducts(ss, payload.data);
//     if (action === "weekly_backup")  return weeklyBackup(ss, payload.data);
//     if (action === "sync_history")   return syncHistory(ss, payload.data);
//
//     return ok("unknown action");
//   } catch(err) {
//     return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
//       .setMimeType(ContentService.MimeType.JSON);
//   }
// }
//
// function ok(msg) {
//   return ContentService.createTextOutput(JSON.stringify({ ok: true, msg }))
//     .setMimeType(ContentService.MimeType.JSON);
// }
//
// function getOrCreate(ss, name, headers) {
//   let sh = ss.getSheetByName(name);
//   if (!sh) {
//     sh = ss.insertSheet(name);
//     sh.getRange(1, 1, 1, headers.length).setValues([headers])
//       .setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
//     sh.setFrozenRows(1);
//   }
//   return sh;
// }
//
// function initSheets(ss) {
//   getOrCreate(ss, "💰 Ventes", ["ID","Groupe","Date","Client","Téléphone","Quartier","Produit","Design","Qté","Prix unit.","Remise %","Remise FCFA","Total","Livraison","Statut"]);
//   getOrCreate(ss, "📦 Produits", ["ID","Modèle","Design","Stock","Prix","Créé le"]);
//   getOrCreate(ss, "📊 Mouvements", ["ID","Date","Produit","Design","Type","Qté","Raison","Note"]);
//   getOrCreate(ss, "👥 Historique", ["Client","Téléphone","Quartier","Nb achats","Articles","CA total (FCFA)","Dernier achat","Segment"]);
//   getOrCreate(ss, "📈 Rapport", ["Mois","Nb ventes","CA (FCFA)","Remises (FCFA)","CA net"]);
//   getOrCreate(ss, "🔒 Backup JSON", ["Date","Taille","JSON"]);
//   return ok("sheets initialized");
// }
//
// function addSaleRow(ss, sales) {
//   const sh = getOrCreate(ss, "💰 Ventes", ["ID","Groupe","Date","Client","Téléphone","Quartier","Produit","Design","Qté","Prix unit.","Remise %","Remise FCFA","Total","Livraison","Statut"]);
//   const rows = (Array.isArray(sales) ? sales : [sales]).map(s => [
//     s.id, s.groupId, s.date, s.client||"", s.phone||"", s.quartier||"",
//     s.model||"", s.design||"", s.qty, s.price, s.discountPercent||0,
//     s.discountAmount||0, s.totalAfterDiscount||s.total, s.delivery?"Oui":"Non", "Confirmée"
//   ]);
//   if (rows.length) sh.getRange(sh.getLastRow()+1, 1, rows.length, rows[0].length).setValues(rows);
//   return ok(`${rows.length} vente(s) ajoutée(s)`);
// }
//
// function cancelSaleRow(ss, ids) {
//   const sh = ss.getSheetByName("💰 Ventes");
//   if (!sh) return ok("no sheet");
//   const idSet = new Set(Array.isArray(ids) ? ids : [ids]);
//   const last = sh.getLastRow();
//   if (last < 2) return ok("empty");
//   const data = sh.getRange(2, 1, last-1, 15).getValues();
//   data.forEach((row, i) => { if (idSet.has(row[0])) sh.getRange(i+2, 15).setValue("Annulée"); });
//   return ok("cancelled");
// }
//
// function addMovementRow(ss, movs) {
//   const sh = getOrCreate(ss, "📊 Mouvements", ["ID","Date","Produit","Design","Type","Qté","Raison","Note"]);
//   const rows = (Array.isArray(movs) ? movs : [movs]).map(m => [
//     m.id, m.date, m.model||"", m.design||"", m.type==="in"?"Entrée":"Sortie",
//     m.qty, m.reason||"", m.note||""
//   ]);
//   if (rows.length) sh.getRange(sh.getLastRow()+1, 1, rows.length, rows[0].length).setValues(rows);
//   return ok("movements added");
// }
//
// function syncProducts(ss, products) {
//   const sh = getOrCreate(ss, "📦 Produits", ["ID","Modèle","Design","Stock","Prix","Créé le"]);
//   sh.getRange(2, 1, Math.max(sh.getLastRow()-1, 1), 6).clearContent();
//   const rows = products.map(p => [p.id, p.model, p.design||"", p.stock, p.price||0, p.createdAt||""]);
//   if (rows.length) sh.getRange(2, 1, rows.length, 6).setValues(rows);
//   return ok(`${rows.length} produits synchronisés`);
// }
//
// function syncHistory(ss, clients) {
//   const sh = getOrCreate(ss, "👥 Historique", ["Client","Téléphone","Quartier","Nb achats","Articles","CA total (FCFA)","Dernier achat","Segment"]);
//   sh.getRange(2, 1, Math.max(sh.getLastRow()-1, 1), 8).clearContent();
//   const rows = clients.map(c => [c.name, c.phone, c.quartier, c.purchases, c.articles, c.total, c.lastDate, c.segment]);
//   if (rows.length) sh.getRange(2, 1, rows.length, 8).setValues(rows);
//   return ok("history synced");
// }
//
// function weeklyBackup(ss, payload) {
//   const sh = getOrCreate(ss, "🔒 Backup JSON", ["Date","Taille","JSON"]);
//   const json = JSON.stringify(payload.data);
//   sh.getRange(sh.getLastRow()+1, 1, 1, 3).setValues([[payload.date, json.length, json]]);
//   // Garder seulement les 8 derniers backups
//   const last = sh.getLastRow();
//   if (last > 9) sh.deleteRows(2, last - 9);
//   return ok("backup saved");
// }
//
// ─────────────────────────────────────────────────────────────────────────────

const WEBHOOK_URL = import.meta.env.VITE_SHEETS_WEBHOOK_URL || "";

// File produits pour enrichir les données de vente/mouvement
let _productsCache = [];

export function setSheetsProductsCache(products) {
  _productsCache = products || [];
}

function findProduct(productId) {
  return _productsCache.find(p => p.id === productId) || null;
}

async function post(action, data) {
  if (!WEBHOOK_URL) return; // Pas configuré → silencieux
  try {
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, data }),
      mode: "no-cors", // Apps Script n'envoie pas les headers CORS
    });
  } catch (err) {
    console.warn("[Sheets] Erreur sync :", err.message);
  }
}

// ── Initialiser les onglets (appelé une fois au premier chargement) ───────────
export async function initGoogleSheets() {
  await post("init_sheets", {});
}

// ── Ventes ────────────────────────────────────────────────────────────────────
export async function sheetAddSales(sales) {
  const list = Array.isArray(sales) ? sales : [sales];
  const enriched = list.map(s => {
    const prod = findProduct(s.productId);
    return {
      ...s,
      model:  prod?.model  || s.productId,
      design: prod?.design || "",
    };
  });
  await post("add_sale", enriched);
}

export async function sheetCancelSales(sales) {
  const ids = (Array.isArray(sales) ? sales : [sales]).map(s => s.id);
  await post("cancel_sale", ids);
}

// ── Mouvements ────────────────────────────────────────────────────────────────
export async function sheetAddMovements(movs) {
  const list = Array.isArray(movs) ? movs : [movs];
  const enriched = list.map(m => {
    const prod = findProduct(m.productId);
    return {
      ...m,
      model:  prod?.model  || m.productId,
      design: prod?.design || "",
    };
  });
  await post("add_movement", enriched);
}

// ── Produits (sync complète à chaque modif) ───────────────────────────────────
export async function sheetSyncProducts(products) {
  await post("sync_products", products);
}

// ── Historique clients ────────────────────────────────────────────────────────
export async function sheetSyncHistory(sales, products) {
  const prodMap = Object.fromEntries((products || []).map(p => [p.id, p]));

  const groups = {};
  (sales || []).forEach(s => {
    const phone    = (s.phone  || "").trim();
    const name     = (s.client || "").trim();
    const quartier = (s.quartier || "").trim().toLowerCase();
    const key = phone ? `phone::${phone}` : name ? `name::${name}::${quartier}` : `anon::${s.id}`;

    if (!groups[key]) groups[key] = { name, phone, quartier: s.quartier || "", sales: [] };
    groups[key].sales.push(s);
  });

  const clients = Object.values(groups).map(g => {
    const total    = g.sales.reduce((acc, s) => acc + (s.totalAfterDiscount ?? s.total ?? 0), 0);
    const articles = g.sales.reduce((acc, s) => acc + (s.qty || 1), 0);
    const dates    = g.sales.map(s => s.date).sort();
    const lastDate = dates[dates.length - 1] || "";
    const nb       = new Set(g.sales.map(s => s.groupId || s.id)).size;
    const segment  = total >= 50000 ? "VIP" : nb >= 3 ? "Fidèle" : nb === 1 ? "Nouveau" : "Nouveau";
    return { name: g.name, phone: g.phone, quartier: g.quartier, purchases: nb, articles, total, lastDate, segment };
  });

  await post("sync_history", clients);
}

// ── Backup hebdomadaire (chaque lundi) ───────────────────────────────────────
const BACKUP_KEY = "cc_last_weekly_backup";

export async function maybeWeeklyBackup(data) {
  try {
    const today     = new Date().toISOString().slice(0, 10);
    const dayOfWeek = new Date().getDay(); // 1 = lundi
    const lastBackup = localStorage.getItem(BACKUP_KEY) || "";

    if (dayOfWeek !== 1 || lastBackup === today) return;

    // Backup JSON dans Google Sheets
    await post("weekly_backup", {
      date: today,
      data: { ...data, auth: undefined },
    });

    // Backup JSON local (téléchargement automatique)
    const blob = new Blob(
      [JSON.stringify({ version: 2, exportDate: today, data }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a   = document.createElement("a");
    a.href     = url;
    a.download = `culturecase_backup_${today}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    localStorage.setItem(BACKUP_KEY, today);
    console.log("[Sheets] Backup hebdomadaire effectué :", today);
  } catch (err) {
    console.warn("[Sheets] Backup hebdomadaire échoué :", err.message);
  }
}

// ── Snapshot localStorage (protection immédiate) ──────────────────────────────
const SNAP_KEY = "cc_data_snapshot";

export function saveLocalSnapshot(data) {
  try {
    const slim = JSON.parse(JSON.stringify(data));
    delete slim.auth;
    localStorage.setItem(SNAP_KEY, JSON.stringify({
      savedAt: new Date().toISOString(),
      data: slim,
    }));
  } catch {
    // localStorage plein → silencieux
  }
}

export function getLocalSnapshot() {
  try {
    const raw = localStorage.getItem(SNAP_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
