import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { exportData, importData, saveData } from "./data.js";
import { maybeWeeklyBackup } from "./googleSheets.js";
import { useDialog, useToast } from "./hooks.jsx";
import { useAuth } from "./useAuth.js";
import { useStockActions } from "./useStockActions.js";
import { useWebOrders } from "./useWebOrders.js";
import Icon from "./Icon.jsx";
import LoginPage from "./LoginPage.jsx";
import { todayDisplay, lazyWithRetry } from "./utils.js";

const Dashboard    = lazyWithRetry(() => import("./Dashboard.jsx"));
const Products     = lazyWithRetry(() => import("./Products.jsx"));
const StockPage    = lazyWithRetry(() => import("./StockPage.jsx"));
const SalesPage    = lazyWithRetry(() => import("./SalesPage.jsx"));
const HistoryPage  = lazyWithRetry(() => import("./HistoryPage.jsx"));
const Reports      = lazyWithRetry(() => import("./Reports.jsx"));
const SettingsPage = lazyWithRetry(() => import("./SettingsPage.jsx"));
const BlogPage     = lazyWithRetry(() => import("./BlogPage.jsx"));
const ReviewsPage  = lazyWithRetry(() => import("./ReviewsPage.jsx"));
const ErrorLogsPage = lazyWithRetry(() => import("./ErrorLogsPage.jsx"));

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
  // Swipe gauche/droite (voir plus bas) — doit être appelé sans condition,
  // avant les "return" anticipés de l'écran de connexion/splash/erreur.
  const touchStartRef = useRef(null);

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
  // Avec persistentLocalCache(), batch.commit() résout immédiatement même
  // hors ligne (écriture mise en file d'attente localement). On inspecte
  // navigator.onLine pour afficher le bon statut dans l'UI.
  const persist = useCallback((newData) => {
    _localUpdate.current = true;
    setData(newData);
    setSyncStatus(navigator.onLine ? "syncing" : "offline");
    saveData(newData)
      .then(() => {
        setSyncStatus(navigator.onLine ? "ok" : "offline");
      })
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
    confirmDelivery, cancelPendingDelivery, editPendingDelivery,
    saveSettings,
  } = useStockActions({ data, persist, confirm });

  // ── Commandes passées sur le site public, en attente de validation ───────
  const {
    webOrders, processing: webOrderProcessing,
    validateWebOrder, rejectWebOrder,
  } = useWebOrders({ data, addSale, toast });

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
    console.log("%c[CultureCase GS] build: livraisons-en-attente v1 (27 juin 2026)", "color:#22c55e;font-weight:bold");
  }, []);

  // ── Backup hebdomadaire automatique (chaque lundi, admin uniquement) ──────
  // maybeWeeklyBackup gère lui-même le "déjà fait aujourd'hui ?" en interne,
  // donc pas de souci à l'appeler à chaque changement de data.
  useEffect(() => {
    if (!data || isViewer) return;
    maybeWeeklyBackup(data);
  }, [data, isViewer]);

  useEffect(() => {
    if (authUser !== undefined && !loading) setSplashDone(true);
  }, [authUser, loading]);

  // ── Reset du scroll au changement de page ────────────────────────────────
  // Les "pages" sont un simple swap de composant dans .content, pas une vraie
  // navigation — le scroll du body (seul conteneur scrollable de l'app) était
  // donc conservé d'une page à l'autre : arriver sur Ventes déjà scrollé à la
  // position laissée sur Produits, ce qui donne l'impression que les pages
  // défilent ensemble.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

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
    const t = setTimeout(() => setLoadingTooLong(true), 20000);
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
              style={{ padding: "10px 24px", background: "var(--btn)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer" }}
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
    return <LoginPage onViewerAccess={() => { setPage("dashboard"); loginAsViewer(); }} />;

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
  // Pages accessibles en mode viewer
  const VIEWER_PAGES = ["dashboard", "products"];

  // setPage sécurisé : le viewer ne peut pas accéder aux pages interdites
  const safePage = (id) => {
    if (isViewer && !VIEWER_PAGES.includes(id)) return;
    setPage(id);
    setSidebarOpen(false);
  };

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
    { id: "reviews",   label: "Avis clients",       icon: "star"      },
    { id: "errors",    label: "Erreurs",            icon: "alert"     },
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
    reviews:   "Avis clients",
    errors:    "Erreurs",
    settings:  "Paramètres",
  };

  // Sous-ensemble de pages accessibles depuis la barre du bas (mobile) —
  // partagé entre la perle glissante et le swipe gauche/droite ci-dessous,
  // pour que les deux suivent le même ordre.
  const bottomNavItems = isViewer ? [
    { id: "dashboard", label: "Accueil",  icon: "dashboard" },
    { id: "products",  label: "Produits", icon: "products"  },
  ] : [
    { id: "dashboard", label: "Accueil",  icon: "dashboard" },
    { id: "products",  label: "Produits", icon: "products"  },
    { id: "sales",     label: "Ventes",   icon: "sales"     },
    { id: "stock",     label: "Stock",    icon: "stock"     },
    { id: "settings",  label: "Réglages", icon: "settings"  },
  ];

  // ── Swipe gauche/droite entre pages (mobile uniquement, sous 769px comme
  // la barre du bas) ── glisser à gauche avance à la page suivante de
  // bottomNavItems, à droite revient à la précédente. Ignoré si le geste
  // démarre dans un conteneur à défilement horizontal (tableaux, onglets)
  // pour ne pas voler leur scroll natif.
  const handleContentTouchStart = (e) => {
    if (window.innerWidth > 768) return;
    if (e.target.closest(".table-wrap, .history-table-wrap, .tabs")) return;
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY, time: Date.now() };
  };
  const handleContentTouchEnd = (e) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const dt = Date.now() - start.time;
    const isHorizontal = Math.abs(dx) > Math.abs(dy) * 1.5;
    if (!isHorizontal || Math.abs(dx) < 60 || dt > 600) return;
    const idx = bottomNavItems.findIndex(i => i.id === page);
    if (idx === -1) return;
    if (dx < 0 && idx < bottomNavItems.length - 1) safePage(bottomNavItems[idx + 1].id);
    else if (dx > 0 && idx > 0) safePage(bottomNavItems[idx - 1].id);
  };

  return (
    <>
      {!splashDone && (
        <div className="splash" aria-hidden="true">
          <div className="splash-logo" style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
            <span
              role="img" aria-label="logo"
              style={{
                display: "block", width: 64, height: 40, background: "var(--accent)",
                WebkitMaskImage: "url(/culturecasegs/logo.png)", maskImage: "url(/culturecasegs/logo.png)",
                WebkitMaskSize: "contain", maskSize: "contain",
                WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
                WebkitMaskPosition: "center", maskPosition: "center",
              }}
            />
            <span>Culture<span style={{color:"var(--accent)"}}>case</span></span>
          </div>
          <div className="splash-sub">Gestion de stock</div>
          <div className="splash-loader"><div className="splash-loader-bar" /></div>
        </div>
      )}

      {showUpdate && (
        <div className="update-banner">
          {/* Pas de bouton "Ignorer" : travailler sans le savoir sur une
              version périmée peut casser des actions critiques (ex. un
              rejet de commande site qui redevient une suppression au lieu
              d'un changement de statut). La bannière reste donc affichée
              jusqu'à l'actualisation. */}
          <span style={{ flex: 1 }}>🔄 Nouvelle version disponible — actualise pour continuer en toute sécurité</span>
          <button className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>Actualiser</button>
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
            <span
              role="img" aria-label="Culturecase logo"
              style={{
                display: "block", width: 48, height: 30, background: "var(--accent)", marginBottom: 6,
                WebkitMaskImage: "url(/culturecasegs/logo.png)", maskImage: "url(/culturecasegs/logo.png)",
                WebkitMaskSize: "contain", maskSize: "contain",
                WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
                WebkitMaskPosition: "center", maskPosition: "center",
              }}
            />
            <h1>Culturecase</h1>
            <p>{isViewer ? "👁️ Iya Choua — lecture seule" : "Gestion de stock"}</p>
          </div>
          <nav className="sidebar-nav" aria-label="Navigation principale">
            {navItems.map((item) => (
              <button
                key={item.id}
                className={`nav-item ${page === item.id ? "active" : ""}`}
                onClick={() => safePage(item.id)}
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
              <button className="nav-item" onClick={() => { setPage("dashboard"); logout(); }} style={{ width: "100%" }} aria-label="Déconnexion">
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
                {syncStatus === "ok" ? "Sync" : syncStatus === "offline" ? "En attente" : "…"}
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

          <div className="content" onTouchStart={handleContentTouchStart} onTouchEnd={handleContentTouchEnd}>
            <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "var(--text2)", fontSize: 13 }}>Chargement…</div>}>
              {!data && <div style={{ padding: 40, textAlign: "center", color: "var(--text2)", fontSize: 13 }}>Chargement des données…</div>}
              {data && <>
              {/* Garde viewer : si page interdite, afficher dashboard */}
              {isViewer && !VIEWER_PAGES.includes(page) && <Dashboard data={data} isViewer={isViewer} />}
              {(!isViewer || VIEWER_PAGES.includes(page)) && page === "dashboard" && <Dashboard data={data} isViewer={isViewer} />}
              {(!isViewer || VIEWER_PAGES.includes(page)) && page === "products"  && <Products data={data} onSale={addSale} onDelete={deleteProduct} isViewer={isViewer} />}
              {!isViewer && page === "stock"     && <StockPage data={data} onMove={addMovement} isViewer={isViewer} />}
              {!isViewer && page === "sales"     && <SalesPage data={data} onSale={addSale} onCancel={cancelSale} onConfirmDelivery={confirmDelivery} onCancelPendingDelivery={cancelPendingDelivery} onEditPendingDelivery={editPendingDelivery} toast={toast} webOrders={webOrders} webOrderProcessing={webOrderProcessing} onValidateWebOrder={validateWebOrder} onRejectWebOrder={rejectWebOrder} />}
              {!isViewer && page === "history"   && <HistoryPage data={data} />}
              {!isViewer && page === "reports"   && <Reports data={data} />}
              {!isViewer && page === "blog"      && <BlogPage />}
              {!isViewer && page === "reviews"   && <ReviewsPage />}
              {!isViewer && page === "errors"    && <ErrorLogsPage />}
              {!isViewer && page === "settings"  && <SettingsPage data={data} onSave={saveSettings} onSaveProduct={saveProduct} onPersist={persist} confirm={confirm} />}
              </>}
            </Suspense>
          </div>

          <nav className="bottom-nav" aria-label="Navigation principale">
            {(() => {
              const activeIndex = bottomNavItems.findIndex(i => i.id === page);
              return (
                <div className="bottom-nav-inner">
                  {/* ── Perle unique qui glisse d'un onglet à l'autre (au lieu d'un
                      indicateur par bouton qui apparaît/disparaît sur place) ── */}
                  <div
                    className="bn-bead"
                    style={{
                      width: `${100 / bottomNavItems.length}%`,
                      left: `${(Math.max(activeIndex, 0) / bottomNavItems.length) * 100}%`,
                      opacity: activeIndex === -1 ? 0 : 1,
                    }}
                  />
                  {bottomNavItems.map((item) => (
                    <button
                      key={item.id}
                      className={`bottom-nav-item ${page === item.id ? "active" : ""}`}
                      onClick={() => safePage(item.id)}
                    >
                      <Icon name={item.icon} size={20} />
                      {item.label}
                    </button>
                  ))}
                </div>
              );
            })()}
          </nav>
        </main>
      </div>
    </>
  );
}

export default App;
