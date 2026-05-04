import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  enableMultiTabIndexedDbPersistence,
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
  _db = getFirestore(app);
  try {
    await enableMultiTabIndexedDbPersistence(_db);
  } catch (e) {
    console.warn("Persistence:", e.code);
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
