import { getDB, doc, getDoc, setDoc, onSnapshot, writeBatch as fbWriteBatch } from "./firebase.js";
import { CHUNK_SIZE } from "./constants.js";
import { today } from "./utils.js";

// ── Logique images ────────────────────────────────────────────────────────────
// "https://res.cloudinary.com/..." → URL Cloudinary → visible partout ✅
// "https://images.unsplash.com/..." → URL Unsplash → visible partout ✅
// "data:..."  → base64 brut (ancien format) → on vide pour ne pas bloquer Firestore
// "idb:..."   → ancien format IndexedDB → on vide
//
// Les images sont uploadées vers Cloudinary dans ImagePicker AVANT la sauvegarde.
// Firestore ne reçoit que des URLs https://, jamais de base64.

async function stripImages(data) {
  const slim = JSON.parse(JSON.stringify(data));

  // Nettoyer les anciens formats base64 et idb: qui bloqueraient Firestore
  for (const d of slim.settings?.designs || []) {
    if (d.image && (d.image.startsWith("data:") || d.image.startsWith("idb:"))) {
      d.image = "";
    }
  }
  for (const p of slim.products || []) {
    for (const d of p.designs || []) {
      if (d.image && (d.image.startsWith("data:") || d.image.startsWith("idb:"))) {
        d.image = "";
      }
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
  const slim = await stripImages(data);
  delete slim.auth;
  const db = getDB();

  const chunks = [];
  for (let i = 0; i < slim.products.length; i += CHUNK_SIZE) {
    chunks.push(slim.products.slice(i, i + CHUNK_SIZE));
  }

  const batch = fbWriteBatch(db);
  batch.set(doc(db, "data", "main"), {
    ...slim,
    products: [],
    _chunkCount: chunks.length,
  });
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

// ── Souscription temps réel ───────────────────────────────────────────────────
export function subscribeToData(onUpdate) {
  const db = getDB();

  const unsubMain = onSnapshot(doc(db, "data", "main"), async snap => {
    if (!snap.exists()) return;

    const mainData = snap.data();
    const chunkCount = mainData._chunkCount ?? 0;

    if (chunkCount === 0) {
      rehydrateImages({ ...mainData, products: [] }).then(onUpdate);
      return;
    }

    try {
      const chunkRefs = Array.from({ length: chunkCount }, (_, i) => doc(db, "data", `products_${i}`));
      const chunkSnaps = await Promise.all(chunkRefs.map(ref => getDoc(ref)));
      const allProducts = chunkSnaps.flatMap(s => s.exists() ? s.data().items : []);
      rehydrateImages({ ...mainData, products: allProducts }).then(onUpdate);
    } catch (err) {
      console.error("Erreur chargement chunks produits :", err);
    }
  });

  return () => { unsubMain(); };
}

// ── Export JSON ───────────────────────────────────────────────────────────────
export function exportData(data) {
  const date = new Date().toISOString().slice(0, 10);
  const backup = JSON.parse(JSON.stringify(data));
  delete backup.auth;

  // ── Collecter toutes les URLs Cloudinary pour info ───────────────────────
  const imageUrls = [];
  for (const d of backup.settings?.designs || []) {
    if (d.image && d.image.startsWith("https://")) imageUrls.push({ type: "design", name: d.name, url: d.image });
  }
  for (const p of backup.products || []) {
    for (const d of p.designs || []) {
      if (d.image && d.image.startsWith("https://")) imageUrls.push({ type: "product", name: `${p.model} — ${d.name}`, url: d.image });
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
// ── Validation stricte d'un backup Culturecase ───────────────────────────────
function validateBackup(parsed) {
  const errors = [];

  // Champs obligatoires de premier niveau
  if (!parsed || typeof parsed !== "object") return ["Le fichier n'est pas un objet JSON valide."];
  if (!Array.isArray(parsed.products))  errors.push("Champ 'products' manquant ou invalide.");
  if (!Array.isArray(parsed.sales))     errors.push("Champ 'sales' manquant ou invalide.");
  if (!Array.isArray(parsed.movements)) errors.push("Champ 'movements' manquant (sera vide).");
  if (typeof parsed.settings !== "object" || parsed.settings === null) errors.push("Champ 'settings' manquant ou invalide.");
  if (errors.length) return errors;

  // Validation des produits
  parsed.products.forEach((p, i) => {
    if (!p.id)    errors.push(`Produit #${i+1} : champ 'id' manquant.`);
    if (!p.model) errors.push(`Produit #${i+1} : champ 'model' manquant.`);
    if (typeof p.stock !== "number" || p.stock < 0) errors.push(`Produit #${i+1} : stock invalide (${p.stock}).`);
  });

  // Validation des ventes
  parsed.sales.forEach((s, i) => {
    if (!s.id)        errors.push(`Vente #${i+1} : champ 'id' manquant.`);
    if (!s.productId) errors.push(`Vente #${i+1} : champ 'productId' manquant.`);
    if (!s.date)      errors.push(`Vente #${i+1} : champ 'date' manquant.`);
    if (typeof s.qty !== "number" || s.qty < 1) errors.push(`Vente #${i+1} : quantité invalide (${s.qty}).`);
  });

  // Validation des mouvements
  parsed.movements.forEach((m, i) => {
    if (!m.id)        errors.push(`Mouvement #${i+1} : champ 'id' manquant.`);
    if (!m.productId) errors.push(`Mouvement #${i+1} : champ 'productId' manquant.`);
    if (!["in", "out"].includes(m.type)) errors.push(`Mouvement #${i+1} : type invalide (${m.type}).`);
  });

  // Cohérence : chaque vente doit référencer un produit existant
  const productIds = new Set(parsed.products.map(p => p.id));
  const orphanSales = parsed.sales.filter(s => !productIds.has(s.productId));
  if (orphanSales.length > 0) {
    errors.push(`${orphanSales.length} vente(s) référencent des produits inexistants. Le fichier est peut-être incomplet.`);
  }

  return errors.slice(0, 5); // max 5 erreurs affichées
}

export function importData(file, setData, persist, onMsg) {
  onMsg("⏳ Import en cours...");
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const raw = JSON.parse(e.target.result);
      const parsed = raw.version === 2 ? raw.data : raw;

      // Validation stricte
      const errors = validateBackup(parsed);
      if (errors.length > 0) {
        onMsg("❌ Fichier invalide : " + errors[0] + (errors.length > 1 ? ` (+ ${errors.length - 1} autre(s) erreur(s))` : ""));
        console.error("Erreurs d'import :", errors);
        return;
      }

      // Sanitize : s'assurer que les champs optionnels existent
      const sanitized = {
        products:  parsed.products  || [],
        sales:     parsed.sales     || [],
        movements: parsed.movements || [],
        settings:  parsed.settings  || {},
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
