import { initializeApp, getApps } from "firebase/app";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, getDoc, setDoc, onSnapshot, writeBatch,
  addDoc, collection,
} from "firebase/firestore";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  signInAnonymously,
} from "firebase/auth";
const FIREBASE_CONFIG = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app  = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);

// ── Persistance offline (IndexedDB) ─────────────────────────────────────────
// Firestore sert les données depuis le cache local dès l'ouverture de l'app,
// sans attendre le réseau. La sync s'effectue ensuite en arrière-plan.
// → Élimine l'écran "La connexion prend trop longtemps" sur mobile.
//
// persistentMultipleTabManager (au lieu du mode single-tab par défaut) :
// sans ça, dès que l'app est ouverte dans un 2e onglet/fenêtre (PWA installée
// + onglet navigateur, ou deux onglets ouverts par erreur), ce 2e onglet ne
// peut jamais obtenir le bail sur IndexedDB — son onSnapshot ne répond
// jamais, et au bout de 20s on tombe sur "La connexion prend trop longtemps".
const _db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

export function getDB()          { return _db; }
export function getCurrentUser() { return auth.currentUser; }

export async function signIn(email, password) {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signInAsViewer() {
  await signInAnonymously(auth);
}

export async function signOut() {
  await fbSignOut(auth);
}

export function onAuthChange(callback, onError) {
  return onAuthStateChanged(auth, callback, onError);
}

// ── Code d'accès partenaire (mode "viewer") ─────────────────────────────────
// Lu directement depuis Firestore (data/main → settings.viewerCode), lisible
// publiquement sans authentification (voir firestore.rules, match /data/*).
// Avant : lu depuis Firebase Remote Config, une source totalement séparée du
// champ éditable dans Paramètres → changer le code depuis l'UI n'avait
// aucun effet réel, l'ancien code restait valide indéfiniment.
export async function getViewerCode() {
  try {
    const snap = await getDoc(doc(_db, "data", "main"));
    if (!snap.exists()) return null;
    // Repli sur le code historique si jamais explicitement enregistré dans
    // Paramètres (même valeur que le placeholder déjà affiché côté UI) —
    // évite de casser l'accès existant tant que l'admin n'a pas resauvegardé.
    return snap.data()?.settings?.viewerCode || "Bkocase0223";
  } catch (err) {
    console.error("Erreur lecture du code d'accès partenaire:", err);
    return null;
  }
}

export { doc, getDoc, setDoc, onSnapshot, writeBatch, addDoc, collection };
