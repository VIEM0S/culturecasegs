import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { exportData, importData, saveData, subscribeToData } from "./data.js";
import { onAuthChange, signOut } from "./firebase.js";
import { useDialog, useToast } from "./hooks.jsx";
import Icon from "./Icon.jsx";
import LoginPage from "./LoginPage.jsx";
import { uid, todayDisplay } from "./utils.js";

const Dashboard    = lazy(() => import("./Dashboard.jsx"));
const Products     = lazy(() => import("./Products.jsx"));
const StockPage    = lazy(() => import("./StockPage.jsx"));
const SalesPage    = lazy(() => import("./SalesPage.jsx"));
const HistoryPage  = lazy(() => import("./HistoryPage.jsx"));
const Reports      = lazy(() => import("./Reports.jsx"));
const SettingsPage = lazy(() => import("./SettingsPage.jsx"));

function App() {
  const [data, setData]               = useState(null);
  const [page, setPage]               = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
  const [showUpdate, setShowUpdate]   = useState(false);
  const [splashDone, setSplashDone]   = useState(false);
  const [loading, setLoading]         = useState(true);
  // undefined = Firebase Auth en attente | null = déconnecté | objet = connecté
  const [authUser, setAuthUser]       = useState(undefined);
  const [syncStatus, setSyncStatus]   = useState("syncing");
  const isFirstLoad  = useRef(true);
  const _localUpdate = useRef(false);
  const unsubData    = useRef(null);
  const { confirm, alert: dlgAlert, Dialog } = useDialog();
  const { toast, Toasts } = useToast();

  // ── Écoute Firebase Auth ──────────────────────────────────────────────────
  // WARN FIX : flag "mounted" pour ignorer les setState après démontage
  // (notamment en React StrictMode qui monte/démonte deux fois en dev)
  useEffect(() => {
    let mounted = true;

    const unsubAuth = onAuthChange((user) => {
      if (!mounted) return;
      setAuthUser(user);
      // Reset du flag "trop long" à chaque nouvelle tentative d'auth
      setLoadingTooLong(false);

      if (user) {
        // Annuler l'éventuel listener précédent AVANT d'en créer un nouveau (fix fuite mémoire)
        if (unsubData.current) {
          unsubData.current();
          unsubData.current = null;
        }
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
        if (unsubData.current) {
          unsubData.current();
          unsubData.current = null;
        }
        setData(null);
        setLoading(false);
      }
    });

    const goOffline = () => { if (mounted) setSyncStatus("offline"); };
    const goOnline  = () => { if (mounted) setSyncStatus("ok"); };
    const goUpdate  = () => { if (mounted) setShowUpdate(true); };
    // AMÉLIORATION : PWA prête hors ligne → toast discret
    const goOfflineReady = () => {
      if (mounted) toast("✅ Application prête à fonctionner hors ligne.", "info");
    };

    window.addEventListener("sw-update-available", goUpdate);
    window.addEventListener("pwa-offline-ready",   goOfflineReady);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online",  goOnline);

    return () => {
      mounted = false;
      unsubAuth();
      if (unsubData.current) unsubData.current();
      window.removeEventListener("sw-update-available", goUpdate);
      window.removeEventListener("pwa-offline-ready",   goOfflineReady);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online",  goOnline);
    };
  }, [toast]);

  const persist = useCallback(
    (newData) => {
      _localUpdate.current = true;
      setData(newData);
      setSyncStatus("syncing");
      saveData(newData)
        .then(() => setSyncStatus("ok"))
        .catch(() => {
          _localUpdate.current = false; // Reset immédiat en cas d'erreur pour ne pas bloquer les snapshots
          setSyncStatus("offline");
          toast("❌ Erreur de synchronisation — données sauvegardées localement.", "error");
        })
        .finally(() => {
          setTimeout(() => { _localUpdate.current = false; }, 2000);
        });
    },
    [setSyncStatus, toast],
  );

  // ── PWA Install prompt ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      if (!window.matchMedia("(display-mode: standalone)").matches) {
        setTimeout(() => setShowInstall(true), 2000);
      }
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // ── Splash screen — disparaît quand l'état auth ET les données sont connus ──
  // Plus de timer fixe : on attend l'état réel plutôt qu'un délai arbitraire.
  useEffect(() => {
    if (authUser !== undefined && !loading) {
      setSplashDone(true);
    }
  }, [authUser, loading]);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setShowInstall(false);
      setInstallPrompt(null);
    }
  };

  const logout = useCallback(async () => {
    await signOut();
  }, []);

  const saveProduct = useCallback(
    (product) => {
      const list = Array.isArray(product) ? product : [product];
      let products = [...data.products];
      list.forEach((p) => {
        const exists = products.find((x) => x.id === p.id);
        if (exists) products = products.map((x) => (x.id === p.id ? p : x));
        else products = [...products, p];
      });
      persist({ ...data, products });
    },
    [data, persist],
  );

  const deleteProduct = useCallback(
    async (id) => {
      const ok = await confirm("Supprimer ce produit ?");
      if (!ok) return;
      persist({ ...data, products: data.products.filter((p) => p.id !== id) });
    },
    [data, persist, confirm],
  );

  const addMovement = useCallback(
    (movs) => {
      const list = Array.isArray(movs) ? movs : [movs];
      let products = [...data.products];
      for (const mov of list) {
        products = products.map((p) => {
          if (p.id !== mov.productId) return p;
          return {
            ...p,
            stock:
              mov.type === "in"
                ? p.stock + mov.qty
                : Math.max(0, p.stock - mov.qty),
          };
        });
      }
      persist({ ...data, products, movements: [...data.movements, ...list] });
    },
    [data, persist],
  );

  const addSale = useCallback(
    (sales) => {
      const list = Array.isArray(sales) ? sales : [sales];
      let products = [...data.products];
      const newMovements = [];
      for (const sale of list) {
        products = products.map((p) =>
          p.id === sale.productId
            ? { ...p, stock: Math.max(0, p.stock - sale.qty) }
            : p,
        );
        newMovements.push({
          id: uid(),
          productId: sale.productId,
          type: "out",
          qty: sale.qty,
          reason: "Vente",
          date: sale.date,
          note: sale.client || "",
        });
      }
      persist({
        ...data,
        products,
        sales: [...data.sales, ...list],
        movements: [...data.movements, ...newMovements],
      });
    },
    [data, persist],
  );

  const saveSettings = useCallback(
    async (newSettings) => {
      const oldSettings = data.settings;
      let products = [...data.products];

      const oldModels = oldSettings.models || [];
      const newModels = newSettings.models || [];
      oldModels.forEach((oldName, i) => {
        const newName = newModels[i];
        if (newName && newName !== oldName) {
          products = products.map((p) =>
            p.model === oldName ? { ...p, model: newName } : p,
          );
        }
      });
      const deletedModels = oldModels.filter((m) => !newModels.includes(m));
      if (deletedModels.length > 0) {
        const nb = products.filter((p) => deletedModels.includes(p.model)).length;
        const ok = await confirm(
          `Supprimer aussi les ${nb} produit${nb > 1 ? "s" : ""} liés aux modèles supprimés ?`,
        );
        if (ok) products = products.filter((p) => !deletedModels.includes(p.model));
      }

      const oldDesigns = oldSettings.designs || [];
      const newDesigns = newSettings.designs || [];
      oldDesigns.forEach((oldD) => {
        const newD = newDesigns.find((d) => d.id === oldD.id);
        if (newD && newD.name !== oldD.name) {
          products = products.map((p) =>
            p.design === oldD.name ? { ...p, design: newD.name } : p,
          );
        }
      });
      const deletedDesignNames = oldDesigns
        .filter((d) => !newDesigns.find((nd) => nd.id === d.id))
        .map((d) => d.name);
      if (deletedDesignNames.length > 0) {
        const nb = products.filter((p) => deletedDesignNames.includes(p.design)).length;
        const ok = await confirm(
          `Supprimer aussi les ${nb} produit${nb > 1 ? "s" : ""} liés aux designs supprimés ?`,
        );
        if (ok)
          products = products.filter((p) => !deletedDesignNames.includes(p.design));
      }

      persist({ ...data, settings: newSettings, products });
    },
    [data, persist, confirm],
  );

  // ── Timeout chargement trop long ────────────────────────────────────────
  const [loadingTooLong, setLoadingTooLong] = useState(false);
  useEffect(() => {
    if (!loading) { setLoadingTooLong(false); return; }
    const t = setTimeout(() => setLoadingTooLong(true), 10000);
    return () => clearTimeout(t);
  }, [loading]);

  // ── États de l'application ───────────────────────────────────────────────

  // 1. Firebase Auth en attente OU données en cours de chargement → splash unifié
  if (authUser === undefined || (authUser && loading))
    return (
      <div
        className={`splash ${splashDone ? "fade-out" : ""}`}
        role="status"
        aria-live="polite"
      >
        <div className="splash-logo">Culture<span>case</span> GS</div>
        <div className="splash-sub">
          {loadingTooLong ? "⚠️ La connexion prend trop longtemps…" : "Gestion de stock"}
        </div>
        <div className="splash-loader"><div className="splash-loader-bar" /></div>
        {loadingTooLong && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 16 }}>
            <div style={{ fontSize: 12, color: "var(--text2)", maxWidth: 280, textAlign: "center", lineHeight: 1.6 }}>
              Vérifie ta connexion internet ou que Firebase est bien configuré.
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: "10px 24px", background: "var(--accent2)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer" }}
            >
              Réessayer
            </button>
          </div>
        )}
      </div>
    );

  // 2. Non authentifié → login
  if (!authUser) return <LoginPage />;

  // 3. Application principale (auth OK + données chargées)
  const navItems = [
    { id: "dashboard", label: "Tableau de bord",    icon: "dashboard" },
    { id: "products",  label: "Produits",           icon: "products"  },
    { id: "stock",     label: "Mouvements stock",   icon: "stock"     },
    { id: "sales",     label: "Ventes",             icon: "sales"     },
    { id: "history",   label: "Historique clients", icon: "phone"     },
    { id: "reports",   label: "Rapports",           icon: "reports"   },
    { id: "settings",  label: "Paramètres",         icon: "settings"  },
  ];
  const titles = {
    dashboard: "Tableau de bord",
    products:  "Produits",
    stock:     "Mouvements de stock",
    sales:     "Ventes",
    history:   "Historique clients",
    reports:   "Rapports",
    settings:  "Paramètres",
  };

  return (
    <>
      {/* ── SPLASH — affiché jusqu'à la fin de l'animation (fade-out) */}
      {!splashDone && (
        <div className="splash" aria-hidden="true">
          <div className="splash-logo">Culture<span>case</span> GS</div>
          <div className="splash-sub">Gestion de stock</div>
          <div className="splash-loader"><div className="splash-loader-bar" /></div>
        </div>
      )}

      {/* ── UPDATE BANNER ── */}
      {showUpdate && (
        <div className="update-banner">
          <span style={{ flex: 1 }}>🔄 Nouvelle version disponible</span>
          <button className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>
            Actualiser
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => setShowUpdate(false)}>
            Ignorer
          </button>
        </div>
      )}

      {/* ── INSTALL BANNER ── */}
      {showInstall && installPrompt && (
        <div className="install-banner">
          <div className="install-banner-icon">📦</div>
          <div className="install-banner-text">
            <strong>Installer l'application</strong>
            <span>Accès rapide depuis votre écran d'accueil</span>
          </div>
          <div className="install-actions">
            <button className="btn-install" onClick={handleInstall}>Installer</button>
            <button className="btn-dismiss" onClick={() => setShowInstall(false)} aria-label="Fermer">✕</button>
          </div>
        </div>
      )}

      <Dialog />
      <Toasts />

      <div className="app">
        <div
          className={`sidebar-overlay ${sidebarOpen ? "open" : ""}`}
          onClick={() => setSidebarOpen(false)}
        />
        <aside className={`sidebar ${sidebarOpen ? "open" : ""}`} aria-label="Menu latéral">
          <div className="sidebar-logo">
            <h1>Culturecase <span>GS</span></h1>
            <p>Gestion de stock</p>
          </div>
          <nav className="sidebar-nav" aria-label="Navigation principale">
            {navItems.map((item) => (
              <button
                key={item.id}
                className={`nav-item ${page === item.id ? "active" : ""}`}
                onClick={() => { setPage(item.id); setSidebarOpen(false); }}
              >
                <Icon name={item.icon} size={15} /> {item.label}
              </button>
            ))}
          </nav>
          <div className="sidebar-footer">
            <button
              className="nav-item"
              onClick={logout}
              style={{ width: "100%" }}
              aria-label="Déconnexion"
            >
              <Icon name="logout" size={15} /> Déconnexion
            </button>
          </div>
        </aside>

        <main className="main" role="main">
          <div className="topbar">
            <button
              className="hamburger"
              onClick={() => setSidebarOpen(true)}
              aria-label="Ouvrir le menu"
            >
              <Icon name="menu" size={20} />
            </button>
            <h2>{titles[page]}</h2>

            {/* Indicateur sync — point coloré visible mobile */}
            <span
              className="sync-dot"
              title={
                syncStatus === "ok"      ? "Synchronisé"
                : syncStatus === "offline" ? "Hors ligne"
                : "Sync..."
              }
              style={{
                width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                background:
                  syncStatus === "ok"      ? "var(--success)"
                  : syncStatus === "offline" ? "var(--warn)"
                  : "var(--text2)",
              }}
            />

            {/* Actions desktop */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }} className="topbar-desktop-actions">
              <span
                title={
                  syncStatus === "ok"
                    ? "Synchronisé"
                    : syncStatus === "offline"
                      ? "Hors ligne — données sauvegardées localement"
                      : "Synchronisation..."
                }
                aria-live="polite"
                aria-label={
                  syncStatus === "ok"      ? "Synchronisé"
                  : syncStatus === "offline" ? "Hors ligne"
                  : "Synchronisation en cours"
                }
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  fontSize: 11, fontWeight: 600,
                  color:
                    syncStatus === "ok"      ? "var(--success)"
                    : syncStatus === "offline" ? "var(--warn)"
                    : "var(--text2)",
                  background:
                    syncStatus === "ok"      ? "rgba(34,197,94,0.1)"
                    : syncStatus === "offline" ? "rgba(245,158,11,0.1)"
                    : "rgba(255,255,255,0.05)",
                  padding: "3px 8px", borderRadius: 20,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
                {syncStatus === "ok" ? "Sync" : syncStatus === "offline" ? "Hors ligne" : "…"}
              </span>

              <span style={{ fontSize: 11.5, color: "var(--text2)" }}>{todayDisplay()}</span>

              <button
                className="btn btn-outline btn-sm"
                onClick={() => exportData(data)}
                title="Exporter les données (JSON daté)"
                aria-label="Exporter les données"
              >
                <Icon name="download" size={13} /> Exporter
              </button>

              <label
                className="btn btn-outline btn-sm"
                title="Restaurer depuis un backup JSON"
                style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
              >
                <Icon name="arrow_up" size={13} /> Importer
                <input
                  type="file"
                  accept=".json"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const ok = await confirm("⚠️ L'import remplacera TOUTES les données actuelles. Continuer ?");
                    if (ok) importData(e.target.files[0], setData, persist, toast);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>

          <div className="content">
            <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "var(--text2)", fontSize: 13 }}>Chargement…</div>}>
              {page === "dashboard" && <Dashboard data={data} />}
              {page === "products" && (
                <Products data={data} onSave={saveProduct} onDelete={deleteProduct} onSale={addSale} />
              )}
              {page === "stock"   && <StockPage data={data} onMove={addMovement} />}
              {page === "sales"   && <SalesPage data={data} onSale={addSale} toast={toast} />}
              {page === "history" && <HistoryPage data={data} />}
              {page === "reports" && <Reports data={data} />}
              {page === "settings" && (
                <SettingsPage data={data} onSave={saveSettings} confirm={confirm} />
              )}
            </Suspense>
          </div>

          {/* ── BOTTOM NAV (mobile) ── */}
          <nav className="bottom-nav" aria-label="Navigation principale">
            <div className="bottom-nav-inner">
              {[
                { id: "dashboard", label: "Accueil",  icon: "dashboard" },
                { id: "products",  label: "Produits", icon: "products"  },
                { id: "sales",     label: "Ventes",   icon: "sales"     },
                { id: "stock",     label: "Stock",    icon: "stock"     },
                { id: "settings",  label: "Réglages", icon: "settings"  },
              ].map((item) => (
                <button
                  key={item.id}
                  className={`bottom-nav-item ${page === item.id ? "active" : ""}`}
                  onClick={() => { setPage(item.id); setSidebarOpen(false); }}
                >
                  <div className="bn-pip" />
                  <Icon name={item.icon} size={20} />
                  {item.label}
                </button>
              ))}
            </div>
          </nav>
        </main>
      </div>
    </>
  );
}

export default App;
