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
          <div className="login-logo" style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
            <img src="data:image/png;base64,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zLU+7deZRofunmQXYykxZHyu2vDyZi0CZufVRpEuxboDe4A3ddn+TQrt6h4f3YvzbFYTYF8vXfN237axdK4tvt+tvs80j+SOinjHt6oJni2l8tjoZXt7af+v+377y9b9+e7BtWRVPaxUNzaLyD7gbqxuPIQZ7vfXnVLZT4Nv5ECkwFrKDKau78Ac+/YCbfeDWYzf0v4RTFvevoWism3wylfep8XSkdmDOo4PI/0m4M1Y92LaB0VGQaTWfjP27h/BJjApl01nubVK2xa9rDeU9inXmdh+mG9TltaLRazB3IPVvVPpbvifalJgLSVatkOwEItulEdqurWCZc/lsi9Vr306PZ0jMPo3MHeLNNKOhrAdHg38hpdB5/exXLlFwHMvm3D46d3MUk/1bpyPzXaUmlYHKbAOJOIBX4tF+y/pOrt/DPTOO7SkgnWq913U/fK2Oe9CngFchxlss8KODsHe+XWqeoaXxVzH9m5/A8vHBPq5RESuxTT3OQ/zKh8bGSZeSw60dCUFVndavryrFOs173atM3BPdxHZo+aRPId5LocDadB2z+UFF3pzJW/4YNGPm8ecDzcAF1BU2BRYoyMaIcWcgjfgTqBeRp3lNktR7lG2Zc1rtlQ3NrgH+/OwbmNDVc90QTUPbPS69i6K+pd0kAKrO9GynaaqZwObPAmcAm/17RtV9UoPyYlEamHniNZyi6o+RlUP9/32qOpWigBagO1+/F7vhpwEnE22sOMiBNbZwEliSRL3etluL+233UN29nj57VHVQzEbJgAi8rNS3dinqo8G3oQJqBksL5d63dqrNpnxaaX7SDpIP6z++A7wfmwWnlf7uogFfL9vj2Dqi7HEauHTFb/vAb6HheUcTTGS+HPgLdhH8mzMdrVIerSPm4gA+VPgb7DyvpKisRFM+OwuHfNOPJUvHr5DEVs4g2lP8yz1u/ooNrK8CbjK16XdsgcpsJYn3k2vypPe58mwSWG1DCmw+iO8oLt5HXcmT+uVlyr268xdFEn46HH+ZLxE7iw4sOy6xZEut72be0q5/qT7ygqkwEqSpDZkdyZJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJ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" alt="Culturecase logo" style={{ width:70, height:"auto", filter:"brightness(0) invert(1)" }}/>
            <span>Culturecase</span>
          </div>

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
