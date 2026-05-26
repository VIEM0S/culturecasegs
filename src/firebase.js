import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore, doc, getDoc, setDoc, onSnapshot, writeBatch
} from "firebase/firestore";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  signInAnonymously,
} from "firebase/auth";
import {
  getRemoteConfig,
  fetchAndActivate,
  getValue,
} from "firebase/remote-config";

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
const _db  = getFirestore(app);

const _rc = getRemoteConfig(app);
_rc.settings.minimumFetchIntervalMillis =
  import.meta.env.DEV ? 0 : 3_600_000;
_rc.defaultConfig = { viewer_code: "" };

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

export async function getViewerCode() {
  try {
    await fetchAndActivate(_rc);
    const val = getValue(_rc, "viewer_code").asString();
    return val || null;
  } catch (err) {
    console.error("Remote Config fetch error:", err);
    return null;
  }
}

export { doc, getDoc, setDoc, onSnapshot, writeBatch };
