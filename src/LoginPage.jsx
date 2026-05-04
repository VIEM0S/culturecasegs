import { useState } from "react";
import { signIn } from "./firebase.js";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!email.trim() || !pass) {
      setErr("Remplis tous les champs.");
      return;
    }
    setLoading(true);
    setErr("");
    try {
      await signIn(email.trim(), pass);
      // onLogin() sera appelé automatiquement par onAuthStateChanged dans App
    } catch (e) {
      const msgs = {
        "auth/invalid-email": "Adresse email invalide.",
        "auth/user-not-found": "Aucun compte avec cet email.",
        "auth/wrong-password": "Mot de passe incorrect.",
        "auth/invalid-credential": "Email ou mot de passe incorrect.",
        "auth/too-many-requests":
          "Trop de tentatives. Réessaie dans quelques minutes.",
        "auth/network-request-failed": "Erreur réseau. Vérifie ta connexion.",
      };
      setErr(msgs[e.code] || "Erreur de connexion (" + e.code + ").");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-box" role="main" aria-label="Connexion">
        <div className="login-logo">
          Culturecase <span>GS</span>
        </div>
        <div className="login-sub">Gestion de stock — Admin</div>
        {err && <div className="alert alert-danger">{err}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@culturecase.com"
              onKeyDown={(e) => e.key === "Enter" && handle()}
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Mot de passe</label>
            <input
              className="input"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
              onKeyDown={(e) => e.key === "Enter" && handle()}
              autoComplete="current-password"
            />
          </div>
          <button
            className="btn btn-primary"
            style={{ width: "100%", justifyContent: "center", marginTop: 4 }}
            onClick={handle}
            disabled={loading}
          >
            {loading ? "Connexion…" : "Se connecter"}
          </button>
        </div>
        <p
          style={{
            marginTop: 18,
            fontSize: 11.5,
            color: "var(--text2)",
            textAlign: "center",
          }}
        >
          Culturecase GS — Usage privé
        </p>
      </div>
    </div>
  );
}
// ─── DASHBOARD ─────────────────────────────────────────────────────────────

export default LoginPage;
