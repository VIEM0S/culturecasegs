import { initializeApp, getApps } from "firebase/app";
import {
  // ✅ FIX: initializeFirestore remplace getFirestore + enableMultiTabIndexedDbPersistence
  // enableMultiTabIndexedDbPersistence est SUPPRIMÉ dans Firebase 10 Modular SDK
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc, getDoc, setDoc, onSnapshot, writeBatch
} from "firebase/firestore";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged
} from "firebase/auth";

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyDhV0YVER09rVCmVoCVdw1rwnIvEy89Y74",
  authDomain:        "culturecase-gs.firebaseapp.com",
  projectId:         "culturecase-gs",
  storageBucket:     "culturecase-gs.firebasestorage.app",
  messagingSenderId: "369046579849",
  appId:             "1:369046579849:web:3672d245a9f7d42e687458",
};

const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
let _db = null;

async function getDB() {
  if (_db) return _db;
  try {
    // ✅ FIX: API moderne Firebase 10 — persistence multi-onglets intégrée
    _db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
  } catch (e) {
    // Fallback si déjà initialisé ou environnement sans support IndexedDB
    console.warn("Firestore init:", e.code || e.message);
    const { getFirestore } = await import("firebase/firestore");
    _db = getFirestore(app);
  }
  return _db;
}

export function getCurrentUser() {
  return auth.currentUser;
}

export async function signIn(email, password) {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signOut() {
  await fbSignOut(auth);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

export { getDB, doc, getDoc, setDoc, onSnapshot, writeBatch };
