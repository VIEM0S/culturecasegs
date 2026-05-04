import { getDB, doc, setDoc, onSnapshot, writeBatch as fbWriteBatch } from "./firebase.js";
import { CHUNK_SIZE, IDB_NAME, IDB_VER } from "./constants.js";

// ── IndexedDB pour les images ────────────────────────────────────────────────
export function openImageDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VER);
    req.onupgradeneeded = e => e.target.result.createObjectStore("images");
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

export async function saveImageToDB(key, dataUrl) {
  const db = await openImageDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("images", "readwrite");
    tx.objectStore("images").put(dataUrl, key);
    tx.oncomplete = resolve;
    tx.onerror    = e => reject(e.target.error);
  });
}

export async function getImageFromDB(key) {
  const db = await openImageDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("images", "readonly");
    const req = tx.objectStore("images").get(key);
    req.onsuccess = e => resolve(e.target.result || null);
    req.onerror   = e => reject(e.target.error);
  });
}

async function stripImages(data) {
  const slim = JSON.parse(JSON.stringify(data));
  for (const p of slim.products || []) {
    for (const d of p.designs || []) {
      if (d.image && d.image.startsWith("data:")) {
        await saveImageToDB(`img_${p.id}_${d.id}`, d.image);
        d.image = `idb:img_${p.id}_${d.id}`;
      }
    }
  }
  return slim;
}

export async function rehydrateImages(data) {
  for (const p of data.products || []) {
    for (const d of p.designs || []) {
      if (d.image && d.image.startsWith("idb:")) {
        const key = d.image.replace("idb:", "");
        d.image = (await getImageFromDB(key)) || "";
      }
    }
  }
  return data;
}

// ── Sauvegarde Firestore ────────────────────────────────────────────────────
export async function saveData(data) {
  try {
    const slim = await stripImages(data);
    delete slim.auth;
    const db = await getDB();

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
  } catch (e) {
    throw e;
  }
}

// ── Souscription temps réel ─────────────────────────────────────────────────
export async function subscribeToData(onUpdate) {
  const db = await getDB();
  let mainData = null;
  let productChunks = {};
  let chunkCount = 0;
  let chunkUnsubs = [];

  const tryMerge = () => {
    if (!mainData) return;
    if (Object.keys(productChunks).length < chunkCount) return;
    const allProducts = [];
    for (let i = 0; i < chunkCount; i++) {
      allProducts.push(...(productChunks[i] || []));
    }
    rehydrateImages({ ...mainData, products: allProducts }).then(onUpdate);
  };

  const unsubMain = onSnapshot(doc(db, "data", "main"), snap => {
    if (!snap.exists()) return;
    mainData = snap.data();
    chunkCount = mainData._chunkCount ?? 0;

    chunkUnsubs.forEach(u => u());
    chunkUnsubs = [];
    productChunks = {};

    if (chunkCount === 0) { tryMerge(); return; }

    for (let i = 0; i < chunkCount; i++) {
      const idx = i;
      const u = onSnapshot(doc(db, "data", `products_${idx}`), s => {
        productChunks[idx] = s.exists() ? s.data().items : [];
        tryMerge();
      });
      chunkUnsubs.push(u);
    }
  });

  return () => { unsubMain(); chunkUnsubs.forEach(u => u()); };
}

// ── Export/Import JSON ──────────────────────────────────────────────────────
export function exportData(data) {
  const date = new Date().toISOString().slice(0, 10);
  const backup = JSON.parse(JSON.stringify(data));
  delete backup.auth;
  const blob = new Blob([JSON.stringify({ version: 2, data: backup }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `culturecase_backup_${date}.json`;
  a.click();
}

export function importData(file, setData, persist, onMsg) {
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
  reader.readAsText(file);
}
