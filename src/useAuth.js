import { useState, useEffect, useRef, useCallback } from "react";
import { onAuthChange, signOut, signInAsViewer } from "./firebase.js";
import { subscribeToData } from "./data.js";

// ── Hook : gestion de l'authentification + mode viewer ──────────────────────
export function useAuth({ toast, setSyncStatus, setData, setLoading }) {
  const [authUser,    setAuthUser]    = useState(undefined);
  const [authError,   setAuthError]   = useState(null);
  const [isViewer,    setIsViewer]    = useState(() => localStorage.getItem("cc_mode") === "viewer");

  const unsubData      = useRef(null);
  const isFirstLoad    = useRef(true);
  const _localUpdate   = useRef(false);

  // ── Listener Firebase Auth + PWA events ──────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const unsubAuth = onAuthChange(
      (user) => {
        if (!mounted) return;
        setAuthUser(user);
        setAuthError(null);

        if (user) {
          if (unsubData.current) { unsubData.current(); unsubData.current = null; }
          isFirstLoad.current = true;
          const unsub = subscribeToData((freshData) => {
            if (!mounted) return;
            if (isFirstLoad.current) {
              isFirstLoad.current = false;
              setLoading(false);
              setData(freshData);
              setSyncStatus("ok");
              return;
            }
            if (_localUpdate.current) return;
            setData(freshData);
            setSyncStatus("ok");
          });
          unsubData.current = unsub;
        } else {
          if (unsubData.current) { unsubData.current(); unsubData.current = null; }
          if (!isViewer) { setData(null); setLoading(false); }
        }
      },
      (error) => {
        if (!mounted) return;
        console.error("Firebase Auth error:", error);
        setAuthUser(null);
        setLoading(false);
        setAuthError(error.message);
      }
    );

    const goOffline      = () => { if (mounted) setSyncStatus("offline"); };
    const goOnline       = () => { if (mounted) setSyncStatus("ok"); };
    const goUpdate       = () => { if (mounted) window.dispatchEvent(new Event("sw-update-available-internal")); };
    const goOfflineReady = () => { if (mounted) toast("✅ Application prête à fonctionner hors ligne.", "info"); };

    window.addEventListener("offline",             goOffline);
    window.addEventListener("online",              goOnline);
    window.addEventListener("sw-update-available", goUpdate);
    window.addEventListener("pwa-offline-ready",   goOfflineReady);

    return () => {
      mounted = false;
      unsubAuth();
      if (unsubData.current) unsubData.current();
      window.removeEventListener("offline",             goOffline);
      window.removeEventListener("online",              goOnline);
      window.removeEventListener("sw-update-available", goUpdate);
      window.removeEventListener("pwa-offline-ready",   goOfflineReady);
    };
  }, [toast, isViewer, setSyncStatus, setData, setLoading]);

  // ── Mode viewer : charger les données sans auth email ────────────────────
  useEffect(() => {
    if (!isViewer) return;
    let mounted = true;
    isFirstLoad.current = true;
    const unsub = subscribeToData((freshData) => {
      if (!mounted) return;
      if (isFirstLoad.current) {
        isFirstLoad.current = false;
        setLoading(false);
        setData(freshData);
        setSyncStatus("ok");
        return;
      }
      setData(freshData);
      setSyncStatus("ok");
    });
    unsubData.current = unsub;
    return () => { mounted = false; if (unsubData.current) unsubData.current(); };
  }, [isViewer, setSyncStatus, setData, setLoading]);

  // ── Actions auth ─────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    localStorage.removeItem("cc_mode");
    await signOut();
  }, []);

  const loginAsViewer = useCallback(async () => {
    localStorage.setItem("cc_mode", "viewer");
    setIsViewer(true);
    setLoading(true);
    await signInAsViewer();
  }, [setLoading]);

  const logoutViewer = useCallback(async () => {
    localStorage.removeItem("cc_mode");
    setIsViewer(false);
    await signOut();
  }, []);

  return {
    authUser,
    authError,
    isViewer,
    logout,
    loginAsViewer,
    logoutViewer,
    _localUpdate,
  };
}
