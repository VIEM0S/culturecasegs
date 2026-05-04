import { useCallback, useEffect, useRef, useState } from "react";
import Dashboard from "./Dashboard.jsx";
import { exportData, importData, saveData, subscribeToData } from "./data.js";
import { onAuthChange, signOut } from "./firebase.js";
import HistoryPage from "./HistoryPage.jsx";
import { useDialog, useToast } from "./hooks.jsx";
import Icon from "./Icon.jsx";
import LoginPage from "./LoginPage.jsx";
import Products from "./Products.jsx";
import Reports from "./Reports.jsx";
import SalesPage from "./SalesPage.jsx";
import SettingsPage from "./SettingsPage.jsx";
import StockPage from "./StockPage.jsx";
import { uid, todayDisplay } from "./utils.js";

function App() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [swReg, setSwReg] = useState(null);
  const [loading, setLoading] = useState(true); // attend Firebase Auth + données
  const [authUser, setAuthUser] = useState(undefined); // undefined = en attente, null = déconnecté, objet = connecté
  const [syncStatus, setSyncStatus] = useState("syncing");
  const isFirstLoad = useRef(true);
  const _localUpdate = useRef(false);
  const unsubData = useRef(null);
  const { confirm, alert: dlgAlert, Dialog } = useDialog();
  const { toast, Toasts } = useToast();

  // ── Écoute Firebase Auth (remplace l'auth hardcodée) ──────────────────────
  useEffect(() => {
    const unsubAuth = onAuthChange((user) => {
      setAuthUser(user); // null si déconnecté, objet Firebase si connecté

      if (user) {
        // Utilisateur connecté → écouter les données Firestore
        isFirstLoad.current = true;
        subscribeToData((freshData) => {
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
        }).then((unsub) => {
          unsubData.current = unsub;
        });
      } else {
        // Déconnecté → arrêter l'écoute Firestore et vider les données
        if (unsubData.current) {
          unsubData.current();
          unsubData.current = null;
        }
        setData(null);
        setLoading(false);
      }
    });

    const goOffline = () => setSyncStatus("offline");
    const goOnline = () => setSyncStatus("ok");
    // ✅ FIX: référence stable pour pouvoir la supprimer correctement
    const goUpdate = () => setShowUpdate(true);
    window.addEventListener("sw-update-available", goUpdate);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);

    return () => {
      unsubAuth();
      if (unsubData.current) unsubData.current();
      window.removeEventListener("sw-update-available", goUpdate);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  const persist = useCallback(
    (newData) => {
      _localUpdate.current = true;
      setData(newData);
      setSyncStatus("syncing");
      saveData(newData)
        .then(() => {
          setSyncStatus("ok");
        })
        .catch(() => {
          setSyncStatus("offline");
          toast(
            "❌ Erreur de synchronisation — données sauvegardées localement.",
            "error",
          );
        })
        .finally(() => {
          setTimeout(() => {
            _localUpdate.current = false;
          }, 2000);
        });
    },
    [setSyncStatus, toast],
  );

  // login/logout délèguent maintenant à Firebase Auth

  // ── PWA Install prompt ──────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      // Show banner only if not already installed
      if (!window.matchMedia("(display-mode: standalone)").matches) {
        setTimeout(() => setShowInstall(true), 2000);
      }
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // ── Splash screen ───────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setSplashDone(true), 1400);
    return () => clearTimeout(t);
  }, []);

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
    // onAuthChange ci-dessus se chargera de vider les données
  }, []);

  const saveProduct = useCallback(
    (product) => {
      // Supporte un produit seul ou un tableau (ajout multi-modèles)
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
      // movs peut être un seul mouvement ou un tableau
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

      // ── Propagation des renommages de modèles ──
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
      // Supprime les produits des modèles supprimés
      const deletedModels = oldModels.filter((m) => !newModels.includes(m));
      if (deletedModels.length > 0) {
        const nb = products.filter((p) =>
          deletedModels.includes(p.model),
        ).length;
        const ok = await confirm(
          `Supprimer aussi les ${nb} produit${nb > 1 ? "s" : ""} liés aux modèles supprimés ?`,
        );
        if (ok)
          products = products.filter((p) => !deletedModels.includes(p.model));
      }

      // ── Propagation des renommages de designs ──
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
      // Supprime les produits des designs supprimés
      const deletedDesignNames = oldDesigns
        .filter((d) => !newDesigns.find((nd) => nd.id === d.id))
        .map((d) => d.name);
      if (deletedDesignNames.length > 0) {
        const nb = products.filter((p) =>
          deletedDesignNames.includes(p.design),
        ).length;
        const ok = await confirm(
          `Supprimer aussi les ${nb} produit${nb > 1 ? "s" : ""} liés aux designs supprimés ?`,
        );
        if (ok)
          products = products.filter(
            (p) => !deletedDesignNames.includes(p.design),
          );
      }

      persist({ ...data, settings: newSettings, products });
    },
    [data, persist, confirm],
  );

  // Bouton "Réessayer" si le chargement dépasse 10s
  const [loadingTooLong, setLoadingTooLong] = useState(false);
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setLoadingTooLong(true), 10000);
    return () => clearTimeout(t);
  }, [loading]);

  // Attente de Firebase Auth (évite le flash de l'écran de login)
  if (authUser === undefined)
    return (
      <>
        <style>{css}</style>
        <div
          className={`splash ${splashDone ? "fade-out" : ""}`}
          role="status"
          aria-live="polite"
        >
          <div className="splash-logo">
            Culture<span>case</span> GS
          </div>
          <div className="splash-sub">Gestion de stock</div>
          <div className="splash-loader">
            <div className="splash-loader-bar" />
          </div>
        </div>
      </>
    );

  // Non authentifié → page de connexion
  if (!authUser)
    return (
      <>
        <style>{css}</style>
        <LoginPage />
      </>
    );

  // Authentifié mais données pas encore chargées
  if (loading || !data)
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          minHeight: "100vh",
          background: "#07070e",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "#8080aa",
          fontFamily: "sans-serif",
          gap: 14,
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 800, color: "#a78bfa" }}>
          Culturecase <span style={{ color: "#fff" }}>GS</span>
        </div>
        <div style={{ fontSize: 13 }}>
          {loadingTooLong
            ? "⚠️ La connexion prend trop longtemps…"
            : "Chargement des données…"}
        </div>
        {loadingTooLong && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "#555",
                maxWidth: 300,
                textAlign: "center",
                lineHeight: 1.6,
              }}
            >
              Vérifie ta connexion internet ou que Firebase est bien configuré.
            </div>
            <button
              onClick={() => window.location.reload()}
              aria-label="Réessayer la connexion"
              style={{
                marginTop: 6,
                padding: "10px 24px",
                background: "#a78bfa",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Réessayer
            </button>
          </div>
        )}
      </div>
    );

  const navItems = [
    { id: "dashboard", label: "Tableau de bord", icon: "dashboard" },
    { id: "products", label: "Produits", icon: "products" },
    { id: "stock", label: "Mouvements stock", icon: "stock" },
    { id: "sales", label: "Ventes", icon: "sales" },
    { id: "history", label: "Historique clients", icon: "phone" },
    { id: "reports", label: "Rapports", icon: "reports" },
    { id: "settings", label: "Paramètres", icon: "settings" },
  ];
  const titles = {
    dashboard: "Tableau de bord",
    products: "Produits",
    stock: "Mouvements de stock",
    sales: "Ventes",
    history: "Historique clients",
    reports: "Rapports",
    settings: "Paramètres",
  };

  return (
    <>
      <style>{css}</style>
      {/* ── SPLASH ── */}
      {!splashDone && (
        <div className="splash fade-out" aria-hidden="true">
          <div className="splash-logo">
            Culture<span>case</span> GS
          </div>
          <div className="splash-sub">Gestion de stock</div>
          <div className="splash-loader">
            <div className="splash-loader-bar" />
          </div>
        </div>
      )}
      {/* ── UPDATE BANNER ── */}
      {showUpdate && (
        <div className="update-banner">
          <span style={{ flex: 1 }}>🔄 Nouvelle version disponible</span>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => window.location.reload()}
          >
            Actualiser
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setShowUpdate(false)}
          >
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
            <button className="btn-install" onClick={handleInstall}>
              Installer
            </button>
            <button
              className="btn-dismiss"
              onClick={() => setShowInstall(false)}
              aria-label="Fermer"
            >
              ✕
            </button>
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
        <aside
          className={`sidebar ${sidebarOpen ? "open" : ""}`}
          aria-label="Menu latéral"
        >
          <div className="sidebar-logo">
            <h1>
              Culturecase <span>GS</span>
            </h1>
            <p>Gestion de stock</p>
          </div>
          <nav className="sidebar-nav" aria-label="Navigation principale">
            {navItems.map((item) => (
              <button
                key={item.id}
                className={`nav-item ${page === item.id ? "active" : ""}`}
                onClick={() => {
                  setPage(item.id);
                  setSidebarOpen(false);
                }}
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
            <div
              style={{ display: "flex", alignItems: "center", gap: 8 }}
              className="topbar-desktop-actions"
            >
              {/* Indicateur de synchronisation */}
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
                  syncStatus === "ok"
                    ? "Synchronisé"
                    : syncStatus === "offline"
                      ? "Hors ligne"
                      : "Synchronisation en cours"
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  color:
                    syncStatus === "ok"
                      ? "var(--success)"
                      : syncStatus === "offline"
                        ? "var(--warn)"
                        : "var(--text2)",
                  background:
                    syncStatus === "ok"
                      ? "rgba(34,197,94,0.1)"
                      : syncStatus === "offline"
                        ? "rgba(245,158,11,0.1)"
                        : "rgba(255,255,255,0.05)",
                  padding: "3px 8px",
                  borderRadius: 20,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "currentColor",
                    display: "inline-block",
                  }}
                />
                {syncStatus === "ok"
                  ? "Sync"
                  : syncStatus === "offline"
                    ? "Hors ligne"
                    : "…"}
              </span>
              <span style={{ fontSize: 11.5, color: "var(--text2)" }}>
                {todayDisplay()}
              </span>
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
                style={{
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <Icon name="arrow_up" size={13} /> Importer
                <input
                  type="file"
                  accept=".json"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const ok = await confirm(
                      "⚠️ L'import remplacera TOUTES les données actuelles. Continuer ?",
                    );
                    if (ok)
                      importData(e.target.files[0], setData, persist, toast);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>
          <div className="content">
            {page === "dashboard" && <Dashboard data={data} />}
            {page === "products" && (
              <Products
                data={data}
                onSave={saveProduct}
                onDelete={deleteProduct}
                onSale={addSale}
              />
            )}
            {page === "stock" && <StockPage data={data} onMove={addMovement} />}
            {page === "sales" && (
              <SalesPage data={data} onSale={addSale} toast={toast} />
            )}
            {page === "history" && <HistoryPage data={data} />}
            {page === "reports" && <Reports data={data} />}
            {page === "settings" && (
              <SettingsPage
                data={data}
                onSave={saveSettings}
                confirm={confirm}
              />
            )}
          </div>

          {/* ── BOTTOM NAV (mobile) ── */}
          <nav className="bottom-nav" aria-label="Navigation principale">
            <div className="bottom-nav-inner">
              {[
                { id: "dashboard", label: "Accueil", icon: "dashboard" },
                { id: "products", label: "Produits", icon: "products" },
                { id: "sales", label: "Ventes", icon: "sales" },
                { id: "reports", label: "Rapports", icon: "reports" },
              ].map((item) => (
                <button
                  key={item.id}
                  className={`bottom-nav-item ${page === item.id ? "active" : ""}`}
                  onClick={() => {
                    setPage(item.id);
                    setSidebarOpen(false);
                  }}
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

// ── CSS inline (variables + animations légères) ───────────────────────────
const css = `
  :root {
    --bg: #07070e;
    --bg2: #0f0f1a;
    --bg3: #16162a;
    --border: #1e1e35;
    --border2: #252540;
    --text: #e8e8f0;
    --text2: #7070a0;
    --accent: #a78bfa;
    --accent2: #7c3aed;
    --success: #22c55e;
    --danger: #ef4444;
    --warn: #f59e0b;
  }

  .splash {
    position: fixed; inset: 0; z-index: 9999;
    background: var(--bg);
    display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 12px;
    transition: opacity 0.5s ease;
  }
  .splash.fade-out { opacity: 0; pointer-events: none; }
  .splash-logo { font-size: 28px; font-weight: 900; color: var(--text); letter-spacing: -0.5px; }
  .splash-logo span { color: var(--accent); }
  .splash-sub { font-size: 13px; color: var(--text2); }
  .splash-loader { width: 160px; height: 3px; background: var(--bg3); border-radius: 2px; overflow: hidden; margin-top: 8px; }
  .splash-loader-bar { height: 100%; width: 40%; background: var(--accent); border-radius: 2px; animation: loaderSlide 1.2s ease-in-out infinite; }
  @keyframes loaderSlide {
    0%   { transform: translateX(-100%); }
    50%  { transform: translateX(150%); }
    100% { transform: translateX(400%); }
  }

  .update-banner {
    position: fixed; top: 0; left: 0; right: 0; z-index: 800;
    background: var(--accent2); color: #fff;
    display: flex; align-items: center; gap: 10px;
    padding: 10px 16px; font-size: 13px;
  }
  .install-banner {
    position: fixed; bottom: 70px; left: 12px; right: 12px; z-index: 700;
    background: var(--bg2); border: 1px solid var(--border2);
    border-radius: 14px; padding: 12px 14px;
    display: flex; align-items: center; gap: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  }
  .install-banner-icon { font-size: 24px; }
  .install-banner-text { flex: 1; display: flex; flex-direction: column; gap: 2px; }
  .install-banner-text strong { font-size: 13px; color: var(--text); }
  .install-banner-text span  { font-size: 11px; color: var(--text2); }
  .install-actions { display: flex; align-items: center; gap: 8px; }
  .btn-install { background: var(--accent); color: #fff; border: none; border-radius: 8px; padding: 7px 14px; font-size: 13px; font-weight: 700; cursor: pointer; }
  .btn-dismiss { background: none; border: none; color: var(--text2); font-size: 16px; cursor: pointer; padding: 4px 8px; }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

export default App;
