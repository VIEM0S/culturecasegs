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
const BlogPage     = lazy(() => import("./BlogPage.jsx"));

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
    const t = setTimeout(() => setLoadingTooLong(true), 8000);
    return () => clearTimeout(t);
  }, [loading]);

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
  ] : [
    { id: "dashboard", label: "Tableau de bord",    icon: "dashboard" },
    { id: "products",  label: "Produits",           icon: "products"  },
    { id: "stock",     label: "Mouvements stock",   icon: "stock"     },
    { id: "sales",     label: "Ventes",             icon: "sales"     },
    { id: "history",   label: "Historique clients", icon: "phone"     },
    { id: "reports",   label: "Rapports",           icon: "reports"   },
    { id: "blog",      label: "Blog",               icon: "blog"      },
    { id: "settings",  label: "Paramètres",         icon: "settings"  },
  ];

  const titles = {
    dashboard: "Tableau de bord",
    products:  "Produits",
    stock:     "Mouvements de stock",
    sales:     "Ventes",
    history:   "Historique clients",
    reports:   "Rapports",
    blog:      "Blog",
    settings:  "Paramètres",
  };

  return (
    <>
      {!splashDone && (
        <div className="splash" aria-hidden="true">
          <div className="splash-logo" style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
            <img src="/culturecasegs/logo.png" alt="logo" style={{ width:64, height:"auto", filter:"brightness(0) invert(1)" }}/>
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
            <img src="/culturecasegs/logo.png" alt="Culturecase logo" style={{ width:48, height:"auto", filter:"brightness(0) invert(1)", marginBottom:6 }}/>
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

              <button className="btn btn-outline btn-sm" onClick={() => exportData(data)} aria-label="Exporter les données" style={{ display: isViewer ? "none" : undefined }}>
                <Icon name="download" size={13} /> Exporter
              </button>

              <label className="btn btn-outline btn-sm" style={{ cursor: "pointer", display: isViewer ? "none" : "flex", alignItems: "center", gap: 5 }}>
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
              {page === "products"  && <Products data={data} onSale={addSale} onDelete={deleteProduct} isViewer={isViewer} />}
              {page === "stock"     && <StockPage data={data} onMove={addMovement} isViewer={isViewer} />}
              {page === "sales"     && <SalesPage data={data} onSale={addSale} onCancel={cancelSale} toast={toast} />}
              {page === "history"   && <HistoryPage data={data} />}
              {page === "reports"   && <Reports data={data} />}
              {page === "blog"      && <BlogPage />}
              {page === "settings"  && <SettingsPage data={data} onSave={saveSettings} onSaveProduct={saveProduct} onPersist={persist} confirm={confirm} />}
            </Suspense>
          </div>

          <nav className="bottom-nav" aria-label="Navigation principale">
            <div className="bottom-nav-inner">
              {(isViewer ? [
                { id: "dashboard", label: "Accueil",  icon: "dashboard" },
                { id: "products",  label: "Produits", icon: "products"  },
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
