import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { exportData, importData, saveData } from "./data.js";
import { useDialog, useToast } from "./hooks.jsx";
import { useAuth } from "./useAuth.js";
import { useStockActions } from "./useStockActions.js";
import Icon from "./Icon.jsx";
import LoginPage from "./LoginPage.jsx";
import { todayDisplay } from "./utils.js";

const Dashboard    = lazy(() => import("./Dashboard.jsx"));
const Products     = lazy(() => import("./Products.jsx"));
const StockPage    = lazy(() => import("./StockPage.jsx"));
const SalesPage    = lazy(() => import("./SalesPage.jsx"));
const HistoryPage  = lazy(() => import("./HistoryPage.jsx"));
const Reports      = lazy(() => import("./Reports.jsx"));
const SettingsPage = lazy(() => import("./SettingsPage.jsx"));

function App() {
  // ── UI state ────────────────────────────────────────────────────────────
  const [data,          setData]          = useState(null);
  const [page,          setPage]          = useState("dashboard");
  const [sidebarOpen,   setSidebarOpen]   = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstall,   setShowInstall]   = useState(false);
  const [showUpdate,    setShowUpdate]    = useState(false);
  const [splashDone,    setSplashDone]    = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [syncStatus,    setSyncStatus]    = useState("syncing");

  const { confirm, Dialog } = useDialog();
  const { toast, Toasts }   = useToast();

  // ── Auth & données ───────────────────────────────────────────────────────
  const {
    authUser, authError,
    isViewer,
    logout, loginAsViewer, logoutViewer,
    _localUpdate,
  } = useAuth({ toast, setSyncStatus, setData, setLoading });

  // ── Persist : sauvegarde optimiste + sync Firestore ──────────────────────
  const persist = useCallback((newData) => {
    _localUpdate.current = true;
    setData(newData);
    setSyncStatus("syncing");
    saveData(newData)
      .then(() => setSyncStatus("ok"))
      .catch(() => {
        _localUpdate.current = false;
        setSyncStatus("offline");
        toast("❌ Erreur de synchronisation — données sauvegardées localement.", "error");
      })
      .finally(() => { setTimeout(() => { _localUpdate.current = false; }, 2000); });
  }, [setSyncStatus, toast, _localUpdate]);

  // ── Actions métier ───────────────────────────────────────────────────────
  const {
    saveProduct, deleteProduct,
    addMovement, addSale, cancelSale,
    saveSettings,
  } = useStockActions({ data, persist, confirm });

  // ── PWA : install prompt ─────────────────────────────────────────────────
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

  // ── PWA : update banner ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => setShowUpdate(true);
    window.addEventListener("sw-update-available", handler);
    return () => window.removeEventListener("sw-update-available", handler);
  }, []);

  // ── Splash done ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (authUser !== undefined && !loading) setSplashDone(true);
  }, [authUser, loading]);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") { setShowInstall(false); setInstallPrompt(null); }
  };

  // ── Timeout chargement ───────────────────────────────────────────────────
  const [loadingTooLong, setLoadingTooLong] = useState(false);
  useEffect(() => {
    if (!loading) { setLoadingTooLong(false); return; }
    // 15s avant l'avertissement (réseau mobile lent)
    const t1 = setTimeout(() => setLoadingTooLong(true), 15000);
    // 25s : forcer la sortie du splash même sans données (le cache Firestore prendra le relais)
    const t2 = setTimeout(() => setLoading(false), 25000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [loading, setLoading]);

  // ────────────────────────────────────────────────────────────────────────
  // ÉTATS DE L'APPLICATION
  // ────────────────────────────────────────────────────────────────────────

  // 1. Splash / chargement
  if ((authUser === undefined || (authUser && loading)) && !isViewer)
    return (
      <div className={`splash ${splashDone ? "fade-out" : ""}`} role="status" aria-live="polite">
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

  // 2. Erreur Firebase Auth
  if (authError)
    return (
      <div className="splash" role="alert">
        <div className="splash-logo">Culture<span>case</span> GS</div>
        <div style={{ fontSize: 13, color: "var(--danger)", marginTop: 12, maxWidth: 300, textAlign: "center", lineHeight: 1.6 }}>
          ⚠️ Erreur de connexion Firebase :<br />
          <span style={{ color: "var(--text2)", fontSize: 12 }}>{authError}</span>
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{ marginTop: 16, padding: "10px 24px", background: "var(--accent2)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer" }}
        >
          Réessayer
        </button>
      </div>
    );

  // 3. Non authentifié → page de login
  if (!authUser && !isViewer)
    return <LoginPage onViewerAccess={loginAsViewer} />;

  // 3b. Viewer en chargement
  if (isViewer && (!data || loading))
    return (
      <div className="splash" role="status" aria-live="polite">
        <div className="splash-logo">Culture<span>case</span> GS</div>
        <div className="splash-sub">👁️ Iya Choua — chargement…</div>
        <div className="splash-loader"><div className="splash-loader-bar" /></div>
      </div>
    );

  // 4. App principale
  const navItems = isViewer ? [
    { id: "dashboard", label: "Tableau de bord", icon: "dashboard" },
    { id: "products",  label: "Produits",        icon: "products"  },
    { id: "stock",     label: "Stock",           icon: "stock"     },
  ] : [
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
      {!splashDone && (
        <div className="splash" aria-hidden="true">
          <div className="splash-logo" style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
            <img src="data:image/png;base64,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zLU+7deZRofunmQXYykxZHyu2vDyZi0CZufVRpEuxboDe4A3ddn+TQrt6h4f3YvzbFYTYF8vXfN237axdK4tvt+tvs80j+SOinjHt6oJni2l8tjoZXt7af+v+377y9b9+e7BtWRVPaxUNzaLyD7gbqxuPIQZ7vfXnVLZT4Nv5ECkwFrKDKau78Ac+/YCbfeDWYzf0v4RTFvevoWism3wylfep8XSkdmDOo4PI/0m4M1Y92LaB0VGQaTWfjP27h/BJjApl01nubVK2xa9rDeU9inXmdh+mG9TltaLRazB3IPVvVPpbvifalJgLSVatkOwEItulEdqurWCZc/lsi9Vr306PZ0jMPo3MHeLNNKOhrAdHg38hpdB5/exXLlFwHMvm3D46d3MUk/1bpyPzXaUmlYHKbAOJOIBX4tF+y/pOrt/DPTOO7SkgnWq913U/fK2Oe9CngFchxlss8KODsHe+XWqeoaXxVzH9m5/A8vHBPq5RESuxTT3OQ/zKh8bGSZeSw60dCUFVndavryrFOs173atM3BPdxHZo+aRPId5LocDadB2z+UFF3pzJW/4YNGPm8ecDzcAF1BU2BRYoyMaIcWcgjfgTqBeRp3lNktR7lG2Zc1rtlQ3NrgH+/OwbmNDVc90QTUPbPS69i6K+pd0kAKrO9GynaaqZwObPAmcAm/17RtV9UoPyYlEamHniNZyi6o+RlUP9/32qOpWigBagO1+/F7vhpwEnE22sOMiBNbZwEliSRL3etluL+233UN29nj57VHVQzEbJgAi8rNS3dinqo8G3oQJqBksL5d63dqrNpnxaaX7SDpIP6z++A7wfmwWnlf7uogFfL9vj2Dqi7HEauHTFb/vAb6HheUcTTGS+HPgLdhH8mzMdrVIerSPm4gA+VPgb7DyvpKisRFM+OwuHfNOPJUvHr5DEVs4g2lP8yz1u/ooNrK8CbjK16XdsgcpsJYn3k2vypPe58mwSWG1DCmw+iO8oLt5HXcmT+uVlyr268xdFEn46HH+ZLxE7iw4sOy6xZEut72be0q5/qT7ygqkwEqSpDZkdyZJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJ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" alt="logo" style={{ width:64, height:"auto", filter:"brightness(0) invert(1)" }}/>
            <span>Culture<span style={{color:"var(--accent)"}}>case</span></span>
          </div>
          <div className="splash-sub">Gestion de stock</div>
          <div className="splash-loader"><div className="splash-loader-bar" /></div>
        </div>
      )}

      {showUpdate && (
        <div className="update-banner">
          <span style={{ flex: 1 }}>🔄 Nouvelle version disponible</span>
          <button className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>Actualiser</button>
          <button className="btn btn-outline btn-sm" onClick={() => setShowUpdate(false)}>Ignorer</button>
        </div>
      )}

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
        <div className={`sidebar-overlay ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebarOpen(false)} />

        <aside className={`sidebar ${sidebarOpen ? "open" : ""}`} aria-label="Menu latéral">
          <div className="sidebar-logo">
            <img src="data:image/png;base64,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zLU+7deZRofunmQXYykxZHyu2vDyZi0CZufVRpEuxboDe4A3ddn+TQrt6h4f3YvzbFYTYF8vXfN237axdK4tvt+tvs80j+SOinjHt6oJni2l8tjoZXt7af+v+377y9b9+e7BtWRVPaxUNzaLyD7gbqxuPIQZ7vfXnVLZT4Nv5ECkwFrKDKau78Ac+/YCbfeDWYzf0v4RTFvevoWism3wylfep8XSkdmDOo4PI/0m4M1Y92LaB0VGQaTWfjP27h/BJjApl01nubVK2xa9rDeU9inXmdh+mG9TltaLRazB3IPVvVPpbvifalJgLSVatkOwEItulEdqurWCZc/lsi9Vr306PZ0jMPo3MHeLNNKOhrAdHg38hpdB5/exXLlFwHMvm3D46d3MUk/1bpyPzXaUmlYHKbAOJOIBX4tF+y/pOrt/DPTOO7SkgnWq913U/fK2Oe9CngFchxlss8KODsHe+XWqeoaXxVzH9m5/A8vHBPq5RESuxTT3OQ/zKh8bGSZeSw60dCUFVndavryrFOs173atM3BPdxHZo+aRPId5LocDadB2z+UFF3pzJW/4YNGPm8ecDzcAF1BU2BRYoyMaIcWcgjfgTqBeRp3lNktR7lG2Zc1rtlQ3NrgH+/OwbmNDVc90QTUPbPS69i6K+pd0kAKrO9GynaaqZwObPAmcAm/17RtV9UoPyYlEamHniNZyi6o+RlUP9/32qOpWigBagO1+/F7vhpwEnE22sOMiBNbZwEliSRL3etluL+233UN29nj57VHVQzEbJgAi8rNS3dinqo8G3oQJqBksL5d63dqrNpnxaaX7SDpIP6z++A7wfmwWnlf7uogFfL9vj2Dqi7HEauHTFb/vAb6HheUcTTGS+HPgLdhH8mzMdrVIerSPm4gA+VPgb7DyvpKisRFM+OwuHfNOPJUvHr5DEVs4g2lP8yz1u/ooNrK8CbjK16XdsgcpsJYn3k2vypPe58mwSWG1DCmw+iO8oLt5HXcmT+uVlyr268xdFEn46HH+ZLxE7iw4sOy6xZEut72be0q5/qT7ygqkwEqSpDZkdyZJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJ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" alt="Culturecase logo" style={{ width:48, height:"auto", filter:"brightness(0) invert(1)", marginBottom:6 }}/>
            <h1>Culturecase</h1>
            <p>{isViewer ? "👁️ Iya Choua — lecture seule" : "Gestion de stock"}</p>
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
            {isViewer ? (
              <button
                className="nav-item"
                onClick={async () => { setPage("dashboard"); await logoutViewer(); }}
                style={{ width: "100%" }}
              >
                <Icon name="logout" size={15} /> Quitter le mode viewer
              </button>
            ) : (
              <button className="nav-item" onClick={logout} style={{ width: "100%" }} aria-label="Déconnexion">
                <Icon name="logout" size={15} /> Déconnexion
              </button>
            )}
          </div>
        </aside>

        <main className="main" role="main">
          <div className="topbar">
            <button className="hamburger" onClick={() => setSidebarOpen(true)} aria-label="Ouvrir le menu">
              <Icon name="menu" size={20} />
            </button>
            <h2>{titles[page]}</h2>

            <span
              className="sync-dot"
              style={{
                width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                background: syncStatus === "ok" ? "var(--success)" : syncStatus === "offline" ? "var(--warn)" : "var(--text2)",
              }}
            />

            <div style={{ display: "flex", alignItems: "center", gap: 8 }} className="topbar-desktop-actions">
              <span
                aria-live="polite"
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  fontSize: 11, fontWeight: 600,
                  color: syncStatus === "ok" ? "var(--success)" : syncStatus === "offline" ? "var(--warn)" : "var(--text2)",
                  background: syncStatus === "ok" ? "rgba(34,197,94,0.1)" : syncStatus === "offline" ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.05)",
                  padding: "3px 8px", borderRadius: 20,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
                {syncStatus === "ok" ? "Sync" : syncStatus === "offline" ? "Hors ligne" : "…"}
              </span>

              <span style={{ fontSize: 11.5, color: "var(--text2)" }}>{todayDisplay()}</span>

              <button className="btn btn-outline btn-sm" onClick={() => exportData(data)} aria-label="Exporter les données">
                <Icon name="download" size={13} /> Exporter
              </button>

              <label className="btn btn-outline btn-sm" style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                <Icon name="arrow_up" size={13} /> Importer
                <input
                  type="file" accept=".json" style={{ display: "none" }}
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
              {page === "dashboard" && <Dashboard data={data} isViewer={isViewer} />}
              {page === "products"  && <Products data={data} onSave={saveProduct} onDelete={deleteProduct} onSale={addSale} isViewer={isViewer} />}
              {page === "stock"     && <StockPage data={data} onMove={addMovement} isViewer={isViewer} />}
              {page === "sales"     && <SalesPage data={data} onSale={addSale} onCancel={cancelSale} toast={toast} />}
              {page === "history"   && <HistoryPage data={data} />}
              {page === "reports"   && <Reports data={data} />}
              {page === "settings"  && <SettingsPage data={data} onSave={saveSettings} confirm={confirm} />}
            </Suspense>
          </div>

          <nav className="bottom-nav" aria-label="Navigation principale">
            <div className="bottom-nav-inner">
              {(isViewer ? [
                { id: "dashboard", label: "Accueil",  icon: "dashboard" },
                { id: "products",  label: "Produits", icon: "products"  },
                { id: "stock",     label: "Stock",    icon: "stock"     },
              ] : [
                { id: "dashboard", label: "Accueil",  icon: "dashboard" },
                { id: "products",  label: "Produits", icon: "products"  },
                { id: "sales",     label: "Ventes",   icon: "sales"     },
                { id: "stock",     label: "Stock",    icon: "stock"     },
                { id: "settings",  label: "Réglages", icon: "settings"  },
              ]).map((item) => (
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
