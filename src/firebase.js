import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore, doc, getDoc, setDoc, onSnapshot, writeBatch
} from "firebase/firestore";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged
} from "firebase/auth";
import {
  getStorage,
  ref,
  uploadString,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

// ── Config Firebase via variables d'environnement Vite ──────────────────────
// Les clés ne sont JAMAIS dans le code source versionné.
// Elles doivent être dans .env.local (déjà exclu du git via .gitignore).
// Copier .env.example → .env.local et renseigner les valeurs.
const FIREBASE_CONFIG = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app     = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
const auth    = getAuth(app);
const _db     = getFirestore(app);
const storage = getStorage(app);

export function getDB()              { return _db; }
export function getCurrentUser()     { return auth.currentUser; }
export function getStorageInstance() { return storage; }

// ── Firebase Storage : upload image base64, retourne l'URL publique ──────────
export async function uploadImageToStorage(key, dataUrl) {
  const storageRef = ref(storage, `images/${key}`);
  await uploadString(storageRef, dataUrl, "data_url");
  return await getDownloadURL(storageRef);
}

// ── Firebase Storage : supprimer une image ───────────────────────────────────
export async function deleteImageFromStorage(key) {
  try {
    const storageRef = ref(storage, `images/${key}`);
    await deleteObject(storageRef);
  } catch (e) {
    if (e.code !== "storage/object-not-found") console.warn("deleteImage:", e);
  }
}

export async function signIn(email, password) {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signOut() {
  await fbSignOut(auth);
}

// ── MODIFIÉ : accepte un second callback pour les erreurs Firebase Auth
export function onAuthChange(callback, onError) {
  return onAuthStateChanged(auth, callback, onError);
}

export { doc, getDoc, setDoc, onSnapshot, writeBatch };
