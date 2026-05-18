import { getDB, doc, getDoc, setDoc, onSnapshot, writeBatch as fbWriteBatch, uploadImageToStorage } from "./firebase.js";
import { CHUNK_SIZE } from "./constants.js";
import { today } from "./utils.js";

// ── Logique images ────────────────────────────────────────────────────────────
// "https://..."  → URL Firebase Storage ou Unsplash → affiché partout ✅
// "data:..."     → base64 brut → uploadé vers Firebase Storage à la sauvegarde
// "idb:..."      → ancien format IndexedDB (rétrocompat : image vide, re-uploader)
//
// Résultat : toutes les images deviennent des URLs https:// accessibles sur
// tous les appareils (PC, téléphone, tablette) sans localStorage ni IndexedDB.

async function stripImages(data) {
  const slim = JSON.parse(JSON.stringify(data));

  // ── Images des designs dans settings ──────────────────────────────────────
  for (const d of slim.settings?.designs || []) {
    if (d.image && d.image.startsWith("data:")) {
      const key = `img_design_${d.id}`;
      try {
        const url = await uploadImageToStorage(key, d.image);
        d.image = url; // URL https:// publique → visible sur tous les appareils
      } catch (e) {
        console.error("Upload image design:", e);
        d.image = ""; // Échec upload → vider pour ne pas bloquer Firestore
      }
    }
    // Ancienne clé idb: → image perdue localement, l'utilisateur devra re-uploader
    if (d.image && d.image.startsWith("idb:")) {
      d.image = "";
    }
  }

  // ── Images des produits ────────────────────────────────────────────────────
  for (const p of slim.products || []) {
    for (const d of p.designs || []) {
      if (d.image && d.image.startsWith("data:")) {
        const key = `img_${p.id}_${d.id}`;
        try {
          const url = await uploadImageToStorage(key, d.image);
          d.image = url;
        } catch (e) {
          console.error("Upload image produit:", e);
          d.image = "";
        }
      }
      if (d.image && d.image.startsWith("idb:")) {
        d.image = "";
      }
    }
  }

  return slim;
}

// rehydrateImages : no-op désormais (les URLs sont directement des https://)
// Conservé pour ne pas casser les imports existants
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

  return () => {
    unsubMain();
  };
}

// ── Export JSON ───────────────────────────────────────────────────────────────
export function exportData(data) {
  const date = new Date().toISOString().slice(0, 10);
  const backup = JSON.parse(JSON.stringify(data));
  delete backup.auth;
  const blob = new Blob(
    [JSON.stringify({ version: 2, data: backup }, null, 2)],
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
export function importData(file, setData, persist, onMsg) {
  onMsg("⏳ Import en cours...");
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const raw = JSON.parse(e.target.result);
      const parsed = raw.version === 2 ? raw.data : raw;
      if (!parsed.products || !parsed.sales) {
        onMsg("❌ Fichier invalide — ce n'est pas un backup Culturecase.");
        return;
      }
      persist(parsed);
      onMsg("✅ Données importées avec succès !");
    } catch {
      onMsg("❌ Erreur de lecture du fichier.");
    }
  };
  reader.onerror = () => onMsg("❌ Impossible de lire le fichier. Vérifie qu'il n'est pas corrompu.");
  reader.readAsText(file);
}
