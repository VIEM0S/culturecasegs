import { getDB, doc, getDoc, setDoc, onSnapshot, writeBatch as fbWriteBatch } from "./firebase.js";
import { CHUNK_SIZE, IDB_NAME, IDB_VER } from "./constants.js";
import { today } from "./utils.js";

// ── IndexedDB pour les images ────────────────────────────────────────────────
let _idb = null;
export function openImageDB() {
  if (_idb) return Promise.resolve(_idb);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VER);
    req.onupgradeneeded = e => e.target.result.createObjectStore("images");
    req.onsuccess = e => { _idb = e.target.result; resolve(_idb); };
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

  // ── Images des produits (déjà géré) ────────────────────────────────────
  for (const p of slim.products || []) {
    for (const d of p.designs || []) {
      if (d.image && d.image.startsWith("data:")) {
        await saveImageToDB(`img_${p.id}_${d.id}`, d.image);
        d.image = `idb:img_${p.id}_${d.id}`;
      }
    }
  }

  // ── Images des designs dans settings (FIX : était oublié) ──────────────
  // Sans ce bloc, chaque image base64 (~50 Ko) reste dans le doc Firestore
  // → limite 1 Mo atteinte après ~15 designs → sauvegarde silencieusement rejetée
  for (const d of slim.settings?.designs || []) {
    if (d.image && d.image.startsWith("data:")) {
      const key = `img_design_${d.id}`;
      await saveImageToDB(key, d.image);
      d.image = `idb:${key}`;
    }
  }

  return slim;
}

export async function rehydrateImages(data) {
  // ── Images des produits ─────────────────────────────────────────────────
  for (const p of data.products || []) {
    for (const d of p.designs || []) {
      if (d.image && d.image.startsWith("idb:")) {
        const key = d.image.replace("idb:", "");
        d.image = (await getImageFromDB(key)) || "";
      }
    }
  }

  // ── Images des designs dans settings (FIX symétrique de stripImages) ───
  for (const d of data.settings?.designs || []) {
    if (d.image && d.image.startsWith("idb:")) {
      const key = d.image.replace("idb:", "");
      d.image = (await getImageFromDB(key)) || "";
    }
  }

  return data;
}

// ── Sauvegarde Firestore ─────────────────────────────────────────────────────
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

// ── Souscription temps réel (optimisée : getDoc pour les chunks, onSnapshot uniquement sur "main") ──
// Au démarrage et à chaque changement de "main", on récupère les chunks en une seule passe
// avec Promise.all(getDoc) au lieu de N listeners onSnapshot parallèles.
// Cela réduit considérablement le nombre de connexions réseau simultanées.
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

    // Charger tous les chunks en parallèle avec getDoc (pas de listeners supplémentaires)
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

// ── Export JSON (CRITIQUE : revokeObjectURL pour éviter la fuite mémoire) ────
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
  // Libérer l'URL objet pour éviter la fuite mémoire
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Import JSON (WARN : gestion erreur FileReader onerror ajoutée) ───────────
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
  // WARN FIX : gérer l'erreur FileReader (permission refusée, fichier corrompu…)
  reader.onerror = () => onMsg("❌ Impossible de lire le fichier. Vérifie qu'il n'est pas corrompu.");
  reader.readAsText(file);
}
