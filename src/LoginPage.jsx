import { useState } from "react";
import { signIn, getViewerCode } from "./firebase.js";

function LoginPage({ onViewerAccess }) {
  const [mode, setMode]       = useState("admin"); // "admin" | "viewer"
  const [email, setEmail]     = useState("");
  const [pass,  setPass]      = useState("");
  const [code,  setCode]      = useState("");
  const [err,   setErr]       = useState("");
  const [loading, setLoading] = useState(false);

  const handleAdmin = async () => {
    if (!email.trim() || !pass) { setErr("Remplis tous les champs."); return; }
    setLoading(true); setErr("");
    try {
      await signIn(email.trim(), pass);
    } catch (e) {
      const msgs = {
        "auth/invalid-email":          "Adresse email invalide.",
        "auth/user-not-found":         "Aucun compte avec cet email.",
        "auth/wrong-password":         "Mot de passe incorrect.",
        "auth/invalid-credential":     "Email ou mot de passe incorrect.",
        "auth/too-many-requests":      "Trop de tentatives. Réessaie dans quelques minutes.",
        "auth/network-request-failed": "Erreur réseau. Vérifie ta connexion.",
      };
      setErr(msgs[e.code] || "Erreur de connexion (" + e.code + ").");
    } finally { setLoading(false); }
  };

  const handleViewer = async () => {
    if (!code.trim()) { setErr("Entre le code d'accès."); return; }
    setLoading(true); setErr("");
    try {
      // ── Le code est récupéré depuis Firebase Remote Config — jamais dans le JS ──
      const expected = await getViewerCode();
      if (!expected) {
        setErr("Service temporairement indisponible. Réessaie dans un instant.");
        return;
      }
      if (code.trim() !== expected) {
        setErr("Code incorrect.");
        return;
      }
      onViewerAccess();
    } catch {
      setErr("Impossible de vérifier le code. Vérifie ta connexion.");
    } finally { setLoading(false); }
  };

  return (
    <div className="login-wrap">
      <main>
        <div className="login-box" aria-label="Connexion">
          <div className="login-logo">Culturecase <span>GS</span></div>

          {/* ── Sélecteur de mode ── */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20, background: "var(--bg3)", borderRadius: 10, padding: 4 }}>
            <button
              onClick={() => { setMode("admin"); setErr(""); }}
              style={{
                flex: 1, padding: "8px 0", borderRadius: 7, border: "none",
                fontWeight: 700, fontSize: 13, cursor: "pointer",
                background: mode === "admin" ? "var(--accent2)" : "transparent",
                color: mode === "admin" ? "#fff" : "var(--text2)",
                transition: "all 0.15s",
              }}
            >👤 Admin</button>
            <button
              onClick={() => { setMode("viewer"); setErr(""); }}
              style={{
                flex: 1, padding: "8px 0", borderRadius: 7, border: "none",
                fontWeight: 700, fontSize: 13, cursor: "pointer",
                background: mode === "viewer" ? "var(--accent)" : "transparent",
                color: mode === "viewer" ? "#fff" : "var(--text2)",
                transition: "all 0.15s",
              }}
            >👁️ Iya Choua</button>
          </div>

          {err && (
            <div className="alert alert-danger" role="alert" aria-live="assertive">{err}</div>
          )}

          {mode === "admin" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="form-group">
                <label className="form-label" htmlFor="login-email">Email</label>
                <input
                  id="login-email" className="input" type="email"
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="admin@culturecase.com"
                  onKeyDown={e => e.key === "Enter" && handleAdmin()}
                  autoComplete="username"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="login-password">Mot de passe</label>
                <input
                  id="login-password" className="input" type="password"
                  value={pass} onChange={e => setPass(e.target.value)}
                  placeholder="••••••••"
                  onKeyDown={e => e.key === "Enter" && handleAdmin()}
                  autoComplete="current-password"
                />
              </div>
              <button
                className="btn btn-primary"
                style={{ width: "100%", justifyContent: "center", marginTop: 4 }}
                onClick={handleAdmin} disabled={loading} aria-busy={loading}
              >
                {loading ? "Connexion…" : "Se connecter"}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{
                background: "rgba(124,58,237,0.08)", borderRadius: 8,
                padding: "10px 14px", fontSize: 12, color: "var(--text2)", lineHeight: 1.6,
              }}>
                👁️ Mode <strong>Iya Choua</strong> — accès lecture seule pour consulter les produits et stocks disponibles.
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="viewer-code">Code d'accès Iya Choua</label>
                <input
                  id="viewer-code" className="input" type="password"
                  value={code} onChange={e => setCode(e.target.value)}
                  placeholder="Code fourni par l'admin"
                  onKeyDown={e => e.key === "Enter" && handleViewer()}
                />
              </div>
              <button
                className="btn btn-primary"
                style={{ width: "100%", justifyContent: "center", background: "var(--accent)", opacity: loading ? 0.7 : 1 }}
                onClick={handleViewer}
                disabled={loading}
                aria-busy={loading}
              >
                {loading ? "Vérification…" : "Accéder en lecture"}
              </button>
            </div>
          )}

          <p style={{ marginTop: 18, fontSize: 11.5, color: "var(--text2)", textAlign: "center" }}>
            Culturecase GS — Usage privé
          </p>
        </div>
      </main>
    </div>
  );
}

export default LoginPage;
