import { getDB, doc, onSnapshot, writeBatch as fbWriteBatch } from "./firebase.js";
import { CHUNK_SIZE } from "./constants.js";
import { saveLocalSnapshot } from "./googleSheets.js";

// ── Logique images ────────────────────────────────────────────────────────────
// "https://res.cloudinary.com/..." → URL Cloudinary → visible partout ✅
// "https://images.unsplash.com/..." → URL Unsplash → visible partout ✅
// "data:..."  → base64 brut (ancien format) → on vide pour ne pas bloquer Firestore
// "idb:..."   → ancien format IndexedDB → on vide

async function stripImages(data) {
  const slim = JSON.parse(JSON.stringify(data));
  for (const d of slim.settings?.designs || []) {
    if (d.image && (d.image.startsWith("data:") || d.image.startsWith("idb:"))) d.image = "";
  }
  for (const p of slim.products || []) {
    for (const d of p.designs || []) {
      if (d.image && (d.image.startsWith("data:") || d.image.startsWith("idb:"))) d.image = "";
    }
  }
  return slim;
}

// rehydrateImages : no-op — les URLs Cloudinary sont déjà des https://
export async function rehydrateImages(data) {
  return data;
}

// ── Sauvegarde Firestore ──────────────────────────────────────────────────────
export async function saveData(data) {
  // Snapshot local immédiat — protection contre toute perte de données
  saveLocalSnapshot(data);

  const slim = await stripImages(data);
  delete slim.auth;
  const db = getDB();

  const chunks = [];
  for (let i = 0; i < slim.products.length; i += CHUNK_SIZE) {
    chunks.push(slim.products.slice(i, i + CHUNK_SIZE));
  }

  const batch = fbWriteBatch(db);
  batch.set(doc(db, "data", "main"), { ...slim, products: [], _chunkCount: chunks.length });
  chunks.forEach((chunk, i) => {
    batch.set(doc(db, "data", `products_${i}`), { items: chunk });
  });
  await batch.commit();

  // Supprimer anciens chunks orphelins
  const prevCount = data._chunkCount ?? 10;
  if (prevCount > chunks.length) {
    const delBatch = fbWriteBatch(db);
    for (let i = chunks.length; i < prevCount; i++) {
      delBatch.delete(doc(db, "data", `products_${i}`));
    }
    await delBatch.commit();
  }
}

// ── Souscription temps réel optimisée ────────────────────────────────────────
//
// AVANT : à chaque snap sur "main", on faisait getDoc() sur chaque chunk.
//         → N lectures Firestore à chaque sauvegarde, même si les produits n'ont pas changé.
//
// APRÈS : on pose un onSnapshot sur "main" ET un onSnapshot sur chaque chunk.
//         → Les chunks ne sont rechargés que s'ils ont vraiment changé.
//         → Quand le nombre de chunks change (ajout/suppression produit), on repose
//           les listeners automatiquement.
//
export function subscribeToData(onUpdate) {
  const db = getDB();

  // Cache local des chunks déjà reçus
  const chunkCache = new Map(); // index → items[]
  let mainCache = null;
  let chunkUnsubs = [];
  let currentChunkCount = 0;

  // Recomposer et émettre la donnée complète dès qu'un chunk ou main change
  function emit() {
    if (!mainCache) return;
    const allProducts = Array.from(
      { length: currentChunkCount },
      (_, i) => chunkCache.get(i) ?? []
    ).flat();
    rehydrateImages({ ...mainCache, products: allProducts }).then(onUpdate);
  }

  // (Re)poser les listeners sur les chunks quand chunkCount change
  function subscribeChunks(count) {
    // Nettoyer les anciens listeners
    chunkUnsubs.forEach(u => u());
    chunkUnsubs = [];
    chunkCache.clear();
    currentChunkCount = count;

    if (count === 0) {
      emit();
      return;
    }

    for (let i = 0; i < count; i++) {
      const idx = i;
      const unsub = onSnapshot(doc(db, "data", `products_${idx}`), snap => {
        chunkCache.set(idx, snap.exists() ? snap.data().items : []);
        // N'émettre que si tous les chunks sont arrivés (premier chargement)
        if (chunkCache.size === count) emit();
      }, err => {
        console.error(`Erreur chunk products_${idx} :`, err);
      });
      chunkUnsubs.push(unsub);
    }
  }

  // Listener principal sur "main"
  const unsubMain = onSnapshot(doc(db, "data", "main"), snap => {
    if (!snap.exists()) return;
    const data = snap.data();
    const newCount = data._chunkCount ?? 0;
    mainCache = data;

    // Si le nombre de chunks a changé → reposer les listeners de chunks
    if (newCount !== currentChunkCount) {
      subscribeChunks(newCount);
    } else {
      // main a changé (settings, sales, movements) mais pas les produits → émettre directement
      emit();
    }
  }, err => {
    console.error("Erreur listener main :", err);
  });

  // Retourner une fonction de nettoyage complète
  return () => {
    unsubMain();
    chunkUnsubs.forEach(u => u());
  };
}

// ── Export JSON ───────────────────────────────────────────────────────────────
export function exportData(data) {
  const date = new Date().toISOString().slice(0, 10);
  const backup = JSON.parse(JSON.stringify(data));
  delete backup.auth;

  const imageUrls = [];
  for (const d of backup.settings?.designs || []) {
    if (d.image?.startsWith("https://")) imageUrls.push({ type: "design", name: d.name, url: d.image });
  }
  for (const p of backup.products || []) {
    for (const d of p.designs || []) {
      if (d.image?.startsWith("https://")) imageUrls.push({ type: "product", name: `${p.model} — ${d.name}`, url: d.image });
    }
  }

  const blob = new Blob(
    [JSON.stringify({
      version: 2,
      exportDate: date,
      imageCount: imageUrls.length,
      imageNote: "Les images sont stockées sur Cloudinary. Les URLs ci-dessous permettent de les retrouver en cas de perte.",
      images: imageUrls,
      data: backup,
    }, null, 2)],
    { type: "application/json" }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `culturecase_backup_${date}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Import JSON ───────────────────────────────────────────────────────────────
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
  if (orphanSales.length > 0) {
    errors.push(`${orphanSales.length} vente(s) référencent des produits inexistants.`);
  }
  return errors.slice(0, 5);
}

export function importData(file, setData, persist, onMsg) {
  onMsg("⏳ Import en cours...");
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const raw = JSON.parse(e.target.result);
      const parsed = raw.version === 2 ? raw.data : raw;
      const errors = validateBackup(parsed);
      if (errors.length > 0) {
        onMsg("❌ Fichier invalide : " + errors[0] + (errors.length > 1 ? ` (+ ${errors.length - 1} autre(s) erreur(s))` : ""));
        console.error("Erreurs d'import :", errors);
        return;
      }
      const sanitized = {
        products:    parsed.products     || [],
        sales:       parsed.sales        || [],
        pendingSales: parsed.pendingSales || [],
        movements:   parsed.movements    || [],
        settings:    parsed.settings     || {},
        _chunkCount: parsed._chunkCount ?? 0,
      };
      persist(sanitized);
      onMsg(`✅ Import réussi — ${sanitized.products.length} produits, ${sanitized.sales.length} ventes, ${sanitized.movements.length} mouvements.`);
    } catch (err) {
      console.error("Import error:", err);
      onMsg("❌ Erreur de lecture du fichier — vérifie qu'il s'agit d'un JSON valide.");
    }
  };
  reader.onerror = () => onMsg("❌ Impossible de lire le fichier. Vérifie qu'il n'est pas corrompu.");
  reader.readAsText(file);
}
